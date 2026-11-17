// 효과음: 외부 음원 없이 Web Audio로 합성한다 (저작권 걱정 없음, 파일 크기 0).
// 브라우저 정책상 사용자가 화면을 한 번 누른 뒤부터 소리가 난다.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
try { muted = localStorage.getItem('mg-muted') === '1'; } catch { /* 저장소 없음 */ }

export function isMuted() { return muted; }
export function setMuted(v: boolean) {
  muted = v;
  try { localStorage.setItem('mg-muted', v ? '1' : '0'); } catch { /* 무시 */ }
  if (master) master.gain.value = v ? 0 : 0.9;
}

/** 첫 터치 때 호출해 오디오를 깨운다 */
export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
}

function noiseBuffer(sec: number) {
  const c = ctx!;
  const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * sec)), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}
function env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}
function noise(t: number, dur: number, type: BiquadFilterType, freq: number, peak: number, q = 1, sweepTo?: number) {
  const c = ctx!;
  const src = c.createBufferSource(); src.buffer = noiseBuffer(dur + 0.05);
  const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  const g = c.createGain(); env(g, t, peak, 0.002, dur);
  src.connect(f).connect(g).connect(master!);
  src.start(t); src.stop(t + dur + 0.05);
}
function tone(t: number, dur: number, type: OscillatorType, f0: number, f1: number, peak: number, attack = 0.004) {
  const c = ctx!;
  const o = c.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
  const g = c.createGain(); env(g, t, peak, attack, dur);
  o.connect(g).connect(master!);
  o.start(t); o.stop(t + attack + dur + 0.05);
}
function ready() { return !!ctx && !!master && !muted; }
const now = () => ctx!.currentTime;

/** 화투 "착" 소리 샘플: 무작위 잡음을 매번 겹치면 지글거리므로(뿌직), 한 번 계산해 둔 깨끗한 타격음을 재생한다.
 *  ① 아주 짧은 건조한 순간음(패 모서리가 부딪히는 "ㅊ") ② 딱딱한 플라스틱 판의 짧은 울림("악") ③ 담요가 받는 낮은 "턱" */
