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
let seq = 0;
export function portrait(c: CharDef, lv = 1): string {
  const k = `ch${++seq}`;
  const skin = '#f1d9bd';
  const ink = '#16120f';
  const head = `<circle cx="60" cy="66" r="17" fill="${skin}"/><path d="M53 66 q3 2 6 0 M61 66 q3 2 6 0" stroke="#5a3a2a" stroke-width="1.4" fill="none" stroke-linecap="round"/><path d="M57 74 q3 1.6 6 0" stroke="#b0605a" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
  const body = `<path d="M18 150 Q22 102 60 92 Q98 102 102 150Z" fill="${c.color}"/><path d="M60 92 L46 100 L60 126 L74 100Z" fill="#f4ecdc"/><path d="M48 99 L60 122 L72 99" stroke="${c.color}" stroke-width="5" fill="none"/>`;
  const looks: Record<Look, string> = {
    gat: `${body}${head}<ellipse cx="60" cy="52" rx="36" ry="6" fill="${ink}" opacity=".88"/><path d="M47 52 Q47 28 60 28 Q73 28 73 52Z" fill="${ink}" opacity=".9"/><path d="M42 54 Q40 76 46 90 M78 54 Q80 76 74 90" stroke="${ink}" stroke-width="1" fill="none" opacity=".5"/>`,
    bun: `${body}<path d="M41 66 Q40 44 60 42 Q80 44 79 66 Q76 52 60 51 Q44 52 41 66Z" fill="${ink}"/>${head}<path d="M43 64 Q44 47 60 46 Q76 47 77 64 Q72 54 60 53 Q48 54 43 64Z" fill="${ink}"/><ellipse cx="60" cy="40" rx="14" ry="8" fill="${ink}"/><path d="M38 40 H84" stroke="#d6b36a" stroke-width="2.4" stroke-linecap="round"/><path d="M40 112 Q60 120 80 112" stroke="#f4ecdc" stroke-width="5" fill="none" opacity=".6"/>`,
    pack: `<path d="M22 96 Q20 80 34 78 H86 Q100 80 98 96 V140 H22Z" fill="#7a5a36"/><path d="M30 86 H90" stroke="#5a4026" stroke-width="3"/>${body}${head}<ellipse cx="60" cy="52" rx="30" ry="5" fill="#8a6a40"/><path d="M48 52 Q48 34 60 34 Q72 34 72 52Z" fill="#8a6a40"/><circle cx="60" cy="34" r="3" fill="#d6b36a"/>`,
    flower: `${body}<path d="M40 70 Q38 44 60 42 Q82 44 80 70 Q78 52 60 51 Q42 52 40 70Z" fill="${ink}"/>${head}<path d="M42 66 Q42 47 60 46 Q78 47 78 66 Q74 54 60 53 Q46 54 42 66Z" fill="${ink}"/><path d="M28 50 Q60 18 92 50 Q60 36 28 50Z" fill="${ink}"/><g fill="#e98aa8"><circle cx="82" cy="44" r="4"/><circle cx="88" cy="48" r="3.4"/><circle cx="84" cy="51" r="3"/></g><circle cx="84" cy="47" r="1.4" fill="#ffe08a"/>`,
    helmet: `${body}<path d="M30 112 L60 104 L90 112 L86 140 H34Z" fill="#3a2a22" opacity=".55"/>${head}<path d="M40 60 Q40 30 60 28 Q80 30 80 60 Q70 52 60 52 Q50 52 40 60Z" fill="#5a1818"/><path d="M36 60 H84" stroke="#d6b36a" stroke-width="3"/><path d="M60 28 V14" stroke="#d6b36a" stroke-width="2.4"/><path d="M60 16 Q70 8 74 18 Q66 14 60 22Z" fill="#c23a3a"/>`,
    sage: `${body}${head}<path d="M48 76 Q60 112 72 76 Q66 84 60 84 Q54 84 48 76Z" fill="#f4f1ea"/><path d="M44 50 Q44 30 60 30 Q76 30 76 50Z" fill="${ink}" opacity=".85"/><path d="M40 50 H80" stroke="${ink}" stroke-width="3" opacity=".85"/><path d="M10 120 Q24 108 38 118 Q50 108 62 120" stroke="#f4f1ea" stroke-width="2" fill="none" opacity=".5"/>`,
  };
  const ring = lv >= 10 ? '#f3d27a' : lv >= 7 ? '#d6b36a' : lv >= 4 ? '#b8a27a' : '#8f8a80';
  return `<svg viewBox="0 0 120 150" class="ch-art" aria-hidden="true">
    <defs><radialGradient id="${k}b" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="${c.color}" stop-opacity=".55"/><stop offset="1" stop-color="#0d0f14"/></radialGradient>
    <clipPath id="${k}c"><rect x="4" y="4" width="112" height="142" rx="56" ry="56"/></clipPath></defs>
    <rect x="4" y="4" width="112" height="142" rx="56" ry="56" fill="url(#${k}b)"/>
    <g clip-path="url(#${k}c)"><circle cx="60" cy="58" r="40" fill="#f4ecdc" opacity=".07"/>${looks[c.look]}</g>
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
  el.innerHTML = `<span class="hc-art">${portrait(c, lv)}</span><span class="hc-txt"><b>${c.name} <small>Lv.${lv}</small></b><span>${c.label} · ${c.val(lv)}%</span></span><em>캐릭터</em>`;
}
export function initChars(onChange: () => void) {
  onChars(() => { renderHomeChar(); onChange(); });
  renderHomeChar();
  $('btn-chars').addEventListener('click', () => { sfx.unlock(); sfx.click(); pick = current().def.id; renderChars(); $('chars').hidden = false; });
  $('chars').querySelectorAll<HTMLElement>('[data-close]').forEach((b) => b.addEventListener('click', () => { $('chars').hidden = true; }));
}
