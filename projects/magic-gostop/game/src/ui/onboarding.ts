// 처음 하는 사람: 첫 판 손가락 안내(튜토리얼) · 7일 출석 보상
import { add, fmt, curIco, type Cur } from './wallet';
import * as sfx from './sound';

const $ = (id: string) => document.getElementById(id);
const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const put = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* 무시 */ } };

// ================= 튜토리얼 =================
const TUT_KEY = 'mg-tutorial-v1';
/** 0: 아직 시작 전(패 내기 안내 대기) · 1: 먹은 패 안내 대기 · 9: 끝 */
let step = +(get(TUT_KEY) ?? '0');
export const tutorialDone = () => step >= 9;
/** 첫 판(튜토리얼 판)이면 봇이 살살 둔다 */
export const isFirstGame = () => get('mg-first-done') !== '1';
export function markFirstGameDone() { put('mg-first-done', '1'); }
export function resetTutorial() { step = 0; put(TUT_KEY, '0'); put('mg-first-done', '0'); }
const save = () => put(TUT_KEY, String(step));

let coach: HTMLElement | null = null;
function clearCoach() { coach?.remove(); coach = null; }
/** 대상 칸을 밝게 남기고 나머지를 어둡게 + 손가락 + 말풍선. next가 있으면 [다음] 버튼, 없으면 대상을 누를 때까지 */
function show(target: Element | null, text: string, next?: string): Promise<void> {
  clearCoach();
  return new Promise((res) => {
    const o = document.createElement('div'); o.className = 'coach';
    const r = target?.getBoundingClientRect();
    const hole = document.createElement('div'); hole.className = 'coach-hole';
    if (r) Object.assign(hole.style, { left: `${r.left - 6}px`, top: `${r.top - 6}px`, width: `${r.width + 12}px`, height: `${r.height + 12}px` });
    else Object.assign(hole.style, { left: '50%', top: '40%', width: '0', height: '0' });
    o.append(hole);
    if (r) {
      const f = document.createElement('div'); f.className = 'coach-finger'; f.textContent = '👆';
      Object.assign(f.style, { left: `${r.left + r.width / 2 - 14}px`, top: `${r.bottom - 4}px` });
      o.append(f);
    }
    const tip = document.createElement('div'); tip.className = 'coach-tip';
    tip.innerHTML = `<p>${text}</p>${next ? `<button type="button" class="coach-next">${next}</button>` : ''}<button type="button" class="coach-skip">안내 건너뛰기</button>`;
    o.append(tip);
    document.body.append(o);
    // 말풍선은 대상 반대편에
    const below = !r || r.top < innerHeight * 0.5;
    tip.style.top = below ? `${Math.min(innerHeight - tip.offsetHeight - 12, (r ? r.bottom : innerHeight * 0.4) + 46)}px` : `${Math.max(12, (r ? r.top : 0) - tip.offsetHeight - 16)}px`;
    coach = o;
    tip.querySelector('.coach-skip')!.addEventListener('click', () => { step = 9; save(); clearCoach(); res(); });
    if (next) tip.querySelector('.coach-next')!.addEventListener('click', () => { sfx.click(); clearCoach(); res(); });
    else res();
  });
}

/** 판 화면이 다시 그려질 때마다 부른다. 내 차례·패 낼 때 첫 안내 */
export function tutorialOnTurn(myPlayTurn: boolean) {
  if (step !== 0) return;
  if (!myPlayTurn) { if (coach && !coach.querySelector('.coach-next')) clearCoach(); return; }
  const m = document.querySelector('#hand .card.match');
  void show(m ?? document.querySelector('#hand .card'),
    m ? '<b>같은 월(같은 꽃)</b>의 패를 내면 바닥 패를 먹습니다.<br>위에 <b>▼</b> 표시가 있는 패를 눌러 보세요.'
      : '바닥에 같은 월이 없으면 <b>아무 패나</b> 내서 바닥에 둡니다.<br>패를 하나 눌러 보세요.');
}
/** 내가 패를 낸 뒤(연출 끝) */
export async function tutorialAfterMyMove(capturedNow: number) {
  if (step === 0) { clearCoach(); if (capturedNow > 0) { step = 1; save(); } else return; }
  if (step !== 1) return;
  step = 2; save();
  await show($('my-caps'), '먹은 패는 여기에 모입니다.<br><b>광 · 열끗 · 띠 · 피</b>를 모아 점수를 냅니다. (오른쪽 위 ? 에 족보)', '다음');
  if (step >= 9) return;
  await show($('my-score'), '<b>7점</b>이 나면 <b>고</b>(계속해서 더 크게)나 <b>스톱</b>(지금 점수로 이기기)을 고릅니다.<br>고 하면 점수가 커지지만, 상대가 먼저 점수를 내면 집니다.', '다음');
  if (step >= 9) return;
  const bar = $('magic-bar');
  if (bar && !bar.hidden && bar.offsetParent) await show(bar, '가진 <b>주문 카드</b>는 내 차례에 눌러서 씁니다. 다른 아이템은 판마다 저절로 확률적으로 발동합니다.', '다음');
  await show(null, '이제 직접 해 보세요! 첫 판은 상대가 살살 둡니다. 🍀', '시작');
  step = 9; save();
}

