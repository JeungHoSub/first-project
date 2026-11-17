// 귀속 아이템 실제 적용(판 진행용). 수치는 items-data.ts의 효과 문구와 같은 표를 쓴다.
// 중첩 규칙(outputs/items.md 3.2절) 요약:
//  - 주문 2장 · 부적 1 · 정령 1 · 이벤트권 1 · 도구 1 · 꾸미기 종류별 1 (같은 아이템은 1장)
//  - 배수 계열(황금 배수 · 땅울림)은 한 판에 하나만 → 장착 화면에서 막는다
//  - 아이템 가산 점수는 한 사람당 판당 +8 상한, 그중 부적 몫은 +6 상한. 고/스톱 기준(7점)에는 안 들어감
//  - 피 뺏김 막기(금강 방패 + 현무 거북)는 합쳐 6회까지
//  - 패배 감면(해태 부적 + 고 보험 우산)은 합쳐 50%까지, 최소 1점은 잃음
import type { Card, ExtraPoint, GameState, PlayerId, RuleOptions } from '../engine';
import { scoreOf, setItemPoints, magicTake, setMagicState, setGukjin } from '../engine';
import { ITEMS, bestGrade, CATEGORY_LABEL, EQUIP_LIMITS, type Category } from './collection';

export const ME: PlayerId = 0;
export const AI: PlayerId = 1;

/** 등급 순번(0=F…9=SSS+)별 발동 확률 */
export const CH = [40, 47, 53, 60, 67, 73, 80, 87, 93, 100];
const roll = (g: number, bonus = 0) => Math.random() * 100 < Math.min(100, CH[g] + bonus);

// ---------- 수치표 (items-data.ts 문구와 같은 값) ----------
const T = {
  godoriDone: [1, 1, 1.5, 1.5, 2, 2, 3, 3, 3.5, 4],
  godoriEach: [0.5, 0.75, 0.75, 1, 1, 1.25, 1.25, 1.5, 1.5, 1.5],
  dan: [1, 1, 1.5, 1.5, 2, 2, 2.5, 2.5, 3, 3.5], danCap: [2, 3, 3, 4, 4, 5, 5, 6, 6, 6],
  pibu: [0.5, 0.5, 0.75, 0.75, 1, 1, 1.25, 1.25, 1.5, 2], pibuCap: [1, 2, 2, 3, 3, 4, 4, 5, 5, 5],
  jjok: [1, 1, 1.5, 1.5, 2, 2, 2.5, 2.5, 3, 3.5], jjokCap: [2, 3, 3, 4, 4, 5, 5, 6, 6, 6],
  fang: [0.5, 0.5, 0.75, 0.75, 1, 1, 1.25, 1.25, 1.5, 2], fangCap: [1, 2, 2, 3, 3, 4, 4, 5, 5, 5],
  haetae: [10, 13, 17, 20, 23, 27, 30, 33, 37, 40],
  seer: [1, 1, 2, 2, 2, 3, 3, 3, 4, 4],
  twoflipFrom: [7, 6, 5, 4, 4, 3, 3, 2, 2, 1],
  spiritEach: [0.5, 0.5, 1, 1, 1, 1.5, 1.5, 1.5, 2, 2], spiritCap: [1, 1.5, 2, 2.5, 3, 3, 3.5, 4, 4.5, 5],
  turtle: [1, 1, 1, 1, 2, 2, 2, 2, 3, 3],
  gumiho: [1, 1, 1, 1, 2, 2, 2, 2, 3, 3],
  dokkaebi: [1, 1, 1, 1, 2, 2, 2, 2, 3, 3],
  gwangday: [1, 1, 1, 1, 1, 2, 2, 2, 3, 3],
  fog: [1, 1, 2, 2, 2, 3, 3, 3, 4, 4], fogPeek: [0, 0, 0, 1, 1, 1, 2, 2, 3, 3],
  quake: [3, 3, 3, 3, 3, 3.5, 3.5, 3.5, 4, 4],
  moon: [0.5, 0.5, 0.5, 1, 1, 1, 1, 1.5, 1.5, 1.5], moonCap: [1, 1, 1.5, 1.5, 2, 2, 2.5, 2.5, 3, 3],
  pouch: [2, 3, 5, 6, 8, 9, 11, 12, 14, 15],
  mirrorCap: [1, 1, 1, 1, 2, 2, 2, 2, 3, 3],
  insureEach: [0.5, 0.5, 1, 1, 1, 1.5, 1.5, 2, 2, 2.5], insureCap: [1, 2, 2, 3, 4, 4, 5, 5, 6, 6],
  shield: [1, 1, 2, 2, 2, 3, 3, 4, 4, 5],
};
export const ITEM_CAP = 8;
export const TALISMAN_CAP = 6;
export const SHIELD_CAP = 6;
export const MULTIPLIER_IDS = ['double', 'quake'];

