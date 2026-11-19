// 캐릭터: 한 명을 골라 데리고 판에 나간다. 캐릭터마다 특별 능력 1개, 은화로 레벨(1~10)을 올리면 능력치가 오른다.
// 얻는 법: 기본 해금(처음부터·판 수·승리 수) + 금화 구매. 능력은 아이템과 따로 계산한다(아이템 상한에 들어가지 않음).
import { bal, pay, curIco } from './wallet';
import * as sfx from './sound';

export type Ability = 'bonus' | 'coinGuard' | 'coinBoost' | 'floorPi' | 'goSteal' | 'spell';
type Unlock = { type: 'free' } | { type: 'play'; n: number } | { type: 'win'; n: number } | { type: 'gold'; price: number };
type Look = 'gat' | 'bun' | 'pack' | 'flower' | 'helmet' | 'sage';
export interface CharDef { id: string; name: string; title: string; color: string; look: Look; ability: Ability; label: string; unlock: Unlock; val: (lv: number) => number; text: (lv: number) => string }

export const MAX_LV = 10;
/** 레벨 lv → lv+1 에 드는 은화 (index = lv-1) */
export const UP_COST = [10, 15, 20, 30, 40, 55, 70, 90, 120];
const lin = (a: number, step: number) => (lv: number) => Math.round(a + step * (lv - 1));

export const CHARS: CharDef[] = [
  { id: 'hanryang', name: '한량', title: '떠돌이 풍류객', color: '#3f5a7a', look: 'gat', ability: 'bonus', label: '보너스 패', unlock: { type: 'free' },
    val: lin(10, 3), text: (lv) => `판 시작 때 ${lin(10, 3)(lv)}% 확률로 더미의 보너스 패를 ${lv >= 10 ? '최대 2장' : '1장'} 가져옵니다` },
  { id: 'jumo', name: '주모', title: '장터 주막 안주인', color: '#8a4a3a', look: 'bun', ability: 'coinGuard', label: '엽전 지키기', unlock: { type: 'play', n: 10 },
    val: lin(5, 2), text: (lv) => `진 판에 잃는 엽전이 ${lin(5, 2)(lv)}% 줄어듭니다` },
  { id: 'bobu', name: '보부상', title: '팔도를 누비는 장사꾼', color: '#4f6b45', look: 'pack', ability: 'coinBoost', label: '엽전 더 벌기', unlock: { type: 'win', n: 5 },
    val: lin(5, 3), text: (lv) => `이긴 판에 받는 엽전이 ${lin(5, 3)(lv)}% 늘어납니다` },
  { id: 'maehwa', name: '매화', title: '풍류 기생', color: '#8c3b5a', look: 'flower', ability: 'floorPi', label: '바닥 피', unlock: { type: 'gold', price: 30 },
    val: lin(8, 3), text: (lv) => `판 시작 때 ${lin(8, 3)(lv)}% 확률로 바닥의 피 1장을 가져옵니다` },
  { id: 'janggun', name: '장군', title: '호랑이 무관', color: '#6b2a2a', look: 'helmet', ability: 'goSteal', label: '고 할 때 피 뺏기', unlock: { type: 'gold', price: 50 },
    val: lin(10, 3), text: (lv) => `고를 부를 때마다 ${lin(10, 3)(lv)}% 확률로 상대 피 1장을 가져옵니다 (한 판에 최대 ${lv >= 7 ? 3 : 2}장)` },
  { id: 'dosa', name: '청운도사', title: '구름 위의 도사', color: '#4a4478', look: 'sage', ability: 'spell', label: '주문 성공률', unlock: { type: 'gold', price: 80 },
    val: (lv) => Math.round(3 + 1.5 * (lv - 1)), text: (lv) => `장착한 주문 카드의 성공 확률이 ${Math.round(3 + 1.5 * (lv - 1))}% 오릅니다` },
];
export const goStealCap = (lv: number) => (lv >= 7 ? 3 : 2);

