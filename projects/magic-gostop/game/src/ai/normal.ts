// 보통 AI: 휴리스틱. 판단은 전부 observe()가 만든 View만 쓴다(상대 손패·더미 내용은 모른다).
import { PI_VALUE, getLegalActions, judgeBak, score, settle } from '../engine';
import type { Action, Card, GameState } from '../engine';
import { observe, type View } from './observe';

// ---------- 족보 진행도 ----------
interface Tally { g: number; godori: number; hong: number; cheong: number; cho: number; yeol: number; tti: number; pi: number }

function tally(cs: readonly Card[], extra?: Card): Tally {
  const t: Tally = { g: 0, godori: 0, hong: 0, cheong: 0, cho: 0, yeol: 0, tti: 0, pi: 0 };
  const add = (c: Card) => {
    if (c.kind === 'G') t.g++;
    else if (c.kind === 'Y') { t.yeol++; if (c.tag === 'godori') t.godori++; }
    else if (c.kind === 'T') { t.tti++; if (c.tag === 'hong') t.hong++; else if (c.tag === 'cheong') t.cheong++; else if (c.tag === 'cho') t.cho++; }
    else t.pi += PI_VALUE[c.kind] ?? 0;
  };
  for (const c of cs) add(c);
  if (extra) add(extra);
  return t;
}

/** 부분 진행: 세트가 끝까지 갈 수 있을 때(상대가 막지 않았을 때)만 완성 점수의 일부를 쳐 준다 */
const partial = (have: number, need: number, pts: number, open: boolean) => (open && have < need ? pts * TUNE.part * (have / need) ** 2 : 0);

/** 내 획득 패 t의 "점수 환산 가치". o는 상대(막혔는지 판단용) */
function potential(t: Tally, o: Tally): number {
  let v = 0;
  // 광
  if (t.g >= 5) v += 15; else if (t.g === 4) v += 4 + (o.g === 0 ? 2 : 0); else if (t.g === 3) v += 3 + (o.g <= 1 ? 0.6 : 0);
  else v += partial(t.g, 3, 3, 5 - o.g >= 3);
  // 고도리, 홍·청·초단
  v += t.godori >= 3 ? 5 : partial(t.godori, 3, 5, o.godori === 0);
  v += t.hong >= 3 ? 3 : partial(t.hong, 3, 3, o.hong === 0);
  v += t.cheong >= 3 ? 3 : partial(t.cheong, 3, 3, o.cheong === 0);
  v += t.cho >= 3 ? 3 : partial(t.cho, 3, 3, o.cho === 0);
  // 열끗 5장, 띠 5장
  v += t.yeol >= 5 ? t.yeol - 4 + (t.yeol >= 7 ? 1.5 : 0) : partial(t.yeol, 5, 2.2, 9 - o.yeol >= 5);
  v += t.tti >= 5 ? t.tti - 4 : partial(t.tti, 5, 2.2, 10 - o.tti >= 5);
  // 피 10장
  v += t.pi >= 10 ? t.pi - 9 + TUNE.pi : TUNE.pi * (t.pi / 10) ** 2;
  return v;
}

const BASE: Record<string, number> = { G: 0.5, Y: 0.35, T: 0.35, P: 0.1, D: 0.2, B2: 0.2, B3: 0.3 };

/** 이 카드를 얻으면 갖는 가치 */
function gainOf(c: Card, mine: Tally, other: Tally): number {
  return potential(addCard(mine, c), other) - potential(mine, other) + (BASE[c.kind] ?? 0) * TUNE.base;
}
function addCard(t: Tally, c: Card): Tally {
  const n = { ...t };
  if (c.kind === 'G') n.g++;
  else if (c.kind === 'Y') { n.yeol++; if (c.tag === 'godori') n.godori++; }
  else if (c.kind === 'T') { n.tti++; if (c.tag === 'hong') n.hong++; else if (c.tag === 'cheong') n.cheong++; else if (c.tag === 'cho') n.cho++; }
  else n.pi += PI_VALUE[c.kind] ?? 0;
  return n;
}

// ---------- 확률 (미지 카드 기준) ----------
interface Ctx { v: View; mine: Tally; opp: Tally; unseenByMonth: number[]; U: number; knownOpp: Set<number> }

