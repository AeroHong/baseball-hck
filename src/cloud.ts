/**
 * 클라우드 기록 (Firebase Firestore). 순위표를 기기 사이에서 공유한다.
 *
 * - players/{id}  : { name, position, createdAt }
 * - sessions/{id} : { playerId, date, position, difficulty, retry, answers[] }
 *
 * 웹 설정값(apiKey 등)은 공개되어도 되는 식별자다. 접근 제어는 firestore.rules 가 한다.
 * 오프라인이면 기기에 쌓아 두었다가 연결되면 자동으로 올라간다 (persistentLocalCache).
 */
import { initializeApp } from 'firebase/app';
import {
  collection,
  doc,
  getFirestore,
  initializeFirestore,
  limit,
  onSnapshot,
  orderBy,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import type { Player, SessionRecord } from './records';
import { parseStore } from './records';

const firebaseConfig = {
  apiKey: 'AIzaSyDkQ5Cy5gj81w-2UAl0ehT8ISjSPfWtiXs',
  authDomain: 'baseball-hck.firebaseapp.com',
  projectId: 'baseball-hck',
  storageBucket: 'baseball-hck.firebasestorage.app',
  messagingSenderId: '848928286494',
  appId: '1:848928286494:web:99b261c9819f619e4c8b0f',
};

/** 순위 집계에 쓰는 최근 판 수 */
export const SESSION_LIMIT = 2000;

export type CloudStatus = 'connecting' | 'online' | 'offline' | 'error';

let db: Firestore | null = null;
function getDb(): Firestore {
  if (db) return db;
  const app = initializeApp(firebaseConfig);
  try {
    db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  } catch {
    db = getFirestore(app); // IndexedDB 불가 환경(시크릿 창 등): 메모리 캐시
  }
  return db;
}

export interface CloudSnapshot {
  players: Player[];
  sessions: SessionRecord[];
  /** 서버에서 확인된 데이터인지 (false 면 기기 캐시) */
  fromServer: boolean;
}

/**
 * 선수·판을 실시간 구독. 받은 문서는 parseStore 로 검증해서 넘긴다(손상·변조 데이터 방어).
 * 반환값으로 구독 해제.
 */
export function subscribeCloud(onData: (s: CloudSnapshot) => void, onError: (e: Error) => void): () => void {
  const d = getDb();
  let players: unknown[] | null = null;
  let sessions: unknown[] | null = null;
  let serverP = false;
  let serverS = false;
  const emit = () => {
    if (!players || !sessions) return;
    const parsed = parseStore(JSON.stringify({ players, sessions, currentId: null }));
    if (parsed) onData({ players: parsed.players, sessions: parsed.sessions, fromServer: serverP && serverS });
  };
  const unP = onSnapshot(
    collection(d, 'players'),
    { includeMetadataChanges: true },
    (snap) => {
      players = snap.docs.map((x) => ({ ...x.data(), id: x.id }));
      serverP = !snap.metadata.fromCache;
      emit();
    },
    onError,
  );
  const unS = onSnapshot(
    query(collection(d, 'sessions'), orderBy('date', 'desc'), limit(SESSION_LIMIT)),
    { includeMetadataChanges: true },
    (snap) => {
      sessions = snap.docs.map((x) => ({ ...x.data(), id: x.id }));
      serverS = !snap.metadata.fromCache;
      emit();
    },
    onError,
  );
  return () => {
    unP();
    unS();
  };
}

export function savePlayer(p: Player): Promise<void> {
  const { id, ...data } = p;
  return setDoc(doc(getDb(), 'players', id), data);
}

export function saveSession(s: SessionRecord): Promise<void> {
  const { id, ...data } = s;
  // Firestore 는 undefined 필드를 거부하므로 JSON 왕복으로 정리
  return setDoc(doc(getDb(), 'sessions', id), JSON.parse(JSON.stringify(data)));
}
