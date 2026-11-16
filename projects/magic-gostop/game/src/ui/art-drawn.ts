import type { Card } from '../engine';

// 화투 48장 그림 v3 — 한국 화투(고스톱) 양식.
// 참고: 사용자가 준 한국 화투 일람(위키미디어 "Hwatu overview.svg", Marcus Richert, Louie Mantia Jr. 원작 기반, CC BY-SA 4.0)의
// 구도와 색 체계(빨강·검정·흰색·노랑·파랑 다섯 색, 빨간 테두리, 光 표시)를 따라 새로 그렸다.
// 이 그림은 그 작품을 참고한 2차 저작이므로 같은 CC BY-SA 4.0으로 두고 출처를 화면에 표시한다.

const W = 40, H = 62;
const C = {
  red: '#e0251b', deep: '#a8140f', black: '#111111', white: '#ffffff', yellow: '#f3c316', gold: '#d9a514',
  blue: '#2a66c9', sky: '#7fb1ec', pink: '#f7b3ab',
};
const K = C.black;

const f = (n: number) => Math.round(n * 100) / 100;
const st = (w: number) => (w ? `stroke="${K}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"` : '');
const circ = (x: number, y: number, r: number, fill: string, w = 0.4) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${fill}" ${st(w)}/>`;
const path = (d: string, fill: string, w = 0.4) => `<path d="${d}" fill="${fill}" ${st(w)}/>`;
const line = (d: string, color: string, w: number) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const g = (t: string, body: string) => `<g transform="${t}">${body}</g>`;
const rect = (x: number, y: number, w: number, h: number, fill: string) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;

// ---------- 공통 소재 ----------
function petalFlower(x: number, y: number, r: number, petal: string, center: string, n = 5, w = 0.35) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    s += circ(x + Math.cos(a) * r * 0.56, y + Math.sin(a) * r * 0.56, r * 0.5, petal, w);
  }
  return s + circ(x, y, r * 0.26, center, 0);
}
function leaf(x: number, y: number, len: number, wid: number, angle: number, fill: string, w = 0.3) {
  return g(`translate(${f(x)} ${f(y)}) rotate(${f(angle)})`,
    path(`M0 0 C${f(wid)} ${f(-len * 0.3)} ${f(wid * 0.6)} ${f(-len * 0.8)} 0 ${f(-len)} C${f(-wid * 0.6)} ${f(-len * 0.8)} ${f(-wid)} ${f(-len * 0.3)} 0 0 Z`, fill, w));
}
function star(x: number, y: number, r: number, fill: string, rot = 0, points = 5, inner = 0.42) {
  let d = '';
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2 + (rot * Math.PI) / 180;
    const rr = i % 2 ? r * inner : r;
    d += `${i ? 'L' : 'M'}${f(x + Math.cos(a) * rr)} ${f(y + Math.sin(a) * rr)} `;
  }
  return path(d + 'Z', fill, 0.3);
}
/** 아래쪽 검은 언덕(둥근 능선) */
function blackHill(top: number, fill = C.black) {
  return path(`M-1 ${top + 4} C10 ${top - 3} 26 ${top - 3} 41 ${top + 2} L41 63 L-1 63 Z`, fill, 0);
}
/** 光 표시 (빨간 원 + 흰 글자) */
function gwang(x: number, y: number) {
  return circ(x, y, 4.4, C.red, 0.5) + circ(x, y, 3.6, 'none', 0) + `<text x="${x}" y="${f(y + 2.5)}" text-anchor="middle" font-size="6.6" font-weight="700" fill="${C.white}" font-family="'Noto Serif KR','Nanum Myeongjo',serif">光</text>`;
}
/** 띠: 홍단·청단은 글씨, 초단은 글씨 없음 */
function ribbon(kind: 'hong' | 'cheong' | 'cho', x: number, y: number, rot: number) {
  const fill = kind === 'cheong' ? C.blue : C.red;
  const label = kind === 'hong' ? '홍단' : kind === 'cheong' ? '청단' : '';
  return g(`translate(${x} ${y}) rotate(${rot})`,
    path('M-5.2 0 L5.2 0 L5.2 28 L0 25 L-5.2 28 Z', fill, 0.5)
    + (label ? `<text x="0.2" y="5.4" font-size="4.8" font-weight="700" fill="${C.black}" text-anchor="middle" writing-mode="tb" font-family="'Noto Serif KR','Nanum Myeongjo',serif" letter-spacing="1.2">${label}</text>` : ''));
}

