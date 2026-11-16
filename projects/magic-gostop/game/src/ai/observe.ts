// AI가 볼 수 있는 "공개 정보"만 담은 뷰. AI 판단(보통·어려움)은 전부 이 뷰만 쓴다.
// 상대 손패·더미는 내용 없이 "미지 카드 집합(unseen)"과 장수만 들어 있다.
import { ALL_CARDS, buildBonusCards } from '../engine';
import type { Card, GameEvent, GameState, PlayerId, RuleOptions } from '../engine';

export interface View {
  me: PlayerId;
  opp: PlayerId;
  options: RuleOptions;
  phase: GameState['phase'];
  turn: PlayerId;
  /** 내 손패 (내 것이니 내용을 안다) */
  hand: Card[];
  floor: Card[];
  captured: { me: Card[]; opp: Card[] };
  /** 상대 손패 장수 (빈 패 제외) */
  oppHandCount: number;
  deckCount: number;
  /** 내가 아직 못 본 카드 = 상대 손패 + 더미. 내용이 어디 있는지는 모른다 */
  unseen: Card[];
  /** 흔들기·폭탄으로 공개된 상대 카드 중 아직 상대 손에 있을 수 있는 것 (unseen의 부분집합) */
  oppKnown: Card[];
  goCount: { me: number; opp: number };
  lastGoScore: { me: number; opp: number };
  shakes: { me: number; opp: number };
  dummies: { me: number; opp: number };
  ppeok: Record<number, PlayerId>;
  stealDue: number;
  pending: { source: 'hand' | 'flip'; card: Card; options: string[]; later: Card | null } | null;
  /** 공개 이벤트 로그 (시드와 상대가 더미에서 가져온 카드 id는 지움) */
  events: GameEvent[];
}

const universeCache = new Map<string, readonly Card[]>();
function universe(o: RuleOptions): readonly Card[] {
  const key = `${o.bonus.two},${o.bonus.three}`;
  let u = universeCache.get(key);
  if (!u) {
    u = [...ALL_CARDS, ...buildBonusCards(o.bonus.two, o.bonus.three)];
    universeCache.set(key, u);
  }
  return u;
}

/** 공개 이벤트만 남긴다: deal의 seed(덱 순서를 알려줌)와 상대의 draw 카드(손으로 들어간 비공개 패)는 가린다. */
function publicEvents(events: GameEvent[], me: PlayerId): GameEvent[] {
  return events.map((e): GameEvent => {
    if (e.type === 'deal') return { type: 'deal', seed: '' };
    if (e.type === 'draw' && e.player !== me) return { type: 'draw', player: e.player, card: '' };
    return e;
  });
}

/** `me` 시점에서 보이는 정보만 뽑는다. state의 상대 손패·더미 내용은 여기서 끝난다. */
export function observe(s: GameState, me: PlayerId = s.turn, withEvents = true): View {
  const opp = (1 - me) as PlayerId;
  const known = new Set<string>();
  const mark = (cs: readonly Card[]) => { for (const c of cs) known.add(c.id); };
  mark(s.hands[me]); mark(s.floor); mark(s.captured[0]); mark(s.captured[1]);
  if (s.pending) { known.add(s.pending.card.id); if (s.pending.later) known.add(s.pending.later.id); }
  const unseen = universe(s.options).filter((c) => !known.has(c.id));

  const events = withEvents ? publicEvents(s.events, me) : [];
  // 상대가 흔들기·폭탄으로 보여 준 카드 중 아직 안 나온 것
  const oppKnown: Card[] = [];
  if (withEvents) {
    const unseenIds = new Map(unseen.map((c) => [c.id, c]));
    for (const e of events) {
      if ((e.type === 'shake' || e.type === 'bomb') && e.player === opp) {
        for (const id of e.cards) {
          const c = unseenIds.get(id);
          if (c) { oppKnown.push(c); unseenIds.delete(id); }
        }
      }
    }
  }
  return {
    me, opp, options: s.options, phase: s.phase, turn: s.turn,
    hand: s.hands[me], floor: s.floor,
    captured: { me: s.captured[me], opp: s.captured[opp] },
    oppHandCount: s.hands[opp].length, // 장수만
    deckCount: s.deck.length, // 장수만
    unseen, oppKnown,
    goCount: { me: s.goCount[me], opp: s.goCount[opp] },
    lastGoScore: { me: s.lastGoScore[me], opp: s.lastGoScore[opp] },
    shakes: { me: s.shakes[me], opp: s.shakes[opp] },
    dummies: { me: s.dummies[me], opp: s.dummies[opp] },
    ppeok: s.ppeok, stealDue: s.stealDue, pending: s.pending, events,
  };
}

/** 표본 하나: 미지 카드를 무작위로 섞어 상대 손패(공개된 카드 우선)와 더미에 배정한 완전한 상태. 뷰만으로 만든다. */
export function determinize(v: View, rng: () => number): GameState {
  const pool = v.unseen.filter((c) => !v.oppKnown.includes(c));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const oppHand = [...v.oppKnown, ...pool].slice(0, v.oppHandCount);
  const deck = [...v.oppKnown, ...pool].slice(v.oppHandCount);
  // 공개된 카드가 손패보다 많으면(이론상 불가) 남는 것은 더미로 간다
  const hands: [Card[], Card[]] = v.me === 0 ? [v.hand.slice(), oppHand] : [oppHand, v.hand.slice()];
  const captured: [Card[], Card[]] = v.me === 0 ? [v.captured.me.slice(), v.captured.opp.slice()] : [v.captured.opp.slice(), v.captured.me.slice()];
  const pair = <T,>(me: T, opp: T): [T, T] => (v.me === 0 ? [me, opp] : [opp, me]);
  return {
    seed: 'ai-sample', options: v.options, phase: v.phase, turn: v.turn,
    hands, floor: v.floor.slice(), deck, ppeok: { ...v.ppeok }, stealDue: v.stealDue,
    captured, pending: v.pending, goCount: pair(v.goCount.me, v.goCount.opp),
    lastGoScore: pair(v.lastGoScore.me, v.lastGoScore.opp), shakes: pair(v.shakes.me, v.shakes.opp),
    dummies: pair(v.dummies.me, v.dummies.opp), events: [], result: null,
  };
}
