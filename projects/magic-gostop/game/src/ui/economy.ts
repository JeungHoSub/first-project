// 재화 경제: 오늘의 미션(은화) · 윷놀이 내기(엽전 → 엽전·은화) · 은화 상점(승급·직접 구매·꾸미기) · 금화 상점(금화 → 엽전).
// 원칙(monet.ts): 어떤 재화도 돈으로 팔지 않는다. 금화는 무료로만(광고 하루 1번·오늘 미션 모두 완료·금은 보따리). 윷놀이 내기로는 금화를 얻을 수 없다.
import { ITEMS, GRADES, GRADE_COLOR, itemArt, bestGrade, ownedOf, grantItem, upgradable, upgradeItem, UPGRADE_SILVER, UPGRADE_NEED, CATEGORY_LABEL } from './collection';
import { bal, add, pay, fmt, curIco, EXCHANGE, exchange, onCoins, type Cur } from './wallet';
import * as sfx from './sound';

const $ = (id: string) => document.getElementById(id)!;
const badge = (gi: number) => {
  const c = GRADE_COLOR[GRADES[gi]];
  return `<span class="gbadge${c === 'rainbow' ? ' rainbow' : ''}" style="${c === 'rainbow' ? '' : `--gc:${c}`}">${GRADES[gi]}</span>`;
};
let onChange: () => void = () => {};
let toast: (msg: string) => void = () => {};

// ================= 오늘의 미션 =================
interface Mission { id: string; text: string; goal: number; reward: number; yeop: number }
export const MISSIONS: Mission[] = [
  { id: 'play', text: '판 3번 하기', goal: 3, reward: 3, yeop: 500 },
  { id: 'win', text: '판 2번 이기기', goal: 2, reward: 5, yeop: 1000 },
  { id: 'go', text: '고 3번 부르기', goal: 3, reward: 3, yeop: 500 },
  { id: 'special', text: '뻑 먹기·쪽·따닥·싹쓸이 합쳐 2번', goal: 2, reward: 4, yeop: 800 },
  { id: 'pibak', text: '상대에게 피박 씌우기', goal: 1, reward: 5, yeop: 1000 },
  { id: 'yut', text: '윷놀이 내기 5번 던지기', goal: 5, reward: 2, yeop: 300 },
];
interface MState { day: string; prog: Record<string, number>; claimed: string[] }
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
let ms: MState = { day: today(), prog: {}, claimed: [] };
try { const v = JSON.parse(localStorage.getItem('mg-missions-v1') || 'null'); if (v && v.day) ms = v; } catch { /* 무시 */ }
const saveM = () => { try { localStorage.setItem('mg-missions-v1', JSON.stringify(ms)); } catch { /* 무시 */ } };
function rollDay() { if (ms.day !== today()) { ms = { day: today(), prog: {}, claimed: [] }; saveM(); } }
/** 게임 중 일어난 일을 미션에 기록 */
export function record(id: string, n = 1) {
  rollDay();
  const m = MISSIONS.find((x) => x.id === id); if (!m || n <= 0) return;
  const before = ms.prog[id] ?? 0;
  ms.prog[id] = Math.min(m.goal, before + n); saveM();
  if (before < m.goal && ms.prog[id] >= m.goal) toast(`미션 완료 · ${m.text} (은화 ${m.reward} · 엽전 ${fmt(m.yeop)} 받기)`);
}
export const missionReady = () => { rollDay(); return MISSIONS.filter((m) => (ms.prog[m.id] ?? 0) >= m.goal && !ms.claimed.includes(m.id)).length; };
function renderMissions() {
  rollDay();
  $('ms-list').innerHTML = MISSIONS.map((m) => {
    const p = ms.prog[m.id] ?? 0; const done = p >= m.goal; const got = ms.claimed.includes(m.id);
    return `<li class="ms-row${got ? ' got' : done ? ' done' : ''}">
      <div class="ms-txt"><b>${m.text}</b><span class="ms-bar"><i style="width:${(p / m.goal) * 100}%"></i></span><small>${p} / ${m.goal}</small></div>
      <button type="button" class="ms-claim" data-id="${m.id}" ${!done || got ? 'disabled' : ''}>${got ? '받음' : `${curIco('eun')} ${m.reward} ${curIco('yeop')} ${fmt(m.yeop)}`}</button></li>`;
  }).join('');
  $('ms-list').querySelectorAll<HTMLButtonElement>('.ms-claim').forEach((b) => b.addEventListener('click', () => {
    const m = MISSIONS.find((x) => x.id === b.dataset.id)!;
    if (ms.claimed.includes(m.id) || (ms.prog[m.id] ?? 0) < m.goal) return;
    ms.claimed.push(m.id); saveM(); add('eun', m.reward); add('yeop', m.yeop); sfx.reward(); sfx.coinRain(500);
    if (ms.claimed.length === MISSIONS.length) { add('geum', 1); toast('오늘 미션 모두 완료! 금화 +1'); }
    renderMissions(); onChange();
  }));
}

