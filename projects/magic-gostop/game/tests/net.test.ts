import { describe, expect, it } from 'vitest';
import { applyAction, createGame, getLegalActions, scoreOf } from '../src/engine';
import { mirror, viewFor } from '../src/net/view';
import type { GameState } from '../src/engine/types';

/** 무작위로 끝까지 둔 판 하나 */
function playOut(seed: string): GameState[] {
  let s = createGame(seed);
  const all = [s];
  let n = 0;
  while (s.phase !== 'ended' && n++ < 400) {
    const acts = getLegalActions(s);
    s = applyAction(s, acts[(n * 7) % acts.length]);
    all.push(s);
  }
  return all;
}

describe('온라인 대전: 자리 바꾸기·가리기', () => {
  it('두 번 뒤집으면 원래 판과 같다', () => {
    for (const s of playOut('net-1')) expect(mirror(mirror(s))).toEqual(s);
  });
  it('뒤집은 판에서 0번 점수 = 원래 판의 1번 점수', () => {
    for (const s of playOut('net-2').filter((_, i) => i % 5 === 0)) {
      expect(scoreOf(mirror(s), 0).total).toBe(scoreOf(s, 1).total);
      expect(scoreOf(mirror(s), 1).total).toBe(scoreOf(s, 0).total);
    }
  });
  it('뒤집은 판에서 둘 수 있는 수는 원래 판과 같다', () => {
    for (const s of playOut('net-3')) expect(getLegalActions(mirror(s))).toEqual(getLegalActions(s));
  });
  it('받는 사람에게 상대 손패·더미는 장수만 보인다', () => {
    const s = playOut('net-4')[6];
    for (const viewer of [0, 1] as const) {
      const v = viewFor(s, viewer);
      expect(v.hands[0].map((c) => c.id)).toEqual(s.hands[viewer].map((c) => c.id));
      expect(v.hands[1].length).toBe(s.hands[1 - viewer].length);
      expect(v.hands[1].every((c) => c.id.startsWith('?'))).toBe(true);
      expect(v.deck.length).toBe(s.deck.length);
      expect(v.deck.every((c) => c.id.startsWith('?'))).toBe(true);
    }
  });
  it('끝난 판의 승자도 뒤집힌다', () => {
    const all = playOut('net-5'); const end = all[all.length - 1];
    if (end.result?.type === 'win') expect((mirror(end).result as { winner: number }).winner).toBe(1 - end.result.winner);
  });
});
