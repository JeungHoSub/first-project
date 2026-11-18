// 뽑기 화면 + 뽑기 연출.
// 화면: 큰 뽑기권 그림 + 단계 고르기 + 확률 요약/전체표 + 1회·10회 버튼(금화).
// 연출: 뽑기권이 날아와 빛나며 찢어짐 → 화투 뒷면이 사선 축으로 빨라지며 회전(잔상) + 빛 입자가 빨려 듦
//      (높은 등급이면 화면 흔들림·번개) → 충격파와 함께 폭발 → 카드가 3D로 뒤집히며 공개.
//      10회는 카드 10장이 깔린 뒤 한 장씩 뒤집히고, S 이상은 마지막에 따로 크게 뒤집힌다. 화면을 누르면 건너뛴다.
import { ITEMS, bestGrade, TICKETS, GRADES, GRADE_COLOR, drawWithTicket, priceOf, itemArt, CATEGORY_LABEL, type Ticket, type Drop } from './collection';
import { copyOf } from './item-copy';
import { ALL_CARDS, type Card } from '../engine';
import { cardArt } from './art';
import * as sfx from './sound';
import { bal, pay, add, fmt, onCoins } from './wallet';

const $ = (id: string) => document.getElementById(id)!;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let skipping = false;
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, reduced || skipping ? 0 : ms));
const isRainbow = (gi: number) => GRADE_COLOR[GRADES[gi]] === 'rainbow';
const gcol = (gi: number) => (isRainbow(gi) ? '#ffd23a' : GRADE_COLOR[GRADES[gi]]);
const badge = (gi: number) => {
  const c = GRADE_COLOR[GRADES[gi]];
  return `<span class="gbadge${c === 'rainbow' ? ' rainbow' : ''}" style="${c === 'rainbow' ? '' : `--gc:${c}`}">${GRADES[gi]}</span>`;
};
const S_INDEX = 6; // S
const SS_INDEX = 7; // SS

let onChange: () => void = () => {};
// 뽑기 기록 (이 기기에만 저장)
interface LogRow { t: number; gi: number; id: string }
let log: LogRow[] = [];
try { const v = JSON.parse(localStorage.getItem('mg-gacha-log') || '[]'); if (Array.isArray(v)) log = v.slice(-200); } catch { /* 무시 */ }
function addLog(t: number, ds: Drop[]) {
  log = [...log, ...ds.map((d) => ({ t, gi: d.gi, id: d.item.id }))].slice(-200);
  try { localStorage.setItem('mg-gacha-log', JSON.stringify(log)); } catch { /* 무시 */ }
}
let sel = 0;
let txTab: 'odds' | 'items' | 'log' = 'odds';
try { sel = Math.max(0, Math.min(4, +(localStorage.getItem('mg-ticket') ?? 0) || 0)); } catch { /* 무시 */ }

export function initGacha(changed: () => void) {
  onChange = changed;
  $('btn-gacha-close').addEventListener('click', () => { $('gacha').hidden = true; });
  $('gr-close').addEventListener('click', () => { closeRun(); renderTickets(); });
  $('btn-coin-test').addEventListener('click', () => { add('geum', 50); sfx.bonus(); renderTickets(); });
  $('gacha-run').addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('#gr-close')) return;
    if (running) skipping = true;
  });
  onCoins(() => syncCoins());
}

export function openGacha() {
  renderTickets();
  $('gacha').hidden = false;
}

function syncCoins() {
  document.querySelectorAll('.coin-amt').forEach((e) => { e.textContent = fmt(bal('geum')); });
}

