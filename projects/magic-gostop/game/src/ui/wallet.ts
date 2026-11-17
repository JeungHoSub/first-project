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

// ---------- 은화 · 금화 ----------
// 엽전: 게임머니(판 걸기·윷놀이 내기·낮은 뽑기권) / 은화: 미션·윷놀이 큰 승리로만 얻음(높은 뽑기권) /
// 금화: 결제로만 얻는 재화(지금은 테스트 충전) → 엽전으로 바꿀 수 있음. 금화는 어떤 내기로도 얻을 수 없다(사행성 방지).
export type Cur = 'yeop' | 'eun' | 'geum';
export const CUR_NAME: Record<Cur, string> = { yeop: '엽전', eun: '은화', geum: '금화' };
const KEYS: Record<'eun' | 'geum', string> = { eun: 'mg-eun-v1', geum: 'mg-geum-v1' };
const START: Record<'eun' | 'geum', number> = { eun: 20, geum: 0 };
const cache2: Partial<Record<'eun' | 'geum', number>> = {};
function get2(c: 'eun' | 'geum') {
  if (cache2[c] != null) return cache2[c]!;
  let v = START[c];
  try { const raw = localStorage.getItem(KEYS[c]); if (raw != null && !Number.isNaN(+raw)) v = Math.max(0, Math.floor(+raw)); } catch { /* 무시 */ }
  return (cache2[c] = v);
}
function set2(c: 'eun' | 'geum', n: number) {
  cache2[c] = Math.max(0, Math.floor(n));
  try { localStorage.setItem(KEYS[c], String(cache2[c])); } catch { /* 무시 */ }
  listeners.forEach((f) => f(coins()));
}
export const bal = (c: Cur) => (c === 'yeop' ? coins() : get2(c));
export function add(c: Cur, n: number) { if (n <= 0) return; if (c === 'yeop') earn(n); else set2(c, get2(c) + n); }
export function pay(c: Cur, n: number): boolean { if (c === 'yeop') return spend(n); if (get2(c) < n) return false; set2(c, get2(c) - n); return true; }
/** 금화 → 엽전 교환 상품 */
export const EXCHANGE = [
  { id: 'x1', geum: 1, yeop: 1000, label: '엽전 한 꾸러미' },
  { id: 'x10', geum: 10, yeop: 11000, label: '엽전 한 궤짝 (+10%)' },
  { id: 'x50', geum: 50, yeop: 60000, label: '엽전 한 곳간 (+20%)' },
];
export function exchange(id: string): boolean {
  const x = EXCHANGE.find((e) => e.id === id); if (!x) return false;
  if (!pay('geum', x.geum)) return false;
  add('yeop', x.yeop); return true;
}
/** 화폐 아이콘 (CSS) */
export const curIco = (c: Cur) => `<i class="cur-ico ${c}" aria-hidden="true"></i>`;
