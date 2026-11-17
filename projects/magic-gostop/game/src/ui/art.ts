import type { Card } from '../engine';
import { HWATU_SVG } from './hwatu-data';

// 화투 그림: 사용자가 제공한 한국 화투 일러스트(.ai, 디자인메카)를 벡터 그대로 카드별 SVG로 변환해 쓴다.
// 변환 도구: scripts/hwatu/ (ai2svg.py → split_cards.py). 예전 직접 그린 그림은 art-drawn.ts에 보관.
// .ai에 없는 카드와 사용자가 다시 그려 달라고 한 카드 (같은 틀: 153 x 238, 빨간 테두리 + 검은 안쪽 선)
const FRAME_OPEN = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 153 238"><rect width="153" height="238" rx="9" fill="#ff0000"/>';
const FRAME_CLOSE = '<rect x="7" y="7" width="139" height="224" rx="8" fill="none" stroke="#000" stroke-width="2.4"/></svg>';
const clipInner = (id: string, body: string) =>
  `<clipPath id="${id}"><rect x="7" y="7" width="139" height="224" rx="8"/></clipPath><g clip-path="url(#${id})">${body}</g>`;

// 12월 쌍피: 먹구름 + 번개 + 북
const RAIN_DOUBLE = FRAME_OPEN + clipInner('c12d', `
  <rect x="0" y="0" width="153" height="238" fill="#ff0000"/>
  <path d="M0 0 H153 V78 C134 92 118 70 100 82 C84 94 66 72 50 86 C34 98 16 80 0 92 Z" fill="#000"/>
  <path d="M10 60 C22 50 32 56 40 48 M60 66 C72 54 84 62 94 52 M112 60 C122 50 134 56 144 46" fill="none" stroke="#fff" stroke-width="2"/>
  <path d="M86 70 L52 130 L76 130 L44 196 L108 116 L82 116 L112 70 Z" fill="#ffd400" stroke="#000" stroke-width="2.4" stroke-linejoin="round"/>
  <path d="M0 176 C40 164 112 164 153 176 V238 H0 Z" fill="#000"/>
  <g transform="translate(40 194)"><circle r="22" fill="#ff0000" stroke="#000" stroke-width="2.4"/><circle r="15" fill="#fff" stroke="#000" stroke-width="1.6"/>
    <path d="M0 -15 A7.5 7.5 0 0 1 0 0 A7.5 7.5 0 0 0 0 15 A15 15 0 0 1 0 -15 Z" fill="#000"/><circle cx="0" cy="-7.5" r="2.4" fill="#fff"/><circle cx="0" cy="7.5" r="2.4" fill="#000"/></g>
  <g transform="translate(112 200)"><circle r="18" fill="#ff0000" stroke="#000" stroke-width="2.4"/><circle r="11" fill="#ffd400" stroke="#000" stroke-width="1.6"/></g>
`) + FRAME_CLOSE;