// ---------- 저장 ----------
interface CState { owned: Record<string, number>; cur: string; plays: number; wins: number }
const KEY = 'mg-char-v1';
let st: CState = { owned: { hanryang: 1 }, cur: 'hanryang', plays: 0, wins: 0 };
try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (v && v.owned) st = { ...st, ...v }; } catch { /* 무시 */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* 무시 */ } };
const def = (id: string) => CHARS.find((c) => c.id === id)!;

export const levelOf = (id: string) => st.owned[id] ?? 0;
export function current(): { def: CharDef; lv: number } { const d = CHARS.find((c) => c.id === st.cur && st.owned[c.id]) ?? CHARS[0]; return { def: d, lv: levelOf(d.id) || 1 }; }
/** 지금 데리고 있는 캐릭터의 능력 수치 (그 능력이 아니면 0) */
export function ability(a: Ability): number { const c = current(); return c.def.ability === a ? c.def.val(c.lv) : 0; }

let listeners: (() => void)[] = [];
export const onChars = (f: () => void) => { listeners.push(f); };
const changed = () => listeners.forEach((f) => f());

/** 판이 끝날 때 기록 → 해금 조건 확인. 새로 열린 캐릭터 이름을 돌려준다 */
export function recordGame(win: boolean): string[] {
  st.plays++; if (win) st.wins++;
  const opened: string[] = [];
  for (const c of CHARS) {
    if (st.owned[c.id]) continue;
    const u = c.unlock;
    if ((u.type === 'play' && st.plays >= u.n) || (u.type === 'win' && st.wins >= u.n)) { st.owned[c.id] = 1; opened.push(c.name); }
  }
  save(); if (opened.length) changed();
  return opened;
}
export function buy(id: string): boolean {
  const c = def(id); if (st.owned[id] || c.unlock.type !== 'gold') return false;
  if (!pay('geum', c.unlock.price)) return false;
  st.owned[id] = 1; save(); changed(); return true;
}
export function upgrade(id: string): boolean {
  const lv = levelOf(id); if (!lv || lv >= MAX_LV) return false;
  if (!pay('eun', UP_COST[lv - 1])) return false;
  st.owned[id] = lv + 1; save(); changed(); return true;
}
export function select(id: string) { if (!st.owned[id]) return; st.cur = id; save(); changed(); }