// ---------- 뽑기권 그림 ----------
let tkSeq = 0;
function ticketArt(t: Ticket, i: number, mini = false): string {
  // 재질 그대로: 동전(동) · 은전(은) · 금전(금) · 옥패(옥) · 용옥(옥 + 금빛 용). 어두운 옻칠 바탕에 물건 하나만 — 깔끔하게.
  const id = `tk${++tkSeq}`;
  const M = [
    { a: '#5a3218', b: '#c98a56', c: '#f0c49a', d: '#7a4524', ink: '#3a1e0c', name: '#e8b48a' },  // 동
    { a: '#5d656e', b: '#c9d1d8', c: '#ffffff', d: '#7d868f', ink: '#3a4048', name: '#dfe5ea' },  // 은
    { a: '#7a5414', b: '#e2b445', c: '#fff0b8', d: '#9c7424', ink: '#4a3208', name: '#f3d27a' },  // 금
    { a: '#1d4c3e', b: '#5fae8c', c: '#c8f0dc', d: '#2f6e5a', ink: '#123a2e', name: '#9fdcbf' },  // 옥
    { a: '#123a30', b: '#3f9a78', c: '#bff0d6', d: '#1f5a48', ink: '#0c2a22', name: '#f3d27a' },  // 용옥
  ][i];
  const cx = mini ? 160 : 82, cy = 70;
  const defs = `<linearGradient id="${id}m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${M.c}"/><stop offset=".35" stop-color="${M.b}"/><stop offset=".7" stop-color="${M.d}"/><stop offset="1" stop-color="${M.a}"/></linearGradient>
    <radialGradient id="${id}h" cx="35%" cy="28%" r="60%"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".5" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2c0"/><stop offset=".5" stop-color="#d6a640"/><stop offset="1" stop-color="#8a6420"/></linearGradient>
    <radialGradient id="${id}bg" cx="25%" cy="50%" r="80%"><stop offset="0" stop-color="${M.b}" stop-opacity=".22"/><stop offset="1" stop-color="#0d1015" stop-opacity="0"/></radialGradient>`;
  let obj = '';
  if (i <= 2) {
    // 엽전: 둥근 몸통 + 네모 구멍 + 테두리 + 네 글자
    const words = ['복', '록', '수', '강'];
    const pos = [[0, -30], [30, 0], [0, 30], [-30, 0]];
    obj = `<g transform="translate(${cx} ${cy})">
      <circle r="55" fill="#000" opacity=".35" transform="translate(3 5)"/>
      <circle r="54" fill="url(#${id}m)"/>
      <circle r="54" fill="none" stroke="${M.a}" stroke-width="2"/>
      <circle r="46" fill="none" stroke="${M.ink}" stroke-opacity=".55" stroke-width="2.2"/>
      <circle r="44.5" fill="none" stroke="${M.c}" stroke-opacity=".5" stroke-width="1"/>
      ${i === 2 ? Array.from({ length: 24 }, (_, k) => { const an = (k / 24) * Math.PI * 2; return `<circle cx="${(50 * Math.cos(an)).toFixed(1)}" cy="${(50 * Math.sin(an)).toFixed(1)}" r="1.3" fill="${M.c}" opacity=".8"/>`; }).join('') : ''}
      <rect x="-13" y="-13" width="26" height="26" fill="#0b0d12"/>
      <rect x="-17" y="-17" width="34" height="34" fill="none" stroke="${M.ink}" stroke-opacity=".6" stroke-width="2.4"/>
      <rect x="-16" y="-16" width="32" height="32" fill="none" stroke="${M.c}" stroke-opacity=".45" stroke-width="1"/>
      ${words.map((w, k) => `<text x="${pos[k][0]}" y="${pos[k][1] + 6}" text-anchor="middle" font-size="16" font-weight="800" fill="${M.ink}" fill-opacity=".72" font-family="Nanum Myeongjo, Noto Serif KR, serif">${w}</text>`).join('')}
      <circle r="54" fill="url(#${id}h)"/>
    </g>`;
  } else {
    // 옥패(노리개): 매듭 끈 + 둥근 사각 옥 + 술. 용옥은 금테 + 금빛 용
    const dragon = i === 4 ? `<g fill="none" stroke="url(#${id}g)" stroke-linecap="round" stroke-linejoin="round">
        <path d="M-12 30 C-30 16 -4 6 -12 -6 C-20 -18 2 -30 12 -22" stroke-width="5"/>
        <path d="M-12 30 C-30 16 -4 6 -12 -6 C-20 -18 2 -30 12 -22" stroke="#0c2a22" stroke-opacity=".5" stroke-width="1.4" stroke-dasharray="2 3"/>
        <path d="M12 -22 C18 -18 20 -12 14 -10 C10 -9 8 -12 10 -15" stroke-width="3"/>
        <path d="M12 -24 L18 -32 M9 -25 L11 -34" stroke-width="1.6"/>
        <path d="M17 -13 C24 -14 26 -8 22 -4 M15 -10 C20 -6 18 0 14 0" stroke-width="1.2"/>
        <path d="M-21 18 l-6 2 m6 -2 l-5 -3 m5 3 l-2 5 M-17 -10 l-6 -1 m6 1 l-4 -4 m4 4 l-3 4" stroke-width="1.6"/>
        <circle cx="14" cy="-17" r="1.3" fill="#fff2c0" stroke="none"/>
      </g>
      <circle cx="-4" cy="40" r="4" fill="url(#${id}g)" stroke="none"/>` : `<g fill="none" stroke="${M.ink}" stroke-opacity=".45" stroke-width="1.6">
        <path d="M-18 -14 c6 -8 14 -8 16 -1 c4 -7 14 -6 15 2 c8 -1 10 6 4 9 c-12 3 -27 3 -35 -1 z"/>
        <path d="M-14 16 c5 -6 12 -6 13 0 c4 -6 12 -5 13 2 c6 0 8 5 3 7 c-10 2 -22 2 -29 -1 z"/></g>`;
    obj = `<g transform="translate(${cx} ${cy})">
      <path d="M0 -66 C-6 -60 6 -56 0 -50" fill="none" stroke="#8a1f24" stroke-width="2.4"/>
      <path d="M-7 -58 C-10 -52 -4 -50 0 -52 C4 -50 10 -52 7 -58 C4 -62 -4 -62 -7 -58 Z" fill="#a3262c"/>
      <rect x="-34" y="-50" width="68" height="96" rx="20" fill="#000" opacity=".35" transform="translate(3 5)"/>
      <rect x="-34" y="-50" width="68" height="96" rx="20" fill="url(#${id}m)"/>
      ${i === 4 ? `<rect x="-34" y="-50" width="68" height="96" rx="20" fill="none" stroke="url(#${id}g)" stroke-width="3.2"/><rect x="-28" y="-44" width="56" height="84" rx="15" fill="none" stroke="url(#${id}g)" stroke-width="1" opacity=".7"/>`
        : `<rect x="-34" y="-50" width="68" height="96" rx="20" fill="none" stroke="${M.a}" stroke-width="1.6"/><rect x="-28" y="-44" width="56" height="84" rx="15" fill="none" stroke="${M.c}" stroke-opacity=".35" stroke-width="1"/>`}
      ${dragon}
      <rect x="-34" y="-50" width="68" height="96" rx="20" fill="url(#${id}h)"/>
      <path d="M-4 46 V52 M4 46 V52" stroke="#a3262c" stroke-width="2.4"/>
      <path d="M-6 52 H6 L5 70 H-5 Z" fill="#a3262c"/><path d="M-4 54 V70 M0 54 V70 M4 54 V70" stroke="#6e1418" stroke-width=".8"/>
    </g>`;
  }
  return `<svg class="tx-svg" viewBox="${mini ? '96 -6 128 152' : '0 0 320 140'}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>${defs}</defs>
  ${mini ? '' : `<rect x="1" y="1" width="318" height="138" rx="14" fill="#11141a"/><rect x="1" y="1" width="318" height="138" rx="14" fill="url(#${id}bg)"/>
  <rect x="1.5" y="1.5" width="317" height="137" rx="13.5" fill="none" stroke="${M.b}" stroke-opacity=".45"/>
  <rect x="8" y="8" width="304" height="124" rx="9" fill="none" stroke="${M.b}" stroke-opacity=".15"/>`}
  ${obj}
  ${mini ? '' : `<text x="170" y="44" font-size="10.5" font-weight="700" fill="${M.name}" fill-opacity=".8" letter-spacing="5" font-family="Nanum Myeongjo, Noto Serif KR, serif">뽑기권</text>
  <text x="170" y="82" font-size="30" font-weight="800" fill="#f4ecdc" font-family="Nanum Myeongjo, Noto Serif KR, serif">${t.name.replace('권', '')}</text>
  <line x1="170" y1="94" x2="290" y2="94" stroke="${M.b}" stroke-opacity=".4"/>
  <text x="170" y="113" font-size="12" font-weight="700" fill="${M.name}" font-family="Nanum Myeongjo, Noto Serif KR, serif">${t.minGrade ? `${t.minGrade} 등급 이상 보장` : '보장 없이 가볍게'}</text>`}
</svg>`;
}

