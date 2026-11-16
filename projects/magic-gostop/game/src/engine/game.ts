import { ALL_CARDS, buildBonusCards, isBonus } from './cards';
import { shuffle } from './rng';
import { score, settleWin } from './score';
import type { EngineHooks } from './hooks';
import {
  DEFAULT_OPTIONS,
  type Action, type Card, type GameResult, type GameState, type PlayerId, type RuleOptions,
} from './types';

const HAND = 10;
const FLOOR = 8;

/** 새 판을 만든다. 같은 seed + options = 항상 같은 상태. */
export function createGame(seed: string | number, options: Partial<RuleOptions> = {}): GameState {
  const opts: RuleOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
    special: { ...DEFAULT_OPTIONS.special, ...options.special },
    magic: { ...DEFAULT_OPTIONS.magic, ...options.magic },
    bonus: { ...DEFAULT_OPTIONS.bonus, ...options.bonus },
  };
  const full = [...ALL_CARDS, ...buildBonusCards(opts.bonus.two, opts.bonus.three)];
  // 바닥 같은 월 4장이면 같은 시드에서 결정적으로 다시 섞는다 (R15). 시드+"#re1", "#re2"...
  let deck: Card[] = [];
  let hands: [Card[], Card[]] = [[], []];
  let floor: Card[] = [];
  let redeals = 0;
  for (;; redeals++) {
    const sd = redeals === 0 ? seed : `${seed}#re${redeals}`;
    deck = shuffle(full, sd).map((c) => ({ ...c }));
    hands = [deck.splice(0, HAND), deck.splice(0, HAND)];
    floor = deck.splice(0, FLOOR);
    if (redeals >= 50 || !hasFour(floor)) break;
  }
  const state: GameState = {
    seed: String(seed),
    options: opts,
    phase: 'play',
    turn: opts.dealer,
    hands,
    floor,
    deck, // 나머지 20장
    ppeok: {},
    stealDue: 0,
    captured: [[], []],
    pending: null,
    goCount: [0, 0],
    lastGoScore: [0, 0],
    shakes: [0, 0],
    dummies: [0, 0],
    events: [{ type: 'deal', seed: String(seed) }],
    result: null,
  };
  for (let i = 0; i < redeals; i++) state.events.push({ type: 'redeal', reason: 'floor4' });
  // 처음 바닥에 깔린 보너스 패: 선이 가져가고 더미에서 채운다 (또 보너스면 반복)
  for (let i = 0; i < state.floor.length; i++) {
    while (isBonus(state.floor[i])) {
      const [b] = state.floor.splice(i, 1, ...(state.deck.length ? state.deck.splice(0, 1) : []));
      state.captured[opts.dealer].push(b);
      state.events.push({ type: 'bonus', player: opts.dealer, card: b.id, from: 'deal' });
      if (i >= state.floor.length) break;
    }
  }
  checkChongtong(state);
  return state;
}

/** 총통: 손패 같은 월 4장이면 즉시 승리 10점 (R11). 둘 다면 선 우선. 흔들기·고·박·이월 없음. state를 직접 바꾼다 (테스트용으로 export) */
export function checkChongtong(state: GameState): void {
  const opts = state.options;
  if (opts.special.chongtong) {
    const order: PlayerId[] = [opts.dealer, (1 - opts.dealer) as PlayerId];
    for (const p of order) {
      const m = fourOf(state.hands[p]);
      if (m === null) continue;
      state.events.push({ type: 'chongtong', player: p, month: m, cards: state.hands[p].filter((c) => c.month === m).map((c) => c.id) });
      const result: GameResult = {
        type: 'win', winner: p, base: 10, goCount: 0, goBonus: 0, multiplier: 1, shakeMultiplier: 1,
        bak: { pi: false, gwang: false, meong: false }, bakMultiplier: 1, carry: 1, nextCarry: 1, finalScore: 10, by: 'chongtong',
      };
      state.result = result;
      state.phase = 'ended';
      state.events.push({ type: 'end', result });
      break;
    }
  }
}

function fourOf(cards: Card[]): number | null {
  for (let m = 1; m <= 12; m++) if (cards.filter((c) => c.month === m).length === 4) return m;
  return null;
}
const hasFour = (cards: Card[]) => fourOf(cards) !== null;