// ---------- 초상(메달) ----------
// 조선 인물 반신상: 얼굴(눈·눈썹·코·입·볼), 머리·쓰개, 옷(깃·동정·고름), 소품까지 갖춘 그림.
let seq = 0;
interface FaceOpt { skin: string; shade: string; brow?: string; eyes?: 'open' | 'smile' | 'calm'; lip?: string; blush?: number; mustache?: boolean; beard?: 'none' | 'short' | 'long' | 'white'; age?: boolean }
function face(k: string, o: FaceOpt): string {
  const eye = (x: number, flip: number) => o.eyes === 'smile'
    ? `<path d="M${x - 5} 69 q5 -4 10 0" stroke="#2a1a12" stroke-width="1.6" fill="none" stroke-linecap="round"/>`
    : `<path d="M${x - 5.5} 69 q5.5 -4 11 0 q-5.5 2.6 -11 0z" fill="#fff8ee"/><circle cx="${x + flip * 0.3}" cy="68.6" r="2.3" fill="#1d1410"/><circle cx="${x + 0.8}" cy="67.8" r=".7" fill="#fff"/>
       <path d="M${x - 5.8} 68.8 q5.8 -4.4 11.6 0" stroke="#1d1410" stroke-width="1.5" fill="none" stroke-linecap="round"/>${o.eyes === 'calm' ? `<path d="M${x - 5.5} 68.6 q5.5 -2.6 11 0" stroke="#1d1410" stroke-width="2.6" fill="none" opacity=".75"/>` : ''}`;
  const beard = o.beard === 'long' || o.beard === 'white'
    ? `<path d="M50 82 Q60 92 70 82 Q72 98 66 108 Q60 114 54 108 Q48 98 50 82Z" fill="${o.beard === 'white' ? '#eeeae2' : '#2a1d16'}"/><path d="M56 92 V106 M60 92 V110 M64 92 V106" stroke="${o.beard === 'white' ? '#cfc9bd' : '#120c09'}" stroke-width=".8"/>`
    : o.beard === 'short' ? `<path d="M51 83 Q60 93 69 83 Q67 92 60 94 Q53 92 51 83Z" fill="#2a1d16"/>` : '';
  return `<defs><radialGradient id="${k}sk" cx="45%" cy="40%" r="65%"><stop offset="0" stop-color="${o.skin}"/><stop offset="1" stop-color="${o.shade}"/></radialGradient></defs>
    <path d="M54 84 h12 v12 h-12z" fill="${o.shade}"/>
    <ellipse cx="42.5" cy="71" rx="3.4" ry="5.4" fill="${o.shade}"/><ellipse cx="77.5" cy="71" rx="3.4" ry="5.4" fill="${o.shade}"/>
    <path d="M43 64 Q43 46 60 46 Q77 46 77 64 Q77 80 68 87 Q60 92 52 87 Q43 80 43 64Z" fill="url(#${k}sk)"/>
    ${o.age ? '<path d="M50 60 q4 -1.5 8 0 M62 60 q4 -1.5 8 0" stroke="#a88a74" stroke-width=".7" fill="none"/>' : ''}
    <path d="M47.5 63.2 q5 -3 10 -.6 M62.5 62.6 q5 -2.4 10 .6" stroke="${o.brow ?? '#2a1a12'}" stroke-width="2" fill="none" stroke-linecap="round"/>
    ${eye(53, 1)}${eye(67, -1)}
    <path d="M60 70 q-1.6 6 -.6 8.4 q1.6 .8 3 -.2" stroke="${o.shade}" stroke-width="1.2" fill="none" stroke-linecap="round"/>
    ${o.blush ? `<ellipse cx="50" cy="77" rx="4.5" ry="2.4" fill="#e88a8a" opacity="${o.blush}"/><ellipse cx="70" cy="77" rx="4.5" ry="2.4" fill="#e88a8a" opacity="${o.blush}"/>` : ''}
    <path d="M55.5 82.4 q4.5 ${o.eyes === 'smile' ? 3.4 : 2} 9 0" stroke="${o.lip ?? '#a8564e'}" stroke-width="${o.lip ? 2.4 : 1.6}" fill="none" stroke-linecap="round"/>
    ${o.mustache ? '<path d="M53 80 q3.5 -2.6 7 -.6 q3.5 -2 7 .6 q-3.5 1.2 -7 .2 q-3.5 1 -7 -.2Z" fill="#2a1d16"/>' : ''}
    ${beard}`;
}
/** 남자 옷(도포·두루마기): 깃·동정 */
const robe = (col: string, dark: string, inner = '#f4ecdc') => `<path d="M14 150 Q16 108 44 98 L60 112 L76 98 Q104 108 106 150Z" fill="${col}"/>
  <path d="M44 98 L60 124 L76 98" fill="none" stroke="${inner}" stroke-width="5" stroke-linejoin="round"/>
  <path d="M44 98 L60 124 L76 98" fill="none" stroke="${dark}" stroke-width="1.2" opacity=".7" transform="translate(0 4)"/>
  <path d="M28 150 Q30 124 40 112 M92 150 Q90 124 80 112" stroke="${dark}" stroke-width="1.2" fill="none" opacity=".45"/>`;
/** 여자 저고리: 깃·동정·고름 */
const jeogori = (col: string, trim: string, ribbon: string) => `<path d="M16 150 Q18 110 46 100 L60 108 L74 100 Q102 110 104 150Z" fill="${col}"/>
  <path d="M46 100 Q56 110 58 124 L70 104" fill="none" stroke="${trim}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M47 100 Q56 109 58 121" fill="none" stroke="#fffaf0" stroke-width="2"/>
  <path d="M58 124 q-6 10 -12 26 M58 124 q2 12 8 26" stroke="${ribbon}" stroke-width="4.5" fill="none" stroke-linecap="round"/>
  <path d="M54 122 q4 -4 8 0 q-4 4 -8 0z" fill="${ribbon}"/>`;
