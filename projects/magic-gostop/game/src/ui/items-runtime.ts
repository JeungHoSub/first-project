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
import { CH, B } from './balance';
export { CH };
const roll = (g: number, bonus = 0) => Math.random() * 100 < Math.min(100, CH[g] + bonus);

// ---------- 수치표 (items-data.ts 문구와 같은 값) ----------
const T = B; // 수치는 balance.ts 한곳에서 관리
export const ITEM_CAP = B.itemCap;
export const TALISMAN_CAP = B.talismanCap;
export const SHIELD_CAP = B.shieldCap;
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
export interface Side { slots: Slot[]; on: Record<string, boolean>; g: Record<string, number> }
export interface RunState {
  /** 상대(AI) 장착 아이템. AI는 자동·판 시작 아이템만 쓴다 */
  ai: Side;
  aiGumihoLeft: number;
  aiMirrorLeft: number;
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
// 플레이어별
const side = (p: PlayerId): Side | null => (!run ? null : p === ME ? { slots: run.slots, on: run.on, g: run.g } : run.ai);
const hasP = (p: PlayerId, id: string) => !!side(p)?.slots.some((x) => x.id === id);
const gP = (p: PlayerId, id: string) => side(p)?.g[id] ?? -1;
const onP = (p: PlayerId, id: string) => !!side(p)?.on[id];
/** 판 이벤트권은 누가 가져왔든 모두에게 적용. 둘 다 같은 것이면 높은 등급 하나만 */
const evOn = (id: string) => onP(ME, id) || onP(AI, id);
const evG = (id: string) => Math.max(onP(ME, id) ? gP(ME, id) : -1, onP(AI, id) ? gP(AI, id) : -1);
const nameOf = (id: string) => ITEMS.find((x) => x.id === id)!.name;

// ---------- AI 장착 ----------
/** AI가 쓸 수 있는 아이템: 눌러서 쓰는 주문·도구·꾸미기는 빼고, 자동·판 시작 아이템만 */
const AI_POOL = ['shield', 'double', 'mirror', 'goinsure', 'godori', 'dan', 'pibu', 'jjok', 'fang', 'haetae',
  'collector', 'turtle', 'gumiho', 'dokkaebi', 'samjogo', 'gwangday', 'pifest', 'quake', 'fullmoon', 'goday'];
/** 난이도별: 쉬움 1개(F~C) · 보통 2~3개(D~A) · 어려움 4개(B~SS) */
export function aiLoadout(level: 'easy' | 'normal' | 'hard', rng = Math.random): Slot[] {
  const n = level === 'easy' ? 1 : level === 'normal' ? 2 + Math.floor(rng() * 2) : 4;
  const [lo, hi] = level === 'easy' ? [0, 3] : level === 'normal' ? [2, 5] : [4, 7];
  const pool = [...AI_POOL].sort(() => rng() - 0.5);
  const ids: string[] = [];
  for (const id of pool) {
    if (ids.length >= n) break;
    const cat = catOf(id);
    if (ids.filter((x) => catOf(x) === cat).length >= EQUIP_LIMITS[cat]) continue;
    if (MULTIPLIER_IDS.includes(id) && ids.some((x) => MULTIPLIER_IDS.includes(x))) continue;
    ids.push(id);
  }
  return ids.map((id) => ({ id, g: lo + Math.floor(rng() * (hi - lo + 1)) }));
}

/** 판 만들기 전: 엔진 규칙 옵션에 들어갈 변화(쌍피 축제·땅울림·현무 거북)와 발동 판정 */
export function prepare(ids: string[], aiSlots: Slot[] = []): Partial<RuleOptions> {
  const slots: Slot[] = sanitize(ids).map((id) => ({ id, g: bestGrade(id) }));
  const g: Record<string, number> = {}; slots.forEach((x) => { g[x.id] = x.g; });
  run = { ai: { slots: aiSlots, on: {}, g: {} }, aiGumihoLeft: 0, aiMirrorLeft: 0, slots, on: {}, g, notes: [], fogHidden: new Set(), fogPeeked: new Set(), seerCards: [], gumihoLeft: 0, mirrorLeft: 0, twoflipLeft: 0, myTurns: 0, extraFlippedThisTurn: false, seen: 0 };
  const gourd = has('gourd') ? B.gourd[gOf('gourd')] : 0;
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
  // AI 아이템 발동 판정 (부적은 늘 켜짐)
  const ai = run.ai;
  for (const sl of aiSlots) { ai.g[sl.id] = sl.g; ai.on[sl.id] = catOf(sl.id) === 'talisman' || roll(sl.g); }
  if (evOn('pifest')) {
    if (evG('pifest') >= B.pifestBoost) opts.piBoost = true;
    if (evG('pifest') >= B.pifestBonus) opts.bonus = { two: 3, three: 1 };
  }
  if (evOn('quake')) opts.quakeFirst = T.quake[evG('quake')];
  if ((onP(ME, 'turtle') && gP(ME, 'turtle') >= B.turtlePibak) || (onP(AI, 'turtle') && gP(AI, 'turtle') >= B.turtlePibak)) {
    opts.pibakMax = [onP(ME, 'turtle') && gP(ME, 'turtle') >= B.turtlePibak ? 4 : 5, onP(AI, 'turtle') && gP(AI, 'turtle') >= B.turtlePibak ? 4 : 5];
  }
  run.gumihoLeft = isOn('gumiho') ? T.gumiho[gOf('gumiho')] : 0;
  run.mirrorLeft = isOn('mirror') ? T.mirrorCap[gOf('mirror')] : 0;
  run.aiGumihoLeft = onP(AI, 'gumiho') ? T.gumiho[gP(AI, 'gumiho')] : 0;
  run.aiMirrorLeft = onP(AI, 'mirror') ? T.mirrorCap[gP(AI, 'mirror')] : 0;
  run.twoflipLeft = isOn('twoflip') ? B.twoflipUses[gOf('twoflip')] : 0;
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
  // AI: 금강 방패·현무 거북·황금 배수·방망이 도깨비
  {
    let aiShield = 0; const ap: { noPibak?: boolean; noGwangbak?: boolean; double?: boolean } = {};
    if (onP(AI, 'shield')) { const g = gP(AI, 'shield'); aiShield += T.shield[g]; if (g >= B.shieldPibak) ap.noPibak = true; if (g >= B.shieldGwangbak) ap.noGwangbak = true; }
    if (onP(AI, 'turtle')) aiShield += T.turtle[gP(AI, 'turtle')];
    if (onP(AI, 'double')) ap.double = true;
    aiShield = Math.min(SHIELD_CAP, aiShield);
    if (aiShield || ap.noPibak || ap.noGwangbak || ap.double) s = setMagicState(s, AI, { shield: aiShield, ...ap });
    if (onP(AI, 'dokkaebi')) { const r = magicTake(s, AI, 'floor', T.dokkaebi[gP(AI, 'dokkaebi')]); s = r.state; if (r.taken.length) notes.push(`상대 방망이 도깨비 · 바닥 피 ${r.taken.length}장`); }
  }
  if (isOn('turtle')) notes.push(`현무 거북 · 피 지킴 ${T.turtle[gOf('turtle')]}회${gOf('turtle') >= B.turtlePibak ? ' · 피박 기준 4장' : ''}`);
  if (evOn('pifest')) {
    s = setGukjin(s, ME, 'pi'); s = setGukjin(s, AI, 'pi');
    notes.push(`쌍피 축제 · 국진은 쌍피${evG('pifest') >= B.pifestBoost ? ' · 쌍피=3피' : ''}${evG('pifest') >= B.pifestBonus ? ' · 보너스 패 +1' : ''}`);
  }
  if (evOn('quake')) notes.push(`땅울림 · 첫 흔들기·폭탄 ×${T.quake[evG('quake')]}`);
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
    if (isOn(id)) notes.push(`${nameOf(id)} 발동`);
  }
  for (const id of ['gwangday', 'fullmoon', 'goday']) if (!isOn(id) && onP(AI, id)) notes.push(`상대 이벤트권 ${nameOf(id)}`);
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
  const H = (id: string) => hasP(p, id);
  const G = (id: string) => gP(p, id);
  const O = (id: string) => onP(p, id);
  // 부적 (부적 합계 +6)
  {
    let tal = 0;
    if (H('godori')) {
      const gg = G('godori');
      const each = cnt((c) => c.tag === 'godori') * T.godoriEach[gg];
      const done = s.captured[p].filter((c) => c.tag === 'godori').length === 3 ? T.godoriDone[gg] : 0;
      tal += each + done;
    }
    if (H('dan')) {
      const tti = s.captured[p].filter((c) => c.kind === 'T');
      const n = (['hong', 'cheong', 'cho'] as const).filter((t) => tti.filter((c) => c.tag === t).length === 3).length;
      tal += Math.min(n * T.dan[G('dan')], T.danCap[G('dan')]);
    }
    if (H('pibu')) tal += Math.min(cnt((c) => ['D', 'B2', 'B3'].includes(c.kind)) * T.pibu[G('pibu')], T.pibuCap[G('pibu')]);
    if (H('jjok')) tal += Math.min((evCount('jjok') + evCount('ttadak')) * T.jjok[G('jjok')], T.jjokCap[G('jjok')]);
    if (H('fang')) tal += Math.min(s.goCount[p] * T.fang[G('fang')], T.fangCap[G('fang')]);
    const talItem = side(p)!.slots.find((x) => catOf(x.id) === 'talisman' && x.id !== 'haetae');
    if (talItem && tal > 0) add('talisman', ITEMS.find((x) => x.id === talItem.id)!.name, Math.min(tal, TALISMAN_CAP));
    // 정령
    if (O('collector')) add('collector', '달빛 수집가', Math.min(cnt((c) => c.kind === 'G') * T.spiritEach[G('collector')], T.spiritCap[G('collector')]));
    if (O('samjogo')) add('samjogo', '삼족오', Math.min(cnt((c) => c.kind === 'Y') * T.spiritEach[G('samjogo')], T.spiritCap[G('samjogo')]));
  }
  // 판 이벤트권 (모두에게)
  if (evOn('gwangday')) {
    const d = scoreOf(s, p).details.find((x) => x.key === 'gwang');
    if (d) add('gwangday', '광의 날', T.gwangday[evG('gwangday')] + (evG('gwangday') >= B.gwangdayBi && d.label.includes('비광') ? 1 : 0));
  }
  if (evOn('fullmoon')) add('fullmoon', '보름달 밤', Math.min(cnt((c) => c.month === 8) * T.moon[evG('fullmoon')], T.moonCap[evG('fullmoon')]));
  if (evOn('goday')) add('goday', '북소리의 날', Math.min(s.goCount[p], 3) * (evG('goday') >= B.godayStrong ? 2 : 1));
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
    if (e.type === 'go' && e.player === AI && run.aiGumihoLeft > 0) {
      const r = magicTake(s, AI, 'opp', 1);
      if (r.taken.length) { s = r.state; run.aiGumihoLeft--; notes.push({ text: '상대 구미호가 내 피를 홀려 갔습니다', cards: r.taken }); }
    }
    if (e.type === 'steal' && e.player === ME && e.from === AI && run.aiMirrorLeft > 0 && roll(gP(AI, 'mirror'))) {
      const r = magicTake(s, AI, 'opp', gP(AI, 'mirror') >= 9 ? 2 : 1);
      if (r.taken.length) { s = r.state; run.aiMirrorLeft--; notes.push({ text: '상대 거울 반사! 피를 되받아 갔습니다', cards: r.taken }); }
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
export function lossAfterGuard(lostScore: number, loserGoCount: number, loser: PlayerId = ME): { lost: number; saved: number; why: string[] } {
  if (!run || lostScore <= 0) return { lost: lostScore, saved: 0, why: [] };
  let cut = 0; const why: string[] = [];
  const pre = loser === ME ? '' : '상대 ';
  if (hasP(loser, 'haetae')) { const v = lostScore * T.haetae[gP(loser, 'haetae')] / 100; cut += v; why.push(`${pre}해태 부적 -${T.haetae[gP(loser, 'haetae')]}%`); }
  if (onP(loser, 'goinsure') && loserGoCount > 0) {
    const v = Math.min(loserGoCount * T.insureEach[gP(loser, 'goinsure')], T.insureCap[gP(loser, 'goinsure')]);
    cut += v; why.push(`${pre}고 보험 -${v}점`);
  }
  cut = Math.min(cut, lostScore * B.lossCutCap, lostScore - 1);
  cut = Math.max(0, Math.floor(cut));
  return { lost: lostScore - cut, saved: cut, why };
}
/** 복주머니: 봇전 아이템 획득 확률 보정(%p) */
export const dropBonus = () => (has('pouch') ? T.pouch[gOf('pouch')] : 0);
/** 호리병: 주문 발동 확률 보정(%p) */
export const spellBonus = () => (has('gourd') ? B.gourd[gOf('gourd')] : 0);
/** 호리병 SS 이상: 사용 횟수 1회인 주문 1장 +1 */
export const gourdExtraUse = () => has('gourd') && gOf('gourd') >= B.gourdExtraUse;
export const shieldBaseFor = (g: number) => T.shield[g];
export const lanternGrade = () => (has('lantern') ? gOf('lantern') : -1);
export const cosmetic = (id: string) => (has(id) ? gOf(id) : -1);
