// 아이템 수집(테스트용). 아이템은 1회성 소모품이 아니라 모으는 수집품이고, 항목마다 등급 F ~ SSS+가 있다.
// 정식 버전: 뽑기권·사용자 대전에서 획득(서버 저장). 지금: 봇전 결과에 따라 일정 확률로 획득, 이 기기 브라우저에만 저장.
// 확률은 도감 화면에 그대로 공개한다(확률형 아이템 확률 공개 원칙). 효과는 아직 판에 적용하지 않는다(설명만).
// 항목 출처: outputs/rules.md 9절 후보(A 매직 카드, B 캐릭터, C 판 이벤트) + brief의 "점수 2배".

import { CH, B } from './balance';
import { EFFECT } from './item-copy';
import { ITEM_SPECS, TICKETS as TICKET_SPECS, EQUIP_LIMITS, CATEGORY_LABEL, type Category } from './items-data';
export { CATEGORY_LABEL, EQUIP_LIMITS, type Category };

export const GRADES = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS', 'SSS+'] as const;
export type Grade = (typeof GRADES)[number];
/** 등급별 확률(%) — 합 100. 도감에 그대로 공개 */
export const GRADE_RATE: Record<Grade, number> = { F: 30, E: 22, D: 16, C: 11, B: 8, A: 6, S: 4, SS: 2, SSS: 0.8, 'SSS+': 0.2 };
export const GRADE_COLOR: Record<Grade, string> = {
  F: '#8d958f', E: '#9fb39a', D: '#6fbf73', C: '#4fb4ff', B: '#5d7cff', A: '#b678e8', S: '#f0c35a', SS: '#ff9d3a', SSS: '#ff5a5f', 'SSS+': 'rainbow',
};

export interface ItemDef {
  id: string; name: string; category: Category; icon: string; hue: string; weight: number;
  /** 등급 순번(0=F … 9=SSS+)에 따른 효과 설명 */
  effect: (g: number) => string;
  /** 중첩 규칙 한 줄 */
  stack?: string;
}
const pick = <T,>(arr: readonly T[], g: number) => arr[Math.min(arr.length - 1, Math.floor((g / 9) * (arr.length - 1) + 1e-9))];
const pct = (g: number, lo: number, hi: number) => Math.round(lo + ((hi - lo) * g) / 9);
/** 모든 아이템 공통: 등급이 오를수록 발동 확률 40% → 100% */
const chance = (g: number) => ` · 발동 ${pct(g, 40, 100)}%`;

/** 귀속 아이템 35종 (데이터·중첩 규칙은 items-data.ts, 설계 근거는 outputs/items.md) */
export const ITEMS: ItemDef[] = ITEM_SPECS.map((sp) => ({
  id: sp.id, name: sp.name, category: sp.category, icon: sp.icon, hue: sp.hue, weight: sp.weight, stack: sp.stack,
  effect: (g: number) => (EFFECT[sp.id] ?? ((x: number) => sp.effects[x]))(Math.max(0, Math.min(9, g))),
}));

/** 판 결과별 아이템 획득 확률(%) — 난이도가 높을수록 조금 더 */
export const DROP_RATE = {
  win: { easy: 30, normal: 40, hard: 50 },
  lose: { easy: 10, normal: 15, hard: 20 },
  nagari: { easy: 10, normal: 10, hard: 10 },
} as const;

/** 보유: 항목별로 등급마다 몇 장 */
type Store = Record<string, Partial<Record<Grade, number>>>;
const KEY = 'mg-items-v2';
function load(): Store {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') as Store; } catch { return {}; }
}
function save(s: Store) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* 저장 불가 환경이면 이번 화면에서만 유지 */ }
}
let mem: Store = load();

export function ownedOf(id: string) { return mem[id] ?? {}; }
export function bestGrade(id: string): number {
  const o = ownedOf(id);
  for (let i = GRADES.length - 1; i >= 0; i--) if ((o[GRADES[i]] ?? 0) > 0) return i;
  return -1;
}
export function ownedKinds() { return ITEMS.filter((it) => bestGrade(it.id) >= 0).length; }

export interface Drop { item: ItemDef; grade: Grade; gi: number; isNewBest: boolean }