let hitBufs: AudioBuffer[] = [];
function makeHits() {
  const c = ctx!; const sr = c.sampleRate;
  const out: AudioBuffer[] = [];
  for (let v = 0; v < 3; v++) {
    const len = Math.floor(sr * 0.11);
    const buf = c.createBuffer(1, len, sr); const d = buf.getChannelData(0);
    let seed = 1234 + v * 777; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 * 2 - 1; };
    const modes = [[760 + v * 30, 0.012, 0.42], [1580 + v * 50, 0.008, 0.55], [2650 + v * 60, 0.0055, 0.4], [3900 + v * 90, 0.0035, 0.22]];
    let lp = 0, peak = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      lp += 0.55 * (rnd() - lp); // 부드럽게 다듬은 잡음 (쇳소리 제거)
      const atk = Math.min(1, t / 0.0004);
      let x = lp * Math.exp(-t / 0.0022) * 1.1;
      for (const [f, tau, amp] of modes) x += amp * Math.sin(2 * Math.PI * f * t) * Math.exp(-t / tau);
      const ft = 135 - 55 * Math.min(1, t / 0.04);
      x += 0.7 * Math.sin(2 * Math.PI * ft * t) * Math.exp(-t / 0.016);
      x *= atk; d[i] = x; peak = Math.max(peak, Math.abs(x));
    }
    for (let i = 0; i < len; i++) d[i] /= peak;
    out.push(buf);
  }
  return out;
}
let hitN = 0;
function clack(t: number, vol: number, bright = 1) {
  const c = ctx!;
  if (!hitBufs.length) hitBufs = makeHits();
  const src = c.createBufferSource(); src.buffer = hitBufs[hitN++ % hitBufs.length];
  src.playbackRate.value = bright;
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 6500; f.Q.value = 0.5;
  const g = c.createGain(); g.gain.value = vol;
  src.connect(f).connect(g).connect(master!);
  src.start(t);
}
/** 화투장을 바닥에 내리치는 소리. power 0~1 — 한 번에 "착!" */
export function slap(power = 0.7) {
  if (!ready()) return;
  clack(now(), 0.55 + 0.4 * power, 0.98);
}
/** 윷가락 던지기: 나무가 부딪히며 날아오르는 소리 */
export function yutToss() {
  if (!ready()) return;
  const t = now();
  for (let i = 0; i < 4; i++) { noise(t + i * 0.03, 0.04, 'bandpass', 900 + i * 120, 0.25, 4); tone(t + i * 0.03, 0.05, 'triangle', 420 + i * 40, 300, 0.08, 0.001); }
  noise(t + 0.1, 0.35, 'bandpass', 1500, 0.06, 0.8, 600);
}
/** 윷가락이 멍석에 떨어지는 소리: 나무 "따닥 딱딱" */
export function yutLand() {
  if (!ready()) return;
  const t = now();
  [0, 0.05, 0.09, 0.16, 0.2].forEach((d, i) => { noise(t + d, 0.05, 'bandpass', 700 + (i % 3) * 180, 0.4 - i * 0.05, 5); tone(t + d, 0.07, 'triangle', 380 - i * 20, 220, 0.12, 0.001); });
}
/** 더미에서 뒤집는 소리: 살짝 넘기는 소리 뒤 가볍게 "착" */
export function flip() {
  if (!ready()) return;
  const t = now();
  noise(t, 0.05, 'bandpass', 2400, 0.035, 0.6, 1400);
  clack(t + 0.05, 0.4, 1.06);
}
/** 패를 먹어 가져오는 소리 ("착착" + 짧은 반짝임) */
/** 꾸미기 "효과음 팩" 단계 (-1 = 기본). 먹을 때 소리에 국악풍 음을 얹는다 */
let pack = -1;
export function setPack(g: number) { pack = g; }
const PENTA = [392, 440, 523, 587, 659, 784, 880]; // 평조풍 5음
export function capture(count = 2) {
  if (!ready()) return;
  const t = now();
  // 먹은 패를 모아 쥐는 "착착": 장수만큼 빠르게 겹쳐 붙는 소리
  const n = Math.max(2, Math.min(count, 3));
  for (let i = 0; i < n; i++) clack(t + i * 0.085, i === n - 1 ? 0.75 : 0.55, 1.02 + i * 0.03);
  if (pack < 1) return;
  // 가야금 뜯는 소리(1~), 장구(2~), 징(3~), 여러 음 꾸밈(6~)
  const base = PENTA[Math.floor(Math.random() * 4)];
  tone(t + 0.02, 0.5, 'sawtooth', base * 2, base * 1.98, 0.035, 0.002);
  if (pack >= 2) noise(t, 0.09, 'lowpass', 220, 0.35, 0.7, 120);
  if (pack >= 3) tone(t + 0.04, 0.9, 'sine', 196, 188, 0.05, 0.01);
  if (pack >= 6) for (let i = 1; i <= Math.min(pack - 4, 4); i++) tone(t + 0.07 * i, 0.3, 'triangle', PENTA[(i * 2) % PENTA.length] * 2, PENTA[(i * 2) % PENTA.length] * 2, 0.03);
}
/** 피 뺏어 오기 */
export function steal() {
  if (!ready()) return;
  const t = now();
  tone(t, 0.12, 'square', 660, 990, 0.07);
  tone(t + 0.1, 0.16, 'square', 990, 1480, 0.06);
}
/** 뻑: 김 빠지는 "뿌웅" */
export function ppeok() {
  if (!ready()) return;
  const t = now();
  slap(0.9);
  const c = ctx!;
  const o = c.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(320, t + 0.08); o.frequency.exponentialRampToValueAtTime(90, t + 0.75);
  const lfo = c.createOscillator(); lfo.frequency.value = 18;
  const lg = c.createGain(); lg.gain.value = 22; lfo.connect(lg).connect(o.frequency);
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1200;
  const g = c.createGain(); env(g, t + 0.08, 0.22, 0.02, 0.7);
  o.connect(f).connect(g).connect(master!);
  o.start(t + 0.08); lfo.start(t + 0.08); o.stop(t + 0.9); lfo.stop(t + 0.9);
}
/** 쪽·따닥·싹쓸이처럼 기분 좋은 한 방 */
export function bonus() {
  if (!ready()) return;
  const t = now();
  slap(1);
  [784, 988, 1175, 1568].forEach((fq, i) => tone(t + 0.06 + i * 0.07, 0.22, 'triangle', fq, fq, 0.1));
}
/** 흔들기: 패를 "착착착" 흔드는 소리 */
export function shake() {
  if (!ready()) return;
  const t = now();
  for (let i = 0; i < 6; i++) noise(t + i * 0.075, 0.04, 'bandpass', 2600 + (i % 2) * 600, 0.3, 1.5);
  tone(t + 0.45, 0.25, 'triangle', 523, 784, 0.1);
}
/** 폭탄: 묵직한 "쾅" 두 번 + 파편 튀는 소리 */
export function bomb() {
  if (!ready()) return;
  const t = now();
  noise(t, 1.1, 'lowpass', 2400, 1.0, 0.8, 50);
  tone(t, 0.9, 'sine', 140, 28, 1.0, 0.002);
  tone(t, 0.3, 'square', 90, 35, 0.22, 0.002);
  noise(t + 0.02, 0.18, 'highpass', 2500, 0.5, 0.6);
  tone(t + 0.16, 0.7, 'sine', 90, 30, 0.6, 0.004);
  noise(t + 0.16, 0.7, 'lowpass', 900, 0.5, 0.7, 80);
  for (let i = 0; i < 9; i++) noise(t + 0.25 + i * 0.06 + (i % 3) * 0.02, 0.03, 'bandpass', 3000 + (i % 4) * 700, 0.18 - i * 0.012, 2);
}
/** 고 */
export function go() {
  if (!ready()) return;
  const t = now();
  [523, 659, 784].forEach((fq, i) => tone(t + i * 0.08, 0.25, 'square', fq, fq, 0.07));
  tone(t + 0.24, 0.4, 'triangle', 1047, 1047, 0.12);
}
/** 스톱 */
export function stop() {
  if (!ready()) return;
  const t = now();
  slap(1);
  [392, 494, 587].forEach((fq) => tone(t + 0.05, 0.5, 'triangle', fq, fq, 0.08));
}
export function win() {
  if (!ready()) return;
  const t = now();
  [523, 659, 784, 1047, 784, 1047].forEach((fq, i) => tone(t + i * 0.11, 0.28, 'triangle', fq, fq, 0.12));
}
export function lose() {
  if (!ready()) return;
  const t = now();
  [392, 349, 311, 262].forEach((fq, i) => tone(t + i * 0.16, 0.3, 'triangle', fq, fq * 0.98, 0.1));
}
export function tick() {
  if (!ready()) return;
  noise(now(), 0.02, 'highpass', 4000, 0.12, 0.7);
}

