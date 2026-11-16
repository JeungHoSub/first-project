import { ALL_CARDS } from './cards';
import { shuffle } from './rng';
import { score, settle } from './score';
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
  };
  const deck = shuffle(ALL_CARDS, seed).map((c) => ({ ...c }));
  const hands: [Card[], Card[]] = [deck.splice(0, HAND), deck.splice(0, HAND)];
  const floor = deck.splice(0, FLOOR);
  return {
    seed: String(seed),
    options: opts,
    phase: 'play',
    turn: opts.dealer,
    hands,
    floor,
    deck, // 나머지 20장
    captured: [[], []],
    pending: null,
    goCount: [0, 0],
    lastGoScore: [0, 0],
    shakes: [0, 0],
    dummies: [0, 0],
    events: [{ type: 'deal', seed: String(seed) }],
    result: null,
  };
}

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
      if (action.shake) {
        s.shakes[p] += 1;
        const shown = [card, ...s.hands[p].filter((c) => c.month === card.month)];
        s.events.push({ type: 'shake', player: p, month: card.month, cards: shown.map((c) => c.id) });
      }
      s.events.push({ type: 'play', player: p, card: card.id });
      resolveCard(s, card, 'hand');
      if (s.phase !== 'chooseMatch') { call('afterPlay'); flip(ctx); }
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
      call('afterPlay');
      flip(ctx);
      break;
    }
    case 'dummy': {
      const p = s.turn;
      s.dummies[p] -= 1;
      s.events.push({ type: 'dummy', player: p });
      call('afterPlay');
      flip(ctx);
      break;
    }
    case 'choose': {
      const pend = s.pending!;
      const target = s.floor.find((c) => c.id === action.cardId)!;
      s.events.push({ type: 'choose', player: s.turn, card: target.id });
      s.pending = null;
      s.phase = 'play';
      capture(s, [pend.card, target]);
      if (pend.source === 'hand') { call('afterPlay'); flip(ctx); }
      else { call('afterFlip'); endTurn(ctx); }
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
  s.captured[s.turn].push(...cards);
  s.events.push({ type: 'capture', player: s.turn, cards: cards.map((c) => c.id) });
}

/** 상대 획득 패에서 피 1장 가져오기 (일반 피 우선, 없으면 쌍피, 없으면 없음) */
function steal(s: GameState, p: PlayerId) {
  const from = (1 - p) as PlayerId;
  const src = s.captured[from];
  let i = src.findIndex((c) => c.kind === 'P');
  if (i < 0) i = src.findIndex((c) => c.kind === 'D');
  if (i < 0) return;
  const [card] = src.splice(i, 1);
  s.captured[p].push(card);
  s.events.push({ type: 'steal', player: p, from, card: card.id });
}

/**
 * 손패/뒤집은 패 1장의 매칭 정산 (1단계: 기본 매칭만).
 * 0장 내려놓기 / 1장 먹기 / 2장 선택 대기 / 3장 모두 먹기.
 * 손패와 뒤집은 패가 같은 월이어도 "순서대로 단순 처리"한다. (뻑·따닥·쪽은 3단계)
 */
function resolveCard(s: GameState, card: Card, source: 'hand' | 'flip') {
  const matches = s.floor.filter((c) => c.month === card.month);
  if (matches.length === 0) {
    s.floor.push(card);
    s.events.push({ type: 'place', player: s.turn, card: card.id });
  } else if (matches.length === 2) {
    s.pending = { source, card, options: matches.map((c) => c.id) };
    s.phase = 'chooseMatch';
  } else {
    // 1장 또는 3장(이상): 전부 먹는다
    capture(s, [card, ...matches]);
  }
}

function flip(ctx: Ctx) {
  const s = ctx.s;
  if (s.deck.length === 0) return endTurn(ctx);
  const card = s.deck.shift()!;
  s.events.push({ type: 'flip', player: s.turn, card: card.id });
  resolveCard(s, card, 'flip');
  if (s.phase !== 'chooseMatch') { ctx.call('afterFlip'); endTurn(ctx); }
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
  if (winner === null) result = { type: 'nagari' }; // 배수 이월 등은 3단계
  else result = { type: 'win', winner, base: sc[winner], goCount: s.goCount[winner], by, ...settle(sc[winner], s.goCount[winner], s.options, s.shakes[winner]) };
  s.result = result;
  s.phase = 'ended';
  s.events.push({ type: 'end', result });
}

/** 카드 총합 (손패+바닥+더미+획득+처리 중인 카드). 항상 48이어야 한다. */
export function countCards(s: GameState): number {
  return s.hands[0].length + s.hands[1].length + s.floor.length + s.deck.length
    + s.captured[0].length + s.captured[1].length + (s.pending ? 1 : 0);
}
