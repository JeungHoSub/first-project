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

/** 화투장을 바닥에 "탁" 치는 소리. power 0~1 */
export function slap(power = 0.7) {
  if (!ready()) return;
  const t = now();
  noise(t, 0.05, 'bandpass', 2400, 0.5 * power + 0.2, 0.9);
  noise(t, 0.09, 'lowpass', 900, 0.35 * power, 0.7);
  tone(t, 0.09, 'sine', 170, 55, 0.55 * power + 0.15);
}
/** 더미에서 뒤집는 소리 (가볍게 "착") */
export function flip() {
  if (!ready()) return;
  const t = now();
  noise(t, 0.035, 'highpass', 3000, 0.25, 0.7);
  noise(t + 0.03, 0.05, 'bandpass', 2000, 0.35, 1);
  tone(t + 0.03, 0.06, 'sine', 140, 70, 0.25);
}
/** 패를 먹어 가져오는 소리 ("착착" + 짧은 반짝임) */
/** 꾸미기 "효과음 팩" 단계 (-1 = 기본). 먹을 때 소리에 국악풍 음을 얹는다 */
let pack = -1;
export function setPack(g: number) { pack = g; }
const PENTA = [392, 440, 523, 587, 659, 784, 880]; // 평조풍 5음
export function capture(count = 2) {
  if (!ready()) return;
  const t = now();
  for (let i = 0; i < Math.min(count, 4); i++) noise(t + i * 0.045, 0.035, 'bandpass', 2800 - i * 200, 0.28, 1.2);
  tone(t + 0.05, 0.18, 'triangle', 1320, 1760, 0.06);
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
  lp.frequency.setValueAtTime(f * 7, t); lp.frequency.exponentialRampToValueAtTime(f * 1.6, t + 0.5);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(1.6, dur + 0.8));
  const g2 = c.createGain(); g2.gain.value = 0.22;
  for (const x of [o, o2]) x.frequency.setValueAtTime(f, t);
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
let gIdx = 0, gLeft = 0, dIdx = 0, dLeft = 0;
function scheduler() {
  if (!ctx || !bgmGain || !bgmBus) return;
  const spb = 60 / 72 / 3; // 중중모리 느낌의 느긋한 12칸
  while (nextT < ctx.currentTime + 0.5) {
    const k = step % 12; const bar = Math.floor(step / 12);
    if (k === 0) drum(nextT, 0.16);
    if (k === 6) drum(nextT, 0.09);
    if (k === 9 && bar % 2 === 1) drum(nextT, 0.06);
    if (k === 0 && bar % 4 === 0) drone(nextT, spb * 48);
    if (gLeft <= 0) {
      const [n, len, orn] = GAYA[gIdx % GAYA.length];
      if (n >= 0) gaya(nextT, SC[n], orn, len * spb, 0.11);
      gLeft = len; gIdx++;
    }
    gLeft--;
    if (dLeft <= 0) {
      const [n, len] = DAE[dIdx % DAE.length];
      if (n >= 0 && Math.floor(step / 96) % 2 === 1) dae(nextT, SC[n] * 2, len * spb, 0.035); // 두 번째 바퀴부터 대금이 얹힘
      dLeft = len; dIdx++;
    }
    dLeft--;
    nextT += spb; step++;
  }
}
export function startBgm() {
  if (!ctx || !master || !bgmOn || bgmTimer !== null) return;
  bgmGain = ctx.createGain(); bgmGain.gain.value = 0.0001; bgmGain.connect(ctx.destination); // 효과음 끄기와 따로
  bgmGain.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 3);
  bgmBus = ctx.createGain();
  const dry = ctx.createGain(); dry.gain.value = 0.75;
  const wet = ctx.createGain(); wet.gain.value = 0.45;
  const rv = makeReverb(ctx);
  bgmBus.connect(dry).connect(bgmGain); bgmBus.connect(rv).connect(wet).connect(bgmGain);
  nextT = ctx.currentTime + 0.1; step = 0; gIdx = 0; gLeft = 0; dIdx = 0; dLeft = 0;
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
