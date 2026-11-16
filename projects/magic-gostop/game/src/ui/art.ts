import type { Card } from '../engine';

// 화투 48장 그림 v2 (자체 제작 SVG). viewBox 40 x 62.
// 실제 화투처럼 카드 전체를 채우는 구성: 검은 언덕·붉은 하늘·굵은 외곽선·월별 식물과 상징물.
// 기존 화투 인쇄본을 베끼지 않고, 전통 소재(송학, 매조, 벚꽃 …)를 새로 그렸다.

const W = 40, H = 62;
const K = '#1a1414'; // 외곽선
const P = {
  red: '#d42a2f', deep: '#9d1623', sky: '#e2412d', black: '#151212', white: '#fbf7ec', cream: '#f6eedb',
  pine: '#2a7a3a', pineDk: '#134d26', green: '#3a9a43', leaf: '#1d6b30', yellow: '#f5c518', gold: '#e8ad2e',
  blue: '#2350ad', purple: '#6c3ea6', lilac: '#9a6cc9', pink: '#f7a9c0', blush: '#fde3ea', brown: '#7a4320',
  bark: '#4b2a17', grey: '#8c8a86', orange: '#ec6a22',
};

const f = (n: number) => Math.round(n * 100) / 100;
const st = (w = 0.5) => `stroke="${K}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const circ = (x: number, y: number, r: number, fill: string, w = 0.5) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${fill}" ${w ? st(w) : ''}/>`;
const path = (d: string, fill: string, w = 0.5) => `<path d="${d}" fill="${fill}" ${w ? st(w) : ''}/>`;
const stroke = (d: string, color: string, w: number) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const g = (t: string, body: string) => `<g transform="${t}">${body}</g>`;
const rect = (x: number, y: number, w: number, h: number, fill: string) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;

// ---------- 공통 소재 ----------
/** 아래쪽 둥근 언덕 */
function hill(top: number, fill: string, wave = 0) {
  return path(`M-1 ${top + 6} C8 ${top - 2 + wave} 16 ${top + 2} 22 ${top - 1 - wave} C28 ${top - 4} 35 ${top + 1} 41 ${top - 1} L41 63 L-1 63 Z`, fill, 0.6);
}
function grass(y0: number, n: number, color: string, seed = 0) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = 2 + (i * 37) / n + ((i * 7 + seed) % 3);
    const h = 9 + ((i * 5 + seed) % 6);
    const lean = ((i + seed) % 2 ? 1 : -1) * (2 + (i % 3));
    s += stroke(`M${f(x)} 63 Q${f(x + lean * 0.3)} ${f(y0 + 6)} ${f(x + lean)} ${f(y0 + 10 - h)}`, color, 0.7);
  }
  return s;
}
function pineFan(x: number, y: number, s: number) {
  let needles = '';
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI + (i / 8) * Math.PI;
    needles += stroke(`M${f(x)} ${f(y)} L${f(x + Math.cos(a) * s * 0.92)} ${f(y + Math.sin(a) * s * 0.7)}`, P.pineDk, 0.45);
  }
  return path(`M${f(x - s)} ${f(y)} A${f(s)} ${f(s * 0.72)} 0 0 1 ${f(x + s)} ${f(y)} Z`, P.pine, 0.55) + needles;
}
function blossom(x: number, y: number, r: number, petal: string, center: string, w = 0.4) {
  let s = '';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    s += circ(x + Math.cos(a) * r * 0.58, y + Math.sin(a) * r * 0.58, r * 0.5, petal, w);
  }
  return s + circ(x, y, r * 0.24, center, 0);
}
function leafShape(x: number, y: number, len: number, wid: number, angle: number, fill: string, w = 0.45) {
  return g(`translate(${f(x)} ${f(y)}) rotate(${f(angle)})`, path(`M0 0 C${f(wid)} ${f(-len * 0.3)} ${f(wid * 0.6)} ${f(-len * 0.8)} 0 ${f(-len)} C${f(-wid * 0.6)} ${f(-len * 0.8)} ${f(-wid)} ${f(-len * 0.3)} 0 0 Z`, fill, w));
}
function maple(x: number, y: number, r: number, fill: string, rot = 0) {
  let d = '';
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 - Math.PI / 2 + (rot * Math.PI) / 180;
    const rr = i % 2 ? r * 0.42 : r;
    d += `${i ? 'L' : 'M'}${f(x + Math.cos(a) * rr)} ${f(y + Math.sin(a) * rr)} `;
  }
  return path(d + 'Z', fill, 0.45);
}
function chrysanthemum(x: number, y: number, r: number) {
  let s = '';
  for (let i = 0; i < 16; i++) s += leafShape(x, y, r, r * 0.22, (i * 360) / 16, i % 2 ? P.yellow : '#f8d84a', 0.3);
  return s + circ(x, y, r * 0.32, P.orange, 0.4) + circ(x, y, r * 0.14, P.deep, 0);
}
function peony(x: number, y: number, r: number) {
  let s = '';
  for (let i = 0; i < 8; i++) s += leafShape(x, y + r * 0.1, r, r * 0.55, i * 45, P.red, 0.45);
  for (let i = 0; i < 6; i++) s += leafShape(x, y, r * 0.65, r * 0.4, i * 60 + 30, '#e8505a', 0.35);
  return s + circ(x, y, r * 0.22, P.yellow, 0.35);
}
function willowStrands(xs: number[], color: string) {
  return xs.map((x, i) => stroke(`M${x} -1 C${x - 2} 12 ${x + 3} 22 ${x - 1 + (i % 2) * 3} 36`, color, 0.9)
    + [8, 16, 24, 31].map((yy, j) => leafShape(x - 1 + ((j + i) % 2 ? 1.6 : -1.6), yy + 3, 4.5, 1.1, (j + i) % 2 ? 200 : 160, color, 0.2)).join('')).join('');
}

