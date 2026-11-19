// 서버 점검: 자동으로 두는 손님 둘이 무작위 대전 1판 + 친구 방 대전 1판을 끝까지 둔다
import WebSocket from 'ws';
import { getLegalActions } from '../../game/src/engine';
import type { GameState } from '../../game/src/engine/types';

const URL = process.env.URL ?? 'ws://localhost:8787';
type Msg = { t: string; [k: string]: unknown };

function bot(name: string, onMsg?: (m: Msg, ws: WebSocket) => void, delay = 5): Promise<{ ws: WebSocket; done: Promise<Msg> }> {
  return new Promise((res) => {
    const ws = new WebSocket(URL);
    let finish: (m: Msg) => void; const done = new Promise<Msg>((r) => (finish = r));
    let moves = 0;
    ws.on('message', (b) => {
      const m = JSON.parse(String(b)) as Msg;
      onMsg?.(m, ws);
      if (m.t === 'state') {
        const s = m.state as GameState;
        if (s.turn === 0 && s.phase !== 'ended') {
          const acts = getLegalActions(s);
          // 몰래 상대 차례에 두거나 엉뚱한 수를 보내 보기(서버가 막는지) — 첫 수 전에 한 번
          if (moves === 0) ws.send(JSON.stringify({ t: 'act', action: { type: 'go' } }));
          moves++;
          setTimeout(() => ws.send(JSON.stringify({ t: 'act', action: acts[Math.floor(Math.random() * acts.length)] })), delay);
        }
      }
      if (m.t === 'end') finish(m);
    });
    ws.on('open', () => { ws.send(JSON.stringify({ t: 'hello', name, char: 'hanryang' })); res({ ws, done }); });
  });
}

const errs: string[] = [];
const track = (who: string) => (m: Msg) => { if (m.t === 'err') errs.push(`${who}:${m.msg}`); };

// 1) 무작위 대전
const a = await bot('갑', track('갑')); const b = await bot('을', track('을'));
a.ws.send(JSON.stringify({ t: 'queue' })); b.ws.send(JSON.stringify({ t: 'queue' }));
const [ea, eb] = await Promise.all([a.done, b.done]);
const ra = (ea.state as GameState).result, rb = (eb.state as GameState).result;
console.log('무작위 대전 끝:', ea.reason, ra?.type, rb?.type, ra?.type === 'win' && rb?.type === 'win' ? `갑 기준 승자 ${ra.winner} / 을 기준 승자 ${rb.winner} (서로 반대여야 함)` : '나가리');

// 2) 친구 대전: 갑이 방을 만들고 을이 코드로 들어옴
let code = '';
const c = await bot('병', (m) => { if (m.t === 'room') code = String(m.code); track('병')(m); });
const d = await bot('정', track('정'));
c.ws.send(JSON.stringify({ t: 'room:create' }));
await new Promise((r) => setTimeout(r, 100));
d.ws.send(JSON.stringify({ t: 'room:join', code: 'ZZZZZZ' })); // 없는 방
d.ws.send(JSON.stringify({ t: 'room:join', code }));
const [ec] = await Promise.all([c.done, d.done]);
console.log('친구 대전 끝:', code, ec.reason);

// 3) 기권: 한 사람이 나가면 상대가 이김
const e = await bot('무', track('무'), 400); const f = await bot('기', track('기'), 400);
e.ws.send(JSON.stringify({ t: 'queue' })); f.ws.send(JSON.stringify({ t: 'queue' }));
await new Promise((r) => setTimeout(r, 900)); f.ws.close();
const ee = await e.done; console.log('기권:', ee.reason, ee.win);

console.log('서버가 막은 잘못된 수:', errs.length, [...new Set(errs.map((x) => x.split(':')[1]))].join(', '));
for (const x of [a, b, c, d, e]) x.ws.close();
process.exit(0);