// ---------- 뽑기권 화면 ----------
function renderTickets() {
  syncCoins();
  sel = Math.max(0, Math.min(TICKETS.length - 1, sel));
  const t = TICKETS[sel];
  const hero = $('tx-hero');
  hero.style.setProperty('--tc', t.hue);
  hero.dataset.tier = String(sel);
  hero.innerHTML = `<div class="tx-hero-card">${ticketArt(t, sel)}<i class="tx-foil" aria-hidden="true"></i><i class="tx-shine" aria-hidden="true"></i></div>
    <div class="tx-altar" aria-hidden="true"></div>

    <div class="tx-hero-info"><b>${t.name}</b><span>${t.minGrade ? `${t.minGrade} 등급 이상 보장` : '보장 없음'} · S 이상 ${Math.round(GRADES.reduce((a, g, gi) => a + (gi >= S_INDEX ? t.rates[g] : 0), 0) * 100) / 100}%</span></div>`;
  const card = hero.firstElementChild as HTMLElement;
  const tilt = (x: number, y: number) => { card.style.setProperty('--rx', `${(0.5 - y) * 16}deg`); card.style.setProperty('--ry', `${(x - 0.5) * 22}deg`); card.style.setProperty('--mx', `${x * 100}%`); card.style.setProperty('--my', `${y * 100}%`); };
  hero.onpointermove = (e) => { const r = card.getBoundingClientRect(); tilt((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); card.classList.add('tilting'); };
  hero.onpointerleave = () => { card.classList.remove('tilting'); card.style.removeProperty('--rx'); card.style.removeProperty('--ry'); };

  $('tx-tiers').innerHTML = TICKETS.map((x, i) => `<button type="button" class="tx-tier${i === sel ? ' cur' : ''}" data-i="${i}" style="--tc:${x.hue}" aria-label="${x.name}">
      ${ticketArt(x, i, true)}<span>${x.name.replace('권', '')}</span></button>`).join('');
  $('tx-tiers').querySelectorAll<HTMLButtonElement>('.tx-tier').forEach((b) => b.addEventListener('click', () => {
    sel = +b.dataset.i!; try { localStorage.setItem('mg-ticket', String(sel)); } catch { /* 무시 */ }
    sfx.click(); renderTickets();
  }));

  const sum = (from: number) => GRADES.reduce((a, g, gi) => a + (gi >= from ? t.rates[g] : 0), 0);
  const r2 = (n: number) => `${Math.round(n * 100) / 100}%`;
  const bar = GRADES.map((g, gi) => (t.rates[g] > 0 ? `<i style="flex:${t.rates[g]};background:${isRainbow(gi) ? 'linear-gradient(90deg,#ff5a5f,#ffd23a,#5bbf6a,#4fb4ff,#b678e8)' : gcol(gi)}" title="${g} ${t.rates[g]}%"></i>` : '')).join('');
  const maxRate = Math.max(...GRADES.map((g) => t.rates[g]));
  const ladder = [...GRADES].map((g, gi) => ({ g, gi })).reverse().map(({ g, gi }) => {
    const r = t.rates[g];
    const w = r > 0 ? Math.max(3, Math.sqrt(r / maxRate) * 100) : 0;
    const fill = isRainbow(gi) ? 'linear-gradient(90deg,#ff5a5f,#ffd23a,#5bbf6a,#4fb4ff,#b678e8)' : gcol(gi);
    const guard = t.minGrade && GRADES[gi] === t.minGrade ? '<em>보장선</em>' : '';
    return `<li class="${r ? '' : 'zero'}${gi >= S_INDEX ? ' hi' : ''}">${badge(gi)}<span class="lt"><i style="width:${w}%;background:${fill}"></i></span><b>${r ? `${r}%` : '나오지 않음'}</b>${guard}</li>`;
  }).join('');
  void bar;
  const mine = log.filter((x) => x.t === sel);
  const bestRow = mine.reduce<LogRow | null>((a, x) => (!a || x.gi > a.gi ? x : a), null);
  const recent = log.slice(-14).reverse();
  const stats = `<div class="tx-stats">
      <div><small>최소 보장</small><b>${t.minGrade ? `${t.minGrade} 이상` : '없음'}</b></div>
      <div><small>S 이상</small><b>${r2(sum(S_INDEX))}</b></div>
      <div><small>SSS 이상</small><b>${r2(sum(8))}</b></div>
    </div>`;
  const compare = `<details class="tx-all"><summary>뽑기권 5단계 확률 비교</summary><table><thead><tr><th></th>${TICKETS.map((x, i) => `<th class="${i === sel ? 'cur' : ''}" style="--tc:${x.hue}">${x.name.replace('권', '')}</th>`).join('')}</tr></thead><tbody>${
      GRADES.map((g, gi) => `<tr><td>${badge(gi)}</td>${TICKETS.map((x, i) => `<td class="${i === sel ? 'cur' : ''}">${x.rates[g] ? `${x.rates[g]}%` : '<span class="nil">–</span>'}</td>`).join('')}</tr>`).join('')
    }</tbody></table></details>`;
  const totalW = ITEMS.reduce((a, x) => a + x.weight, 0);
  const itemsPanel = `<p class="tx-sub">어떤 아이템이 나올지는 아래 확률, 등급은 위 확률표를 따로 따릅니다. 모은 것은 최고 등급이 표시됩니다.</p>
    <div class="tx-items">${ITEMS.map((it) => { const g = bestGrade(it.id); return `<div class="tx-it${g < 0 ? ' no' : ''}" title="${it.name}"><span>${itemArt(it, Math.max(g, 0), g < 0)}</span><b>${g < 0 ? '???' : it.name}</b><small>${Math.round((it.weight / totalW) * 1000) / 10}%</small>${g >= 0 ? badge(g) : ''}</div>`; }).join('')}</div>`;
  const allLog = log.slice(-40).reverse();
  const logPanel = `<div class="tx-rec">
      <div class="tx-rec-head"><b>${t.name}</b><span>${mine.length}회${bestRow ? ` · 최고 ${badge(bestRow.gi)}` : ''}</span></div>
      <div class="tx-rec-row">${recent.length ? recent.map((x) => `<i title="${GRADES[x.gi]}">${badge(x.gi)}</i>`).join('') : '<small>아직 기록이 없습니다</small>'}</div>
    </div>
    <ul class="tx-loglist">${allLog.map((x) => { const it = ITEMS.find((y) => y.id === x.id); return it ? `<li>${badge(x.gi)}<b>${it.name}</b><small>${TICKETS[x.t]?.name ?? ''}</small></li>` : ''; }).join('')}</ul>`;
  const panel = txTab === 'odds' ? `${stats}<ol class="tx-ladder">${ladder}</ol>${compare}` : txTab === 'items' ? itemsPanel : logPanel;
  $('tx-odds').innerHTML = `<div class="tx-tabs" role="tablist">${([['odds', '확률'], ['items', '구성품'], ['log', '기록']] as const).map(([k, l]) => `<button type="button" role="tab" class="tab${txTab === k ? ' cur' : ''}" data-k="${k}">${l}</button>`).join('')}</div><div class="tx-panel">${panel}</div>`;
  $('tx-odds').querySelectorAll<HTMLButtonElement>('.tx-tabs .tab').forEach((b) => b.addEventListener('click', () => { txTab = b.dataset.k as typeof txTab; sfx.click(); renderTickets(); }));

  $('tx-actions').innerHTML = [1, 10].map((n) => {
    const p = priceOf(t, n);
    return `<button type="button" class="tx-go${n === 10 ? ' ten' : ''}" data-n="${n}" ${bal('geum') < p ? 'disabled' : ''} style="--tc:${t.hue}">
      <b>${n}회 뽑기</b><span><i class="cur-ico geum" aria-hidden="true"></i>금화 ${fmt(p)}</span>${n === 10 ? '<em>1회분 덤</em>' : ''}</button>`;
  }).join('');
  $('tx-actions').querySelectorAll<HTMLButtonElement>('.tx-go').forEach((b) => b.addEventListener('click', () => {
    const n = +b.dataset.n!;
    if (!pay('geum', priceOf(t, n))) { sfx.buzz([40]); return; }
    run(t, sel, n);
  }));
}

// ---------- 입자 효과(캔버스) ----------
interface P { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; hue: number | null; color: string; mode: 'in' | 'out' | 'float' }
const fx = { cv: null as HTMLCanvasElement | null, ctx: null as CanvasRenderingContext2D | null, parts: [] as P[], raf: 0, w: 0, h: 0, dpr: 1, bolts: [] as { pts: [number, number][]; life: number }[], t: 0 };

function fxStart() {
  const cv = $('gr-fx') as HTMLCanvasElement;
  fx.cv = cv; fx.ctx = cv.getContext('2d');
  fx.dpr = Math.min(2, devicePixelRatio || 1);
  const resize = () => { fx.w = innerWidth; fx.h = innerHeight; cv.width = fx.w * fx.dpr; cv.height = fx.h * fx.dpr; };
  resize();
  fx.parts = []; fx.bolts = [];
  cancelAnimationFrame(fx.raf);
  let last = performance.now();
  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; fx.t += dt;
    step(dt); draw();
    fx.raf = requestAnimationFrame(loop);
  };
  fx.raf = requestAnimationFrame(loop);
}
function fxStop() { cancelAnimationFrame(fx.raf); fx.parts = []; fx.bolts = []; fx.ctx?.clearRect(0, 0, fx.cv!.width, fx.cv!.height); }
const center = () => ({ x: fx.w / 2, y: fx.h * 0.45 });

