import { getLegalActions, score } from '../engine';
import type { Action, Card, GameState } from '../engine';

/** 카드 가치 (AI 판단용 대략값). */
export function cardValue(c: Card): number {
  if (c.kind === 'G') return 6;
  if (c.tag === 'godori' || c.tag === 'hong' || c.tag === 'cheong' || c.tag === 'cho') return 4;
  if (c.kind === 'Y' || c.kind === 'T') return 3;
  if (c.kind === 'D') return 2.5;
  return 1;
}

/**
 * 쉬운 AI (임시). 뒤집을 패는 보지 않는다(반칙 없음).
 * - 내기: 먹을 수 있는 패 중 얻는 가치가 큰 것, 없으면 가치가 가장 낮은 패를 버린다.
 * - 고르기: 가치가 큰 바닥 패.
 * - 고/스톱: 남은 손패가 3장 이상이고 점수가 10점 미만이면 고.
 */
export function chooseAction(s: GameState): Action {
  const legal = getLegalActions(s);
  if (s.phase === 'goStop') {
    const total = score(s.captured[s.turn], s.options).total;
    const go = legal.find((a) => a.type === 'go');
    return go && s.hands[s.turn].length >= 3 && total < 10 ? go : { type: 'stop' };
  }
  if (s.phase === 'chooseMatch') {
    const opts = s.floor.filter((c) => s.pending!.options.includes(c.id));
    opts.sort((a, b) => cardValue(b) - cardValue(a));
    return { type: 'choose', cardId: opts[0].id };
  }
  // 폭탄이 되면 무조건 폭탄
  const bomb = legal.find((a) => a.type === 'bomb');
  if (bomb) return bomb;
  // 빈 패: 먹을 수 있는 손패가 없으면 빈 패로 차례를 넘긴다
  const dummy = legal.find((a) => a.type === 'dummy');
  const canCapture = s.hands[s.turn].some((c) => s.floor.some((f) => f.month === c.month));
  if (dummy && (!canCapture || s.hands[s.turn].length === 0)) return dummy;
  let best: { a: Action; v: number } | null = null;
  for (const c of s.hands[s.turn]) {
    const m = s.floor.filter((f) => f.month === c.month);
    const gain = m.length === 0 ? -cardValue(c) : cardValue(c) + Math.max(...m.map(cardValue)) + (m.length === 3 ? 4 : 0);
    if (!best || gain > best.v) best = { a: { type: 'play', cardId: c.id }, v: gain };
  }
  // 흔들기가 되는 패를 내면 흔들기 선언
  const a = best!.a;
  const shake = a.type === 'play' && legal.find((l) => l.type === 'play' && l.cardId === a.cardId && l.shake);
  return shake || a;
}
