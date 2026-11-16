import { describe, expect, it } from 'vitest';
import {
  ALL_CARDS, applyAction, buildBonusCards, countCards, createGame, createRng, getLegalActions, score, settle, shuffle,
  type Action, type Card, type GameState,
} from '../src/engine';
import { checkChongtong } from '../src/engine/game';

const byId = (id: string): Card => {
  const c = ALL_CARDS.find((x) => x.id === id) ?? (id.startsWith('13') ? { id, month: 13, kind: id.includes('B3') ? 'B3' : 'B2' } as Card : undefined);
  if (!c) throw new Error('없는 카드 ' + id);
  return { ...c };
};
const cards = (...ids: string[]) => ids.map(byId);
const pts = (...ids: string[]) => score(cards(...ids));

/** 지정한 손패/바닥/더미로 상태를 만든다 (나머지 카드는 상대 손패/더미로 채움). */
function setup(o: { hand: string[]; floor: string[]; deck: string[]; captured?: string[]; hand1?: string[]; captured1?: string[]; emptyDeck?: boolean }): GameState {
  const s = createGame('fixed', { bonus: { two: 0, three: 0 } });
  const used = new Set([...o.hand, ...o.floor, ...o.deck, ...(o.captured ?? []), ...(o.hand1 ?? []), ...(o.captured1 ?? [])]);
  const rest = ALL_CARDS.filter((c) => !used.has(c.id)).map((c) => ({ ...c }));
  s.hands = [cards(...o.hand), o.hand1 ? cards(...o.hand1) : rest.splice(0, 10)];
  s.floor = cards(...o.floor);
  if (o.emptyDeck) s.hands[1].push(...rest); // 더미를 비우되 카드는 상대 손패에 보관
  s.deck = o.emptyDeck ? cards(...o.deck) : [...cards(...o.deck), ...rest];
  s.captured = [cards(...(o.captured ?? [])), cards(...(o.captured1 ?? []))];
  return s;
}
const play = (s: GameState, id: string) => applyAction(s, { type: 'play', cardId: id });
const evTypes = (s: GameState) => s.events.map((e) => e.type).filter((t) => t !== 'deal');
const ids = (cs: Card[]) => cs.map((c) => c.id).sort();
const fmonth = (s: GameState, m: number) => ids(s.floor.filter((c) => c.month === m));

describe('카드 데이터', () => {
  it('48장, id 유일, 월 12개 x 4장', () => {
    expect(ALL_CARDS).toHaveLength(48);
    expect(new Set(ALL_CARDS.map((c) => c.id)).size).toBe(48);
    for (let m = 1; m <= 12; m++) expect(ALL_CARDS.filter((c) => c.month === m)).toHaveLength(4);
  });
  it('종류 집계: 광5 열끗9 띠10 피22+쌍피2', () => {
    const n = (k: string) => ALL_CARDS.filter((c) => c.kind === k).length;
    expect([n('G'), n('Y'), n('T'), n('P'), n('D')]).toEqual([5, 9, 10, 22, 2]);
  });
  it('태그: 비광, 고도리 3, 국진, 홍/청/초단 각 3', () => {
    const t = (tag: string) => ALL_CARDS.filter((c) => c.tag === tag).map((c) => c.month);
    expect(t('bi')).toEqual([12]);
    expect(t('godori')).toEqual([2, 4, 8]);
    expect(t('gukjin')).toEqual([9]);
    expect(t('hong')).toEqual([1, 2, 3]);
    expect(t('cheong')).toEqual([6, 9, 10]);
    expect(t('cho')).toEqual([4, 5, 7]);
  });
});