function spawnIn(n: number, color: string, rainbow = false) {
  const c = center();
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.max(fx.w, fx.h) * (0.45 + Math.random() * 0.25);
    fx.parts.push({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r, vx: -Math.sin(a) * 120, vy: Math.cos(a) * 120, life: 0, max: 1.4 + Math.random() * 0.6, size: 1.5 + Math.random() * 2.5, hue: rainbow ? Math.random() * 360 : null, color, mode: 'in' });
  }
}
function spawnOut(n: number, color: string, rainbow = false, at = center(), speed = 1) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = (200 + Math.random() * 700) * speed;
    fx.parts.push({ x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 0.8 + Math.random() * 0.9, size: 1.5 + Math.random() * 3.5, hue: rainbow ? Math.random() * 360 : null, color, mode: 'out' });
  }
}
function spawnFloat(n: number, color: string, rainbow = false) {
  for (let i = 0; i < n; i++) {
    fx.parts.push({ x: Math.random() * fx.w, y: fx.h * (0.3 + Math.random() * 0.8), vx: (Math.random() - 0.5) * 20, vy: -20 - Math.random() * 50, life: 0, max: 2 + Math.random() * 2, size: 1 + Math.random() * 2.2, hue: rainbow ? Math.random() * 360 : null, color, mode: 'float' });
  }
}
function bolt() {
  const c = center();
  const a = Math.random() * Math.PI * 2;
  const r = Math.max(fx.w, fx.h) * 0.6;
  const pts: [number, number][] = [];
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    pts.push([c.x + Math.cos(a) * r * (1 - k) + (Math.random() - 0.5) * 40 * (1 - k), c.y + Math.sin(a) * r * (1 - k) + (Math.random() - 0.5) * 40 * (1 - k)]);
  }
  fx.bolts.push({ pts, life: 0.22 });
}
function step(dt: number) {
  const c = center();
  for (const p of fx.parts) {
    p.life += dt;
    if (p.mode === 'in') {
      const dx = c.x - p.x, dy = c.y - p.y; const d = Math.hypot(dx, dy) || 1;
      const pull = 900 + 1800 * (p.life / p.max);
      p.vx += (dx / d) * pull * dt; p.vy += (dy / d) * pull * dt;
      p.vx *= 0.96; p.vy *= 0.96;
      if (d < 18) p.life = p.max;
    } else if (p.mode === 'out') { p.vx *= 0.95; p.vy = p.vy * 0.95 + 60 * dt; }
    p.x += p.vx * dt; p.y += p.vy * dt;
  }
  fx.parts = fx.parts.filter((p) => p.life < p.max);
  for (const b of fx.bolts) b.life -= dt;
  fx.bolts = fx.bolts.filter((b) => b.life > 0);
}
function draw() {
  const g = fx.ctx!; const k = fx.dpr;
  g.setTransform(k, 0, 0, k, 0, 0);
  g.clearRect(0, 0, fx.w, fx.h);
  g.globalCompositeOperation = 'lighter';
  for (const p of fx.parts) {
    const a = Math.max(0, 1 - p.life / p.max) * (p.mode === 'float' ? Math.min(1, p.life * 2) : 1);
    const col = p.hue != null ? `hsla(${(p.hue + fx.t * 60) % 360},40%,74%,${a})` : hexA(p.color, a);
    g.fillStyle = col;
    g.beginPath(); g.arc(p.x, p.y, p.size, 0, Math.PI * 2); g.fill();
    g.fillStyle = p.hue != null ? `hsla(${(p.hue + fx.t * 60) % 360},40%,74%,${a * 0.18})` : hexA(p.color, a * 0.18);
    g.beginPath(); g.arc(p.x, p.y, p.size * 3.2, 0, Math.PI * 2); g.fill();
  }
  for (const b of fx.bolts) {
    g.strokeStyle = `rgba(255,255,255,${b.life / 0.22})`; g.lineWidth = 2.4; g.shadowColor = '#bfe3ff'; g.shadowBlur = 14;
    g.beginPath(); b.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
    g.shadowBlur = 0;
  }
  g.globalCompositeOperation = 'source-over';
}
function hexA(hex: string, a: number) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// ---------- 뽑기 연출 ----------
let running = false;
/** SSS · SSS+ 전용 절정 연출.
 *  SSS: 화면이 꺼지고 심장 박동 → 붉은 금빛 기둥이 내려꽂힘 → 화면이 갈라짐
 *  SSS+: 화면이 꺼지고 별이 뜸 → 오방색 다섯 빛기둥이 솟음 → "천하제일" 붓글씨 → 무지개 물결 */
