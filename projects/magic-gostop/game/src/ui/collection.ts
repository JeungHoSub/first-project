// 매직 카드 수집(테스트용). 매직 카드는 1회성 아이템이 아니라 모으는 수집품.
// 정식 버전: 뽑기권·사용자 대전에서 획득 (서버 저장). 지금: 봇전 결과에 따라 일정 확률로 획득, 이 기기 브라우저에만 저장.
// 확률은 도감 화면에 그대로 공개한다(확률형 아이템 확률 공개 원칙).

export type Rarity = 'common' | 'rare' | 'epic';
export interface MagicDef { id: string; name: string; desc: string; rarity: Rarity; weight: number; icon: string; hue: string }

export const RARITY_LABEL: Record<Rarity, string> = { common: '일반', rare: '희귀', epic: '영웅' };

export const MAGIC: MagicDef[] = [
  { id: 'peek', name: '엿보기', desc: '상대 손패 1장을 몰래 봅니다', rarity: 'common', weight: 35, icon: 'eye', hue: '#3fa7d6' },
  { id: 'sweep', name: '바닥 정리', desc: '바닥 패 1장을 더미 맨 아래로 보냅니다', rarity: 'common', weight: 35, icon: 'broom', hue: '#5bbf6a' },
  { id: 'swap', name: '패 바꾸기', desc: '손패 1장을 더미 맨 위 패와 바꿉니다', rarity: 'rare', weight: 20, icon: 'swap', hue: '#b678e8' },
  { id: 'shield', name: '방패', desc: '이번 판 피박·광박을 한 번 막습니다', rarity: 'epic', weight: 10, icon: 'shield', hue: '#f0c35a' },
];

/** 판 결과별 획득 확률(%) — 난이도가 높을수록 조금 더 */
export const DROP_RATE = {
  win: { easy: 30, normal: 40, hard: 50 },
  lose: { easy: 10, normal: 15, hard: 20 },
  nagari: { easy: 10, normal: 10, hard: 10 },
} as const;

type Store = Record<string, number>;
const KEY = 'mg-collection';
function load(): Store {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') as Store; } catch { return {}; }
}
function save(s: Store) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* 저장 불가 환경이면 이번 화면에서만 유지 */ }
}
let mem: Store = load();

export function owned(): Store { return { ...mem }; }
export function ownedKinds() { return MAGIC.filter((m) => (mem[m.id] ?? 0) > 0).length; }

/** 판이 끝났을 때 한 번 굴린다. 얻으면 그 카드를 돌려준다. */
export function rollDrop(outcome: 'win' | 'lose' | 'nagari', level: 'easy' | 'normal' | 'hard', rng = Math.random): MagicDef | null {
  if (rng() * 100 >= DROP_RATE[outcome][level]) return null;
  const total = MAGIC.reduce((a, m) => a + m.weight, 0);
  let r = rng() * total;
  const pick = MAGIC.find((m) => (r -= m.weight) < 0) ?? MAGIC[0];
  mem = { ...mem, [pick.id]: (mem[pick.id] ?? 0) + 1 };
  save(mem);
  return pick;
}