// ---------- 장착(로드아웃) ----------
export interface Slot { id: string; g: number }
const KEY = 'mg-loadout-v1';
export const catOf = (id: string): Category => ITEMS.find((x) => x.id === id)!.category;

export function loadLoadout(): string[] {
  let ids: string[] = [];
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (Array.isArray(v)) ids = v;
    else { const old = JSON.parse(localStorage.getItem('mg-picked') || '[]'); if (Array.isArray(old)) ids = old; } // 예전 매직 카드 선택 이어받기
  } catch { /* 무시 */ }
  return sanitize(ids);
}
export function saveLoadout(ids: string[]) { try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* 무시 */ } }
/** 가진 것만, 분류별 한도 안에서, 배수 계열은 하나만 */
export function sanitize(ids: string[]): string[] {
  const out: string[] = [];
  for (const id of ids) {
    if (!ITEMS.some((x) => x.id === id) || bestGrade(id) < 0 || out.includes(id)) continue;
    const cat = catOf(id);
    if (out.filter((x) => catOf(x) === cat).length >= EQUIP_LIMITS[cat]) continue;
    if (MULTIPLIER_IDS.includes(id) && out.some((x) => MULTIPLIER_IDS.includes(x))) continue;
    out.push(id);
  }
  return out;
}
/** 장착 시도: 안 되면 이유 문자열 */
export function canAdd(ids: string[], id: string): string | null {
  const cat = catOf(id);
  if (ids.filter((x) => catOf(x) === cat).length >= EQUIP_LIMITS[cat]) return `${CATEGORY_LABEL[cat]}는 ${EQUIP_LIMITS[cat]}개까지`;
  if (MULTIPLIER_IDS.includes(id) && ids.some((x) => MULTIPLIER_IDS.includes(x))) return '배수 아이템(황금 배수·땅울림)은 하나만';
  return null;
}

// ---------- 판 하나의 아이템 상태 ----------
export interface RunState {
  slots: Slot[];
  /** 판 시작 때 발동 판정을 통과한 지속 효과 */
  on: Record<string, boolean>;
  g: Record<string, number>;
  notes: string[];
  /** 안개: 뒤집힌 바닥 패 / 그중 나만 미리 본 패 */
  fogHidden: Set<string>;
  fogPeeked: Set<string>;
  /** 점쟁이가 보여 줄 더미 위 패 */
  seerCards: string[];
  gumihoLeft: number;
  mirrorLeft: number;
  twoflipLeft: number;
  myTurns: number;
  extraFlippedThisTurn: boolean;
  /** 이미 처리한 이벤트 수 (거울 반사·구미호 중복 방지) */
  seen: number;
}
let run: RunState | null = null;
export const current = () => run;

const has = (id: string) => !!run && run.slots.some((x) => x.id === id);
const gOf = (id: string) => run?.g[id] ?? -1;
export const isOn = (id: string) => !!run?.on[id];