// ---------- 광 / 열끗 / 띠 표식 ----------
function gwangMark() {
  return circ(6.6, 6.6, 4.9, P.red, 0.6) + `<text x="6.6" y="9.4" text-anchor="middle" font-size="7.4" font-weight="700" fill="${P.white}" font-family="'Noto Serif KR','Nanum Myeongjo',serif">光</text>`;
}
function ribbon(kind: 'hong' | 'cheong' | 'cho', x = 20, y = 4, rot = -8) {
  const fill = kind === 'cheong' ? P.blue : P.red;
  const label = kind === 'hong' ? '홍단' : kind === 'cheong' ? '청단' : '';
  const body = path('M-5 0 L5 0 L5 27 L0 24.5 L-5 27 Z', fill, 0.6)
    + stroke('M-3.6 1.5 L-3.6 23', 'rgba(255,255,255,.28)', 0.6)
    + (label ? `<text x="0.3" y="5.6" font-size="4.6" font-weight="700" fill="${P.black}" text-anchor="middle" writing-mode="tb" font-family="'Noto Serif KR','Nanum Myeongjo',serif" letter-spacing="1">${label}</text>` : '');
  return g(`translate(${x} ${y}) rotate(${rot})`, body);
}
function doubleMark() {
  return g('translate(33.4 56)', circ(0, 0, 4.2, P.black, 0.4) + `<text x="0" y="1.9" text-anchor="middle" font-size="5" font-weight="700" fill="${P.gold}" font-family="sans-serif">2</text>`);
}

