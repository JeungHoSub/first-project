// 매직고스톱 귀속 아이템 데이터(화면용). 설계 근거·상세 규칙·등급별 수치표는 outputs/items.md.
// 이 파일은 데이터만 담는다(효과는 설명 문구). collection.ts·main.ts 연결은 총괄이 한다.
// 기존 14종의 id는 그대로 유지했고, category 'character'는 'spirit'(수호 정령)으로, 'magic'은 'spell'로 바뀌었다.

export type Category = 'spell' | 'talisman' | 'spirit' | 'event' | 'tool' | 'cosmetic';
export const CATEGORY_LABEL: Record<Category, string> = {
  spell: '주문 카드',
  talisman: '부적',
  spirit: '수호 정령',
  event: '판 이벤트권',
  tool: '마법 도구',
  cosmetic: '꾸미기',
};

export interface ItemSpec {
  id: string;
  name: string;
  category: Category;
  icon: string;
  hue: string;
  /** 획득 가중치(흔함 12 / 보통 7 / 희귀 3) */
  weight: number;
  /** 중첩 규칙 한 줄 */
  stack: string;
  /** 길이 10, F · E · D · C · B · A · S · SS · SSS · SSS+ 순 */
  effects: string[];
}

// ---------- 효과 문구 만들기 도우미 (등급 순번 g = 0(F) … 9(SSS+)) ----------
const E = (f: (g: number) => string): string[] => Array.from({ length: 10 }, (_, g) => f(g));
/** 발동 확률(%) — 등급이 오를수록 40 → 100 */
const CH = [40, 47, 53, 60, 67, 73, 80, 87, 93, 100];
const ch = (g: number) => ` · 발동 ${CH[g]}%`;
const FLAG = (from: number) => (g: number) => g >= from;

const W_COMMON = 12;
const W_NORMAL = 7;
const W_RARE = 3;