describe('셔플/분배', () => {
  it('같은 시드 = 같은 결과, 다른 시드 = 다른 결과', () => {
    expect(createGame(123)).toEqual(createGame(123));
    expect(createGame(123).hands).not.toEqual(createGame(124).hands);
  });
  it('shuffle은 원본을 바꾸지 않고 48장을 보존', () => {
    const before = ALL_CARDS.map((c) => c.id);
    const r = shuffle(ALL_CARDS, 1);
    expect(ALL_CARDS.map((c) => c.id)).toEqual(before);
    expect(new Set(r.map((c) => c.id)).size).toBe(48);
  });
  it('손패 10 / 바닥 8 / 더미 20, 선은 0 (보너스 끄면 48장)', () => {
    const s = createGame(1, { bonus: { two: 0, three: 0 } });
    expect([s.hands[0].length, s.hands[1].length, s.floor.length, s.deck.length]).toEqual([10, 10, 8, 20]);
    expect(s.turn).toBe(0);
    expect(countCards(s)).toBe(48);
  });
  it('rng는 시드 재현', () => {
    const a = createRng('x'), b = createRng('x');
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe('매칭 0/1/2/3장', () => {
  it('0장: 바닥에 내려놓는다', () => {
    const s = play(setup({ hand: ['03-P-0'], floor: ['01-P-0'], deck: ['05-P-0'] }), '03-P-0');
    expect(s.floor.map((c) => c.id)).toContain('03-P-0');
    expect(s.captured[0]).toHaveLength(0);
  });
  it('1장: 2장을 먹는다 (손패 + 더미 각각)', () => {
    const s = play(setup({ hand: ['03-P-0'], floor: ['03-T-0', '05-P-0'], deck: ['05-P-1'] }), '03-P-0');
    expect(s.captured[0].map((c) => c.id).sort()).toEqual(['03-P-0', '03-T-0', '05-P-0', '05-P-1']);
    expect(s.floor).toHaveLength(0);
    expect(s.phase).toBe('play');
    expect(s.turn).toBe(1);
  });
  it('2장: 선택 요청 상태로 멈추고, 고른 카드만 먹는다', () => {
    const s0 = setup({ hand: ['03-P-0'], floor: ['03-T-0', '03-P-1'], deck: ['09-P-0'] });
    const deckBefore = s0.deck.length;
    let s = play(s0, '03-P-0');
    expect(s.phase).toBe('chooseMatch');
    expect(s.turn).toBe(0);
    expect(countCards(s)).toBe(48);
    const acts = getLegalActions(s);
    expect(acts).toEqual([{ type: 'choose', cardId: '03-T-0' }, { type: 'choose', cardId: '03-P-1' }]);
    // 뒤집기는 고르기 전에 이미 끝나 있고(더미 19장), 그 패는 정산 대기(pending.later)
    expect(s.deck).toHaveLength(deckBefore - 1);
    expect(s.pending?.later?.id).toBe('09-P-0');
    s = applyAction(s, { type: 'choose', cardId: '03-T-0' });
    expect(s.captured[0].map((c) => c.id).sort()).toEqual(['03-P-0', '03-T-0']);
    expect(s.floor.map((c) => c.id).sort()).toEqual(['03-P-1', '09-P-0']);
    // 선택 후 대기 중이던 뒤집은 패가 정산되어 턴이 넘어간다
    expect(s.deck).toHaveLength(deckBefore - 1);
    expect(s.turn).toBe(1);
  });
  it('2장: 뒤집은 패가 2장 매칭이면 그때 선택 요청', () => {
    let s = play(setup({ hand: ['01-P-0'], floor: ['07-P-0', '07-P-1'], deck: ['07-T-0'] }), '01-P-0');
    expect(s.phase).toBe('chooseMatch');
    expect(s.pending?.source).toBe('flip');
    s = applyAction(s, { type: 'choose', cardId: '07-P-1' });
    expect(s.turn).toBe(1);
    expect(s.captured[0].map((c) => c.id).sort()).toEqual(['07-P-1', '07-T-0']);
  });
  it('3장: 4장을 모두 먹는다', () => {
    const s = play(setup({ hand: ['03-P-0'], floor: ['03-T-0', '03-P-1', '03-G-0', '05-P-0'], deck: ['09-P-0'] }), '03-P-0');
    expect(s.captured[0]).toHaveLength(4);
    expect(s.floor.map((c) => c.id).sort()).toEqual(['05-P-0', '09-P-0']);
  });
  it('특수 룰을 끄면 손패와 더미가 같은 월이어도 1단계 단순 처리 (손패 -> 더미 순서)', () => {
    const off = (s: GameState) => { Object.assign(s.options.special, { ppeok: false, ttadak: false, jjok: false, sweep: false }); return s; };
    let s = play(off(setup({ hand: ['03-P-0'], floor: ['01-P-0'], deck: ['03-P-1'] })), '03-P-0');
    expect(s.captured[0].map((c) => c.id).sort()).toEqual(['03-P-0', '03-P-1']);
    expect(countCards(s)).toBe(48);
    s = play(off(setup({ hand: ['03-P-0'], floor: ['03-T-0'], deck: ['03-P-1'] })), '03-P-0');
    expect(s.floor.map((c) => c.id)).toContain('03-P-1');
    expect(s.ppeok).toEqual({});
    expect(countCards(s)).toBe(48);
    // 바닥 2장: 끄면 고르기 후 더미가 남은 1장과 짝
    let t = play(off(setup({ hand: ['03-P-0'], floor: ['03-T-0', '03-P-1'], deck: ['03-G-0'] })), '03-P-0');
    expect(t.phase).toBe('chooseMatch');
    t = applyAction(t, { type: 'choose', cardId: '03-T-0' });
    expect(t.captured[0]).toHaveLength(4);
    expect(t.floor).toHaveLength(0);
  });
  it('불법 행동은 예외, 원본 state는 불변', () => {
    const s = setup({ hand: ['03-P-0'], floor: [], deck: ['05-P-0'] });
    const snap = JSON.stringify(s);
    expect(() => applyAction(s, { type: 'play', cardId: '12-D-0' })).toThrow();
    expect(() => applyAction(s, { type: 'go' })).toThrow();
    play(s, '03-P-0');
    expect(JSON.stringify(s)).toBe(snap);
  });
  it('state는 JSON 직렬화 왕복이 가능', () => {
    const s = createGame(5);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});

describe('점수 항목', () => {
  it('광: 3광 3점 / 비광 포함 2점 / 4광 4점 / 5광 15점', () => {
    expect(pts('01-G-0', '03-G-0', '08-G-0').total).toBe(3);
    expect(pts('01-G-0', '03-G-0', '12-G-0').total).toBe(2);
    expect(pts('01-G-0', '03-G-0', '08-G-0', '11-G-0').total).toBe(4);
    expect(pts('01-G-0', '03-G-0', '08-G-0', '11-G-0', '12-G-0').total).toBe(15);
    expect(pts('01-G-0', '03-G-0').total).toBe(0);
  });
  it('열끗: 5장 1점, 이후 +1 / 고도리 5점', () => {
    expect(pts('02-Y-0', '04-Y-0', '05-Y-0', '06-Y-0').total).toBe(0);
    expect(pts('02-Y-0', '05-Y-0', '06-Y-0', '07-Y-0', '10-Y-0').total).toBe(1);
    expect(pts('02-Y-0', '05-Y-0', '06-Y-0', '07-Y-0', '10-Y-0', '12-Y-0').total).toBe(2);
    expect(pts('02-Y-0', '04-Y-0', '08-Y-0').details).toEqual([{ key: 'godori', label: '고도리', points: 5 }]);
    // 고도리 + 열끗 5장 = 5 + 1
    expect(pts('02-Y-0', '04-Y-0', '08-Y-0', '05-Y-0', '06-Y-0').total).toBe(6);
  });
  it('국진(9월 열끗)은 1단계에서 열끗으로 센다', () => {
    expect(pts('09-Y-0', '05-Y-0', '06-Y-0', '07-Y-0', '10-Y-0').total).toBe(1);
  });
  it('띠: 5장 1점 +1, 12월 띠는 단 없음', () => {
    expect(pts('01-T-0', '02-T-0', '04-T-0', '06-T-0', '12-T-0').total).toBe(1);
    expect(pts('01-T-0', '02-T-0', '04-T-0', '06-T-0', '12-T-0', '05-T-0').total).toBe(2);
  });
  it('홍단·청단·초단 각 3점, 12월 띠로는 불가', () => {
    expect(pts('01-T-0', '02-T-0', '03-T-0').total).toBe(3);
    expect(pts('06-T-0', '09-T-0', '10-T-0').total).toBe(3);
    expect(pts('04-T-0', '05-T-0', '07-T-0').total).toBe(3);
    expect(pts('01-T-0', '02-T-0', '12-T-0').total).toBe(0);
    // 홍단 + 청단 + 띠 6장 = 3+3+2
    expect(pts('01-T-0', '02-T-0', '03-T-0', '06-T-0', '09-T-0', '10-T-0').total).toBe(8);
  });
  it('피: 10장 1점 +1, 쌍피는 2장', () => {
    const p9 = ['01-P-0', '01-P-1', '02-P-0', '02-P-1', '03-P-0', '03-P-1', '04-P-0', '04-P-1', '05-P-0'];
    expect(pts(...p9).total).toBe(0);
    expect(pts(...p9, '05-P-1').total).toBe(1);
    expect(pts(...p9, '12-D-0').total).toBe(2); // 쌍피 = 2장 -> 피 11장 = 2점
  });
});

describe('고/스톱, 배수, 나가리', () => {
  it('7점 도달 시 goStop 상태, 스톱하면 정산', () => {
    // 광3(3점) + 고도리 2장 보유, 8월 열끗을 먹어 고도리(+5) = 8점
    const base = ['01-G-0', '03-G-0', '08-G-0', '02-Y-0', '04-Y-0'];
    let s = setup({ hand: ['08-Y-0'], floor: ['08-P-0'], deck: ['05-P-0'], captured: base, captured1: ['11-G-0'] });
    s = play(s, '08-Y-0');
    expect(s.phase).toBe('goStop'); // 3 + 5 = 8
    expect(getLegalActions(s).map((a) => a.type).sort()).toEqual(['go', 'stop']);
    s = applyAction(s, { type: 'stop' });
    expect(s.phase).toBe('ended');
    expect(s.result).toMatchObject({ type: 'win', winner: 0, base: 8, goCount: 0, finalScore: 8, by: 'stop' });
  });
  it('고를 외치면 goCount가 오르고 상대 턴으로 넘어간다', () => {
    const base = ['01-G-0', '03-G-0', '08-G-0', '02-Y-0', '04-Y-0'];
    let s = setup({ hand: ['08-Y-0'], floor: ['08-P-0'], deck: ['10-P-0'], captured: base, captured1: ['11-G-0'] });
    s = play(s, '08-Y-0'); // 8점
    s = applyAction(s, { type: 'go' });
    expect(s.goCount).toEqual([1, 0]);
    expect(s.lastGoScore[0]).toBe(8);
    expect(s.turn).toBe(1);
    expect(s.phase).toBe('play');
  });
  it('최종 정산에 고 횟수가 반영된다 (2고 스톱 = 기본 + 2)', () => {
    const base = ['01-G-0', '03-G-0', '08-G-0', '02-Y-0', '04-Y-0'];
    let s = setup({ hand: ['08-Y-0'], floor: ['08-P-0'], deck: ['05-P-0'], captured: base, captured1: ['11-G-0'] });
    s.goCount = [2, 0];
    s.lastGoScore = [7, 0];
    s = play(s, '08-Y-0');
    s = applyAction(s, { type: 'stop' });
    expect(s.result).toMatchObject({ type: 'win', base: 8, goCount: 2, goBonus: 2, multiplier: 1, finalScore: 10 });
  });
  it('직전 고 점수와 같으면 고/스톱이 다시 뜨지 않는다', () => {
    const base = ['01-G-0', '03-G-0', '08-G-0', '02-Y-0', '04-Y-0', '08-Y-0']; // 8점
    let s = setup({ hand: ['09-P-0'], floor: [], deck: ['10-P-0'], captured: base, captured1: ['11-G-0'] });
    s.lastGoScore = [8, 0];
    s.goCount = [1, 0];
    s = play(s, '09-P-0');
    expect(s.phase).toBe('play');
    expect(s.turn).toBe(1);
  });
  it('양쪽 패가 떨어지고 아무도 7점이 안 되면 나가리', () => {
    let s = setup({ hand: ['03-P-0'], floor: ['01-P-0'], deck: ['05-P-0', '06-P-0'] });
    s.deck = [...s.deck.slice(0, 2), ...s.hands[1], ...s.deck.slice(2)].filter((c) => c.id !== '09-P-0');
    s.hands[1] = cards('09-P-0');
    s = play(s, '03-P-0');
    expect(s.phase).toBe('play');
    s = play(s, '09-P-0');
    expect(s.phase).toBe('ended');
    expect(s.result).toEqual({ type: 'nagari', nextCarry: 2 });
    expect(countCards(s)).toBe(48);
  });
  it('패가 떨어졌을 때 7점 이상이 한 명이면 그 사람이 승자 (고 가산 반영)', () => {
    const base = ['01-G-0', '03-G-0', '08-G-0', '02-Y-0', '04-Y-0'];
    let s = setup({ hand: ['08-Y-0'], floor: ['08-P-0'], deck: ['05-P-0', '06-P-0'], captured: base, captured1: ['11-G-0'] });
    s.hands[1] = cards('09-P-0');
    s.goCount = [1, 0];
    s.lastGoScore = [7, 0];
    s = play(s, '08-Y-0'); // 8점, 고/스톱 뜸 (7 < 8)
    s = applyAction(s, { type: 'go' });
    s = play(s, '09-P-0');
    expect(s.result).toMatchObject({ type: 'win', winner: 0, goCount: 2, by: 'exhaust', finalScore: 10 });
  });
  it('마지막 턴에서는 고 없이 스톱만 가능', () => {
    const base = ['01-G-0', '03-G-0', '08-G-0', '02-Y-0', '04-Y-0'];
    let s = setup({ hand: ['08-Y-0'], floor: ['08-P-0'], deck: ['05-P-0'], captured: base, captured1: ['11-G-0'] });
    s.hands[1] = [];
    s = play(s, '08-Y-0');
    expect(getLegalActions(s)).toEqual([{ type: 'stop' }]);
  });
});

describe('흔들기', () => {
  const H3 = ['03-P-0', '03-P-1', '03-T-0'];
  it('손패 3장 + 바닥 0장이면 shake 변형이 추가로 나온다 (일반 play도 유지)', () => {
    const s = setup({ hand: [...H3, '05-P-0'], floor: ['01-P-0'], deck: ['09-P-0'] });
    const acts = getLegalActions(s);
    for (const id of H3) {
      expect(acts).toContainEqual({ type: 'play', cardId: id });
      expect(acts).toContainEqual({ type: 'play', cardId: id, shake: true });
    }
    expect(acts).not.toContainEqual({ type: 'play', cardId: '05-P-0', shake: true });
    expect(acts.some((a) => a.type === 'bomb')).toBe(false);
  });
  it('선언하면 shakes+1, shake 이벤트(3장 공개), 이긴 경우 배수 x2', () => {
    const base = ['01-G-0', '03-G-0', '08-G-0', '02-Y-0', '04-Y-0']; // 5장, 8월 열끗을 먹으면 8점
    let s = setup({ hand: ['08-Y-0', '05-P-0', '05-P-1', '05-T-0'], floor: ['08-P-0'], deck: ['10-P-0'], captured: base, captured1: ['11-G-0'] });
    s = applyAction(s, { type: 'play', cardId: '05-P-0', shake: true });
    expect(s.shakes).toEqual([1, 0]);
    const ev = s.events.find((e) => e.type === 'shake');
    expect(ev).toMatchObject({ type: 'shake', player: 0, month: 5 });
    expect((ev as { cards: string[] }).cards.sort()).toEqual(['05-P-0', '05-P-1', '05-T-0']);
    expect(s.hands[0]).toHaveLength(3);
    expect(countCards(s)).toBe(48);
  });
  it('흔들기 배수는 판 끝 정산에서 이긴 경우만 곱해진다 (누적)', () => {
    const base = ['01-G-0', '03-G-0', '08-G-0', '02-Y-0', '04-Y-0'];
    let s = setup({ hand: ['08-Y-0'], floor: ['08-P-0'], deck: ['05-P-0'], captured: base, captured1: ['11-G-0'] });
    s.shakes = [2, 0];
    s = play(s, '08-Y-0');
    s = applyAction(s, { type: 'stop' });
    expect(s.result).toMatchObject({ type: 'win', winner: 0, base: 8, shakeMultiplier: 4, finalScore: 32 });
    // 상대가 흔들었어도 내가 이기면 내 배수만 적용
    let t = setup({ hand: ['08-Y-0'], floor: ['08-P-0'], deck: ['05-P-0'], captured: base, captured1: ['11-G-0'] });
    t.shakes = [0, 3];
    t = applyAction(play(t, '08-Y-0'), { type: 'stop' });
    expect(t.result).toMatchObject({ shakeMultiplier: 1, finalScore: 8 });
  });
  it('선언 없이 그냥 내면 배수 없음 / 바닥에 그 월이 있으면 흔들기 불가 / 옵션 끄면 불가', () => {
    let s = setup({ hand: H3, floor: ['01-P-0'], deck: ['09-P-0'] });
    s = play(s, '03-P-0');
    expect(s.shakes).toEqual([0, 0]);
    const s2 = setup({ hand: H3, floor: ['03-G-0'], deck: ['09-P-0'] });
    expect(getLegalActions(s2).some((a) => a.type === 'play' && a.shake)).toBe(false);
    const s3 = setup({ hand: H3, floor: ['01-P-0'], deck: ['09-P-0'] });
    s3.options.special.shake = false;
    expect(getLegalActions(s3).some((a) => a.type === 'play' && a.shake)).toBe(false);
    expect(() => applyAction(s2, { type: 'play', cardId: '03-P-0', shake: true })).toThrow();
  });
  it('한 판에 여러 번 흔들면 x2가 누적', () => {
    let s = setup({ hand: ['03-P-0', '03-P-1', '03-T-0', '05-P-0', '05-P-1', '05-T-0'], floor: ['01-P-0'], deck: ['09-P-0', '10-P-0', '11-P-0', '12-T-0'] });
    s = applyAction(s, { type: 'play', cardId: '03-P-0', shake: true });
    s = play(s, s.hands[1][0].id);
    s = applyAction(s, { type: 'play', cardId: '05-P-0', shake: true });
    expect(s.shakes[0]).toBe(2);
  });
});

describe('폭탄', () => {
  const H3 = ['03-P-0', '03-P-1', '03-T-0'];
  it('손패 3장 + 바닥 1장이면 bomb 액션이 나오고, 흔들기는 안 나온다', () => {
    const s = setup({ hand: [...H3, '05-P-0'], floor: ['03-G-0', '01-P-0'], deck: ['09-P-0'] });
    const acts = getLegalActions(s);
    expect(acts).toContainEqual({ type: 'bomb', month: 3 });
    expect(acts.some((a) => a.type === 'play' && a.shake)).toBe(false);
  });
  it('4장 획득, 이벤트 순서, 빈 패 2장, 배수, 턴 넘김', () => {
    let s = setup({ hand: [...H3, '05-P-0'], floor: ['03-G-0', '01-P-0'], deck: ['09-P-0'] });
    s = applyAction(s, { type: 'bomb', month: 3 });
    expect(s.captured[0].map((c) => c.id).sort()).toEqual(['03-G-0', '03-P-0', '03-P-1', '03-T-0']);
    expect(s.hands[0].map((c) => c.id)).toEqual(['05-P-0']);
    expect(s.dummies).toEqual([2, 0]);
    expect(s.shakes).toEqual([1, 0]);
    expect(s.turn).toBe(1);
    expect(countCards(s)).toBe(48);
    const types = s.events.map((e) => e.type).filter((t) => t !== 'deal');
    expect(types).toEqual(['bomb', 'capture', 'flip', 'place']);
  });
  it('상대 피 1장을 가져온다 (일반 피 우선, 없으면 쌍피, 없으면 없음) + steal 이벤트 순서', () => {
    const mk = () => setup({ hand: [...H3, '05-P-0'], floor: ['03-G-0'], deck: ['09-P-0'] });
    let s = mk();
    s.captured[1] = cards('12-D-0', '06-P-0');
    s = applyAction(s, { type: 'bomb', month: 3 });
    expect(s.captured[1].map((c) => c.id)).toEqual(['12-D-0']);
    expect(s.captured[0].map((c) => c.id)).toContain('06-P-0');
    expect(s.events.map((e) => e.type).filter((t) => t !== 'deal')).toEqual(['bomb', 'capture', 'steal', 'flip', 'place']);
    expect(s.events.find((e) => e.type === 'steal')).toEqual({ type: 'steal', player: 0, from: 1, card: '06-P-0' });
    let d = mk();
    d.captured[1] = cards('12-D-0', '01-G-0');
    d = applyAction(d, { type: 'bomb', month: 3 });
    expect(d.captured[1].map((c) => c.id)).toEqual(['01-G-0']);
    expect(d.captured[0].map((c) => c.id)).toContain('12-D-0');
    let n = mk();
    n.captured[1] = cards('01-G-0');
    n = applyAction(n, { type: 'bomb', month: 3 });
    expect(n.events.some((e) => e.type === 'steal')).toBe(false);
    expect(n.captured[1]).toHaveLength(1);
  });
  it('빈 패 내기: 손패 없이 더미만 뒤집고, 빈 패가 1장 줄며 dummy 이벤트', () => {
    let s = setup({ hand: [...H3, '05-P-0'], floor: ['03-G-0'], deck: ['09-P-0', '10-P-0', '11-P-0', '12-T-0'] });
    s = applyAction(s, { type: 'bomb', month: 3 });
    s = play(s, s.hands[1][0].id); // 상대 차례
    expect(s.turn).toBe(0);
    const acts = getLegalActions(s);
    expect(acts).toContainEqual({ type: 'dummy' });
    const hand = s.hands[0].length, deck = s.deck.length;
    s = applyAction(s, { type: 'dummy' });
    expect(s.hands[0]).toHaveLength(hand);
    expect(s.dummies).toEqual([1, 0]);
    expect(s.deck.length).toBe(deck - 1);
    expect(s.events.filter((e) => e.type === 'dummy')).toHaveLength(1);
    expect(s.turn).toBe(1);
    expect(countCards(s)).toBe(48);
  });
  it('빈 패가 없으면 dummy 불가, 빈 패가 남아 있으면 판이 안 끝난다', () => {
    const s = setup({ hand: ['03-P-0'], floor: ['01-P-0'], deck: ['05-P-0', '06-P-0'] });
    expect(getLegalActions(s).some((a) => a.type === 'dummy')).toBe(false);
    expect(() => applyAction(s, { type: 'dummy' })).toThrow();
    // 마지막 손패를 냈지만 상대에게 빈 패가 남음 -> 나가리로 끝나지 않고 계속
    let t = setup({ hand: ['03-P-0'], floor: ['01-P-0'], deck: ['05-P-0', '06-P-0'] });
    t.hands[1] = [];
    t.dummies = [0, 1];
    t = play(t, '03-P-0');
    expect(t.phase).toBe('play');
    expect(t.turn).toBe(1);
    expect(getLegalActions(t)).toEqual([{ type: 'dummy' }]);
    t = applyAction(t, { type: 'dummy' });
    expect(t.phase).toBe('ended');
  });
  it('폭탄 점수: 이긴 사람의 폭탄 배수가 정산에 곱해진다', () => {
    const base = ['01-G-0', '08-G-0', '02-Y-0', '04-Y-0', '08-Y-0']; // 광2 -> 0, 고도리 2장
    let s = setup({ hand: [...H3, '05-P-0'], floor: ['03-G-0'], deck: ['09-P-0'], captured: base, captured1: ['11-G-0'] });
    s = applyAction(s, { type: 'bomb', month: 3 }); // 3광(01,03,08) 3점 + ... 
    expect(s.phase).toBe('goStop');
    s = applyAction(s, { type: 'stop' });
    expect(s.result).toMatchObject({ type: 'win', shakeMultiplier: 2 });
    const r = s.result as { base: number; finalScore: number };
    expect(r.finalScore).toBe(r.base * 2);
  });
  it('settle 하위호환: 인자 3개로도 호출 가능 (배수 1)', () => {
    expect(settle(8, 0)).toMatchObject({ shakeMultiplier: 1, finalScore: 8 });
    expect(settle(8, 0, undefined, 2)).toMatchObject({ shakeMultiplier: 4, finalScore: 32 });
  });
});

describe('뻑 / 뻑 먹기', () => {
  const ppeokSetup = () => setup({ hand: ['05-P-0'], floor: ['05-Y-0', '01-P-0'], deck: ['05-T-0', '09-P-0', '10-P-0', '11-P-0'], hand1: ['05-P-1', '12-T-0', '06-P-0'], captured: ['07-P-0', '07-P-1'] });
  it('바닥 1장 + 손패 짝 + 뒤집은 패 같은 월 -> 3장 모두 바닥에 남고 뻑 월 기록, 이벤트 순서', () => {
    const s = play(ppeokSetup(), '05-P-0');
    expect(fmonth(s, 5)).toEqual(['05-P-0', '05-T-0', '05-Y-0']);
    expect(s.captured[0]).toHaveLength(2); // 먹은 것 없음 (원래 갖고 있던 2장뿐)
    expect(s.ppeok).toEqual({ 5: 0 });
    expect(s.turn).toBe(1);
    expect(countCards(s)).toBe(48);
    expect(evTypes(s)).toEqual(['play', 'flip', 'ppeok']);
    const e = s.events.find((x) => x.type === 'ppeok') as { cards: string[] };
    expect(e).toMatchObject({ player: 0, month: 5 });
    expect(e.cards.slice().sort()).toEqual(['05-P-0', '05-T-0', '05-Y-0']);
  });
  it('ppeok 옵션을 끄면 뻑 없이 단순 처리', () => {
    const s0 = ppeokSetup();
    s0.options.special.ppeok = false;
    const s = play(s0, '05-P-0');
    expect(ids(s.captured[0])).toEqual(['05-P-0', '05-Y-0', '07-P-0', '07-P-1']);
    expect(s.floor.map((c) => c.id)).toContain('05-T-0');
    expect(s.ppeok).toEqual({});
  });
  it('남이 싼 뻑을 손패로 먹으면 4장 + 상대 피 1장, 뻑 기록 삭제, 이벤트 순서', () => {
    let s = play(ppeokSetup(), '05-P-0'); // 0이 뻑
    s = play(s, '05-P-1'); // 1이 4번째 카드
    expect(ids(s.captured[1]).filter((i) => i.startsWith('05'))).toEqual(['05-P-0', '05-P-1', '05-T-0', '05-Y-0']);
    expect(s.captured[1].filter((c) => c.kind === 'P' && c.month === 7)).toHaveLength(1); // 0의 7월 피 1장 이동
    expect(s.captured[0]).toHaveLength(1);
    expect(s.ppeok).toEqual({});
    const after = s.events.slice(s.events.findIndex((e) => e.type === 'ppeok') + 1).map((e) => e.type);
    expect(after).toEqual(['play', 'flip', 'ppeokEat', 'capture', 'place', 'steal']);
    expect(s.events.find((e) => e.type === 'ppeokEat')).toEqual({ type: 'ppeokEat', player: 1, month: 5, self: false, fromPpeok: true });
  });
  it('자뻑(자기가 싼 뻑을 자기가 먹음)은 상대 피 2장', () => {
    let s = setup({ hand: ['05-P-0', '05-P-1'], floor: ['05-Y-0', '01-P-0'], deck: ['05-T-0', '09-P-0', '10-P-0'], hand1: ['12-T-0', '06-P-0'], captured1: ['07-P-0', '07-P-1', '08-P-0'] });
    s = play(s, '05-P-0'); // 뻑
    s = play(s, '12-T-0');
    s = play(s, '05-P-1'); // 자뻑
    expect(s.events.find((e) => e.type === 'ppeokEat')).toEqual({ type: 'ppeokEat', player: 0, month: 5, self: true, fromPpeok: true });
    expect(s.events.filter((e) => e.type === 'steal')).toHaveLength(2);
    expect(s.captured[1]).toHaveLength(1);
    expect(s.captured[0].filter((c) => c.kind === 'P' && c.month !== 5)).toHaveLength(2);
  });
  it('뒤집은 패로 뻑을 먹어도 된다 (남의 뻑: 피 1장)', () => {
    let s = setup({ hand: ['05-P-0'], floor: ['05-Y-0', '01-P-0'], deck: ['05-T-0', '05-P-1', '10-P-0'], hand1: ['12-T-0', '06-P-0'], captured: ['07-P-0'] });
    s = play(s, '05-P-0'); // 0 뻑
    s = play(s, '12-T-0'); // 1: 손패 놓고 뒤집은 05-P-1로 4장 먹기
    expect(ids(s.captured[1]).filter((i) => i.startsWith('05'))).toEqual(['05-P-0', '05-P-1', '05-T-0', '05-Y-0']);
    expect(s.captured[1].some((c) => c.id === '07-P-0')).toBe(true);
    expect(s.ppeok).toEqual({});
  });
  it('3연뻑 특수 처리 없음: 한 사람이 연속 뻑해도 그냥 기록만', () => {
    let s = setup({ hand: ['05-P-0', '06-P-0', '07-P-0'], floor: ['05-Y-0', '06-Y-0', '07-Y-0', '01-P-0'], deck: ['05-T-0', '09-P-0', '06-T-0', '10-P-1', '07-T-0'], hand1: ['12-T-0', '11-P-0', '10-P-0'] });
    s = play(s, '05-P-0'); s = play(s, '12-T-0');
    s = play(s, '06-P-0'); s = play(s, '11-P-0');
    s = play(s, '07-P-0');
    expect(s.ppeok).toEqual({ 5: 0, 6: 0, 7: 0 });
    expect(s.result).toBeNull();
  });
  it('뻑이 아닌 바닥 3장(처음 분배 등)을 4장째로 먹으면 상대 피 1장 (fromPpeok=false)', () => {
    const s = play(setup({ hand: ['03-P-0'], floor: ['03-T-0', '03-P-1', '03-G-0', '05-P-0'], deck: ['09-P-0'], captured1: ['02-P-0'] }), '03-P-0');
    expect(s.captured[0]).toHaveLength(5); // 4장 + 가져온 피 1장
    expect(s.captured[1]).toHaveLength(0);
    expect(s.events.find((e) => e.type === 'ppeokEat')).toEqual({ type: 'ppeokEat', player: 0, month: 3, self: false, fromPpeok: false });
    expect(evTypes(s)).toEqual(['play', 'flip', 'ppeokEat', 'capture', 'place', 'steal']);
  });
  it('뻑에서 온 3장은 fromPpeok=true, 상대 피가 없으면 못 가져온다', () => {
    const s = play(setup({ hand: ['03-P-0'], floor: ['03-T-0', '03-P-1', '03-G-0', '05-P-0'], deck: ['09-P-0'] }), '03-P-0');
    expect(s.events.filter((e) => e.type === 'steal')).toHaveLength(0);
  });
});

describe('쪽 / 따닥', () => {
  it('쪽: 손패가 놓이고 뒤집은 패가 같은 월 -> 2장 먹고 상대 피 1장', () => {
    const s = play(setup({ hand: ['03-P-0'], floor: ['01-P-0'], deck: ['03-P-1'], captured1: ['02-P-0', '12-D-0'] }), '03-P-0');
    expect(ids(s.captured[0])).toEqual(['02-P-0', '03-P-0', '03-P-1']);
    expect(ids(s.captured[1])).toEqual(['12-D-0']);
    expect(s.floor.map((c) => c.id)).toEqual(['01-P-0']);
    expect(evTypes(s)).toEqual(['play', 'flip', 'jjok', 'capture', 'steal']);
    expect(s.events.find((e) => e.type === 'jjok')).toEqual({ type: 'jjok', player: 0, month: 3 });
  });
  it('따닥: 바닥 2장 + 손패 + 뒤집은 패 -> 4장 먹고 상대 피 1장, 고르기 없음', () => {
    const s = play(setup({ hand: ['03-P-0'], floor: ['03-T-0', '03-G-0', '01-P-0'], deck: ['03-P-1'], captured1: ['02-P-0'] }), '03-P-0');
    expect(s.phase).toBe('play'); // chooseMatch로 멈추지 않는다
    expect(s.pending).toBeNull();
    expect(ids(s.captured[0])).toEqual(['02-P-0', '03-G-0', '03-P-0', '03-P-1', '03-T-0']);
    expect(s.captured[1]).toHaveLength(0);
    expect(evTypes(s)).toEqual(['play', 'flip', 'ttadak', 'capture', 'steal']);
    expect(s.turn).toBe(1);
  });
  it('따닥 옵션을 끄면 고르기 -> 남은 1장과 뒤집은 패가 짝 (피 가져오기 없음)', () => {
    const s0 = setup({ hand: ['03-P-0'], floor: ['03-T-0', '03-G-0', '01-P-0'], deck: ['03-P-1'], captured1: ['02-P-0'] });
    s0.options.special.ttadak = false;
    let s = play(s0, '03-P-0');
    expect(s.phase).toBe('chooseMatch');
    s = applyAction(s, { type: 'choose', cardId: '03-T-0' });
    expect(ids(s.captured[0])).toEqual(['03-G-0', '03-P-0', '03-P-1', '03-T-0']);
    expect(s.captured[1]).toHaveLength(1);
  });
  it('쪽 옵션을 끄면 단순 처리', () => {
    const s0 = setup({ hand: ['03-P-0'], floor: ['01-P-0'], deck: ['03-P-1'], captured1: ['02-P-0'] });
    s0.options.special.jjok = false;
    const s = play(s0, '03-P-0');
    expect(s.captured[1]).toHaveLength(1);
    expect(ids(s.captured[0])).toEqual(['03-P-0', '03-P-1']);
  });
});

describe('싹쓸이', () => {
  it('차례가 끝났을 때 바닥이 비면 상대 피 1장 (sweep 이벤트 -> steal)', () => {
    const s = play(setup({ hand: ['03-P-0'], floor: ['03-T-0', '05-P-0'], deck: ['05-P-1'], captured1: ['02-P-0', '02-P-1'] }), '03-P-0');
    expect(s.floor).toHaveLength(0);
    expect(s.captured[1]).toHaveLength(1);
    expect(evTypes(s)).toEqual(['play', 'flip', 'capture', 'capture', 'sweep', 'steal']);
  });
  it('뻑이면 바닥이 남으므로 싹쓸이 아님 / 옵션을 끄면 없음', () => {
    const s = play(setup({ hand: ['05-P-0'], floor: ['05-Y-0'], deck: ['05-T-0'] }), '05-P-0');
    expect(evTypes(s)).not.toContain('sweep');
    const s0 = setup({ hand: ['03-P-0'], floor: ['03-T-0', '05-P-0'], deck: ['05-P-1'], captured1: ['02-P-0'] });
    s0.options.special.sweep = false;
    const t = play(s0, '03-P-0');
    expect(t.floor).toHaveLength(0);
    expect(t.captured[1]).toHaveLength(1);
    expect(evTypes(t)).not.toContain('sweep');
  });
  it('마지막 턴(더미·손패 소진)에도 인정 (R16)', () => {
    const s = play(setup({ hand: ['03-P-0'], floor: ['03-T-0'], deck: [], emptyDeck: true, hand1: [], captured1: ['02-P-0'] }), '03-P-0');
    // 더미가 비어 flip 없이 바로 정산
    expect(evTypes(s)).toEqual(['play', 'capture', 'sweep', 'steal']);
    expect(s.captured[1]).toHaveLength(0);
  });
  it('손패와 뒤집은 패 모두 먹어 비면 싹쓸이, 쪽 후에도 바닥이 비면 겹쳐서 피 2장', () => {
    const s = play(setup({ hand: ['03-P-0'], floor: [], deck: ['03-P-1'], captured1: ['02-P-0', '02-P-1', '04-P-0'] }), '03-P-0');
    expect(evTypes(s)).toEqual(['play', 'flip', 'jjok', 'capture', 'steal', 'sweep', 'steal']);
    expect(s.captured[1]).toHaveLength(1);
  });
});

describe('피 가져오기 (R18)', () => {
  const jjok = (c1: string[]) => play(setup({ hand: ['03-P-0'], floor: ['01-P-0'], deck: ['03-P-1'], captured1: c1 }), '03-P-0');
  it('일반 피 우선, 없으면 쌍피, 피가 없으면 못 가져옴(열끗·광·띠는 안 가져옴)', () => {
    let s = jjok(['12-D-0', '02-P-0']);
    expect(ids(s.captured[1])).toEqual(['12-D-0']);
    s = jjok(['12-D-0', '01-G-0']);
    expect(ids(s.captured[1])).toEqual(['01-G-0']);
    expect(s.captured[0].some((c) => c.id === '12-D-0')).toBe(true);
    s = jjok(['01-G-0', '02-Y-0']);
    expect(s.captured[1]).toHaveLength(2);
    expect(s.events.some((e) => e.type === 'steal')).toBe(false);
  });
  it('자뻑 2장인데 상대 피가 1장뿐이면 1장만 가져온다', () => {
    let s = setup({ hand: ['05-P-0', '05-P-1'], floor: ['05-Y-0', '01-P-0'], deck: ['05-T-0', '09-P-0', '10-P-0'], hand1: ['12-T-0', '06-P-0'], captured1: ['07-P-0', '01-G-0'] });
    s = play(play(play(s, '05-P-0'), '12-T-0'), '05-P-1');
    expect(s.events.filter((e) => e.type === 'steal')).toHaveLength(1);
    expect(ids(s.captured[1])).toEqual(['01-G-0']);
  });
  it('뻑 먹기로 4장을 먹어 바닥이 비면 싹쓸이 피도 따로 가져온다', () => {
    let s = setup({ hand: ['05-P-0'], floor: ['05-Y-0'], deck: ['05-T-0', '09-P-0'], hand1: ['05-P-1', '12-T-0'], captured: ['07-P-0', '08-P-0'] });
    s = play(s, '05-P-0'); // 뻑 (바닥: 05 x3)
    s = play(s, '05-P-1'); // 1이 4장 먹기, 뒤집은 09-P-0은 놓임 -> 바닥 비지 않음
    expect(s.floor.map((c) => c.id)).toEqual(['09-P-0']);
    expect(s.captured[0]).toHaveLength(1);
  });
});

describe('고르기 상태와의 조합', () => {
  it('손패가 바닥 2장과 짝이고 뒤집은 패가 다른 월이면: 뒤집은 뒤 고르기 대기(source=hand), 이벤트는 flip까지만', () => {
    const s = play(setup({ hand: ['03-P-0'], floor: ['03-T-0', '03-P-1'], deck: ['09-P-0'] }), '03-P-0');
    expect(s.phase).toBe('chooseMatch');
    expect(s.pending).toMatchObject({ source: 'hand', card: { id: '03-P-0' }, later: { id: '09-P-0' } });
    expect(evTypes(s)).toEqual(['play', 'flip']); // flip 전에 capture 없음, 정산은 선택 뒤
    expect(countCards(s)).toBe(48);
  });
  it('고른 뒤 뒤집은 패가 또 2장 중 선택이 필요하면 다시 대기한다 (source=flip)', () => {
    let s = play(setup({ hand: ['03-P-0'], floor: ['03-T-0', '03-P-1', '09-P-1', '09-T-0'], deck: ['09-P-0'] }), '03-P-0');
    s = applyAction(s, { type: 'choose', cardId: '03-T-0' });
    expect(s.phase).toBe('chooseMatch');
    expect(s.pending).toMatchObject({ source: 'flip', card: { id: '09-P-0' }, later: null });
    s = applyAction(s, { type: 'choose', cardId: '09-T-0' });
    expect(s.phase).toBe('play');
    expect(s.turn).toBe(1);
    expect(ids(s.captured[0])).toEqual(['03-P-0', '03-T-0', '09-P-0', '09-T-0']);
    expect(evTypes(s)).toEqual(['play', 'flip', 'choose', 'capture', 'choose', 'capture']);
  });
  it('고르기 대기 중에 모인 피 가져오기는 마지막 선택 뒤 한꺼번에 (capture들 -> steal)', () => {
    // 손패 03: 2장 중 고르기, 뒤집은 05가 뻑 월(상대 뻑)을 먹음
    let s = setup({ hand: ['03-P-0'], floor: ['03-T-0', '03-P-1', '05-Y-0', '05-P-0', '05-T-0'], deck: ['05-P-1'], captured1: ['02-P-0'] });
    s.ppeok = { 5: 1 };
    s = play(s, '03-P-0');
    expect(s.phase).toBe('chooseMatch');
    expect(evTypes(s)).toEqual(['play', 'flip', 'ppeokEat']);
    expect(s.stealDue).toBe(1);
    s = applyAction(s, { type: 'choose', cardId: '03-T-0' });
    expect(evTypes(s)).toEqual(['play', 'flip', 'ppeokEat', 'choose', 'capture', 'capture', 'steal']);
    expect(s.stealDue).toBe(0);
    expect(s.captured[1]).toHaveLength(0);
  });
  it('손패 2장 중 고르기 상황이어도 뒤집은 패가 같은 월이면 따닥 (고르기 없음)', () => {
    const s = play(setup({ hand: ['03-P-0'], floor: ['03-T-0', '03-P-1'], deck: ['03-G-0'] }), '03-P-0');
    expect(s.phase).toBe('play');
    expect(s.captured[0]).toHaveLength(4);
  });
  it('더미가 비어 flip이 없으면 바로 정산 (2장 중 고르기는 손패 선택으로 대기)', () => {
    let s = play(setup({ hand: ['03-P-0'], floor: ['03-T-0', '03-P-1'], deck: [], emptyDeck: true, hand1: ['12-T-0'] }), '03-P-0');
    expect(s.phase).toBe('chooseMatch');
    expect(s.pending?.later).toBeNull();
    s = applyAction(s, { type: 'choose', cardId: '03-P-1' });
    expect(evTypes(s)).toEqual(['play', 'choose', 'capture']);
    expect(s.turn).toBe(1);
  });
  it('폭탄/빈 패 뒤 뒤집은 패도 같은 규칙: 뻑 먹기 가능', () => {
    let s = setup({ hand: ['03-P-0', '03-P-1', '03-T-0', '04-P-0'], floor: ['03-G-0', '05-Y-0', '05-T-0', '05-P-1'], deck: ['05-P-0'], captured1: ['02-P-0'] });
    s.ppeok = { 5: 1 };
    s = applyAction(s, { type: 'bomb', month: 3 });
    expect(s.events.filter((e) => e.type === 'steal')).toHaveLength(1); // 폭탄 피 1장 (상대 피 1장뿐)
    expect(s.captured[1]).toHaveLength(0);
    expect(s.events.some((e) => e.type === 'ppeokEat')).toBe(true);
    expect(s.ppeok).toEqual({});
    expect(countCards(s)).toBe(48);
  });
});

describe('보너스 패 (2피 2장 + 3피 1장)', () => {
  const BON = { bonus: { two: 2, three: 1 } };
  it('기본 덱은 51장, 끄면 48장, 보너스는 month 13 / B2 B3', () => {
    expect(countCards(createGame(7))).toBe(51);
    expect(countCards(createGame(7, { bonus: { two: 0, three: 0 } }))).toBe(48);
    const s = createGame(7);
    const all = [...s.hands[0], ...s.hands[1], ...s.floor, ...s.deck, ...s.captured[0], ...s.captured[1]];
    expect(all.filter((c) => c.month === 13).map((c) => c.id).sort()).toEqual(['13-B2-0', '13-B2-1', '13-B3-0']);
    expect(all.filter((c) => c.month === 13).map((c) => c.kind).sort()).toEqual(['B2', 'B2', 'B3']);
  });
  it('점수: 피 장수는 P1 D2 B2=2 B3=3', () => {
    const p = (...i: string[]) => score(cards2(...i)).details.find((d) => d.key === 'pi')?.label;
    const cards2 = (...ids: string[]) => ids.map((id) => (id.startsWith('13') ? { id, month: 13, kind: id.includes('B3') ? 'B3' : 'B2' } as Card : byId(id)));
    // 일반 피 5 + B3(3) + B2(2) = 10장
    expect(p('01-P-0', '01-P-1', '02-P-0', '02-P-1', '03-P-0', '13-B3-0', '13-B2-0')).toBe('피 10장');
    expect(p('01-P-0', '01-P-1', '02-P-0', '02-P-1', '03-P-0', '13-B3-0')).toBeUndefined(); // 8장
  });
  const bonusSetup = (o: Parameters<typeof setup>[0], bonusHand: string[] = []) => {
    const s = setup(o);
    for (const id of bonusHand) s.hands[0].push({ id, month: 13, kind: id.includes('B3') ? 'B3' : 'B2' });
    return s;
  };
  it('손패의 보너스: 바로 획득 + 더미에서 손패로 가져오고 같은 사람이 다시 낸다 (차례 유지)', () => {
    let s = bonusSetup({ hand: ['03-P-0'], floor: ['01-P-0'], deck: ['05-P-0', '06-P-0'] }, ['13-B2-0']);
    expect(getLegalActions(s)).toContainEqual({ type: 'play', cardId: '13-B2-0' });
    s = play(s, '13-B2-0');
    expect(s.turn).toBe(0);
    expect(s.phase).toBe('play');
    expect(s.captured[0].map((c) => c.id)).toEqual(['13-B2-0']);
    expect(s.hands[0].map((c) => c.id)).toEqual(['03-P-0', '05-P-0']);
    expect(evTypes(s)).toEqual(['bonus', 'draw']);
    expect(s.events[1]).toEqual({ type: 'bonus', player: 0, card: '13-B2-0', from: 'hand' });
    s = play(s, '05-P-0');
    expect(s.turn).toBe(1);
  });
  it('더미가 비었으면 획득만 하고 이어서 손패를 낸다 / 손패가 없으면 차례 종료', () => {
    let s = bonusSetup({ hand: ['03-P-0'], floor: ['01-P-0'], deck: [], emptyDeck: true, hand1: ['12-T-0'] }, ['13-B3-0']);
    s = play(s, '13-B3-0');
    expect(s.turn).toBe(0);
    expect(evTypes(s)).toEqual(['bonus']);
    expect(getLegalActions(s).length).toBeGreaterThan(0);
    let t = bonusSetup({ hand: [], floor: ['01-P-0'], deck: [], emptyDeck: true, hand1: ['12-T-0'] }, ['13-B3-0']);
    t = play(t, '13-B3-0');
    expect(t.turn).toBe(1); // 교착 없이 상대에게 넘어간다
    expect(t.phase).toBe('play');
  });
  it('더미에서 뒤집은 보너스: 획득하고 한 장 더 뒤집는다 (연속 가능), 이벤트 순서', () => {
    let s = setup({ hand: ['03-P-0'], floor: ['03-T-0'], deck: ['13-B2-0', '13-B3-0', '05-P-0'] });
    s = play(s, '03-P-0');
    expect(evTypes(s).slice(0, 7)).toEqual(['play', 'flip', 'bonus', 'flip', 'bonus', 'flip', 'capture']);
    expect(s.events.filter((e) => e.type === 'bonus').map((e) => (e as { from: string }).from)).toEqual(['flip', 'flip']);
    expect(ids(s.captured[0]).filter((i) => i.startsWith('13'))).toEqual(['13-B2-0', '13-B3-0']);
    expect(s.turn).toBe(1);
  });
  it('첫 분배: 바닥의 보너스는 선이 가져가고 더미에서 채운다 (바닥은 항상 8장, 보너스 없음)', () => {
    let found = 0;
    for (let i = 0; i < 400 && found < 3; i++) {
      const s = createGame('bd-' + i, { ...BON, dealer: i % 2 as 0 | 1 });
      const ev = s.events.filter((e) => e.type === 'bonus');
      expect(s.floor).toHaveLength(8);
      expect(s.floor.some((c) => c.month === 13)).toBe(false);
      expect(countCards(s)).toBe(51);
      if (ev.length) {
        found++;
        for (const e of ev) {
          expect(e).toMatchObject({ type: 'bonus', player: s.options.dealer, from: 'deal' });
        }
        expect(s.captured[s.options.dealer]).toHaveLength(ev.length);
        expect(s.deck.length).toBe(23 - ev.length);
      }
    }
    expect(found).toBeGreaterThan(0);
  });
  it('피 뺏기 우선순위: 일반 피 -> 쌍피 -> B2 -> B3', () => {
    const run = (c1: Card[]) => {
      const s = setup({ hand: ['03-P-0'], floor: ['01-P-0'], deck: ['03-P-1'] });
      s.captured[1] = c1;
      return applyAction(s, { type: 'play', cardId: '03-P-0' });
    };
    const B2: Card = { id: '13-B2-0', month: 13, kind: 'B2' }, B3: Card = { id: '13-B3-0', month: 13, kind: 'B3' };
    let s = run([B3, B2, byId('12-D-0'), byId('02-P-0')]);
    expect(ids(s.captured[1])).toEqual(['12-D-0', '13-B2-0', '13-B3-0'].sort());
    s = run([B3, B2, byId('12-D-0')]);
    expect(ids(s.captured[1])).toEqual(['13-B2-0', '13-B3-0']);
    s = run([B3, B2]);
    expect(ids(s.captured[1])).toEqual(['13-B3-0']);
    s = run([B3]);
    expect(ids(s.captured[1])).toEqual([]);
  });
  it('보너스 끄면 보너스 이벤트 없음 (48장 그대로)', () => {
    for (let i = 0; i < 30; i++) {
      const rng = createRng('nb-' + i);
      let s = createGame('nb-' + i, { bonus: { two: 0, three: 0 } });
      while (s.phase !== 'ended') {
        const a = getLegalActions(s);
        s = applyAction(s, a[Math.floor(rng() * a.length)]);
        expect(countCards(s)).toBe(48);
      }
      expect(s.events.some((e) => e.type === 'bonus' || e.type === 'draw')).toBe(false);
    }
  });
});


// ---- 총통 / 재분배 ----
const FULL = [...ALL_CARDS, ...buildBonusCards(2, 1)];
function findSeed(pred: (hands: Card[][], floor: Card[]) => boolean): string {
  for (let i = 0; i < 40000; i++) {
    const d = shuffle(FULL, 'find-' + i);
    if (pred([d.slice(0, 10), d.slice(10, 20)], d.slice(20, 28))) return 'find-' + i;
  }
  throw new Error('시드를 못 찾음');
}
const four = (cs: Card[]) => [...new Set(cs.map((c) => c.month))].some((m) => cs.filter((c) => c.month === m).length === 4);

describe('총통', () => {
  it('분배 직후 손패 같은 월 4장이면 그 사람 즉시 승리 10점 (ended, 이벤트 순서 deal -> chongtong -> end)', () => {
    for (const who of [0, 1]) {
      const seed = findSeed((h, f) => four(h[who]) && !four(h[1 - who]) && !four(f));
      const s = createGame(seed);
      expect(s.phase).toBe('ended');
      expect(s.result).toMatchObject({ type: 'win', winner: who, base: 10, finalScore: 10, by: 'chongtong', bakMultiplier: 1, shakeMultiplier: 1, nextCarry: 1 });
      const types = s.events.map((e) => e.type);
      expect(types[0]).toBe('deal');
      expect(types.indexOf('chongtong')).toBeLessThan(types.indexOf('end'));
      expect(types[types.length - 1]).toBe('end');
      expect(s.events.find((e) => e.type === 'chongtong')).toMatchObject({ player: who });
      expect(countCards(s)).toBe(51);
    }
  });
  it('총통에도 나가리 이월이 곱해진다 (10 x carry)', () => {
    const seed = findSeed((h, f) => four(h[0]) && !four(h[1]) && !four(f));
    expect(createGame(seed, { carry: 4 }).result).toMatchObject({ finalScore: 40, carry: 4 });
  });
  it('둘 다 총통이면 선 우선', () => {
    for (const dealer of [0, 1] as const) {
      const s = createGame('fixed', { bonus: { two: 0, three: 0 }, dealer });
      s.hands = [cards('01-P-0', '01-P-1', '01-G-0', '01-T-0', '02-P-0'), cards('03-P-0', '03-P-1', '03-G-0', '03-T-0', '04-P-0')];
      s.events = []; s.result = null; s.phase = 'play';
      checkChongtong(s);
      expect(s.phase).toBe('ended');
      expect(s.result).toMatchObject({ winner: dealer, finalScore: 10, by: 'chongtong' });
      expect(s.events.filter((e) => e.type === 'chongtong')).toHaveLength(1);
    }
  });
  it('special.chongtong=false면 그냥 진행', () => {
    const seed = findSeed((h, f) => four(h[0]) && !four(f));
    const s = createGame(seed, { special: { chongtong: false } as never });
    expect(s.phase).toBe('play');
    expect(s.result).toBeNull();
  });
});

describe('바닥 같은 월 4장 재분배 (R15)', () => {
  it('같은 시드에서 결정적으로 다시 섞고 redeal 이벤트를 남긴다', () => {
    const seed = findSeed((h, f) => four(f));
    const s = createGame(seed);
    expect(s.events.filter((e) => e.type === 'redeal')).toEqual([{ type: 'redeal', reason: 'floor4' }]);
    expect(four(s.floor)).toBe(false);
    expect(s.seed).toBe(seed);
    expect(createGame(seed)).toEqual(s); // 결정적
    const d = shuffle(FULL, seed + '#re1'); // 두 번째 분배가 시드+"#re1"
    if (!four(d.slice(20, 28))) expect(s.floor.length).toBe(8);
    expect(countCards(s)).toBe(51);
  });
  it('재분배가 없는 시드엔 redeal 이벤트가 없다', () => {
    expect(createGame('fixed').events.some((e) => e.type === 'redeal')).toBe(false);
  });
});

// ---- 박 / 국진 / 이월 ----
const P10 = ['01-P-0', '01-P-1', '02-P-0', '02-P-1', '03-P-0', '03-P-1', '04-P-0', '04-P-1', '05-P-0', '05-P-1']; // 피 10장 = 1점
const Y7 = ['02-Y-0', '04-Y-0', '05-Y-0', '06-Y-0', '07-Y-0', '08-Y-0', '10-Y-0']; // 열끗 7장 = 3 + 고도리 5 = 8점
/** captured0이 스톱할 수 있는 상황을 만들어 스톱한다 (점수 하한은 무시: 박 계산 검증용) */
function stopWith(c0: string[], c1: string[], opts: Partial<import('../src/engine').RuleOptions> = {}, mut?: (s: GameState) => void) {
  let s = setup({ hand: ['12-T-0'], floor: ['11-P-0'], deck: ['10-P-1'], captured: c0, captured1: c1 });
  s.options = { ...s.options, ...opts, special: { ...s.options.special, ...opts.special } };
  s.phase = 'goStop';
  mut?.(s);
  s = applyAction(s, { type: 'stop' });
  return s.result as Extract<NonNullable<GameState['result']>, { type: 'win' }>;
}

describe('박 (피박·광박·멍따)', () => {
  it('피박: 승자 피 점수 + 패자 피 1~5장 = x2 (0장은 아님)', () => {
    const r0 = stopWith(P10, []); // 패자 피 0장 → 피박 아님 (사용자 확정)
    expect(r0.bak).toEqual({ pi: false, gwang: false, meong: false });
    expect(r0).toMatchObject({ base: 1, bakMultiplier: 1, finalScore: 1 });
    expect(stopWith(P10, ['06-P-0']).bak.pi).toBe(true); // 1장
    expect(stopWith(P10, ['06-P-0', '06-P-1', '07-P-0', '07-P-1', '08-P-0']).bak.pi).toBe(true); // 5장
    expect(stopWith(P10, ['11-D-0', '06-P-0', '06-P-1', '07-P-0']).bak.pi).toBe(true); // 쌍피 포함 합 5
    const r6 = stopWith(P10, ['06-P-0', '06-P-1', '07-P-0', '07-P-1', '08-P-0', '08-P-1']); // 6장
    expect(r6).toMatchObject({ bakMultiplier: 1, finalScore: 1 });
  });
  it('피박: 승자가 피 점수를 못 냈으면(9장) 패자 피가 0장이어도 미적용, 보너스 피도 합에 포함', () => {
    expect(stopWith(P10.slice(0, 9), []).bak.pi).toBe(false);
    const r = stopWith(P10, ['13-B3-0', '06-P-0', '06-P-1']); // 3+1+1 = 5 -> 피박
    expect(r.bak.pi).toBe(true);
    expect(stopWith(P10, ['13-B3-0', '13-B2-0', '06-P-0']).bak.pi).toBe(false); // 6
  });
  it('광박: 승자 광 점수 + 패자 광 0장 = x2, 광이 1장이라도 있으면 미적용', () => {
    const G3 = ['01-G-0', '03-G-0', '08-G-0'];
    expect(stopWith(G3, [])).toMatchObject({ bak: { pi: false, gwang: true, meong: false }, base: 3, finalScore: 6 });
    expect(stopWith(G3, ['11-G-0'])).toMatchObject({ finalScore: 3 });
    expect(stopWith(['01-G-0', '03-G-0'], []).bak.gwang).toBe(false); // 광 점수 없음
  });
  it('멍따: 승자 열끗 7장 이상 = x2 (패자 조건 없음), 6장은 미적용', () => {
    expect(stopWith(Y7, ['02-P-0'])).toMatchObject({ bak: { pi: false, gwang: false, meong: true }, base: 8, finalScore: 16 });
    expect(stopWith(Y7.slice(0, 6), []).bak.meong).toBe(false);
  });
  it('박은 곱셈으로 중첩 (피박·광박·멍따 = x8) + 흔들기/이월과도 곱', () => {
    const all = [...P10, ...Y7, '01-G-0', '03-G-0', '08-G-0']; // 3광 3 + 열끗 3 + 고도리 5 + 피 1 = 12
    const r = stopWith(all, ['06-P-0']);
    expect(r.bak).toEqual({ pi: true, gwang: true, meong: true });
    expect(r).toMatchObject({ base: 12, bakMultiplier: 8, finalScore: 96 });
    const r2 = stopWith(all, ['06-P-0'], { carry: 2 }, (s) => { s.shakes = [1, 0]; s.goCount = [1, 0]; });
    expect(r2).toMatchObject({ goBonus: 1, shakeMultiplier: 2, bakMultiplier: 8, carry: 2, finalScore: 13 * 2 * 8 * 2 });
  });
  it('special.bak=false면 박 없음', () => {
    expect(stopWith(P10, [], { special: { bak: false } as never })).toMatchObject({ bakMultiplier: 1, finalScore: 1 });
  });
});

describe('국진 자동 선택 (R04)', () => {
  const Y4 = ['02-Y-0', '04-Y-0', '05-Y-0', '06-Y-0'];
  it('열끗 쪽이 유리하면 열끗으로 (label에 국진→열끗)', () => {
    const r = pts(...Y4, '09-Y-0');
    expect(r.gukjin).toBe('yeol');
    expect(r.total).toBe(1);
    expect(r.details.find((d) => d.key === 'yeol')!.label).toContain('국진→열끗');
  });
  it('쌍피 쪽이 유리하면 쌍피로 (피 8장 + 국진 = 피 10장)', () => {
    const r = pts('01-P-0', '01-P-1', '02-P-0', '02-P-1', '03-P-0', '03-P-1', '04-P-0', '04-P-1', '09-Y-0');
    expect(r.gukjin).toBe('pi');
    expect(r.details.find((d) => d.key === 'pi')!.label).toContain('국진→쌍피');
    expect(r.total).toBe(1);
  });
  it('국진 없으면 gukjin=null, 비기면 열끗', () => {
    expect(pts('01-P-0').gukjin).toBeNull();
    expect(pts('09-Y-0').gukjin).toBe('yeol');
  });
  it('고정 지정(score 3번째 인자)도 가능', () => {
    expect(score(cards(...Y4, '09-Y-0'), undefined, 'pi').total).toBe(0);
  });
  it('점수 판정 중에도 유리한 쪽: 쌍피로 셀 때만 7점이 되면 고/스톱이 뜬다', () => {
    // 피 8장 + 국진을 쌍피로 = 10장(1점) + 광 3 + 고도리 대신 띠 홍단 3 = 7점
    const cap = ['01-P-0', '01-P-1', '02-P-0', '02-P-1', '03-P-0', '04-P-0', '04-P-1', '05-P-0', '09-Y-0', '01-G-0', '03-G-0', '08-G-0', '01-T-0', '02-T-0'];
    let s = setup({ hand: ['03-T-0'], floor: ['03-P-1'], deck: ['10-P-1'], captured: cap });
    expect(score(s.captured[0]).total).toBe(4); // 국진 쌍피 1 + 광 3
    s = play(s, '03-T-0'); // 홍단 완성 +3
    expect(s.phase).toBe('goStop');
  });
  it('정산: 열끗으로 세면 멍따가 되는 국진은 열끗으로, 쌍피가 이득이면 쌍피로 (승자에게 유리한 쪽)', () => {
    const r = stopWith(['02-Y-0', '04-Y-0', '05-Y-0', '06-Y-0', '07-Y-0', '08-Y-0', '09-Y-0'], []);
    expect(r).toMatchObject({ base: 8, finalScore: 16, bak: { meong: true } });
    const r2 = stopWith(['01-P-0', '01-P-1', '02-P-0', '02-P-1', '03-P-0', '03-P-1', '04-P-0', '04-P-1', '09-Y-0'], ['06-P-0']);
    expect(r2).toMatchObject({ base: 1, bak: { pi: true }, finalScore: 2 });
  });
  it('패자의 국진은 쌍피(2)로 세어 피박을 피한다', () => {
    expect(stopWith(P10, ['06-P-0', '06-P-1', '07-P-0', '07-P-1', '09-Y-0']).bak.pi).toBe(false); // 4 + 2 = 6
    expect(stopWith(P10, ['06-P-0', '06-P-1', '07-P-0', '07-P-1']).bak.pi).toBe(true);
  });
  it('피 가져오기 대상에서 국진 제외 (쪽으로 가져올 피가 국진뿐이면 못 가져옴)', () => {
    let s = setup({ hand: ['03-P-0'], floor: ['01-P-0'], deck: ['03-P-1'], captured1: ['09-Y-0'] });
    s = play(s, '03-P-0');
    expect(s.events.some((e) => e.type === 'jjok')).toBe(true);
    expect(s.events.filter((e) => e.type === 'steal')).toHaveLength(0);
    expect(s.captured[1].map((c) => c.id)).toEqual(['09-Y-0']);
  });
});

describe('나가리 이월 (R12)', () => {
  const nagari = (carry?: number) => {
    let s = setup({ hand: ['03-P-0'], floor: ['01-P-0'], deck: ['05-P-0', '06-P-0'] });
    if (carry !== undefined) s.options.carry = carry;
    s.deck = [...s.deck.slice(0, 2), ...s.hands[1], ...s.deck.slice(2)].filter((c) => c.id !== '09-P-0');
    s.hands[1] = cards('09-P-0');
    s = play(s, '03-P-0');
    return play(s, '09-P-0').result;
  };
  it('나가리: nextCarry = min(carry*2, 4)', () => {
    expect(nagari()).toEqual({ type: 'nagari', nextCarry: 2 });
    expect(nagari(2)).toEqual({ type: 'nagari', nextCarry: 4 });
    expect(nagari(4)).toEqual({ type: 'nagari', nextCarry: 4 });
  });
  it('승리: 승자 finalScore에 carry가 곱해지고 nextCarry는 1', () => {
    const r = stopWith(Y7, ['02-P-0'], { carry: 2 });
    expect(r).toMatchObject({ carry: 2, finalScore: 8 * 2 * 2, nextCarry: 1 }); // 기본 8 x 멍따 2 x 이월 2
    expect(stopWith(Y7, ['02-P-0'], { carry: 4 }).finalScore).toBe(64);
    expect(stopWith(Y7, ['02-P-0'])).toMatchObject({ carry: 1, nextCarry: 1 });
  });
  it('createGame 옵션 carry 기본 1', () => {
    expect(createGame('fixed').options.carry).toBe(1);
    expect(createGame('fixed', { carry: 2 }).options.carry).toBe(2);
  });
});

describe('자동 대전 1000판', () => {
  it('예외 없이 끝나고 카드 총합 48이 항상 보존된다', () => {
    const kinds = { win: 0, nagari: 0 };
    let chongtong = 0;
    const seen = { shake: 0, bomb: 0, dummy: 0, steal: 0, ppeok: 0, ppeokEat: 0, jjok: 0, ttadak: 0, sweep: 0, bonus: 0, draw: 0 };
    for (let i = 0; i < 1000; i++) {
      const rng = createRng('fuzz-' + i);
      let s = createGame('fuzz-' + i);
      expect(countCards(s)).toBe(51);
      let steps = 0;
      while (s.phase !== 'ended') {
        const acts = getLegalActions(s);
        expect(acts.length).toBeGreaterThan(0);
        s = applyAction(s, acts[Math.floor(rng() * acts.length)] as Action);
        expect(countCards(s)).toBe(51);
        expect(new Set([...s.hands[0], ...s.hands[1], ...s.floor, ...s.deck, ...s.captured[0], ...s.captured[1], ...(s.pending ? [s.pending.card] : []), ...(s.pending?.later ? [s.pending.later] : [])].map((c) => c.id)).size).toBe(51);
        if (++steps > 200) throw new Error('무한 루프 의심');
      }
      for (const e of s.events) if (e.type in seen) seen[e.type as keyof typeof seen]++;
      expect(s.dummies[0] + s.dummies[1]).toBeGreaterThanOrEqual(0);
      expect(s.result).not.toBeNull();
      kinds[s.result!.type]++;
      const r = s.result!;
      if (r.type === 'win') {
        expect(r.finalScore).toBe((r.base + r.goBonus) * r.multiplier * r.shakeMultiplier * r.bakMultiplier * r.carry);
        expect(r.nextCarry).toBe(1);
        if (r.by === 'chongtong') chongtong++;
      } else expect(r.nextCarry).toBe(2);
    }
    expect(kinds.win + kinds.nagari).toBe(1000);
    expect(seen.shake + seen.bomb).toBeGreaterThan(0); // 새 액션이 실제로 섞여 나왔는지
    expect(seen.dummy).toBeGreaterThan(0);
    for (const k of ['ppeok', 'ppeokEat', 'jjok', 'ttadak', 'sweep', 'bonus', 'draw', 'steal'] as const) expect(seen[k], k).toBeGreaterThan(0);
  });
});

describe('국진 선택 (사람이 고정)', () => {
  it('setGukjin으로 열끗/쌍피 고정 — scoreOf와 정산에 반영, 원본 state 불변', async () => {
    const { createGame, setGukjin, scoreOf } = await import('../src/engine');
    const s0 = createGame('gk', { bonus: { two: 0, three: 0 } });
    const s = structuredClone(s0);
    s.captured[0] = ['02-Y-0', '04-Y-0', '05-Y-0', '06-Y-0', '09-Y-0'].map((id) => ({ id, month: Number(id.slice(0, 2)), kind: 'Y', tag: id === '09-Y-0' ? 'gukjin' : undefined })) as never;
    expect(scoreOf(s, 0).total).toBe(1); // 자동: 열끗 5장 1점
    const asPi = setGukjin(s, 0, 'pi');
    expect(asPi.gukjinAs).toEqual(['pi', 'auto']);
    expect(scoreOf(asPi, 0).total).toBe(0); // 열끗 4장 + 피 2 → 0점
    expect(s.gukjinAs).toEqual(['auto', 'auto']);
  });
  it('고/스톱 대기 중 국진을 바꿔 자격이 없어지면 다음 차례로 넘어감', async () => {
    const { createGame, setGukjin } = await import('../src/engine');
    const s = createGame('gk2', { bonus: { two: 0, three: 0 } });
    s.captured[0] = ['02-Y-0', '04-Y-0', '05-Y-0', '06-Y-0', '07-Y-0', '08-Y-1', '10-Y-0', '09-Y-0']
      .map((id) => ({ id, month: Number(id.slice(0, 2)), kind: 'Y', tag: id === '09-Y-0' ? 'gukjin' : undefined })) as never; // 열끗 8장 = 4점, 국진 빼면 7장 3점
    (s.captured[0] as unknown[]).push(...['01-P-0', '01-P-1', '03-P-0', '03-P-1', '04-P-0', '04-P-1', '05-P-0', '05-P-1'].map((id) => ({ id, month: Number(id.slice(0, 2)), kind: 'P' })));
    s.options.winScore = 4; s.phase = 'goStop'; s.turn = 0;
    const r = setGukjin(s, 0, 'pi'); // 열끗 7장 3점 + 피 10장 1점 = 4점 → 여전히 자격
    expect(r.phase).toBe('goStop');
    const r2 = setGukjin(s, 0, 'yeol'); // 열끗 8장 4점 + 피 8장 0점 = 4점 → 자격
    expect(r2.phase).toBe('goStop');
    s.captured[0] = s.captured[0].slice(0, 8);
    const r3 = setGukjin(s, 0, 'pi'); // 열끗 7장 3점 + 피 2 → 3점 < 4 → 다음 차례
    expect(r3.phase).toBe('play');
    expect(r3.turn).toBe(1);
  });
});
