// 효과음: 외부 음원 없이 Web Audio로 합성한다 (저작권 걱정 없음, 파일 크기 0).
// 브라우저 정책상 사용자가 화면을 한 번 누른 뒤부터 소리가 난다.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
try { muted = localStorage.getItem('mg-muted') === '1'; } catch { /* 저장소 없음 */ }
/** 크기 (0~1, 이 기기에 저장): 효과음 · 배경음악 */
let sfxVol = 1, musicVol = 1;
try { const a = localStorage.getItem('mg-sfx-vol'), b = localStorage.getItem('mg-bgm-vol'); if (a != null) sfxVol = Math.max(0, Math.min(1, +a)); if (b != null) musicVol = Math.max(0, Math.min(1, +b)); } catch { /* 무시 */ }
const masterLevel = () => (muted ? 0 : 0.9 * sfxVol);
export const sfxVolume = () => sfxVol;
export const bgmVolume = () => musicVol;
export function setSfxVolume(v: number) {
  sfxVol = Math.max(0, Math.min(1, v));
  try { localStorage.setItem('mg-sfx-vol', String(sfxVol)); } catch { /* 무시 */ }
  if (master) master.gain.value = masterLevel();
}
export function setBgmVolume(v: number) {
  musicVol = Math.max(0, Math.min(1, v));
  try { localStorage.setItem('mg-bgm-vol', String(musicVol)); } catch { /* 무시 */ }
  if (audio && fadeT === null) audio.volume = BGM_VOL * musicVol;
}

export function isMuted() { return muted; }
export function setMuted(v: boolean) {
  muted = v;
  try { localStorage.setItem('mg-muted', v ? '1' : '0'); } catch { /* 무시 */ }
  if (master) master.gain.value = masterLevel();
}