/** 판 만들기 전: 엔진 규칙 옵션에 들어갈 변화(쌍피 축제·땅울림·현무 거북)와 발동 판정 */
export function prepare(ids: string[]): Partial<RuleOptions> {
  const slots: Slot[] = sanitize(ids).map((id) => ({ id, g: bestGrade(id) }));
  const g: Record<string, number> = {}; slots.forEach((x) => { g[x.id] = x.g; });
  run = { slots, on: {}, g, notes: [], fogHidden: new Set(), fogPeeked: new Set(), seerCards: [], gumihoLeft: 0, mirrorLeft: 0, twoflipLeft: 0, myTurns: 0, extraFlippedThisTurn: false, seen: 0 };
  const gourd = has('gourd') ? (gOf('gourd') + 1) * 3 : 0;
  const opts: Partial<RuleOptions> = {};
  for (const sl of slots) {
    const it = ITEMS.find((x) => x.id === sl.id)!;
    // 부적·도구·꾸미기는 늘 켜짐. 정령·이벤트권·주문(지속형)은 발동 확률을 굴린다(호리병은 주문에만 보정)
    const always = it.category === 'talisman' || it.category === 'tool' || it.category === 'cosmetic';
    const bonus = it.category === 'spell' ? gourd : 0;
    const ok = always || roll(sl.g, bonus);
    run.on[sl.id] = ok;
    if (it.category === 'spirit' || it.category === 'event' || ['mirror', 'goinsure'].includes(sl.id)) {
      if (!ok) run.notes.push(`${it.name} 불발`);
    }
  }
  if (isOn('pifest')) {
    if (gOf('pifest') >= 4) opts.piBoost = true;
    if (gOf('pifest') >= 8) opts.bonus = { two: 3, three: 1 };
  }
  if (isOn('quake')) opts.quakeFirst = T.quake[gOf('quake')];
  if (isOn('turtle') && gOf('turtle') >= 6) opts.pibakMax = [4, 5];
  run.gumihoLeft = isOn('gumiho') ? T.gumiho[gOf('gumiho')] : 0;
  run.mirrorLeft = isOn('mirror') ? T.mirrorCap[gOf('mirror')] : 0;
  run.twoflipLeft = isOn('twoflip') ? (gOf('twoflip') >= 8 ? 2 : 1) : 0;
  return opts;
}

/** 판을 만든 직후: 판 시작 효과를 state에 반영 */
export function begin(state: GameState, magicShield: number, magicPatch: { noPibak?: boolean; noGwangbak?: boolean; double?: boolean }): GameState {
  let s = state;
  if (!run) return s;
  const notes = run.notes;
  // 피 뺏김 막기: 금강 방패 + 현무 거북 합산, 6회 상한
  let shield = magicShield;
  if (isOn('turtle')) shield += T.turtle[gOf('turtle')];
  shield = Math.min(SHIELD_CAP, shield);
  if (shield || magicPatch.noPibak || magicPatch.noGwangbak || magicPatch.double) s = setMagicState(s, ME, { shield, ...magicPatch });
  if (isOn('turtle')) notes.push(`현무 거북 · 피 지킴 ${T.turtle[gOf('turtle')]}회${gOf('turtle') >= 6 ? ' · 피박 기준 4장' : ''}`);
  if (isOn('pifest')) {
    s = setGukjin(s, ME, 'pi'); s = setGukjin(s, AI, 'pi');
    notes.push(`쌍피 축제 · 국진은 쌍피${gOf('pifest') >= 4 ? ' · 쌍피=3피' : ''}${gOf('pifest') >= 8 ? ' · 보너스 패 +1' : ''}`);
  }
  if (isOn('quake')) notes.push(`땅울림 · 첫 흔들기·폭탄 ×${T.quake[gOf('quake')]}`);
  if (isOn('dokkaebi')) {
    const r = magicTake(s, ME, 'floor', T.dokkaebi[gOf('dokkaebi')]);
    s = r.state;
    notes.push(r.taken.length ? `방망이 도깨비 · 바닥 피 ${r.taken.length}장 가져옴` : '방망이 도깨비 · 바닥에 피가 없음');
  }
  if (isOn('seer')) run.seerCards = s.deck.slice(0, T.seer[gOf('seer')]).map((c) => c.id);
  if (isOn('fog')) {
    const pool = [...s.floor].sort(() => Math.random() - 0.5).slice(0, T.fog[gOf('fog')]);
    pool.forEach((c) => run!.fogHidden.add(c.id));
    pool.slice(0, T.fogPeek[gOf('fog')]).forEach((c) => run!.fogPeeked.add(c.id));
    notes.push(`안개 · 바닥 패 ${pool.length}장이 가려짐${run.fogPeeked.size ? ` (나만 ${run.fogPeeked.size}장 봄)` : ''}`);
  }
  for (const id of ['gwangday', 'fullmoon', 'goday', 'collector', 'samjogo', 'gumiho', 'mirror', 'goinsure', 'twoflip']) {
    if (isOn(id)) notes.push(`${ITEMS.find((x) => x.id === id)!.name} 발동`);
  }
  run.seen = s.events.length;
  return recompute(s);
}

/** 카드 id → 카드 정보 (모든 카드가 들어 있는 맵을 화면이 넘긴다) */
let lookup: (id: string) => Card | undefined = () => undefined;
export function setLookup(f: (id: string) => Card | undefined) { lookup = f; }

