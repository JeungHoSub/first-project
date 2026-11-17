// 뽑기 화면 + 뽑기 연출.
// 화면: 큰 뽑기권 그림 + 단계 고르기 + 확률 요약/전체표 + 1회·10회 버튼(엽전).
// 연출: 뽑기권이 날아와 빛나며 찢어짐 → 화투 뒷면이 사선 축으로 빨라지며 회전(잔상) + 빛 입자가 빨려 듦
//      (높은 등급이면 화면 흔들림·번개) → 충격파와 함께 폭발 → 카드가 3D로 뒤집히며 공개.
//      10회는 카드 10장이 깔린 뒤 한 장씩 뒤집히고, S 이상은 마지막에 따로 크게 뒤집힌다. 화면을 누르면 건너뛴다.
import { TICKETS, GRADES, GRADE_COLOR, drawWithTicket, priceOf, itemArt, CATEGORY_LABEL, type Ticket, type Drop } from './collection';
import { copyOf } from './item-copy';
import { ALL_CARDS, type Card } from '../engine';
import { cardArt } from './art';
import * as sfx from './sound';
import { coins, spend, earn, fmt, onCoins } from './wallet';

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
const ROMAN = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ'];
const S_INDEX = 6; // S

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
try { sel = Math.max(0, Math.min(4, +(localStorage.getItem('mg-ticket') ?? 0) || 0)); } catch { /* 무시 */ }

export function initGacha(changed: () => void) {
  onChange = changed;
  $('btn-gacha-close').addEventListener('click', () => { $('gacha').hidden = true; });
  $('gr-close').addEventListener('click', () => { closeRun(); renderTickets(); });
  $('btn-coin-test').addEventListener('click', () => { earn(10000); sfx.bonus(); renderTickets(); });
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
  document.querySelectorAll('.coin-amt').forEach((e) => { e.textContent = fmt(coins()); });
}