export const ITEM_SPECS: ItemSpec[] = [
  // ===== 주문 카드 (spell) =====
  { id: 'peek', name: '천리안', category: 'spell', icon: 'eye', hue: '#3fa7d6', weight: W_COMMON,
    stack: '중첩 불가(같은 주문은 1장만) · 같은 판 1회 · 상대 손패 공개는 이 주문 하나뿐',
    effects: E((g) => `판당 1회, 상대 손패 ${[1, 1, 1, 2, 2, 2, 3, 3, 4, 5][g]}장을 ${[2, 3, 4, 4, 5, 6, 6, 7, 8, 10][g]}초 동안 봅니다`) },
  { id: 'swap', name: '둔갑 바꾸기', category: 'spell', icon: 'swap', hue: '#b678e8', weight: W_COMMON,
    stack: '중첩 불가(같은 주문은 1장만) · 판당 횟수는 등급표 그대로',
    effects: E((g) => `판당 ${g >= 8 ? 2 : 1}회, 손패 1장을 더미 맨 위 패와 맞바꿈${FLAG(5)(g) ? ' · 교환 전 미리 보기' : ''}${ch(g)}`) },
  { id: 'sweep', name: '도깨비 빗자루', category: 'spell', icon: 'broom', hue: '#5bbf6a', weight: W_COMMON,
    stack: '중첩 불가(같은 주문은 1장만) · 뻑이 쌓인 월은 쓸 수 없음',
    effects: E((g) => `판당 1회, 바닥 패 ${g >= 7 ? 2 : 1}장을 더미 맨 아래로 보냄 (${g >= 4 ? '모든 패' : '피만'})${ch(g)}`) },
  { id: 'undo', name: '시간 되감기', category: 'spell', icon: 'undo', hue: '#7fd1c7', weight: W_NORMAL,
    stack: '중첩 불가(같은 주문은 1장만) · 직전 내 차례 한 번만 되감기, 연속 되감기 금지',
    effects: E((g) => `판당 ${g >= 9 ? 2 : 1}회, 내 직전 차례를 무르고 다시 냅니다${g >= 6 ? ' · 뻑도 무르기' : ''}${ch(g)}`) },
  { id: 'shield', name: '금강 방패', category: 'spell', icon: 'shield', hue: '#f0c35a', weight: W_NORMAL,
    stack: '중첩 가능(최대 6회) · 금강 방패와 현무 거북이 막는 횟수는 합쳐 판당 6회까지, 박 방어는 판당 피박 1·광박 1이 한도',
    effects: E((g) => `피 뺏김을 ${[1, 1, 2, 2, 2, 3, 3, 4, 4, 5][g]}번 막음${g >= 5 ? ' · 피박도 1번' : ''}${g >= 8 ? ' · 광박도 1번' : ''}${ch(g)}`) },
  { id: 'double', name: '황금 배수', category: 'spell', icon: 'x2', hue: '#3f9a78', weight: W_RARE,
    stack: '중첩 불가 · 배수 계열(황금 배수·땅울림)은 한 판에 하나만, 둘이면 큰 쪽만 적용',
    effects: E((g) => `이긴 판 최종 점수 ×2 · 발동 ${(g + 1) * 10}% (진 판엔 효과 없음)`) },
  { id: 'mirror', name: '거울 반사', category: 'spell', icon: 'mirror', hue: '#c9d6e8', weight: W_NORMAL,
    stack: '중첩 가능(최대 3회) · 방패·거북이 이미 막은 뺏김은 반사 대상이 아님(피가 실제로 넘어간 때만)',
    effects: E((g) => `상대에게 피를 뺏기면 ${g >= 9 ? 2 : 1}장을 되받음 (판당 최대 ${[1, 1, 1, 1, 2, 2, 2, 2, 3, 3][g]}회)${ch(g)}`) },
  { id: 'goinsure', name: '고 보험 우산', category: 'spell', icon: 'umbrella', hue: '#6fa8ff', weight: W_NORMAL,
    stack: '중첩 가능(합산) · 해태 부적과 합쳐 잃는 점수를 최대 50%까지만 줄임, 최소 1점은 잃음',
    effects: E((g) => `고를 부른 판에서 지면 잃는 점수가 고 횟수당 -${[0.5, 0.5, 1, 1, 1, 1.5, 1.5, 2, 2, 2.5][g]}점 (최대 -${[1, 2, 2, 3, 4, 4, 5, 5, 6, 6][g]}점, 최소 1점은 잃음)`) },

  // ===== 부적 (talisman) =====
  { id: 'godori', name: '고도리 부적', category: 'talisman', icon: 'bird', hue: '#e8a33a', weight: W_COMMON,
    stack: '중첩 불가(부적 슬롯 1개) · 부적 가산 점수는 판당 +6 상한',
    effects: E((g) => `고도리(새 열끗 3장) 완성 시 +${[1, 1, 1.5, 1.5, 2, 2, 3, 3, 3.5, 4][g]}점, 새 열끗을 먹을 때마다 +${[0.5, 0.75, 0.75, 1, 1, 1.25, 1.25, 1.5, 1.5, 1.5][g]}점`) },
  { id: 'dan', name: '삼색 띠 부적', category: 'talisman', icon: 'ribbon', hue: '#ff6b6b', weight: W_COMMON,
    stack: '중첩 불가(부적 슬롯 1개) · 이 부적 판당 최대치와 별개로 부적 가산 합계 +6 상한',
    effects: E((g) => `홍단·청단·초단을 완성할 때마다 +${[1, 1, 1.5, 1.5, 2, 2, 2.5, 2.5, 3, 3.5][g]}점 (이 부적 판당 최대 +${[2, 3, 3, 4, 4, 5, 5, 6, 6, 6][g]}점)`) },
  { id: 'pibu', name: '쌍피 부적', category: 'talisman', icon: 'coin', hue: '#f3b64a', weight: W_COMMON,
    stack: '중첩 불가(부적 슬롯 1개) · 쌍피 축제 이벤트와 함께 써도 각각 적용(가산 상한 안에서)',
    effects: E((g) => `쌍피·보너스 피를 먹을 때마다 +${[0.5, 0.5, 0.75, 0.75, 1, 1, 1.25, 1.25, 1.5, 2][g]}점 (이 부적 판당 최대 +${[1, 2, 2, 3, 3, 4, 4, 5, 5, 5][g]}점)`) },
  { id: 'jjok', name: '짝짓기 부적', category: 'talisman', icon: 'clover', hue: '#5bbf6a', weight: W_NORMAL,
    stack: '중첩 불가(부적 슬롯 1개) · 쪽·따닥의 기본 보상(피 가져오기)은 그대로 받고 이 점수는 별도',
    effects: E((g) => `쪽 또는 따닥에 성공하면 +${[1, 1, 1.5, 1.5, 2, 2, 2.5, 2.5, 3, 3.5][g]}점 (이 부적 판당 최대 +${[2, 3, 3, 4, 4, 5, 5, 6, 6, 6][g]}점)`) },
  { id: 'fang', name: '호랑이 어금니', category: 'talisman', icon: 'fang', hue: '#ff9d3a', weight: W_NORMAL,
    stack: '중첩 불가(부적 슬롯 1개) · 고 가산·고 배수(기본 규칙)와는 별개로 가산',
    effects: E((g) => `고를 부를 때마다 +${[0.5, 0.5, 0.75, 0.75, 1, 1, 1.25, 1.25, 1.5, 2][g]}점 (이 부적 판당 최대 +${[1, 2, 2, 3, 3, 4, 4, 5, 5, 5][g]}점)`) },
  { id: 'haetae', name: '해태 부적', category: 'talisman', icon: 'haetae', hue: '#e9c46a', weight: W_RARE,
    stack: '중첩 가능(최대 50%) · 고 보험 우산과 합쳐 잃는 점수의 50%까지, 최소 1점은 잃음(완전 면역 금지)',
    effects: E((g) => `졌을 때 잃는 점수 -${[10, 13, 17, 20, 23, 27, 30, 33, 37, 40][g]}% (최소 1점은 잃음)`) },

  // ===== 수호 정령 (spirit) =====
  { id: 'seer', name: '달토끼 점쟁이', category: 'spirit', icon: 'ball', hue: '#9b7bff', weight: W_NORMAL,
    stack: '정령은 1마리만 장착 · 같은 정령 중복 불가',
    effects: E((g) => `매 판 시작 때 더미 맨 위 ${[1, 1, 2, 2, 2, 3, 3, 3, 4, 4][g]}장을 봅니다${ch(g)}`) },
  { id: 'twoflip', name: '쌍둥이 그림자', category: 'spirit', icon: 'flip2', hue: '#ff8a3d', weight: W_RARE,
    stack: '정령은 1마리만 장착 · 판당 최대 2회, 한 차례에 연속 2번 금지',
    effects: E((g) => `판당 ${g >= 8 ? 2 : 1}회, 더미를 한 번 더 뒤집음 · ${[7, 6, 5, 4, 4, 3, 3, 2, 2, 1][g]}턴째부터${ch(g)}`) },
  { id: 'collector', name: '달빛 수집가', category: 'spirit', icon: 'gem', hue: '#4fd1ff', weight: W_NORMAL,
    stack: '정령은 1마리만 장착 · 가산 점수는 판당 +8 상한에 포함',
    effects: E((g) => `광을 먹을 때마다 +${[0.5, 0.5, 1, 1, 1, 1.5, 1.5, 1.5, 2, 2][g]}점 (판당 최대 ${[1, 1.5, 2, 2.5, 3, 3, 3.5, 4, 4.5, 5][g]}점)${ch(g)}`) },
  { id: 'turtle', name: '현무 거북', category: 'spirit', icon: 'turtle', hue: '#5bbf6a', weight: W_NORMAL,
    stack: '중첩 가능(최대 6회) · 금강 방패와 막는 횟수 합쳐 판당 6회까지',
    effects: E((g) => `피 뺏김을 ${[1, 1, 1, 1, 2, 2, 2, 2, 3, 3][g]}번 무시${g >= 6 ? ' · 피박 기준 -1장' : ''}${ch(g)}`) },
  { id: 'gumiho', name: '구미호', category: 'spirit', icon: 'fox', hue: '#ff8fb1', weight: W_RARE,
    stack: '정령은 1마리만 장착 · 상대 피 홀리기는 판당 3회 상한',
    effects: E((g) => `고를 부를 때마다 상대 피 1장을 홀려 가져옴 (판당 최대 ${[1, 1, 1, 1, 2, 2, 2, 2, 3, 3][g]}회)${ch(g)}`) },
  { id: 'dokkaebi', name: '방망이 도깨비', category: 'spirit', icon: 'dokkaebi', hue: '#ff6b3d', weight: W_RARE,
    stack: '정령은 1마리만 장착 · 가져오는 피는 일반 피(1장짜리)만, 쌍피·광·열끗·띠 불가',
    effects: E((g) => `판 시작 때 바닥의 일반 피 ${[1, 1, 1, 1, 2, 2, 2, 2, 3, 3][g]}장을 방망이로 가져옴${ch(g)}`) },
  { id: 'samjogo', name: '삼족오', category: 'spirit', icon: 'crow', hue: '#ffb02e', weight: W_NORMAL,
    stack: '정령은 1마리만 장착 · 가산 점수는 판당 +8 상한에 포함',
    effects: E((g) => `열끗을 먹을 때마다 +${[0.5, 0.5, 1, 1, 1, 1.5, 1.5, 1.5, 2, 2][g]}점 (판당 최대 ${[1, 1.5, 2, 2.5, 3, 3, 3.5, 4, 4.5, 5][g]}점)${ch(g)}`) },

  // ===== 판 이벤트권 (event) =====
  { id: 'gwangday', name: '광의 날', category: 'event', icon: 'sun', hue: '#ffd23a', weight: W_NORMAL,
    stack: '같은 판 1회 · 이벤트권은 판당 1장 · 상대와 같은 이벤트면 한 번만 적용',
    effects: E((g) => `이번 판 광 점수 +${[1, 1, 1, 1, 1, 2, 2, 2, 3, 3][g]} (모두에게)${g >= 7 ? ' · 비광 감점 없음' : ''}${ch(g)}`) },
  { id: 'pifest', name: '쌍피 축제', category: 'event', icon: 'confetti', hue: '#ff6fb5', weight: W_NORMAL,
    stack: '같은 판 1회 · 이벤트권은 판당 1장 · 상대와 같은 이벤트면 한 번만 적용',
    effects: E((g) => `이번 판 국진은 쌍피로 고정${g >= 4 ? ' · 쌍피는 3피로 셈' : ''}${g >= 8 ? ' · 보너스 패 +1장' : ''}${ch(g)}`) },
  { id: 'fog', name: '안개', category: 'event', icon: 'fog', hue: '#aab7c4', weight: W_NORMAL,
    stack: '같은 판 1회 · 이벤트권은 판당 1장 · 뒤집힌 패는 첫 접촉 때 공개',
    effects: E((g) => `바닥 패 ${[1, 1, 2, 2, 2, 3, 3, 3, 4, 4][g]}장을 뒤집어 놓고 시작 (모두에게)${g >= 3 ? ` · 그중 ${[0, 0, 0, 1, 1, 1, 2, 2, 3, 3][g]}장은 나만 미리 확인` : ''}${ch(g)}`) },
  { id: 'quake', name: '땅울림', category: 'event', icon: 'wave', hue: '#ff8a3d', weight: W_RARE,
    stack: '같은 판 1회 · 배수 계열 — 황금 배수와 함께면 큰 쪽만 적용 · 흔들기·폭탄 배수 최대 ×4',
    effects: E((g) => `이번 판 첫 흔들기·폭탄 배수 ×${[3, 3, 3, 3, 3, 3.5, 3.5, 3.5, 4, 4][g]} (모두에게)${ch(g)}`) },
  { id: 'fullmoon', name: '보름달 밤', category: 'event', icon: 'moon', hue: '#f4e6a6', weight: W_NORMAL,
    stack: '같은 판 1회 · 이벤트권은 판당 1장 · 사람당 판당 상한 있음',
    effects: E((g) => `이번 판 8월 패를 먹을 때마다 +${[0.5, 0.5, 0.5, 1, 1, 1, 1, 1.5, 1.5, 1.5][g]}점 (모두에게, 한 사람당 최대 ${[1, 1, 1.5, 1.5, 2, 2, 2.5, 2.5, 3, 3][g]}점)${ch(g)}`) },
  { id: 'goday', name: '북소리의 날', category: 'event', icon: 'drum', hue: '#e0523a', weight: W_RARE,
    stack: '같은 판 1회 · 이벤트권은 판당 1장 · 3고부터의 배수 규칙(기본)은 건드리지 않음',
    effects: E((g) => `이번 판 고를 부를 때마다 고 가산 +${g >= 5 ? 2 : 1}점 추가 (모두에게, 최대 3고까지)${ch(g)}`) },

  // ===== 마법 도구 (tool) =====
  { id: 'gourd', name: '호리병', category: 'tool', icon: 'gourd', hue: '#d9a05b', weight: W_NORMAL,
    stack: '중첩 불가(도구 슬롯 1개) · 발동 확률은 100% 초과 불가, 횟수 +1은 주문 1장에만',
    effects: E((g) => `장착한 주문의 발동 확률 +${(g + 1) * 3}%p (최대 100%)${g >= 7 ? ' · 사용 횟수가 1회인 주문 1장은 +1회' : ''}`) },
  { id: 'pouch', name: '복주머니', category: 'tool', icon: 'pouch', hue: '#e8553d', weight: W_NORMAL,
    stack: '중첩 불가(도구 슬롯 1개) · 획득 확률 보정은 +15%p 상한 · 유료 뽑기권 확률에는 적용 안 됨',
    effects: E((g) => `봇전 결과로 아이템을 얻을 확률 +${[2, 3, 5, 6, 8, 9, 11, 12, 14, 15][g]}%p (뽑기권 확률은 변하지 않음)`) },
  { id: 'treasure', name: '금은 보따리', category: 'tool', icon: 'treasure', hue: '#e0b84a', weight: W_RARE,
    stack: '판을 이겼을 때만 · 은화와 금화는 따로 굴림 · 한 판에 각각 1개',
    effects: E((g) => `판을 이기면 ${[5, 6, 8, 10, 12, 14, 17, 20, 25, 30][g]}% 확률로 은화 1개, ${[0.5, 0.6, 0.8, 1, 1.2, 1.5, 2, 2.5, 3.5, 5][g]}% 확률로 금화 1개`) },
  { id: 'lantern', name: '도깨비불 등롱', category: 'tool', icon: 'lantern', hue: '#7fe3c1', weight: W_RARE,
    stack: '중첩 불가(도구 슬롯 1개) · 상대 손패는 알려 주지 않음(내가 못 본 패 전체의 장수·종류만, 규칙상 누구나 셀 수 있는 정보)',
    effects: [
      '월별로 아직 안 보인 패 장수를 표시 (내 손패에 든 월만)',
      '월별로 아직 안 보인 패 장수를 표시 (내 손패 + 바닥의 월)',
      '모든 월의 안 보인 패 장수를 표시',
      '모든 월의 안 보인 패 장수 + 광·열끗·띠·피 종류별 남은 수',
      '위 정보 + 상대가 먹은 패 종류별 합계',
      '위 정보 + 내 홍·청·초단·고도리 완성에 필요한 패가 남았는지 표시',
      '위 정보 + 최근 6번의 먹기 기록판',
      '위 정보 + 기록판 12번으로 확장, 안 보인 패 중 광이 있는 월 강조',
      '위 정보 + 상대가 7점까지 몇 점 남았는지 표시',
      '위 정보 + 판이 끝나면 "놓친 최선의 수" 복기 1개 제공',
    ] },

  // ===== 꾸미기 (cosmetic) — 능력치 없음 =====
  { id: 'cardback', name: '카드 뒷면', category: 'cosmetic', icon: 'cardback', hue: '#4f6fd1', weight: W_NORMAL,
    stack: '바탕은 늘 진짜 화투 뒷면, 등급에 따라 테두리·광택만 더함 · 능력치 없음',
    effects: ['진홍 화투 뒷면 + 흰 테두리', '진홍 화투 뒷면 + 흰 테두리', '진홍 화투 뒷면 + 이중 흰 테두리', '진홍 화투 뒷면 + 이중 흰 테두리', '진홍 화투 뒷면 + 금실 테두리', '진홍 화투 뒷면 + 금실 테두리', '진홍 화투 뒷면 + 금실 테두리와 은은한 빛', '진홍 화투 뒷면 + 금실 테두리와 은은한 빛', '진홍 화투 뒷면 + 흐르는 금빛 광택', '진홍 화투 뒷면 + 흐르는 금빛 광택'] },
  { id: 'theme', name: '판 테마', category: 'cosmetic', icon: 'table', hue: '#3a9d7a', weight: W_NORMAL,
    stack: '테마는 한 번에 1개만 적용 · 다른 꾸미기와 동시 사용 가능 · 능력치 없음',
    effects: ['기본 초록 모포', '한지 바탕', '대나무 숲', '소나무 병풍', '달밤 연못', '벚꽃 눈보라', '단풍 바람', '설경과 눈 내림', '은하수 아래 한옥 마당', '사계절이 흐르는 도깨비 시장'] },
  { id: 'effect', name: '먹기 이펙트', category: 'cosmetic', icon: 'spark', hue: '#ffd23a', weight: W_NORMAL,
    stack: '이펙트는 한 번에 1개만 적용 · 다른 꾸미기와 동시 사용 가능 · 능력치 없음',
    effects: ['작은 먼지', '반짝 한 번', '꽃잎 몇 장', '별가루', '불꽃 꼬리', '번개 번쩍', '용 비늘 파편', '도깨비불 소용돌이', '은하 폭죽', '화면 전체에 12달 꽃비와 무지개'] },
  { id: 'voice', name: '효과음 팩', category: 'cosmetic', icon: 'bell', hue: '#e8c06a', weight: W_NORMAL,
    stack: '효과음 팩은 한 번에 1개만 적용 · 다른 꾸미기와 동시 사용 가능 · 능력치 없음',
    effects: ['기본 소리', '가야금 한 줄', '장구 소리', '대금과 징', '풍물패 효과음', '판소리 추임새 "얼쑤"', '구미호 웃음과 방울 소리', '도깨비 방망이 팡팡 소리', '국악 오케스트라 편곡', '모든 이펙트에 맞춘 풀 연주와 승리 팡파르'] },
  { id: 'frame', name: '이름표 테두리', category: 'cosmetic', icon: 'frame', hue: '#b678e8', weight: W_NORMAL,
    stack: '테두리는 한 번에 1개만 적용 · 다른 꾸미기와 동시 사용 가능 · 능력치 없음',
    effects: ['얇은 회색 선', '연두색 선', '은색 줄', '청색 구름 테두리', '금실 테두리', '보라 비늘 테두리', '불꽃 금테', '주홍 용 문양 테두리', '무지개가 흐르는 테두리', '무지개 테두리와 해·달 회전 문양'] },
];

