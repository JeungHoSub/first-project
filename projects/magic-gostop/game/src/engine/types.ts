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
  // --- 3단계 이후에 켤 자리 (1단계에서는 전부 꺼져 있고 엔진이 읽지 않음) ---
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
    ppeok: false, ttadak: false, jjok: false, sweep: false,
    shake: true, bomb: true, chongtong: false, bak: false, gukjin: 'yeolggeut',
  },
  magic: { enabled: false },
};

export type Phase = 'play' | 'chooseMatch' | 'goStop' | 'ended';

export interface PendingChoice {
  source: 'hand' | 'flip';
  card: Card; // 지금 처리 중인 카드(손/뒤집은 패). 바닥·손에 없는 상태로 여기 보관된다.
  options: string[]; // 고를 수 있는 바닥 카드 id (같은 월 2장)
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
