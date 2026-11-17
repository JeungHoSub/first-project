import type { Bak, Card, GameResult, PlayerId, RuleOptions, ScoreDetail, ScoreResult } from './types';
import { DEFAULT_OPTIONS } from './types';
import { PI_VALUE } from './cards';

const isGukjin = (c: Card) => c.tag === 'gukjin';

function scoreWith(captured: readonly Card[], gj: 'yeol' | 'pi', options: RuleOptions = DEFAULT_OPTIONS): ScoreResult {
  const details: ScoreDetail[] = [];
  const add = (key: string, label: string, points: number) => {
    if (points > 0) details.push({ key, label, points });
  };

  const hasGukjin = captured.some(isGukjin);
  const note = hasGukjin ? `(국진→${gj === 'pi' ? '쌍피' : '열끗'})` : '';
  const gwang = captured.filter((c) => c.kind === 'G');
  const yeol = captured.filter((c) => c.kind === 'Y' && !(gj === 'pi' && isGukjin(c)));
  const tti = captured.filter((c) => c.kind === 'T');
  const pi = piSum(captured, gj === 'pi', options);

  // 광
  const g = gwang.length;
  if (g === 5) add('gwang', '5광', 15);
  else if (g === 4) add('gwang', '4광', 4);
  else if (g === 3) {
    const hasBi = gwang.some((c) => c.tag === 'bi');
    add('gwang', hasBi ? '3광(비광 포함)' : '3광', hasBi ? 2 : 3);
  }
  // 열끗 / 고도리
  if (yeol.length >= 5) add('yeol', `열끗 ${yeol.length}장${note}`, yeol.length - 4);
  if (yeol.filter((c) => c.tag === 'godori').length === 3) add('godori', '고도리', 5);
  // 띠 / 단
  if (tti.length >= 5) add('tti', `띠 ${tti.length}장`, tti.length - 4);
  const dan = (tag: string) => tti.filter((c) => c.tag === tag).length === 3;
  if (dan('hong')) add('hong', '홍단', 3);
  if (dan('cheong')) add('cheong', '청단', 3);
  if (dan('cho')) add('cho', '초단', 3);
  // 피 (쌍피 2장)
  if (pi >= 10) add('pi', `피 ${pi}장${note}`, pi - 9);

  return { total: details.reduce((n, d) => n + d.points, 0), details, gukjin: hasGukjin ? gj : null };
}

/** 피 장수 합. 국진은 asPi=true일 때만 쌍피(2)로 센다. */
function piSum(captured: readonly Card[], gukjinAsPi: boolean, options: RuleOptions = DEFAULT_OPTIONS): number {
  const dv = options.piBoost ? 3 : 2; // 쌍피 축제: 쌍피(국진 포함)를 3피로
  let n = captured.reduce((a, c) => a + (c.kind === 'D' ? dv : (PI_VALUE[c.kind] ?? 0)), 0);
  if (gukjinAsPi && captured.some(isGukjin)) n += dv;
  return n;
}

/**
 * 획득 패로 기본 점수를 매번 처음부터 계산한다. 순수 함수.
 * 국진(9월 열끗)은 열끗/쌍피 중 총점이 높은 쪽으로 자동 선택(R04, 같으면 열끗). gukjin을 주면 그쪽으로 고정.
 * 어느 쪽으로 셌는지는 result.gukjin과 details의 label("국진→쌍피")에 나온다.
 */
export function score(captured: readonly Card[], _options: RuleOptions = DEFAULT_OPTIONS, gukjin?: 'yeol' | 'pi'): ScoreResult {
  if (gukjin) return scoreWith(captured, gukjin, _options);
  const a = scoreWith(captured, 'yeol', _options);
  if (!captured.some(isGukjin)) return a;
  const b = scoreWith(captured, 'pi', _options);
  return b.total > a.total ? b : a;
}

/** 고 가산 + 배수 정산 (rules.md 5.3~5.6). 3고 ×2, 4고 ×4, n고 ×2^(n-2). */
export function settle(
  base: number,
  goCount: number,
  options: RuleOptions = DEFAULT_OPTIONS,
  shakes = 0, // 흔들기+폭탄 횟수 (각 ×2 누적)
  bakMultiplier = 1, // 박 배수 (피박·광박·멍따 곱)
  carry = 1, // 나가리 이월 배수
): { goBonus: number; multiplier: number; shakeMultiplier: number; bakMultiplier: number; carry: number; finalScore: number } {
  const goBonus = goCount;
  const multiplier = goCount >= options.goMultiplierFrom ? 2 ** (goCount - options.goMultiplierFrom + 1) : 1;
  // 땅울림: 첫 흔들기·폭탄만 ×quakeFirst, 그다음부터 ×2
  const shakeMultiplier = shakes > 0 && options.quakeFirst ? options.quakeFirst * 2 ** (shakes - 1) : 2 ** shakes;
  return {
    goBonus, multiplier, shakeMultiplier, bakMultiplier, carry,
    finalScore: Math.ceil((base + goBonus) * multiplier * shakeMultiplier * bakMultiplier * carry - 1e-9), // 아이템 0.5점 등은 정산 때 올림
  };
}