// ================= 7일 출석 =================
const ATT_KEY = 'mg-attend-v1';
interface Att { last: string; n: number }
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
export const ATTEND: { [k in Cur]?: number }[] = [
  { yeop: 3000 }, { eun: 3 }, { yeop: 5000 }, { eun: 5 }, { yeop: 8000 }, { geum: 1 }, { geum: 2, eun: 10 },
];
function loadAtt(): Att { try { const v = JSON.parse(get(ATT_KEY) || 'null'); if (v && typeof v.n === 'number') return v; } catch { /* 무시 */ } return { last: '', n: 0 }; }
export const attendReady = () => loadAtt().last !== today();
const rewardText = (r: { [k in Cur]?: number }) => (Object.entries(r) as [Cur, number][]).map(([c, n]) => `${curIco(c)}${fmt(n)}`).join(' ');

export function openAttendance(onDone: () => void, toast: (m: string) => void) {
  const a = loadAtt();
  const ready = a.last !== today();
  const idx = a.n % 7; // 오늘 받을 칸 (받았으면 다음 칸은 내일)
  let s = document.getElementById('attend');
  if (!s) { s = document.createElement('div'); s.className = 'sheet'; s.id = 'attend'; document.body.append(s); }
  s.innerHTML = `<div class="sheet-card inv-card">
    <div class="inv-head"><div><div class="sheet-kicker">매일 들르면</div><div class="sheet-title">7일 출석</div></div><button class="x-btn" data-close type="button" aria-label="닫기">✕</button></div>
    <ol class="at-grid">${ATTEND.map((r, i) => {
      const lastIdx = (a.n - 1 + 7) % 7; // 오늘 이미 받았으면 마지막으로 받은 칸
      const got = ready ? i < idx : i <= lastIdx;
      const today = ready && i === idx;
      return `<li class="at-day${got ? ' got' : ''}${today ? ' today' : ''}${i === 6 ? ' big' : ''}"><small>${i + 1}일째</small><span>${rewardText(r)}</span>${got ? '<em>받음</em>' : ''}</li>`;
    }).join('')}</ol>
    <button type="button" class="bk-btn" id="at-claim" ${ready ? '' : 'disabled'}>${ready ? `${idx + 1}일째 보상 받기` : '오늘은 받았습니다 · 내일 또 오세요'}</button>
    <p class="dt-note">하루 한 번 들러서 받으면 칸이 하나씩 넘어갑니다(날짜를 걸러도 이어짐). 7일째를 받으면 1일째부터 다시.</p>
  </div>`;
  s.hidden = false;
  s.querySelectorAll<HTMLElement>('[data-close]').forEach((b) => b.addEventListener('click', () => { s!.hidden = true; onDone(); }));
  s.querySelector('#at-claim')!.addEventListener('click', () => {
    const cur = loadAtt(); if (cur.last === today()) return;
    const r = ATTEND[cur.n % 7];
    for (const [c, n] of Object.entries(r) as [Cur, number][]) add(c, n);
    put(ATT_KEY, JSON.stringify({ last: today(), n: cur.n + 1 }));
    sfx.attend(); toast(`출석 ${cur.n % 7 + 1}일째 보상!`);
    openAttendance(onDone, toast); onDone();
  });
}