// ---------- 월별 소재 ----------
/** 1월 소나무: 검은 산봉우리 모양 솔잎 덩어리 + 끝의 노란 점 */
function pineRidge() {
  const d = 'M-1 63 L-1 26 C3 20 5 14 8 12 C10 16 11 22 13 24 C15 18 18 10 21 7 C23 12 24 20 26 23 C28 18 31 14 34 12 C36 16 38 20 41 22 L41 63 Z';
  const tips: [number, number][] = [[8, 12.5], [21, 7.5], [34, 12.5], [13, 24], [26, 23]];
  return path(d, C.black, 0) + tips.map(([x, y]) => circ(x, y, 1, C.yellow, 0)).join('')
    + line('M4 30 L8 26 L12 31 M17 22 L21 18 L25 23 M30 26 L34 22 L38 27', '#2b2b2b', 0.5);
}
function crane() {
  return path('M14 44 C12 34 18 28 26 30 C31 31 32 37 29 42 C26 46 18 47 14 44 Z', C.white, 0.5) // 몸
    + path('M14 44 L9 48 L13 41 Z', C.black, 0.4)
    + path('M18 36 C20 31 25 30 28 33 C25 34 21 35 18 36 Z', C.black, 0.3) // 날개깃
    + line('M27 31 C29 25 27 21 29 16', K, 1.8) + line('M27 31 C29 25 27 21 29 16', C.white, 1) // 목
    + circ(29.3, 15.4, 1.8, C.white, 0.45) + circ(29.4, 14.4, 0.85, C.red, 0)
    + path('M30.8 15.4 L34.4 16.4 L30.8 16.6 Z', C.yellow, 0.3)
    + line('M19 46 L18 53 M23 46 L24 53', K, 0.6);
}
function plumBranch() {
  return line('M2 62 C8 52 14 44 20 36 C25 30 30 22 38 14', K, 2.2) + line('M18 39 C13 34 9 30 3 28', K, 1.3) + line('M28 25 C30 18 29 12 32 6', K, 1.1);
}
function plums(pts: [number, number, number][]) {
  return pts.map(([x, y, r]) => petalFlower(x, y, r, C.red, C.yellow)).join('');
}
function warbler() {
  return g('translate(19 18) scale(1.05)',
    path('M-7 1 C-6 -4 3 -6 7 -2 C8 1 5 4 -1 4 C-4 4 -7 3 -7 1 Z', '#4fa36d', 0.45)
    + path('M-1 2.5 C2 4.5 5 3 6 0 C4 2 1 2.6 -1 2.5 Z', C.yellow, 0)
    + path('M-6.5 1 L-12 -1 L-11 3 Z', '#2f7a50', 0.4)
    + path('M-3 -1 C-1 -7 4 -8 6 -6 C4 -3 1 -1.5 -3 -1 Z', C.blue, 0.4)
    + circ(4.6, -1.5, 0.6, K, 0) + path('M6.6 -1.3 L9 -0.8 L6.6 -0.2 Z', C.yellow, 0.3));
}
function cherries(pts: [number, number, number][]) {
  return pts.map(([x, y, r]) => petalFlower(x, y, r, C.red, C.pink, 5, 0.3) + circ(x, y, r * 0.18, C.white, 0)).join('');
}
function curtain() {
  let s = path('M-1 34 C10 31 30 31 41 34 L41 63 L-1 63 Z', C.white, 0.5);
  s += path('M-1 34 C10 31 30 31 41 34 L41 38 C30 35 10 35 -1 38 Z', C.red, 0.3);
  for (let i = 0; i < 5; i++) s += line(`M${3 + i * 8.5} 37 C${5 + i * 8.5} 41 ${1 + i * 8.5} 45 ${4 + i * 8.5} 49`, C.red, 0.9);
  s += blackHill(49);
  return s;
}
/** 4월 흑싸리: 위에서 늘어진 검은 점 사슬 */
function wisteria(cols: number[], top = 6, bottom = 54) {
  let s = '';
  cols.forEach((x, k) => {
    for (let y = top + (k % 2) * 2; y < bottom; y += 3.2) {
      const dx = Math.sin((y + k * 7) / 5) * 1.6;
      s += path(`M${f(x + dx - 1.3)} ${f(y)} C${f(x + dx - 1.3)} ${f(y + 1.6)} ${f(x + dx + 1.3)} ${f(y + 1.6)} ${f(x + dx + 1.3)} ${f(y)} C${f(x + dx + 0.6)} ${f(y - 0.8)} ${f(x + dx - 0.6)} ${f(y - 0.8)} ${f(x + dx - 1.3)} ${f(y)} Z`, C.black, 0);
    }
  });
  return s;
}
function cuckoo() {
  return g('translate(21 12) scale(1.1)',
    path('M-8 1 C-4 -3 4 -3 8 0 C4 2 -2 3 -8 1 Z', C.yellow, 0.45)
    + path('M-2 -1 C0 -8 6 -9 9 -8 C6 -5 3 -2 -2 -1 Z', C.gold, 0.4)
    + path('M-7 1 L-12 4 L-11 -1 Z', C.yellow, 0.4)
    + path('M5 -1 C7 -2 9 -1 9 0 C7 1 6 1 5 -1 Z', C.red, 0) + circ(6.4, -0.6, 0.45, K, 0));
}
function irises(xs: [number, number][]) {
  return xs.map(([x, y]) => leaf(x, y, 6.5, 2.8, -42, C.blue, 0.35) + leaf(x, y, 6.5, 2.8, 42, C.blue, 0.35) + leaf(x, y, 7.5, 2.6, 180, C.sky, 0.35) + leaf(x, y, 5, 1.6, 0, C.blue, 0.3) + circ(x, y + 1, 0.9, C.yellow, 0)).join('');
}
function swordLeaves() {
  let s = '';
  for (let i = 0; i < 9; i++) s += leaf(1 + i * 4.8, 63, 22 + ((i * 7) % 4) * 4, 1.9, -18 + i * 4.5, C.black, 0);
  return s + line('M8 63 L10 52 M30 63 L29 50', C.yellow, 0.6);
}
function bridge() {
  let s = '';
  const planks: [number, number, number][] = [[-2, 46, -16], [10, 42, 14], [22, 46, -16], [32, 42, 14]];
  for (const [x, y, r] of planks) s += g(`translate(${x} ${y}) rotate(${r})`, `<rect x="0" y="0" width="13" height="4.4" fill="${C.yellow}" ${st(0.45)}/>` + line('M3.2 0 L3.2 4.4 M6.5 0 L6.5 4.4 M9.8 0 L9.8 4.4', K, 0.3));
  return s;
}
function peony(x: number, y: number, r: number) {
  let s = '';
  for (let i = 0; i < 8; i++) s += leaf(x, y, r, r * 0.6, i * 45, C.red, 0.35);
  for (let i = 0; i < 5; i++) s += leaf(x, y, r * 0.6, r * 0.42, i * 72 + 36, C.deep, 0.25);
  return s + circ(x, y, r * 0.22, C.yellow, 0.3);
}
function peonyLeaves(pts: [number, number, number][]) {
  return pts.map(([x, y, a]) => leaf(x, y, 11, 6, a, C.black, 0) + leaf(x, y, 8, 3.6, a + 40, C.black, 0)).join('');
}
function butterflies() {
  const b = (x: number, y: number, s: number, r: number) => g(`translate(${x} ${y}) rotate(${r}) scale(${s})`,
    leaf(0, 0, 6, 3.4, -55, C.yellow, 0.4) + leaf(0, 0, 6, 3.4, 55, C.yellow, 0.4) + leaf(0, 0, 4, 2.4, -140, C.gold, 0.4) + leaf(0, 0, 4, 2.4, 140, C.gold, 0.4)
    + circ(-2.4, -2.8, 0.7, C.red, 0) + circ(2.4, -2.8, 0.7, C.red, 0) + line('M0 1.5 L0 -3', K, 0.9));
  return b(10, 50, 1.1, -20) + b(28, 54, 0.95, 15);
}
/** 7월 홍싸리: 검은 가는 줄기 + 빨간 잎 */
function clover(stems: string[], pts: [number, number][]) {
  return stems.map((d) => line(d, C.black, 0.8)).join('')
    + pts.map(([x, y], i) => leaf(x, y, 3.6, 1.5, i * 53, i % 4 ? C.red : C.pink, 0.2)).join('');
}
const CLOVER_STEMS = ['M4 63 C8 44 16 28 34 6', 'M14 63 C16 46 24 34 38 26', 'M28 63 C24 50 16 40 4 30', 'M20 63 C20 46 18 30 12 8'];
const CLOVER_PTS: [number, number][] = [[9, 42], [12, 34], [16, 27], [21, 20], [26, 14], [31, 9], [19, 46], [24, 38], [30, 32], [35, 28], [22, 52], [14, 44], [8, 36], [5, 31], [17, 30], [15, 20], [13, 12], [27, 22], [33, 16]];
function boar() {
  return g('translate(19 46)',
    path('M-12 2 C-12 -6 -2 -10 6 -7 C11 -6 14 -2 14 1 C14 3 12 4 9 4 L-9 5 C-11 5 -12 4 -12 2 Z', C.yellow, 0.55)
    + path('M6 -7 C9 -10 11 -9 12 -7 Z', C.gold, 0.4)
    + path('M11 -3 C13 -3 15 -1 14 1 L11 1 Z', C.gold, 0.4)
    + circ(9.4, -3.6, 0.6, K, 0)
    + line('M-8 -4 C-4 -7 1 -8 5 -6 M-6 0 C-2 -2 2 -2 6 0', K, 0.5)
    + line('M-8 5 L-9 10 M-4 5 L-4 10 M3 5 L3 10 M8 4 L9 9', K, 0.9));
}
function moon() { return circ(20, 18, 10.5, C.white, 0.5); }
function geese() {
  const one = (x: number, y: number, s: number) => g(`translate(${x} ${y}) scale(${s})`,
    path('M-6 0 C-3 -1 0 -1 3 0 L8 -5 L5 1 L8 4 L2 2 C-1 2 -4 1 -6 0 Z', C.yellow, 0.35) + circ(-6.3, -0.4, 1, C.red, 0.2));
  return one(12, 10, 0.95) + one(25, 17, 1.05) + one(32, 7, 0.8);
}
function chrysanthemum(x: number, y: number, r: number) {
  let s = '';
  for (let i = 0; i < 14; i++) s += leaf(x, y, r, r * 0.26, (i * 360) / 14, i % 2 ? C.red : C.yellow, 0.25);
  return s + circ(x, y, r * 0.32, C.yellow, 0.3) + circ(x, y, r * 0.14, C.red, 0);
}
function blackBlobs(pts: [number, number, number, number][]) {
  return pts.map(([x, y, r, a]) => g(`translate(${x} ${y}) rotate(${a})`, path(`M${-r} 0 C${-r} ${-r * 0.9} ${-r * 0.3} ${-r * 1.1} 0 ${-r * 0.6} C${r * 0.3} ${-r * 1.1} ${r} ${-r * 0.9} ${r} 0 C${r} ${r * 0.8} ${-r} ${r * 0.8} ${-r} 0 Z`, C.black, 0))).join('');
}
function sakeCup() {
  return path('M8 40 C8 49 32 49 32 40 Z', C.red, 0.6) + path('M7 39 L33 39 L32 41.4 L8 41.4 Z', C.deep, 0.4)
    + path('M15 47.5 L25 47.5 L27 53 L13 53 Z', C.red, 0.5)
    + `<text x="20" y="46" text-anchor="middle" font-size="5.6" font-weight="700" fill="${C.yellow}" font-family="'Noto Serif KR',serif">壽</text>`;
}
function mapleLeaves(pts: [number, number, number, string][]) {
  return pts.map(([x, y, r, c], i) => star(x, y, r, c, i * 17, 5, 0.45)).join('');
}
function deer() {
  return g('translate(19 44)',
    path('M-9 2 C-9 -3 -2 -5 4 -4 C7 -4 8 -2 8 0 C8 3 4 4 -4 4 C-7 4 -9 3 -9 2 Z', C.yellow, 0.55)
    + path('M4 -4 C5 -8 6 -11 8 -12 C10 -12 11 -10 10 -9 C9 -8 8 -6 7 -3 Z', C.yellow, 0.45)
    + circ(9, -10.6, 0.5, K, 0)
    + line('M8 -12 L7 -16 L5 -18 M7 -16 L9 -18 M9 -12 L11 -15 L13 -16 M11 -15 L11 -17', K, 0.6)
    + [-6, -2, 2, 6].map((dx) => line(`M${dx} 3.5 L${dx + (dx > 0 ? 0.5 : -0.5)} 12`, K, 0.8)).join('')
    + [[-5, -1], [-1, -2], [2, 0], [-4, 2]].map(([a, b]) => circ(a, b, 0.6, C.white, 0)).join(''));
}
/** 11월 오동: 큰 검은 잎 + 파란 꽃송이 */
function paulowniaLeaves(top: number) {
  return path(`M-1 ${top + 6} C4 ${top - 4} 12 ${top - 2} 14 ${top + 3} C17 ${top - 5} 25 ${top - 5} 27 ${top + 2} C30 ${top - 3} 38 ${top - 2} 41 ${top + 5} L41 ${top + 22} C30 ${top + 26} 10 ${top + 26} -1 ${top + 22} Z`, C.black, 0)
    + line(`M14 ${top + 3} L14 ${top + 18} M27 ${top + 2} L27 ${top + 18}`, '#3a3a3a', 0.6);
}
function blueSpray(x: number, y: number) {
  let s = line(`M${x} ${y} L${x} ${y + 16}`, K, 0.6);
  for (let i = 0; i < 6; i++) s += circ(x + (i % 2 ? 2 : -2), y + 1 + i * 2.6, 1.7, i % 3 ? C.blue : C.sky, 0.3);
  return s;
}
function phoenixHead() {
  return path('M6 52 C4 38 10 26 20 22 C26 20 30 22 31 27 C27 26 24 28 23 32 C30 33 34 38 33 45 C30 42 26 41 22 43 C24 47 22 52 18 54 Z', C.black, 0.4)
    + path('M20 22 C22 14 28 10 33 11 C30 14 28 18 27 21 Z', C.red, 0.4) // 볏
    + path('M31 26 L37 27 L31 29 Z', C.yellow, 0.4)
    + circ(27.4, 25.6, 1.2, C.white, 0.3) + circ(27.6, 25.6, 0.5, K, 0)
    + path('M12 40 C16 34 22 34 24 38 C20 38 16 40 12 44 Z', C.red, 0.3)
    + path('M10 48 C14 43 20 43 22 46 C18 46 14 48 10 52 Z', C.yellow, 0.3);
}
function willow(xs: number[]) {
  return xs.map((x, i) => line(`M${x} -1 C${x - 3} 14 ${x + 3} 26 ${x - 1 + (i % 2) * 3} 44`, C.black, 1.3)).join('');
}
function umbrellaMan() {
  return path('M3 22 C8 9 26 9 31 22 Z', C.red, 0.5) + line('M17 11 L17 22 M8 22 L15 12 M26 22 L19 12', K, 0.35)
    + line('M17 22 L19 34', K, 0.7)
    + circ(20.5, 26, 2.6, C.white, 0.45) + path('M17.8 25 C18.6 22.6 22.4 22.6 23.2 25 Z', C.black, 0.3)
    + path('M14 29 C16 27 25 27 26 30 L29 50 L11 50 Z', C.blue, 0.5)
    + path('M17 30 L23 30 L24 49 L16 49 Z', C.white, 0.35)
    + line('M19 31 L19 48', C.blue, 0.4)
    + path('M8 52 C14 50 26 50 34 52 L34 56 L8 56 Z', C.yellow, 0.35)
    + g('translate(6 47)', path('M-3.6 2 C-3.6 -2 3.6 -2 3.6 2 Z', C.yellow, 0.35) + circ(-1.6, -0.9, 0.8, C.yellow, 0.25) + circ(1.6, -0.9, 0.8, C.yellow, 0.25));
}
function swallow() {
  return g('translate(19 32) scale(1.15)',
    path('M-8 -2 C-3 -6 4 -5 7 -1 C4 1 0 2 -4 1 L-11 6 L-7 0 Z', C.black, 0.4)
    + path('M-2 -3 C-1 -10 5 -12 9 -11 C5 -8 2 -5 0 -2 Z', C.black, 0.3)
    + path('M3 -1 C5 0 7 0 7 -1 C5 1 3 1 3 -1 Z', C.red, 0)
    + path('M-1 0 C1 1 3 1 4 0 C3 2 0 2 -1 0 Z', C.yellow, 0)
    + circ(5, -2.4, 0.45, C.white, 0));
}
function thunderDrum() {
  // 비 쌍피: 빨간 바탕, 검은 먹구름, 노란 번개, 아래 북
  return rect(0, 0, 40, 62, C.red)
    + path('M-1 -1 L41 -1 L41 16 C34 22 26 14 20 19 C14 24 6 16 -1 22 Z', C.black, 0)
    + path('M23 14 L14 32 L21 32 L12 50 L29 27 L22 27 L30 14 Z', C.yellow, 0.5)
    + path('M-1 46 C10 42 30 42 41 46 L41 63 L-1 63 Z', C.black, 0)
    + circ(10, 54, 4.2, C.red, 0.4) + circ(10, 54, 1.8, C.yellow, 0) + circ(30, 54, 4.2, C.red, 0.4) + circ(30, 54, 1.8, C.yellow, 0);
}