async function climax(stage: HTMLElement, gi: number) {
  const fxLayer = document.createElement('div');
  fxLayer.className = `gx-climax ${gi >= 9 ? 'c9' : 'c8'}`;
  stage.append(fxLayer);
  stage.classList.add('blackout');
  for (let k = 0; k < 2; k++) { sfx.heartbeat(); await wait(430); }
  if (gi >= 9) {
    fxLayer.innerHTML = `<div class="stars"></div>${['#1f6f8b', '#b3261e', '#e8b84a', '#f3ead8', '#2e7d4f'].map((c, i) => `<i class="beam" style="--c:${c};--x:${10 + i * 20}%;--d:${i * 110}ms"></i>`).join('')}
      <div class="banner"><span>신품</span></div>`;
    await wait(120);
    fxLayer.classList.add('go'); sfx.chime(9);
    for (let k = 0; k < 5; k++) setTimeout(() => sfx.chime(5 + k), 110 * k);
    await wait(1250);
    sfx.win();
    spawnOut(160, '#ffd23a', true, center(), 1.1);
    await wait(900);
  } else {
    fxLayer.innerHTML = `<i class="pillar"></i><svg class="crack" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M50 0 L46 18 L55 30 L44 47 L57 62 L47 78 L53 100" /><path d="M46 18 L30 26 M55 30 L72 36 M44 47 L24 55 M57 62 L80 70 M47 78 L34 92" /></svg>`;
    await wait(80);
    fxLayer.classList.add('go'); sfx.bomb();
    await wait(650);
    fxLayer.classList.add('crack-on'); sfx.slap(1); sfx.buzz([60, 40, 90]);
    stage.classList.add('shake');
    await wait(600);
  }
  stage.classList.remove('blackout', 'shake');
  fxLayer.classList.add('out');
  setTimeout(() => fxLayer.remove(), 900);
}

