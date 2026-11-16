import type { Card, Kind, Tag } from './types';

// rules.md 1절 JSON 기준. "종류:태그" 형식.
const SPEC: { m: number; list: string[] }[] = [
  { m: 1, list: ['G', 'T:hong', 'P', 'P'] },
  { m: 2, list: ['Y:godori', 'T:hong', 'P', 'P'] },
  { m: 3, list: ['G', 'T:hong', 'P', 'P'] },
  { m: 4, list: ['Y:godori', 'T:cho', 'P', 'P'] },
  { m: 5, list: ['Y', 'T:cho', 'P', 'P'] },
  { m: 6, list: ['Y', 'T:cheong', 'P', 'P'] },
  { m: 7, list: ['Y', 'T:cho', 'P', 'P'] },
  { m: 8, list: ['G', 'Y:godori', 'P', 'P'] },
  { m: 9, list: ['Y:gukjin', 'T:cheong', 'P', 'P'] },
  { m: 10, list: ['Y', 'T:cheong', 'P', 'P'] },
  { m: 11, list: ['G', 'D', 'P', 'P'] },
  { m: 12, list: ['G:bi', 'Y', 'T', 'D'] },
];

export function buildDeck(): Card[] {
  const cards: Card[] = [];
  for (const { m, list } of SPEC) {
    const seq: Record<string, number> = {};
    for (const item of list) {
      const [kind, tag] = item.split(':') as [Kind, Tag | undefined];
      const n = (seq[kind] = (seq[kind] ?? -1) + 1);
      const card: Card = { id: `${String(m).padStart(2, '0')}-${kind}-${n}`, month: m, kind };
      if (tag) card.tag = tag;
      cards.push(card);
    }
  }
  return cards;
}

export const ALL_CARDS: readonly Card[] = buildDeck();

/** 보너스 패 (month 13). 2피짜리 two장 + 3피짜리 three장. */
export function buildBonusCards(two: number, three: number): Card[] {
  const out: Card[] = [];
  for (let i = 0; i < two; i++) out.push({ id: `13-B2-${i}`, month: 13, kind: 'B2' });
  for (let i = 0; i < three; i++) out.push({ id: `13-B3-${i}`, month: 13, kind: 'B3' });
  return out;
}

export const BONUS_MONTH = 13;
export const isBonus = (c: Card): boolean => c.month === BONUS_MONTH;
/** 피 장수 값: 피 1 / 쌍피 2 / 보너스 2피 2 / 보너스 3피 3 */
export const PI_VALUE: Record<string, number> = { P: 1, D: 2, B2: 2, B3: 3 };
