// 아이템 수집(테스트용). 아이템은 1회성 소모품이 아니라 모으는 수집품이고, 항목마다 등급 F ~ SSS+가 있다.
// 정식 버전: 뽑기권·사용자 대전에서 획득(서버 저장). 지금: 봇전 결과에 따라 일정 확률로 획득, 이 기기 브라우저에만 저장.
// 확률은 도감 화면에 그대로 공개한다(확률형 아이템 확률 공개 원칙). 효과는 아직 판에 적용하지 않는다(설명만).
// 항목 출처: outputs/rules.md 9절 후보(A 매직 카드, B 캐릭터, C 판 이벤트) + brief의 "점수 2배".

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
  effect: (g: number) => sp.effects[Math.max(0, Math.min(9, g))],
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
export function rollDrop(outcome: 'win' | 'lose' | 'nagari', level: 'easy' | 'normal' | 'hard', rng = Math.random): Drop | null {
  if (rng() * 100 >= DROP_RATE[outcome][level]) return null;
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
  sun: '<circle r="11" fill="HUE" stroke="#111" stroke-width="2"/><g stroke="HUE" stroke-width="3.5" stroke-linecap="round"><path d="M0 -20 V-15 M0 15 V20 M-20 0 H-15 M15 0 H20 M-14 -14 L-11 -11 M11 11 L14 14 M-14 14 L-11 11 M11 -11 L14 -14"/></g><text y="5" text-anchor="middle" font-size="12" font-weight="900" fill="#c8262d" font-family="serif">光</text>',
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
  pouch: '<path d="M-8 -12 C-16 -4 -18 10 -12 18 H12 C18 10 16 -4 8 -12 Z" fill="HUE" stroke="#111" stroke-width="2" stroke-linejoin="round"/><path d="M-10 -14 L-4 -20 L0 -14 L4 -20 L10 -14" fill="HUE" stroke="#111" stroke-width="1.8" stroke-linejoin="round"/><path d="M-9 -11 H9" stroke="#f0c35a" stroke-width="3"/><text y="10" text-anchor="middle" font-size="13" font-weight="900" fill="#f0c35a" font-family="serif">福</text>',
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

export function itemArt(it: ItemDef, gi: number, locked = false): string {
  const id = `it-${it.id}-${gi}${locked ? 'l' : ''}`;
  const gc = gi < 0 ? '#3a4a43' : gradeFill(gi);
  const frame = gc === 'rainbow'
    ? `<linearGradient id="${id}-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff5a5f"/><stop offset=".25" stop-color="#ffd23a"/><stop offset=".5" stop-color="#5bbf6a"/><stop offset=".75" stop-color="#4fb4ff"/><stop offset="1" stop-color="#b678e8"/></linearGradient>`
    : `<linearGradient id="${id}-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".35" stop-color="${gc}"/><stop offset="1" stop-color="${gc}" stop-opacity=".75"/></linearGradient>`;
  const stars = Array.from({ length: 12 }, (_, i) => `<circle cx="${(i * 37) % 34 + 3}" cy="${(i * 23) % 40 + 4}" r="${(i % 3) * 0.25 + 0.35}" fill="#fff" opacity="${0.35 + (i % 4) * 0.15}"/>`).join('');
  const icon = (ICON[it.icon] ?? ICON.gem).replaceAll('HUE', it.hue);
  const grade = gi < 0 ? '' : GRADES[gi];
  return `<svg viewBox="0 0 40 62" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs><radialGradient id="${id}" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="${it.hue}" stop-opacity="${locked ? 0.12 : 0.5}"/><stop offset=".55" stop-color="#1b1640"/><stop offset="1" stop-color="#0b0a1c"/></radialGradient>${frame}</defs>
    <rect width="40" height="62" rx="3" fill="url(#${id}-g)"/>
    <rect x="1.8" y="1.8" width="36.4" height="58.4" rx="2" fill="url(#${id})"/>
    ${stars}
    ${locked ? '<text x="20" y="30" text-anchor="middle" font-size="13" font-weight="900" fill="#55665e" font-family="sans-serif">?</text>' : `<g transform="translate(20 24) scale(.42)">${icon}</g>`}
    <rect x="4" y="43" width="32" height="8.5" rx="4.2" fill="#0b0a1c" stroke="url(#${id}-g)" stroke-width=".7"/>
    <text x="20" y="49.2" text-anchor="middle" font-size="4.7" font-weight="700" fill="#fff6dc" font-family="'Noto Sans KR','Apple SD Gothic Neo',sans-serif">${locked ? '???' : it.name}</text>
    ${grade ? `<g transform="translate(20 56.2)"><rect x="-8" y="-3.4" width="16" height="6.8" rx="3.4" fill="url(#${id}-g)" stroke="#0b0a1c" stroke-width=".5"/><text y="1.9" text-anchor="middle" font-size="4.6" font-weight="900" fill="#0b0a1c" font-family="'Black Han Sans',sans-serif">${grade}</text></g>` : ''}
  </svg>`;
}

// ---------- 매직 카드 실제 효과 값 (등급 순번 g = 0(F) … 9(SSS+)) ----------
export const MAGIC_IDS = ['peek', 'swap', 'sweep', 'undo', 'shield', 'double'] as const;
export type MagicId = (typeof MAGIC_IDS)[number];
export function magicParams(id: MagicId, g: number) {
  const chancePct = pct(g, 40, 100);
  switch (id) {
    case 'peek': return { uses: 1, chancePct: 100, count: [1, 1, 1, 2, 2, 2, 3, 3, 4, 5][g], seconds: [2, 3, 4, 4, 5, 6, 6, 7, 8, 10][g] };
    case 'swap': return { uses: g >= 8 ? 2 : 1, chancePct, preview: g >= 5 };
    case 'sweep': return { uses: 1, chancePct, count: g >= 7 ? 2 : 1, anyCard: g >= 4 };
    case 'undo': return { uses: g >= 9 ? 2 : 1, chancePct, undoPpeok: g >= 6 };
    case 'shield': return { uses: 0, chancePct, shield: pick([1, 1, 2, 2, 2, 3, 3, 4, 4, 5], g), noPibak: g >= 5, noGwangbak: g >= 8 };
    case 'double': return { uses: 0, chancePct: pct(g, 10, 100) };
  }
}

/** 테스트용: 매직 카드 6종을 무작위 등급으로 1장씩 지급 */
export function grantTestMagic(rng = Math.random) {
  for (const id of MAGIC_IDS) {
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
export const TICKET_PRICE: Record<string, number> = { copper: 100, silver: 300, gold: 1000, jade: 3000, dragon: 10000 };
export const priceOf = (t: Ticket, n: number) => (t.price ?? TICKET_PRICE[t.id] ?? 1000) * (n >= 10 ? 9 : n);
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
