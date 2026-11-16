import { applyAction, countCards, createGame, createRng, describeResult, getLegalActions, score } from '../src/engine';
import type { Action, GameState } from '../src/engine';

const seed = process.argv[2] ?? String(Date.now() % 100000);
const rng = createRng('sim-' + seed);
const pick = (a: Action[]) => a[Math.floor(rng() * a.length)];

let s: GameState = createGame(seed);
console.log(`시드 ${seed} | 바닥: ${s.floor.map((c) => c.id).join(' ')}`);
let shown = s.events.length;
let guard = 0;
while (s.phase !== 'ended' && guard++ < 500) {
  s = applyAction(s, pick(getLegalActions(s)));
  for (const e of s.events.slice(shown)) {
    const who = 'player' in e ? `P${e.player} ` : '';
    const rest = Object.entries(e).filter(([k]) => k !== 'type' && k !== 'player').map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ');
    console.log(`  ${who}${e.type} ${rest}`);
  }
  shown = s.events.length;
}
console.log(`점수: P0 ${score(s.captured[0]).total} / P1 ${score(s.captured[1]).total} | 카드 합계 ${countCards(s)}`);
console.log(`결과: ${describeResult(s.result!)}`);