/** 판이 끝났을 때 한 번 굴린다. 얻으면 항목·등급을 돌려준다. */
export function rollDrop(outcome: 'win' | 'lose' | 'nagari', level: 'easy' | 'normal' | 'hard', rng = Math.random, bonusPct = 0): Drop | null {
  if (rng() * 100 >= DROP_RATE[outcome][level] + bonusPct) return null; // 복주머니 보정(봇전 획득만, 뽑기권과 무관)
  const total = ITEMS.reduce((a, m) => a + m.weight, 0);
  let r = rng() * total;
  const item = ITEMS.find((m) => (r -= m.weight) < 0) ?? ITEMS[0];
  let g = rng() * 100;
  let gi = 0;
  for (; gi < GRADES.length - 1; gi++) { g -= GRADE_RATE[GRADES[gi]]; if (g < 0) break; }
  const grade = GRADES[gi];
  const isNewBest = gi > bestGrade(item.id);
  mem = { ...mem, [item.id]: { ...ownedOf(item.id), [grade]: (ownedOf(item.id)[grade] ?? 0) + 1 } };
  save(mem);
  return { item, grade, gi, isNewBest };
}

// ---------- 아이템 그림 (40:62, 밤하늘 바탕 + 등급색 테두리) ----------
const ICON: Record<string, string> = {
  eye: '<path d="M-20 0 C-10 -13 10 -13 20 0 C10 13 -10 13 -20 0 Z" fill="#fff" stroke="#111" stroke-width="2"/><circle r="7" fill="HUE" stroke="#111" stroke-width="2"/><circle r="3" fill="#111"/><circle cx="2" cy="-2" r="1.3" fill="#fff"/>',
  broom: '<path d="M-14 -22 L6 4" stroke="#7a4a22" stroke-width="5" stroke-linecap="round"/><path d="M2 0 L18 16 C12 24 2 26 -6 20 C0 16 0 8 2 0 Z" fill="HUE" stroke="#111" stroke-width="2" stroke-linejoin="round"/><path d="M4 8 L12 18 M0 12 L6 20" stroke="#111" stroke-width="1.2"/>',
  swap: '<path d="M-18 -8 H10 L4 -15 M10 -8 L4 -1" fill="none" stroke="HUE" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 8 H-10 L-4 1 M-10 8 L-4 15" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>',
  shield: '<path d="M0 -22 L18 -15 C18 4 12 16 0 23 C-12 16 -18 4 -18 -15 Z" fill="HUE" stroke="#111" stroke-width="2.2" stroke-linejoin="round"/><path d="M0 -14 L10 -10 C10 2 6 9 0 14 C-6 9 -10 2 -10 -10 Z" fill="#fff" opacity=".35"/>',
  undo: '<path d="M-12 -4 C-8 -18 14 -18 16 0 C17 14 2 20 -8 14" fill="none" stroke="HUE" stroke-width="5" stroke-linecap="round"/><path d="M-20 -12 L-10 0 L-4 -14 Z" fill="HUE" stroke="#111" stroke-width="1.5" stroke-linejoin="round"/>',
  x2: '<circle r="20" fill="HUE" stroke="#111" stroke-width="2"/><text y="8" text-anchor="middle" font-size="22" font-weight="900" fill="#fff" stroke="#111" stroke-width="1" font-family="sans-serif">×2</text>',
  ball: '<circle cy="-3" r="16" fill="HUE" stroke="#111" stroke-width="2"/><circle cx="-6" cy="-9" r="5" fill="#fff" opacity=".45"/><path d="M-14 13 H14 L10 21 H-10 Z" fill="#7a4a22" stroke="#111" stroke-width="1.6"/>',
  flip2: '<rect x="-17" y="-16" width="16" height="24" rx="2" fill="#c8262d" stroke="#111" stroke-width="1.6" transform="rotate(-12)"/><rect x="1" y="-12" width="16" height="24" rx="2" fill="#fff" stroke="#111" stroke-width="1.6" transform="rotate(10)"/><path d="M-6 16 C0 22 8 20 12 14" fill="none" stroke="HUE" stroke-width="3.5" stroke-linecap="round"/>',
  gem: '<path d="M-16 -6 L-8 -16 H8 L16 -6 L0 18 Z" fill="HUE" stroke="#111" stroke-width="2" stroke-linejoin="round"/><path d="M-16 -6 H16 M-8 -16 L-4 -6 L0 18 M8 -16 L4 -6" fill="none" stroke="#111" stroke-width="1"/>',
  turtle: '<ellipse cy="2" rx="18" ry="12" fill="HUE" stroke="#111" stroke-width="2"/><path d="M-8 -6 L0 -10 L8 -6 L8 4 L0 8 L-8 4 Z" fill="none" stroke="#111" stroke-width="1.4"/><circle cx="20" cy="0" r="5" fill="HUE" stroke="#111" stroke-width="1.6"/><path d="M-12 12 L-14 18 M10 12 L12 18" stroke="#111" stroke-width="3" stroke-linecap="round"/>',
  sun: '<circle r="11" fill="HUE" stroke="#111" stroke-width="2"/><g stroke="HUE" stroke-width="3.5" stroke-linecap="round"><path d="M0 -20 V-15 M0 15 V20 M-20 0 H-15 M15 0 H20 M-14 -14 L-11 -11 M11 11 L14 14 M-14 14 L-11 11 M11 -11 L14 -14"/></g><circle r="4" fill="#fff" opacity=".8"/>',
  confetti: '<path d="M-18 18 L-4 -14 L14 4 Z" fill="HUE" stroke="#111" stroke-width="2" stroke-linejoin="round"/><circle cx="8" cy="-16" r="3" fill="#ffd23a"/><circle cx="16" cy="-6" r="2.5" fill="#4fb4ff"/><rect x="0" y="-22" width="4" height="4" fill="#5bbf6a" transform="rotate(20)"/>',
  fog: '<path d="M-18 6 C-22 -4 -10 -10 -6 -4 C-4 -14 10 -14 10 -4 C18 -8 24 2 16 8 Z" fill="HUE" stroke="#111" stroke-width="2"/><path d="M-20 14 H18 M-14 20 H12" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".7"/>',
  mirror: '<ellipse cy="-4" rx="13" ry="16" fill="#e8f0fa" stroke="#111" stroke-width="2.2"/><ellipse cy="-4" rx="9" ry="12" fill="HUE"/><path d="M-5 -12 L3 -16 M-6 -6 L5 -11" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path d="M0 12 V22 M-7 22 H7" stroke="#7a4a22" stroke-width="3.5" stroke-linecap="round"/>',
  umbrella: '<path d="M-20 0 C-18 -18 18 -18 20 0 C16 -4 10 -4 7 0 C4 -4 -4 -4 -7 0 C-10 -4 -16 -4 -20 0 Z" fill="HUE" stroke="#111" stroke-width="2" stroke-linejoin="round"/><path d="M0 -16 V16 C0 21 -7 21 -7 16" fill="none" stroke="#111" stroke-width="2.5" stroke-linecap="round"/>',
  bird: '<path d="M-18 4 C-10 -10 4 -10 10 -2 L20 -6 L14 2 C10 12 -6 14 -18 4 Z" fill="HUE" stroke="#111" stroke-width="2" stroke-linejoin="round"/><path d="M-6 -2 C-2 -16 8 -18 10 -12 C4 -10 0 -6 -2 0" fill="#fff" stroke="#111" stroke-width="1.6"/><circle cx="8" cy="-3" r="1.6" fill="#111"/>',
  ribbon: '<g stroke="#111" stroke-width="1.6"><rect x="-17" y="-20" width="9" height="38" rx="1.5" fill="#e84a4a" transform="rotate(-10)"/><rect x="-4.5" y="-20" width="9" height="38" rx="1.5" fill="#4f7cff"/><rect x="8" y="-20" width="9" height="38" rx="1.5" fill="#e84a4a" transform="rotate(10)"/></g><path d="M-1 -12 H1 M-1 -6 H1" stroke="#fff" stroke-width="2"/>',
  coin: '<circle r="18" fill="HUE" stroke="#111" stroke-width="2.2"/><circle r="13" fill="none" stroke="#111" stroke-width="1.2" opacity=".5"/><rect x="-5" y="-5" width="10" height="10" fill="#1b1640" stroke="#111" stroke-width="1.5"/>',
  clover: '<g fill="HUE" stroke="#111" stroke-width="1.8"><circle cx="-7" cy="-7" r="8"/><circle cx="7" cy="-7" r="8"/><circle cx="-7" cy="7" r="8"/><circle cx="7" cy="7" r="8"/></g><path d="M2 4 C6 12 8 18 6 22" fill="none" stroke="#2e6b33" stroke-width="3" stroke-linecap="round"/>',
  fang: '<path d="M-14 -18 C-14 2 -6 16 0 22 C6 16 14 2 14 -18 C6 -14 -6 -14 -14 -18 Z" fill="#fff6e0" stroke="#111" stroke-width="2.2" stroke-linejoin="round"/><path d="M-10 -12 C-4 -9 4 -9 10 -12" fill="none" stroke="HUE" stroke-width="3" stroke-linecap="round"/><path d="M-4 -2 C-2 6 0 10 1 14" stroke="#c9b48a" stroke-width="1.5" fill="none"/>',
  haetae: '<path d="M-16 20 V-2 C-16 -16 16 -16 16 -2 V20 Z" fill="HUE" stroke="#111" stroke-width="2"/><path d="M-12 -12 L-16 -22 L-6 -15 M12 -12 L16 -22 L6 -15" fill="HUE" stroke="#111" stroke-width="1.8" stroke-linejoin="round"/><circle cx="-6" cy="-3" r="2.6" fill="#111"/><circle cx="6" cy="-3" r="2.6" fill="#111"/><path d="M-8 8 Q0 14 8 8" fill="none" stroke="#111" stroke-width="2"/><path d="M-16 4 C-22 8 -22 14 -16 16 M16 4 C22 8 22 14 16 16" fill="none" stroke="#111" stroke-width="1.6"/>',
  fox: '<path d="M-14 -20 L-6 -6 H6 L14 -20 L16 0 C14 12 6 18 0 20 C-6 18 -14 12 -16 0 Z" fill="HUE" stroke="#111" stroke-width="2" stroke-linejoin="round"/><path d="M-6 8 C-2 14 2 14 6 8 L0 4 Z" fill="#fff"/><path d="M-9 0 L-4 2 M9 0 L4 2" stroke="#111" stroke-width="2.4" stroke-linecap="round"/><circle cy="7" r="1.8" fill="#111"/>',
  dokkaebi: '<path d="M-6 -22 L-4 -12 M6 -22 L4 -12" stroke="#f0c35a" stroke-width="4" stroke-linecap="round"/><circle cy="2" r="15" fill="HUE" stroke="#111" stroke-width="2"/><circle cx="-6" cy="-1" r="3.4" fill="#fff" stroke="#111" stroke-width="1.2"/><circle cx="6" cy="-1" r="3.4" fill="#fff" stroke="#111" stroke-width="1.2"/><path d="M-8 9 H8 M-5 9 V12 M5 9 V12" stroke="#fff" stroke-width="2.4"/><path d="M14 8 L22 -14" stroke="#7a4a22" stroke-width="4" stroke-linecap="round"/><circle cx="21" cy="-14" r="4" fill="#7a4a22" stroke="#111" stroke-width="1.4"/>',
  crow: '<circle r="20" fill="#ff5a3a" opacity=".8"/><path d="M-16 4 C-8 -8 6 -10 12 -4 L20 -8 L15 0 C12 8 0 12 -8 10 L-4 18 M-2 11 L4 18" fill="#111" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/><path d="M-6 -2 C-2 -14 8 -14 6 -6" fill="#222" stroke="HUE" stroke-width="1.4"/><circle cx="10" cy="-3" r="1.4" fill="#f0c35a"/>',
  moon: '<circle r="19" fill="HUE" stroke="#111" stroke-width="2"/><circle cx="-6" cy="-5" r="4" fill="#000" opacity=".12"/><circle cx="7" cy="5" r="3" fill="#000" opacity=".12"/><path d="M-22 18 C-12 10 -4 14 0 18 C6 12 14 12 22 18" fill="#1b1640" stroke="#111" stroke-width="1.6"/>',
  drum: '<ellipse cy="-8" rx="17" ry="7" fill="#f5e6c8" stroke="#111" stroke-width="2"/><path d="M-17 -8 V10 C-17 18 17 18 17 10 V-8" fill="HUE" stroke="#111" stroke-width="2"/><path d="M-10 -1 V14 M0 0 V16 M10 -1 V14" stroke="#111" stroke-width="1.2" opacity=".5"/><path d="M8 -22 L-2 -10 M18 -18 L6 -9" stroke="#7a4a22" stroke-width="3" stroke-linecap="round"/>',
  gourd: '<circle cy="-10" r="8" fill="HUE" stroke="#111" stroke-width="2"/><circle cy="8" r="13" fill="HUE" stroke="#111" stroke-width="2"/><path d="M-6 -3 C-2 0 2 0 6 -3" stroke="#e84a4a" stroke-width="3" fill="none"/><path d="M0 -18 V-23" stroke="#7a4a22" stroke-width="3" stroke-linecap="round"/><circle cx="-5" cy="4" r="3" fill="#fff" opacity=".35"/>',
  pouch: '<path d="M-8 -12 C-16 -4 -18 10 -12 18 H12 C18 10 16 -4 8 -12 Z" fill="HUE" stroke="#111" stroke-width="2" stroke-linejoin="round"/><path d="M-10 -14 L-4 -20 L0 -14 L4 -20 L10 -14" fill="HUE" stroke="#111" stroke-width="1.8" stroke-linejoin="round"/><path d="M-9 -11 H9" stroke="#f0c35a" stroke-width="3"/><path d="M-5 6 H5 M0 2 V12" stroke="#f0c35a" stroke-width="2"/>',
  treasure: '<path d="M-18 -2 H18 V16 C18 19 15 20 12 20 H-12 C-15 20 -18 19 -18 16 Z" fill="HUE" stroke="#111" stroke-width="2"/><path d="M-20 -8 H20 V-1 H-20 Z" fill="#8a3a2a" stroke="#111" stroke-width="2"/><circle cx="-7" cy="-12" r="6" fill="#d8dde2" stroke="#111" stroke-width="1.6"/><circle cx="6" cy="-13" r="7" fill="#f0c35a" stroke="#111" stroke-width="1.6"/><rect x="4" y="-15" width="4" height="4" fill="#111"/><path d="M-4 6 H4 V12 H-4 Z" fill="#f0c35a" stroke="#111" stroke-width="1.4"/>',
  lantern: '<path d="M0 -24 V-17" stroke="#111" stroke-width="2"/><rect x="-8" y="-18" width="16" height="4" rx="1" fill="#3a2a1a"/><ellipse cy="0" rx="14" ry="15" fill="HUE" stroke="#111" stroke-width="2"/><path d="M-7 -12 V12 M7 -12 V12" stroke="#111" stroke-width="1" opacity=".4"/><rect x="-8" y="14" width="16" height="4" rx="1" fill="#3a2a1a"/><circle r="5" fill="#fff6c0" opacity=".85"/>',
  cardback: '<rect x="-14" y="-20" width="28" height="40" rx="3" fill="#c8262d" stroke="#111" stroke-width="2" transform="rotate(-8)"/><rect x="-10" y="-16" width="20" height="32" rx="2" fill="none" stroke="HUE" stroke-width="2" transform="rotate(-8)"/><circle r="5" fill="HUE" transform="rotate(-8)"/>',
  table: '<rect x="-20" y="-14" width="40" height="28" rx="4" fill="#1f6b45" stroke="#111" stroke-width="2"/><rect x="-16" y="-10" width="32" height="20" rx="2" fill="none" stroke="HUE" stroke-width="1.6"/><rect x="-8" y="-6" width="7" height="11" rx="1" fill="#fff" stroke="#111"/><rect x="2" y="-6" width="7" height="11" rx="1" fill="#c8262d" stroke="#111"/>',
  spark: '<path d="M0 -22 L5 -5 L22 0 L5 5 L0 22 L-5 5 L-22 0 L-5 -5 Z" fill="HUE" stroke="#111" stroke-width="1.8" stroke-linejoin="round"/><circle r="4" fill="#fff"/><path d="M12 -14 L14 -10 M-14 12 L-12 14" stroke="#fff" stroke-width="2" stroke-linecap="round"/>',
  bell: '<path d="M-14 12 C-14 -4 -12 -16 0 -16 C12 -16 14 -4 14 12 L18 16 H-18 Z" fill="HUE" stroke="#111" stroke-width="2" stroke-linejoin="round"/><circle cy="19" r="3.5" fill="#7a4a22" stroke="#111" stroke-width="1.4"/><path d="M0 -16 V-21" stroke="#111" stroke-width="2.5"/><path d="M-20 -6 C-24 0 -24 6 -20 10 M20 -6 C24 0 24 6 20 10" stroke="#fff" stroke-width="2" fill="none" opacity=".7"/>',
  frame: '<rect x="-18" y="-12" width="36" height="24" rx="5" fill="#1b1640" stroke="HUE" stroke-width="4"/><path d="M-10 -2 H10 M-7 4 H7" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><circle cx="-18" cy="-12" r="3.5" fill="HUE"/><circle cx="18" cy="12" r="3.5" fill="HUE"/>',
  wave: '<path d="M-20 -6 C-14 -14 -8 2 -2 -6 C4 -14 10 2 16 -6 M-20 6 C-14 -2 -8 14 -2 6 C4 -2 10 14 16 6" fill="none" stroke="HUE" stroke-width="4" stroke-linecap="round"/>',
};