/** 첫 터치 때 호출해 오디오를 깨운다 */
export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = masterLevel();
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
/** 찰진 "착": 손바닥으로 치듯 넓게 퍼지는 순간음(1~4kHz) + 패끼리 붙는 짧은 "짝" + 담요 "퍽" 받침. 끝에 살짝 눌러(포화) 단단하게 */
function makeHits() {
  const c = ctx!; const sr = c.sampleRate;
  const out: AudioBuffer[] = [];
  for (let v = 0; v < 4; v++) {
    const len = Math.floor(sr * 0.12);
    const buf = c.createBuffer(1, len, sr); const d = buf.getChannelData(0);
    let seed = 991 + v * 1777; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 * 2 - 1; };
    // 2차 대역 통과 필터 (중심 fc, Q)
    const bp = (fc: number, q: number) => { const w = 2 * Math.PI * fc / sr, al = Math.sin(w) / (2 * q), a0 = 1 + al; const b0 = al / a0, b2 = -al / a0, a1 = -2 * Math.cos(w) / a0, a2 = (1 - al) / a0; let x1 = 0, x2 = 0, y1 = 0, y2 = 0; return (x: number) => { const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; }; };
    const crack = bp(2300 + v * 120, 0.7), smack = bp(1100 + v * 60, 1.4), low = bp(260, 0.8);
    let peak = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr; const n = rnd();
      const atk = Math.min(1, t / 0.00025);
      let x = crack(n) * (Math.exp(-t / 0.0045) + 0.12 * Math.exp(-t / 0.03)) * 2.2;  // "ㅊ" 순간음
      x += smack(n) * Math.exp(-t / 0.011) * 1.6;                                      // "착" 몸통
      x += low(n) * Math.exp(-t / 0.02) * 1.4;                                          // 담요 "퍽"
      x += 0.55 * Math.sin(2 * Math.PI * (95 - 30 * Math.min(1, t / 0.05)) * t) * Math.exp(-t / 0.022); // 낮은 받침
      // 0.6ms 뒤 패가 한 번 더 붙는 미세한 "짝"
      x *= atk; d[i] = x;
    }
    for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(d[i]));
    for (let i = 0; i < len; i++) d[i] = Math.tanh((d[i] / peak) * 1.8) / Math.tanh(1.8);
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
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 9000; f.Q.value = 0.5;
  const g = c.createGain(); g.gain.value = vol;
  src.connect(f).connect(g).connect(master!);
  src.start(t);
}
/** 화투장을 바닥에 내리치는 소리. power 0~1 — 한 번에 "착!" */
export function slap(power = 0.7) {
  if (!ready()) return;
  clack(now(), 0.75 + 0.35 * power, 0.97);
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
/** 먹을 게 없어 빈 담요에 내려놓는 "툭": 패끼리 부딪히는 소리 없이 둔하고 낮게 */
export function place(power = 0.7) {
  if (!ready()) return;
  const t = now();
  noise(t, 0.05, 'lowpass', 900, 0.22 + 0.15 * power, 0.7, 300);
  tone(t, 0.07, 'sine', 140, 85, 0.25 + 0.15 * power, 0.002);
  noise(t + 0.004, 0.012, 'bandpass', 1400, 0.05, 1);
}
/** 먹은 패를 내 쪽으로 쓸어 오는 "슥슥": 작게 */
export function swish(n = 2) {
  if (!ready()) return;
  const t = now();
  for (let i = 0; i < Math.min(2, n); i++) noise(t + i * 0.11, 0.12, 'bandpass', 2600 - i * 300, 0.045, 0.9, 1200);
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
  swish(count); // 가져올 때는 "슥슥"만 (치는 소리는 낼 때 이미 남)
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
  // 처량하게: 낮은 "쿵" → 반음씩 축 처지며 내려가는 "뿌우~ 뿌우~ 뿌우~ 뿌우우우~" (느리게, 끝음은 길게 떨며 꺼짐) → 한숨 "하아…"
  if (!ready()) return;
  const t = now(); const c = ctx!;
  tone(t, 0.6, 'sine', 80, 40, 0.32, 0.004);
  noise(t, 0.14, 'lowpass', 350, 0.16, 0.7, 100);
  // [시작, 길이, 시작음, 끝음(처짐)]
  const notes: [number, number, number, number][] = [
    [0.22, 0.34, 220, 212], [0.6, 0.34, 207, 199], [0.98, 0.34, 196, 187], [1.36, 1.5, 185, 130],
  ];
  for (const [d, dur, f0, f1] of notes) {
    const st = t + d; const last = dur > 1;
    const out = c.createGain();
    out.gain.setValueAtTime(0.0001, st);
    out.gain.linearRampToValueAtTime(0.16, st + 0.07);
    if (last) { out.gain.setValueAtTime(0.15, st + 0.5); out.gain.exponentialRampToValueAtTime(0.0001, st + dur); }
    else { out.gain.setValueAtTime(0.13, st + dur * 0.75); out.gain.exponentialRampToValueAtTime(0.0001, st + dur + 0.05); }
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 3;
    // 약음기 낀 금관처럼 "와-우": 필터가 열렸다 닫힘
    f.frequency.setValueAtTime(350, st); f.frequency.linearRampToValueAtTime(1100, st + 0.1); f.frequency.linearRampToValueAtTime(420, st + dur);
    f.connect(out).connect(master!);
    // 해금처럼 살짝 어긋난 두 줄 + 느린 떨림(마지막 음은 점점 깊게)
    for (const [type, det, vol] of [['sawtooth', 0, 0.7], ['triangle', -7, 0.6]] as const) {
      const o = c.createOscillator(); o.type = type; o.detune.value = det;
      o.frequency.setValueAtTime(f0, st); o.frequency.linearRampToValueAtTime(f0, st + dur * 0.4); o.frequency.exponentialRampToValueAtTime(f1, st + dur);
      const lfo = c.createOscillator(); lfo.frequency.value = last ? 4.5 : 5.5;
      const lg = c.createGain(); lg.gain.setValueAtTime(last ? 1 : 2, st); if (last) lg.gain.linearRampToValueAtTime(9, st + dur);
      lfo.connect(lg).connect(o.frequency);
      const g = c.createGain(); g.gain.value = vol; o.connect(g).connect(f);
      o.start(st); lfo.start(st); o.stop(st + dur + 0.1); lfo.stop(st + dur + 0.1);
    }
  }
  // 한숨 "하아…" (숨소리처럼 걸러진 바람 소리가 내려가며 사라짐)
  const sg = t + 2.75;
  noise(sg, 0.9, 'bandpass', 900, 0.07, 1.2, 380);
}
/** 쪽·따닥·싹쓸이처럼 기분 좋은 한 방 */
export function bonus() {
  if (!ready()) return;
  const t = now();
  slap(1);
  [784, 988, 1175, 1568].forEach((fq, i) => tone(t + 0.06 + i * 0.07, 0.22, 'triangle', fq, fq, 0.1));
}
/** 판 밖(메뉴·상점·미션·뽑기) 보상음: 화투 치는 소리 없이 맑은 방울 + 엽전 소리 */
export function reward() {
  if (!ready()) return;
  const t = now();
  [784, 988, 1175, 1568].forEach((fq, i) => tone(t + i * 0.07, 0.24, 'triangle', fq, fq, 0.1));
  coin(1);
}
/** 흔들기: 패를 "착착착" 흔드는 소리 */
export function shake() {
  if (!ready()) return;
  // 손에 쥔 화투를 흔드는 "차라락 차라락": 패끼리 빠르게 스치고 부딪는 소리 두 번
  const t = now();
  for (let r = 0; r < 2; r++) {
    const t0 = t + r * 0.32;
    for (let i = 0; i < 10; i++) {
      const env = Math.sin((i / 9) * Math.PI);
      clack(t0 + i * 0.021 + Math.random() * 0.004, 0.08 + 0.2 * env, 1.35 + Math.random() * 0.2);
    }
    noise(t0, 0.22, 'bandpass', 3800, 0.05, 0.8, 2400);
  }
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
/** 판 위 폭탄: "팡~" — 귀를 때리는 날카로운 폭발 → 가슴 치는 저음 → 불꽃 파편 지글지글 → 잔향 */
export function cannon() {
  if (!ready()) return;
  const t = now(); const c = ctx!;
  // ① "팡": 전 대역 잡음을 세게 찌그러뜨린 짧은 폭발 (찰나에 최고 크기)
  const len = 0.5; const buf = c.createBuffer(1, Math.floor(c.sampleRate * len), c.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) { const x = i / c.sampleRate; d[i] = (Math.random() * 2 - 1) * Math.exp(-x * 9) ; }
  const src = c.createBufferSource(); src.buffer = buf;
  const ws = c.createWaveShaper(); const k = 40; const curve = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) { const x = (i / 1023) * 2 - 1; curve[i] = Math.tanh(k * x) / Math.tanh(k); } ws.curve = curve;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(9000, t); lp.frequency.exponentialRampToValueAtTime(500, t + 0.45);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.55, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(ws).connect(lp).connect(g).connect(master!); src.start(t);
  // ② 가슴 치는 "쿵": 짧게 빠르게 떨어지는 저음
  tone(t, 0.7, 'sine', 160, 38, 1.0, 0.001);
  tone(t, 0.18, 'triangle', 220, 60, 0.4, 0.001);
  // ③ "~": 불꽃 파편이 사방으로 튀며 지글지글
  for (let i = 0; i < 22; i++) {
    const at = t + 0.08 + Math.random() * 0.9; const v = 0.16 * (1 - (at - t) / 1.1);
    noise(at, 0.015 + Math.random() * 0.02, 'bandpass', 2500 + Math.random() * 4000, Math.max(0.02, v), 1.5);
  }
  noise(t + 0.05, 1.4, 'lowpass', 1400, 0.22, 0.7, 120); // 퍼지는 폭풍 잔향
}
/** 총통: 같은 월 4장 — 패 4장 "착착착착" → 북 연타 → 징 → 태평소풍 팡파르 → 반짝이 방울 비 */
export function chongtong() {
  if (!ready()) return;
  const t = now();
  // ① 4장이 차례로 "착착착착" 내려꽂힘
  [0, 0.11, 0.22, 0.36].forEach((d, i) => setTimeout(() => slap(0.75 + i * 0.08), d * 1000));
  // ② 북 연타 "두두두둥!"
  const drum = (at: number, v: number) => { tone(at, 0.5, 'sine', 125, 50, v, 0.003); noise(at, 0.07, 'lowpass', 700, v * 0.35, 0.8, 200); };
  [0.5, 0.58, 0.66, 0.74, 0.86].forEach((d, i) => drum(t + d, i === 4 ? 0.75 : 0.35 + i * 0.06));
  // ③ 징 "지이잉~" (길게 퍼지는 금속 울림)
  const g = t + 0.86;
  tone(g, 2.8, 'sine', 178, 174, 0.15, 0.02); tone(g, 2.0, 'sine', 356, 350, 0.06, 0.02); tone(g, 1.4, 'sine', 534, 528, 0.03, 0.02);
  // ④ 태평소풍 팡파르: 5음계로 치솟았다가 높은 음을 길게 떨며
  const c = ctx!;
  const mel: [number, number, number][] = [[0.9, 0.12, 587], [1.02, 0.12, 659], [1.14, 0.12, 784], [1.26, 0.12, 880], [1.38, 0.9, 1175]];
  for (const [d, dur, f] of mel) {
    const st = t + d;
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 0.97, st); o.frequency.linearRampToValueAtTime(f, st + 0.03);
    const lfo = c.createOscillator(); lfo.frequency.value = 6.5; const lg = c.createGain(); lg.gain.value = dur > 0.5 ? f * 0.012 : 0; lfo.connect(lg).connect(o.frequency);
    const fl = c.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = f * 2; fl.Q.value = 0.9;
    const gn = c.createGain(); gn.gain.setValueAtTime(0.0001, st); gn.gain.linearRampToValueAtTime(0.11, st + 0.02); gn.gain.setValueAtTime(0.1, st + dur * 0.8); gn.gain.exponentialRampToValueAtTime(0.0001, st + dur + 0.06);
    o.connect(fl).connect(gn).connect(master!); o.start(st); lfo.start(st); o.stop(st + dur + 0.1); lfo.stop(st + dur + 0.1);
  }
  // ⑤ 반짝이 방울·엽전 비
  [1.4, 1.5, 1.6, 1.7, 1.85, 2.0].forEach((d, i) => { const f = [2093, 2637, 3136, 2349, 3520, 2794][i]; tone(t + d, 0.9, 'sine', f, f, 0.05, 0.002); tone(t + d, 0.4, 'sine', f * 2.76, f * 2.76, 0.012, 0.002); });
  setTimeout(() => coinRain(900), 1400);
  noise(t + 1.38, 1.0, 'highpass', 7000, 0.05, 0.5);
}
/** 쪽: 내가 낸 패를 뒤집은 패로 바로 먹음 — "착!" 한 번 세게 + 입맞추듯 "쪽" + 반짝 */
export function jjok() {
  if (!ready()) return;
  const t = now();
  slap(1);
  tone(t + 0.07, 0.09, 'sine', 2200, 520, 0.32, 0.001);   // 쪽
  noise(t + 0.07, 0.025, 'highpass', 3000, 0.12, 0.8);
  [1568, 2093].forEach((f, i) => tone(t + 0.16 + i * 0.07, 0.3, 'triangle', f, f, 0.08));
}
/** 따닥: 같은 월 두 쌍을 한 번에 — "따-닥!" 두 번 아주 세게 + 북 + 방울 */
export function ttadak() {
  if (!ready()) return;
  const t = now();
  slap(1); setTimeout(() => slap(1), 95);
  noise(t, 0.02, 'highpass', 2500, 0.22, 0.8); noise(t + 0.095, 0.02, 'highpass', 2800, 0.26, 0.8);
  tone(t + 0.1, 0.45, 'sine', 130, 55, 0.5, 0.002); // 둥
  [1175, 1568, 2093].forEach((f, i) => tone(t + 0.2 + i * 0.06, 0.32, 'triangle', f, f, 0.08));
}
/** 싹쓸이: 빗자루로 판을 "쓰으윽~" 쓸고 → 패가 우르르 "착착착착착" → 북·징 → 상승 팡파르 → 엽전 비 */
export function sweep() {
  if (!ready()) return;
  const t = now();
  noise(t, 0.55, 'bandpass', 900, 0.32, 0.8, 4200);           // 쓰으윽 (낮→높)
  noise(t + 0.08, 0.5, 'highpass', 3000, 0.12, 0.6, 7000);
  for (let i = 0; i < 7; i++) setTimeout(() => slap(0.55 + i * 0.06), 380 + i * 65); // 우르르 착착착
  const d0 = t + 0.88;
  tone(d0, 0.55, 'sine', 125, 48, 0.8, 0.002); noise(d0, 0.08, 'lowpass', 700, 0.3, 0.8, 200);   // 둥!
  tone(d0, 2.4, 'sine', 178, 174, 0.13, 0.02); tone(d0, 1.7, 'sine', 356, 350, 0.05, 0.02);       // 징
  [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(d0 + 0.05 + i * 0.075, i === 5 ? 0.8 : 0.24, 'triangle', f, f, 0.11));
  [0.5, 0.6, 0.7, 0.85].forEach((d, i) => { const f = [2093, 2637, 3136, 3520][i]; tone(d0 + d, 0.9, 'sine', f, f, 0.05, 0.002); });
  setTimeout(() => coinRain(1000), 1300);
}
/** 분해: 카드가 "드르르륵" 떨며 기운이 차오르고(상승음) → "쩌억-쨍!" 갈라져 부서짐 → 조각이 "짤랑짤랑" 흩어짐 */
export function dismantle() {
  if (!ready()) return;
  const t = now();
  // ① 떨림 + 차오르는 기운 (0~0.6초)
  for (let i = 0; i < 12; i++) clack(t + i * 0.045 + Math.random() * 0.01, 0.06 + i * 0.012, 1.5 + i * 0.04);
  tone(t, 0.6, 'sine', 220, 880, 0.07, 0.15);
  tone(t, 0.6, 'triangle', 330, 1320, 0.035, 0.2);
  noise(t, 0.6, 'bandpass', 1200, 0.06, 2, 5000);
  // ② "쩌억": 금 가는 소리 → "쨍!": 부서짐
  const b = t + 0.6;
  noise(b - 0.06, 0.06, 'bandpass', 2600, 0.22, 4, 1400);
  noise(b, 0.05, 'highpass', 3500, 0.5, 0.7);
  noise(b, 0.22, 'bandpass', 2200, 0.35, 1, 600);
  tone(b, 0.25, 'sine', 140, 50, 0.4, 0.001);
  // ③ 조각이 흩어지며 짤랑짤랑
  for (let i = 0; i < 14; i++) { const at = b + 0.04 + Math.random() * 0.55; const f = 2600 + Math.random() * 3400; tone(at, 0.18, 'sine', f, f * 0.98, 0.04 * (1 - (at - b) / 0.8), 0.001); }
}
/** 보너스 패가 나왔을 때 "띵!": 맑은 종 한 번 (배음 + 긴 여운) */
export function ding() {
  if (!ready()) return;
  const t = now();
  tone(t, 1.3, 'sine', 1568, 1568, 0.2, 0.002);
  tone(t, 0.9, 'sine', 1568 * 2.76, 1568 * 2.76, 0.05, 0.002);
  tone(t, 0.5, 'sine', 1568 * 5.4, 1568 * 5.4, 0.02, 0.001);
  tone(t + 0.09, 1.1, 'sine', 2093, 2093, 0.1, 0.002);
  noise(t, 0.03, 'highpass', 6000, 0.05, 0.7);
}
/** 고 */
/** 고: 큰 북 "둥!" — 2고는 "둥둥!", 3고부터는 징까지 울린다 */
export function go(n = 1) {
  if (!ready()) return;
  const t = now();
  const drum = (at: number, v: number) => {
    tone(at, 0.55, 'sine', 120, 52, v, 0.003);          // 북 몸통
    tone(at, 0.18, 'triangle', 240, 110, v * 0.25, 0.002); // 가죽 울림
    noise(at, 0.08, 'lowpass', 600, v * 0.35, 0.8, 200);   // 북채 닿는 소리
  };
  drum(t, 0.55);
  if (n >= 2) drum(t + 0.17, 0.5);
  if (n >= 3) { // 징: 낮고 길게 퍼지는 금속 울림
    const g = t + (n >= 2 ? 0.3 : 0.1);
    tone(g, 2.2, 'sine', 178, 174, 0.13, 0.02);
    tone(g, 1.6, 'sine', 356, 350, 0.05, 0.02);
    tone(g, 1.1, 'sine', 523, 515, 0.025, 0.02);
  }
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

interface Track { id: string; name: string; desc: string; bpm: number; swing: number; bars: number; steps?: number; play: (s: number, bar: number, t: number, sp: number, i: number) => void }

// ===== 국악풍 (차분하고 품위 있게) =====
// 계면조(미·라·시·레·미) 중심, 서양 3화음 대신 빈 5도 울림(패드)으로 받쳐 "중국풍·방정맞음"을 피한다. 느린 템포, 긴 음, 농현.
/** 장구: 쿵(북편, 낮고 둥근) */
function kung(t: number, vol: number) {
  const c = ctx!; const o = c.createOscillator();
  o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(62, t + 0.22);
  const g = c.createGain(); adsr(g, t, 0.003, vol, 0.42); o.connect(g); out(g); o.start(t); o.stop(t + 0.5);
  nz(t, 0.06, 'lowpass', 700, vol * 0.25);
}
/** 장구: 덕(채편, 가죽을 치는 맑은 소리) */
function deok(t: number, vol: number) {
  nz(t, 0.05, 'bandpass', 2600, vol, 1.4);
  const c = ctx!; const o = c.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(520, t); o.frequency.exponentialRampToValueAtTime(380, t + 0.06);
  const g = c.createGain(); adsr(g, t, 0.001, vol * 0.5, 0.08); o.connect(g); out(g); o.start(t); o.stop(t + 0.12);
}
/** 박: 나무판 여러 장이 "딱" 맞부딪는 소리 (궁중악의 시작·끝) */
const bak = (t: number, vol: number) => { nz(t, 0.05, 'bandpass', 1700, vol, 2.5); nz(t + 0.006, 0.04, 'bandpass', 2400, vol * 0.7, 3); };
/** 거문고: 술대로 내리치는 낮고 굵은 소리 */
function geomun(t: number, m: number, vol: number) {
  const c = ctx!; const f = mf(m);
  const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
  const o2 = c.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.2; lp.frequency.setValueAtTime(f * 7, t); lp.frequency.exponentialRampToValueAtTime(f * 1.6, t + 0.5);
  const g = c.createGain(); adsr(g, t, 0.004, vol, 1.8);
  o.connect(lp); o2.connect(lp); lp.connect(g); out(g);
  o.frequency.setValueAtTime(f * 1.02, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.08);
  [o, o2].forEach((x) => { x.start(t); x.stop(t + 2); });
  nz(t, 0.025, 'bandpass', 1400, vol * 0.6, 2); // 술대 닿는 소리
}
/** 해금: 활로 긋는 콧소리 섞인 현 (느린 떨림) */
function haegeum(t: number, m: number, dur: number, vol: number) {
  const c = ctx!; const f = mf(m);
  const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
  const lfo = c.createOscillator(); lfo.frequency.value = 5; const lg = c.createGain();
  lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.012, t + Math.min(dur, 0.8)); lfo.connect(lg).connect(o.frequency);
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 0.9;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.18); g.gain.setValueAtTime(vol, t + dur * 0.85); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.25);
  o.connect(bp).connect(lp).connect(g); out(g);
  o.frequency.setValueAtTime(f * 0.985, t); o.frequency.linearRampToValueAtTime(f, t + 0.12);
  [o, lfo].forEach((x) => { x.start(t); x.stop(t + dur + 0.3); });
}
/** 바람·대숲 소리 */
function wind(t: number, dur: number, vol: number) {
  const c = ctx!; if (!nbuf) nbuf = noiseBuffer(1);
  const s = c.createBufferSource(); s.buffer = nbuf; s.loop = true;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.6; f.frequency.setValueAtTime(400, t); f.frequency.linearRampToValueAtTime(900, t + dur / 2); f.frequency.linearRampToValueAtTime(450, t + dur);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.4); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g); out(g); s.start(t); s.stop(t + dur + 0.1);
}
/** 굿거리 장단 (한 마디 12칸 = 3분박 4박) — 아주 작게 */
function gutgeori(s: number, t: number, v: number) {
  if (s === 0) { kung(t, v); deok(t, v * 0.6); }  // 덩
  if (s === 2) deok(t, v * 0.45);                  // 기덕
  if (s === 3 || s === 9) kung(t, v * 0.7);        // 쿵
  if (s === 6) deok(t, v * 0.5);
  if (s === 7 || s === 8) deok(t, v * 0.22);       // 더러러
  if (s === 11) deok(t, v * 0.35);
}
type G = [number, number, number?][];
function gseq(a: G) { const m = new Map<number, [number, number, number]>(); let p = 0; a.forEach(([n, l, o]) => { if (n >= 0) m.set(p, [n, l, o ?? 0]); p += l; }); return m; }
const ROOTS = [[45, 52, 57], [45, 52, 57], [50, 57, 62], [50, 57, 62], [45, 52, 57], [45, 52, 57], [40, 47, 52], [45, 52, 57]]; // 빈 5도(라·미 / 레·라 / 미·시)
// 1) 달빛 정원: 가야금 선율 + 대금 대답, 굿거리
const M1 = gseq([[69, 6, 1], [71, 3], [74, 3], [76, 9, 1], [74, 3, 2], [71, 6], [69, 3], [71, 3], [69, 12, 1],
  [64, 6], [69, 3], [71, 3], [74, 6, 1], [76, 3], [74, 3, 2], [71, 6], [69, 6], [69, 12, 1]]);