export function getLegalActions(s: GameState): Action[] {
  switch (s.phase) {
    case 'play':
      return playActions(s);
    case 'chooseMatch':
      return (s.pending?.options ?? []).map((id) => ({ type: 'choose', cardId: id }));
    case 'goStop': {
      const acts: Action[] = [{ type: 'stop' }];
      // 양쪽 손패가 모두 비면 고를 계속할 턴이 없으므로 스톱만 가능
      if (handsLeft(s) > 0) acts.unshift({ type: 'go' });
      return acts;
    }
    default:
      return [];
  }
}

/** 손패 + 빈 패 총 장수 (빈 패도 손패로 취급) */
function handsLeft(s: GameState): number {
  return s.hands[0].length + s.hands[1].length + s.dummies[0] + s.dummies[1];
}

function playActions(s: GameState): Action[] {
  const p = s.turn;
  const hand = s.hands[p];
  const acts: Action[] = hand.map((c) => ({ type: 'play', cardId: c.id }));
  for (let m = 1; m <= 12; m++) {
    const inHand = hand.filter((c) => c.month === m);
    if (inHand.length !== 3) continue; // 4장(총통)은 범위 밖
    const onFloor = s.floor.filter((c) => c.month === m).length;
    if (onFloor === 0 && s.options.special.shake) {
      for (const c of inHand) acts.push({ type: 'play', cardId: c.id, shake: true });
    } else if (onFloor === 1 && s.options.special.bomb) {
      acts.push({ type: 'bomb', month: m });
    }
  }
  if (s.dummies[p] >= 1) acts.push({ type: 'dummy' });
  return acts;
}

function sameAction(a: Action, b: Action): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'play' && b.type === 'play') return a.cardId === b.cardId && !!a.shake === !!b.shake;
  if (a.type === 'bomb' && b.type === 'bomb') return a.month === b.month;
  if (a.type === 'choose' && b.type === 'choose') return a.cardId === b.cardId;
  return true;
}

/** 불변 업데이트: 입력 state는 바꾸지 않고 새 state를 돌려준다. 불법 행동은 예외. */
export function applyAction(state: GameState, action: Action, hooks?: EngineHooks): GameState {
  const legal = getLegalActions(state);
  const ok = legal.some((a) => sameAction(a, action));
  if (!ok) throw new Error(`불법 행동: ${JSON.stringify(action)} (phase=${state.phase})`);

  let s: GameState = structuredClone(state);
  const h = s.options.magic.enabled ? hooks : undefined;
  const call = (name: keyof EngineHooks) => {
    const r = h?.[name]?.(s);
    if (r) s = r;
  };
  const ctx: Ctx = { get s() { return s; }, call };

  switch (action.type) {
    case 'play': {
      const p = s.turn;
      const idx = s.hands[p].findIndex((c) => c.id === action.cardId);
      const [card] = s.hands[p].splice(idx, 1);
      if (isBonus(card)) {
        // 보너스 패: 바로 획득, 더미에서 1장 손패로 가져와 같은 사람이 다시 낸다
        s.captured[p].push(card);
        s.events.push({ type: 'bonus', player: p, card: card.id, from: 'hand' });
        if (s.deck.length > 0) {
          const d = s.deck.shift()!;
          s.hands[p].push(d);
          s.events.push({ type: 'draw', player: p, card: d.id });
        } else if (handsLeft(s) === 0 || s.hands[p].length + s.dummies[p] === 0) {
          endTurn(ctx); // 더 낼 패가 없으면 차례 종료
        }
        break;
      }
      if (action.shake) {
        s.shakes[p] += 1;
        const shown = [card, ...s.hands[p].filter((c) => c.month === card.month)];
        s.events.push({ type: 'shake', player: p, month: card.month, cards: shown.map((c) => c.id) });
      }
      s.events.push({ type: 'play', player: p, card: card.id });
      flipAndSettle(ctx, card);
      break;
    }
    case 'bomb': {
      const p = s.turn;
      const three = s.hands[p].filter((c) => c.month === action.month);
      s.hands[p] = s.hands[p].filter((c) => c.month !== action.month);
      s.events.push({ type: 'bomb', player: p, month: action.month, cards: three.map((c) => c.id) });
      s.shakes[p] += 1;
      capture(s, [...three, ...s.floor.filter((c) => c.month === action.month)]);
      steal(s, p);
      s.dummies[p] += 2;
      flipAndSettle(ctx, null);
      break;
    }
    case 'dummy': {
      const p = s.turn;
      s.dummies[p] -= 1;
      s.events.push({ type: 'dummy', player: p });
      flipAndSettle(ctx, null);
      break;
    }
    case 'choose': {
      const pend = s.pending!;
      const target = s.floor.find((c) => c.id === action.cardId)!;
      s.events.push({ type: 'choose', player: s.turn, card: target.id });
      s.pending = null;
      s.phase = 'play';
      capture(s, [pend.card, target]);
      // 손패 쪽 선택이었다면 이미 뒤집어 둔 더미 패를 이어서 정산한다 (또 고를 일이 생기면 다시 대기)
      if (pend.later && resolveOne(s, pend.later, 'flip', null)) break;
      finishTurn(ctx);
      break;
    }
    case 'go': {
      const p = s.turn;
      const total = score(s.captured[p], s.options).total;
      s.goCount[p] += 1;
      s.lastGoScore[p] = total;
      s.events.push({ type: 'go', player: p, goCount: s.goCount[p], score: total });
      nextTurn(ctx);
      break;
    }
    case 'stop': {
      const p = s.turn;
      s.events.push({ type: 'stop', player: p, score: score(s.captured[p], s.options).total });
      finish(s, p, 'stop');
      break;
    }
  }
  return s;
}

