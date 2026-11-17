// 어려움 AI: 숨은 정보를 무작위로 채운 표본으로 끝까지 플레이아웃해 (내 점수 - 상대 점수) 기대값이 큰 행동을 고른다.
// 표본은 observe()가 준 뷰에서만 만든다(상대 손패·더미 = 미지 카드를 무작위 배정). 진짜 상대 손패·더미 순서는 보지 않는다.
import { applyAction, getLegalActions } from '../engine';
import type { Action, GameState, PlayerId } from '../engine';
import { determinize, observe } from './observe';
import { chooseNormalFromView, rankActions, staticEval } from './normal';

export interface HardOptions {
  /** 표본(숨은 정보 배정) 개수. 기본 24 */
  samples?: number;
  /** 플레이아웃할 후보 행동 수. 기본 4 (보통 AI 점수 상위) */
  candidates?: number;
  /** 표본 생성용 난수 (테스트용 주입). 기본 Math.random */
  rng?: () => number;
}
export const HARD_DEFAULTS = { samples: 24, candidates: 4 };
/** 튜닝값: 플레이아웃 가치 = 승패 부호 x (win + min(최종점수, cap)). win이 크면 승률 중심, 작으면 점수차 중심 */
export const HARD_TUNE = { win: 6, cap: 14, z: 1.0, turns: 2, mcGo: 0 };

/**
 * 행동 first를 두고 보통 정책으로 이어서 둔다. me 기준 가치를 돌려준다.
 * - 고/스톱 결정: 끝까지 둔 최종 점수차(승패 부호 x (win + 점수))
 * - 그 밖: 차례가 HARD_TUNE.turns번 바뀔 때까지만 두고 족보 진행도 차이로 평가(분산이 작고 빠르다)
 */
function playout(s: GameState, me: PlayerId, first: Action, toEnd: boolean): number {
  let cur = applyAction(s, first);
  let turnsLeft = HARD_TUNE.turns;
  let lastTurn = cur.turn;
  let guard = 0;
  while (cur.phase !== 'ended' && guard++ < 200) {
    if (!toEnd) {
      if (cur.turn !== lastTurn) { turnsLeft--; lastTurn = cur.turn; }
      if (turnsLeft <= 0 || cur.phase === 'goStop') break;
    }
    cur.events = []; // 로그는 필요 없다 (복사 비용 절감)
    const v = observe(cur, cur.turn, false);
    cur = applyAction(cur, chooseNormalFromView(v, getLegalActions(cur)));
  }
  const r = cur.result;
  if (cur.phase === 'ended') {
    if (!r || r.type === 'nagari') return 0;
    const v = HARD_TUNE.win + Math.min(r.finalScore, HARD_TUNE.cap);
    return r.winner === me ? v : -v;
  }
  const mine = cur.captured[me], theirs = cur.captured[1 - me];
  return staticEval(mine, theirs) + (cur.phase === 'goStop' ? (cur.turn === me ? 3 : -3) : 0);
}

export function chooseHard(state: GameState, opts: HardOptions = {}): Action {
  const legal = getLegalActions(state);
  if (legal.length === 1) return legal[0];
  const rng = opts.rng ?? Math.random;
  const n = opts.samples ?? HARD_DEFAULTS.samples;
  const k = opts.candidates ?? HARD_DEFAULTS.candidates;
  const v = observe(state, state.turn);
  // 보너스 패는 항상 먼저 내는 게 이득이라 시뮬레이션 없이 결정한다
  const ranked = rankActions(v, legal);
  if (!ranked.length) return legal[0]; // 보는 상태와 실제 상태가 어긋난 드문 경우: 규칙상 가능한 첫 수
  if (ranked[0].v >= 50) return ranked[0].a;
  if (state.phase === 'goStop' && !HARD_TUNE.mcGo) return ranked[0].a;
  const cands = ranked.slice(0, k).map((r) => r.a);
  if (cands.length === 1) return cands[0];
  const vals: number[][] = cands.map(() => []);
  for (let i = 0; i < n; i++) {
    const sample = determinize(v, rng); // 같은 표본을 모든 후보에 쓴다 (짝지은 비교로 오차 감소)
    for (let j = 0; j < cands.length; j++) vals[j].push(playout(sample, v.me, cands[j], state.phase === 'goStop'));
  }
  // 보통 AI가 1순위로 본 후보(0번)를 기본으로 두고, 표본 평균이 "유의하게" 더 좋은 후보가 있을 때만 바꾼다
  // (표본이 적어 생기는 우연한 차이에 휘둘리지 않게 짝지은 차이의 표준오차 z배를 넘어야 함)
  let best = 0;
  let bestGain = 0;
  for (let j = 1; j < cands.length; j++) {
    const d = vals[j].map((x, i) => x - vals[0][i]);
    const mean = d.reduce((p, q) => p + q, 0) / n;
    const variance = d.reduce((p, q) => p + (q - mean) ** 2, 0) / Math.max(1, n - 1);
    const gain = mean - HARD_TUNE.z * Math.sqrt(variance / n);
    if (gain > bestGain) { bestGain = gain; best = j; }
  }
  return cands[best];
}
