// 온라인 대전 로비: 서버 연결, 무작위 대전 대기열, 친구 대전(방 만들기·코드로 들어가기)
// 판 진행·연출은 main.ts가 맡는다(hooks). 이 모듈은 연결과 대기 화면만.
import type { Action, GameState } from '../engine/types';
import * as sfx from './sound';

export interface OppProfile { name: string; char: string }
export interface OnlineHooks {
  start(state: GameState, opp: OppProfile, send: (a: Action) => void): void;
  state(state: GameState): void;
  end(msg: { reason: string; win?: boolean; state: GameState | null }): void;
  auto(): void;
  toast(msg: string): void;
  me(): { name: string; char: string };
}
/** 서버 주소: 정식 서버를 올리면 여기(또는 설정)에 넣는다. 지금은 내 컴퓨터 시험용 */
const DEFAULT_SERVER = 'wss://magic-gostop.onrender.com'; // Render에 만든 서비스 주소 (다르면 여기만 바꾸면 됨)
export const serverUrl = () => { try { return localStorage.getItem('mg-server') || DEFAULT_SERVER; } catch { return DEFAULT_SERVER; } };

const $ = (id: string) => document.getElementById(id)!;
let ws: WebSocket | null = null;
let hooks: OnlineHooks;
let mode: 'idle' | 'queue' | 'room' | 'playing' = 'idle';
let timerT: number | null = null;

function setView(v: 'menu' | 'wait' | 'room' | 'join' | 'error', text = '') {
  for (const id of ['ol-menu', 'ol-wait', 'ol-room', 'ol-join', 'ol-error']) $(id).hidden = id !== `ol-${v}`;
  if (v === 'wait') $('ol-wait-txt').textContent = text || '상대를 찾고 있습니다';
  if (v === 'error') $('ol-error-txt').textContent = text;
}
function connect(): Promise<WebSocket> {
  if (ws && ws.readyState === WebSocket.OPEN) return Promise.resolve(ws);
  return new Promise((res, rej) => {
    let sock: WebSocket;
    try { sock = new WebSocket(serverUrl()); } catch { rej(new Error('bad url')); return; }
    const t = setTimeout(() => { sock.close(); rej(new Error('timeout')); }, 65000); // 무료 서버가 잠들어 있으면 깨어나는 데 최대 1분
    sock.onopen = () => { clearTimeout(t); ws = sock; const me = hooks.me(); sock.send(JSON.stringify({ t: 'hello', name: me.name, char: me.char })); res(sock); };
    sock.onerror = () => { clearTimeout(t); rej(new Error('error')); };
    sock.onclose = () => {
      if (ws === sock) ws = null;
      if (mode === 'playing') hooks.end({ reason: 'disconnected', state: null });
      mode = 'idle';
    };
    sock.onmessage = (ev) => onMsg(JSON.parse(String(ev.data)));
  });
}
const sendRaw = (m: unknown) => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m)); };

function onMsg(m: { t: string; [k: string]: unknown }) {
  switch (m.t) {
    case 'queued': setView('wait', '상대를 찾고 있습니다'); break;
    case 'room': $('ol-code').textContent = String(m.code); setView('room'); break;
    case 'err': if (mode === 'playing') hooks.toast(String(m.msg)); else { setView('error', String(m.msg)); mode = 'idle'; } break;
    case 'start':
      mode = 'playing'; $('online').hidden = true; sfx.reward();
      hooks.start(m.state as GameState, m.opp as OppProfile, (a) => sendRaw({ t: 'act', action: a }));
      break;
    case 'state': hooks.state(m.state as GameState); startCountdown(); break;
    case 'auto': hooks.toast('시간이 지나 자동으로 냈습니다'); hooks.auto(); break;
    case 'end': mode = 'idle'; stopCountdown(); hooks.end({ reason: String(m.reason), win: m.win as boolean | undefined, state: (m.state as GameState) ?? null }); break;
  }
}
// 남은 시간 표시 (서버 20초)
function startCountdown() {
  stopCountdown();
  const el = document.getElementById('turn-timer'); if (!el) return;
  const end = Date.now() + 20000; el.hidden = false;
  const tick = () => { const left = Math.max(0, Math.ceil((end - Date.now()) / 1000)); el.textContent = `${left}초`; el.classList.toggle('low', left <= 5); };
  tick(); timerT = window.setInterval(tick, 250);
}
function stopCountdown() { if (timerT !== null) clearInterval(timerT); timerT = null; const el = document.getElementById('turn-timer'); if (el) el.hidden = true; }

async function go(kind: 'queue' | 'create' | 'join') {
  sfx.unlock(); sfx.click();
  setView('wait', '서버에 연결하는 중');
  // 무료 서버는 한동안 아무도 없으면 잠든다 → 주소를 한 번 불러 깨우고, 오래 걸리면 안내
  try { fetch(serverUrl().replace(/^ws/, 'http'), { mode: 'no-cors' }).catch(() => {}); } catch { /* 무시 */ }
  const slow = setTimeout(() => setView('wait', '서버를 깨우는 중입니다 (처음엔 최대 1분)'), 3000);
  try { await connect(); clearTimeout(slow); } catch { clearTimeout(slow); setView('error', '대전 서버에 연결할 수 없습니다. 잠시 뒤 다시 시도해 주세요.'); return; }
  if (kind === 'queue') { mode = 'queue'; sendRaw({ t: 'queue' }); }
  else if (kind === 'create') { mode = 'room'; sendRaw({ t: 'room:create' }); }
  else {
    const code = ($('ol-code-in') as HTMLInputElement).value.trim().toUpperCase();
    if (code.length !== 6) { setView('join'); hooks.toast('방 코드 6자리를 넣어 주세요'); return; }
    mode = 'room'; sendRaw({ t: 'room:join', code }); setView('wait', `${code} 방에 들어가는 중`);
  }
}
function cancel() { sendRaw({ t: 'cancel' }); mode = 'idle'; setView('menu'); }

export function openOnline() { setView('menu'); $('online').hidden = false; }
/** 판이 끝난 뒤 "다시 찾기": 무작위 대전 대기열로 */
export function again() { openOnline(); go('queue'); }
export function leave() { sendRaw({ t: 'leave' }); mode = 'idle'; stopCountdown(); }

export function initOnline(h: OnlineHooks) {
  hooks = h;
  $('btn-online').addEventListener('click', () => { sfx.unlock(); sfx.click(); openOnline(); });
  $('ol-random').addEventListener('click', () => go('queue'));
  $('ol-create').addEventListener('click', () => go('create'));
  $('ol-joinbtn').addEventListener('click', () => { sfx.click(); setView('join'); ($('ol-code-in') as HTMLInputElement).focus(); });
  $('ol-join-go').addEventListener('click', () => go('join'));
  $('ol-copy').addEventListener('click', async () => {
    const code = $('ol-code').textContent || '';
    try { await navigator.clipboard.writeText(code); hooks.toast('방 코드를 복사했습니다'); } catch { hooks.toast(`방 코드: ${code}`); }
  });
  for (const id of ['ol-cancel', 'ol-room-cancel', 'ol-join-back', 'ol-error-back']) $(id).addEventListener('click', cancel);
  $('online').querySelectorAll<HTMLElement>('[data-close]').forEach((b) => b.addEventListener('click', () => { cancel(); $('online').hidden = true; }));
}
