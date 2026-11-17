// 뽑기 화면 + 뽑기 연출: 화투 뒷면이 사선 축으로 돌며 빛을 모으다가 등급 색으로 번쩍 → 아이템 공개.
import { TICKETS, GRADES, GRADE_COLOR, drawWithTicket, priceOf, itemArt, CATEGORY_LABEL, type Ticket, type Drop } from './collection';
import * as sfx from './sound';
import { coins, spend, earn, fmt, onCoins, COIN } from './wallet';

const $ = (id: string) => document.getElementById(id)!;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const gcol = (gi: number) => (GRADE_COLOR[GRADES[gi]] === 'rainbow' ? '#ffd23a' : GRADE_COLOR[GRADES[gi]]);
const badge = (gi: number) => {
  const c = GRADE_COLOR[GRADES[gi]];
  return `<span class="gbadge${c === 'rainbow' ? ' rainbow' : ''}" style="${c === 'rainbow' ? '' : `--gc:${c}`}">${GRADES[gi]}</span>`;
};

let onChange: () => void = () => {};

export function initGacha(changed: () => void) {
  onChange = changed;
  $('btn-gacha-close').addEventListener('click', () => { $('gacha').hidden = true; });
  $('gr-close').addEventListener('click', () => { $('gacha-run').hidden = true; renderTickets(); });
  $('btn-coin-test').addEventListener('click', () => { earn(10000); sfx.bonus(); renderTickets(); });
  onCoins(() => syncCoins());
}

export function openGacha() {
  renderTickets();
  $('gacha').hidden = false;
}

function ticketIcon(t: Ticket, i: number) {
  return `<svg viewBox="0 0 64 40" aria-hidden="true"><defs><linearGradient id="tk-${t.id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".45" stop-color="${t.hue}"/><stop offset="1" stop-color="${t.hue}" stop-opacity=".7"/></linearGradient></defs>
    <path d="M4 4h56v10a6 6 0 0 0 0 12v10H4V26a6 6 0 0 0 0-12z" fill="url(#tk-${t.id})"/>
    <path d="M44 7v26" stroke="rgba(0,0,0,.35)" stroke-width="1.2" stroke-dasharray="2 2.5"/>
    <text x="24" y="27" text-anchor="middle" font-size="17" font-weight="800" fill="rgba(20,12,4,.82)">${['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ'][i] ?? i + 1}</text></svg>`;
}

function syncCoins() {
  document.querySelectorAll('.coin-amt').forEach((e) => { e.textContent = fmt(coins()); });
}

function renderTickets() {
  syncCoins();
  const box = $('ticket-list'); box.innerHTML = '';
  TICKETS.forEach((t, i) => {
    const el = document.createElement('div');
    el.className = 'ticket';
    el.style.setProperty('--tc', t.hue);
    const hi = GRADES.reduce((a, g, gi) => a + (gi >= 6 ? t.rates[g] : 0), 0);
    const bar = GRADES.map((g, gi) => (t.rates[g] > 0 ? `<i style="flex:${t.rates[g]};background:${gcol(gi)}"></i>` : '')).join('');
    const sub = [t.minGrade ? `${t.minGrade} 이상 보장` : '보장 없음', hi < 100 ? `S↑ ${Math.round(hi * 100) / 100}%` : ''].filter(Boolean).join(' · ');
    el.innerHTML = `<div class="tk-icon">${ticketIcon(t, i)}</div>
      <div class="tk-info"><b>${t.name}</b><small>${sub}</small><div class="tk-bar" title="등급 분포">${bar}</div></div>
      <div class="tk-btns">${[1, 10].map((n) => {
        const p = priceOf(t, n);
        return `<button type="button" class="tk-btn tk-${n}${n === 10 ? ' primary' : ''}" data-n="${n}" ${coins() < p ? 'disabled' : ''}><span>${n}회</span><em>${fmt(p)}</em></button>`;
      }).join('')}</div>`;
    el.querySelectorAll<HTMLButtonElement>('.tk-btn').forEach((b) => b.addEventListener('click', () => {
      const n = +b.dataset.n!;
      if (!spend(priceOf(t, n))) { sfx.buzz([40]); return; }
      run(t, n);
    }));
    box.append(el);
  });
  // 확률표 (확률 공개): 등급 × 뽑기권
  const table = `<details class="tk-odds"><summary>등급별 확률표</summary><table><thead><tr><th></th>${TICKETS.map((t) => `<th style="--tc:${t.hue}">${t.name.replace(' 뽑기권', '')}</th>`).join('')}</tr></thead><tbody>${
    GRADES.map((g, gi) => `<tr><td>${badge(gi)}</td>${TICKETS.map((t) => `<td>${t.rates[g] ? `${t.rates[g]}%` : '<span class="nil">–</span>'}</td>`).join('')}</tr>`).join('')
  }</tbody></table></details>`;
  box.insertAdjacentHTML('beforeend', table);
}