/**
 * 박 판정 (5.5). 패자 기준, 곱셈 중첩(R08).
 * 피박: 승자 피 점수 + 패자 피 합 0~5 (패자 국진은 쌍피로 세어 유리하게). 광박: 승자 광 점수 + 패자 광 0장.
 * 멍따: 승자 열끗 7장 이상 (패자 조건 없음). 국진은 승자 계산(winScore)이 어느 쪽으로 셌는지를 따른다.
 */
export function judgeBak(winnerScore: ScoreResult, winner: readonly Card[], loser: readonly Card[], options: RuleOptions = DEFAULT_OPTIONS, loserGukjinAsPi = true, pibakMax = 5): { bak: Bak; bakMultiplier: number } {
  const off = !options.special.bak;
  const gj = winnerScore.gukjin === 'pi';
  const yeolCount = winner.filter((c) => c.kind === 'Y' && !(gj && isGukjin(c))).length;
  const bak: Bak = {
    pi: !off && winnerScore.details.some((d) => d.key === 'pi') && piSum(loser, loserGukjinAsPi, options) >= 1 && piSum(loser, loserGukjinAsPi, options) <= pibakMax, // 사용자 확정: 1~5장만 (0장은 피박 아님)
    gwang: !off && winnerScore.details.some((d) => d.key === 'gwang') && !loser.some((c) => c.kind === 'G'),
    meong: !off && yeolCount >= 7,
  };
  return { bak, bakMultiplier: 2 ** (Number(bak.pi) + Number(bak.gwang) + Number(bak.meong)) };
}

/** 승자 정산 전체: 국진을 열끗/쌍피 중 최종 점수가 더 큰 쪽으로(같으면 열끗) 골라 박·배수까지 계산. */
export function settleWin(
  winner: PlayerId, captured: readonly [readonly Card[], readonly Card[]], goCount: number, shakes: number,
  options: RuleOptions, by: 'stop' | 'exhaust',
  winnerGukjin: 'auto' | 'yeol' | 'pi' = 'auto', loserGukjin: 'auto' | 'yeol' | 'pi' = 'auto',
  magic?: { double?: boolean; noPibak?: boolean; noGwangbak?: boolean },
  extraPoints = 0, // 첫뻑 등 카드 외 추가 점수
): Extract<GameResult, { type: 'win' }> {
  const w = captured[winner];
  const l = captured[1 - winner];
  const carry = options.carry;
  let best: Extract<GameResult, { type: 'win' }> | null = null;
  const modes = winnerGukjin === 'auto' ? (['yeol', 'pi'] as const) : ([winnerGukjin] as const);
  for (const gj of modes) {
    const sc = scoreWith(w, gj, options);
    let { bak, bakMultiplier } = judgeBak(sc, w, l, options, loserGukjin === 'yeol' ? false : true, options.pibakMax?.[1 - winner] ?? 5);
    // 매직 카드 "방패"(높은 등급): 진 쪽의 피박·광박을 한 번 막는다
    const blocked: ('pi' | 'gwang')[] = [];
    if (magic?.noPibak && bak.pi) { bak = { ...bak, pi: false }; bakMultiplier /= 2; blocked.push('pi'); }
    if (magic?.noGwangbak && bak.gwang) { bak = { ...bak, gwang: false }; bakMultiplier /= 2; blocked.push('gwang'); }
    const r: Extract<GameResult, { type: 'win' }> = {
      type: 'win', winner, base: sc.total + extraPoints, goCount, by, bak, nextCarry: 1,
      ...settle(sc.total + extraPoints, goCount, options, shakes, bakMultiplier, carry),
    };
    if (blocked.length) r.magicBlocked = blocked;
    if (magic?.double) { r.finalScore *= 2; r.magicDouble = true; } // 매직 카드 "점수 2배"
    if (!best || r.finalScore > best.finalScore) best = r;
    if (!w.some(isGukjin)) break;
  }
  return best!;
}

export function describeResult(r: GameResult): string {
  if (r.type === 'nagari') return `나가리 (다음 판 ×${r.nextCarry})`;
  if (r.by === 'chongtong') return `플레이어 ${r.winner} 총통 승 ${r.finalScore}점`;
  const bak = [r.bak.pi && '피박', r.bak.gwang && '광박', r.bak.meong && '멍따'].filter(Boolean).join('·');
  return `플레이어 ${r.winner} 승 (기본 ${r.base} + 고 ${r.goBonus}) × ${r.multiplier}${r.shakeMultiplier > 1 ? ` × 흔들기·폭탄 ${r.shakeMultiplier}` : ''}${r.bakMultiplier > 1 ? ` × ${bak} ${r.bakMultiplier}` : ''}${r.carry > 1 ? ` × 이월 ${r.carry}` : ''} = ${r.finalScore}점`;
}