export function gradeFill(gi: number) {
  const g = GRADES[Math.max(0, gi)];
  return GRADE_COLOR[g];
}

let artSeq = 0;
/** 등급별 테두리 금속: 쇠 · 백랍 · 청동 · 은 · 청은 · 자수정 · 금 · 장미금 · 홍금 · 진주 */
const METAL: [string, string, string][] = [
  ['#4a4c50', '#8a8d92', '#3a3c40'], ['#6b7070', '#b9bfbd', '#555a59'], ['#6e4523', '#c8935a', '#5a3818'], ['#7d8790', '#e6ecf0', '#68727a'],
  ['#4a5d8f', '#b9c8ec', '#3c4d78'], ['#5e4785', '#cdb6ea', '#4c386e'], ['#8a6a2a', '#f6dc8c', '#a87c2e'], ['#9a5a45', '#f3c2a6', '#85493a'],
  ['#7a2a26', '#f0c070', '#8a3a2a'], ['#8fa8c8', '#fff4e8', '#c8a8d8'],
];
/** 분류별 창(아치) 안 밤하늘 색 */
const NIGHT: Record<string, [string, string]> = {
  spell: ['#2a3a64', '#0f1630'], talisman: ['#5a2428', '#1c0a0c'], spirit: ['#245244', '#0b1f18'],
  event: ['#3a2c5c', '#130e24'], tool: ['#4a3622', '#160f08'], cosmetic: ['#4a2a46', '#170c16'],
};
/** 아이콘을 금박 판화처럼: 채움은 금, 선은 먹갈색 */
function goldify(svg: string, id: string) {
  return svg
    .replace(/fill="HUE"/g, `fill="url(#${id}-au)"`)
    .replace(/stroke="HUE"/g, `stroke="url(#${id}-au)"`)
    .replace(/fill="#(?:fff|ffffff)"/gi, 'fill="#fbf3dc"')
    .replace(/stroke="#(?:fff|ffffff)"/gi, 'stroke="#fbf3dc"')
    .replace(/fill="#(?!fbf3dc)[0-9a-fA-F]{3,6}"/g, `fill="url(#${id}-au2)"`)
    .replace(/stroke="#111"/g, 'stroke="#3a2a10"')
    .replace(/stroke="#(?!fbf3dc|3a2a10)[0-9a-fA-F]{3,6}"/g, `stroke="url(#${id}-au)"`);
}
export function itemArt(it: ItemDef, gi: number, locked = false): string {
  const id = `it${(artSeq = (artSeq + 1) % 1e9)}`; // 매번 고유 id: 숨겨진 사본의 그라데이션을 참조하면 안 그려짐
  const g = Math.max(0, gi);
  const [m0, m1, m2] = locked ? ['#3a3a38', '#6a6862', '#2e2e2c'] : METAL[g];
  const [n0, n1] = locked ? ['#2a2a2a', '#121212'] : (NIGHT[it.category] ?? NIGHT.spell);
  const pearl = !locked && g === 9;
  const metal = pearl
    ? `<linearGradient id="${id}-m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6d6d0"/><stop offset=".25" stop-color="#f7ecc8"/><stop offset=".5" stop-color="#d4ecdf"/><stop offset=".75" stop-color="#d4def4"/><stop offset="1" stop-color="#e8d6f2"/></linearGradient>`
    : `<linearGradient id="${id}-m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${m0}"/><stop offset=".45" stop-color="${m1}"/><stop offset=".7" stop-color="${m0}"/><stop offset="1" stop-color="${m2}"/></linearGradient>`;
  const rays = Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * Math.PI * 2; return `<line x1="20" y1="25" x2="${(20 + Math.cos(a) * 22).toFixed(1)}" y2="${(25 + Math.sin(a) * 22).toFixed(1)}"/>`; }).join('');
  const stars = [[10, 11], [30, 13], [8, 30], [32, 31], [14, 37], [27, 38]].map(([x, y], i) => `<path d="M${x} ${y - 0.9} L${x + 0.25} ${y} L${x} ${y + 0.9} L${x - 0.25} ${y} Z M${x - 0.9} ${y} L${x} ${y + 0.25} L${x + 0.9} ${y} L${x} ${y - 0.25} Z" opacity="${0.5 + (i % 3) * 0.15}"/>`).join('');
  const icon = goldify((ICON[it.icon] ?? ICON.gem).replaceAll('HUE', 'HUE'), id);
  const grade = gi < 0 ? '' : GRADES[gi];
  const name = locked ? '???' : it.name;
  const nameSize = name.length > 5 ? 3.5 : 4.2;
  return `<svg viewBox="0 0 40 62" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    ${metal}
    <linearGradient id="${id}-p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4ead2"/><stop offset="1" stop-color="#dccba4"/></linearGradient>
    <radialGradient id="${id}-n" cx=".5" cy=".42" r=".75"><stop offset="0" stop-color="${n0}"/><stop offset="1" stop-color="${n1}"/></radialGradient>
    <linearGradient id="${id}-au" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8a6a2a"/><stop offset=".4" stop-color="#f6dc8c"/><stop offset=".7" stop-color="#c99a3a"/><stop offset="1" stop-color="#fff1c1"/></linearGradient>
    <linearGradient id="${id}-au2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1c1"/><stop offset="1" stop-color="#d9b45a"/></linearGradient>
    <clipPath id="${id}-w"><path d="M6.5 45 V16 A13.5 13.5 0 0 1 33.5 16 V45 Z"/></clipPath>
  </defs>
  <rect width="40" height="62" rx="2.6" fill="url(#${id}-m)"/>
  <rect x="1.4" y="1.4" width="37.2" height="59.2" rx="1.8" fill="url(#${id}-p)"/>
  <rect x="2.6" y="2.6" width="34.8" height="56.8" rx="1.2" fill="none" stroke="url(#${id}-m)" stroke-width=".5"/>
  <g clip-path="url(#${id}-w)">
    <rect x="0" y="0" width="40" height="62" fill="url(#${id}-n)"/>
    <g stroke="#e9cf8a" stroke-opacity="${locked ? 0.08 : 0.18}" stroke-width=".35">${rays}</g>
    <circle cx="20" cy="25" r="11" fill="none" stroke="#e9cf8a" stroke-opacity="${locked ? 0.1 : 0.3}" stroke-width=".4"/>
    <circle cx="20" cy="25" r="13.2" fill="none" stroke="#e9cf8a" stroke-opacity="${locked ? 0.06 : 0.16}" stroke-width=".3" stroke-dasharray=".6 .8"/>
    <g fill="#f6dc8c">${locked ? '' : stars}</g>
    ${locked ? '<text x="20" y="30" text-anchor="middle" font-size="12" font-weight="800" fill="#5a5850" font-family="Nanum Myeongjo, Noto Serif KR, serif">?</text>' : `<g transform="translate(20 26) scale(.4)">${icon}</g>`}
  </g>
  <path d="M6.5 45 V16 A13.5 13.5 0 0 1 33.5 16 V45 Z" fill="none" stroke="url(#${id}-m)" stroke-width=".9"/>
  <path d="M8 45 V16.3 A12 12 0 0 1 32 16.3 V45" fill="none" stroke="#3a2a10" stroke-opacity=".35" stroke-width=".3"/>
  ${grade ? `<g transform="translate(20 4.9)"><path d="M-6.5 -2.2 H6.5 L8 0 L6.5 2.2 H-6.5 L-8 0 Z" fill="url(#${id}-m)" stroke="#3a2a10" stroke-opacity=".5" stroke-width=".25"/><text y="1.35" text-anchor="middle" font-size="3.6" font-weight="800" fill="#241a0c" font-family="Nanum Myeongjo, Noto Serif KR, serif" letter-spacing=".15">${grade}</text></g>` : ''}
  <rect x="5" y="47.4" width="30" height="8.4" rx=".8" fill="#f8f1de" stroke="url(#${id}-m)" stroke-width=".55"/>
  <line x1="7" y1="49" x2="33" y2="49" stroke="#b89b5e" stroke-opacity=".5" stroke-width=".2"/>
  <line x1="7" y1="54.2" x2="33" y2="54.2" stroke="#b89b5e" stroke-opacity=".5" stroke-width=".2"/>
  <text x="20" y="53.1" text-anchor="middle" font-size="${nameSize}" font-weight="800" fill="#2a1f12" font-family="Nanum Myeongjo, Noto Serif KR, serif">${name}</text>
  <path d="M20 57.6 l1 1 l-1 1 l-1 -1 z" fill="url(#${id}-m)"/>
</svg>`;
}

