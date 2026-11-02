/**
 * 클라우드 기록 (Firebase Firestore + 익명 로그인). 순위표를 기기 사이에서 공유한다.
 *
 * - players/{id}  : { name, position, createdAt, ownerUid }
 * - sessions/{id} : { playerId, date, position, difficulty, retry, answers[], uid }
 *
 * 선수 = Firebase 이메일/비밀번호 계정. 사용자에게는 '이름 + PIN 4자리' 로만 보인다.
 *   이메일 = sha256(선수 ID) 앞 32자 @player.baseball-hck.app, 비밀번호 = PIN + 고정 접미사.
 *   PIN 검사·연속 실패 차단은 Firebase 인증 서버가 한다 (DB 에 PIN 이 남지 않는다).
 * 선수로 로그인하지 않은 기기는 익명 로그인으로 순위표만 읽는다.
 * 그 선수로 로그인한 사람만 기록·포지션 변경·삭제를 할 수 있다 (firestore.rules).
 * 웹 설정값(apiKey 등)은 공개되어도 되는 식별자다.
 * 오프라인이면 기기에 쌓아 두었다가 연결되면 자동으로 올라간다 (persistentLocalCache).
 */
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
} from 'firebase/auth';
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
  getDoc,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import type { Player, SessionRecord } from './records';
import { mergeLegacy, normalizeName, parseStore, playerKey } from './records';
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

const auth = (): Auth => getAuth(getApp());

let uidPromise: Promise<string> | null = null;
/** 익명 로그인 uid. 이 브라우저에 유지된다 (사이트 데이터를 지우면 새 uid) */
export function ensureUid(): Promise<string> {
  return (uidPromise ??= new Promise<string>((resolve, reject) => {
    const a = auth();
    const off = onAuthStateChanged(
      a,
      (user) => {
        if (user) {
          off();
          resolve(user.uid);
        } else {
          signInAnonymously(a).catch((e) => {
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
        if (parsed) onData({ ...mergeLegacy(parsed.players, parsed.sessions), fromServer: serverP && serverS });
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

/* ── 선수 로그인 (이름 + PIN) ───────────────────────── */

export interface AuthState {
  uid: string;
  /** 익명(선수 로그인 안 함) */
  anonymous: boolean;
}

/** 로그인 상태 구독. 로그아웃 상태가 되면 바로 익명 로그인한다 */
export function watchAuth(cb: (s: AuthState) => void): () => void {
  return onAuthStateChanged(auth(), (u) => {
    if (u) cb({ uid: u.uid, anonymous: u.isAnonymous });
    else signInAnonymously(auth()).catch(() => {});
  });
}

async function credentials(name: string, pin: string) {
  const bytes = new TextEncoder().encode(playerKey(name));
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return { email: `${hash.slice(0, 32)}@player.baseball-hck.app`, password: `${pin}-bhck-${hash.slice(32, 40)}` };
}

export const PIN_RE = /^\d{4}$/;

/** Firebase 오류 → 화면 문구 */
export function authMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found')
    return 'PIN이 맞지 않습니다.';
  if (code === 'auth/too-many-requests') return '틀린 PIN을 여러 번 입력했습니다. 잠시 후 다시 시도하세요.';
  if (code === 'auth/network-request-failed') return '인터넷 연결을 확인하세요.';
  if (code === 'auth/email-already-in-use') return '이미 등록된 이름입니다. PIN을 입력해 로그인하세요.';
  return '처리하지 못했습니다. 다시 시도하세요.';
}

/** 기존 선수로 로그인 */
export async function loginPlayer(name: string, pin: string): Promise<void> {
  const c = await credentials(name, pin);
  await signInWithEmailAndPassword(auth(), c.email, c.password);
}

/**
 * 새 선수 등록: 계정을 만들고 선수 문서를 쓴다.
 * 계정은 있는데 선수 문서가 없으면(삭제 후 재등록 등) 같은 PIN 으로 로그인해 문서만 다시 만든다.
 */
export async function registerPlayer(name: string, pin: string, position: PosKey | null): Promise<Player> {
  const n = normalizeName(name);
  const c = await credentials(n, pin);
  let uid: string;
  try {
    uid = (await createUserWithEmailAndPassword(auth(), c.email, c.password)).user.uid;
  } catch (e) {
    if ((e as { code?: string }).code !== 'auth/email-already-in-use') throw e;
    uid = (await signInWithEmailAndPassword(auth(), c.email, c.password)).user.uid;
  }
  const ref = doc(getDb(), 'players', playerKey(n));
  const existing = await getDoc(ref).catch(() => null);
  const player: Player = { id: playerKey(n), name: n, position, createdAt: Date.now(), ownerUid: uid };
  if (!existing?.exists()) await setDoc(ref, { name: n, position, createdAt: player.createdAt, ownerUid: uid });
  return player;
}

/** 선수 로그아웃 → 익명으로 돌아감 */
export async function logoutPlayer(): Promise<void> {
  await signOut(auth());
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

/** 선수와 그 선수의 판 전부 삭제 + 계정 삭제 (그 선수로 로그인했을 때만). 한 번에 최대 450개씩 */
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
  // 계정까지 지워 이름을 비운다. 최근 로그인이 아니면 실패할 수 있는데, 그러면 같은 PIN 으로 재등록 가능
  await auth().currentUser?.delete().catch(() => signOut(auth()));
}
