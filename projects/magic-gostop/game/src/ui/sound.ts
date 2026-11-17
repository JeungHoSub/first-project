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

/** 화투장 한 장이 담요에 "착" 붙는 순간: 아주 짧은 플라스틱 딸깍 + 몸통 울림 */
function clack(t: number, vol: number, bright = 1) {
  noise(t, 0.008, 'highpass', 2200 * bright, vol, 0.7);           // 첫 접촉 "ㅊ"
  noise(t, 0.03, 'bandpass', 1150 * bright, vol * 0.85, 3.2);     // 딱딱한 패의 "착"
  tone(t, 0.018, 'triangle', 1450 * bright, 950, vol * 0.14, 0.001); // 패 가장자리 딸깍
  tone(t, 0.045, 'sine', 150, 95, vol * 0.45, 0.002);             // 담요가 받는 낮은 몸통
}
/** 화투장을 바닥에 내리치는 소리. power 0~1 — "착!" 하고 바로 달라붙음 */
export function slap(power = 0.7) {
  if (!ready()) return;
  const t = now();
  clack(t, 0.45 + 0.45 * power);
  clack(t + 0.011, 0.22 + 0.12 * power, 0.85); // 패가 바닥에 납작하게 붙는 두 번째 미세 접촉
  noise(t + 0.004, 0.06, 'lowpass', 500, 0.18 * power, 0.7);   // 눌린 공기
}
/** 더미에서 뒤집는 소리 (가볍게 "착") */
export function flip() {
  if (!ready()) return;
  const t = now();
  noise(t, 0.03, 'highpass', 3500, 0.12, 0.7);   // 패가 미끄러지는 소리
  clack(t + 0.035, 0.32, 1.1);
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
  const n = Math.max(2, Math.min(count, 4));
  for (let i = 0; i < n; i++) clack(t + i * 0.07, i === n - 1 ? 0.62 : 0.42, 1 + i * 0.04);
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
type Mel = [number, number, number][]; // [음, 길이(칸), 꾸밈]
interface Track {
  id: string; name: string; desc: string; bpm: number;
  gaya?: Mel; arp?: number[]; gayaVol: number;
  dae?: [number, number][]; daeFrom: number; // 몇 번째 바퀴부터 대금이 얹히는지 (-1 = 없음)
  drone: boolean;
  perc: (k: number, bar: number, step: number, t: number, spb: number) => void;
}
const T1_MEL: Mel = GAYA;
const TRACKS: Track[] = [
  { id: 'moon', name: '달빛 산조', desc: '계면조 가야금에 은은한 박자 — 차분하지만 살짝 들뜬', bpm: 84, gaya: T1_MEL, gayaVol: 0.11, dae: DAE, daeFrom: 1, drone: true,
    perc: (k, bar, step, t, spb) => {
      if (k === 0) drum(t, 0.14); if (k === 6) drum(t, 0.08); if (k === 9 && bar % 2 === 1) drum(t, 0.06);
      if (step >= 48) {
        if (k === 0 || k === 7) kick(t, 0.22);
        if (k % 3 === 2) shaker(t, k === 5 || k === 11 ? 0.05 : 0.028);
        if (k === 0 || k === 6) bass(t, BASS_ROOT[bar % 8], spb * 5, 0.09);
        if (k === 10) bass(t, BASS_ROOT[bar % 8] * 1.5, spb * 2, 0.05);
      }
    } },
  { id: 'pavilion', name: '고요한 정자', desc: '가야금과 대금만, 바람 소리처럼 느긋하게', bpm: 60, gayaVol: 0.12, drone: true, daeFrom: 0,
    gaya: [[4, 6, 1], [5, 6, 0], [6, 12, 2], [5, 6, 0], [4, 6, 1], [3, 12, 0], [2, 6, 0], [3, 6, 0], [4, 12, 1], [4, 24, 1]],
    dae: [[-1, 12], [7, 12], [6, 24], [-1, 12], [5, 12], [4, 24]],
    perc: (k, bar, _s, t) => { if (k === 0 && bar % 2 === 0) drum(t, 0.07); } },
  { id: 'market', name: '장터 한마당', desc: '자진모리 장단으로 흥겹게, 귀는 편안하게', bpm: 104, gayaVol: 0.1, drone: false, daeFrom: 2,
    gaya: [[4, 2, 0], [5, 1, 0], [6, 3, 0], [7, 3, 0], [6, 3, 2], [5, 2, 0], [4, 1, 0], [5, 3, 0], [6, 6, 1], [7, 2, 0], [8, 1, 0], [7, 3, 0], [6, 3, 0], [5, 3, 2], [4, 3, 0],
      [5, 3, 0], [3, 3, 0], [4, 6, 1], [6, 2, 0], [7, 1, 0], [8, 3, 0], [7, 3, 0], [6, 3, 0], [5, 2, 0], [4, 1, 0], [5, 3, 0], [4, 9, 1], [-1, 3, 0], [5, 6, 0], [4, 9, 1]],
    dae: [[-1, 48], [8, 12], [7, 12], [6, 24]],
    perc: (k, bar, _s, t, spb) => {
      if (k === 0) { drum(t, 0.16); chae(t, 0.06); } if (k === 2 || k === 3 || k === 8) chae(t, 0.05);
      if (k === 6 || k === 9) drum(t, 0.11); if (k === 10 || k === 11) chae(t, 0.03);
      if (k % 3 === 2) shaker(t, 0.025);
      if (k === 0 || k === 6) bass(t, BASS_ROOT[bar % 8], spb * 4, 0.08);
    } },
  { id: 'night', name: '밤 마실', desc: '로파이 박자 위로 가야금이 굴러가고 대금이 노래하는', bpm: 76, gayaVol: 0.07, drone: false, daeFrom: 0,
    arp: [0, -1, 2, 4, -1, 2, 1, -1, 3, 4, -1, 2],
    dae: [[7, 12], [6, 6], [5, 6], [4, 12], [-1, 12], [5, 12], [6, 6], [7, 6], [6, 12], [-1, 12]],
    perc: (k, bar, _s, t, spb) => {
      if (k === 0 || k === 7) kick(t, 0.24); if (k === 3 || k === 9) chae(t, 0.07);
      if (k % 2 === 1) shaker(t, 0.022);
      if (k === 0) bass(t, BASS_ROOT[bar % 8], spb * 5, 0.1); if (k === 6) bass(t, BASS_ROOT[bar % 8] * 1.5, spb * 3, 0.06);
    } },
  { id: 'spring', name: '봄 나들이', desc: '굿거리 장단에 산뜻한 가야금 — 가볍게 걷는 걸음', bpm: 92, gaya: T1_MEL, gayaVol: 0.1, dae: DAE, daeFrom: 0, drone: false,
    perc: (k, bar, _s, t, spb) => {
      if (k === 0) drum(t, 0.14); if (k === 3 || k === 4) chae(t, 0.05); if (k === 6) drum(t, 0.1); if (k === 9) chae(t, 0.05); if (k === 10 || k === 11) chae(t, 0.03);
      if (k === 0 || k === 6) bass(t, BASS_ROOT[bar % 8], spb * 4, 0.07);
    } },
];
export const BGM_TRACKS = TRACKS.map(({ id, name, desc }) => ({ id, name, desc }));

// 선택·좋아요·재생 방식 (이 기기에 저장)
let trackId = 'moon';
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

let gIdx = 0, gLeft = 0, dIdx = 0, dLeft = 0;
const LOOP = 96; // 한 바퀴 = 8마디
function scheduler() {
  if (!ctx || !bgmGain || !bgmBus) return;
  const tr = TRACKS.find((x) => x.id === trackId) ?? TRACKS[0];
  const spb = 60 / tr.bpm / 3;
  while (nextT < ctx.currentTime + 0.5) {
    const k = step % 12; const bar = Math.floor(step / 12); const loop = Math.floor(step / LOOP);
    // 좋아요 목록 돌아가며 듣기: 3바퀴마다 다음 곡으로
    if (mode === 'favs' && favs.length > 1 && step > 0 && step % (LOOP * 3) === 0) {
      const i = favs.indexOf(trackId);
      trackId = favs[(i + 1) % favs.length]; saveBgmPrefs(); onTrackChange(trackId);
      step = 0; gIdx = gLeft = dIdx = dLeft = 0;
      return;
    }
    tr.perc(k, bar, step, nextT, spb);
    if (tr.drone && k === 0 && bar % 4 === 0) drone(nextT, spb * 48);
    if (tr.gaya) {
      if (gLeft <= 0) {
        const [n, len, orn] = tr.gaya[gIdx % tr.gaya.length];
        if (n >= 0) gaya(nextT, SC[n], orn, len * spb, tr.gayaVol);
        gLeft = len; gIdx++;
      }
      gLeft--;
    } else if (tr.arp) {
      const root = [2, 4, 2, 5, 4, 2, 4, 2][bar % 8];
      const off = tr.arp[k];
      if (off >= 0) gaya(nextT, SC[Math.min(SC.length - 1, root + off)], k === 0 ? 1 : 0, spb * 2, k === 0 ? tr.gayaVol * 1.3 : tr.gayaVol);
    }
    if (tr.dae && tr.daeFrom >= 0) {
      if (dLeft <= 0) {
        const [n, len] = tr.dae[dIdx % tr.dae.length];
        if (n >= 0 && loop >= tr.daeFrom) dae(nextT, SC[n] * 2, len * spb, 0.035);
        dLeft = len; dIdx++;
      }
      dLeft--;
    }
    nextT += spb; step++;
  }
}
export function startBgm() {
  if (!ctx || !master || !bgmOn || bgmTimer !== null) return;
  bgmGain = ctx.createGain(); bgmGain.gain.value = 0.0001; bgmGain.connect(ctx.destination); // 효과음 끄기와 따로
  bgmGain.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 2);
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
