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
  // 꾸미기
  cardback: { one: '화투 뒷면 무늬가 바뀝니다', use: 'look' },
  theme: { one: '판(담요) 색과 분위기가 바뀝니다', use: 'look' },
  effect: { one: '패를 먹을 때 빛나는 효과가 바뀝니다', use: 'look' },
  voice: { one: '패를 먹을 때 국악 소리가 더해집니다', use: 'look' },
  frame: { one: '내 이름표에 테두리가 생깁니다', use: 'look' },
};
export const copyOf = (id: string) => COPY[id] ?? { one: '', use: 'auto' as Use };