const capturedBy = (s: GameState, p: PlayerId) => s.events.flatMap((e) =>
  (e.type === 'capture' && e.player === p) ? e.cards
    : (e.type === 'bonus' && e.player === p) ? [e.card] : []);

/** 지금 state에서 아이템 가산 점수를 처음부터 계산 (되돌리기에도 안전) */
function pointsFor(s: GameState, p: PlayerId): ExtraPoint[] {
  if (!run) return [];
  const out: ExtraPoint[] = [];
  const add = (key: string, label: string, pts: number) => { if (pts > 0) out.push({ key, label, points: Math.round(pts * 100) / 100 }); };
  const caps = capturedBy(s, p).map((id) => lookup(id)).filter((c): c is Card => !!c);
  const cnt = (f: (c: Card) => boolean) => caps.filter(f).length;
  const evCount = (t: string) => s.events.filter((e) => e.type === t && (e as { player?: PlayerId }).player === p).length;
  const mine = p === ME;
  // 부적 (내 것만, 부적 합계 +6)
  if (mine) {
    let tal = 0;
    if (has('godori')) {
      const gg = gOf('godori');
      const each = cnt((c) => c.tag === 'godori') * T.godoriEach[gg];
      const done = s.captured[p].filter((c) => c.tag === 'godori').length === 3 ? T.godoriDone[gg] : 0;
      tal += each + done;
    }
    if (has('dan')) {
      const tti = s.captured[p].filter((c) => c.kind === 'T');
      const n = (['hong', 'cheong', 'cho'] as const).filter((t) => tti.filter((c) => c.tag === t).length === 3).length;
      tal += Math.min(n * T.dan[gOf('dan')], T.danCap[gOf('dan')]);
    }
    if (has('pibu')) tal += Math.min(cnt((c) => ['D', 'B2', 'B3'].includes(c.kind)) * T.pibu[gOf('pibu')], T.pibuCap[gOf('pibu')]);
    if (has('jjok')) tal += Math.min((evCount('jjok') + evCount('ttadak')) * T.jjok[gOf('jjok')], T.jjokCap[gOf('jjok')]);
    if (has('fang')) tal += Math.min(s.goCount[p] * T.fang[gOf('fang')], T.fangCap[gOf('fang')]);
    const talItem = run.slots.find((x) => catOf(x.id) === 'talisman' && x.id !== 'haetae');
    if (talItem && tal > 0) add('talisman', ITEMS.find((x) => x.id === talItem.id)!.name, Math.min(tal, TALISMAN_CAP));
    // 정령
    if (isOn('collector')) add('collector', '달빛 수집가', Math.min(cnt((c) => c.kind === 'G') * T.spiritEach[gOf('collector')], T.spiritCap[gOf('collector')]));
    if (isOn('samjogo')) add('samjogo', '삼족오', Math.min(cnt((c) => c.kind === 'Y') * T.spiritEach[gOf('samjogo')], T.spiritCap[gOf('samjogo')]));
  }
  // 판 이벤트권 (모두에게)
  if (isOn('gwangday')) {
    const d = scoreOf(s, p).details.find((x) => x.key === 'gwang');
    if (d) add('gwangday', '광의 날', T.gwangday[gOf('gwangday')] + (gOf('gwangday') >= 7 && d.label.includes('비광') ? 1 : 0));
  }
  if (isOn('fullmoon')) add('fullmoon', '보름달 밤', Math.min(cnt((c) => c.month === 8) * T.moon[gOf('fullmoon')], T.moonCap[gOf('fullmoon')]));
  if (isOn('goday')) add('goday', '북소리의 날', Math.min(s.goCount[p], 3) * (gOf('goday') >= 5 ? 2 : 1));
  // 한 사람당 +8 상한
  let left = ITEM_CAP;
  return out.map((x) => { const v = Math.min(x.points, left); left -= v; return { ...x, points: v }; }).filter((x) => x.points > 0);
}

export function recompute(s: GameState): GameState {
  if (!run) return s;
  let t = setItemPoints(s, ME, pointsFor(s, ME));
  t = setItemPoints(t, AI, pointsFor(t, AI));
  return t;
}