/** 보너스 패: 화투 그림과 같은 결(빨강·검정·노랑·파랑, 굵은 검은 외곽선). 2피 = 복주머니, 3피 = 엽전 꾸러미 */
const K = 'stroke="#000" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"';
function cloud(x: number, y: number, s: number) {
  return `<g transform="translate(${x} ${y}) scale(${s})" fill="none" stroke="#ff0000" stroke-width="2.4" stroke-linecap="round" opacity=".5">
    <path d="M-22 6 C-26 -6 -12 -12 -6 -4 C-4 -14 12 -14 12 -2 C20 -8 30 0 22 8 Z"/><path d="M-8 2 C-6 -2 0 -2 2 2"/></g>`;
}
function medal(n: number, label: string) {
  return `<g transform="translate(112 196)"><circle r="23" fill="#ffd400" ${K}/><circle r="17" fill="none" stroke="#ff0000" stroke-width="2"/>
    <text y="10" text-anchor="middle" font-size="30" font-weight="900" fill="#ff0000" stroke="#000" stroke-width="1.2" font-family="'Black Han Sans',sans-serif">${n}</text></g>
    <text x="44" y="208" text-anchor="middle" font-size="17" font-weight="900" fill="#000" font-family="'Black Han Sans','Noto Sans KR',sans-serif">${label}</text>`;
}
function bonusLabel() {
  return `<g transform="translate(76.5 30)"><rect x="-38" y="-14" width="76" height="26" rx="13" fill="#000"/>
    <text y="6" text-anchor="middle" font-size="15" font-weight="900" fill="#ffd400" font-family="'Black Han Sans','Noto Sans KR',sans-serif" letter-spacing="2">보너스</text></g>`;
}
function pouch() {
  // 복주머니: 빨간 주머니 + 파란 끈 + 노란 福 원
  return `<g transform="translate(76.5 118)">
    <path d="M-30 -30 C-46 -10 -52 26 -36 44 C-22 58 22 58 36 44 C52 26 46 -10 30 -30 Z" fill="#ff0000" ${K}/>
    <path d="M-30 -30 C-40 -40 -26 -50 -18 -42 C-12 -52 0 -54 0 -44 C0 -54 12 -52 18 -42 C26 -50 40 -40 30 -30 C14 -24 -14 -24 -30 -30 Z" fill="#ff0000" ${K}/>
    <path d="M-30 -30 C-14 -22 14 -22 30 -30" fill="none" stroke="#2860c8" stroke-width="7" stroke-linecap="round"/>
    <path d="M-30 -30 C-14 -22 14 -22 30 -30" fill="none" ${K} stroke-width="1.2"/>
    <path d="M-6 -25 L-18 -2 M6 -25 L18 -2" stroke="#2860c8" stroke-width="5" stroke-linecap="round"/>
    <circle cx="-18" cy="0" r="4" fill="#ffd400" ${K}/><circle cx="18" cy="0" r="4" fill="#ffd400" ${K}/>
    <circle cx="0" cy="18" r="19" fill="#ffd400" ${K}/><circle cx="0" cy="18" r="14" fill="none" stroke="#ff0000" stroke-width="1.6"/>
    <text x="0" y="27" text-anchor="middle" font-size="24" font-weight="900" fill="#ff0000" font-family="'Noto Serif KR',serif">福</text>
    <path d="M-34 30 C-30 40 -22 46 -14 48 M34 30 C30 40 22 46 14 48" fill="none" stroke="#000" stroke-width="1.6"/>
  </g>`;
}
function coins() {
  // 엽전 세 닢을 빨간 끈으로 꿴 꾸러미
  const coin = (x: number, y: number, r: number) => `<g transform="translate(${x} ${y})"><circle r="${r}" fill="#ffd400" ${K}/><circle r="${r * 0.78}" fill="none" stroke="#c99a00" stroke-width="2"/>
    <rect x="${-r * 0.24}" y="${-r * 0.24}" width="${r * 0.48}" height="${r * 0.48}" fill="#fff" ${K} stroke-width="1.6"/>
    <text y="${-r * 0.42}" text-anchor="middle" font-size="${r * 0.34}" font-weight="900" fill="#7a5200" font-family="'Noto Serif KR',serif">通</text>
    <text y="${r * 0.62}" text-anchor="middle" font-size="${r * 0.34}" font-weight="900" fill="#7a5200" font-family="'Noto Serif KR',serif">寶</text></g>`;
  return `<path d="M76 44 C60 70 96 92 76 118 C60 140 96 162 78 176" fill="none" stroke="#ff0000" stroke-width="5"/>
    <path d="M76 44 C60 70 96 92 76 118 C60 140 96 162 78 176" fill="none" ${K} stroke-width="1"/>
    <path d="M70 176 L64 196 M78 176 L78 198 M86 176 L92 196" stroke="#ff0000" stroke-width="3" stroke-linecap="round"/>
    ${coin(70, 76, 24)}${coin(84, 118, 26)}${coin(68, 158, 22)}`;
}
function bonusArt(n: 2 | 3) {
  const id = `cb${n}`;
  const body = `<rect width="153" height="238" fill="#fff"/>
    ${cloud(34, 62, 0.9)}${cloud(122, 98, 0.8)}${cloud(28, 150, 0.75)}${cloud(126, 158, 0.7)}
    <rect x="7" y="170" width="139" height="61" fill="#000"/>
    <path d="M7 170 C40 160 113 160 146 170" fill="#000"/>
    ${n === 2 ? pouch() : coins()}
    ${bonusLabel()}
    ${medal(n, n === 2 ? '쌍피' : '쓰리피').replace('fill="#000" font-family', 'fill="#ffd400" font-family')}`;
  return FRAME_OPEN + clipInner(id, body) + FRAME_CLOSE;
}
const OVERRIDES: Record<string, string> = {
  '13-B2-0': bonusArt(2), '13-B2-1': bonusArt(2), '13-B3-0': bonusArt(3),
};

const cache = new Map<string, string>();
export function cardArt(c: Card): string {
  let s = cache.get(c.id);
  if (!s) {
    s = (OVERRIDES[c.id] ?? HWATU_SVG[c.id] ?? (c.kind === 'B3' ? bonusArt(3) : bonusArt(2))).replace('<svg ', '<svg aria-hidden="true" ');
    cache.set(c.id, s);
  }
  return s;
}
