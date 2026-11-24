// 앱에 꼭 필요한 것: 안드로이드 뒤로 가기, 화면 꺼짐 방지, 저장 데이터 백업 코드.
// 앱(Capacitor)에서는 window.Capacitor.Plugins.App을 쓰고, 웹 미리보기에서는 조용히 넘어간다.
import * as sfx from './sound';

const $ = (id: string) => document.getElementById(id)!;
type AppPlugin = { addListener: (ev: string, cb: () => void) => unknown; exitApp: () => Promise<void> };
const capApp = (): AppPlugin | undefined => (window as unknown as { Capacitor?: { Plugins?: { App?: AppPlugin } } }).Capacitor?.Plugins?.App;

// ---------------- 확인 창 ----------------
export function askConfirm(title: string, body: string, yes = '네', no = '아니요'): Promise<boolean> {
  return new Promise((res) => {
    const o = document.createElement('div'); o.className = 'cf-back';
    o.innerHTML = `<div class="cf-card" role="alertdialog" aria-modal="true"><b>${title}</b><p>${body}</p><div class="cf-row"><button type="button" class="cf-no">${no}</button><button type="button" class="cf-yes">${yes}</button></div></div>`;
    document.body.append(o);
    const done = (v: boolean) => { o.remove(); res(v); };
    o.querySelector('.cf-yes')!.addEventListener('click', () => { sfx.click(); done(true); });
    o.querySelector('.cf-no')!.addEventListener('click', () => { sfx.click(); done(false); });
    o.addEventListener('click', (e) => { if (e.target === o) done(false); });
  });
}

// ---------------- 뒤로 가기 ----------------
/** 지금 열려 있는 맨 위 창을 닫는다. 닫은 게 있으면 true */
function closeTop(): boolean {
  const cf = document.querySelector<HTMLElement>('.cf-back');
  if (cf) { cf.querySelector<HTMLElement>('.cf-no')?.click(); return true; }
  if (document.querySelector('.ad-sim')) { document.querySelector<HTMLElement>('.ad-sim .ad-x')?.click(); return true; }
  const cands = [...document.querySelectorAll<HTMLElement>('#tx-zoom, .sheet, #gacha, #info, #collection, #item-detail, #caps-detail, #reward')]
    .filter((el) => !el.hidden && getComputedStyle(el).display !== 'none');
  if (!cands.length) return false;
  cands.sort((a, b) => (+getComputedStyle(b).zIndex || 0) - (+getComputedStyle(a).zIndex || 0));
  const top = cands[0];
  const x = top.querySelector<HTMLElement>('[data-close], .x-btn, .tz-x, .tk-close, #btn-gacha-close, #btn-coll-close');
  if (x) x.click(); else top.hidden = true;
  return true;
}

let lastBack = 0;
async function onBack(h: NativeHooks) {
  if (closeTop()) return;
  if (h.inGame()) { h.quit(); return; } // 판 중: 기권 확인 (main.ts)
  const now = Date.now();
  if (now - lastBack < 2000) { void capApp()?.exitApp(); return; }
  lastBack = now; h.toast('한 번 더 누르면 종료됩니다');
}

// ---------------- 화면 꺼짐 방지 ----------------
type Sentinel = { release: () => Promise<void> };
let lock: Sentinel | null = null;
async function keepAwake() {
  try {
    const wl = (navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<Sentinel> } }).wakeLock;
    if (!wl || lock || document.visibilityState !== 'visible') return;
    lock = await wl.request('screen');
    (lock as unknown as EventTarget).addEventListener?.('release', () => { lock = null; });
  } catch { lock = null; }
}

