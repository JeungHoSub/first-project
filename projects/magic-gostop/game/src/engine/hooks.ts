import type { GameState } from './types';

/**
 * 3단계(특수 룰)·4단계(매직)가 붙을 자리. 기본값은 전부 "아무것도 안 함".
 * options.magic.enabled=false 이면 엔진이 이 훅들을 호출하지 않는다.
 * 훅은 새 state를 돌려주거나 undefined(변경 없음)를 돌려준다.
 */
export interface EngineHooks {
  afterDeal?(s: GameState): GameState | void;
  onTurnStart?(s: GameState): GameState | void;
  afterPlay?(s: GameState): GameState | void; // 정산(손패+뒤집은 패)이 끝난 직후. 두 훅은 연달아 호출된다
  afterFlip?(s: GameState): GameState | void; // afterPlay 바로 뒤
  beforeScore?(s: GameState): GameState | void; // 점수 판정 직전
}

export const noopHooks: EngineHooks = {};