// ---------- 매직 카드 실제 효과 값 (등급 순번 g = 0(F) … 9(SSS+)) ----------
export const MAGIC_IDS = ['peek', 'swap', 'sweep', 'undo', 'shield', 'double'] as const;
export type MagicId = (typeof MAGIC_IDS)[number];
export function magicParams(id: MagicId, g: number) {
  const chancePct = CH[g];
  switch (id) {
    case 'peek': return { uses: 1, chancePct: 100, count: B.peekCount[g], seconds: B.peekSec[g] };
    case 'swap': return { uses: B.swapUses[g], chancePct, preview: g >= 5 };
    case 'sweep': return { uses: 1, chancePct, count: B.sweepCount[g], anyCard: g >= B.sweepAny };
    case 'undo': return { uses: B.undoUses[g], chancePct, undoPpeok: g >= 6 };
    case 'shield': return { uses: 0, chancePct, shield: B.shield[g], noPibak: g >= B.shieldPibak, noGwangbak: g >= B.shieldGwangbak };
    case 'double': return { uses: 0, chancePct: B.doublePct[g] };
  }
}

/** 테스트용: 모든 아이템을 무작위 등급으로 1장씩 지급 */
export function grantTestMagic(rng = Math.random) {
  for (const { id } of ITEMS) {
    let g = rng() * 100; let gi = 0;
    for (; gi < GRADES.length - 1; gi++) { g -= GRADE_RATE[GRADES[gi]]; if (g < 0) break; }
    const grade = GRADES[gi];
    mem = { ...mem, [id]: { ...ownedOf(id), [grade]: (ownedOf(id)[grade] ?? 0) + 1 } };
  }
  save(mem);
}