const D1 = gseq([[-1, 12], [81, 12], [-1, 12], [76, 12], [-1, 12], [86, 6], [83, 6], [-1, 12], [81, 12]]);
// 2) 사랑방: 거문고 + 해금
const M2 = gseq([[76, 12], [74, 6], [71, 6], [69, 18], [-1, 6], [71, 6], [74, 6], [76, 12], [74, 6], [71, 6], [69, 12]]);
// 3) 궁중 연회: 편경(종)·대금 한목소리, 아주 느리게 (한 마디 16칸)
const M3 = gseq([[64, 16], [69, 8], [71, 8], [74, 16], [71, 8], [69, 8], [64, 16], [62, 8], [64, 8], [69, 32]]);
// 5) 대숲 바람: 대금 독주
const M5 = gseq([[69, 24], [71, 8], [74, 16], [76, 8], [74, 8], [71, 8], [69, 24], [-1, 8], [64, 16], [69, 8]]);
const ARP: Record<number, number[]> = { 45: [57, 64, 69, 71, 76], 50: [62, 69, 74, 76, 81], 40: [52, 59, 64, 69, 71] };

// ===== 게임 OST 국악 편곡풍 (사용자 선택 2026-11-18) =====
// 거문고가 베이스(신스 베이스 자리), 피리·대금이 선율, 모듬북이 박을 잡고, 현악 패드가 받친다. 라단조 5음(라·도·레·미·솔).
/** 피리: 겹서로 내는 굵고 콧소리 섞인 관악기 — 음 시작을 살짝 밀어 올리고 떨림 */
function piri(t: number, m: number, dur: number, vol: number) {
  const c = ctx!; const f = mf(m);
  const o = c.createOscillator(); o.type = 'square'; const o2 = c.createOscillator(); o2.type = 'sawtooth';
  for (const x of [o, o2]) { x.frequency.setValueAtTime(f * 0.94, t); x.frequency.linearRampToValueAtTime(f, t + 0.07); }
  o2.detune.value = 6;
  const lfo = c.createOscillator(); lfo.frequency.value = 6; const lg = c.createGain();
  lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(0, t + 0.15); lg.gain.linearRampToValueAtTime(f * 0.016, t + Math.min(dur, 0.6));
  lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 0.7;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200;
  const g2 = c.createGain(); g2.gain.value = 0.6;
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.04); g.gain.setValueAtTime(vol * 0.85, t + Math.max(0.05, dur * 0.85)); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.12);
  o.connect(bp); o2.connect(g2).connect(bp); bp.connect(lp).connect(g); out(g);
  [o, o2, lfo].forEach((x) => { x.start(t); x.stop(t + dur + 0.2); });
}
type S2 = [number, number][];
function seqOf(a: S2) { const m = new Map<number, [number, number]>(); let p = 0; a.forEach(([n, l]) => { if (n >= 0) m.set(p, [n, l]); p += l; }); return m; }
const R1 = [45, 45, 48, 43, 45, 45, 50, 40]; // 라 라 도 솔 라 라 레 미
const P1 = seqOf([[69, 4], [72, 4], [74, 8], [76, 6], [74, 2], [72, 4], [69, 4], [67, 8], [69, 4], [72, 4], [69, 16],
  [76, 4], [79, 4], [81, 8], [79, 6], [76, 2], [74, 4], [72, 4], [74, 8], [76, 4], [72, 4], [69, 12], [-1, 4]]);
