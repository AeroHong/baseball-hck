export interface Point {
  x: number;
  y: number;
}

export type Kind = 'ground' | 'single' | 'fly' | 'extra' | 'popup' | 'bunt';
export type Base = 'H' | 'B1' | 'B2' | 'B3';
export type PosKey = 'P' | 'C' | '1B' | '2B' | '3B' | 'SS' | 'LF' | 'CF' | 'RF';
export type Shift = 'normal' | 'dp' | 'in';
export type Role = 'ball' | 'cover' | 'cut' | 'back' | 'stand';

export interface Runners {
  1: boolean;
  2: boolean;
  3: boolean;
}

export interface Situation {
  kind: Kind;
  /** -45 ~ 45. 중견 0, 좌측 음수. 범위 밖이면 computePlan 에서 클램프 */
  angle: number;
  runners: Runners;
  outs: 0 | 1 | 2;
  shift: Shift;
}

export interface Assignment {
  pos: Point;
  role: Role;
  /** cover 면 필수. back 이면 백업 대상 베이스(있을 때) */
  base?: Base;
  text: string;
}

/** 팀 방식 (§12-1) */
export interface Options {
  homeCutoff: 'split' | 'firstBase';
  centerKeystone: 'SS' | '2B';
  pitcherDpCover: 'SS' | '2B';
  extraHome2B: 'empty' | 'firstBase';
  buntPlay: 'standard' | 'rotation';
}

export const DEFAULT_OPTIONS: Options = {
  homeCutoff: 'split',
  centerKeystone: 'SS',
  pitcherDpCover: 'SS',
  extraHome2B: 'empty',
  buntPlay: 'standard',
};

/** 주자 이동 (§12-4) */
export interface RunnerMove {
  id: 'batter' | 1 | 2 | 3;
  /** 지나는 베이스 순서. 첫 원소 = 출발 베이스 (타자는 'H') */
  path: Base[];
  result: 'safe' | 'out' | 'attempt' | 'hold';
}

export interface Plan {
  title: string;
  ballPoint: Point;
  assignments: Record<PosKey, Assignment>;
  /** [타구지점, (중계...), 목표]. 송구 없음 = [ballPoint] */
  throwPath: Point[];
  cutIndices: number[];
  target: Base | null;
  altThrowPath?: Point[];
  /** 타자·주자 이동 (§12-4) */
  runnerMoves: RunnerMove[];
  notes: string[];
  warnings?: string[];
}

export const POS_KEYS: PosKey[] = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];

export const POS_NUMBER: Record<PosKey, number> = {
  P: 1, C: 2, '1B': 3, '2B': 4, '3B': 5, SS: 6, LF: 7, CF: 8, RF: 9,
};

export const POS_NAME: Record<PosKey, string> = {
  P: '투수', C: '포수', '1B': '1루수', '2B': '2루수', '3B': '3루수',
  SS: '유격수', LF: '좌익수', CF: '중견수', RF: '우익수',
};

export const BASE_NAME: Record<Base, string> = { H: '홈', B1: '1루', B2: '2루', B3: '3루' };

export const ROLE_NAME: Record<Role, string> = {
  ball: '타구 처리', cover: '베이스 커버', cut: '중계·컷오프', back: '백업', stand: '대기',
};