// ---------- 뽑기권 (엽전으로 사용) ----------
export interface Ticket { id: string; name: string; desc: string; hue: string; rates: Record<Grade, number>; minGrade?: Grade; price?: number }
/** 뽑기권 1장 가격(엽전). 10회는 9장 값 */
/** 뽑기권 가격(각 뽑기권의 재화 기준). 10회는 9장 값 */
export const TICKET_PRICE: Record<string, number> = { copper: 1000, silver: 5, gold: 8, jade: 20, dragon: 50 };
/** 뽑기권별 재화: 엽전권=엽전, 은화권=은화, 금화권 이상=금화 */
export const TICKET_CUR: Record<string, 'yeop' | 'eun' | 'geum'> = { copper: 'yeop', silver: 'eun', gold: 'geum', jade: 'geum', dragon: 'geum' };
export const curOf = (t: Ticket) => TICKET_CUR[t.id] ?? 'geum';
export const priceOf = (t: Ticket, n: number) => (t.price ?? TICKET_PRICE[t.id] ?? 8) * (n >= 10 ? 9 : n);
/** 뽑기권 5단계 (확률표는 items-data.ts / outputs/items.md 6절) */
export let TICKETS: Ticket[] = TICKET_SPECS.map((t) => ({ ...t, minGrade: t.minGrade as Grade | undefined }));
export function setTickets(t: Ticket[]) { TICKETS = t; }