// ---------- 뽑기권 ----------
export type TicketGrade = 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S' | 'SS' | 'SSS' | 'SSS+';
export interface TicketSpec {
  id: string;
  name: string;
  desc: string;
  hue: string;
  /** 등급별 확률(%) — 합 100. 유료로 팔 경우 그대로 공개해야 함 */
  rates: Record<TicketGrade, number>;
  /** 이 등급 미만은 나오지 않음(최소 보장) */
  minGrade?: string;
}
export const TICKETS: TicketSpec[] = [
  { id: 'copper', name: '엽전권', desc: '엽전으로 사는 기본 뽑기권. 최소 보장 없음.', hue: '#c98a5a',
    rates: { F: 34, E: 24, D: 17, C: 11, B: 7, A: 4, S: 2, SS: 0.7, SSS: 0.25, 'SSS+': 0.05 } },
  { id: 'silver', name: '은화권', desc: '은화로 사는 뽑기권. 낮은 등급이 줄고 중간 등급이 늘어난다.', hue: '#c9d1d8',
    rates: { F: 20, E: 24, D: 20, C: 14, B: 10, A: 6, S: 3.5, SS: 1.8, SSS: 0.6, 'SSS+': 0.1 } },
  { id: 'gold', name: '금화권', desc: 'C~A 등급이 중심. S 이상도 눈에 띄게 늘어난다.', hue: '#f0c35a',
    rates: { F: 8, E: 14, D: 20, C: 20, B: 16, A: 11, S: 6.5, SS: 3, SSS: 1.2, 'SSS+': 0.3 } },
  { id: 'jade', name: '옥패권', desc: 'F·E는 나오지 않는다. 최소 D 보장.', hue: '#5bd1a0',
    rates: { F: 0, E: 0, D: 8, C: 24, B: 28, A: 20, S: 11, SS: 6, SSS: 2.4, 'SSS+': 0.6 }, minGrade: 'D' },
  { id: 'dragon', name: '용옥패권', desc: '가장 높은 단계. 최소 B 보장.', hue: '#3f9a78',
    rates: { F: 0, E: 0, D: 0, C: 0, B: 40, A: 30, S: 18, SS: 8, SSS: 3.2, 'SSS+': 0.8 }, minGrade: 'B' },
];

/** 판당 장착 한도 (꾸미기는 종류별 1개씩이라 5) */
export const EQUIP_LIMITS: Record<Category, number> = { spell: 2, talisman: 1, spirit: 1, event: 1, tool: 1, cosmetic: 5 };
