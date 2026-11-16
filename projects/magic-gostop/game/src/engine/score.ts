import type { Card, ScoreDetail, ScoreResult, RuleOptions, GameResult } from './types';
import { DEFAULT_OPTIONS } from './types';

/** 획득 패로 기본 점수를 매번 처음부터 계산한다. 순수 함수. (국진은 1단계에서 열끗 고정) */
export function score(captured: readonly Card[], _options: RuleOptions = DEFAULT_OPTIONS): ScoreResult {
  const details: ScoreDetail[] = [];
  const add = (key: string, label: string, points: number) => {
    if (points > 0) details.push({ key, label, points });
  };

  const gwang = captured.filter((c) => c.kind === 'G');
  const yeol = captured.filter((c) => c.kind === 'Y');
  const tti = captured.filter((c) => c.kind === 'T');
  const pi = captured.reduce((n, c) => n + (c.kind === 'D' ? 2 : c.kind === 'P' ? 1 : 0), 0);

  // 광
  const g = gwang.length;
  if (g === 5) add('gwang', '5광', 15);
  else if (g === 4) add('gwang', '4광', 4);
  else if (g === 3) {
    const hasBi = gwang.some((c) => c.tag === 'bi');
    add('gwang', hasBi ? '3광(비광 포함)' : '3광', hasBi ? 2 : 3);
  }
  // 열끗 / 고도리
  if (yeol.length >= 5) add('yeol', `열끗 ${yeol.length}장`, yeol.length - 4);
  if (yeol.filter((c) => c.tag === 'godori').length === 3) add('godori', '고도리', 5);
  // 띠 / 단
  if (tti.length >= 5) add('tti', `띠 ${tti.length}장`, tti.length - 4);
  const dan = (tag: string) => tti.filter((c) => c.tag === tag).length === 3;
  if (dan('hong')) add('hong', '홍단', 3);
  if (dan('cheong')) add('cheong', '청단', 3);
  if (dan('cho')) add('cho', '초단', 3);
  // 피 (쌍피 2장)
  if (pi >= 10) add('pi', `피 ${pi}장`, pi - 9);

  return { total: details.reduce((n, d) => n + d.points, 0), details };
}

/** 고 가산 + 배수 정산 (rules.md 5.3). 3고 ×2, 4고 ×4, n고 ×2^(n-2). */
export function settle(
  base: number,
  goCount: number,
  options: RuleOptions = DEFAULT_OPTIONS,
): { goBonus: number; multiplier: number; finalScore: number } {
  const goBonus = goCount;
  const multiplier = goCount >= options.goMultiplierFrom ? 2 ** (goCount - options.goMultiplierFrom + 1) : 1;
  return { goBonus, multiplier, finalScore: (base + goBonus) * multiplier };
}

export function describeResult(r: GameResult): string {
  if (r.type === 'nagari') return '나가리';
  return `플레이어 ${r.winner} 승 (기본 ${r.base} + 고 ${r.goBonus}) × ${r.multiplier} = ${r.finalScore}점`;
}