// ---------- 동물·사물 ----------
function crane(x: number, y: number) {
  return g(`translate(${x} ${y})`,
    path('M-7 2 C-6 -5 3 -7 7 -2 C9 1 6 5 0 5 C-4 5 -7 4 -7 2 Z', P.white, 0.6) // 몸
    + path('M-7 2 L-11 4 L-8 0 Z', P.black, 0.5) // 꼬리
    + stroke('M5 -3 C6 -9 4 -13 6 -17', K, 1.8) + stroke('M5 -3 C6 -9 4 -13 6 -17', P.white, 1) // 목
    + circ(6.2, -17.4, 1.8, P.white, 0.5) + circ(6.4, -18.4, 0.9, P.red, 0) // 머리·단정
    + path('M7.6 -17.3 L11.5 -16.4 L7.6 -16.2 Z', P.gold, 0.3)
    + path('M-3 -1 C0 -6 5 -6 6 -2 C3 -2 0 -1 -3 -1 Z', P.black, 0.3) // 날개깃
    + stroke('M-1 5 L-2 12 M2 5 L3 12', K, 0.6));
}
function smallBird(x: number, y: number, s: number, body: string, wing: string, belly: string, flip = false) {
  return g(`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`,
    path('M-6 0 C-5 -4 3 -5 6 -2 C7 1 4 3.5 -1 3.5 C-4 3.5 -6 2 -6 0 Z', body, 0.5)
    + path('M-1 2 C1 4 4 3 5 0 C3 2 1 2.5 -1 2 Z', belly, 0)
    + path('M-5.5 0 L-11 -1.5 L-10 2.5 Z', body, 0.5)
    + path('M-3 -1 C-1 -7 4 -8 6 -6 C4 -3 1 -1.5 -3 -1 Z', wing, 0.45)
    + circ(4.4, -1.6, 0.6, K, 0)
    + path('M6.2 -1.4 L8.8 -0.8 L6.2 -0.2 Z', P.gold, 0.3));
}
function geese() {
  const one = (x: number, y: number, s: number) => g(`translate(${x} ${y}) scale(${s})`,
    path('M-6 0 L-1 -1 L6 -4 L1 1 L6 4 L-1 1 Z', P.black, 0.3) + circ(-6.4, -0.4, 1, P.black, 0));
  return one(10, 9, 0.75) + one(21, 15, 0.85) + one(31, 7, 0.7);
}
function butterfly(x: number, y: number, s: number, c1: string, c2: string, r = 0) {
  return g(`translate(${x} ${y}) rotate(${r}) scale(${s})`,
    leafShape(0, 0, 6, 3.4, -55, c1, 0.4) + leafShape(0, 0, 6, 3.4, 55, c1, 0.4)
    + leafShape(0, 0, 4, 2.4, -140, c2, 0.4) + leafShape(0, 0, 4, 2.4, 140, c2, 0.4)
    + circ(-2.4, -2.8, 0.7, P.white, 0) + circ(2.4, -2.8, 0.7, P.white, 0)
    + stroke('M0 1.5 L0 -3', K, 0.9));
}
function boar(x: number, y: number) {
  return g(`translate(${x} ${y})`,
    path('M-11 2 C-11 -6 -2 -9 6 -6 C10 -5 13 -2 13 1 C13 3 11 4 8 4 L-8 5 C-10 5 -11 4 -11 2 Z', P.brown, 0.6)
    + path('M6 -6 C9 -9 11 -8 12 -6 Z', P.bark, 0.4) // 귀
    + path('M10 -3 C12 -3 14 -1 13 1 L10 1 Z', '#a0603a', 0.4) // 주둥이
    + circ(8.6, -3.4, 0.6, K, 0)
    + stroke('M-7 -4 C-3 -7 2 -7 5 -5', P.bark, 0.6)
    + stroke('M-7 5 L-8 9 M-3 5 L-3 9 M3 5 L3 9 M7 4 L8 8', K, 0.9));
}
function deer(x: number, y: number) {
  return g(`translate(${x} ${y})`,
    path('M-9 2 C-9 -3 -2 -5 4 -4 C7 -4 8 -2 8 0 C8 3 4 4 -4 4 C-7 4 -9 3 -9 2 Z', '#b0702e', 0.6)
    + path('M4 -4 C5 -8 6 -11 8 -12 C10 -12 11 -10 10 -9 C9 -8 8 -6 7 -3 Z', '#b0702e', 0.5)
    + circ(9, -10.6, 0.5, K, 0)
    + stroke('M8 -12 L7 -16 L5 -18 M7 -16 L9 -18 M9 -12 L11 -15 L13 -16 M11 -15 L11 -17', P.bark, 0.6)
    + [-6, -2, 2, 6].map((dx) => stroke(`M${dx} 3.5 L${dx + (dx > 0 ? 0.5 : -0.5)} 11`, K, 0.8)).join('')
    + [[-5, -1], [-1, -2], [2, 0], [-4, 2]].map(([a, b]) => circ(a, b, 0.6, P.cream, 0)).join(''));
}
function phoenix(x: number, y: number) {
  return g(`translate(${x} ${y})`,
    path('M-4 6 C-14 10 -18 -2 -10 -2 C-14 -8 -4 -10 -2 -4 Z', P.green, 0.5) // 꼬리깃
    + path('M-6 8 C-12 18 -2 22 0 14 Z', P.red, 0.5)
    + path('M-2 9 C2 20 10 18 6 10 Z', P.purple, 0.5)
    + path('M-6 4 C-6 -4 4 -8 8 -4 C11 -1 9 6 2 8 C-2 9 -6 8 -6 4 Z', P.gold, 0.6) // 몸
    + path('M-2 0 C2 -8 10 -10 12 -8 C9 -4 4 -1 -2 0 Z', P.red, 0.5) // 날개
    + stroke('M7 -5 C8 -10 6 -13 9 -15', K, 1.6) + stroke('M7 -5 C8 -10 6 -13 9 -15', P.gold, 0.9)
    + circ(9.4, -15.2, 1.6, P.red, 0.4) + path('M10.8 -15 L13.6 -14 L10.8 -13.6 Z', P.gold, 0.3)
    + stroke('M9 -16.6 C10 -19 12 -19 12 -17', P.green, 0.7));
}
function swallow(x: number, y: number) {
  return g(`translate(${x} ${y})`,
    path('M-8 -2 C-3 -6 4 -5 7 -1 C4 1 0 2 -4 1 L-11 6 L-7 0 Z', P.black, 0.5)
    + path('M-2 -3 C-1 -10 5 -12 9 -11 C5 -8 2 -5 0 -2 Z', '#2b2f5c', 0.4)
    + path('M3 -1 C5 0 7 0 7 -1 C5 1 3 1 3 -1 Z', P.red, 0)
    + circ(5, -2.4, 0.5, P.white, 0));
}
function umbrellaMan() {
  return path('M6 18 C10 7 26 7 30 18 Z', P.red, 0.6) // 우산
    + stroke('M18 9 L18 18 M10 18 L16 10 M26 18 L20 10', K, 0.4)
    + stroke('M18 18 L19 30', K, 0.7)
    + circ(19.5, 22, 2.6, P.cream, 0.5) + path('M17 21 C18 19 21 19 22 21 L22 20 C21 18 18 18 17 20 Z', P.black, 0.3)
    + path('M14 25 C16 23 24 23 25 26 L27 44 L12 44 Z', P.black, 0.6) // 도포
    + path('M16 26 L21 26 L22 43 L16 43 Z', P.yellow, 0.4)
    + stroke('M14 44 L13 47 M24 44 L25 47', K, 0.8);
}
function frog(x: number, y: number) {
  return g(`translate(${x} ${y})`, path('M-4 2 C-4 -2 4 -2 4 2 C4 3 -4 3 -4 2 Z', P.green, 0.4) + circ(-1.8, -0.8, 0.9, P.green, 0.3) + circ(1.8, -0.8, 0.9, P.green, 0.3) + circ(-1.8, -0.9, 0.35, K, 0) + circ(1.8, -0.9, 0.35, K, 0));
}
function stream() {
  return path('M-1 50 C8 46 16 54 26 50 C32 48 36 51 41 49 L41 63 L-1 63 Z', P.blue, 0.5)
    + stroke('M2 54 C8 52 12 56 18 54 M22 57 C27 55 31 58 37 56', 'rgba(255,255,255,.55)', 0.6);
}
function bridge() {
  let s = '';
  const planks: [number, number, number][] = [[-1, 47, -18], [9, 44, 16], [19, 47, -18], [29, 44, 16]];
  for (const [x, y, r] of planks) s += g(`translate(${x} ${y}) rotate(${r})`, rect(0, 0, 12, 4, '#9b6a3c') + `<rect x="0" y="0" width="12" height="4" fill="none" ${st(0.5)}/>` + stroke('M3 0 L3 4 M6 0 L6 4 M9 0 L9 4', K, 0.3));
  return s;
}
function sakeCup() {
  return path('M9 38 C9 46 31 46 31 38 Z', P.red, 0.7) + path('M8 37 L32 37 L31 39 L9 39 Z', P.deep, 0.5)
    + path('M15 45 L25 45 L27 50 L13 50 Z', P.red, 0.6)
    + `<text x="20" y="44" text-anchor="middle" font-size="5.6" font-weight="700" fill="${P.gold}" font-family="'Noto Serif KR',serif">壽</text>`;
}
function curtain() {
  let s = path('M-1 38 C10 35 30 35 41 38 L41 63 L-1 63 Z', P.red, 0.6);
  s += path('M-1 46 C10 43 30 43 41 46 L41 52 C30 49 10 49 -1 52 Z', P.white, 0.4);
  for (let i = 0; i < 5; i++) s += circ(4 + i * 8, 56, 2.2, P.white, 0.3) + circ(4 + i * 8, 56, 0.9, P.red, 0);
  for (let i = 0; i < 6; i++) s += stroke(`M${2 + i * 7} 38.5 L${2 + i * 7} 45`, P.deep, 0.5);
  return s;
}
function lightning() {
  return rect(0, 0, 40, 62, P.black)
    + path('M-1 0 L41 0 L41 18 C30 22 10 14 -1 20 Z', P.red, 0.5)
    + path('M24 6 L15 26 L22 26 L13 46 L28 22 L21 22 L29 6 Z', P.yellow, 0.6)
    + willowStrands([4, 34], P.green)
    + circ(30, 44, 5, P.red, 0.5) + circ(30, 44, 2.5, P.gold, 0.3) + circ(10, 52, 4, P.red, 0.5) + circ(10, 52, 2, P.gold, 0.3);
}
function moon() { return circ(20, 20, 11, P.white, 0.7) + circ(20, 20, 11, 'url(#moonGlow)', 0); }