/** 휴대폰 진동 (지원하는 기기만) */
export function buzz(ms: number | number[]) {
  if (muted) return;
  try { navigator.vibrate?.(ms); } catch { /* 무시 */ }
}

// ---------- 배경음악: 계면조 가야금 산조풍(농현·떠는음·꺾는음) + 대금 + 은은한 장구 + 지속음, 잔향 ----------
// 중국풍으로 들리기 쉬운 평조 5음·꽹과리·태평소 대신, 한국 특유의 계면조(미·라·시·레)와 농현으로 차분하고 고급스럽게.
let bgmOn = true;
try { bgmOn = localStorage.getItem('mg-bgm') !== '0'; } catch { /* 무시 */ }
let bgmTimer: number | null = null;
let bgmGain: GainNode | null = null;
let bgmBus: GainNode | null = null; // 악기 → 이 버스 → (원음 + 잔향) → bgmGain
let nextT = 0;
let step = 0;
// 계면조(E): 미 라 시 레 미 …
const SC = [164.8, 220.0, 246.9, 293.7, 329.6, 440.0, 493.9, 587.3, 659.3];
// 가야금 선율: [음, 길이(칸), 꾸밈(0 평음 · 1 떠는음 · 2 꺾는음)] 한 마디 12칸 × 8마디
const GAYA: [number, number, number][] = [
  [4, 3, 1], [5, 3, 0], [6, 6, 2],
  [5, 3, 0], [4, 3, 0], [3, 3, 0], [4, 3, 1],
  [5, 6, 1], [6, 3, 0], [7, 3, 0],
  [8, 6, 2], [7, 3, 0], [6, 3, 0],
  [5, 3, 0], [6, 3, 0], [5, 3, 2], [4, 3, 0],
  [3, 6, 0], [4, 6, 1],
  [2, 3, 0], [3, 3, 0], [4, 6, 1],
  [4, 9, 1], [-1, 3, 0],
];
// 대금: 드문드문 길게 (8마디 = 96칸)
const DAE: [number, number][] = [[-1, 24], [8, 12], [7, 12], [-1, 24], [5, 12], [4, 12]];

export function isBgmOn() { return bgmOn; }

function makeReverb(c: AudioContext, sec = 2.8) {
  const len = Math.floor(c.sampleRate * sec);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
  }
  const cv = c.createConvolver(); cv.buffer = buf; return cv;
}
/** 가야금: 명주실을 뜯는 둥근 소리. orn 1 = 떠는음(깊은 떨림), 2 = 꺾는음(한 음 아래로 꺾어 내림) */
function gaya(t: number, f: number, orn: number, dur: number, vol: number) {
  const c = ctx!;
  const o = c.createOscillator(); o.type = 'triangle';
  const o2 = c.createOscillator(); o2.type = 'sawtooth';
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.7;
  lp.frequency.setValueAtTime(f * 9, t); lp.frequency.exponentialRampToValueAtTime(f * 3, t + 0.6);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(1.6, dur + 0.8));
  const g2 = c.createGain(); g2.gain.value = 0.45;
  for (const x of [o, o2]) x.frequency.setValueAtTime(f, t);
  // 한 옥타브 위 배음: 작은 스피커에서도 선율이 들리게
  const o3 = c.createOscillator(); o3.type = 'sine'; o3.frequency.setValueAtTime(f * 2, t);
  const g3 = c.createGain(); g3.gain.value = 0.3; o3.connect(g3).connect(g); o3.start(t); o3.stop(t + Math.max(1.7, dur + 0.9));
  if (orn === 1) { // 떠는음: 천천히 시작해 깊어지는 떨림
    const lfo = c.createOscillator(); lfo.frequency.value = 5.5;
    const lg = c.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(0, t + 0.18); lg.gain.linearRampToValueAtTime(f * 0.03, t + Math.min(dur, 0.9));
    lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency); lfo.start(t); lfo.stop(t + dur + 1);
  } else if (orn === 2) { // 꺾는음: 살짝 밀어 올렸다가 아래로 꺾음
    for (const x of [o, o2]) { x.frequency.linearRampToValueAtTime(f * 1.03, t + 0.12); x.frequency.setValueAtTime(f * 1.03, t + dur * 0.45); x.frequency.exponentialRampToValueAtTime(f * 0.89, t + dur * 0.75); }
  }
  o.connect(g); o2.connect(lp).connect(g2).connect(g); g.connect(bgmBus!);
  const end = t + Math.max(1.7, dur + 0.9);
  o.start(t); o2.start(t); o.stop(end); o2.stop(end);
}
/** 대금: 숨이 섞인 부드러운 긴 소리 */
function dae(t: number, f: number, dur: number, vol: number) {
  const c = ctx!;
  const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f * 0.97, t); o.frequency.linearRampToValueAtTime(f, t + 0.25);
  const lfo = c.createOscillator(); lfo.frequency.value = 4.6;
  const lg = c.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.01, t + dur * 0.7);
  lfo.connect(lg).connect(o.frequency);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.5); g.gain.setValueAtTime(vol, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.6);
  o.connect(g).connect(bgmBus!);
  const n = c.createBufferSource(); n.buffer = noiseBuffer(dur + 0.7);
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 3;
  const ng = c.createGain(); ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(vol * 0.25, t + 0.1); ng.gain.exponentialRampToValueAtTime(vol * 0.06, t + 0.6); ng.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.5);
  n.connect(bp).connect(ng).connect(bgmBus!);
  o.start(t); lfo.start(t); n.start(t); const end = t + dur + 0.7; o.stop(end); lfo.stop(end); n.stop(end);
}
/** 장구: 부드러운 북편(덩·쿵)만 은은하게 */
function drum(t: number, vol: number) {
  const c = ctx!;
  const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(52, t + 0.25);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
  o.connect(g).connect(bgmBus!); o.start(t); o.stop(t + 0.55);
}
/** 바닥에 깔리는 지속음 (아쟁 느낌) */
function drone(t: number, dur: number) {
  const c = ctx!;
  for (const [f, v] of [[82.4, 0.05], [123.5, 0.025]] as const) {
    const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + dur * 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp).connect(g).connect(bgmBus!); o.start(t); o.stop(t + dur + 0.1);
  }
}
/** 부드러운 리듬: 킥(둥) · 쉐이커(사락) · 따뜻한 베이스 */
function kick(t: number, vol: number) {
  const c = ctx!;
  const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
  o.connect(g).connect(bgmBus!); o.start(t); o.stop(t + 0.35);
}
function shaker(t: number, vol: number) {
  const c = ctx!;
  const n = c.createBufferSource(); n.buffer = noiseBuffer(0.08);
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 6500; f.Q.value = 1.5;
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  n.connect(f).connect(g).connect(bgmBus!); n.start(t); n.stop(t + 0.08);
}
function bass(t: number, f: number, dur: number, vol: number) {
  const c = ctx!;
  const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320;
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(lp).connect(g).connect(bgmBus!); o.start(t); o.stop(t + dur + 0.05);
}
// 마디별 베이스 근음 (계면조: 미·라·시·레)
const BASS_ROOT = [82.4, 82.4, 110.0, 123.5, 110.0, 73.4, 82.4, 82.4];
/** 장구 채편: 가벼운 "딱" (기덕·덕) */
function chae(t: number, vol: number) {
  const c = ctx!;
  const n = c.createBufferSource(); n.buffer = noiseBuffer(0.06);
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1700; bp.Q.value = 2.2;
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  n.connect(bp).connect(g).connect(bgmBus!); n.start(t); n.stop(t + 0.06);
}