const D2 = seqOf([[-1, 16], [64, 8], [67, 4], [69, 4], [72, 12], [69, 4], [67, 16], [-1, 16], [76, 8], [74, 4], [72, 4], [74, 12], [72, 4], [69, 16]]);
const P3 = seqOf([[69, 16], [72, 8], [74, 8], [76, 24], [74, 8], [72, 16], [69, 8], [67, 8], [69, 32]]);
const P4 = seqOf([[69, 2], [72, 2], [74, 4], [76, 2], [74, 2], [72, 4], [69, 2], [67, 2], [69, 4], [72, 4], [74, 4], [76, 4], [79, 4], [76, 2], [74, 2], [72, 4], [74, 4], [69, 8], [-1, 8],
  [81, 4], [79, 2], [76, 2], [74, 4], [76, 4], [72, 4], [74, 4], [69, 8], [67, 8], [69, 20]]);
const D5 = seqOf([[69, 24], [72, 8], [74, 16], [76, 8], [74, 8], [72, 8], [69, 24], [-1, 8], [64, 16], [69, 8]]);
const CHD: Record<number, number[]> = { 45: [57, 64, 69], 48: [55, 60, 64], 43: [55, 62, 67], 50: [57, 62, 69], 40: [52, 59, 64] };
const ARP2: Record<number, number[]> = { 45: [57, 64, 69, 72, 76], 48: [60, 64, 67, 72, 76], 43: [55, 62, 67, 69, 74], 50: [57, 62, 69, 72, 74], 40: [52, 59, 64, 67, 71] };

