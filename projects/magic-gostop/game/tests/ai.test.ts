import { describe, expect, it } from 'vitest';
import { applyAction, countCards, createGame, createRng, getLegalActions } from '../src/engine';
import type { Action, GameState } from '../src/engine';
import { AI_LEVELS, chooseAction, type AiLevel } from '../src/ai/simple';
import { determinize, observe } from '../src/ai/observe';

const same = (a: Action, b: Action) => JSON.stringify(a) === JSON.stringify(b);

/** 한 판을 끝까지 두며 모든 수가 합법인지 확인. 양쪽 난이도를 따로 줄 수 있다. */
function playGame(seed: string, levels: [AiLevel, AiLevel], rng: () => number, dealer: 0 | 1 = 0): GameState {
  let s = createGame(seed, { dealer });
  const total = countCards(s);
  let guard = 0;
  while (s.phase !== 'ended') {
    if (guard++ > 400) throw new Error('판이 끝나지 않음 ' + seed);
    const legal = getLegalActions(s);
    const a = chooseAction(s, levels[s.turn], { rng, samples: 6 });
    if (!legal.some((l) => same(l, a))) throw new Error(`불법 행동 ${JSON.stringify(a)} @${seed}`);
    s = applyAction(s, a);
    expect(countCards(s)).toBe(total);
  }
  return s;
}

describe('난이도 목록', () => {
  it('AI_LEVELS는 쉬움·보통·어려움', () => {
    expect(AI_LEVELS).toEqual([
      { id: 'easy', label: '쉬움' }, { id: 'normal', label: '보통' }, { id: 'hard', label: '어려움' },
    ]);
  });
  it('인자 1개 호출은 쉬움과 같다', () => {
    const s = createGame('lv1');
    expect(chooseAction(s)).toEqual(chooseAction(s, 'easy'));
  });
});

describe('항상 합법 행동 (보너스·흔들기·폭탄·빈 패·고르기·고/스톱 포함)', () => {
  it('쉬움 1000판', () => {
    const rng = createRng('t-easy');
    for (let i = 0; i < 1000; i++) playGame('e' + i, ['easy', 'easy'], rng);
  });
  it('보통 1000판 (쉬움과 섞어서)', () => {
    const rng = createRng('t-normal');
    for (let i = 0; i < 1000; i++) playGame('n' + i, i % 2 ? ['normal', 'easy'] : ['normal', 'normal'], rng, (i % 2) as 0 | 1);
  });
  it('어려움 100판 (보통과 섞어서)', () => {
    const rng = createRng('t-hard');
    for (let i = 0; i < 100; i++) playGame('h' + i, i % 2 ? ['hard', 'normal'] : ['normal', 'hard'], rng, (i % 2) as 0 | 1);
  }, 120000);
  it('특수 상황이 실제로 나오는 판에서도 합법 (흔들기·폭탄·고르기·고/스톱)', () => {
    const rng = createRng('t-special');
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const s = playGame('sp' + i, ['normal', 'hard'], rng);
      for (const e of s.events) seen.add(e.type);
    }
    for (const t of ['shake', 'bomb', 'choose', 'go', 'stop', 'bonus', 'dummy', 'ppeok']) expect(seen.has(t), t).toBe(true);
  }, 120000);
});