// ---------- 곡 목록 ----------
// 곡마다 장르·악기·화성·템포를 완전히 다르게: 로파이 재즈 / 앰비언트 / 퓨전 그루브 / 시네마틱 / 보사노바 / 시티팝.
// 16분음표 격자(한 마디 16칸), 서양 화성(7·9화음) 위에 국악기 색은 양념으로만.
const mf = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const out = (n: AudioNode) => { n.connect(bgmBus!); };
function adsr(g: GainNode, t: number, a: number, peak: number, d: number) {
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}
let nbuf: AudioBuffer | null = null;
function nz(t: number, dur: number, type: BiquadFilterType, freq: number, vol: number, q = 1) {
  const c = ctx!; if (!nbuf) nbuf = noiseBuffer(1);
  const s = c.createBufferSource(); s.buffer = nbuf;
  const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain(); adsr(g, t, 0.001, vol, dur);
  s.connect(f).connect(g); out(g); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}
/** 로즈 전자피아노(FM) */
function ep(t: number, notes: number[], dur: number, vol: number) {
  const c = ctx!;
  notes.forEach((m, i) => {
    const tt = t + i * 0.01; const f = mf(m);
    const car = c.createOscillator(); car.frequency.value = f;
    const mod = c.createOscillator(); mod.frequency.value = f;
    const mg = c.createGain(); mg.gain.setValueAtTime(f * 1.1, tt); mg.gain.exponentialRampToValueAtTime(f * 0.04, tt + 0.5);
    const tine = c.createOscillator(); tine.frequency.value = f * 4; const tg = c.createGain(); adsr(tg, tt, 0.002, vol * 0.25, 0.15);
    mod.connect(mg).connect(car.frequency);
    const g = c.createGain(); adsr(g, tt, 0.006, vol, dur + 0.5);
    car.connect(g); tine.connect(tg); out(g); out(tg);
    [car, mod, tine].forEach((o) => { o.start(tt); o.stop(tt + dur + 0.7); });
  });
}
/** 넓게 퍼지는 신스 패드 */
function pad(t: number, notes: number[], dur: number, vol: number, cut = 900) {
  const c = ctx!;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.4;
  lp.frequency.setValueAtTime(cut * 0.4, t); lp.frequency.linearRampToValueAtTime(cut, t + dur * 0.5); lp.frequency.linearRampToValueAtTime(cut * 0.5, t + dur);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(1.8, dur * 0.35));
  g.gain.setValueAtTime(vol, t + dur * 0.8); g.gain.linearRampToValueAtTime(0.0001, t + dur + 1.2);
  lp.connect(g); out(g);
  notes.forEach((m) => [-7, 7].forEach((d) => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mf(m); o.detune.value = d; o.connect(lp); o.start(t); o.stop(t + dur + 1.3); }));
}
/** 나일론 기타처럼 퉁기는 소리 */
function pluck(t: number, m: number, dur: number, vol: number) {
  const c = ctx!;
  const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = mf(m);
  const o2 = c.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = mf(m);
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(3400, t); lp.frequency.exponentialRampToValueAtTime(450, t + 0.3);
  const g2 = c.createGain(); g2.gain.value = 0.35;
  const g = c.createGain(); adsr(g, t, 0.003, vol, Math.max(0.35, dur));
  o.connect(lp); o2.connect(g2).connect(lp); lp.connect(g); out(g);
  [o, o2].forEach((x) => { x.start(t); x.stop(t + dur + 0.5); });
}
/** 맑은 종소리(비배음) */
function bell(t: number, m: number, vol: number, dec = 2.5) {
  const c = ctx!;
  [1, 2.76, 5.4].forEach((r, i) => {
    const o = c.createOscillator(); o.frequency.value = mf(m) * r;
    const g = c.createGain(); adsr(g, t, 0.003, vol / (i * 2 + 1), dec / (i + 1));
    o.connect(g); out(g); o.start(t); o.stop(t + dec + 0.1);
  });
}
/** 묵직한 저음 */
function sub(t: number, m: number, dur: number, vol: number) {
  const c = ctx!;
  const o = c.createOscillator(); o.frequency.value = mf(m);
  const o2 = c.createOscillator(); o2.type = 'triangle'; o2.frequency.value = mf(m) * 2; const g2 = c.createGain(); g2.gain.value = 0.25;
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.012); g.gain.setTargetAtTime(0.0001, t + dur, 0.07);
  o.connect(g); o2.connect(g2).connect(g); out(g);
  [o, o2].forEach((x) => { x.start(t); x.stop(t + dur + 0.5); });
}
/** 펑키한 슬랩 베이스 */
function sbass(t: number, m: number, dur: number, vol: number) {
  const c = ctx!;
  const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mf(m);
  const o2 = c.createOscillator(); o2.frequency.value = mf(m);
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 4; lp.frequency.setValueAtTime(2200, t); lp.frequency.exponentialRampToValueAtTime(280, t + 0.14);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.005); g.gain.setTargetAtTime(0.0001, t + dur, 0.04);
  o.connect(lp); o2.connect(lp); lp.connect(g); out(g);
  [o, o2].forEach((x) => { x.start(t); x.stop(t + dur + 0.3); });
}
/** 금관처럼 부풀어 오르는 소리 */
function horn(t: number, m: number, dur: number, vol: number) {
  const c = ctx!;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(500, t); lp.frequency.linearRampToValueAtTime(1500, t + Math.min(0.6, dur * 0.5));
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.3); g.gain.setValueAtTime(vol, t + dur * 0.8); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.4);
  lp.connect(g); out(g);
  [-5, 5].forEach((d) => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mf(m); o.detune.value = d; o.connect(lp); o.start(t); o.stop(t + dur + 0.5); });
}
/** 짧게 끊는 현악 */
function strg(t: number, m: number, dur: number, vol: number) {
  const c = ctx!;
  const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mf(m);
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
  const g = c.createGain(); adsr(g, t, 0.012, vol, dur);
  o.connect(lp).connect(g); out(g); o.start(t); o.stop(t + dur + 0.1);
}
function kick2(t: number, vol: number) {
  const c = ctx!; const o = c.createOscillator();
  o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  const g = c.createGain(); adsr(g, t, 0.002, vol, 0.32); o.connect(g); out(g); o.start(t); o.stop(t + 0.4);
}
function snare(t: number, vol: number) {
  nz(t, 0.16, 'bandpass', 1900, vol, 0.8);
  const c = ctx!; const o = c.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(210, t); o.frequency.exponentialRampToValueAtTime(160, t + 0.08);
  const g = c.createGain(); adsr(g, t, 0.001, vol * 0.6, 0.09); o.connect(g); out(g); o.start(t); o.stop(t + 0.15);
}
const hat = (t: number, vol: number, open = false) => nz(t, open ? 0.22 : 0.045, 'highpass', 7500, vol, 0.7);
function rim(t: number, vol: number) {
  const c = ctx!; const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = 1700;
  const g = c.createGain(); adsr(g, t, 0.001, vol, 0.03); o.connect(g); out(g); o.start(t); o.stop(t + 0.06);
  nz(t, 0.02, 'bandpass', 2600, vol * 0.6, 2);
}
const clap = (t: number, vol: number) => { nz(t, 0.02, 'bandpass', 1300, vol, 1.2); nz(t + 0.011, 0.02, 'bandpass', 1300, vol, 1.2); nz(t + 0.022, 0.14, 'bandpass', 1300, vol, 1.2); };
function taiko(t: number, vol: number) {
  const c = ctx!; const o = c.createOscillator();
  o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.5);
  const g = c.createGain(); adsr(g, t, 0.003, vol, 0.9); o.connect(g); out(g); o.start(t); o.stop(t + 1);
  nz(t, 0.18, 'lowpass', 500, vol * 0.5);
}
/** 레코드 잡음 */
const crackle = (t: number, sp: number, vol: number) => { if (Math.random() < 0.35) nz(t + Math.random() * sp, 0.004, 'highpass', 3000, vol * (0.3 + Math.random())); };
/** [음, 길이] 순서 목록 → 위치별 지도 */
function seq(a: [number, number][]) { const m = new Map<number, [number, number]>(); let p = 0; a.forEach(([n, l]) => { if (n >= 0) m.set(p, [n, l]); p += l; }); return m; }