// ---------- 뽑기권 그림 ----------
let tkSeq = 0;
function ticketArt(t: Ticket, i: number, mini = false): string {
  const id = `tk${++tkSeq}`;
  const dark = ['#3a1e0e', '#2a3038', '#3d2a06', '#08362a', '#3e0a12'][i];
  const ink = ['#fff1e0', '#ffffff', '#fff6d8', '#e8fff6', '#fff0f0'][i];
  const motif = [
    // 동전: 엽전 무늬
    `<g opacity=".18" fill="none" stroke="${ink}" stroke-width="2">${[40, 110, 180].map((x) => `<circle cx="${x}" cy="70" r="26"/><rect x="${x - 7}" y="63" width="14" height="14"/>`).join('')}</g>`,
    // 은전: 구름
    `<g opacity=".2" fill="none" stroke="${ink}" stroke-width="2.2">${[[40, 50], [130, 95], [190, 40]].map(([x, y]) => `<path d="M${x - 30} ${y} q10 -18 24 -6 q8 -16 24 -2 q16 -4 14 12 q-30 8 -62 -4z"/>`).join('')}</g>`,
    // 금전: 물결
    `<g opacity=".2" fill="none" stroke="${ink}" stroke-width="2">${[30, 60, 90, 120].map((y) => `<path d="M0 ${y} q20 -14 40 0 t40 0 t40 0 t40 0 t40 0 t40 0"/>`).join('')}</g>`,
    // 옥패: 매화
    `<g opacity=".22" fill="${ink}">${[[46, 44], [120, 96], [196, 52]].map(([x, y]) => [0, 72, 144, 216, 288].map((a) => `<circle cx="${x + 9 * Math.cos((a * Math.PI) / 180)}" cy="${y + 9 * Math.sin((a * Math.PI) / 180)}" r="6"/>`).join('')).join('')}</g>`,
    // 용옥: 용 비늘
    `<g opacity=".2" fill="none" stroke="${ink}" stroke-width="1.8">${Array.from({ length: 5 }, (_, r) => Array.from({ length: 9 }, (_, c) => `<path d="M${c * 28 + (r % 2) * 14} ${r * 28 + 14} a14 14 0 0 1 28 0"/>`).join('')).join('')}</g>`,
  ][i];
  return `<svg class="tx-svg" viewBox="0 0 320 140" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.hue}"/><stop offset=".55" stop-color="${t.hue}" stop-opacity=".82"/><stop offset="1" stop-color="${dark}"/></linearGradient>
    <linearGradient id="${id}e" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".5" stop-color="${t.hue}"/><stop offset="1" stop-color="#fff" stop-opacity=".7"/></linearGradient>
    <radialGradient id="${id}m" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="${t.hue}"/><stop offset="1" stop-color="${dark}"/></radialGradient>
    <clipPath id="${id}c"><path d="M14 4 H306 a10 10 0 0 1 10 10 V56 a14 14 0 0 0 0 28 V126 a10 10 0 0 1 -10 10 H14 a10 10 0 0 1 -10 -10 V84 a14 14 0 0 0 0 -28 V14 a10 10 0 0 1 10 -10 Z"/></clipPath>
  </defs>
  <g clip-path="url(#${id}c)">
    <rect width="320" height="140" fill="url(#${id}b)"/>
    ${motif}
    <rect x="0" y="0" width="320" height="140" fill="none" stroke="url(#${id}e)" stroke-width="7"/>
    <rect x="12" y="12" width="296" height="116" rx="6" fill="none" stroke="${ink}" stroke-opacity=".55" stroke-width="1.2"/>
    <rect x="16" y="16" width="288" height="108" rx="4" fill="none" stroke="${ink}" stroke-opacity=".25" stroke-width="1"/>
    <line x1="232" y1="14" x2="232" y2="126" stroke="${dark}" stroke-opacity=".55" stroke-width="2" stroke-dasharray="4 5"/>
    <circle cx="276" cy="70" r="30" fill="url(#${id}m)" stroke="${ink}" stroke-opacity=".8" stroke-width="2"/>
    <circle cx="276" cy="70" r="23" fill="none" stroke="${dark}" stroke-opacity=".5" stroke-width="1.2" stroke-dasharray="2 3"/>
    <text x="276" y="80" text-anchor="middle" font-size="28" font-weight="900" fill="${dark}" font-family="serif">${ROMAN[i]}</text>
  </g>
  ${mini ? '' : `<text x="30" y="50" font-size="13" font-weight="700" fill="${ink}" fill-opacity=".8" letter-spacing="3">매직고스톱 · 뽑기권</text>
  <text x="30" y="88" font-size="34" font-weight="900" fill="${ink}" style="paint-order:stroke" stroke="${dark}" stroke-opacity=".45" stroke-width="3">${t.name}</text>
  <text x="30" y="114" font-size="14" font-weight="700" fill="${ink}" fill-opacity=".9">${t.minGrade ? `${t.minGrade} 등급 이상 보장` : '누구나 가볍게'}</text>`}
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
  hero.innerHTML = `<div class="tx-hero-card">${ticketArt(t, sel)}<i class="tx-foil" aria-hidden="true"></i><i class="tx-shine" aria-hidden="true"></i></div>`;
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
  $('tx-odds').innerHTML = `<ol class="tx-ladder">${ladder}</ol>
    <div class="tx-stats">
      <div><small>최소 보장</small><b>${t.minGrade ? `${t.minGrade} 이상` : '없음'}</b></div>
      <div><small>S 이상</small><b>${r2(sum(S_INDEX))}</b></div>
      <div><small>SSS 이상</small><b>${r2(sum(8))}</b></div>
    </div>
    <div class="tx-rec">
      <div class="tx-rec-head"><b>뽑기 기록</b><span>${t.name} ${mine.length}회${bestRow ? ` · 최고 ${badge(bestRow.gi)}` : ''}</span></div>
      <div class="tx-rec-row">${recent.length ? recent.map((x) => `<i title="${GRADES[x.gi]}">${badge(x.gi)}</i>`).join('') : '<small>아직 기록이 없습니다</small>'}</div>
    </div>
    <details class="tx-all"><summary>뽑기권 5단계 확률 비교</summary><table><thead><tr><th></th>${TICKETS.map((x, i) => `<th class="${i === sel ? 'cur' : ''}" style="--tc:${x.hue}">${x.name.replace('권', '')}</th>`).join('')}</tr></thead><tbody>${
      GRADES.map((g, gi) => `<tr><td>${badge(gi)}</td>${TICKETS.map((x, i) => `<td class="${i === sel ? 'cur' : ''}">${x.rates[g] ? `${x.rates[g]}%` : '<span class="nil">–</span>'}</td>`).join('')}</tr>`).join('')
    }</tbody></table></details>`;

  $('tx-actions').innerHTML = [1, 10].map((n) => {
    const p = priceOf(t, n);
    return `<button type="button" class="tx-go${n === 10 ? ' ten' : ''}" data-n="${n}" ${coins() < p ? 'disabled' : ''} style="--tc:${t.hue}">
      <b>${n}회 뽑기</b><span><i class="coin-ico" aria-hidden="true"></i>${fmt(p)}</span>${n === 10 ? '<em>1회 무료</em>' : ''}</button>`;
  }).join('');
  $('tx-actions').querySelectorAll<HTMLButtonElement>('.tx-go').forEach((b) => b.addEventListener('click', () => {
    const n = +b.dataset.n!;
    if (!spend(priceOf(t, n))) { sfx.buzz([40]); return; }
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
    const col = p.hue != null ? `hsla(${(p.hue + fx.t * 120) % 360},95%,65%,${a})` : hexA(p.color, a);
    g.fillStyle = col;
    g.beginPath(); g.arc(p.x, p.y, p.size, 0, Math.PI * 2); g.fill();
    g.fillStyle = p.hue != null ? `hsla(${(p.hue + fx.t * 120) % 360},95%,65%,${a * 0.18})` : hexA(p.color, a * 0.18);
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
function closeRun() {
  $('gacha-run').hidden = true; fxStop(); running = false;
  $('gacha-run').querySelectorAll('.gx-fly, .gx-seal').forEach((e) => e.remove());
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
  return `<div class="gf${big ? ' big' : ''}" style="--i:${i};--gc:${gcol(d.gi)}" data-gi="${d.gi}" data-rb="${isRainbow(d.gi) ? 1 : 0}">
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

  // 1) 뽑기권이 날아와 빛나다 찢어짐
  const spin = $('gr-spin');
  spin.innerHTML = `<div class="gx-ticket"><div class="half l">${ticketArt(t, tier)}</div><div class="half r">${ticketArt(t, tier)}</div></div>`;
  stage.classList.add('intro');
  sfx.deal();
  await wait(650);
  stage.classList.add('tear'); sfx.slap(0.5);
  spawnOut(40, t.hue, false, center(), 0.5);
  await wait(380);

  // 2) 진짜 화투가 사선 축으로 빙글빙글 (앞면·뒷면 번갈아, 잔상 3겹) + 화투 패가 사선으로 쏟아짐 + 빛이 빨려 듦
  const pool = ALL_CARDS.filter((c) => c.month <= 12);
  const gwang = pool.filter((c) => c.kind === 'G');
  const face: Card = high ? gwang[Math.floor(Math.random() * gwang.length)] : pool[Math.floor(Math.random() * pool.length)];
  spin.innerHTML = `<div class="gx-card-wrap">${[3, 2, 1, 0].map((k) => `<div class="gx-card${k ? ' ghost' : ''}" style="--k:${k}"><div class="gx-back"></div><div class="gx-face">${cardArt(face)}</div></div>`).join('')}<div class="gx-glow"></div></div><div class="gx-ring"></div>`;
  stage.classList.remove('intro', 'tear'); void stage.offsetWidth;
  stage.classList.add('charge');
  // 등급 예고: 빛 색이 C → A → S → SS → SSS → 무지개 순으로 한 단계씩 오른다(실제 등급까지만)
  const ladder = [0, 3, 5, 6, 7, 8, 9].filter((g) => g <= best.gi);
  let lv = 0;
  stage.style.setProperty('--gc', gcol(ladder[0]));
  const steps = 14;
  const streamEnd = performance.now() + 2600;
  streamCards(stage, 6 + best.gi * 3, 2400, high);
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
    // 낮은 등급부터 순서대로, S 이상은 마지막에 하나씩 크게
    const order = els.map((el, i) => ({ el, gi: drops[i].gi })).sort((a, b) => (a.gi >= S_INDEX ? 1 : 0) - (b.gi >= S_INDEX ? 1 : 0));
    for (const { el, gi } of order) {
      if (gi >= S_INDEX) {
        el.classList.add('tease'); sfx.shake();
        await wait(520);
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
  $('gr-close').hidden = false;
  running = false;
  onChange();
}