/** 뽑기권으로 1회 뽑기: 항목은 가중치, 등급은 뽑기권 확률표 */
export function drawWithTicket(t: Ticket, rng = Math.random): Drop {
  const total = ITEMS.reduce((a, m) => a + m.weight, 0);
  let r = rng() * total;
  const item = ITEMS.find((m) => (r -= m.weight) < 0) ?? ITEMS[0];
  const sum = GRADES.reduce((a, g) => a + t.rates[g], 0);
  let g = rng() * sum; let gi = 0;
  for (; gi < GRADES.length - 1; gi++) { g -= t.rates[GRADES[gi]]; if (g < 0) break; }
  const grade = GRADES[gi];
  const isNewBest = gi > bestGrade(item.id);
  mem = { ...mem, [item.id]: { ...ownedOf(item.id), [grade]: (ownedOf(item.id)[grade] ?? 0) + 1 } };
  save(mem);
  return { item, grade, gi, isNewBest };
}

// ---------- 은화 사용: 승급 · 직접 구매 ----------
/** 아이템 지급 (은화 상점 등) */
export function grantItem(id: string, gi: number, n = 1) {
  const g = GRADES[gi];
  mem = { ...mem, [id]: { ...ownedOf(id), [g]: (ownedOf(id)[g] ?? 0) + n } };
  save(mem);
}
/** 승급 비용: 같은 등급 2장 + 은화 (F→E … SSS→SSS+) */
export const UPGRADE_SILVER = [5, 8, 12, 18, 25, 35, 50, 70, 100];
/** 승급할 수 있는 등급 (같은 등급 2장 이상 & SSS+ 아님). 가장 높은 것 */
export function upgradable(id: string): number {
  const o = ownedOf(id);
  for (let i = GRADES.length - 2; i >= 0; i--) if ((o[GRADES[i]] ?? 0) >= 2) return i;
  return -1;
}
/** 같은 등급 2장을 합쳐 한 등급 위 1장으로 (은화는 부르는 쪽에서 낸다) */
export function upgradeItem(id: string, gi: number): boolean {
  const o = { ...ownedOf(id) };
  const g = GRADES[gi], up = GRADES[gi + 1];
  if (!up || (o[g] ?? 0) < 2) return false;
  o[g] = (o[g] ?? 0) - 2; if (!o[g]) delete o[g];
  o[up] = (o[up] ?? 0) + 1;
  mem = { ...mem, [id]: o };
  save(mem);
  return true;
}