describe('observe: 보이는 정보만', () => {
  /** 이 판 진행 중 모든 시점에서 뷰를 검사 */
  function check(seed: string) {
    const rng = createRng('obs' + seed);
    let s = createGame(seed);
    while (s.phase !== 'ended') {
      for (const me of [0, 1] as const) {
        const v = observe(s, me);
        const opp = 1 - me;
        const oppHandIds = new Set(s.hands[opp].map((c) => c.id));
        const deckIds = s.deck.map((c) => c.id);
        // 1) 뷰의 어느 필드에도 상대 손패/더미 카드가 "위치 정보와 함께" 들어 있지 않다: 장수만
        expect(v.oppHandCount).toBe(s.hands[opp].length);
        expect(v.deckCount).toBe(s.deck.length);
        expect(v.hand.map((c) => c.id)).toEqual(s.hands[me].map((c) => c.id));
        for (const key of ['hand', 'floor']) {
          for (const c of (v as any)[key] as { id: string }[]) expect(oppHandIds.has(c.id) || deckIds.includes(c.id), key).toBe(false);
        }
        for (const c of [...v.captured.me, ...v.captured.opp]) expect(oppHandIds.has(c.id) || deckIds.includes(c.id)).toBe(false);
        // 2) 미지 카드 집합 = 상대 손패 + 더미 (순서·소속은 모름). 장수 합이 맞고 내가 아는 카드는 없다
        expect(v.unseen.length).toBe(s.hands[opp].length + s.deck.length);
        // 3) 직렬화한 뷰에 상대 손패·더미 순서가 새지 않는다: 상대 손패 카드는 unseen 안에만(순서 무관) 있다
        const known = new Set([...v.hand, ...v.floor, ...v.captured.me, ...v.captured.opp].map((c) => c.id));
        for (const c of v.unseen) expect(known.has(c.id)).toBe(false);
        // 4) 이벤트: 시드가 가려져 있고 상대 draw 카드가 가려져 있다
        for (const e of v.events) {
          if (e.type === 'deal') expect(e.seed).toBe('');
          if (e.type === 'draw' && e.player !== me) expect(e.card).toBe('');
        }
        // 5) 뷰 객체에 state 자체(hands/deck)가 없다
        expect(Object.keys(v)).not.toContain('hands');
        expect(Object.keys(v)).not.toContain('deck');
        expect(JSON.stringify(v)).not.toContain(s.seed + '#');
        // 6) 표본은 뷰와 모순 없고 진짜 상대 패와는 (거의 항상) 다르게 섞인다
        const smp = determinize(v, rng);
        expect(smp.hands[opp]).toHaveLength(s.hands[opp].length);
        expect(smp.deck).toHaveLength(s.deck.length);
        expect(countCards(smp)).toBe(countCards(s));
      }
      s = applyAction(s, chooseAction(s, 'normal'));
    }
  }
  it('여러 판의 모든 시점', () => {
    for (let i = 0; i < 20; i++) check('obs' + i);
  });
  it('시드가 이벤트에 있어도 뷰에는 없다', () => {
    const s = createGame('secret-seed-xyz');
    const v = observe(s, 0);
    expect(JSON.stringify(v)).not.toContain('secret-seed-xyz');
  });
  it('표본은 상대 손패·더미 순서를 모른 채 무작위다 (같은 뷰, 다른 난수 = 다른 상대 손패)', () => {
    const s = createGame('smp');
    const v = observe(s, 0);
    const a = determinize(v, createRng('a')).hands[1].map((c) => c.id).join();
    const b = determinize(v, createRng('b')).hands[1].map((c) => c.id).join();
    expect(a).not.toBe(b);
  });
  it('어려움은 상대 손패·더미를 바꿔도 같은 선택을 한다 (숨은 정보에 의존하지 않음)', () => {
    for (let i = 0; i < 20; i++) {
      const s = createGame('leak' + i);
      // 미지 카드를 상대 손패와 더미 사이에서 다시 섞은 "다른 진실"
      const t: GameState = structuredClone(s);
      const pool = [...t.hands[1], ...t.deck].reverse();
      t.hands[1] = pool.slice(0, t.hands[1].length);
      t.deck = pool.slice(t.hands[1].length);
      const a = chooseAction(s, 'hard', { rng: createRng('same'), samples: 8 });
      const b = chooseAction(t, 'hard', { rng: createRng('same'), samples: 8 });
      expect(b).toEqual(a);
      expect(chooseAction(t, 'normal')).toEqual(chooseAction(s, 'normal'));
    }
  });
});
