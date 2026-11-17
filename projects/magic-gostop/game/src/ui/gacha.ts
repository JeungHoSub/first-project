// 뽑기 화면 + 뽑기 연출: 화투 뒷면이 사선 축으로 돌며 빛을 모으다가 등급 색으로 번쩍 → 아이템 공개.
import { TICKETS, GRADES, GRADE_COLOR, drawWithTicket, itemArt, CATEGORY_LABEL, type Ticket, type Drop } from './collection';
import * as sfx from './sound';

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
}

export function openGacha() {
  renderTickets();
  $('gacha').hidden = false;
}

function renderTickets() {
  const box = $('ticket-list'); box.innerHTML = '';
  TICKETS.forEach((t, i) => {
    const el = document.createElement('div');
    el.className = 'ticket';
    el.style.setProperty('--tc', t.hue);
    const top = GRADES.map((g, gi) => ({ g, gi, p: t.rates[g] })).filter((x) => x.p > 0);
    const hi = top.filter((x) => x.gi >= 6).reduce((a, x) => a + x.p, 0);
    el.innerHTML = `<div class="tk-face"><span class="tk-tier">${'★'.repeat(i + 1)}</span><b>${t.name}</b><small>${t.desc}</small></div>
      <div class="tk-rates">${top.map((x) => `<span>${badge(x.gi)} ${x.p}%</span>`).join('')}</div>
      <div class="tk-meta">S 이상 ${Math.round(hi * 100) / 100}%${t.minGrade ? ` · ${t.minGrade} 이상 보장` : ''}</div>
      <div class="tk-btns"><button type="button" class="big go-btn tk-1">1회 뽑기</button><button type="button" class="big stop-btn tk-5">5회 뽑기</button></div>`;
    el.querySelector('.tk-1')!.addEventListener('click', () => run(t, 1));
    el.querySelector('.tk-5')!.addEventListener('click', () => run(t, 5));
    box.append(el);
  });
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
