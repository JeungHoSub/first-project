// 매직고스톱 온라인 대전 서버
// - 무작위 대전(대기열) + 친구 대전(방 코드 6자리)
// - 판은 서버만 가진다(createGame/applyAction). 클라이언트가 보낸 수는 그 사람 차례이고 규칙에 맞을 때만 받는다
// - 각자에게는 "나 = 0번"으로 뒤집고, 상대 손패·더미는 가린 판(viewFor)을 보낸다
// - 한 수 20초. 넘기면 서버가 대신 둔다(고/스톱은 스톱, 그 외는 첫 번째 가능한 수). 3번 연속이면 기권
// - 온라인은 아이템·캐릭터 능력 없이 순수 맞고. 엽전은 걸지 않는다(결제 재화를 건 모르는 사람 간 대전 = 웹보드 규제)
import { createServer } from 'node:http';
import { randomBytes, randomInt } from 'node:crypto';
import { WebSocketServer, type WebSocket } from 'ws';
import { applyAction, createGame, getLegalActions } from '../../game/src/engine';
import type { Action, GameState, PlayerId } from '../../game/src/engine/types';
import { viewFor } from '../../game/src/net/view';

const PORT = Number(process.env.PORT ?? 8787);
const TURN_MS = Number(process.env.TURN_MS ?? 20000);
const MAX_TIMEOUTS = 3;

interface Profile { name: string; char: string }
interface Client { ws: WebSocket; id: string; profile: Profile; room: Room | null; seat: PlayerId }
interface Room { code: string | null; seats: [Client | null, Client | null]; state: GameState | null; timer: NodeJS.Timeout | null; deadline: number; timeouts: [number, number]; over: boolean }