/** 뽑기 연출 */
async function run(t: Ticket, n: number) {
  sfx.unlock();
  const drops: Drop[] = Array.from({ length: n }, () => drawWithTicket(t));
  const best = drops.reduce((a, d) => (d.gi > a.gi ? d : a), drops[0]);
  const stage = $('gacha-run');
  const spin = $('gr-spin');
  const res = $('gr-results');
  res.innerHTML = ''; res.hidden = true;
  $('gr-close').hidden = true;
  stage.style.setProperty('--gc', gcol(best.gi));
  stage.style.setProperty('--tc', t.hue);
  stage.dataset.tier = best.gi >= 8 ? 'top' : best.gi >= 6 ? 'high' : 'normal';
  stage.hidden = false;
  stage.classList.remove('charge', 'burst', 'done'); void stage.offsetWidth;
  // 1) 화투 뒷면이 사선으로 빙글빙글 돌며 점점 빨라지고 빛이 모인다
  spin.innerHTML = `<div class="gr-card"><div class="gr-back"></div><div class="gr-glow"></div></div>${'<i class="gr-spark"></i>'.repeat(14)}`;
  spin.querySelectorAll<HTMLElement>('.gr-spark').forEach((s, i) => { s.style.setProperty('--a', `${i * 26}deg`); s.style.setProperty('--d', `${(i % 4) * 0.15}s`); });
  stage.classList.add('charge');
  const steps = reduced ? 0 : 9;
  for (let i = 0; i < steps; i++) { sfx.deal(); await wait(220 - i * 16); }
  if (best.gi >= 6 && !reduced) { sfx.shake(); await wait(450); }
  // 2) 등급 색으로 번쩍
  stage.classList.add('burst');
  sfx.magic(); if (best.gi >= 6) setTimeout(() => sfx.bonus(), 300); if (best.gi >= 8) setTimeout(() => sfx.win(), 600);
  sfx.buzz(best.gi >= 6 ? [60, 40, 90] : [30]);
  await wait(reduced ? 0 : 650);
  // 3) 결과 공개
  stage.classList.add('done');
  res.innerHTML = drops.map((d, i) => `<div class="gr-item" style="--i:${i};--gc:${gcol(d.gi)}">
      <div class="gr-art">${itemArt(d.item, d.gi)}</div>
      <div class="gr-name">${d.item.name} ${badge(d.gi)}</div>
      <div class="gr-cat">${CATEGORY_LABEL[d.item.category as keyof typeof CATEGORY_LABEL] ?? ''}${d.isNewBest ? ' · <b>최고 등급 갱신</b>' : ''}</div>
      <div class="gr-desc">${d.item.effect(d.gi)}</div></div>`).join('');
  res.dataset.n = String(n);
  res.hidden = false;
  $('gr-close').hidden = false;
  onChange();
}