// ---------------- 백업 코드 ----------------
// 이 기기에 저장된 매직고스톱 기록(mg-로 시작하는 저장값)을 글자 묶음으로 만든다. 다른 폰에 붙여 넣으면 그대로 옮겨진다.
// 손으로 고치면 못 쓰게 간단한 확인값을 붙인다 (보안 장치는 아님 — 정식 클라우드 저장은 계정 연결 뒤).
const SALT = 'mg-backup-v1:hwatu';
function sum(t: string) { let h = 2166136261; for (const ch of SALT + t) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); }
const b64e = (t: string) => btoa(String.fromCharCode(...new TextEncoder().encode(t)));
const b64d = (t: string) => new TextDecoder().decode(Uint8Array.from(atob(t), (c) => c.charCodeAt(0)));
export function makeBackup(): string {
  const data: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i)!; if (k.startsWith('mg-')) data[k] = localStorage.getItem(k)!; }
  const body = b64e(JSON.stringify({ v: 1, at: Date.now(), data }));
  return `MG1.${body}.${sum(body)}`;
}
export function readBackup(code: string): { at: number; data: Record<string, string> } | null {
  const m = code.replace(/\s+/g, '').match(/^MG1\.([A-Za-z0-9+/=]+)\.([a-z0-9]+)$/);
  if (!m || sum(m[1]) !== m[2]) return null;
  try { const o = JSON.parse(b64d(m[1])); return o && o.data ? o : null; } catch { return null; }
}
function backupSheet(h: NativeHooks) {
  let s = document.getElementById('backup');
  if (!s) {
    s = document.createElement('div'); s.className = 'sheet'; s.id = 'backup'; s.hidden = true;
    s.innerHTML = `<div class="sheet-card inv-card">
      <div class="inv-head"><div><div class="sheet-kicker">기록 옮기기</div><div class="sheet-title">저장 백업</div></div><button class="x-btn" data-close type="button" aria-label="닫기">✕</button></div>
      <p class="tx-sub">엽전·은화·금화·아이템·동료·설정이 이 폰 안에만 저장됩니다. 앱을 지우거나 폰을 바꾸기 전에 백업 코드를 만들어 카톡 나에게 보내기 등으로 보관하세요.</p>
      <button type="button" class="bk-btn" id="bk-make">백업 코드 만들기 · 복사</button>
      <textarea id="bk-code" class="bk-code" rows="4" placeholder="여기에 백업 코드를 붙여 넣으세요" spellcheck="false"></textarea>
      <button type="button" class="bk-btn sub" id="bk-load">이 코드로 불러오기</button>
      <p class="dt-note">불러오면 지금 이 폰의 기록은 백업 코드의 기록으로 바뀝니다.</p>
      <button class="tk-close" data-close type="button">닫기</button></div>`;
    document.body.append(s);
    s.querySelectorAll<HTMLElement>('[data-close]').forEach((b) => b.addEventListener('click', () => { s!.hidden = true; }));
    const ta = s.querySelector<HTMLTextAreaElement>('#bk-code')!;
    s.querySelector('#bk-make')!.addEventListener('click', async () => {
      sfx.click(); const code = makeBackup(); ta.value = code;
      try {
        const nav = navigator as Navigator & { share?: (d: { title: string; text: string }) => Promise<void> };
        await navigator.clipboard.writeText(code); h.toast('백업 코드를 복사했습니다 · 안전한 곳에 붙여 넣어 두세요');
        if (capApp() && nav.share) await nav.share({ title: '매직고스톱 백업 코드', text: code }).catch(() => {});
      } catch { ta.select(); h.toast('아래 코드를 길게 눌러 복사하세요'); }
    });
    s.querySelector('#bk-load')!.addEventListener('click', async () => {
      sfx.click();
      const r = readBackup(ta.value);
      if (!r) { h.toast('백업 코드가 맞지 않습니다 · 처음부터 끝까지 그대로 붙여 넣어 주세요'); return; }
      const when = new Date(r.at).toLocaleString('ko-KR');
      if (!(await askConfirm('이 백업으로 바꿀까요?', `${when}에 만든 백업입니다. 지금 이 폰의 기록은 사라집니다.`, '불러오기', '취소'))) return;
      const old: string[] = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i)!; if (k.startsWith('mg-')) old.push(k); }
      old.forEach((k) => localStorage.removeItem(k));
      for (const [k, v] of Object.entries(r.data)) if (k.startsWith('mg-')) localStorage.setItem(k, v);
      location.reload();
    });
  }
  return s;
}

export interface NativeHooks { inGame(): boolean; quit(): void; toast(m: string): void }
export function initNative(h: NativeHooks) {
  capApp()?.addListener('backButton', () => { void onBack(h); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !document.getElementById('tx-zoom')?.offsetParent) closeTop(); });
  // 화면 꺼짐 방지: 처음 누를 때, 그리고 다시 앱으로 돌아올 때마다
  addEventListener('pointerdown', () => { void keepAwake(); }, { once: true });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void keepAwake(); });
  document.getElementById('btn-backup')?.addEventListener('click', () => { sfx.click(); backupSheet(h).hidden = false; });
}