// ---------- 매직 카드 그림 (화투와 같은 비율 40:62, 화투와 구분되는 밤하늘·금테) ----------
const ICON: Record<string, string> = {
  eye: '<path d="M-20 0 C-10 -13 10 -13 20 0 C10 13 -10 13 -20 0 Z" fill="#fff" stroke="#111" stroke-width="2"/><circle r="7" fill="HUE" stroke="#111" stroke-width="2"/><circle r="3" fill="#111"/><circle cx="2" cy="-2" r="1.3" fill="#fff"/>',
  broom: '<path d="M-14 -22 L6 4" stroke="#7a4a22" stroke-width="5" stroke-linecap="round"/><path d="M2 0 L18 16 C12 24 2 26 -6 20 C0 16 0 8 2 0 Z" fill="HUE" stroke="#111" stroke-width="2" stroke-linejoin="round"/><path d="M4 8 L12 18 M0 12 L6 20" stroke="#111" stroke-width="1.2"/><circle cx="-16" cy="12" r="2" fill="#fff"/><circle cx="-10" cy="20" r="1.4" fill="#fff"/>',
  swap: '<path d="M-18 -8 H10 L4 -15 M10 -8 L4 -1" fill="none" stroke="HUE" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 8 H-10 L-4 1 M-10 8 L-4 15" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>',
  shield: '<path d="M0 -22 L18 -15 C18 4 12 16 0 23 C-12 16 -18 4 -18 -15 Z" fill="HUE" stroke="#111" stroke-width="2.2" stroke-linejoin="round"/><path d="M0 -14 L10 -10 C10 2 6 9 0 14 C-6 9 -10 2 -10 -10 Z" fill="#fff" opacity=".35"/><text y="6" text-anchor="middle" font-size="16" font-weight="900" fill="#111" font-family="serif">護</text>',
};
const RARITY_GEMS: Record<Rarity, number> = { common: 1, rare: 2, epic: 3 };

export function magicArt(m: MagicDef, locked = false): string {
  const gid = `mg-${m.id}`;
  const stars = Array.from({ length: 14 }, (_, i) => {
    const x = (i * 37) % 34 + 3, y = (i * 23) % 40 + 4, r = (i % 3) * 0.25 + 0.35;
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${0.4 + (i % 4) * 0.15}"/>`;
  }).join('');
  const gems = Array.from({ length: RARITY_GEMS[m.rarity] }, (_, i) => {
    const n = RARITY_GEMS[m.rarity];
    return `<path d="M${20 + (i - (n - 1) / 2) * 4.4} 55.4 l1.6 1.6 -1.6 1.6 -1.6 -1.6 Z" fill="${m.hue}" stroke="#fff" stroke-width=".3"/>`;
  }).join('');
  const icon = ICON[m.icon].replaceAll('HUE', m.hue);
  return `<svg viewBox="0 0 40 62" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs><radialGradient id="${gid}" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="${m.hue}" stop-opacity=".55"/><stop offset=".55" stop-color="#1b1640"/><stop offset="1" stop-color="#0b0a1c"/></radialGradient>
    <linearGradient id="${gid}-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1b8"/><stop offset=".5" stop-color="#e2ad3a"/><stop offset="1" stop-color="#8a5a12"/></linearGradient></defs>
    <rect width="40" height="62" rx="3" fill="url(#${gid}-g)"/>
    <rect x="1.8" y="1.8" width="36.4" height="58.4" rx="2" fill="url(#${gid})"/>
    ${stars}
    <circle cx="20" cy="24" r="12.5" fill="none" stroke="${m.hue}" stroke-width=".6" opacity=".8"/>
    <circle cx="20" cy="24" r="14.5" fill="none" stroke="#fff" stroke-width=".25" stroke-dasharray="1 1.4" opacity=".6"/>
    ${locked ? '' : `<g transform="translate(20 24) scale(.42)">${icon}</g>`}
    <rect x="4" y="42" width="32" height="9" rx="4.5" fill="#0b0a1c" stroke="url(#${gid}-g)" stroke-width=".7"/>
    <text x="20" y="48.6" text-anchor="middle" font-size="5" font-weight="700" fill="#fff6dc" font-family="'Noto Sans KR','Apple SD Gothic Neo',sans-serif">${locked ? '???' : m.name}</text>
    ${gems}
    ${locked ? '<rect x="1.8" y="1.8" width="36.4" height="58.4" rx="2" fill="#000" opacity=".55"/><text x="20" y="29" text-anchor="middle" font-size="13" font-weight="900" fill="#8a9a92" font-family="sans-serif">?</text>' : ''}
  </svg>`;
}
