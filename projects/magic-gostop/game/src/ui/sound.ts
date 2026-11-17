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

// ---------- 배경음악: 국악 5음(궁상각치우) 뜯는 소리 + 낮은 지속음, 합성으로 무한 반복 ----------
let bgmOn = true;
try { bgmOn = localStorage.getItem('mg-bgm') !== '0'; } catch { /* 무시 */ }
let bgmTimer: number | null = null;
let bgmGain: GainNode | null = null;
let nextT = 0;
let step = 0;
// 평조(솔라도레미) 음계. 0=황(G3) …
const SCALE = [196.0, 220.0, 261.6, 293.7, 329.6, 392.0, 440.0, 523.3, 587.3, 659.3, 784.0];
// 굿거리 장단: 한 마디 12칸(3칸씩 4박). 덩=양편, 쿵=북편, 덕=채편, 기=채편 약, 더러러=굴림
const JANGGU = ['덩', '', '', '기', '덕', '', '쿵', '', '', '더', '러', '러'];
const JANGGU2 = ['덩', '', '', '기', '덕', '', '쿵', '', '', '쿵', '', ''];
// 대금 선율: [음, 길이(칸)] 8마디 = 96칸. -1 쉼
const DAEGEUM: [number, number][] = [
  [7, 6], [6, 3], [7, 3], [8, 9], [7, 3],
  [6, 6], [5, 3], [6, 3], [4, 12],
  [5, 3], [6, 3], [7, 6], [8, 6], [9, 6],
  [8, 6], [7, 3], [6, 3], [7, 12],
  [9, 6], [8, 3], [9, 3], [10, 9], [9, 3],
  [8, 6], [7, 3], [8, 3], [6, 12],
  [5, 3], [6, 3], [7, 3], [6, 3], [5, 6], [4, 6],
  [5, 12], [-1, 12],
];
// 가야금 반주: 마디마다 근음 [음]
const GAYA_ROOT = [2, 2, 4, 2, 5, 4, 2, 0];

export function isBgmOn() { return bgmOn; }
/** 가야금: 뜯는 소리 + 농현(살짝 흔들며 끌어올림) */
function pluck(t: number, f: number, vol: number) {
  const c = ctx!;
  const o = c.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(f, t);
  const o2 = c.createOscillator(); o2.type = 'sawtooth'; o2.frequency.setValueAtTime(f, t);
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(f * 6, t); lp.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.4);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
  const g2 = c.createGain(); g2.gain.value = 0.35;
  o.frequency.setValueAtTime(f, t + 0.25); o.frequency.linearRampToValueAtTime(f * 1.018, t + 0.45); o.frequency.linearRampToValueAtTime(f, t + 0.65);
  o.connect(g); o2.connect(g2).connect(lp).connect(g); g.connect(bgmGain!);
  o.start(t); o2.start(t); o.stop(t + 1.7); o2.stop(t + 1.7);
}
/** 대금: 숨소리 섞인 긴 소리 + 점점 깊어지는 떨림 */
function daegeum(t: number, f: number, dur: number, vol: number) {
  const c = ctx!;
  const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f, t);
  const o2 = c.createOscillator(); o2.type = 'triangle'; o2.frequency.setValueAtTime(f * 2, t);
  const lfo = c.createOscillator(); lfo.frequency.value = 5.2;
  const lg = c.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.012, t + dur * 0.8);
  lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
  // 꺾는 소리: 앞머리를 아래에서 밀어 올림
  o.frequency.setValueAtTime(f * 0.94, t); o.frequency.linearRampToValueAtTime(f, t + 0.12);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.18);
  g.gain.setValueAtTime(vol, t + dur * 0.75); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.25);
  const g2 = c.createGain(); g2.gain.value = 0.12;
  o.connect(g); o2.connect(g2).connect(g); g.connect(bgmGain!);
  // 숨소리
  const n = c.createBufferSource(); n.buffer = noiseBuffer(dur + 0.3);
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 2.5; bp.Q.value = 2;
  const ng = c.createGain(); ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(vol * 0.5, t + 0.05); ng.gain.exponentialRampToValueAtTime(vol * 0.12, t + 0.3); ng.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.2);
  n.connect(bp).connect(ng).connect(bgmGain!);
  [o, o2, lfo].forEach((x) => { x.start(t); x.stop(t + dur + 0.35); }); n.start(t); n.stop(t + dur + 0.3);
}
/** 장구 */
function janggu(t: number, hit: string) {
  const c = ctx!;
  const low = (vol: number) => { // 북편 (궁편)
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(62, t + 0.18);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g).connect(bgmGain!); o.start(t); o.stop(t + 0.4);
  };
  const high = (vol: number, at = t) => { // 채편: 대나무 채가 가죽을 때리는 소리
    const n = c.createBufferSource(); n.buffer = noiseBuffer(0.12);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 3;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.1);
    n.connect(bp).connect(g).connect(bgmGain!); n.start(at); n.stop(at + 0.12);
    const o = c.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(420, at); o.frequency.exponentialRampToValueAtTime(300, at + 0.06);
    const og = c.createGain(); og.gain.setValueAtTime(0.0001, at); og.gain.exponentialRampToValueAtTime(vol * 0.4, at + 0.003); og.gain.exponentialRampToValueAtTime(0.0001, at + 0.08);
    o.connect(og).connect(bgmGain!); o.start(at); o.stop(at + 0.1);
  };
  if (hit === '덩') { low(0.32); high(0.22); }
  else if (hit === '쿵') low(0.26);
  else if (hit === '덕') high(0.2);
  else if (hit === '기') high(0.08);
  else if (hit === '더') high(0.12);
  else if (hit === '러') high(0.07);
}
let melIdx = 0; let melLeft = 0;
function scheduler() {
  if (!ctx || !bgmGain) return;
  const spb = 60 / 66 / 3; // 한 칸 = 점4분의 1/3 (굿거리 느린 장단)
  while (nextT < ctx.currentTime + 0.5) {
    const bar = Math.floor(step / 12);
    const k = step % 12;
    // 장구 (4마디마다 굴림 넣기)
    const jp = bar % 4 === 3 ? JANGGU : JANGGU2;
    if (jp[k]) janggu(nextT, jp[k]);
    // 대금 선율
    if (melLeft <= 0) {
      const [n, len] = DAEGEUM[melIdx % DAEGEUM.length];
      if (n >= 0) daegeum(nextT, SCALE[n], len * spb, 0.07);
      melLeft = len; melIdx++;
    }
    melLeft--;
    // 가야금: 박마다 근음·5도·옥타브 뜯기
    const root = GAYA_ROOT[bar % GAYA_ROOT.length];
    if (k % 3 === 0) {
      const pat = [root, root + 2, root + 4, root + 2][k / 3];
      pluck(nextT, SCALE[Math.min(SCALE.length - 1, pat)] / 2, k === 0 ? 0.13 : 0.08);
    }
    nextT += spb; step++;
  }
}
export function startBgm() {
  if (!ctx || !master || !bgmOn || bgmTimer !== null) return;
  bgmGain = ctx.createGain(); bgmGain.gain.value = 0.0001; bgmGain.connect(ctx.destination); // 효과음 끄기와 따로
  bgmGain.gain.exponentialRampToValueAtTime(0.42, ctx.currentTime + 2);
  nextT = ctx.currentTime + 0.1; step = 0; melIdx = 0; melLeft = 0;
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
