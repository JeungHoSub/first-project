// 온라인 대전: 서버가 가진 진짜 판(GameState)을 각 사람에게 보낼 때 쓰는 변환.
// 1) mirror: 0번/1번 자리를 맞바꾼다 → 누구에게 보내든 "나 = 0번"으로 보이게 (화면 코드는 ME=0 그대로)
// 2) maskFor0: 0번(받는 사람) 입장에서 볼 수 없는 정보(상대 손패, 더미, 상대가 몰래 가져온 패)를 가린다
import type { Card, GameEvent, GameResult, GameState, PlayerId } from '../engine/types';

const sw = <T>(p: [T, T]): [T, T] => [p[1], p[0]];
const sp = (p: PlayerId): PlayerId => (p === 0 ? 1 : 0);

function mirrorResult(r: GameResult | null): GameResult | null {
  if (!r) return r;
  return r.type === 'win' ? { ...r, winner: sp(r.winner) } : { ...r };
}
function mirrorEvent(e: GameEvent): GameEvent {
  const x = { ...e } as GameEvent & { player?: PlayerId; from?: unknown };
  if ('player' in e) (x as { player: PlayerId }).player = sp((e as { player: PlayerId }).player);
  if (e.type === 'steal') (x as { from: PlayerId }).from = sp(e.from);
  if (e.type === 'end') (x as { result: GameResult }).result = mirrorResult(e.result)!;
  return x;
}

/** 0번과 1번 자리를 맞바꾼 판 (원본은 그대로) */
export function mirror(s: GameState): GameState {
  const t: GameState = structuredClone(s);
  t.turn = sp(s.turn);
  t.hands = sw(t.hands); t.captured = sw(t.captured);
  t.goCount = sw(t.goCount); t.lastGoScore = sw(t.lastGoScore); t.shakes = sw(t.shakes); t.dummies = sw(t.dummies);
  if (t.gukjinAs) t.gukjinAs = sw(t.gukjinAs);
  if (t.extra) t.extra = sw(t.extra);
  if (t.itemPts) t.itemPts = sw(t.itemPts);
  if (t.magic) t.magic = { shield: sw(t.magic.shield), noPibak: sw(t.magic.noPibak), noGwangbak: sw(t.magic.noGwangbak), double: sw(t.magic.double) };
  t.ppeok = Object.fromEntries(Object.entries(t.ppeok).map(([m, p]) => [m, sp(p)])) as Record<number, PlayerId>;
  if (t.endInfo && t.endInfo.stopper !== null) t.endInfo = { ...t.endInfo, stopper: sp(t.endInfo.stopper) };
  t.options = { ...t.options, dealer: sp(t.options.dealer), ...(t.options.pibakMax ? { pibakMax: sw(t.options.pibakMax) } : {}) };
  t.events = t.events.map(mirrorEvent);
  t.result = mirrorResult(t.result);
  return t;
}

/** 가린 패: 장수만 알 수 있게 빈 패로 바꾼다 (id는 매번 같은 규칙으로) */
const hidden = (n: number, tag: string): Card[] =>
  Array.from({ length: n }, (_, i) => ({ id: `?${tag}${i}`, month: 0, kind: 'P', hidden: true }) as unknown as Card);

/** 0번(받는 사람)이 볼 수 있는 것만 남긴 판 */
export function maskFor0(s: GameState): GameState {
  const t: GameState = structuredClone(s);
  t.hands = [t.hands[0], hidden(t.hands[1].length, 'h')];
  t.deck = hidden(t.deck.length, 'd');
  // 상대가 보너스를 내고 더미에서 손패로 가져온 패는 상대만 안다
  t.events = t.events.map((e) => (e.type === 'draw' && e.player === 1 ? { ...e, card: '?draw' } : e));
  return t;
}

/** viewer(0|1) 에게 보낼 판: viewer가 0번으로 보이게 뒤집고 볼 수 없는 정보는 가린다 */
export function viewFor(s: GameState, viewer: PlayerId): GameState {
  return maskFor0(viewer === 0 ? s : mirror(s));
}