/** 공개된 카드에 마우스를 올리거나(누르면) 어떤 아이템인지 설명을 띄운다 */
function wireTips(box: HTMLElement) {
  const tip = $('gx-tip');
  const show = (el: HTMLElement) => {
    const gi = +el.dataset.gi!;
    tip.innerHTML = `<div class="tp-head"><b>${el.dataset.name}</b>${badge(gi)}</div><div class="tp-cat">${el.dataset.cat}</div><p>${el.dataset.one}</p><p class="tp-eff">${el.dataset.eff}</p>`;
    tip.style.setProperty('--gc', gcol(gi));
    tip.hidden = false;
    const r = el.getBoundingClientRect(); const tw = tip.offsetWidth; const th = tip.offsetHeight;
    let x = r.left + r.width / 2 - tw / 2; x = Math.max(8, Math.min(innerWidth - tw - 8, x));
    let y = r.top - th - 10; if (y < 8) y = Math.min(innerHeight - th - 8, r.bottom + 10);
    tip.style.left = `${x}px`; tip.style.top = `${y}px`;
  };
  const hide = () => { tip.hidden = true; };
  box.querySelectorAll<HTMLElement>('.gf').forEach((el) => {
    el.addEventListener('mouseenter', () => show(el));
    el.addEventListener('mouseleave', hide);
    el.addEventListener('focus', () => show(el));
    el.addEventListener('blur', hide);
    el.addEventListener('click', (e) => { e.stopPropagation(); if (tip.hidden) show(el); else hide(); });
  });
}

function closeRun() {
  $('gx-tip').hidden = true;
  $('gacha-run').hidden = true; fxStop(); running = false;
  $('gacha-run').querySelectorAll('.gx-fly, .gx-seal').forEach((e) => e.remove());
}

/** 나전칠기 함: 옻칠 바탕에 자개(무지갯빛 조개) 구름·학 무늬, 금속 장식 */
function boxArt() {
  const nacre = `<linearGradient id="gx-nacre" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6d8e8"/><stop offset=".3" stop-color="#d8f0ea"/><stop offset=".6" stop-color="#d6def8"/><stop offset="1" stop-color="#f4ecd0"/></linearGradient>`;
  const lac = `<linearGradient id="gx-lac" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1a14"/><stop offset="1" stop-color="#0b0706"/></linearGradient>`;
  const au = `<linearGradient id="gx-au" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8a6a2a"/><stop offset=".45" stop-color="#f6dc8c"/><stop offset="1" stop-color="#a87c2e"/></linearGradient>`;
  const cloud = (x: number, y: number, k: number) => `<path transform="translate(${x} ${y}) scale(${k})" d="M0 8 c4 -8 12 -8 15 -2 c3 -6 12 -5 13 2 c7 -1 9 6 3 8 c-10 3 -24 3 -31 0 c-4 -2 -3 -7 0 -8 z" fill="url(#gx-nacre)" opacity=".75"/>`;
  return `<div class="gx-box"><svg class="gx-box-body" viewBox="0 0 200 110" aria-hidden="true"><defs>${nacre}${lac}${au}</defs>
      <rect x="4" y="6" width="192" height="100" rx="6" fill="url(#gx-lac)" stroke="url(#gx-au)" stroke-width="2"/>
      <rect x="12" y="14" width="176" height="84" rx="3" fill="none" stroke="url(#gx-nacre)" stroke-opacity=".5" stroke-width="1"/>
      ${cloud(24, 40, 1.1)}${cloud(140, 56, 0.9)}${cloud(60, 74, 0.7)}
      <path d="M120 34 c10 -8 26 -6 30 2 c-8 -2 -14 0 -18 4 c8 2 12 8 10 14 c-6 -6 -14 -8 -22 -6 z" fill="url(#gx-nacre)" opacity=".85"/>
      <circle cx="100" cy="30" r="11" fill="url(#gx-au)"/><rect x="96" y="27" width="8" height="10" rx="1.5" fill="#2a1a14"/>
      ${[[4, 6], [184, 6], [4, 94], [184, 94]].map(([x, y]) => `<rect x="${x}" y="${y}" width="12" height="12" rx="2" fill="url(#gx-au)"/>`).join('')}
    </svg>
    <svg class="gx-lid" viewBox="0 0 200 40" aria-hidden="true"><rect x="0" y="4" width="200" height="34" rx="7" fill="url(#gx-lac)" stroke="url(#gx-au)" stroke-width="2"/>
      ${cloud(30, 12, 0.8)}${cloud(120, 14, 0.7)}<rect x="88" y="30" width="24" height="10" rx="2" fill="url(#gx-au)"/></svg></div>`;
}

/** 화투 패가 화면을 사선으로 가로지르며 쏟아진다 (높은 등급이면 광 패가 금빛으로 섞임) */
function streamCards(stage: HTMLElement, count: number, within: number, gold: boolean) {
  if (reduced) return;
  const pool = ALL_CARDS.filter((c) => c.month <= 12);
  const W = innerWidth, H = innerHeight;
  for (let i = 0; i < count; i++) {
    const c = gold && Math.random() < 0.35 ? pool.filter((x) => x.kind === 'G')[Math.floor(Math.random() * 5)] : pool[Math.floor(Math.random() * pool.length)];
    const el = document.createElement('div');
    el.className = 'gx-fly' + (c.kind === 'G' && gold ? ' gold' : '');
    el.innerHTML = cardArt(c);
    const size = 38 + Math.random() * 40;
    el.style.width = `${size}px`;
    stage.append(el);
    const down = i % 2 === 0; // 왼위→오른아래 / 오른위→왼아래 번갈아
    const x0 = down ? -120 + Math.random() * W * 0.6 : W * 0.4 + Math.random() * W * 0.6 + 120;
    const y0 = -140 - Math.random() * 80;
    const dx = (down ? 1 : -1) * (H * 0.9 + Math.random() * 200);
    const dy = H + 300;
    const r0 = Math.random() * 360, spinDeg = (down ? 1 : -1) * (540 + Math.random() * 720);
    const dur = 1100 + Math.random() * 900;
    const a = el.animate([
      { transform: `translate(${x0}px, ${y0}px) rotate3d(1, -1, .3, ${r0}deg)`, opacity: 0 },
      { opacity: 1, offset: 0.12 },
      { opacity: 1, offset: 0.85 },
      { transform: `translate(${x0 + dx}px, ${y0 + dy}px) rotate3d(1, -1, .3, ${r0 + spinDeg}deg)`, opacity: 0 },
    ], { duration: dur, delay: Math.random() * within, easing: 'cubic-bezier(.35,.1,.6,1)', fill: 'both' });
    a.onfinish = () => el.remove();
  }
}

