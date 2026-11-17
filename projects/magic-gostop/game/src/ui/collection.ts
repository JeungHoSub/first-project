// 아이템 수집(테스트용). 아이템은 1회성 소모품이 아니라 모으는 수집품이고, 항목마다 등급 F ~ SSS+가 있다.
// 정식 버전: 뽑기권·사용자 대전에서 획득(서버 저장). 지금: 봇전 결과에 따라 일정 확률로 획득, 이 기기 브라우저에만 저장.
// 확률은 도감 화면에 그대로 공개한다(확률형 아이템 확률 공개 원칙). 효과는 아직 판에 적용하지 않는다(설명만).
// 항목 출처: outputs/rules.md 9절 후보(A 매직 카드, B 캐릭터, C 판 이벤트) + brief의 "점수 2배".

export type Category = 'magic' | 'character' | 'event';
export const CATEGORY_LABEL: Record<Category, string> = { magic: '매직 카드', character: '캐릭터', event: '판 이벤트권' };

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
}
const pick = <T,>(arr: readonly T[], g: number) => arr[Math.min(arr.length - 1, Math.floor((g / 9) * (arr.length - 1) + 1e-9))];
const pct = (g: number, lo: number, hi: number) => Math.round(lo + ((hi - lo) * g) / 9);
/** 모든 아이템 공통: 등급이 오를수록 발동 확률 40% → 100% */
const chance = (g: number) => ` · 발동 ${pct(g, 40, 100)}%`;

export const ITEMS: ItemDef[] = [
  // A. 매직 카드
  { id: 'peek', name: '엿보기', category: 'magic', icon: 'eye', hue: '#3fa7d6', weight: 12,
    effect: (g) => `판당 1회, 상대 손패 ${g === 9 ? '전부' : `${pick([1, 1, 1, 2, 2, 2, 3, 3, 4, 10], g)}장`}를 ${pick(['2초', '3초', '4초', '3초', '4초', '5초', '4초', '5초', '한 턴', '한 턴'], g)} 동안 봅니다` },
  { id: 'swap', name: '패 바꾸기', category: 'magic', icon: 'swap', hue: '#b678e8', weight: 10,
    effect: (g) => `판당 ${g >= 8 ? 2 : 1}회, 손패 1장을 더미 맨 위 패와 바꿉니다${g >= 5 ? ' · 미리 보기' : ''}${chance(g)}` },
  { id: 'sweep', name: '바닥 정리', category: 'magic', icon: 'broom', hue: '#5bbf6a', weight: 12,
    effect: (g) => `판당 1회, 바닥 패 ${g >= 7 ? 2 : 1}장을 더미 맨 아래로 보냅니다${g >= 4 ? ' (모든 패)' : ' (피만)'}${chance(g)}` },
  { id: 'undo', name: '되돌리기', category: 'magic', icon: 'undo', hue: '#7fd1c7', weight: 7,
    effect: (g) => `판당 ${g >= 9 ? 2 : 1}회, 내 직전 차례를 무르고 다시 냅니다${g >= 6 ? ' · 뻑도 무르기' : ''}${chance(g)}` },
  { id: 'shield', name: '방패', category: 'magic', icon: 'shield', hue: '#f0c35a', weight: 7,
    effect: (g) => `피 뺏김을 ${pick([1, 1, 2, 2, 2, 3, 3, 4, 4, 5], g)}번 막아 줍니다${g >= 5 ? ' · 피박도 1번' : ''}${g >= 8 ? ' · 광박도 1번' : ''}${chance(g)}` },
  { id: 'double', name: '점수 2배', category: 'magic', icon: 'x2', hue: '#ff5a5f', weight: 5,
    effect: (g) => `이긴 판 점수 ×2 · 발동 확률 ${pct(g, 10, 100)}%` },
  // B. 캐릭터 (장착하면 매 판 적용될 고유 능력)
  { id: 'seer', name: '점쟁이', category: 'character', icon: 'ball', hue: '#9b7bff', weight: 6,
    effect: (g) => `매 판 시작 때 더미 맨 위 ${pick([1, 1, 1, 2, 2, 2, 3, 3, 4, 5], g)}장을 봅니다${chance(g)}` },
  { id: 'twoflip', name: '두 번 뒤집기', category: 'character', icon: 'flip2', hue: '#ff8a3d', weight: 4,
    effect: (g) => `판당 ${g >= 8 ? 2 : 1}회, 더미를 한 번 더 뒤집습니다 · ${pick(['7턴 이후', '6턴 이후', '5턴 이후', '4턴 이후', '3턴 이후', '2턴 이후', '언제나', '언제나', '언제나', '언제나'], g)}${chance(g)}` },
  { id: 'collector', name: '수집가', category: 'character', icon: 'gem', hue: '#4fd1ff', weight: 6,
    effect: (g) => `광을 먹을 때마다 +${pick([0.5, 0.5, 1, 1, 1, 1.5, 1.5, 2, 2, 3], g)}점 (판당 최대 ${pick([1, 1, 2, 2, 2, 3, 3, 3, 4, 5], g)}점)${chance(g)}` },
  { id: 'turtle', name: '거북이', category: 'character', icon: 'turtle', hue: '#5bbf6a', weight: 6,
    effect: (g) => `매 판 피 뺏김을 ${pick([1, 1, 1, 1, 2, 2, 2, 2, 3, 3], g)}번 무시합니다${g >= 6 ? ' · 피박 기준 -1장' : ''}${chance(g)}` },
  // C. 판 이벤트권 (그 판에만 적용, 양쪽 모두)
  { id: 'gwangday', name: '광의 날', category: 'event', icon: 'sun', hue: '#ffd23a', weight: 6,
    effect: (g) => `이번 판 광 점수 +${pick([1, 1, 1, 1, 1, 2, 2, 2, 3, 3], g)} (모두에게)${g >= 7 ? ' · 비광 감점 없음' : ''}${chance(g)}` },
  { id: 'pifest', name: '쌍피 축제', category: 'event', icon: 'confetti', hue: '#ff6fb5', weight: 6,
    effect: (g) => `이번 판 국진은 쌍피로 고정${g >= 4 ? ' · 쌍피는 3피로' : ''}${g >= 8 ? ' · 보너스 패 +1장' : ''}${chance(g)}` },
  { id: 'fog', name: '안개', category: 'event', icon: 'fog', hue: '#aab7c4', weight: 6,
    effect: (g) => `바닥 패 ${pick([1, 1, 2, 2, 2, 3, 3, 3, 4, 4], g)}장을 뒤집어 놓고 시작 (모두에게)${chance(g)}` },
  { id: 'quake', name: '흔들림', category: 'event', icon: 'wave', hue: '#ff8a3d', weight: 6,
    effect: (g) => `이번 판 첫 흔들기·폭탄 배수 ×${pick([3, 3, 3, 3, 3, 4, 4, 4, 5, 6], g)}${chance(g)}` },
];

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
  const icon = ICON[it.icon].replaceAll('HUE', it.hue);
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
    case 'peek': return { uses: 1, chancePct: 100, count: g === 9 ? 99 : pick([1, 1, 1, 2, 2, 2, 3, 3, 4, 10], g), seconds: pick([2, 3, 4, 3, 4, 5, 4, 5, 8, 8], g) };
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

