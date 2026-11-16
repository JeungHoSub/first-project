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

/** 보너스 패: 2피(쌍피) / 3피 */
function bonusArt(n: 2 | 3) {
  const id = `cb${n}`;
  const stars = [[30, 46], [122, 46], [30, 192], [122, 192]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="#ff0000" stroke="#000" stroke-width="1.6"/><circle cx="${x}" cy="${y}" r="3.5" fill="#ffd400"/>`).join('');
  return FRAME_OPEN + clipInner(id, `
    <rect x="0" y="0" width="153" height="238" fill="#ffd400"/>
    <path d="M0 0 L153 238 M153 0 L0 238" stroke="#ffe680" stroke-width="22"/>
    ${stars}
    <rect x="22" y="76" width="109" height="86" rx="10" fill="#fff" stroke="#000" stroke-width="2.4"/>
    <text x="76.5" y="70" text-anchor="middle" font-size="20" font-weight="700" fill="#000" font-family="'Noto Sans KR',sans-serif">보너스</text>
    <text x="76.5" y="140" text-anchor="middle" font-size="60" font-weight="900" fill="#ff0000" stroke="#000" stroke-width="1.6" font-family="'Black Han Sans','Noto Sans KR',sans-serif">${n}피</text>
    <text x="76.5" y="186" text-anchor="middle" font-size="17" font-weight="700" fill="#000" font-family="'Noto Sans KR',sans-serif">${n === 2 ? '쌍피' : '쓰리피'}</text>
  `) + FRAME_CLOSE;
}
const OVERRIDES: Record<string, string> = {
  '13-B2-0': bonusArt(2), '13-B2-1': bonusArt(2), '13-B3-0': bonusArt(3),
};

const cache = new Map<string, string>();
export function cardArt(c: Card): string {
  let s = cache.get(c.id);
  if (!s) {
    s = (OVERRIDES[c.id] ?? HWATU_SVG[c.id]).replace('<svg ', '<svg aria-hidden="true" ');
    cache.set(c.id, s);
  }
  return s;
}
