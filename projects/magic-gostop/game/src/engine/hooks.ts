import type { GameState } from './types';

/**
 * 3단계(특수 룰)·4단계(매직)가 붙을 자리. 기본값은 전부 "아무것도 안 함".
 * options.magic.enabled=false 이면 엔진이 이 훅들을 호출하지 않는다.
 * 훅은 새 state를 돌려주거나 undefined(변경 없음)를 돌려준다.
 */
export interface EngineHooks {
  afterDeal?(s: GameState): GameState | void;
  onTurnStart?(s: GameState): GameState | void;
  afterPlay?(s: GameState): GameState | void; // 손패를 내고 정산한 직후
  afterFlip?(s: GameState): GameState | void; // 더미를 뒤집고 정산한 직후
  beforeScore?(s: GameState): GameState | void; // 점수 판정 직전
}

export const noopHooks: EngineHooks = {};