// ---------- 월별 그림 ----------
type Draw = (c: Card, n: number) => string;
const MONTHS: Record<number, Draw> = {
  1: (c, n) => { // 송학
    const sky = c.kind === 'G' ? rect(0, 0, 40, 40, P.sky) + circ(26, 15, 8.5, P.red, 0.6) : n === 1 ? rect(0, 34, 40, 28, P.red) : '';
    const tree = stroke('M4 63 C8 50 12 44 18 38 C24 32 28 30 34 22', P.bark, 3.2) + stroke('M16 40 C12 36 9 34 4 33', P.bark, 1.8)
      + pineFan(8, 34, 7) + pineFan(20, 36, 8) + pineFan(31, 24, 7.5) + pineFan(13, 48, 6) + pineFan(28, 44, 6.5);
    const extra = c.kind === 'G' ? crane(18, 54) : c.kind === 'T' ? ribbon('hong', 21, 5, -10) : n === 0 ? hill(54, P.black) : hill(52, P.black, 2);
    return sky + tree + extra;
  },
  2: (c, n) => { // 매조
    const base = c.kind === 'P' ? (n ? hill(50, P.red) : hill(52, P.black)) : '';
    const branch = stroke('M2 62 C10 50 14 40 20 32 C24 26 30 20 38 14', P.bark, 2.2) + stroke('M18 34 C14 30 10 26 4 24', P.bark, 1.4);
    let flowers = '';
    for (const [x, y, r] of [[8, 25, 3.8], [16, 30, 4.2], [24, 25, 3.8], [32, 17, 4], [20, 40, 3.6], [11, 50, 3.4], [36, 26, 3]] as const) flowers += blossom(x, y, r, P.red, P.white);
    const extra = c.kind === 'Y' ? smallBird(20, 12, 1.05, '#8a9a2a', '#5f7019', '#c9d06a') : c.kind === 'T' ? ribbon('hong', 22, 30, 6) : '';
    return base + branch + flowers + extra;
  },
  3: (c, n) => { // 벚꽃
    const base = c.kind === 'P' ? (n ? hill(48, P.red) + hill(54, P.black, 3) : hill(50, P.black)) : '';
    let fl = '';
    const pts: [number, number, number][] = [[6, 8, 5], [16, 5, 5.5], [27, 9, 5], [36, 4, 4.4], [10, 19, 5], [22, 18, 5.6], [33, 20, 5], [5, 30, 4.4], [16, 31, 5], [28, 31, 4.6]];
    for (const [x, y, r] of pts) fl += blossom(x, y, r, P.pink, P.red, 0.35);
    const extra = c.kind === 'G' ? curtain() : c.kind === 'T' ? ribbon('hong', 20, 30, -6) : '';
    return rect(0, 0, 40, 62, P.blush) + base + fl + extra;
  },
  4: (c, n) => { // 흑싸리
    let s = stroke('M-1 3 C12 6 26 2 41 6', P.bark, 1.4);
    const xs = c.kind === 'P' ? (n ? [6, 15, 25, 34] : [8, 19, 30]) : [6, 34];
    for (const x of xs) {
      s += stroke(`M${x} 4 C${x + 2} 16 ${x - 2} 28 ${x + 1} 40`, K, 0.6);
      for (let j = 0; j < 7; j++) s += leafShape(x + (j % 2 ? 0.8 : -0.8), 8 + j * 4.6, 5, 1.6, j % 2 ? 205 : 155, P.black, 0.2);
    }
    const base = c.kind === 'P' ? hill(52, n ? P.red : P.black) : '';
    const extra = c.kind === 'Y' ? path('M24 8 A8 8 0 1 1 24 24 A6 6 0 1 0 24 8 Z', P.gold, 0.4) + smallBird(20, 34, 1.15, P.black, '#2c2c3a', P.red, true)
      : c.kind === 'T' ? ribbon('cho', 20, 26, -4) : '';
    return s + base + extra;
  },
  5: (c, n) => { // 난초(창포)
    let s = '';
    for (let i = 0; i < 7; i++) s += leafShape(4 + i * 5.4, 63, 30 + (i % 3) * 6, 2.2, -16 + i * 5.2, i % 2 ? P.green : P.leaf, 0.4);
    const flower = (x: number, y: number) => leafShape(x, y, 6, 2.6, -40, P.purple, 0.4) + leafShape(x, y, 6, 2.6, 40, P.purple, 0.4) + leafShape(x, y, 7, 2.4, 180, P.lilac, 0.4) + circ(x, y, 1, P.yellow, 0);
    s += flower(12, 22 + n * 2) + flower(27, 18) + flower(20, 30);
    const extra = c.kind === 'Y' ? bridge() : c.kind === 'T' ? ribbon('cho', 21, 4, -10) : hill(56, n ? P.red : P.black);
    return s + extra;
  },
  6: (c, n) => { // 모란
    let s = '';
    for (const [x, y, a] of [[8, 60, -35], [32, 60, 35], [20, 62, 0], [13, 58, -10], [27, 58, 12]] as const) s += leafShape(x, y, 16, 5, a, P.black, 0.4);
    s += peony(20, 32 - (c.kind === 'T' ? 2 : 0), 10);
    const extra = c.kind === 'Y' ? butterfly(9, 12, 1, P.blue, '#7aa6e6', -15) + butterfly(31, 10, 0.9, P.blue, '#7aa6e6', 18)
      : c.kind === 'T' ? ribbon('cheong', 30, 4, 8) : n ? rect(0, 0, 40, 8, P.red) : '';
    return s + extra;
  },
  7: (c, n) => { // 홍싸리
    let s = '';
    const stems: string[] = ['M2 62 C6 40 16 24 36 10', 'M14 62 C14 46 22 34 38 30', 'M30 62 C26 50 16 40 4 34'];
    for (const d of stems) s += stroke(d, P.black, 1);
    const pts: [number, number][] = [[8, 44], [11, 36], [15, 29], [21, 22], [27, 17], [33, 12], [18, 46], [24, 38], [31, 33], [24, 50], [12, 40], [6, 35], [36, 31], [28, 24]];
    pts.forEach(([x, y], i) => { s += leafShape(x, y, 4.2, 1.6, i * 47, i % 3 ? P.red : P.deep, 0.25); });
    const extra = c.kind === 'Y' ? boar(18, 52) : c.kind === 'T' ? ribbon('cho', 20, 6, -6) : hill(56, n ? P.red : P.black);
    return s + extra;
  },
  8: (c, n) => { // 공산
    const red = c.kind !== 'P';
    const sky = red ? rect(0, 0, 40, 40, P.sky) : n ? rect(0, 0, 40, 40, P.cream) : '';
    const body = c.kind === 'G' ? moon() : c.kind === 'Y' ? geese() : '';
    return sky + body + hill(34, P.black, 2) + grass(32, 12, 'rgba(255,255,255,.85)', n);
  },
  9: (c, n) => { // 국화
    let s = '';
    for (const [x, y, a] of [[10, 62, -25], [30, 62, 25], [20, 62, 0]] as const) s += leafShape(x, y, 18, 5, a, P.leaf, 0.4);
    s += stroke('M20 62 C20 50 18 40 14 30 M20 52 C24 44 28 40 30 24', P.leaf, 0.9);
    s += chrysanthemum(14, 26, 7.5) + chrysanthemum(30, 22, 6) + chrysanthemum(22, 40, 5.5);
    const extra = c.kind === 'Y' ? sakeCup() : c.kind === 'T' ? ribbon('cheong', 9, 6, -6) : n ? rect(0, 0, 40, 9, P.red) : '';
    return s + extra;
  },
  10: (c, n) => { // 단풍
    let s = stroke('M38 -1 C30 12 26 24 22 34 C18 44 14 54 10 63', P.bark, 1.8) + stroke('M26 22 C20 18 14 16 6 16', P.bark, 1);
    const pts: [number, number, number][] = [[30, 6, 5.5], [20, 12, 5], [8, 14, 5], [32, 20, 5], [16, 26, 5.5], [6, 30, 4.4], [26, 34, 5], [14, 42, 4.6]];
    pts.forEach(([x, y, r], i) => { s += maple(x, y, r, i % 3 ? P.red : P.orange, i * 13); });
    const extra = c.kind === 'Y' ? deer(18, 50) : c.kind === 'T' ? ribbon('cheong', 21, 28, 6) : hill(54, n ? P.red : P.black);
    return s + extra;
  },
  11: (c, n) => { // 오동
    const bg = c.kind === 'D' ? rect(0, 0, 40, 62, P.yellow) : '';
    let s = '';
    for (const [x, y, a, l] of [[10, 62, -30, 26], [30, 62, 30, 26], [20, 63, 0, 28]] as const) s += leafShape(x, y, l, 9, a, P.black, 0.5);
    s += stroke('M20 40 L20 60', '#1a1a1a', 0.6);
    const stalk = (x: number, y: number) => stroke(`M${x} ${y} L${x} ${y + 14}`, P.bark, 0.8) + [0, 3, 6, 9, 12].map((d) => circ(x + (d % 2 ? 1.4 : -1.4), y + d, 1.6, P.lilac, 0.3)).join('');
    s += c.kind === 'G' ? '' : stalk(20 + (n ? 6 : 0), 8);
    const extra = c.kind === 'G' ? phoenix(21, 26) : '';
    return bg + s + extra;
  },
  12: (c, n) => { // 비
    if (c.kind === 'D') return lightning();
    const sky = c.kind === 'G' ? rect(0, 0, 40, 62, P.cream) : '';
    const tree = stroke('M36 -1 C33 16 36 30 33 44', P.bark, 2.4) + willowStrands([4, 11, 18, 26, 33], P.green);
    const extra = c.kind === 'G' ? stream() + umbrellaMan() + frog(6, 47) : c.kind === 'Y' ? stream() + swallow(18, 30) : ribbon('cho', 18, 18, -12) + stream();
    return sky + tree + extra + (n ? '' : '');
  },
};