// ---------- 뽑기권 (테스트: 무료) ----------
export interface Ticket { id: string; name: string; desc: string; hue: string; rates: Record<Grade, number>; minGrade?: Grade }
/** 기본 뽑기권 5단계 (items-data.ts의 TICKETS가 있으면 그걸 씀) */
export let TICKETS: Ticket[] = [
  { id: 'copper', name: '동전 뽑기권', desc: '가볍게 한 번', hue: '#c07a3d', rates: { F: 38, E: 26, D: 17, C: 10, B: 5, A: 2.5, S: 1, SS: 0.4, SSS: 0.08, 'SSS+': 0.02 } },
  { id: 'silver', name: '은전 뽑기권', desc: 'D 이상 확률 ↑', hue: '#b8c4cc', rates: { F: 20, E: 22, D: 22, C: 16, B: 10, A: 5.5, S: 3, SS: 1.1, SSS: 0.32, 'SSS+': 0.08 } },
  { id: 'gold', name: '금전 뽑기권', desc: 'C 이상 보장', hue: '#f0c35a', rates: { F: 0, E: 0, D: 0, C: 40, B: 28, A: 17, S: 9, SS: 4.5, SSS: 1.2, 'SSS+': 0.3 }, minGrade: 'C' },
  { id: 'jade', name: '옥 뽑기권', desc: 'A 이상 보장', hue: '#5bd1a0', rates: { F: 0, E: 0, D: 0, C: 0, B: 0, A: 55, S: 27, SS: 12, SSS: 4.8, 'SSS+': 1.2 }, minGrade: 'A' },
  { id: 'dragon', name: '용 뽑기권', desc: 'S 이상 보장 · 최고 단계', hue: '#ff5a5f', rates: { F: 0, E: 0, D: 0, C: 0, B: 0, A: 0, S: 60, SS: 27, SSS: 10, 'SSS+': 3 }, minGrade: 'S' },
];
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