interface Ctx { readonly s: GameState; call(name: keyof EngineHooks): void }

function capture(s: GameState, cards: Card[]) {
  const ids = new Set(cards.map((c) => c.id));
  s.floor = s.floor.filter((c) => !ids.has(c.id));
  for (const c of cards) delete s.ppeok[c.month]; // 그 월 바닥이 치워지면 뻑 기록도 사라진다
  s.captured[s.turn].push(...cards);
  s.events.push({ type: 'capture', player: s.turn, cards: cards.map((c) => c.id) });
}

/** 상대 획득 패에서 피 1장 가져오기 (일반 피 우선, 없으면 쌍피, 없으면 없음 - R18) */
function steal(s: GameState, p: PlayerId) {
  const from = (1 - p) as PlayerId;
  const src = s.captured[from];
  let i = -1;
  for (const k of ['P', 'D', 'B2', 'B3']) { // 가능한 한 작은 피부터
    i = src.findIndex((c) => c.kind === k);
    if (i >= 0) break;
  }
  if (i < 0) return;
  const [card] = src.splice(i, 1);
  s.captured[p].push(card);
  s.events.push({ type: 'steal', player: p, from, card: card.id });
}

/**
 * 카드 1장의 기본 매칭 정산 (3.1표). 0장 놓기 / 1장 먹기 / 2장 선택 대기 / 3장 모두 먹기.
 * 선택 대기가 되면 true.
 */
function resolveOne(s: GameState, card: Card, source: 'hand' | 'flip', later: Card | null): boolean {
  const matches = s.floor.filter((c) => c.month === card.month);
  if (matches.length === 0) {
    s.floor.push(card);
    s.events.push({ type: 'place', player: s.turn, card: card.id });
  } else if (matches.length === 2) {
    s.pending = { source, card, options: matches.map((c) => c.id), later };
    s.phase = 'chooseMatch';
    return true;
  } else {
    capture(s, [card, ...matches]); // 1장 또는 3장: 전부 먹는다
  }
  return false;
}

/**
 * 손패(없을 수 있음: 폭탄/빈 패)를 낸 뒤 더미를 뒤집고, 두 장을 함께 보고 정산한다 (rules 3.2/3.3).
 * 순서: flip -> 효과 이벤트(ppeok/jjok/ttadak/ppeokEat) -> capture/place -> 피 가져오기 -> 싹쓸이.
 * 고르기는 정산 중 "정확히 2장 중 선택"이 필요할 때만 대기한다 (flip 이후). 따닥이면 고르지 않는다.
 */
