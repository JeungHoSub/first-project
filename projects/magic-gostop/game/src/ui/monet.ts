// 수익 구조 (outputs/monetization.md)
// - 돈으로 사는 것과 판돈(엽전)을 완전히 끊는다: 엽전·은화·금화·뽑기권·능력치 아이템은 절대 팔지 않는다.
// - 유료 상품은 능력치 없는 꾸미기 꾸러미뿐 (결제는 출시 버전에서 Google Play 결제로 연결).
// - 광고는 "보고 싶을 때 보는" 보상형만. 판 중간 강제 광고 없음.
// - 금화는 무료로만 얻는다(보상형 광고 하루 1번, 오늘 미션 모두 완료, 금은 보따리 아이템).
import { add, bal, fmt, curIco } from './wallet';
import { ROOMS } from './wallet';
import * as sfx from './sound';

const $ = (id: string) => document.getElementById(id)!;
const KEY = 'mg-monet-v1';
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
interface St { day: string; adYeop: number; adGeum: number; rescue: boolean }
let st: St = { day: today(), adYeop: 0, adGeum: 0, rescue: false };
try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (v && v.day) st = v; } catch { /* 무시 */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* 무시 */ } };
const roll = () => { if (st.day !== today()) { st = { day: today(), adYeop: 0, adGeum: 0, rescue: false }; save(); } };

/** 하루 한도와 보상 */
export const AD_YEOP = { limit: 5, amount: 3000 };
export const AD_GEUM = { limit: 1, amount: 1 };
export const RESCUE = { amount: 5000, below: ROOMS.easy.min };

/** 유료 꾸미기 꾸러미 (능력치 없음). 가격은 출시 때 확정 */
export const PACKS = [
  { id: 'pack-moon', name: '달밤 꾸러미', price: 3300, has: ['카드 뒷면 · 금박 매화', '이름표 · 금실 테두리', '먹기 이펙트 · 별가루'] },
  { id: 'pack-spring', name: '벚꽃 꾸러미', price: 5500, has: ['효과음 · 판소리 추임새 "얼쑤"', '먹기 이펙트 · 꽃잎', '이름표 · 청색 구름 테두리'] },
  { id: 'pack-dragon', name: '용궁 꾸러미', price: 11000, has: ['카드 뒷면 · 흐르는 무지갯빛', '먹기 이펙트 · 불꽃', '이름표 · 주홍 용 문양 테두리', '효과음 · 가야금 꾸밈 + 얼쑤'] },
];

let notify: (m: string) => void = () => {};
let changed: () => void = () => {};

/** 보상형 광고 1편. 앱(AdMob)이 연결되면 그쪽을 쓰고, 아니면 미리보기용 가짜 광고(5초). 끝까지 보면 true */
export function watchAd(): Promise<boolean> {
  type AdBridge = { showRewarded?: () => Promise<boolean> };
  const real = (window as unknown as { mgAds?: AdBridge }).mgAds;
  if (real?.showRewarded) return real.showRewarded().catch(() => false);
  return new Promise((res) => {
    const o = document.createElement('div'); o.className = 'ad-sim';
    o.innerHTML = `<div class="ad-box"><div class="ad-tag">광고</div><p>여기에 보상형 광고가 나옵니다<br><small>(미리보기에서는 5초 기다리면 보상)</small></p><b class="ad-left">5</b><button type="button" class="ad-x">그만 보기</button></div>`;
    document.body.append(o);
    let left = 5;
    const t = setInterval(() => {
      left--; o.querySelector('.ad-left')!.textContent = String(left);
      if (left <= 0) { clearInterval(t); o.remove(); res(true); }
    }, 1000);
    o.querySelector('.ad-x')!.addEventListener('click', () => { clearInterval(t); o.remove(); res(false); });
  });
}

