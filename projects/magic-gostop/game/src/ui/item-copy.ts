// 아이템을 처음 보는 사람도 바로 알 수 있게 쓴 한 줄 설명과 "어떻게 쓰는지" 표시.
// 등급별 정확한 수치는 items-data.ts의 effects(도감 상세의 "내 등급 효과")가 맡는다.
export type Use = 'tap' | 'auto' | 'start' | 'look';
export const USE_LABEL: Record<Use, string> = {
  tap: '내 차례에 눌러서 사용',
  auto: '조건이 되면 자동 발동',
  start: '판 시작 때 발동',
  look: '꾸미기 · 능력치 없음',
};

export const COPY: Record<string, { one: string; use: Use }> = {
  // 주문 카드
  peek: { one: '상대 손패 몇 장을 잠깐 훔쳐봅니다', use: 'tap' },
  swap: { one: '내 손패 1장을 더미 맨 위 패와 바꿉니다', use: 'tap' },
  sweep: { one: '바닥 패를 더미 밑으로 치워 버립니다', use: 'tap' },
  undo: { one: '방금 낸 내 차례를 무르고 다시 냅니다', use: 'tap' },
  shield: { one: '상대가 내 피를 가져가는 걸 막아 줍니다', use: 'start' },
  double: { one: '이긴 판의 최종 점수를 2배로 만듭니다', use: 'start' },
  mirror: { one: '피를 뺏기면 상대 피를 되받아 옵니다', use: 'auto' },
  goinsure: { one: '고를 불렀다가 지면 잃는 점수를 줄여 줍니다', use: 'auto' },
  // 부적
  godori: { one: '새 열끗과 고도리로 보너스 점수', use: 'auto' },
  dan: { one: '홍단·청단·초단을 만들면 보너스 점수', use: 'auto' },
  pibu: { one: '쌍피·보너스 피를 먹으면 보너스 점수', use: 'auto' },
  jjok: { one: '쪽·따닥에 성공하면 보너스 점수', use: 'auto' },
  fang: { one: '고를 부를 때마다 보너스 점수', use: 'auto' },
  haetae: { one: '졌을 때 잃는 점수를 % 만큼 줄여 줍니다', use: 'auto' },
  // 수호 정령
  seer: { one: '판 시작 때 더미 위 패를 미리 봅니다', use: 'start' },
  twoflip: { one: '내 차례에 더미를 한 번 더 뒤집습니다', use: 'tap' },
  collector: { one: '광을 먹을 때마다 보너스 점수', use: 'auto' },
  turtle: { one: '피 뺏김을 막고, 높은 등급은 피박도 덜 당함', use: 'start' },
  gumiho: { one: '고를 부르면 상대 피 1장을 홀려 옵니다', use: 'auto' },
  dokkaebi: { one: '판 시작 때 바닥의 피를 가져옵니다', use: 'start' },
  samjogo: { one: '열끗을 먹을 때마다 보너스 점수', use: 'auto' },
  // 판 이벤트권 (나와 상대 모두에게 적용)
  gwangday: { one: '이번 판은 광 점수가 더 붙습니다 (모두)', use: 'start' },
  pifest: { one: '이번 판은 국진이 쌍피, 쌍피가 더 셉니다 (모두)', use: 'start' },
  fog: { one: '바닥 패 몇 장이 가려진 채 시작합니다 (모두)', use: 'start' },
  quake: { one: '이번 판 첫 흔들기·폭탄 배수가 커집니다 (모두)', use: 'start' },
  fullmoon: { one: '8월 패를 먹으면 보너스 점수 (모두)', use: 'start' },
  goday: { one: '고를 부를 때 점수가 더 붙습니다 (모두)', use: 'start' },
  // 마법 도구
  gourd: { one: '장착한 주문 카드가 더 잘 발동합니다', use: 'start' },
  pouch: { one: '봇전에서 아이템을 얻을 확률이 오릅니다', use: 'auto' },
  lantern: { one: '아직 안 보인 패를 월별로 세어 보여 줍니다', use: 'start' },
  treasure: { one: '이긴 판에 낮은 확률로 은화·금화가 나옵니다', use: 'auto' },
  // 꾸미기
  cardback: { one: '화투 뒷면 무늬가 바뀝니다', use: 'look' },
  theme: { one: '판(담요) 색과 분위기가 바뀝니다', use: 'look' },
  effect: { one: '패를 먹을 때 빛나는 효과가 바뀝니다', use: 'look' },
  voice: { one: '패를 먹을 때 국악 소리가 더해집니다', use: 'look' },
  frame: { one: '내 이름표에 테두리가 생깁니다', use: 'look' },
};
export const copyOf = (id: string) => COPY[id] ?? { one: '', use: 'auto' as Use };