// ---------- 카드별 구성 ----------
type Draw = (c: Card, n: number) => string;
const MONTHS: Record<number, Draw> = {
  1: (c) => c.kind === 'G'
    ? circ(7, 9, 11, C.red, 0) + blackHill(48) + crane() + gwang(33, 54)
    : pineRidge() + (c.kind === 'T' ? ribbon('hong', 15, 6, -24) : ''),
  2: (c, n) => {
    if (c.kind === 'Y') return plumBranch() + plums([[30, 34, 4.4], [34, 46, 4], [9, 50, 3.8]]) + warbler();
    const pts: [number, number, number][] = n ? [[22, 12, 4.6], [33, 18, 4.4], [12, 22, 4.2], [24, 30, 5], [10, 40, 4.4], [30, 44, 4.4]] : [[10, 10, 4.4], [24, 14, 4.8], [34, 26, 4.4], [16, 28, 5], [26, 40, 4.6], [10, 48, 4.2]];
    return plumBranch() + plums(pts) + (c.kind === 'T' ? ribbon('hong', 14, 6, -12) : '');
  },
  3: (c, n) => {
    const top: [number, number, number][] = [[6, 8, 5], [17, 6, 5.5], [29, 8, 5.2], [36, 18, 4.4], [11, 18, 5], [23, 18, 5.6], [4, 28, 4.4], [30, 28, 4.6]];
    const more: [number, number, number][] = [[16, 30, 5], [8, 40, 4.6], [24, 42, 5], [34, 38, 4.4], [16, 52, 4.6], [30, 52, 4.4]];
    if (c.kind === 'G') return cherries(top) + curtain() + gwang(7, 55);
    return line('M4 63 C10 46 14 34 24 20 M18 40 C26 36 32 30 38 24', K, 1.8) + cherries(n ? top.concat(more.slice(0, 4)) : top.concat(more))
      + (c.kind === 'T' ? ribbon('hong', 21, 22, -8) : '');
  },
  4: (c, n) => {
    const cols = c.kind === 'P' ? (n ? [6, 13, 20, 27, 34] : [5, 12, 19, 26, 33]) : [5, 13, 27, 35];
    const base = wisteria(cols, c.kind === 'Y' ? 22 : 6) + line('M-1 4 C12 7 26 3 41 6', K, 1);
    return base + (c.kind === 'Y' ? cuckoo() : c.kind === 'T' ? ribbon('cho', 20, 10, -6) : '');
  },
  5: (c, n) => {
    if (c.kind === 'Y') return irises([[12, 16], [26, 10]]) + swordLeaves() + bridge();
    return irises(n ? [[12, 18], [26, 24], [18, 34]] : [[10, 22], [24, 16], [30, 32]]) + swordLeaves() + (c.kind === 'T' ? ribbon('cho', 14, 4, -18) : '');
  },
  6: (c, n) => {
    if (c.kind === 'Y') return peonyLeaves([[8, 30, -30], [32, 28, 30], [20, 40, 0]]) + peony(20, 20, 9) + butterflies();
    const leaves = peonyLeaves([[6, 56, -25], [34, 56, 25], [20, 62, 0], [8, 30, -40], [32, 32, 40]]);
    return leaves + (n ? peony(20, 22, 9) + peony(14, 44, 7) : peony(22, 18, 8) + peony(14, 40, 8) + peony(30, 48, 6))
      + (c.kind === 'T' ? ribbon('cheong', 18, 6, -10) : '');
  },
  7: (c) => {
    if (c.kind === 'Y') return clover(CLOVER_STEMS.slice(0, 2), CLOVER_PTS.slice(0, 12)) + boar();
    return clover(CLOVER_STEMS, CLOVER_PTS) + (c.kind === 'T' ? ribbon('cho', 19, 5, -14) : '');
  },
  8: (c, n) => {
    if (c.kind === 'G') return rect(0, 0, 40, 62, C.red) + moon() + blackHill(36) + gwang(8, 52);
    if (c.kind === 'Y') return geese() + blackHill(32);
    return blackHill(n ? 30 : 34);
  },
  9: (c, n) => {
    const leaves = blackBlobs([[8, 36, 7, -20], [30, 30, 7, 25], [20, 54, 8, 0], [34, 52, 6, 30]]);
    if (c.kind === 'Y') return leaves + chrysanthemum(12, 14, 7) + chrysanthemum(30, 12, 5.5) + sakeCup();
    return leaves + (n ? chrysanthemum(14, 18, 7.5) + chrysanthemum(28, 40, 7) : chrysanthemum(24, 14, 7) + chrysanthemum(12, 30, 6) + chrysanthemum(26, 44, 7))
      + (c.kind === 'T' ? ribbon('cheong', 18, 8, -14) : '');
  },
  10: (c, n) => {
    const pts: [number, number, number, string][] = n
      ? [[10, 8, 6, C.red], [28, 12, 7, C.black], [16, 26, 7, C.red], [32, 34, 6, C.red], [8, 42, 6, C.black], [24, 50, 7, C.red]]
      : [[28, 8, 7, C.red], [10, 14, 6, C.black], [22, 26, 7, C.red], [8, 34, 6, C.red], [32, 40, 6, C.black], [16, 52, 7, C.red]];
    if (c.kind === 'Y') return mapleLeaves([[30, 8, 7, C.red], [10, 10, 6, C.black], [34, 24, 6, C.red], [6, 24, 5, C.red]]) + deer();
    return mapleLeaves(pts) + (c.kind === 'T' ? ribbon('cheong', 20, 14, 8) : '');
  },
  11: (c, n) => {
    if (c.kind === 'G') return rect(0, 0, 40, 62, C.white) + phoenixHead() + gwang(33, 55);
    if (c.kind === 'D') return blueSpray(12, 8) + blueSpray(26, 6) + paulowniaLeaves(24) + rect(0, 50, 40, 12, C.red);
    return blueSpray(n ? 14 : 22, 6) + blueSpray(n ? 28 : 10, 10) + paulowniaLeaves(n ? 30 : 26);
  },
  12: (c) => {
    if (c.kind === 'D') return thunderDrum();
    if (c.kind === 'G') return willow([33, 38]) + umbrellaMan() + gwang(7, 7);
    if (c.kind === 'Y') return willow([5, 12, 30, 36]) + swallow();
    return willow([4, 10, 28, 34]) + ribbon('cho', 20, 10, -6);
  },
};