const queue: Client[] = [];
const rooms = new Map<string, Room>(); // 친구 방(코드)
const send = (c: Client | null, msg: unknown) => { if (c && c.ws.readyState === c.ws.OPEN) c.ws.send(JSON.stringify(msg)); };
const clean = (s: unknown, n: number) => String(s ?? '').replace(/[<>&"'`]/g, '').slice(0, n);
const CHARS = ['hanryang', 'jumo', 'bobu', 'maehwa', 'janggun', 'dosa'];

function newCode(): string {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 헷갈리는 0/O/1/I 제외
  for (;;) { const c = Array.from({ length: 6 }, () => A[randomInt(A.length)]).join(''); if (!rooms.has(c)) return c; }
}
function opponent(r: Room, seat: PlayerId) { return r.seats[seat === 0 ? 1 : 0]; }

function startGame(r: Room) {
  r.state = createGame(randomBytes(8).toString('hex'), { dealer: randomInt(2) as PlayerId });
  r.timeouts = [0, 0]; r.over = false;
  for (const seat of [0, 1] as const) {
    const me = r.seats[seat]!; const op = opponent(r, seat)!;
    me.room = r; me.seat = seat;
    send(me, { t: 'start', opp: op.profile, state: viewFor(r.state, seat) });
  }
  afterMove(r);
}
function broadcast(r: Room, type: 'state' | 'end', extra: Record<string, unknown> = {}) {
  for (const seat of [0, 1] as const) send(r.seats[seat], { t: type, state: viewFor(r.state!, seat), deadline: r.deadline, ...extra });
}
function afterMove(r: Room) {
  if (r.timer) clearTimeout(r.timer);
  const s = r.state!;
  if (s.phase === 'ended') { r.over = true; broadcast(r, 'end', { reason: 'normal' }); closeRoom(r); return; }
  r.deadline = Date.now() + TURN_MS;
  r.timer = setTimeout(() => onTimeout(r), TURN_MS);
  broadcast(r, 'state');
}
function onTimeout(r: Room) {
  const s = r.state!; if (r.over || s.phase === 'ended') return;
  const seat = s.turn;
  r.timeouts[seat]++;
  if (r.timeouts[seat] >= MAX_TIMEOUTS) { forfeit(r, seat, 'timeout'); return; }
  const acts = getLegalActions(s);
  const a = acts.find((x) => x.type === 'stop') ?? acts[0];
  r.state = applyAction(s, a);
  send(r.seats[seat], { t: 'auto' });
  afterMove(r);
}
function forfeit(r: Room, loser: PlayerId, reason: 'left' | 'timeout') {
  if (r.over) return;
  r.over = true; if (r.timer) clearTimeout(r.timer);
  send(opponent(r, loser), { t: 'end', reason: reason === 'left' ? 'opp-left' : 'opp-timeout', win: true, state: r.state ? viewFor(r.state, loser === 0 ? 1 : 0) : null });
  send(r.seats[loser], { t: 'end', reason: reason === 'left' ? 'you-left' : 'you-timeout', win: false, state: r.state ? viewFor(r.state, loser) : null });
  closeRoom(r);
}
function closeRoom(r: Room) {
  if (r.code) rooms.delete(r.code);
  for (const c of r.seats) if (c && c.room === r) c.room = null;
}
const same = (a: Action, b: Action) => JSON.stringify(a) === JSON.stringify(b);

function onAct(c: Client, a: Action) {
  const r = c.room; if (!r || !r.state || r.over) return;
  const s = r.state;
  if (s.turn !== c.seat) { send(c, { t: 'err', msg: '상대 차례입니다' }); return; }
  const ok = getLegalActions(s).some((x) => same(x, a));
  if (!ok) { send(c, { t: 'err', msg: '둘 수 없는 수입니다' }); broadcast(r, 'state'); return; }
  r.timeouts[c.seat] = 0;
  r.state = applyAction(s, a);
  afterMove(r);
}
function leaveAll(c: Client) {
  const qi = queue.indexOf(c); if (qi >= 0) queue.splice(qi, 1);
  const r = c.room;
  if (r) {
    if (r.state && !r.over) forfeit(r, c.seat, 'left');
    else { if (r.code) rooms.delete(r.code); r.seats = [null, null]; }
    c.room = null;
  }
}

const http = createServer((req, res) => {
  // 상태 확인용 (배포 플랫폼 health check)
  res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
  res.end(JSON.stringify({ ok: true, queue: queue.length, rooms: rooms.size }));
});
const wss = new WebSocketServer({ server: http, maxPayload: 4096 });
wss.on('connection', (ws) => {
  const c: Client = { ws, id: randomBytes(6).toString('hex'), profile: { name: '손님', char: 'hanryang' }, room: null, seat: 0 };
  ws.on('message', (buf) => {
    let m: { t?: string; [k: string]: unknown };
    try { m = JSON.parse(String(buf)); } catch { return; }
    switch (m.t) {
      case 'hello': c.profile = { name: clean(m.name, 12) || '손님', char: CHARS.includes(String(m.char)) ? String(m.char) : 'hanryang' }; send(c, { t: 'hi', id: c.id }); break;
      case 'queue': {
        if (c.room || queue.includes(c)) return;
        const other = queue.shift();
        if (other && other.ws.readyState === other.ws.OPEN) startGame({ code: null, seats: [other, c], state: null, timer: null, deadline: 0, timeouts: [0, 0], over: false });
        else { queue.push(c); send(c, { t: 'queued', waiting: queue.length }); }
        break;
      }
      case 'cancel': leaveAll(c); send(c, { t: 'cancelled' }); break;
      case 'room:create': {
        leaveAll(c);
        const code = newCode();
        const r: Room = { code, seats: [c, null], state: null, timer: null, deadline: 0, timeouts: [0, 0], over: false };
        rooms.set(code, r); c.room = r; c.seat = 0;
        send(c, { t: 'room', code });
        break;
      }
      case 'room:join': {
        const code = clean(m.code, 6).toUpperCase();
        const r = rooms.get(code);
        if (!r || r.state || r.seats[1] || !r.seats[0]) { send(c, { t: 'err', msg: '방을 찾을 수 없습니다' }); return; }
        if (r.seats[0] === c) return;
        leaveAll(c);
        r.seats[1] = c; startGame(r);
        break;
      }
      case 'act': if (m.action && typeof m.action === 'object') onAct(c, m.action as Action); break;
      case 'leave': leaveAll(c); break;
    }
  });
  ws.on('close', () => leaveAll(c));
});
http.listen(PORT, () => console.log(`매직고스톱 대전 서버 :${PORT}`));