interface Track { id: string; name: string; desc: string; bpm: number; swing: number; bars: number; play: (s: number, bar: number, t: number, sp: number, i: number) => void }

// 1) 로파이 재즈
const LC: [number, number[]][] = [[38, [53, 57, 60, 64]], [43, [53, 57, 59, 64]], [36, [52, 55, 59, 62]], [45, [55, 58, 61, 64]], [38, [53, 57, 60, 64]], [43, [53, 57, 59, 64]], [40, [55, 58, 62, 64]], [45, [55, 58, 61, 64]]];
const LM = seq([[-1, 16], [-1, 2], [69, 2], [71, 2], [72, 4], [74, 4], [-1, 2], [76, 6], [74, 2], [71, 4], [-1, 4], [73, 4], [70, 2], [69, 6], [-1, 4],
  [-1, 16], [-1, 4], [77, 2], [76, 2], [74, 2], [72, 2], [71, 4], [70, 6], [67, 2], [69, 4], [-1, 4], [73, 8], [-1, 8]]);
// 2) 앰비언트
const AC: [number, number[]][] = [[41, [53, 57, 60, 64, 67]], [45, [52, 55, 60, 64]], [38, [53, 57, 60, 64, 69]], [46, [50, 53, 57, 64]]];
const BELLS = [72, 74, 76, 77, 79, 81, 83, 84];
// 3) 퓨전 그루브
const FR = [45, 45, 41, 43, 45, 45, 41, 40];
const FV = [[57, 60, 64, 67], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 67], [57, 60, 64, 67], [57, 60, 64, 67], [53, 57, 60, 64], [56, 59, 62, 64]];
const FB: Record<number, number> = { 0: 0, 3: 0, 6: 12, 8: 0, 10: 10, 11: 12, 14: 7 };
const RIFF = new Map<number, [number, number, number]>([[0, [69, 2, 0]], [2, [72, 1, 0]], [3, [74, 3, 1]], [6, [76, 2, 0]], [8, [74, 2, 0]], [10, [72, 1, 0]], [11, [69, 3, 2]], [14, [67, 2, 0]],
  [16, [69, 3, 0]], [19, [72, 3, 0]], [22, [74, 2, 0]], [24, [79, 4, 1]], [28, [76, 4, 0]]]);