/** 갓: 반투명 말총 양태 + 대우 + 갓끈 */
const gat = (bead = '#c9a36a') => `<path d="M48 49 L49 28 Q60 23 71 28 L72 49Z" fill="#0f0d0c" opacity=".88"/>
  <path d="M49 33 Q60 30 71 33" stroke="#3a3330" stroke-width="1.6" fill="none"/>
  <ellipse cx="60" cy="49" rx="42" ry="8" fill="#0f0d0c" opacity=".55"/>
  <ellipse cx="60" cy="49" rx="42" ry="8" fill="none" stroke="#0f0d0c" stroke-width="1.6" opacity=".9"/>
  <ellipse cx="60" cy="49" rx="13" ry="3" fill="#0f0d0c" opacity=".9"/>
  <path d="M41 52 Q42 78 52 96 M79 52 Q78 78 68 96" stroke="${bead}" stroke-width="2.6" fill="none" stroke-dasharray="2.4 2.2" stroke-linecap="round"/>`;
/** 망건·상투 아래 옆머리 */
const sideHair = '<path d="M43 64 Q42 52 48 49 L72 49 Q78 52 77 64 Q75 56 72 54 L48 54 Q45 56 43 64Z" fill="#1a1411"/><rect x="45" y="51" width="30" height="4" rx="1.5" fill="#2a221e"/>';