// ================= 윷놀이 내기 =================
// 윷가락 4개, 평평한 면(배)이 위로 올 확률 0.6. 배당은 실제 확률보다 약간 낮게(되돌려 주는 비율 약 90%) — 엽전이 불어나지 않게.
const P_FLAT = 0.6;
export const YUT = [
  { id: 'do', name: '도', flats: 1, mult: 6 },
  { id: 'gae', name: '개', flats: 2, mult: 2.6 },
  { id: 'geol', name: '걸', flats: 3, mult: 2.6 },
  { id: 'yut', name: '윷', flats: 4, mult: 7, eun: 2 },
  { id: 'mo', name: '모', flats: 0, mult: 35, eun: 5 },
];
const BETS = [100, 500, 1000, 5000];
const DAILY_THROWS = 30; // 하루 던지기 한도
let yBet = 500; let yPick = 'gae'; let yBusy = false;
interface YState { day: string; n: number }
let ys: YState = { day: today(), n: 0 };
try { const v = JSON.parse(localStorage.getItem('mg-yut-v1') || 'null'); if (v && v.day) ys = v; } catch { /* 무시 */ }
const saveY = () => { try { localStorage.setItem('mg-yut-v1', JSON.stringify(ys)); } catch { /* 무시 */ } };
function renderYut() {
  if (ys.day !== today()) { ys = { day: today(), n: 0 }; saveY(); }
  $('yt-bets').innerHTML = BETS.map((b) => `<button type="button" class="yt-bet${b === yBet ? ' on' : ''}" data-b="${b}">${curIco('yeop')}${fmt(b)}</button>`).join('');
  $('yt-picks').innerHTML = YUT.map((y) => `<button type="button" class="yt-pick${y.id === yPick ? ' on' : ''}" data-id="${y.id}">${miniSticks(y.flats)}<b>${y.name}</b><small>×${y.mult}${y.eun ? ` · ${curIco('eun')}${y.eun}` : ''}</small></button>`).join('');
  $('yt-left').textContent = `오늘 ${DAILY_THROWS - ys.n}번 남음`;
  if (!$('yt-stage').innerHTML) $('yt-stage').innerHTML = [true, false, true, false].map((f, i) => stickHtml(f, i, false)).join('');
  const btn = $('yt-throw') as HTMLButtonElement;
  btn.disabled = yBusy || ys.n >= DAILY_THROWS || bal('yeop') < yBet;
  btn.innerHTML = ys.n >= DAILY_THROWS ? '오늘은 여기까지' : `던지기 · ${curIco('yeop')}${fmt(yBet)}`;
  $('yt-bets').querySelectorAll<HTMLButtonElement>('.yt-bet').forEach((b) => b.addEventListener('click', () => { if (yBusy) return; yBet = +b.dataset.b!; sfx.click(); renderYut(); }));
  $('yt-picks').querySelectorAll<HTMLButtonElement>('.yt-pick').forEach((b) => b.addEventListener('click', () => { if (yBusy) return; yPick = b.dataset.id!; sfx.click(); renderYut(); }));
}
/** 실물 윷가락 그림: 배(평평한 면)는 밝은 나뭇결, 등(둥근 면)은 진한 원통에 X 새김 */
let ysq = 0;
function stickSvg(flat: boolean): string {
  const k = `ys${++ysq}`;
  return `<svg viewBox="0 0 30 150" aria-hidden="true"><defs>
    <linearGradient id="${k}f" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c9a36a"/><stop offset=".12" stop-color="#ecd3a0"/><stop offset=".5" stop-color="#f6e4bc"/><stop offset=".88" stop-color="#e6c992"/><stop offset="1" stop-color="#b8915a"/></linearGradient>
    <linearGradient id="${k}r" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3e2610"/><stop offset=".3" stop-color="#8a5a2c"/><stop offset=".45" stop-color="#b47c44"/><stop offset=".62" stop-color="#7a4c22"/><stop offset="1" stop-color="#2e1c0a"/></linearGradient>
  </defs>
  <rect x="1" y="1" width="28" height="148" rx="14" fill="url(#${k}${flat ? 'f' : 'r'})" stroke="${flat ? '#8a6a3a' : '#22140a'}" stroke-width="1.2"/>
  ${flat
    ? `<g fill="none" stroke="#a8824c" stroke-opacity=".45" stroke-width=".8"><path d="M9 14 C7 50 11 90 8 136"/><path d="M15 10 C17 44 13 96 16 140"/><path d="M21 16 C23 60 19 100 22 134"/><path d="M12 60 c3 4 3 10 0 14 c-3 -4 -3 -10 0 -14z"/></g>
       <rect x="3" y="3" width="24" height="144" rx="12" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1"/>`
    : `${[38, 75, 112].map((y) => `<g stroke-linecap="round"><path d="M9 ${y - 7} L21 ${y + 7} M21 ${y - 7} L9 ${y + 7}" stroke="#1a0e05" stroke-width="2.6"/><path d="M9.6 ${y - 6} L21.6 ${y + 8} M21.6 ${y - 6} L9.6 ${y + 8}" stroke="#d9a868" stroke-opacity=".35" stroke-width="1"/></g>`).join('')}
       <path d="M13 6 C12 50 14 100 13 144" stroke="#e2b07a" stroke-opacity=".35" stroke-width="2" fill="none"/>`}
  </svg>`;
}
function stickHtml(flat: boolean, i: number, land = true) {
  const x = land ? (i - 1.5) * 52 + (Math.random() * 24 - 12) : (i - 1.5) * 34;
  const y = land ? Math.random() * 30 - 15 : 0;
  const r = land ? Math.random() * 70 - 35 + (i % 2 ? 90 : 0) * (Math.random() < 0.35 ? 1 : 0) : 0;
  return `<div class="yt-stick" style="--i:${i};--lx:${x.toFixed(0)}px;--ly:${y.toFixed(0)}px;--lr:${r.toFixed(0)}deg">${stickSvg(flat)}</div>`;
}
/** 고르기 버튼 아이콘: 그 결과가 나올 때의 윷가락 4개 (배=밝음, 등=진함) */
const miniSticks = (flats: number) => `<span class="yt-mini">${[0, 1, 2, 3].map((i) => `<i class="${i < flats ? 'f' : 'r'}"></i>`).join('')}</span>`;
async function throwYut() {
  if (yBusy || ys.n >= DAILY_THROWS) return;
  if (!pay('yeop', yBet)) { sfx.buzz([40]); return; }
  yBusy = true; ys.n++; saveY(); record('yut');
  const faces = Array.from({ length: 4 }, () => Math.random() < P_FLAT);
  const flats = faces.filter(Boolean).length;
  const res = YUT.find((y) => y.flats === flats)!;
  const stage = $('yt-stage');
  stage.classList.remove('landed'); $('yt-result').textContent = '';
  stage.innerHTML = faces.map((f, i) => stickHtml(f, i)).join('');
  void stage.offsetWidth; stage.classList.add('toss');
  sfx.yutToss();
  await new Promise((r) => setTimeout(r, 1100));
  stage.classList.remove('toss'); stage.classList.add('landed');
  sfx.yutLand();
  const win = res.id === yPick;
  const out = $('yt-result');
  if (win) {
    const gain = Math.floor(yBet * res.mult); add('yeop', gain);
    if (res.eun) add('eun', res.eun);
    out.innerHTML = `<b>${res.name}!</b><span>맞혔습니다 · ${curIco('yeop')}+${fmt(gain)}${res.eun ? ` · ${curIco('eun')}+${res.eun}` : ''}</span>`;
    out.className = 'yt-result win'; sfx.reward(); if (res.mult >= 7) sfx.win();
  } else {
    out.innerHTML = `<b>${res.name}</b><span>아쉽네요 · ${YUT.find((y) => y.id === yPick)!.name}에 걸었습니다</span>`; out.className = 'yt-result lose';
  }
  yBusy = false; renderYut(); onChange();
}

// ================= 은화 상점 =================
let sTab: 'up' | 'shop' | 'look' = 'up';
let shopGrade = 0;
const SHOP_PRICE = [5, 10, 20, 35]; // F E D C
const LOOK_GRADES = [2, 4, 6]; const LOOK_PRICE = [20, 50, 120]; // 꾸미기: D B S
let lookPick = 0;
function renderSilver() {
  const tabs = [['up', '승급'], ['shop', '아이템'], ['look', '꾸미기']] as const;
  $('sv-tabs').innerHTML = tabs.map(([k, l]) => `<button type="button" class="tab${sTab === k ? ' cur' : ''}" data-k="${k}">${l}</button>`).join('');
  $('sv-tabs').querySelectorAll<HTMLButtonElement>('.tab').forEach((b) => b.addEventListener('click', () => { sTab = b.dataset.k as typeof sTab; sfx.click(); renderSilver(); }));
  const box = $('sv-body');
  const row = (it: (typeof ITEMS)[number], gi: number, right: string) =>
    `<li class="sv-row"><span class="sv-art">${itemArt(it, Math.max(0, gi), gi < 0)}</span><div class="sv-txt"><b>${it.name}</b><small>${CATEGORY_LABEL[it.category]}${gi >= 0 ? ` · 보유 최고 ${GRADES[gi]}` : ' · 아직 없음'}</small></div>${right}</li>`;
  if (sTab === 'up') {
    const list = ITEMS.map((it) => ({ it, g: upgradable(it.id) })).filter((x) => x.g >= 0);
    box.innerHTML = `<p class="tx-sub">같은 아이템·같은 등급 카드를 모아 한 등급 위 1장으로 만듭니다. 필요 장수: F~D 2장 · C~A 3장 · S~SS 4장 · SSS 5장. 아이템 도감에서 카드를 눌러도 승급·분해할 수 있습니다.</p>${
      list.length ? `<ul class="sv-list">${list.map(({ it, g }) => row(it, bestGrade(it.id), `<button type="button" class="sv-buy" data-up="${it.id}" data-g="${g}" ${bal('eun') < UPGRADE_SILVER[g] ? 'disabled' : ''}>${badge(g)}×${UPGRADE_NEED[g]} → ${badge(g + 1)}<span>${curIco('eun')}${UPGRADE_SILVER[g]}</span></button>`)).join('')}</ul>`
        : '<p class="sv-empty">승급할 수 있는 아이템이 없습니다. 같은 등급이 2장 모이면 여기에 나타납니다.</p>'}`;
    box.querySelectorAll<HTMLButtonElement>('[data-up]').forEach((b) => b.addEventListener('click', () => {
      const g = +b.dataset.g!; const id = b.dataset.up!;
      if (!pay('eun', UPGRADE_SILVER[g])) return;
      upgradeItem(id, g); sfx.magic(); toast(`${ITEMS.find((x) => x.id === id)!.name} ${GRADES[g + 1]} 등급으로 승급!`); renderSilver(); onChange();
    }));
  } else if (sTab === 'shop') {
    box.innerHTML = `<p class="tx-sub">원하는 아이템을 낮은 등급으로 바로 삽니다. 높은 등급은 승급으로 올리세요.</p>
      <div class="sv-grade">${SHOP_PRICE.map((p, i) => `<button type="button" class="${i === shopGrade ? 'on' : ''}" data-g="${i}">${badge(i)} ${curIco('eun')}${p}</button>`).join('')}</div>
      <ul class="sv-list">${ITEMS.filter((it) => it.category !== 'cosmetic').map((it) => row(it, bestGrade(it.id), `<button type="button" class="sv-buy" data-buy="${it.id}" ${bal('eun') < SHOP_PRICE[shopGrade] ? 'disabled' : ''}>${badge(shopGrade)} 사기</button>`)).join('')}</ul>`;
    box.querySelectorAll<HTMLButtonElement>('.sv-grade button').forEach((b) => b.addEventListener('click', () => { shopGrade = +b.dataset.g!; sfx.click(); renderSilver(); }));
    box.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach((b) => b.addEventListener('click', () => {
      if (!pay('eun', SHOP_PRICE[shopGrade])) return;
      grantItem(b.dataset.buy!, shopGrade); sfx.reward(); toast(`${ITEMS.find((x) => x.id === b.dataset.buy)!.name} ${GRADES[shopGrade]} 구매`); renderSilver(); onChange();
    }));
  } else {
    box.innerHTML = `<p class="tx-sub">꾸미기는 은화로 원하는 등급을 바로 살 수 있습니다. 게임 결과에는 영향이 없습니다.</p>
      <div class="sv-grade">${LOOK_GRADES.map((g, i) => `<button type="button" class="${i === lookPick ? 'on' : ''}" data-i="${i}">${badge(g)} ${curIco('eun')}${LOOK_PRICE[i]}</button>`).join('')}</div>
      <ul class="sv-list">${ITEMS.filter((it) => it.category === 'cosmetic').map((it) => row(it, bestGrade(it.id), `<button type="button" class="sv-buy" data-look="${it.id}" ${bal('eun') < LOOK_PRICE[lookPick] || bestGrade(it.id) >= LOOK_GRADES[lookPick] ? 'disabled' : ''}>${bestGrade(it.id) >= LOOK_GRADES[lookPick] ? '보유 중' : `${badge(LOOK_GRADES[lookPick])} 사기`}</button>`)).join('')}</ul>`;
    box.querySelectorAll<HTMLButtonElement>('.sv-grade button').forEach((b) => b.addEventListener('click', () => { lookPick = +b.dataset.i!; sfx.click(); renderSilver(); }));
    box.querySelectorAll<HTMLButtonElement>('[data-look]').forEach((b) => b.addEventListener('click', () => {
      if (!pay('eun', LOOK_PRICE[lookPick])) return;
      grantItem(b.dataset.look!, LOOK_GRADES[lookPick]); sfx.reward(); renderSilver(); onChange();
    }));
  }
  void ownedOf;
}

// ================= 금화 상점 =================
function renderGold() {
  $('gs-list').innerHTML = EXCHANGE.map((x) => `<li class="gs-row"><div class="gs-txt"><b>${x.label}</b><small>${curIco('yeop')} ${fmt(x.yeop)}</small></div>
    <button type="button" class="sv-buy" data-x="${x.id}" ${bal('geum') < x.geum ? 'disabled' : ''}>${curIco('geum')} ${x.geum}</button></li>`).join('');
  $('gs-list').querySelectorAll<HTMLButtonElement>('[data-x]').forEach((b) => b.addEventListener('click', () => {
    if (exchange(b.dataset.x!)) { sfx.reward(); renderGold(); onChange(); }
  }));
}

// ================= 공통 =================
export function syncCurrencies() {
  document.querySelectorAll<HTMLElement>('[data-cur]').forEach((e) => { e.textContent = fmt(bal(e.dataset.cur as Cur)); });
}
export function initEconomy(changed: () => void, notify: (msg: string) => void) {
  onChange = () => { syncCurrencies(); changed(); };
  toast = notify;
  onCoins(() => syncCurrencies());
  const open = (id: string, render: () => void) => { render(); syncCurrencies(); $(id).hidden = false; };
  $('btn-missions').addEventListener('click', () => { sfx.unlock(); sfx.click(); open('missions', renderMissions); });
  $('btn-yut').addEventListener('click', () => { sfx.unlock(); sfx.click(); open('yut', renderYut); });
  $('btn-silver').addEventListener('click', () => { sfx.unlock(); sfx.click(); open('silver', renderSilver); });
  document.querySelectorAll('[data-open="gold"]').forEach((e) => e.addEventListener('click', () => { sfx.unlock(); sfx.click(); open('goldshop', renderGold); }));
  $('yt-throw').addEventListener('click', () => { throwYut(); });
  $('gs-test').addEventListener('click', () => { add('geum', 10); sfx.reward(); renderGold(); onChange(); });
  for (const id of ['missions', 'yut', 'silver', 'goldshop']) {
    $(id).querySelectorAll<HTMLElement>('[data-close]').forEach((b) => b.addEventListener('click', () => { $(id).hidden = true; onChange(); }));
  }
  syncCurrencies();
}