// 4) 시네마틱
const CR = [38, 46, 43, 45, 38, 46, 43, 45];
const CT = [[50, 53, 57], [50, 53, 58], [50, 55, 58], [49, 52, 57]];
const C3 = [3, 4, 3, 4];
const OST = [0, 0, 12, 0, 7, 0, -99, 0];
const CH = seq([[-1, 32], [62, 12], [65, 4], [64, 16], [-1, 16], [69, 12], [67, 4], [65, 8], [64, 8], [61, 16]]);
// 5) 보사노바
const BR = [36, 45, 38, 43, 40, 45, 38, 43];
const BV = [[52, 55, 59, 64], [55, 60, 64, 67], [53, 57, 60, 65], [53, 55, 59, 62], [55, 59, 62, 64], [55, 61, 64, 67], [53, 57, 60, 65], [53, 55, 59, 62]];
const BOSSA = [[0, 3, 6, 10, 12], [2, 4, 7, 10, 13]];
const BM = seq([[-1, 4], [76, 2], [79, 4], [76, 2], [74, 4], [72, 6], [69, 2], [71, 4], [72, 4], [74, 8], [77, 2], [76, 2], [74, 4], [71, 12], [-1, 4],
  [-1, 4], [79, 2], [83, 4], [81, 2], [79, 4], [76, 6], [73, 2], [76, 4], [79, 4], [77, 8], [76, 2], [74, 2], [72, 4], [74, 12], [-1, 4]]);
// 6) 시티팝
const PR = [41, 40, 38, 36, 46, 45, 43, 36];
const PV = [[65, 69, 72, 76], [64, 67, 71, 74], [62, 65, 69, 72], [60, 64, 67, 71], [58, 62, 65, 69], [57, 60, 64, 67], [55, 58, 62, 65], [58, 60, 65, 67]];
const PM = seq([[72, 2], [76, 2], [79, 4], [77, 2], [76, 2], [74, 4], [76, 6], [74, 2], [71, 4], [-1, 4], [-1, 2], [69, 2], [72, 2], [74, 2], [77, 4], [76, 4], [74, 4], [72, 8], [-1, 4],
  [74, 2], [77, 2], [81, 4], [79, 2], [77, 2], [74, 4], [76, 6], [72, 2], [76, 4], [-1, 4], [77, 4], [74, 4], [70, 4], [74, 4], [72, 12], [-1, 4]]);