const TRACKS: Track[] = [
  { id: 'march', name: '출정', desc: '모듬북과 거문고가 몰아치고 피리가 앞장서는 — 판을 여는 힘찬 곡', bpm: 100, swing: 0, bars: 8,
    play: (s, bar, t, sp, i) => {
      const r = R1[bar];
      if (s % 2 === 0) geomun(t, s % 8 === 0 ? r : s % 8 === 4 ? r + 7 : r + 12, s % 8 === 0 ? 0.2 : 0.11);
      if (s === 0 || s === 3 || s === 8 || s === 11) taiko(t, s === 0 ? 0.34 : 0.2);
      if (bar % 2 === 1 && s >= 13) taiko(t, 0.1 + (s - 13) * 0.05);
      if (s === 4 || s === 12) deok(t, 0.1);
      if (s === 0 && bar % 2 === 0) pad(t, CHD[r], sp * 32, 0.012, 1000);
      const m = P1.get(i); if (m) piri(t, m[0], m[1] * sp, 0.085);
    } },
  { id: 'duel2', name: '달밤의 승부', desc: '거문고가 낮게 맥박을 치고 대금이 길게 노래하는 — 긴장되는 한 판', bpm: 88, swing: 0, bars: 8,
    play: (s, bar, t, sp, i) => {
      const r = R1[bar];
      if (s % 2 === 0) geomun(t, s % 4 === 0 ? r : r + 12, s % 4 === 0 ? 0.15 : 0.07);
      if (s === 0) { taiko(t, 0.22); sub(t, r, sp * 14, 0.07); }
      if (s === 10) taiko(t, 0.12);
      if (s % 4 === 2) deok(t, 0.045);
      if (s === 0 && bar % 2 === 0) pad(t, CHD[r], sp * 32, 0.011, 800);
      const m = D2.get(i); if (m) dae(t, mf(m[0] + 12), m[1] * sp, 0.075);
    } },
  { id: 'kingroad', name: '왕의 길', desc: '현악이 크게 부풀고 대금·피리가 한목소리로 — 장엄하고 웅장하게', bpm: 72, swing: 0, bars: 8,
    play: (s, bar, t, sp, i) => {
      const r = R1[bar];
      if (s === 0) { taiko(t, 0.36); geomun(t, r, 0.2); bell(t, r + 36, 0.04, 3); }
      if (s === 8) { taiko(t, 0.2); geomun(t, r + 7, 0.1); }
      if (s === 0 && bar % 2 === 0) pad(t, [...CHD[r], CHD[r][0] + 12], sp * 32, 0.016, 1400);
      const m = P3.get(i); if (m) { piri(t, m[0], m[1] * sp, 0.06); dae(t, mf(m[0] + 12), m[1] * sp, 0.05); }
    } },
  { id: 'hero', name: '장터의 영웅', desc: '장구가 신명 나게 몰고 피리가 재잘대는 — 경쾌하지만 가볍지 않게', bpm: 112, swing: 0.05, bars: 8,
    play: (s, bar, t, sp, i) => {
      const r = R1[bar];
      if (s % 4 === 0) kung(t, s === 0 ? 0.2 : 0.12);
      if (s % 4 === 2) deok(t, 0.08); if (s % 2 === 1) deok(t, 0.025);
      if (s % 2 === 0) geomun(t, s % 8 === 0 ? r : r + (s % 8 === 4 ? 7 : 12), s % 8 === 0 ? 0.16 : 0.08);
      if (s === 0) taiko(t, 0.2);
      const m = P4.get(i); if (m) piri(t, m[0], m[1] * sp, 0.075);
    } },
  { id: 'eve', name: '결전 전야', desc: '가야금이 고요히 흐르고 대금이 멀리서 — 숨 고르는 쉬는 곡', bpm: 66, swing: 0, bars: 8, steps: 12,
    play: (s, bar, t, sp, i) => {
      const r = R1[bar]; const ar = ARP2[r];
      const k = [0, 1, 2, 3, 4, 2][s % 6]; gaya(t, mf(ar[k]), s % 6 === 0 ? 1 : 0, sp * 2, s % 6 === 0 ? 0.075 : 0.05);
      if (s === 0 && bar % 2 === 0) { pad(t, CHD[r], sp * 24, 0.01, 650); geomun(t, r, 0.1); }
      const m = D5.get(Math.floor(i * 16 / 12)); if (m && (i * 16) % 12 === 0) dae(t, mf(m[0]), m[1] * sp * 0.75, 0.07);
    } },
];
// ===== 녹음된 국악 음원 (한국저작권위원회 공유마당, CC BY — 출처 표시하면 상업적 이용 가능) =====
// 합성음은 소리 자체가 싸게 들리는 한계가 있어(사용자 피드백 여러 번), 실제 연주 녹음으로 바꿨다. 합성 곡(TRACKS)은 남겨만 둔다.
export interface RecTrack { id: string; name: string; desc: string; src: string; credit: string; url: string }
export const REC: RecTrack[] = [
  { id: 'r-korea', name: '뷰티플 코리아', desc: '밝고 경쾌한 국악 — 판 진행용', src: 'bgm/beautiful-korea.mp3', credit: '윤영현 「Beautiful Korea(뷰티플 코리아)」', url: 'https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13048827&menuNo=200020' },
  { id: 'r-sori', name: '우리네 소리를 듣다', desc: '힘 있는 타악과 국악기 — 웅장하게', src: 'bgm/urine-sori.mp3', credit: '임다솔 「우리네 소리를 듣다」', url: 'https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13048780&menuNo=200020' },
  { id: 'r-blackbox', name: '블랙박스 - 사우스 코리아', desc: '가야금과 전자음의 세련된 퓨전', src: 'bgm/black-box.mp3', credit: '이지빈 「BLACK BOX - South Korea」', url: 'https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13288291&menuNo=200020' },
  { id: 'r-love', name: '러브 테마', desc: '상큼하게 차오르는 국악 테마', src: 'bgm/love-theme.mp3', credit: '김정식 「러브 테마(Love Theme)」', url: 'https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13048804&menuNo=200020' },
  { id: 'r-sad', name: '새드니스', desc: '느리고 애잔한 국악 드라마풍', src: 'bgm/sadness.mp3', credit: '김정식 「새드니스(Sadness)」', url: 'https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13048808&menuNo=200020' },
  { id: 'r-jindo', name: '진도아리랑', desc: '국악 합주로 듣는 민요', src: 'bgm/jindo-arirang.mp3', credit: '한국저작권위원회 「국악연주곡_진도아리랑」', url: 'https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13263061&menuNo=200020' },
  { id: 'r-biga', name: '비가', desc: '애절한 선율의 국악 창작곡', src: 'bgm/biga.mp3', credit: '조성욱 「비가(悲歌)」', url: 'https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13211114&menuNo=200020' },
];
export const BGM_TRACKS = REC.map(({ id, name, desc }) => ({ id, name, desc }));
export const BGM_CREDITS = REC.map(({ name, credit, url }) => ({ name, credit, url }));

