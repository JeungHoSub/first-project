// 가상머니(엽전). 게임 안에서만 쓰는 재화: 현금 충전·환전·선물 없음(사행성 방지).
// 판에서 이기면 벌고, 뽑기권에 쓴다. 나중에 첫뻑 보너스 등을 돈으로 바꿀 자리.
const KEY = 'mg-coins-v1';
export const START_COINS = 10000;
export const COIN_PER_POINT = 100; // 이긴 판 점수 1점당 엽전
export const COIN = '엽전';
/** 첫뻑 보상(점수 +3과 함께 지급) */
export const FIRST_PPEOK_COINS = 300;

let cache: number | null = null;
const listeners = new Set<(n: number) => void>();

export function coins(): number {
  if (cache != null) return cache;
  let v = START_COINS;
  try { const raw = localStorage.getItem(KEY); if (raw != null && !Number.isNaN(+raw)) v = Math.max(0, Math.floor(+raw)); } catch { /* 저장소 없음 */ }
  return (cache = v);
}
function set(n: number) {
  cache = Math.max(0, Math.floor(n));
  try { localStorage.setItem(KEY, String(cache)); } catch { /* 무시 */ }
  listeners.forEach((f) => f(cache!));
}
export function earn(n: number) { if (n > 0) set(coins() + n); }
/** 잔액이 모자라면 false (차감 안 함) */
export function spend(n: number): boolean { if (coins() < n) return false; set(coins() - n); return true; }
/** 진 판: 잃은 만큼 차감(0 밑으로는 안 내려감). 실제로 잃은 액수를 돌려준다 */
export function lose(n: number): number { const v = Math.min(coins(), Math.max(0, n)); set(coins() - v); return v; }
export function onCoins(f: (n: number) => void) { listeners.add(f); }
export const fmt = (n: number) => n.toLocaleString('ko-KR');
