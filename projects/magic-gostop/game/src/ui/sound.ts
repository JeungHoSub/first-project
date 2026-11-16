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
export function capture(count = 2) {
  if (!ready()) return;
  const t = now();
  for (let i = 0; i < Math.min(count, 4); i++) noise(t + i * 0.045, 0.035, 'bandpass', 2800 - i * 200, 0.28, 1.2);
  tone(t + 0.05, 0.18, 'triangle', 1320, 1760, 0.06);
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
/** 폭탄: "쾅" */
export function bomb() {
  if (!ready()) return;
  const t = now();
  noise(t, 0.9, 'lowpass', 1800, 0.9, 0.8, 60);
  tone(t, 0.8, 'sine', 120, 32, 0.9, 0.003);
  tone(t, 0.25, 'square', 80, 40, 0.18, 0.002);
  noise(t + 0.12, 0.4, 'bandpass', 900, 0.25, 0.6, 200);
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