function sheet(): HTMLElement {
  let s = document.getElementById('charge');
  if (s) return s;
  s = document.createElement('div'); s.className = 'sheet'; s.id = 'charge'; s.hidden = true;
  s.innerHTML = `<div class="sheet-card inv-card">
    <div class="inv-head"><div><div class="sheet-kicker">주막</div><div class="sheet-title">무료 충전소</div></div><button class="x-btn" data-close type="button" aria-label="닫기">✕</button></div>
    <div class="cur-line"><i class="cur-ico yeop"></i> <b data-cur="yeop">0</b> · <i class="cur-ico eun"></i> <b data-cur="eun">0</b> · <i class="cur-ico geum"></i> <b data-cur="geum">0</b></div>
    <ul class="fc-list" id="fc-list"></ul>
    <div class="pk-head">꾸미기 꾸러미 <small>능력치 없음 · 판 결과에 영향 없음</small></div>
    <ul class="pk-list" id="pk-list"></ul>
    <p class="dt-note">엽전·은화·금화와 뽑기권은 돈으로 팔지 않습니다. 모든 재화는 현금으로 되돌릴 수 없습니다.</p>
    <button class="tk-close" data-close type="button">닫기</button>
  </div>`;
  document.body.append(s);
  s.querySelectorAll<HTMLElement>('[data-close]').forEach((b) => b.addEventListener('click', () => { s!.hidden = true; changed(); }));
  return s;
}

function render() {
  roll();
  const canRescue = !st.rescue && bal('yeop') < RESCUE.below;
  const rows = [
    { id: 'rescue', title: '구제금', sub: st.rescue ? '오늘 이미 받음 · 내일 다시' : `엽전이 ${fmt(RESCUE.below)}보다 적을 때 하루 1번`, btn: `${curIco('yeop')} ${fmt(RESCUE.amount)} 받기`, ok: canRescue, ad: false },
    { id: 'ad-yeop', title: '광고 보고 엽전', sub: `오늘 ${st.adYeop} / ${AD_YEOP.limit}번`, btn: `▶ ${curIco('yeop')} ${fmt(AD_YEOP.amount)}`, ok: st.adYeop < AD_YEOP.limit, ad: true },
    { id: 'ad-geum', title: '광고 보고 금화', sub: `오늘 ${st.adGeum} / ${AD_GEUM.limit}번`, btn: `▶ ${curIco('geum')} ${AD_GEUM.amount}`, ok: st.adGeum < AD_GEUM.limit, ad: true },
  ];
  $('fc-list').innerHTML = rows.map((r) => `<li class="fc-row"><div class="fc-txt"><b>${r.title}</b><small>${r.sub}</small></div><button type="button" class="fc-btn${r.ad ? ' ad' : ''}" data-fc="${r.id}" ${r.ok ? '' : 'disabled'}>${r.btn}</button></li>`).join('');
  $('fc-list').querySelectorAll<HTMLButtonElement>('[data-fc]').forEach((b) => b.addEventListener('click', async () => {
    const id = b.dataset.fc!; b.disabled = true;
    if (id === 'rescue') { if (st.rescue || bal('yeop') >= RESCUE.below) return; st.rescue = true; save(); add('yeop', RESCUE.amount); sfx.reward(); sfx.coinRain(600); notify(`구제금 엽전 ${fmt(RESCUE.amount)}`); }
    else {
      sfx.click();
      const ok = await watchAd(); roll();
      if (!ok) { notify('광고를 끝까지 보면 보상을 받습니다'); render(); return; }
      if (id === 'ad-yeop' && st.adYeop < AD_YEOP.limit) { st.adYeop++; save(); add('yeop', AD_YEOP.amount); sfx.reward(); sfx.coinRain(500); notify(`엽전 +${fmt(AD_YEOP.amount)}`); }
      if (id === 'ad-geum' && st.adGeum < AD_GEUM.limit) { st.adGeum++; save(); add('geum', AD_GEUM.amount); sfx.reward(); notify(`금화 +${AD_GEUM.amount}`); }
    }
    render(); changed();
  }));
  $('pk-list').innerHTML = PACKS.map((p) => `<li class="pk-row"><div class="pk-txt"><b>${p.name}</b><small>${p.has.join(' · ')}</small></div><button type="button" class="pk-btn" disabled title="출시 버전에서 Google Play 결제로 열립니다">₩${fmt(p.price)}<small>출시 때 열림</small></button></li>`).join('');
}

export function openCharge() { sheet(); render(); changed(); sheet().hidden = false; }
/** 엽전이 모자라 방에 못 들어갈 때 */
export function needCoins(min: number) {
  roll();
  notify(`엽전이 ${fmt(min)} 이상 있어야 들어갑니다 · 무료 충전소에서 채우세요`);
  openCharge();
}
export function initMonet(onChange: () => void, toast: (m: string) => void) {
  changed = onChange; notify = toast; sheet();
}