function makeCtx(v: View): Ctx {
  const unseenByMonth = new Array(14).fill(0);
  for (const c of v.unseen) unseenByMonth[c.month]++;
  const knownOpp = new Set(v.oppKnown.map((c) => c.month));
  return { v, mine: tally(v.captured.me), opp: tally(v.captured.opp), unseenByMonth, U: v.unseen.length, knownOpp };
}
/** 상대 손에 그 월 카드가 하나라도 있을 확률 */
function pOppHas(x: Ctx, month: number): number {
  if (x.knownOpp.has(month)) return 1;
  const u = x.unseenByMonth[month];
  if (u <= 0 || x.U <= 0) return 0;
  const h = Math.min(1, x.v.oppHandCount / x.U);
  return 1 - (1 - h) ** u;
}
/** 더미 맨 위(뒤집을 패)가 그 월일 확률 */
const pFlip = (x: Ctx, month: number) => (x.U > 0 ? x.unseenByMonth[month] / x.U : 0);

/** 튜닝값 (대전 측정으로 정함) */
export const TUNE = { deny: 1.5, goBias: 1.5, alwaysStop: false, base: 1, pi: 5, part: 0.8, ppeok: 5, safe: 0.05 };

// ---------- 행동 평가 ----------
function evalPlay(x: Ctx, c: Card, shake: boolean): number {
  const v = x.v;
  const m = c.month;
  const matches = v.floor.filter((f) => f.month === m);
  const u = x.unseenByMonth[m];
  const hMonth = v.hand.filter((h) => h.month === m).length;
  const mg = (k: Card) => gainOf(k, x.mine, x.opp);
  const og = (k: Card) => gainOf(k, x.opp, x.mine);
  const pO = pOppHas(x, m);
  const pF = pFlip(x, m);
  let val: number;
  if (matches.length === 0) {
    val = -(pO * (og(c) + 0.7 * mg(c)) + (1 - pO) * 0.15 * mg(c));
    val += pF * (2 * mg(c) + 1.2); // 쪽
    if (hMonth >= 2 && u === 0) val -= TUNE.safe; // 안전 패(같은 월 2장 + 나머지 다 나옴): 급하지 않으니 뒤로 미룬다
  } else if (matches.length === 1) {
    const f = matches[0];
    val = mg(c) + mg(f) + TUNE.deny * og(f) * pO;
    if (hMonth === 1 && u >= 1) { // 뻑 위험: 내가 나머지를 못 가지고 있다
      const oppEat = u >= 2 ? pOppHas({ ...x, unseenByMonth: x.unseenByMonth.map((n, i) => (i === m ? n - 1 : n)) }, m) : 0;
      val = (1 - pF) * val - pF * (1 + TUNE.ppeok * oppEat);
    }
  } else if (matches.length === 2) {
    const g0 = mg(matches[0]) + TUNE.deny * og(matches[0]) * pO;
    const g1 = mg(matches[1]) + TUNE.deny * og(matches[1]) * pO;
    val = mg(c) + Math.max(g0, g1) - TUNE.deny * og(g0 >= g1 ? matches[1] : matches[0]) * pO;
    val += pF * (mg(c) + 1.2); // 따닥
  } else {
    val = mg(c) + matches.reduce((n, f) => n + mg(f), 0) + (v.ppeok[m] === v.me ? 3 : 1.5) + 1;
  }
  if (shake) val += 1.5;
  return val;
}

/** 합법 행동마다 점수를 매겨 높은 순으로 돌려준다. 어려움이 후보를 고를 때도 쓴다. */
export function rankActions(v: View, legal: Action[]): { a: Action; v: number }[] {
  const x = makeCtx(v);
  const out: { a: Action; v: number }[] = [];
  if (v.phase === 'goStop') {
    const go = legal.find((a) => a.type === 'go');
    const stop = legal.find((a) => a.type === 'stop')!;
    const d = goStopMargin(v);
    if (go) out.push({ a: go, v: d });
    out.push({ a: stop, v: 0 });
  } else if (v.phase === 'chooseMatch') {
    for (const a of legal) {
      if (a.type !== 'choose') continue;
      const f = v.floor.find((c) => c.id === a.cardId)!;
      out.push({ a, v: gainOf(f, x.mine, x.opp) + TUNE.deny * gainOf(f, x.opp, x.mine) });
    }
  } else {
    const byId = new Map(v.hand.map((c) => [c.id, c]));
    for (const a of legal) {
      if (a.type === 'play') {
        const c = byId.get(a.cardId)!;
        out.push({ a, v: c.month === 13 ? 100 : evalPlay(x, c, !!a.shake) });
      } else if (a.type === 'bomb') {
        const three = v.hand.filter((c) => c.month === a.month);
        const f = v.floor.filter((c) => c.month === a.month);
        out.push({ a, v: 20 + [...three, ...f].reduce((n, c) => n + gainOf(c, x.mine, x.opp), 0) });
      } else if (a.type === 'dummy') {
        out.push({ a, v: v.hand.length === 0 ? 50 : -0.2 });
      }
    }
  }
  return out.sort((p, q) => q.v - p.v);
}