export interface AfterNote { text: string; cards?: string[] }
/** 한 수가 끝난 뒤: 구미호·거울 반사 처리 + 점수 다시 계산 */
export function after(prev: GameState, next: GameState): { state: GameState; notes: AfterNote[] } {
  if (!run) return { state: next, notes: [] };
  const notes: AfterNote[] = [];
  let s = next;
  const evs = s.events.slice(Math.max(prev.events.length, run.seen));
  if (prev.turn === ME && prev.phase === 'play' && s.turn !== ME) { run.myTurns++; run.extraFlippedThisTurn = false; }
  // 구미호: 내가 고를 부를 때마다 상대 피 1장
  for (const e of evs) {
    if (e.type === 'go' && e.player === ME && run.gumihoLeft > 0) {
      const r = magicTake(s, ME, 'opp', 1);
      if (r.taken.length) { s = r.state; run.gumihoLeft--; notes.push({ text: '구미호가 피를 홀려 왔습니다', cards: r.taken }); }
    }
    // 거울 반사: 상대가 내 피를 실제로 가져가면 되받는다
    if (e.type === 'steal' && e.player === AI && e.from === ME && run.mirrorLeft > 0 && isOn('mirror')) {
      if (roll(gOf('mirror'))) {
        const r = magicTake(s, ME, 'opp', gOf('mirror') >= 9 ? 2 : 1);
        if (r.taken.length) { s = r.state; run.mirrorLeft--; notes.push({ text: '거울 반사! 피를 되받았습니다', cards: r.taken }); }
      }
    }
  }
  // 안개: 손이 닿은(먹거나 같은 월이 놓인) 패는 공개
  if (run.fogHidden.size) {
    const floorIds = new Set(s.floor.map((c) => c.id));
    for (const id of [...run.fogHidden]) {
      const c = lookup(id);
      const touched = !floorIds.has(id) || s.floor.some((f) => f.id !== id && c && f.month === c.month);
      if (touched) { run.fogHidden.delete(id); run.fogPeeked.delete(id); }
    }
  }
  run.seen = s.events.length;
  return { state: recompute(s), notes };
}

// ---------- 쌍둥이 그림자 ----------
export function canExtraFlip(s: GameState): boolean {
  return !!run && isOn('twoflip') && run.twoflipLeft > 0 && !run.extraFlippedThisTurn && s.turn === ME && s.phase === 'play'
    && s.deck.length > 0 && run.myTurns + 1 >= T.twoflipFrom[gOf('twoflip')];
}
export function markExtraFlip() { if (run) { run.twoflipLeft--; run.extraFlippedThisTurn = true; } }
export const twoflipInfo = () => (run ? { left: run.twoflipLeft, from: T.twoflipFrom[Math.max(0, gOf('twoflip'))], turn: run.myTurns + 1 } : null);

// ---------- 정산 보조 ----------
/** 내가 졌을 때 잃는 점수 감면 (해태 부적 + 고 보험 우산, 합쳐 50%까지, 최소 1점) */
export function lossAfterGuard(lostScore: number, myGoCount: number): { lost: number; saved: number; why: string[] } {
  if (!run || lostScore <= 0) return { lost: lostScore, saved: 0, why: [] };
  let cut = 0; const why: string[] = [];
  if (has('haetae')) { const v = lostScore * T.haetae[gOf('haetae')] / 100; cut += v; why.push(`해태 부적 -${T.haetae[gOf('haetae')]}%`); }
  if (isOn('goinsure') && myGoCount > 0) {
    const v = Math.min(myGoCount * T.insureEach[gOf('goinsure')], T.insureCap[gOf('goinsure')]);
    cut += v; why.push(`고 보험 -${v}점`);
  }
  cut = Math.min(cut, lostScore * 0.5, lostScore - 1);
  cut = Math.max(0, Math.floor(cut));
  return { lost: lostScore - cut, saved: cut, why };
}
/** 복주머니: 봇전 아이템 획득 확률 보정(%p) */
export const dropBonus = () => (has('pouch') ? T.pouch[gOf('pouch')] : 0);
/** 호리병: 주문 발동 확률 보정(%p) */
export const spellBonus = () => (has('gourd') ? (gOf('gourd') + 1) * 3 : 0);
/** 호리병 SS 이상: 사용 횟수 1회인 주문 1장 +1 */
export const gourdExtraUse = () => has('gourd') && gOf('gourd') >= 7;
export const shieldBaseFor = (g: number) => T.shield[g];
export const lanternGrade = () => (has('lantern') ? gOf('lantern') : -1);
export const cosmetic = (id: string) => (has(id) ? gOf(id) : -1);