// 선택·좋아요·재생 방식 (이 기기에 저장)
let trackId = REC[0].id;
let favs: string[] = [];
let mode: 'one' | 'favs' = 'one';
try {
  const tId = localStorage.getItem('mg-bgm-track'); if (tId && REC.some((x) => x.id === tId)) trackId = tId;
  const f = JSON.parse(localStorage.getItem('mg-bgm-favs') || '[]'); if (Array.isArray(f)) favs = f.filter((x) => REC.some((t) => t.id === x));
  if (localStorage.getItem('mg-bgm-mode') === 'favs') mode = 'favs';
} catch { /* 무시 */ }
const saveBgmPrefs = () => { try { localStorage.setItem('mg-bgm-track', trackId); localStorage.setItem('mg-bgm-favs', JSON.stringify(favs)); localStorage.setItem('mg-bgm-mode', mode); } catch { /* 무시 */ } };
export const bgmTrack = () => trackId;
export const bgmFavs = () => [...favs];
export const bgmMode = () => mode;
const trackListeners: ((id: string) => void)[] = [];
const onTrackChange = (id: string) => trackListeners.forEach((f) => f(id));
export function onBgmTrack(f: (id: string) => void) { trackListeners.push(f); }
/** 곡 고르기: 바로 그 곡으로 바꿔 튼다 */
export function setBgmTrack(id: string) {
  if (!REC.some((x) => x.id === id)) return;
  trackId = id; saveBgmPrefs(); onTrackChange(id);
  if (bgmOn) { stopBgm(true); startBgm(); }
}
export function toggleFav(id: string) { favs = favs.includes(id) ? favs.filter((x) => x !== id) : [...favs, id]; saveBgmPrefs(); return favs.includes(id); }
export function setBgmMode(m: 'one' | 'favs') { mode = m; saveBgmPrefs(); if (audio) audio.loop = !(m === 'favs' && favs.length > 1); }