// ---------- 등급별 효과 문구 (쉬운 말 · balance.ts 수치와 항상 같음) ----------
import { CH, B } from './balance';
const pc = (g: number) => `${CH[g]}% 확률`;
const pt = (n: number) => `${n}점`;
/** 장수·점수 등은 "한 판에" 기준. 꾸미기는 items-data.ts 문구를 그대로 쓴다 */
export const EFFECT: Record<string, (g: number) => string> = {
  peek: (g) => `내 차례에 눌러 쓰기 · 상대 손패 ${B.peekCount[g]}장을 ${B.peekSec[g]}초 동안 몰래 봅니다 (한 판에 1번, 항상 성공)`,
  swap: (g) => `내 차례에 눌러 쓰기 · 손패 1장을 더미 맨 위 패와 바꿉니다${g >= 5 ? ' (바꾸기 전에 그 패를 먼저 봄)' : ''} · ${pc(g)}로 성공, 한 판에 ${B.swapUses[g]}번`,
  sweep: (g) => `내 차례에 눌러 쓰기 · 바닥 패 ${B.sweepCount[g]}장을 더미 밑으로 치웁니다 (${g >= B.sweepAny ? '아무 패나' : '피만'}) · ${pc(g)}로 성공, 한 판에 1번`,
  undo: (g) => `내 차례에 눌러 쓰기 · 방금 낸 내 차례를 되돌립니다${g >= 6 ? ' (뻑도 되돌림)' : ''} · ${pc(g)}로 성공, 한 판에 1번`,
  shield: (g) => `판이 시작될 때 ${pc(g)}로 켜짐 · 켜지면 상대가 내 피를 ${B.shield[g]}번 못 가져갑니다${g >= B.shieldPibak ? ' · 피박도 1번 막음' : ''}${g >= B.shieldGwangbak ? ' · 광박도 1번 막음' : ''}`,
  double: (g) => `이긴 판의 최종 점수가 ${B.doublePct[g]}% 확률로 2배가 됩니다`,
  mirror: (g) => `상대가 내 피를 가져가면 ${pc(g)}로 상대 피 ${g >= 9 ? 2 : 1}장을 되받습니다 (한 판에 최대 ${B.mirrorCap[g]}번)`,
  goinsure: (g) => `고를 불렀다가 지면, 고 1번마다 잃는 점수가 ${pt(B.insureEach[g])} 줄어듭니다 (최대 ${pt(B.insureCap[g])}) · ${pc(g)}로 켜짐`,
  godori: (g) => `새 열끗을 먹을 때마다 +${pt(B.godoriEach[g])}, 고도리를 완성하면 +${pt(B.godoriDone[g])} (부적 점수는 한 판에 최대 ${B.talismanCap}점)`,
  dan: (g) => `홍단·청단·초단을 하나 완성할 때마다 +${pt(B.dan[g])} (이 부적으로 한 판에 최대 ${pt(B.danCap[g])})`,
  pibu: (g) => `쌍피·보너스 피를 먹을 때마다 +${pt(B.pibu[g])} (한 판에 최대 ${pt(B.pibuCap[g])})`,
  jjok: (g) => `쪽이나 따닥에 성공할 때마다 +${pt(B.jjok[g])} (한 판에 최대 ${pt(B.jjokCap[g])})`,
  fang: (g) => `고를 부를 때마다 +${pt(B.fang[g])} (한 판에 최대 ${pt(B.fangCap[g])})`,
  haetae: (g) => `졌을 때 잃는 점수가 ${B.haetae[g]}% 줄어듭니다 (최소 1점은 잃음)`,
  seer: (g) => `판이 시작될 때 ${pc(g)}로 더미 맨 위 ${B.seer[g]}장을 미리 봅니다`,
  twoflip: (g) => `내 차례에 눌러 쓰기 · 더미를 한 장 더 뒤집어 맞으면 먹습니다 · ${B.twoflipFrom[g]}번째 내 차례부터, 한 판에 ${B.twoflipUses[g]}번 · ${pc(g)}로 켜짐`,
  collector: (g) => `광을 먹을 때마다 +${pt(B.spiritEach[g])} (한 판에 최대 ${pt(B.spiritCap[g])}) · ${pc(g)}로 켜짐`,
  turtle: (g) => `상대가 내 피를 ${B.turtle[g]}번 못 가져갑니다${g >= B.turtlePibak ? ' · 피박 기준이 4장으로 줄어듦' : ''} · ${pc(g)}로 켜짐`,
  gumiho: (g) => `내가 고를 부를 때마다 상대 피 1장을 가져옵니다 (한 판에 최대 ${B.gumiho[g]}장) · ${pc(g)}로 켜짐`,
  dokkaebi: (g) => `판이 시작될 때 바닥의 피 ${B.dokkaebi[g]}장을 가져옵니다 · ${pc(g)}로 켜짐`,
  samjogo: (g) => `열끗을 먹을 때마다 +${pt(B.spiritEach[g])} (한 판에 최대 ${pt(B.spiritCap[g])}) · ${pc(g)}로 켜짐`,
  gwangday: (g) => `이번 판은 광 점수에 +${pt(B.gwangday[g])}${g >= B.gwangdayBi ? ' · 비광 3장도 감점 없이 3점' : ''} (나와 상대 모두) · ${pc(g)}로 켜짐`,
  pifest: (g) => `이번 판은 국진을 쌍피로 셉니다${g >= B.pifestBoost ? ' · 쌍피는 3피로' : ''}${g >= B.pifestBonus ? ' · 보너스 패 1장 추가' : ''} (모두) · ${pc(g)}로 켜짐`,
  fog: (g) => `바닥 패 ${B.fog[g]}장이 가려진 채 시작합니다 (모두)${B.fogPeek[g] ? ` · 그중 ${B.fogPeek[g]}장은 나만 미리 봄` : ''} · ${pc(g)}로 켜짐`,
  quake: (g) => `이번 판 첫 흔들기·폭탄이 2배 대신 ${B.quake[g]}배 (모두) · ${pc(g)}로 켜짐`,
  fullmoon: (g) => `이번 판 8월 패를 먹을 때마다 +${pt(B.moon[g])} (모두, 한 사람당 최대 ${pt(B.moonCap[g])}) · ${pc(g)}로 켜짐`,
  goday: (g) => `이번 판 고를 부를 때마다 +${pt(g >= B.godayStrong ? 2 : 1)} (모두, 3고까지) · ${pc(g)}로 켜짐`,
  gourd: (g) => `장착한 주문 카드의 성공 확률 +${B.gourd[g]}%${g >= B.gourdExtraUse ? ' · 1번만 쓰는 주문 하나를 2번 쓸 수 있음' : ''}`,
  pouch: (g) => `봇전에서 아이템을 얻을 확률 +${B.pouch[g]}% (뽑기권 확률은 그대로)`,
  treasure: (g) => `판을 이기면 ${B.treasureEun[g]}% 확률로 은화 1개, ${B.treasureGeum[g]}% 확률로 금화 1개`,
};
/** 함께 쓸 때 규칙(쉬운 말) */
export const STACK_RULE = `가진 아이템은 장착 없이 판마다 모두 자동으로 굴려 적용됩니다 · 겹쳐서 아래 한도를 넘는 만큼은 엽전으로 돌려받습니다 · 아이템 보너스 점수는 한 판에 최대 ${B.itemCap}점(부적은 ${B.talismanCap}점)까지 · 피 지키기는 모두 합쳐 ${B.shieldCap}번까지 · 졌을 때 덜 잃기는 모두 합쳐 ${Math.round(B.lossCutCap * 100)}%까지 · 점수 배수 아이템(황금 배수·땅울림)은 하나만 · 보너스 점수는 7점(고/스톱 기준)에는 들어가지 않고 끝난 뒤 정산에만 더해집니다`;