/** SS 이상: 붉은 낙관(도장)이 찍힌다. SS 대길 · SSS 천운 · SSS+ 신품 */
function seal(stage: HTMLElement, gi: number) {
  if (gi < 7) return;
  const word = gi >= 9 ? '신품' : gi >= 8 ? '천운' : '대길';
  const el = document.createElement('div');
  el.className = `gx-seal${gi >= 9 ? ' rb' : ''}`;
  el.innerHTML = `<span>${word}</span>`;
  stage.append(el);
  setTimeout(() => sfx.slap(0.9), 120);
}

function cardFlip(d: Drop, i: number, big = false) {
  const cp = copyOf(d.item.id);
  const esc = (x: string) => x.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  return `<div class="gf${big ? ' big' : ''}${d.gi >= 8 ? ' legend' : ''}" tabindex="0" style="--i:${i};--gc:${gcol(d.gi)}" data-gi="${d.gi}" data-rb="${isRainbow(d.gi) ? 1 : 0}"
    data-name="${esc(d.item.name)}" data-cat="${esc(CATEGORY_LABEL[d.item.category as keyof typeof CATEGORY_LABEL] ?? '')}" data-one="${esc(cp.one)}" data-eff="${esc(d.item.effect(d.gi))}">
    <div class="gf-in"><div class="gf-back"></div><div class="gf-front">${itemArt(d.item, d.gi)}</div></div>
    <div class="gf-cap"><b>${d.item.name}</b>${badge(d.gi)}${d.isNewBest ? '<em>NEW</em>' : ''}</div>
    ${big ? `<div class="gf-detail"><span>${CATEGORY_LABEL[d.item.category as keyof typeof CATEGORY_LABEL] ?? ''}</span><p>${cp.one}</p><p class="gf-eff">${d.item.effect(d.gi)}</p></div>` : ''}
  </div>`;
}