const BGM_VOL = 0.42; // 효과음보다 작게
let audio: HTMLAudioElement | null = null;
let fadeT: number | null = null;
function fadeTo(a: HTMLAudioElement, to: number, ms: number, done?: () => void) {
  if (fadeT !== null) clearInterval(fadeT);
  const from = a.volume; const t0 = performance.now();
  fadeT = window.setInterval(() => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    a.volume = Math.max(0, Math.min(1, from + (to - from) * k));
    if (k >= 1) { clearInterval(fadeT!); fadeT = null; done?.(); }
  }, 40);
}
export function startBgm() {
  if (!bgmOn || audio) return;
  const tr = REC.find((x) => x.id === trackId) ?? REC[0];
  const a = new Audio(tr.src);
  a.loop = !(mode === 'favs' && favs.length > 1);
  a.volume = 0;
  a.addEventListener('ended', () => { // 좋아요 돌아가며 듣기: 다음 곡
    if (audio !== a) return;
    const k = favs.indexOf(trackId); trackId = favs[(k + 1) % favs.length] ?? trackId; saveBgmPrefs(); onTrackChange(trackId);
    audio = null; startBgm();
  });
  audio = a;
  a.play().then(() => fadeTo(a, BGM_VOL * musicVol, 1200)).catch(() => { if (audio === a) audio = null; });
}
export function stopBgm(now = false) {
  const a = audio; audio = null;
  if (!a) return;
  if (now) { a.pause(); return; }
  fadeTo(a, 0, 600, () => a.pause());
}
export function setBgm(v: boolean) {
  bgmOn = v;
  try { localStorage.setItem('mg-bgm', v ? '1' : '0'); } catch { /* 무시 */ }
  if (v) startBgm(); else stopBgm();
}
// 앱이 뒤로 가면 멈추고, 돌아오면 다시
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (!audio) return; if (document.hidden) audio.pause(); else audio.play().catch(() => {}); });

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