function flipAndSettle(ctx: Ctx, hand: Card | null) {
  const s = ctx.s;
  let flipped: Card | null = null;
  while (s.deck.length > 0) {
    const f = s.deck.shift()!;
    s.events.push({ type: 'flip', player: s.turn, card: f.id });
    if (isBonus(f)) { // 보너스: 획득하고 한 장 더 뒤집는다
      s.captured[s.turn].push(f);
      s.events.push({ type: 'bonus', player: s.turn, card: f.id, from: 'flip' });
      continue;
    }
    flipped = f;
    break;
  }
  const p = s.turn;
  const sp = s.options.special;
  const onFloor = (m: number) => s.floor.filter((c) => c.month === m);

  // 1) 같은 월 조합 (쪽 / 뻑 / 따닥) - 옵션이 꺼져 있으면 아래 단순 처리로 넘어간다
  if (hand && flipped && hand.month === flipped.month) {
    const m = hand.month;
    const fl = onFloor(m);
    if (fl.length === 0 && sp.jjok) {
      s.events.push({ type: 'jjok', player: p, month: m });
      capture(s, [hand, flipped]);
      s.stealDue += 1;
      return finishTurn(ctx);
    }
    if (fl.length === 1 && sp.ppeok) {
      s.floor.push(hand, flipped);
      s.ppeok[m] = p;
      s.events.push({ type: 'ppeok', player: p, month: m, cards: [fl[0].id, hand.id, flipped.id] });
      return finishTurn(ctx);
    }
    if (fl.length === 2 && sp.ttadak) {
      s.events.push({ type: 'ttadak', player: p, month: m });
      capture(s, [hand, flipped, ...fl]);
      s.stealDue += 1;
      return finishTurn(ctx);
    }
  }

  // 2) 바닥 같은 월 3장 먹기 이벤트. 뻑이면 남 1 / 자뻑 2, 뻑이 아닌 3장이면 1장. 먹기보다 먼저 알린다
  for (const c of [hand, flipped]) {
    if (c && onFloor(c.month).length === 3) {
      const fromPpeok = s.ppeok[c.month] !== undefined;
      const self = fromPpeok && s.ppeok[c.month] === p;
      s.events.push({ type: 'ppeokEat', player: p, month: c.month, self, fromPpeok });
      s.stealDue += self ? 2 : 1;
    }
  }

  // 3) 기본 정산: 손패 -> 뒤집은 패 순서
  if (hand && resolveOne(s, hand, 'hand', flipped)) return;
  if (flipped && resolveOne(s, flipped, 'flip', null)) return;
  finishTurn(ctx);
}

/** 정산 마무리: 피 가져오기 -> 싹쓸이 -> (훅) -> 점수 판정 */
function finishTurn(ctx: Ctx) {
  const s = ctx.s;
  const p = s.turn;
  while (s.stealDue > 0) { s.stealDue -= 1; steal(s, p); }
  if (s.options.special.sweep && s.floor.length === 0) {
    s.events.push({ type: 'sweep', player: p });
    steal(s, p);
  }
  ctx.call('afterPlay');
  ctx.call('afterFlip');
  endTurn(ctx);
}

function canGoStop(s: GameState, p: PlayerId): boolean {
  const total = score(s.captured[p], s.options).total;
  return total >= s.options.winScore && total > s.lastGoScore[p];
}

function endTurn(ctx: Ctx) {
  ctx.call('beforeScore');
  const s = ctx.s;
  if (canGoStop(s, s.turn)) s.phase = 'goStop';
  else nextTurn(ctx);
}

function nextTurn(ctx: Ctx) {
  const s = ctx.s;
  if (handsLeft(s) === 0) return finish(s, null, 'exhaust');
  s.turn = (1 - s.turn) as PlayerId;
  s.phase = 'play';
  ctx.call('onTurnStart');
}

/** 판 종료. stopper가 있으면 그 사람이 승자, 없으면 패가 떨어진 정산. */
function finish(s: GameState, stopper: PlayerId | null, by: 'stop' | 'exhaust') {
  const sc = [score(s.captured[0], s.options).total, score(s.captured[1], s.options).total];
  let winner: PlayerId | null = stopper;
  if (winner === null) {
    const ok = [sc[0] >= s.options.winScore, sc[1] >= s.options.winScore];
    if (ok[0] && !ok[1]) winner = 0;
    else if (ok[1] && !ok[0]) winner = 1;
    else if (ok[0] && ok[1] && sc[0] !== sc[1]) winner = sc[0] > sc[1] ? 0 : 1;
  }
  let result: GameResult;
  if (winner === null) result = { type: 'nagari', nextCarry: Math.min(s.options.carry * 2, 4) }; // R12
  else result = settleWin(winner, s.captured, s.goCount[winner], s.shakes[winner], s.options, by);
  s.result = result;
  s.phase = 'ended';
  s.events.push({ type: 'end', result });
}

/** 카드 총합 (손패+바닥+더미+획득+처리 중인 카드). 항상 48이어야 한다. */
export function countCards(s: GameState): number {
  return s.hands[0].length + s.hands[1].length + s.floor.length + s.deck.length
    + s.captured[0].length + s.captured[1].length + (s.pending ? 1 : 0) + (s.pending?.later ? 1 : 0);
}