// ---------- 고/스톱 ----------
/** (고의 기대 점수차) - (스톱의 점수). 양수면 고 */
export function goStopMargin(v: View): number {
  const me = v.captured.me;
  const opp = v.captured.opp;
  const r = v.hand.length + v.dummies.me; // 내 남은 차례
  const oppTurns = v.oppHandCount + v.dummies.opp;
  if (r === 0 || TUNE.alwaysStop) return -1;
  const sc = score(me, v.options);
  const bakNow = judgeBak(sc, me, opp, v.options);
  const stopVal = settle(sc.total, v.goCount.me, v.options, v.shakes.me, bakNow.bakMultiplier, v.options.carry).finalScore;
  // 고하면 앞으로 평균적으로 더 얻을 점수
  const extra = 0.35 * Math.min(r, 6);
  const nextGo = v.goCount.me + 1;
  const goVal = settle(sc.total + extra, nextGo, v.options, v.shakes.me, bakNow.bakMultiplier, v.options.carry).finalScore;
  // 상대가 먼저 7점을 넘겨 스톱할 위험
  const to = tally(opp), tm = tally(me);
  const so = score(opp, v.options).total;
  const eff = Math.max(so, potential(to, tm) * 0.85);
  const dist = v.options.winScore - eff;
  const pReach = dist <= 0 ? 0.8 : dist <= 1 ? 0.5 : dist <= 2 ? 0.35 : dist <= 3 ? 0.22 : dist <= 4 ? 0.12 : 0.05;
  const pLose = Math.min(0.9, pReach * Math.min(1, 0.25 + oppTurns / 4) * (0.6 + 0.1 * Math.min(r, 6)));
  const myPi = tm.pi, oppPi = to.pi;
  const bakRisk = (myPi >= 1 && myPi <= 5 && oppPi >= 7 ? 2 : 1) * (tm.g === 0 && to.g >= 2 ? 2 : 1);
  const oppFinal = Math.max(v.options.winScore, so + 2) * bakRisk * 2 ** v.shakes.opp * v.options.carry;
  const ev = (1 - pLose) * goVal - pLose * oppFinal;
  return ev - stopVal + TUNE.goBias;
}

/** 보통 AI: 뷰에서 가장 높은 점수의 행동. 항상 legal 중 하나. */
export function chooseNormalFromView(v: View, legal: Action[]): Action {
  const ranked = rankActions(v, legal);
  return ranked.length ? ranked[0].a : legal[0];
}

/** 첫 판(튜토리얼) 봇: 일부러 가장 나쁜 수. 고/스톱에선 고(판을 더 끌다 놓치게) */
export function chooseGentle(s: GameState): Action {
  const legal = getLegalActions(s);
  if (s.phase === 'goStop') return legal.find((a) => a.type === 'go') ?? legal[0];
  const ranked = rankActions(observe(s, s.turn, false), legal);
  return ranked.length ? ranked[ranked.length - 1].a : legal[0];
}

export function chooseNormal(s: GameState): Action {
  const legal = getLegalActions(s);
  return chooseNormalFromView(observe(s, s.turn, false), legal);
}

/** 정적 평가: 족보 진행도 기준 (내 가치 - 상대 가치). 어려움의 짧은 플레이아웃 끝에서 쓴다. */
export function staticEval(me: readonly Card[], opp: readonly Card[]): number {
  const tm = tally(me), to = tally(opp);
  return potential(tm, to) - potential(to, tm);
}