// ---------- 패 섞기·돌리기 소리 ----------
/** 새 판: 화투를 촤라락 섞고(가볍고 빠른 타격 연속) 탁탁 두 번 정리 */
export function shuffle() {
  if (!ready()) return;
  const t = now();
  for (let i = 0; i < 16; i++) clack(t + i * 0.028 + Math.random() * 0.006, 0.12 + Math.random() * 0.06, 1.25 + Math.random() * 0.15);
  clack(t + 0.56, 0.42, 0.95); clack(t + 0.66, 0.5, 0.92);
}

// ---------- 효과 음성 (고·스톱·뻑·쪽 …) ----------
// 기기의 한국어 음성 합성(TTS)을 쓴다. 한국어 음성이 없는 기기에서는 조용히 넘어간다.
let voiceOn = true;
try { voiceOn = localStorage.getItem('mg-voice') !== '0'; } catch { /* 무시 */ }
export const isVoiceOn = () => voiceOn;
export function setVoice(v: boolean) { voiceOn = v; try { localStorage.setItem('mg-voice', v ? '1' : '0'); } catch { /* 무시 */ } }
let koVoice: SpeechSynthesisVoice | null | undefined;
function pickVoice() {
  if (typeof speechSynthesis === 'undefined') return null;
  const vs = speechSynthesis.getVoices();
  return vs.find((v) => v.lang === 'ko-KR' && /female|여|yuna|heami|sun/i.test(v.name)) ?? vs.find((v) => v.lang?.startsWith('ko')) ?? null;
}
if (typeof speechSynthesis !== 'undefined') speechSynthesis.addEventListener?.('voiceschanged', () => { koVoice = pickVoice(); });
export function say(text: string, excited = false) {
  if (!voiceOn || muted || typeof speechSynthesis === 'undefined') return;
  if (koVoice === undefined) koVoice = pickVoice();
  if (!koVoice) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = koVoice; u.lang = 'ko-KR'; u.rate = excited ? 1.18 : 1.08; u.pitch = excited ? 1.15 : 1; u.volume = sfxVol;
    speechSynthesis.speak(u);
  } catch { /* 무시 */ }
}

// ---------- 뽑기 재화별 소리 ----------
/** 동전 "팅": 높은 쇳소리 */
export function coin(bright = 1) {
  if (!ready()) return;
  const t = now();
  tone(t, 0.5, 'sine', 3150 * bright, 3120 * bright, 0.09, 0.001);
  tone(t, 0.35, 'sine', 4720 * bright, 4700 * bright, 0.05, 0.001);
  tone(t, 0.25, 'sine', 2080 * bright, 2070 * bright, 0.06, 0.001);
  noise(t, 0.01, 'highpass', 5000, 0.1);
}
/** 동전을 튕겨 올리는 소리 */
export function coinToss() {
  if (!ready()) return;
  const t = now();
  coin(1.05);
  noise(t + 0.02, 0.5, 'bandpass', 900, 0.05, 1.2, 3200);
}
/** 은 주발이 울리는 "띵—" */
export function ring() {
  if (!ready()) return;
  const t = now();
  [[660, .11], [663, .08], [1012, .06], [1650, .035], [2420, .02]].forEach(([f, v], i) => tone(t, 2.6 - i * 0.3, 'sine', f, f * 0.998, v, 0.002));
}
/** 금화가 우수수 쏟아지는 소리 */
export function coinRain(ms = 1100) {
  if (!ready()) return;
  for (let i = 0; i < 22; i++) { const d = Math.random() * ms; setTimeout(() => coin(0.85 + Math.random() * 0.35), d); }
}
/** 옥 노리개·풍경 소리 */
export function windchime() {
  if (!ready()) return;
  const t = now();
  [2093, 2349, 2637, 3136, 3520].forEach((f, i) => { const d = i * 0.13 + Math.random() * 0.05; tone(t + d, 1.6, 'sine', f, f, 0.05, 0.002); tone(t + d, 0.8, 'sine', f * 2.76, f * 2.76, 0.012, 0.002); });
}
/** 용의 포효: 낮게 울리는 숨 + 북 */
export function roar() {
  if (!ready()) return;
  const t = now();
  noise(t, 1.4, 'lowpass', 420, 0.25, 1.4, 90);
  tone(t, 1.3, 'sawtooth', 70, 46, 0.09, 0.15);
  tone(t, 1.1, 'sawtooth', 105, 70, 0.05, 0.2);
  [0, 0.2, 0.4, 0.55, 0.7].forEach((d, i) => tone(t + d, 0.4, 'sine', 95, 50, 0.18 + i * 0.03, 0.003));
}
