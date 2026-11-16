import type { Card } from '../engine';

// 화투 48장 그림 (자체 제작 SVG, 1차 버전). viewBox 40 x 62.
// 월마다 같은 식물을 깔고, 광·열끗·띠·피에 따라 해·새·띠 같은 표식을 얹는다.
// 기존 화투 인쇄본을 베끼지 않고 전통 소재(송학, 매조, 벚꽃 …)만 따라 그렸다.

const W = 40, H = 62;
const C = {
  red: '#c8283a', deepRed: '#8e1626', pink: '#ef8fae', white: '#fffdf7', black: '#1d1a1a',
  green: '#2f7a3c', dark: '#1f4d2a', yellow: '#f0b81f', blue: '#2453a6', purple: '#6a3f9a',
  brown: '#7a4a22', sky: '#e8433f', gold: '#f2c14e', grey: '#58606a',
};

const r = (n: number) => Math.round(n * 10) / 10;
function circle(x: number, y: number, rad: number, fill: string, extra = '') {
  return `<circle cx="${r(x)}" cy="${r(y)}" r="${r(rad)}" fill="${fill}" ${extra}/>`;
}
function blossom(x: number, y: number, rad: number, petal: string, center = C.yellow) {
  let s = '';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    s += circle(x + Math.cos(a) * rad * 0.62, y + Math.sin(a) * rad * 0.62, rad * 0.5, petal);
  }
  return s + circle(x, y, rad * 0.28, center);
}
function leaf(x: number, y: number, len: number, angle: number, fill: string) {
  return `<ellipse cx="0" cy="${r(-len / 2)}" rx="${r(len * 0.22)}" ry="${r(len / 2)}" fill="${fill}" transform="translate(${r(x)} ${r(y)}) rotate(${angle})"/>`;
}
function line(pts: [number, number][], stroke: string, w = 1.6) {
  return `<polyline points="${pts.map(([a, b]) => `${r(a)},${r(b)}`).join(' ')}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
}
function bird(x: number, y: number, s: number, body: string, wing: string, flip = false) {
  const t = `translate(${r(x)} ${r(y)}) scale(${flip ? -s : s} ${s})`;
  return `<g transform="${t}"><ellipse cx="0" cy="0" rx="6" ry="3.6" fill="${body}"/><path d="M-5 0 L-11 -2.5 L-10 2 Z" fill="${body}"/><path d="M-2 -1 Q1 -9 6 -7 Q4 -2 2 0 Z" fill="${wing}"/>${circle(5.2, -1.6, 2.4, body)}${circle(6, -2, 0.7, C.black)}<path d="M7.4 -1.6 L10 -1 L7.4 -0.6 Z" fill="${C.gold}"/></g>`;
}
function gwangBadge() {
  return `${circle(8, 8, 6, C.red, `stroke="${C.white}" stroke-width="1"`)}<text x="8" y="11" text-anchor="middle" font-size="8.5" font-weight="700" fill="${C.white}" font-family="serif">光</text>`;
}
function ribbon(kind: 'hong' | 'cheong' | 'cho' | 'plain') {
  const fill = kind === 'cheong' ? C.blue : C.red;
  const txt = kind === 'hong' ? '홍단' : kind === 'cheong' ? '청단' : '';
  return `<g transform="rotate(-10 20 20)"><rect x="14" y="4" width="12" height="32" fill="${fill}" stroke="${C.white}" stroke-width="0.8"/><path d="M14 36 L20 32 L26 36 L26 38 L14 38 Z" fill="${fill}"/>${txt ? `<text x="20" y="13" text-anchor="middle" font-size="6" font-weight="700" fill="${C.white}" writing-mode="tb" glyph-orientation-vertical="0" font-family="sans-serif">${txt}</text>` : ''}</g>`;
}
function doubleMark() {
  return `<rect x="27" y="51" width="11" height="8" rx="2" fill="${C.black}" opacity=".78"/><text x="32.5" y="57.4" text-anchor="middle" font-size="5.6" font-weight="700" fill="${C.gold}" font-family="sans-serif">쌍피</text>`;
}

/** 월별 바탕 식물. v = 같은 월 안에서 조금씩 다르게 놓기 위한 변형 번호. */
const PLANT: Record<number, (v: number) => string> = {
  1: (v) => { // 송학: 소나무
    let s = line([[6 + v * 3, 62], [14, 44], [24, 34], [34 - v * 2, 26]], C.brown, 2.4);
    for (const [x, y, k] of [[10, 46, 7], [22, 36, 8], [32 - v * 2, 27, 7], [16 + v * 4, 54, 6]] as const)
      s += `<path d="M${x - k} ${y} A${k} ${k * 0.7} 0 0 1 ${x + k} ${y} Z" fill="${C.dark}"/>` + line([[x - k * 0.6, y - 1], [x, y - k * 0.5], [x + k * 0.6, y - 1]], C.green, 0.8);
    return s;
  },
  2: (v) => { // 매조: 매화 가지
    let s = line([[4, 60], [14, 40 + v * 2], [22, 30], [36, 18]], C.brown, 2);
    for (const [x, y] of [[14, 40 + v * 2], [22, 30], [30, 24], [36, 18], [10, 50]] as const) s += blossom(x, y, 4, C.red, C.white);
    return s;
  },
  3: (v) => { // 벚꽃
    let s = '';
    for (const [x, y] of [[8, 30], [18, 24], [28, 30], [34, 20], [14, 38 + v * 2], [26, 40], [22, 14 + v * 3]] as const) s += blossom(x, y, 4.6, C.pink, C.red);
    return s;
  },
  4: (v) => { // 흑싸리: 늘어진 검은 꽃송이
    let s = line([[2, 6], [38, 10]], C.brown, 1.4);
    for (let i = 0; i < 4; i++) {
      const x = 7 + i * 9 + (v % 2) * 2;
      for (let j = 0; j < 5; j++) s += leaf(x + (j % 2 ? 1.4 : -1.4), 12 + j * 6, 6, j % 2 ? 160 : 200, C.black);
    }
    return s;
  },
  5: (v) => { // 난초(창포)
    let s = '';
    for (let i = 0; i < 5; i++) s += leaf(8 + i * 6, 62, 30 + (i % 2) * 6, -14 + i * 7, C.green);
    s += blossom(14 + v * 4, 26, 4.4, C.purple, C.yellow) + blossom(28, 32, 3.8, C.purple, C.yellow);
    return s;
  },
  6: (v) => { // 모란
    let s = leaf(10, 58, 18, -30, C.green) + leaf(30, 58, 18, 30, C.green) + leaf(20, 60, 16, 0, C.dark);
    s += circle(20, 36 - v * 2, 10, C.red) + circle(20, 36 - v * 2, 6.5, '#e2475a') + circle(20, 36 - v * 2, 3, C.yellow);
    return s;
  },
  7: (v) => { // 홍싸리
    let s = line([[4, 60], [18, 30], [36, 12 + v * 2]], C.brown, 1.4) + line([[30, 62], [22, 40], [6, 22]], C.brown, 1.2);
    for (let i = 0; i < 9; i++) s += leaf(6 + (i * 13) % 30, 18 + ((i * 7) % 36), 6, i * 40, i % 3 ? C.red : C.deepRed);
    return s;
  },
  8: (v) => { // 공산: 검은 언덕과 억새
    let s = `<path d="M0 ${36 + v * 2} Q20 ${22 + v * 2} 40 ${36 + v * 2} L40 62 L0 62 Z" fill="${C.black}"/>`;
    for (let i = 0; i < 6; i++) s += line([[5 + i * 6, 62], [7 + i * 6, 44 + (i % 2) * 3]], C.white, 0.6);
    return s;
  },
  9: (v) => { // 국화
    let s = leaf(12, 60, 16, -20, C.green) + leaf(28, 60, 16, 20, C.green);
    for (const [x, y, k] of [[20, 34 - v * 2, 8], [10, 20 + v, 5], [31, 22, 5]] as const) {
      for (let i = 0; i < 12; i++) s += leaf(x, y, k, i * 30, C.yellow);
      s += circle(x, y, k * 0.3, C.deepRed);
    }
    return s;
  },
  10: (v) => { // 단풍
    let s = line([[36, 2], [24, 24], [12, 62]], C.brown, 1.6);
    for (const [x, y] of [[28, 10], [16, 18 + v * 2], [30, 30], [12, 36], [24, 46], [8, 52]] as const)
      for (let i = 0; i < 5; i++) s += leaf(x, y, 6, i * 72, i % 2 ? C.red : '#d9442b');
    return s;
  },
  11: (v) => { // 오동: 큰 검은 잎
    let s = '';
    for (const [x, y, a] of [[12, 54, -25], [28, 54, 25], [20, 58, 0]] as const) s += leaf(x, y, 22, a, C.black);
    s += `<rect x="${17 + v}" y="10" width="6" height="16" rx="3" fill="${C.purple}"/>`;
    return s;
  },
  12: (v) => { // 비: 버드나무
    let s = '';
    for (let i = 0; i < 5; i++) s += line([[6 + i * 7, 0], [4 + i * 7 + v, 18], [8 + i * 7, 34]], C.green, 1.2);
    return s;
  },
};

/** 광·열끗·띠·특수 피에 얹는 표식. */
function feature(c: Card): string {
  const m = c.month;
  if (c.kind === 'T') return ribbon(c.tag === 'hong' || c.tag === 'cheong' || c.tag === 'cho' ? c.tag : 'plain');
  if (c.kind === 'G') {
    const g = gwangBadge();
    if (m === 1) return circle(28, 14, 8, C.sky) + bird(20, 46, 1.3, C.white, C.black) + `<rect x="25" y="42" width="2" height="5" fill="${C.red}"/>` + g;
    if (m === 3) return `<path d="M2 40 Q20 34 38 40 L38 62 L2 62 Z" fill="${C.red}"/><path d="M2 48 Q20 42 38 48 L38 54 Q20 48 2 54 Z" fill="${C.white}"/>` + g;
    if (m === 8) return `<rect x="0" y="0" width="40" height="40" fill="${C.sky}"/>` + circle(20, 22, 11, C.white) + g;
    if (m === 11) return bird(20, 30, 1.5, C.gold, C.red) + leaf(10, 34, 14, -60, C.purple) + g;
    if (m === 12) return `<path d="M14 20 Q22 10 30 20 Z" fill="${C.red}"/>${line([[22, 20], [22, 40]], C.black, 1.2)}${circle(22, 26, 3.4, C.black)}<rect x="18" y="29" width="8" height="12" rx="2" fill="${C.yellow}"/>${circle(10, 54, 3.4, C.green)}` + g;
  }
  if (c.kind === 'Y') {
    if (m === 2) return bird(22, 22, 1.1, '#9aa63a', '#6b7a25');
    if (m === 4) return bird(22, 36, 1.1, C.black, C.grey, true);
    if (m === 5) return line([[2, 52], [14, 46], [26, 52], [38, 46]], C.brown, 3);
    if (m === 7) return `<ellipse cx="20" cy="50" rx="11" ry="6" fill="${C.brown}"/>${circle(30, 47, 3.6, C.brown)}${circle(31.5, 46, 0.7, C.black)}`;
    if (m === 8) return [8, 18, 28].map((x, i) => line([[x - 4, 10 + i * 5], [x, 14 + i * 5], [x + 4, 10 + i * 5]], C.black, 1.4)).join('');
    if (m === 9) return `<path d="M10 40 L30 40 L26 52 L14 52 Z" fill="${C.red}"/><text x="20" y="49" text-anchor="middle" font-size="7" fill="${C.gold}" font-family="serif">壽</text>`;
    if (m === 10) return `<ellipse cx="20" cy="46" rx="9" ry="5" fill="${C.brown}"/>${circle(29, 40, 3.4, C.brown)}${line([[28, 37], [26, 31], [24, 30]], C.brown, 1)}${line([[30, 37], [32, 31], [34, 30]], C.brown, 1)}${line([[14, 50], [13, 58]], C.brown, 1.4)}${line([[25, 50], [26, 58]], C.brown, 1.4)}`;
    if (m === 12) return bird(20, 30, 1.1, C.black, C.blue);
  }
  if (c.kind === 'D' && m === 12) return `<rect x="0" y="0" width="40" height="62" fill="${C.black}" opacity=".85"/>${line([[26, 4], [18, 26], [26, 26], [14, 52]], C.yellow, 2.2)}`;
  if (c.kind === 'D' && m === 11) return `<rect x="0" y="40" width="40" height="22" fill="${C.yellow}" opacity=".55"/>`;
  return '';
}

function butterflies() {
  const b = (x: number, y: number, col: string) => `<g transform="translate(${x} ${y})"><ellipse cx="-3" cy="-2" rx="3.4" ry="2.4" fill="${col}"/><ellipse cx="3" cy="-2" rx="3.4" ry="2.4" fill="${col}"/><ellipse cx="-2.4" cy="2" rx="2.2" ry="1.8" fill="${col}"/><ellipse cx="2.4" cy="2" rx="2.2" ry="1.8" fill="${col}"/><rect x="-0.5" y="-3" width="1" height="6" fill="${C.black}"/></g>`;
  return b(10, 12, C.blue) + b(30, 16, C.yellow);
}

const cache = new Map<string, string>();
export function cardArt(c: Card): string {
  const hit = cache.get(c.id);
  if (hit) return hit;
  const v = Number(c.id.slice(-1)) + (c.kind === 'P' ? 1 : 0);
  const extra = c.kind === 'Y' && c.month === 6 ? butterflies() : '';
  // 광/특수 배경이 식물보다 먼저 깔려야 하는 카드
  const bgFirst = (c.kind === 'G' && c.month === 8) || (c.kind === 'D' && c.month === 12);
  const plant = PLANT[c.month](v % 3);
  const feat = feature(c);
  const body = bgFirst ? feat + (c.month === 8 ? plant : '') : plant + extra + feat;
  const svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" preserveAspectRatio="xMidYMid slice"><rect width="${W}" height="${H}" fill="${C.white}"/>${body}${c.kind === 'D' ? doubleMark() : ''}</svg>`;
  cache.set(c.id, svg);
  return svg;
}
