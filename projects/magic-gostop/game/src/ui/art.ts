import type { Card } from '../engine';
import { HWATU_SVG } from './hwatu-data';

// 화투 그림: 사용자가 제공한 한국 화투 일러스트(.ai, 디자인메카)를 벡터 그대로 카드별 SVG로 변환해 쓴다.
// 변환 도구: scripts/hwatu/ (ai2svg.py → split_cards.py). 예전 직접 그린 그림은 art-drawn.ts에 보관.
const cache = new Map<string, string>();
export function cardArt(c: Card): string {
  let s = cache.get(c.id);
  if (!s) {
    s = HWATU_SVG[c.id].replace('<svg ', '<svg aria-hidden="true" ');
    cache.set(c.id, s);
  }
  return s;
}
