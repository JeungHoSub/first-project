// AI 대전 측정: npm run ai-match -- <A> <B> [판수=200] [시드접두]
// 예: npm run ai-match -- normal easy 400
// 같은 시드를 자리(선)를 바꿔 두 번씩 둔다(공정). A 기준 승률·평균 점수차(나가리 0)를 출력한다.
import { applyAction, createGame, createRng, getLegalActions } from '../src/engine';
import type { GameState } from '../src/engine';
import { chooseAction, type AiLevel } from '../src/ai/simple';

import { TUNE } from '../src/ai/normal';
import { HARD_TUNE } from '../src/ai/hard';
if (process.env.TUNE) { const t = JSON.parse(process.env.TUNE); Object.assign(TUNE, t); Object.assign(HARD_TUNE, t); }
const [a = 'normal', b = 'easy', n = '200', prefix = 'match'] = process.argv.slice(2);
const games = Number(n);
const rng = createRng('ai-match-rng-' + prefix); // 어려움 표본 난수 (재현용)

const diffs: number[] = [];
let wScore = 0, lScore = 0, aGo = 0, aStopAct = 0;
let win = 0, lose = 0, draw = 0, diff = 0, ply = 0, ms = 0, decisions = 0, maxMs = 0;
for (let i = 0; i < games; i++) {
  const seed = `${prefix}-${Math.floor(i / 2)}`;
  const aSeat = (i % 2) as 0 | 1; // 같은 시드에서 A가 선 / 후 번갈아
  let s: GameState = createGame(seed, { dealer: 0 });
  let guard = 0;
  while (s.phase !== 'ended' && guard++ < 400) {
    const level = (s.turn === aSeat ? a : b) as AiLevel;
    const t0 = performance.now();
    const act = chooseAction(s, level, { rng, samples: Number(process.env.SAMPLES) || undefined, candidates: Number(process.env.CANDS) || undefined });
    const dt = performance.now() - t0;
    if (level === 'hard') { ms += dt; decisions++; maxMs = Math.max(maxMs, dt); }
    if (!getLegalActions(s).some((l) => JSON.stringify(l) === JSON.stringify(act))) throw new Error('불법 행동 ' + JSON.stringify(act));
    if (s.phase === 'goStop' && s.turn === aSeat) { if (act.type === 'go') aGo++; else aStopAct++; }
    s = applyAction(s, act);
    ply++;
  }
  const r = s.result!;
  diffs.push(r.type === 'nagari' ? 0 : r.winner === aSeat ? r.finalScore : -r.finalScore);
  if (r.type === 'nagari') draw++;
  else if (r.winner === aSeat) { win++; diff += r.finalScore; wScore += r.finalScore; }
  else { lose++; diff -= r.finalScore; lScore += r.finalScore; }
}
const dec = win + lose;
const mean = diffs.reduce((x, y) => x + y, 0) / games;
const se = Math.sqrt(diffs.reduce((x, y) => x + (y - mean) ** 2, 0) / Math.max(1, games - 1) / games);
console.log(`${a} vs ${b} | ${games}판 | ${a} 승 ${win} / 패 ${lose} / 나가리 ${draw}`);
console.log(`  ${a} 승률(나가리 제외) ${(100 * win / Math.max(1, dec)).toFixed(1)}% | 판당 평균 점수차 ${(diff / games).toFixed(2)} (표준오차 ±${se.toFixed(2)})`);
console.log(`  ${a} 이길 때 평균 ${(wScore / Math.max(1, win)).toFixed(1)}점 / 질 때 평균 ${(lScore / Math.max(1, lose)).toFixed(1)}점 | ${a} 고 ${aGo}회 / 스톱 ${aStopAct}회`);
if (decisions) console.log(`  어려움 한 수 평균 ${(ms / decisions).toFixed(1)}ms, 최대 ${maxMs.toFixed(0)}ms (${decisions}수)`);
