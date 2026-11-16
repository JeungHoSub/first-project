// 엔진 공용 타입. 모든 상태는 직렬화 가능한 plain object.

export type Kind = 'G' | 'Y' | 'T' | 'P' | 'D'; // 광 / 열끗 / 띠 / 피 / 쌍피
export type Tag = 'hong' | 'cheong' | 'cho' | 'godori' | 'gukjin' | 'bi';
export type PlayerId = 0 | 1;

export interface Card {
  id: string; // "월(2자리)-종류-순번" 예: "11-D-0"
  month: number; // 1~12
  kind: Kind;
  tag?: Tag;
}

/** 규칙 옵션(rules.md 7절 R01~R22 중 1단계에서 쓰는 것 + 3단계 자리). */
export interface RuleOptions {
  winScore: number; // R01 고/스톱 가능 기준 (기본 7)
  goBonusMode: 'n'; // R02 고 가산 방식 (1단계는 +n만)
  goMultiplierFrom: number; // 이 고 횟수부터 배수 ×2^(n-from+1) (기본 3)
  dealer: PlayerId; // 선 (기본 0)
  // --- 특수 룰 스위치. ppeok/ttadak/jjok/sweep/shake/bomb만 엔진이 읽는다(끄면 1단계 단순 처리). 나머지는 아직 자리만 ---
  special: {
    ppeok: boolean; ttadak: boolean; jjok: boolean; sweep: boolean;
    shake: boolean; bomb: boolean; chongtong: boolean; bak: boolean; gukjin: 'yeolggeut';
  };
  // --- 4단계(매직). enabled=false면 훅이 호출되지 않는다 ---
  magic: { enabled: boolean };
}

export const DEFAULT_OPTIONS: RuleOptions = {
  winScore: 7,
  goBonusMode: 'n',
  goMultiplierFrom: 3,
  dealer: 0,
  special: {
    ppeok: true, ttadak: true, jjok: true, sweep: true,
    shake: true, bomb: true, chongtong: false, bak: false, gukjin: 'yeolggeut',
  },
  magic: { enabled: false },
};

export type Phase = 'play' | 'chooseMatch' | 'goStop' | 'ended';

export interface PendingChoice {
  source: 'hand' | 'flip';
  card: Card; // 지금 처리 중인 카드(손/뒤집은 패). 바닥·손에 없는 상태로 여기 보관된다.
  options: string[]; // 고를 수 있는 바닥 카드 id (같은 월 2장)
  /** source==='hand'일 때, 이미 뒤집었지만 아직 정산하지 않은 더미 패(없으면 null). 이 카드도 바닥·손에 없다. */
  later: Card | null;
}

export type GameEvent =
  | { type: 'deal'; seed: string }
  | { type: 'play'; player: PlayerId; card: string }
  | { type: 'shake'; player: PlayerId; month: number; cards: string[] }
  | { type: 'bomb'; player: PlayerId; month: number; cards: string[] }
  | { type: 'steal'; player: PlayerId; from: PlayerId; card: string }
  | { type: 'dummy'; player: PlayerId }
  | { type: 'flip'; player: PlayerId; card: string }
  | { type: 'place'; player: PlayerId; card: string }
  | { type: 'capture'; player: PlayerId; cards: string[] }
  | { type: 'choose'; player: PlayerId; card: string }
  | { type: 'go'; player: PlayerId; goCount: number; score: number }
  | { type: 'stop'; player: PlayerId; score: number }
  | { type: 'ppeok'; player: PlayerId; month: number; cards: string[] } // 바닥에 남은 3장
  | { type: 'ppeokEat'; player: PlayerId; month: number; self: boolean }
  | { type: 'jjok'; player: PlayerId; month: number }
  | { type: 'ttadak'; player: PlayerId; month: number }
  | { type: 'sweep'; player: PlayerId }
  | { type: 'end'; result: GameResult };

export type GameResult =
  | { type: 'win'; winner: PlayerId; base: number; goCount: number; goBonus: number; multiplier: number; shakeMultiplier: number; finalScore: number; by: 'stop' | 'exhaust' }
  | { type: 'nagari' };

export interface GameState {
  seed: string;
  options: RuleOptions;
  phase: Phase;
  turn: PlayerId;
  hands: [Card[], Card[]];
  floor: Card[];
  deck: Card[];
  /** 현재 바닥에 남은 뻑 월 -> 싼 사람. 그 월을 먹으면 지워진다. */
  ppeok: Record<number, PlayerId>;
  /** 이번 차례 정산에서 아직 가져오지 못한 상대 피 장수(차례가 끝날 때 한꺼번에 가져온다). 차례 사이엔 항상 0 */
  stealDue: number;
  captured: [Card[], Card[]];
  pending: PendingChoice | null;
  goCount: [number, number];
  lastGoScore: [number, number];
  shakes: [number, number]; // 흔들기+폭탄 횟수 (배수 2^n)
  dummies: [number, number]; // 손패에 든 빈 패 장수 (더미 뒤집기 전용)
  events: GameEvent[]; // 추가만 되는 로그 (3·4단계 훅/연출용)
  result: GameResult | null;
}

export type Action =
  | { type: 'play'; cardId: string; shake?: true }
  | { type: 'bomb'; month: number }
  | { type: 'dummy' }
  | { type: 'choose'; cardId: string }
  | { type: 'go' }
  | { type: 'stop' };

export interface ScoreDetail { key: string; label: string; points: number }
export interface ScoreResult { total: number; details: ScoreDetail[] }