const cache = new Map<string, string>();
export function cardArt(c: Card): string {
  const hit = cache.get(c.id);
  if (hit) return hit;
  const n = Number(c.id.slice(-1));
  const body = MONTHS[c.month](c, n);
  const defs = `<defs><radialGradient id="moonGlow"><stop offset="60%" stop-color="#fff" stop-opacity="0"/><stop offset="100%" stop-color="#f3d27a" stop-opacity=".55"/></radialGradient></defs>`;
  // 한국 화투처럼 빨간 테두리 안에 그림을 넣는다 (그림 영역을 테두리 안쪽으로 줄여서 배치)
  const inset = 1.9, iw = W - inset * 2, ih = H - inset * 2;
  const clip = `clip-${c.id}`;
  const inner = `<rect width="${W}" height="${H}" fill="${P.white}"/>${body}${c.kind === 'G' ? gwangMark() : ''}${c.kind === 'D' ? doubleMark() : ''}`;
  const svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" preserveAspectRatio="xMidYMid slice">${defs}`
    + `<clipPath id="${clip}"><rect x="${inset}" y="${inset}" width="${f(iw)}" height="${f(ih)}" rx="1.6"/></clipPath>`
    + `<rect width="${W}" height="${H}" rx="2.6" fill="${P.red}"/>`
    + `<g clip-path="url(#${clip})"><g transform="translate(${inset} ${inset}) scale(${f(iw / W)} ${f(ih / H)})">${inner}</g></g>`
    + `<rect x="${inset}" y="${inset}" width="${f(iw)}" height="${f(ih)}" rx="1.6" fill="none" stroke="${P.deep}" stroke-width="0.35"/></svg>`;
  cache.set(c.id, svg);
  return svg;
}