const TRACKS: Track[] = [
  { id: 'lounge', name: '밤의 라운지', desc: '로파이 재즈 · 전자피아노와 느슨한 박자, 레코드 잡음', bpm: 76, swing: 0.22, bars: 8,
    play: (s, bar, t, sp, i) => {
      const [r, v] = LC[bar];
      if (s === 0) ep(t, v, sp * 6, 0.05); if (s === 10) ep(t, v.slice(1), sp * 4, 0.03);
      if (s === 0) sub(t, r, sp * 6, 0.17); if (s === 7) sub(t, r + 7, sp * 2, 0.1); if (s === 10) sub(t, r, sp * 4, 0.12);
      if (s === 0 || (s === 10 && bar % 2)) kick2(t, 0.3); if (s === 7) kick2(t, 0.15);
      if (s === 4 || s === 12) snare(t, 0.08);
      if (s % 2 === 0) hat(t, s % 4 === 2 ? 0.03 : 0.016);
      crackle(t, sp, 0.03);
      const m = LM.get(i); if (m) dae(t, mf(m[0]), m[1] * sp, 0.05);
    } },
  { id: 'mist', name: '새벽 안개', desc: '앰비언트 · 북도 선율도 없이 넓은 울림과 종소리만', bpm: 60, swing: 0, bars: 8,
    play: (s, bar, t, sp, i) => {
      const [r, v] = AC[Math.floor(bar / 2)];
      if (s === 0 && bar % 2 === 0) { pad(t, v, sp * 32, 0.014, 1200); sub(t, r, sp * 30, 0.06); }
      if (s % 4 === 0 && (i * 37 + bar * 11) % 17 < 5) bell(t, BELLS[(i * 7 + bar) % BELLS.length], 0.06, 3.5);
      if (s === 8 && bar % 4 === 3) bell(t, 88, 0.025, 5);
    } },
  { id: 'groove', name: '신명 그루브', desc: '퓨전 펑크 · 튀는 베이스와 드럼 위로 가야금 리프', bpm: 100, swing: 0.06, bars: 8,
    play: (s, bar, t, sp, i) => {
      const r = FR[bar]; const minor = bar % 4 < 2;
      if (s in FB) { const iv = FB[s] === 10 && !minor ? 7 : FB[s]; sbass(t, r + iv, sp * (iv === 12 ? 0.9 : 1.4), 0.13); }
      if (s === 0 || s === 10) kick2(t, 0.32); if (s === 6) kick2(t, 0.16);
      if (s === 4 || s === 12) snare(t, 0.12); if (s === 14) snare(t, 0.03);
      hat(t, s % 2 === 0 ? 0.024 : 0.012, s === 14 && bar % 2 === 1);
      if (s === 15 && bar % 4 === 3) chae(t, 0.04);
      if (s === 2 || s === 7) ep(t, FV[bar], sp, 0.032);
      if (bar >= 2) { const m = RIFF.get(i % 32); if (m) gaya(t, mf(m[0]), m[2], m[1] * sp, 0.09); }
    } },
  { id: 'duel', name: '승부의 밤', desc: '시네마틱 · 낮은 현악 반복과 큰북, 긴장이 쌓이는', bpm: 88, swing: 0, bars: 8,
    play: (s, bar, t, sp, i) => {
      const r = CR[bar]; const k = bar % 4;
      if (s % 2 === 0) { const o = OST[s / 2]; strg(t, r + 12 + (o === -99 ? C3[k] : o), sp * 1.6, 0.05); }
      if (s === 0) { pad(t, CT[k], sp * 16, 0.011, 700); sub(t, r, sp * 14, 0.12); }
      if (s === 0) taiko(t, 0.38); if (s === 6) taiko(t, 0.18); if (s === 8 && bar % 2) taiko(t, 0.24);
      if (bar % 4 === 3 && s >= 12) taiko(t, 0.1 + (s - 12) * 0.04);
      if (s % 4 === 2) hat(t, 0.012);
      const m = CH.get(i); if (m) horn(t, mf(m[0] + 12), m[1] * sp, 0.035);
    } },
  { id: 'bossa', name: '햇살 정원', desc: '보사노바 · 나일론 기타와 플루트, 가볍고 산뜻하게', bpm: 132, swing: 0, bars: 8,
    play: (s, bar, t, sp, i) => {
      const r = BR[bar]; const pat = BOSSA[bar % 2];
      if (s === 0) sub(t, r + 12, sp * 5, 0.14); if (s === 6) sub(t, r + 19, sp * 2, 0.1); if (s === 8) sub(t, r + 19, sp * 5, 0.12); if (s === 14) sub(t, r + 12, sp * 2, 0.09);
      if (pat.includes(s)) { BV[bar].forEach((m, j) => pluck(t + j * 0.008, m, sp * 2, 0.035)); rim(t, 0.035); }
      if (s % 2 === 0) shaker(t, s % 4 === 0 ? 0.02 : 0.012);
      if (s === 0) kick2(t, 0.12); if (s === 8) kick2(t, 0.08);
      const m = BM.get(i); if (m) dae(t, mf(m[0]), m[1] * sp, 0.045);
    } },
  { id: 'city', name: '도시의 밤길', desc: '시티팝 · 반짝이는 신스와 옥타브 베이스로 드라이브하듯', bpm: 114, swing: 0, bars: 8,
    play: (s, bar, t, sp, i) => {
      const r = PR[bar];
      if (s % 2 === 0) sbass(t, r + (s % 4 === 2 ? 12 : 0), sp * 1.2, 0.11);
      if (s === 0) ep(t, PV[bar], sp * 5, 0.04); if (s === 6 || s === 10) ep(t, PV[bar], sp * 1.5, 0.03);
      if (s % 4 === 0) kick2(t, 0.24); if (s === 4 || s === 12) clap(t, 0.07);
      if (s % 4 === 2) hat(t, 0.03, true); else if (s % 2 === 0) hat(t, 0.012);
      const m = PM.get(i); if (m) { pluck(t, m[0], m[1] * sp, 0.05); bell(t, m[0] + 12, 0.012, 0.8); }
    } },
];
export const BGM_TRACKS = TRACKS.map(({ id, name, desc }) => ({ id, name, desc }));