async function run(t: Ticket, tier: number, n: number) {
  sfx.unlock();
  running = true; skipping = false;
  const drops: Drop[] = Array.from({ length: n }, () => drawWithTicket(t));
  addLog(tier, drops);
  const best = drops.reduce((a, d) => (d.gi > a.gi ? d : a), drops[0]);
  const high = best.gi >= S_INDEX;
  const rainbow = isRainbow(best.gi);
  const stage = $('gacha-run');
  const res = $('gr-results');
  res.innerHTML = ''; res.hidden = true; res.className = 'gx-results';
  $('gr-close').hidden = true; $('gr-summary').hidden = true;
  stage.style.setProperty('--gc', gcol(best.gi));
  stage.style.setProperty('--tc', t.hue);
  stage.dataset.tier = rainbow ? 'top' : high ? 'high' : 'normal';
  stage.className = 'gx-run';
  stage.hidden = false;
  fxStart();

  // 1) 뽑기권이 놓이고 붉은 낙관이 "쿵" 찍힌 뒤 금가루로 흩어짐
  const spin = $('gr-spin');
  spin.innerHTML = `<div class="gx-ticket">${ticketArt(t, tier)}<div class="gx-stamp"><span>인</span></div></div>`;
  stage.classList.add('intro');
  sfx.deal();
  await wait(620);
  stage.classList.add('stamp'); sfx.slap(1); sfx.buzz(20);
  await wait(520);
  stage.classList.add('dissolve');
  spawnOut(70, '#e9cf8a', false, center(), 0.35);
  await wait(480);

  // 2) 나전칠기 함이 떠오르고 뚜껑이 열리며 빛이 새어 나옴 → 진짜 화투가 함에서 솟아 사선으로 회전
  const pool = ALL_CARDS.filter((c) => c.month <= 12);
  const gwang = pool.filter((c) => c.kind === 'G');
  const face: Card = high ? gwang[Math.floor(Math.random() * gwang.length)] : pool[Math.floor(Math.random() * pool.length)];
  spin.innerHTML = `<div class="gx-boxlight"></div>${boxArt()}<div class="gx-card-wrap">${[3, 2, 1, 0].map((k) => `<div class="gx-card${k ? ' ghost' : ''}" style="--k:${k}"><div class="gx-back"></div><div class="gx-face">${cardArt(face)}</div></div>`).join('')}<div class="gx-glow"></div></div><div class="gx-ring"></div>`;
  stage.classList.remove('intro', 'stamp', 'dissolve'); void stage.offsetWidth;
  stage.classList.add('box');
  sfx.chime(2);
  await wait(700);
  stage.classList.add('open'); sfx.flip(); sfx.chime(4);
  await wait(650);
  stage.classList.add('charge');
  // 등급 예고: 빛 색이 C → A → S → SS → SSS → 무지개 순으로 한 단계씩 오른다(실제 등급까지만)
  const ladder = [0, 3, 5, 6, 7, 8, 9].filter((g) => g <= best.gi);
  let lv = 0;
  stage.style.setProperty('--gc', gcol(ladder[0]));
  const steps = 14;
  const streamEnd = performance.now() + 2600;
  streamCards(stage, 4 + best.gi * 2, 2400, high);
  for (let i = 0; i < steps && !skipping; i++) {
    const want = Math.min(ladder.length - 1, Math.floor(((i + 1) / steps) * ladder.length * 1.15));
    if (want > lv) {
      lv = want;
      const g = ladder[lv];
      stage.style.setProperty('--gc', gcol(g));
      stage.dataset.lv = String(g);
      stage.classList.remove('lvup'); void stage.offsetWidth; stage.classList.add('lvup');
      spawnOut(30 + g * 6, gcol(g), isRainbow(g), center(), 0.45);
      sfx.chime(g);
      if (g >= S_INDEX) sfx.buzz(25);
    }
    spawnIn(12 + i * 3, gcol(ladder[lv]), isRainbow(ladder[lv]));
    if (ladder[lv] >= S_INDEX && Math.random() < 0.5) bolt();
    sfx.tick();
    await wait(220 - i * 9);
  }
  // 3) S 이상: 다섯 광이 둘레를 돌다 가운데로 모임 / SS 이상: 화면 흔들림·번개
  if (high && !skipping) {
    const ring = document.createElement('div'); ring.className = 'gx-five';
    ring.innerHTML = gwang.slice(0, 5).map((c, i) => `<div class="g5" style="--a:${i * 72}deg">${cardArt(c)}</div>`).join('');
    spin.append(ring);
    sfx.bonus();
    await wait(900);
    ring.classList.add('in');
    stage.classList.add('shake'); sfx.shake(); sfx.buzz([40, 30, 60]);
    for (let i = 0; i < (best.gi >= 7 ? 7 : 3); i++) bolt();
    await wait(520);
  }
  if (best.gi >= 8 && !skipping) await climax(stage, best.gi);
  void streamEnd;

  // 폭발: 섬광 + 충격파 + 입자 (SSS 이상은 연속 폭죽)
  stage.style.setProperty('--gc', gcol(best.gi));
  stage.classList.remove('shake', 'lvup'); stage.classList.add('burst');
  spawnOut(high ? 240 : 120, gcol(best.gi), rainbow, center(), high ? 1.3 : 1);
  sfx.bomb(); sfx.magic();
  if (high) setTimeout(() => sfx.bonus(), 260);
  if (rainbow || best.gi >= 8) {
    setTimeout(() => sfx.win(), 520);
    for (let k = 1; k <= 4; k++) setTimeout(() => spawnOut(90, gcol(best.gi), rainbow, { x: fx.w * (0.15 + Math.random() * 0.7), y: fx.h * (0.15 + Math.random() * 0.5) }, 0.8), 250 * k);
  }
  await wait(560);

  // 4) 공개
  stage.classList.add('done');
  skipping = false;
  if (n === 1) {
    res.classList.add('one');
    res.innerHTML = cardFlip(best, 0, true);
    res.hidden = false;
    const el = res.firstElementChild as HTMLElement;
    await wait(250);
    el.classList.add('open'); sfx.flip();
    if (high) { spawnOut(120, gcol(best.gi), rainbow, center(), 0.8); sfx.bonus(); }
    await wait(500);
    el.classList.add('stamp');
    if (high) spawnFloat(60, gcol(best.gi), rainbow);
    seal(stage, best.gi);
  } else {
    res.classList.add('ten');
    res.innerHTML = drops.map((d, i) => cardFlip(d, i)).join('');
    res.hidden = false;
    const els = [...res.children] as HTMLElement[];
    await wait(80 * n + 300);
    // 낮은 등급부터 높은 등급 순서로 하나씩 뒤집는다 (같은 등급이면 놓인 순서대로)
    const order = els.map((el, i) => ({ el, gi: drops[i].gi, i })).sort((a, b) => a.gi - b.gi || a.i - b.i);
    for (const { el, gi } of order) {
      if (gi >= SS_INDEX) {
        // SS 이상: 따로 앞으로 불러내 사선으로 돌리며 뒤집고, 회전하는 하이라이트를 계속 두른다
        if (gi >= 8) { sfx.heartbeat(); await wait(300); }
        res.classList.add('focus'); el.classList.add('spot'); sfx.shake();
        await wait(1250);
        el.classList.add('open', 'stamp'); sfx.flip(); sfx.bonus();
        const r = el.getBoundingClientRect();
        spawnOut(gi >= 8 ? 140 : 90, gcol(gi), isRainbow(gi), { x: r.left + r.width / 2, y: r.top + r.height / 2 }, 0.8);
        await wait(gi >= 8 ? 1100 : 800);
        res.classList.remove('focus'); el.classList.remove('spot'); el.classList.add('ss-hl');
        await wait(350);
        continue;
      }
      if (gi >= S_INDEX) {
        el.classList.add('tease'); sfx.shake();
        await wait(gi >= 8 ? 900 : 520);
        if (gi >= 8) { sfx.heartbeat(); stage.classList.add('dim'); await wait(450); stage.classList.remove('dim'); }
      }
      el.classList.add('open', 'stamp'); sfx.flip();
      if (gi >= S_INDEX) {
        const r = el.getBoundingClientRect();
        spawnOut(70, gcol(gi), isRainbow(gi), { x: r.left + r.width / 2, y: r.top + r.height / 2 }, 0.6);
        sfx.bonus();
        await wait(380);
      } else await wait(110);
    }
    const hi = drops.filter((d) => d.gi >= S_INDEX).length;
    const nw = drops.filter((d) => d.isNewBest).length;
    $('gr-summary').innerHTML = `${hi ? `<b>S 이상 ${hi}장</b> · ` : ''}최고 등급 갱신 ${nw}개`;
    $('gr-summary').hidden = false;
    if (high) spawnFloat(50, gcol(best.gi), rainbow);
    seal(stage, best.gi);
  }
  wireTips(res);
  $('gr-close').hidden = false;
  running = false;
  onChange();
}