function portraitBody(c: CharDef, k: string): string {
  const skin = { skin: '#f6dcc2', shade: '#d9ae8c' };
  switch (c.look) {
    case 'gat': // 한량: 하늘빛 도포, 합죽선
      return `${robe('#7f9fbf', '#4a6688')}${face(k, { ...skin, eyes: 'smile', mustache: true })}${sideHair}${gat()}
        <g transform="translate(86 118) rotate(-24)"><path d="M0 0 L-14 -26 A30 30 0 0 1 14 -26 Z" fill="#efe4c8" stroke="#8a6a3a" stroke-width="1"/><path d="M0 0 L-7 -28 M0 0 L0 -29 M0 0 L7 -28" stroke="#b49460" stroke-width=".7"/><circle r="2" fill="#6a4a2a"/></g>`;
    case 'bun': // 주모: 머릿수건, 무명 저고리, 앞치마
      return `${jeogori('#e9dcc2', '#8a5a3a', '#a33a2a')}<path d="M30 150 Q34 128 60 126 Q86 128 90 150Z" fill="#f6f1e6" opacity=".9"/>
        ${face(k, { skin: '#f3d3b4', shade: '#d4a07e', eyes: 'smile', blush: .35, lip: '#b55a50' })}
        <path d="M41 66 Q40 44 60 42 Q80 44 79 66 Q76 52 60 51 Q44 52 41 66Z" fill="#1a1411"/>
        <path d="M38 58 Q40 36 60 34 Q80 36 82 58 Q76 46 60 45 Q44 46 38 58Z" fill="#efe7d8"/><path d="M78 50 q10 4 12 14 q-6 -2 -10 -6z" fill="#efe7d8"/>
        <path d="M40 54 Q60 44 80 54" stroke="#d6cbb6" stroke-width="1.2" fill="none"/>`;
    case 'pack': // 보부상: 패랭이(솜방울), 등짐, 머리띠
      return `<path d="M20 112 Q18 92 30 88 H90 Q102 92 100 112 V140 H20Z" fill="#8a6a40"/><path d="M26 98 H94 M26 110 H94" stroke="#6a4e2c" stroke-width="2"/>
        ${robe('#b9a582', '#7a6648')}<path d="M40 104 L34 150 M80 104 L86 150" stroke="#5a3e22" stroke-width="5"/>
        ${face(k, { skin: '#eac39f', shade: '#c49470', eyes: 'open', beard: 'short', mustache: true })}${sideHair}
        <path d="M44 50 Q47 26 60 26 Q73 26 76 50Z" fill="#c8a868"/><path d="M47 40 Q60 36 73 40 M46 46 Q60 42 74 46" stroke="#a88a4a" stroke-width="1" fill="none"/>
        <ellipse cx="60" cy="50" rx="24" ry="4" fill="#b8985a"/><circle cx="43" cy="50" r="4.5" fill="#fff"/><circle cx="77" cy="50" r="4.5" fill="#fff"/>`;
    case 'flower': // 매화: 가체(얹은머리)·떨잠·비녀, 분홍 저고리
      return `${jeogori('#e7a8b8', '#7a2a44', '#b0284a')}
        ${face(k, { skin: '#fbe6d6', shade: '#e2bba4', eyes: 'calm', blush: .45, lip: '#c0304a', brow: '#3a2420' })}
        <path d="M42 66 Q41 46 60 45 Q79 46 78 66 Q75 52 60 51 Q45 52 42 66Z" fill="#1a1411"/>
        <ellipse cx="60" cy="38" rx="32" ry="13" fill="#1a1411"/><path d="M30 38 Q60 22 90 38 M33 43 Q60 30 87 43" stroke="#3a2e28" stroke-width="1.4" fill="none"/>
        <path d="M30 36 q-6 6 -2 12" stroke="#1a1411" stroke-width="5" fill="none" stroke-linecap="round"/>
        <g transform="translate(80 32)"><circle r="4" fill="#f0a8c0"/><circle cx="5" cy="3" r="3.4" fill="#f0a8c0"/><circle cx="1" cy="6" r="3" fill="#f0a8c0"/><circle cx="2" cy="3" r="1.4" fill="#f3d27a"/></g>
        <path d="M44 32 L38 26 M44 32 l-2 -8" stroke="#f3d27a" stroke-width="1.4"/><circle cx="38" cy="26" r="1.8" fill="#f3d27a"/>`;
    case 'helmet': // 장군: 투구(정자·상모)·두정갑, 수염
      return `<path d="M14 150 Q16 106 44 98 L60 106 L76 98 Q104 106 106 150Z" fill="#7a2222"/>
        ${Array.from({ length: 5 }, (_, r) => Array.from({ length: 9 }, (_, q) => `<circle cx="${22 + q * 9.5 + (r % 2) * 4.5}" cy="${112 + r * 8}" r="1.5" fill="#d6b36a" opacity=".85"/>`).join('')).join('')}
        <path d="M44 98 L60 112 L76 98" fill="none" stroke="#2a1a14" stroke-width="5"/>
        ${face(k, { skin: '#eac2a0', shade: '#c08e6c', eyes: 'open', brow: '#140c08', mustache: true, beard: 'long' })}
        <path d="M40 62 Q40 30 60 28 Q80 30 80 62 Q72 52 60 52 Q48 52 40 62Z" fill="#3a2a22"/>
        <path d="M38 58 H82 L84 63 H36Z" fill="#d6b36a"/><path d="M38 62 Q36 80 42 90 L46 88 Q42 76 43 63Z M82 62 Q84 80 78 90 L74 88 Q78 76 77 63Z" fill="#5a1c1c"/>
        <path d="M60 28 V12" stroke="#d6b36a" stroke-width="3"/><path d="M60 14 Q72 4 76 16 Q68 12 62 20 Q56 12 48 16 Q52 4 60 14Z" fill="#c23a3a"/>
        <path d="M46 40 Q60 34 74 40" stroke="#d6b36a" stroke-width="1.4" fill="none"/>`;
    case 'sage': // 청운도사: 흰 수염, 도관, 학창의(흰 옷 검은 테), 구름
      return `<path d="M8 128 q8 -8 16 -2 q6 -8 14 -2 q8 -6 12 2" fill="#f4f1ea" opacity=".35"/>
        <path d="M14 150 Q16 108 44 98 L60 116 L76 98 Q104 108 106 150Z" fill="#f2efe8"/><path d="M14 150 Q16 108 44 98 M106 150 Q104 108 76 98" stroke="#1a1a1e" stroke-width="5" fill="none"/>
        <path d="M44 98 L60 120 L76 98" fill="none" stroke="#1a1a1e" stroke-width="5"/>
        ${face(k, { skin: '#f3d8c0', shade: '#d4ae94', eyes: 'smile', brow: '#e8e4dc', beard: 'white', age: true })}
        <path d="M51 80 q4.5 -3 9 -.6 q4.5 -2.4 9 .6 q-4.5 2 -9 .4 q-4.5 1.6 -9 -.4Z" fill="#eeeae2"/>
        <path d="M43 64 Q42 48 60 46 Q78 48 77 64 Q74 54 60 53 Q46 54 43 64Z" fill="#e8e4dc"/>
        <path d="M50 46 L52 30 H68 L70 46Z" fill="#1a1a1e"/><rect x="48" y="44" width="24" height="4" rx="1" fill="#2a2a30"/><path d="M60 30 V24" stroke="#d6b36a" stroke-width="2"/><circle cx="60" cy="23" r="2.4" fill="#d6b36a"/>`;
  }
}
/** 일러스트 파일(assets/chars/<id>.webp)이 있는 캐릭터. 없으면 코드로 그린 초상을 쓴다 */
export const CHAR_ART = new Set<string>(['hanryang', 'jumo', 'bobu', 'maehwa', 'janggun', 'dosa']);
export function portrait(c: CharDef, lv = 1): string {
  const k = `ch${++seq}`;
  const ring = lv >= 10 ? '#f3d27a' : lv >= 7 ? '#d6b36a' : lv >= 4 ? '#b8a27a' : '#8f8a80';
  return `<svg viewBox="0 0 120 150" class="ch-art" aria-hidden="true">
    <defs><radialGradient id="${k}b" cx="50%" cy="36%" r="72%"><stop offset="0" stop-color="${c.color}" stop-opacity=".7"/><stop offset=".7" stop-color="#14161c"/><stop offset="1" stop-color="#0b0c10"/></radialGradient>
    <clipPath id="${k}c"><rect x="4" y="4" width="112" height="142" rx="56" ry="56"/></clipPath>
    <linearGradient id="${k}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b0c10" stop-opacity="0"/><stop offset="1" stop-color="#0b0c10" stop-opacity=".55"/></linearGradient></defs>
    <rect x="4" y="4" width="112" height="142" rx="56" ry="56" fill="url(#${k}b)"/>
    <g clip-path="url(#${k}c)">${CHAR_ART.has(c.id)
      ? `<image href="chars/${c.id}.webp" x="4" y="4" width="112" height="142" preserveAspectRatio="xMidYMin slice"/><rect x="4" y="110" width="112" height="36" fill="url(#${k}f)"/>`
      : `<circle cx="60" cy="56" r="44" fill="#f4ecdc" opacity=".06"/>${portraitBody(c, k)}`}</g>
    <rect x="4" y="4" width="112" height="142" rx="56" ry="56" fill="none" stroke="${ring}" stroke-width="2.5"/>
    <rect x="9" y="9" width="102" height="132" rx="51" ry="51" fill="none" stroke="${ring}" stroke-width=".8" opacity=".6"/>
  </svg>`;
}