const cache = new Map<string, string>();
export function cardArt(c: Card): string {
  const hit = cache.get(c.id);
  if (hit) return hit;
  const n = Number(c.id.slice(-1));
  const inner = `<rect width="${W}" height="${H}" fill="${C.white}"/>${MONTHS[c.month](c, n)}`
    + (c.kind === 'D' && c.month !== 12 ? '' : '');
  // 빨간 테두리 안에 그림 (그림 영역을 테두리 안쪽으로 줄여서 배치)
  const inset = 2, iw = W - inset * 2, ih = H - inset * 2;
  const clip = `clip-${c.id}`;
  const svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" preserveAspectRatio="xMidYMid slice">`
    + `<clipPath id="${clip}"><rect x="${inset}" y="${inset}" width="${iw}" height="${ih}" rx="1.4"/></clipPath>`
    + `<rect width="${W}" height="${H}" rx="2.6" fill="${C.red}"/>`
    + `<g clip-path="url(#${clip})"><g transform="translate(${inset} ${inset}) scale(${f(iw / W)} ${f(ih / H)})">${inner}</g></g></svg>`;
  cache.set(c.id, svg);
  return svg;
}

/** 그림 출처 표시 문구 (화면 '구성 보기'에 넣는다) */
export const ART_CREDIT = '화투 그림: 위키미디어 "Hwatu overview"(Marcus Richert, Louie Mantia, Jr. 원작 기반, CC BY-SA 4.0)를 참고해 새로 그림 · 그림은 CC BY-SA 4.0';
