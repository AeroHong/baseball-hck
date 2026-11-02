/**
 * 클라우드 기록 (Firebase Firestore + 익명 로그인). 순위표를 기기 사이에서 공유한다.
 *
 * - players/{id}  : { name, position, createdAt, ownerUid }
 * - sessions/{id} : { playerId, date, position, difficulty, retry, answers[], uid }
 *
 * 기기마다 익명 로그인(uid)을 한다. 로그인 화면은 없다.
 * 선수를 만든 기기(ownerUid)만 포지션 변경·선수 삭제를 할 수 있다 (firestore.rules).
 * 웹 설정값(apiKey 등)은 공개되어도 되는 식별자다.
 * 오프라인이면 기기에 쌓아 두었다가 연결되면 자동으로 올라간다 (persistentLocalCache).
 */
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
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
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import type { Player, SessionRecord } from './records';
import { parseStore } from './records';
import type { PosKey } from './types';

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

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
function getApp(): FirebaseApp {
  return (app ??= initializeApp(firebaseConfig));
}
function getDb(): Firestore {
  if (db) return db;
  try {
    db = initializeFirestore(getApp(), { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  } catch {
    db = getFirestore(getApp()); // IndexedDB 불가 환경(시크릿 창 등): 메모리 캐시
  }
  return db;
}

let uidPromise: Promise<string> | null = null;
/** 익명 로그인 uid. 이 브라우저에 유지된다 (사이트 데이터를 지우면 새 uid) */
export function ensureUid(): Promise<string> {
  return (uidPromise ??= new Promise<string>((resolve, reject) => {
    const auth = getAuth(getApp());
    const off = onAuthStateChanged(
      auth,
      (user) => {
        if (user) {
          off();
          resolve(user.uid);
        } else {
          signInAnonymously(auth).catch((e) => {
            off();
            uidPromise = null;
            reject(e);
          });
        }
      },
      (e) => {
        uidPromise = null;
        reject(e);
      },
    );
  }));
}

export interface CloudSnapshot {
  players: Player[];
  sessions: SessionRecord[];
  /** 서버에서 확인된 데이터인지 (false 면 기기 캐시) */
  fromServer: boolean;
}

/**
 * 로그인 후 선수·판을 실시간 구독. 받은 문서는 parseStore 로 검증해서 넘긴다(손상·변조 데이터 방어).
 * 반환값으로 구독 해제.
 */
export function subscribeCloud(onData: (s: CloudSnapshot) => void, onError: (e: Error) => void): () => void {
  let stopped = false;
  let unsub = () => {};
  ensureUid()
    .then(() => {
      if (stopped) return;
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
      unsub = () => {
        unP();
        unS();
      };
    })
    .catch(onError);
  return () => {
    stopped = true;
    unsub();
  };
}

/** 새 선수 등록 (이 기기가 주인) */
export async function createPlayer(p: Player): Promise<void> {
  const uid = await ensureUid();
  await setDoc(doc(getDb(), 'players', p.id), { name: p.name, position: p.position, createdAt: p.createdAt, ownerUid: uid });
}

/** 주 포지션 변경 (주인 기기만) */
export async function updatePlayerPosition(id: string, position: PosKey | null): Promise<void> {
  await ensureUid();
  await updateDoc(doc(getDb(), 'players', id), { position });
}

export async function saveSession(s: SessionRecord): Promise<void> {
  const uid = await ensureUid();
  const { id, ...data } = s;
  // Firestore 는 undefined 필드를 거부하므로 JSON 왕복으로 정리
  await setDoc(doc(getDb(), 'sessions', id), { ...JSON.parse(JSON.stringify(data)), uid });
}

/** 선수와 그 선수의 판 전부 삭제 (주인 기기만). 한 번에 최대 500개씩 */
export async function deletePlayer(id: string, sessionIds: string[]): Promise<void> {
  await ensureUid();
  const d = getDb();
  for (let i = 0; i < sessionIds.length; i += 450) {
    const b = writeBatch(d);
    for (const sid of sessionIds.slice(i, i + 450)) b.delete(doc(d, 'sessions', sid));
    await b.commit();
  }
  const b = writeBatch(d);
  b.delete(doc(d, 'players', id));
  await b.commit();
}