// 선택·좋아요·재생 방식 (이 기기에 저장)
let trackId = 'lounge';
let favs: string[] = [];
let mode: 'one' | 'favs' = 'one';
try {
  const tId = localStorage.getItem('mg-bgm-track'); if (tId && TRACKS.some((x) => x.id === tId)) trackId = tId;
  const f = JSON.parse(localStorage.getItem('mg-bgm-favs') || '[]'); if (Array.isArray(f)) favs = f.filter((x) => TRACKS.some((t) => t.id === x));
  if (localStorage.getItem('mg-bgm-mode') === 'favs') mode = 'favs';
} catch { /* 무시 */ }
const saveBgmPrefs = () => { try { localStorage.setItem('mg-bgm-track', trackId); localStorage.setItem('mg-bgm-favs', JSON.stringify(favs)); localStorage.setItem('mg-bgm-mode', mode); } catch { /* 무시 */ } };
export const bgmTrack = () => trackId;
export const bgmFavs = () => [...favs];
export const bgmMode = () => mode;
let onTrackChange: (id: string) => void = () => {};
export function onBgmTrack(f: (id: string) => void) { onTrackChange = f; }
/** 곡 고르기: 바로 그 곡으로 바꿔 튼다 */
export function setBgmTrack(id: string) {
  if (!TRACKS.some((x) => x.id === id)) return;
  trackId = id; saveBgmPrefs(); onTrackChange(id);
  if (bgmOn) { stopBgm(); setTimeout(() => startBgm(), 350); }
}
export function toggleFav(id: string) { favs = favs.includes(id) ? favs.filter((x) => x !== id) : [...favs, id]; saveBgmPrefs(); return favs.includes(id); }
export function setBgmMode(m: 'one' | 'favs') { mode = m; saveBgmPrefs(); }

function scheduler() {
  if (!ctx || !bgmGain || !bgmBus) return;
  const tr = TRACKS.find((x) => x.id === trackId) ?? TRACKS[0];
  const sp = 60 / tr.bpm / 4; const loopSteps = tr.bars * 16;
  while (nextT < ctx.currentTime + 0.4) {
    // 좋아요 목록 돌아가며 듣기: 4바퀴마다 다음 곡으로
    if (mode === 'favs' && favs.length > 1 && step > 0 && step % (loopSteps * 4) === 0) {
      const k = favs.indexOf(trackId);
      trackId = favs[(k + 1) % favs.length]; saveBgmPrefs(); onTrackChange(trackId);
      step = 0; return;
    }
    const i = step % loopSteps; const bar = Math.floor(i / 16); const s = i % 16;
    tr.play(s, bar, nextT + (s % 2 === 1 ? tr.swing * sp : 0), sp, i);
    nextT += sp; step++;
  }
}
export function startBgm() {
  if (!ctx || !master || !bgmOn || bgmTimer !== null) return;
  // 음량: 휴대폰 스피커에서도 들리게 압축 후 키운다 (효과음보다는 작게)
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -30; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.01; comp.release.value = 0.3;
  const makeup = ctx.createGain(); makeup.gain.value = 0.42; // 압축기가 자체 보정 이득을 주므로 조금만
  bgmGain = ctx.createGain(); bgmGain.gain.setValueAtTime(0.0001, ctx.currentTime);
  bgmGain.connect(comp).connect(makeup).connect(ctx.destination); // 효과음 끄기와 따로
  bgmGain.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 1.5);
  bgmBus = ctx.createGain();
  const dry = ctx.createGain(); dry.gain.value = 0.75;
  const wet = ctx.createGain(); wet.gain.value = 0.45;
  const rv = makeReverb(ctx);
  bgmBus.connect(dry).connect(bgmGain); bgmBus.connect(rv).connect(wet).connect(bgmGain);
  nextT = ctx.currentTime + 0.1; step = 0;
  bgmTimer = window.setInterval(scheduler, 100);
}
export function stopBgm() {
  if (bgmTimer !== null) { clearInterval(bgmTimer); bgmTimer = null; }
  if (bgmGain && ctx) { const g = bgmGain; g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.3); setTimeout(() => g.disconnect(), 1500); bgmGain = null; }
}
export function setBgm(v: boolean) {
  bgmOn = v;
  try { localStorage.setItem('mg-bgm', v ? '1' : '0'); } catch { /* 무시 */ }
  if (v) startBgm(); else stopBgm();
}
/** 심장 박동 (두근) */
export function heartbeat() {
  if (!ready()) return;
  const t = now();
  tone(t, 0.18, 'sine', 70, 45, 0.5);
  tone(t + 0.2, 0.22, 'sine', 62, 40, 0.38);
}
/** 뽑기 등급 상승 알림: 등급이 높을수록 높은 음, 여러 겹 */
export function chime(level: number) {
  if (!ready()) return;
  const t = now();
  const base = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760][Math.max(0, Math.min(9, level))];
  tone(t, 0.6, 'sine', base, base, 0.1);
  tone(t + 0.04, 0.5, 'triangle', base * 1.5, base * 1.5, 0.05);
  if (level >= 6) tone(t + 0.08, 0.7, 'sine', base * 2, base * 2.01, 0.05);
}
/** 패 돌리기: 짧은 "착" 연타 */
export function deal() {
  if (!ready()) return;
  noise(now(), 0.025, 'bandpass', 3200, 0.16, 1.4);
}
/** 매직 카드 획득: 반짝이는 상승음 */
export function magic() {
  if (!ready()) return;
  const t = now();
  [784, 988, 1175, 1568, 1976, 2349].forEach((fq, i) => tone(t + i * 0.06, 0.35, 'sine', fq, fq * 1.01, 0.09));
  noise(t + 0.3, 0.6, 'highpass', 6000, 0.06, 0.5);
}
/** 버튼 누름 */
export function click() {
  if (!ready()) return;
  tone(now(), 0.05, 'triangle', 880, 660, 0.06);
}
