import { describe, expect, it } from 'vitest';
import {
  ALL_CARDS, applyAction, countCards, createGame, createRng, getLegalActions, score, settle, shuffle,
  type Action, type Card, type GameState,
} from '../src/engine';

const byId = (id: string): Card => {
  const c = ALL_CARDS.find((x) => x.id === id);
  if (!c) throw new Error('없는 카드 ' + id);
  return { ...c };
};
const cards = (...ids: string[]) => ids.map(byId);
const pts = (...ids: string[]) => score(cards(...ids));

/** 지정한 손패/바닥/더미로 상태를 만든다 (나머지 카드는 상대 손패/더미로 채움). */
function setup(o: { hand: string[]; floor: string[]; deck: string[]; captured?: string[] }): GameState {
  const s = createGame('fixed');
  const used = new Set([...o.hand, ...o.floor, ...o.deck, ...(o.captured ?? [])]);
  const rest = ALL_CARDS.filter((c) => !used.has(c.id)).map((c) => ({ ...c }));
  s.hands = [cards(...o.hand), rest.splice(0, 10)];
  s.floor = cards(...o.floor);
  s.deck = [...cards(...o.deck), ...rest];
  s.captured = [cards(...(o.captured ?? [])), []];
  return s;
}
const play = (s: GameState, id: string) => applyAction(s, { type: 'play', cardId: id });

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
  it('손패 10 / 바닥 8 / 더미 20, 선은 0', () => {
    const s = createGame(1);
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
    let s = play(setup({ hand: ['03-P-0'], floor: ['03-T-0', '03-P-1'], deck: ['09-P-0'] }), '03-P-0');
    expect(s.phase).toBe('chooseMatch');
    expect(s.turn).toBe(0);
    expect(countCards(s)).toBe(48);
    const acts = getLegalActions(s);
    expect(acts).toEqual([{ type: 'choose', cardId: '03-T-0' }, { type: 'choose', cardId: '03-P-1' }]);
    const before = s.deck.length;
    s = applyAction(s, { type: 'choose', cardId: '03-T-0' });
    expect(s.captured[0].map((c) => c.id).sort()).toEqual(['03-P-0', '03-T-0']);
    expect(s.floor.map((c) => c.id)).toContain('03-P-1');
    // 선택 후 더미 뒤집기가 이어져 턴이 넘어간다
    expect(s.deck.length).toBe(before - 1);
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
  it('손패와 더미가 같은 월이어도 상태가 깨지지 않는다 (순서대로 처리)', () => {
    // 바닥에 없음 -> 손패 놓임 -> 더미가 같은 월이라 먹음
    let s = play(setup({ hand: ['03-P-0'], floor: ['01-P-0'], deck: ['03-P-1'] }), '03-P-0');
    expect(s.captured[0].map((c) => c.id).sort()).toEqual(['03-P-0', '03-P-1']);
    expect(countCards(s)).toBe(48);
    // 바닥 1장 + 손패 먹기 + 더미 같은 월(남은 바닥 0장이면 놓임)
    s = play(setup({ hand: ['03-P-0'], floor: ['03-T-0'], deck: ['03-P-1'] }), '03-P-0');
    expect(s.floor.map((c) => c.id)).toContain('03-P-1');
    expect(countCards(s)).toBe(48);
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
    let s = setup({ hand: ['08-Y-0'], floor: ['08-P-0'], deck: ['05-P-0'], captured: base });
    s = play(s, '08-Y-0');
    expect(s.phase).toBe('goStop'); // 3 + 5 = 8
    expect(getLegalActions(s).map((a) => a.type).sort()).toEqual(['go', 'stop']);
    s = applyAction(s, { type: 'stop' });
    expect(s.phase).toBe('ended');
    expect(s.result).toMatchObject({ type: 'win', winner: 0, base: 8, goCount: 0, finalScore: 8, by: 'stop' });
  });
  it('고를 외치면 goCount가 오르고 상대 턴으로 넘어간다', () => {
    const base = ['01-G-0', '03-G-0', '08-G-0', '02-Y-0', '04-Y-0'];
    let s = setup({ hand: ['08-Y-0'], floor: ['08-P-0'], deck: ['10-P-0'], captured: base });
    s = play(s, '08-Y-0'); // 8점
    s = applyAction(s, { type: 'go' });
    expect(s.goCount).toEqual([1, 0]);
    expect(s.lastGoScore[0]).toBe(8);
    expect(s.turn).toBe(1);
    expect(s.phase).toBe('play');
  });
  it('최종 정산에 고 횟수가 반영된다 (2고 스톱 = 기본 + 2)', () => {
    const base = ['01-G-0', '03-G-0', '08-G-0', '02-Y-0', '04-Y-0'];
    let s = setup({ hand: ['08-Y-0'], floor: ['08-P-0'], deck: ['05-P-0'], captured: base });
    s.goCount = [2, 0];
    s.lastGoScore = [7, 0];
    s = play(s, '08-Y-0');
    s = applyAction(s, { type: 'stop' });
    expect(s.result).toMatchObject({ type: 'win', base: 8, goCount: 2, goBonus: 2, multiplier: 1, finalScore: 10 });
  });
  it('직전 고 점수와 같으면 고/스톱이 다시 뜨지 않는다', () => {
    const base = ['01-G-0', '03-G-0', '08-G-0', '02-Y-0', '04-Y-0', '08-Y-0']; // 8점
    let s = setup({ hand: ['09-P-0'], floor: [], deck: ['10-P-0'], captured: base });
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
    expect(s.result).toEqual({ type: 'nagari' });
    expect(countCards(s)).toBe(48);
  });
  it('패가 떨어졌을 때 7점 이상이 한 명이면 그 사람이 승자 (고 가산 반영)', () => {
    const base = ['01-G-0', '03-G-0', '08-G-0', '02-Y-0', '04-Y-0'];
    let s = setup({ hand: ['08-Y-0'], floor: ['08-P-0'], deck: ['05-P-0', '06-P-0'], captured: base });
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
    let s = setup({ hand: ['08-Y-0'], floor: ['08-P-0'], deck: ['05-P-0'], captured: base });
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
    let s = setup({ hand: ['08-Y-0', '05-P-0', '05-P-1', '05-T-0'], floor: ['08-P-0'], deck: ['10-P-0'], captured: base });
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
    let s = setup({ hand: ['08-Y-0'], floor: ['08-P-0'], deck: ['05-P-0'], captured: base });
    s.shakes = [2, 0];
    s = play(s, '08-Y-0');
    s = applyAction(s, { type: 'stop' });
    expect(s.result).toMatchObject({ type: 'win', winner: 0, base: 8, shakeMultiplier: 4, finalScore: 32 });
    // 상대가 흔들었어도 내가 이기면 내 배수만 적용
    let t = setup({ hand: ['08-Y-0'], floor: ['08-P-0'], deck: ['05-P-0'], captured: base });
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
    let s = setup({ hand: [...H3, '05-P-0'], floor: ['03-G-0'], deck: ['09-P-0'], captured: base });
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

describe('자동 대전 1000판', () => {
  it('예외 없이 끝나고 카드 총합 48이 항상 보존된다', () => {
    const kinds = { win: 0, nagari: 0 };
    const seen = { shake: 0, bomb: 0, dummy: 0, steal: 0 };
    for (let i = 0; i < 1000; i++) {
      const rng = createRng('fuzz-' + i);
      let s = createGame('fuzz-' + i);
      let steps = 0;
      while (s.phase !== 'ended') {
        const acts = getLegalActions(s);
        expect(acts.length).toBeGreaterThan(0);
        s = applyAction(s, acts[Math.floor(rng() * acts.length)] as Action);
        expect(countCards(s)).toBe(48);
        expect(new Set([...s.hands[0], ...s.hands[1], ...s.floor, ...s.deck, ...s.captured[0], ...s.captured[1], ...(s.pending ? [s.pending.card] : [])].map((c) => c.id)).size).toBe(48);
        if (++steps > 200) throw new Error('무한 루프 의심');
      }
      for (const e of s.events) if (e.type in seen) seen[e.type as keyof typeof seen]++;
      expect(s.dummies[0] + s.dummies[1]).toBeGreaterThanOrEqual(0);
      expect(s.result).not.toBeNull();
      kinds[s.result!.type]++;
    }
    expect(kinds.win + kinds.nagari).toBe(1000);
    expect(seen.shake + seen.bomb).toBeGreaterThan(0); // 새 액션이 실제로 섞여 나왔는지
    expect(seen.dummy).toBeGreaterThan(0);
  });
});