// ---------- 화면 ----------
const $ = (id: string) => document.getElementById(id)!;
let pick = '';
function unlockText(c: CharDef): string {
  const u = c.unlock;
  if (u.type === 'free') return '처음부터';
  if (u.type === 'play') return `판 ${u.n}번 하면 해금 (${Math.min(st.plays, u.n)}/${u.n})`;
  if (u.type === 'win') return `판 ${u.n}번 이기면 해금 (${Math.min(st.wins, u.n)}/${u.n})`;
  return `금화 ${u.price}개로 영입`;
}
export function renderChars() {
  const cur = current().def.id;
  if (!pick) pick = cur;
  const c = def(pick); const lv = levelOf(c.id); const owned = lv > 0;
  const shownLv = owned ? lv : 1;
  const next = owned && lv < MAX_LV ? c.text(lv + 1) : '';
  let action = '';
  if (!owned && c.unlock.type === 'gold') action = `<button type="button" class="ch-btn buy" data-act="buy" ${bal('geum') < c.unlock.price ? 'disabled' : ''}>${curIco('geum')} ${c.unlock.price} 영입</button>`;
  else if (!owned) action = `<button type="button" class="ch-btn" disabled>${unlockText(c)}</button>`;
  else {
    action = (cur === c.id ? '<button type="button" class="ch-btn on" disabled>함께하는 중</button>' : '<button type="button" class="ch-btn" data-act="sel">함께하기</button>')
      + (lv < MAX_LV ? `<button type="button" class="ch-btn up" data-act="up" ${bal('eun') < UP_COST[lv - 1] ? 'disabled' : ''}>${curIco('eun')} ${UP_COST[lv - 1]} 레벨 올리기</button>` : '<button type="button" class="ch-btn up" disabled>최고 레벨</button>');
  }
  const pips = Array.from({ length: MAX_LV }, (_, i) => `<i class="${i < (owned ? lv : 0) ? 'on' : ''}"></i>`).join('');
  $('ch-hero').innerHTML = `<div class="ch-portrait${owned ? '' : ' locked'}">${portrait(c, shownLv)}</div>
    <div class="ch-info"><div class="ch-title">${c.title}</div><div class="ch-name">${c.name}${owned ? ` <small>Lv.${lv}</small>` : ''}</div>
      <div class="ch-pips" aria-label="레벨 ${owned ? lv : 0} / ${MAX_LV}">${pips}</div>
      <div class="ch-abil"><span>${c.label}</span><p>${c.text(shownLv)}</p>${next ? `<p class="ch-next">다음 레벨 → ${c.text(lv + 1)}</p>` : ''}</div>
      <div class="ch-acts">${action}</div></div>`;
  $('ch-list').innerHTML = CHARS.map((x) => {
    const l = levelOf(x.id);
    return `<button type="button" class="ch-cell${x.id === pick ? ' cur' : ''}${l ? '' : ' locked'}" data-id="${x.id}">
      ${portrait(x, l || 1)}<b>${x.name}</b><small>${l ? `Lv.${l}${x.id === cur ? ' · 함께' : ''}` : x.unlock.type === 'gold' ? `${curIco('geum')}${x.unlock.price}` : '잠김'}</small></button>`;
  }).join('');
  $('ch-list').querySelectorAll<HTMLButtonElement>('.ch-cell').forEach((b) => b.addEventListener('click', () => { pick = b.dataset.id!; sfx.click(); renderChars(); }));
  $('ch-hero').querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) => b.addEventListener('click', () => {
    const a = b.dataset.act;
    const ok = a === 'buy' ? buy(c.id) : a === 'up' ? upgrade(c.id) : (select(c.id), true);
    if (ok) { if (a === 'sel') sfx.click(); else sfx.bonus(); } else sfx.buzz([40]);
    renderChars();
    if (ok && a === 'up') { const p = $('ch-hero').querySelector('.ch-portrait'); p?.classList.add('lvup'); }
  }));
}
/** 홈 화면의 캐릭터 칸 */
export function renderHomeChar() {
  const el = document.getElementById('btn-chars'); if (!el) return;
  const { def: c, lv } = current();
  el.innerHTML = `<span class="hc-art">${portrait(c, lv)}</span><span class="hc-txt"><b>${c.name} <small>Lv.${lv}</small></b><span>${c.label} · ${c.val(lv)}%</span></span><em>캐릭터 · 아이템</em>`;
}
export function initChars(onChange: () => void) {
  onChars(() => { renderHomeChar(); onChange(); });
  renderHomeChar();
  $('btn-chars').addEventListener('click', () => { sfx.unlock(); sfx.click(); pick = current().def.id; renderChars(); $('chars').hidden = false; });
  $('chars').querySelectorAll<HTMLElement>('[data-close]').forEach((b) => b.addEventListener('click', () => { $('chars').hidden = true; }));
}
