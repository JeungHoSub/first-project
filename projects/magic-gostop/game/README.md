# 매직고스톱 game (1단계: 기본 룰 엔진)

화면 없이 규칙 엔진만 있다. 순수 TypeScript, DOM 의존 없음. 상태는 JSON 직렬화 가능한 plain object.

## 실행
```bash
npm install
npm test        # vitest (총통·박·국진·이월 포함, 카드/셔플/매칭/점수/고스톱/흔들기·폭탄/특수 룰/보너스/1000판 자동 대전)
npm run sim     # 랜덤 vs 랜덤 한 판 로그. 시드 지정: npm run sim -- 42
npm run typecheck
```

## 미리보기 화면 (사용자 확인용)
```bash
npm run dev          # 브라우저 개발 서버 (index.html)
npm run build:page   # 한 파일로 묶기 -> dist/magic-gostop.html (outputs/stage1-preview.html로 복사해 공유)
```
- `src/ui/` 화면(DOM). 엔진 상태를 그리기만 하고 규칙 판단은 엔진에 맡긴다.
- AI는 아래 "AI" 절 참고 (`src/ai/`).
- 엔진 타입 검사는 DOM 없이(`tsconfig.json`), 화면은 `tsconfig.ui.json`으로 따로 검사한다.

## 공개 API (`src/engine/index.ts`)
- `createGame(seed, options?)` -> `GameState` (같은 시드 = 같은 판)
- `getLegalActions(state)` -> `Action[]` (`play`(+`shake:true` 변형) / `bomb` / `dummy` / `choose` / `go` / `stop`)
- `applyAction(state, action, hooks?)` -> 새 `GameState` (불변, 불법 행동은 예외)
- `score(captured, options?)` -> `{ total, details }`, `settle(base, goCount, options?)`
- `countCards(state)` 카드 총합(48 보존 검사용), `createRng`, `shuffle`, `ALL_CARDS`

페이즈: `play`(손패 내기) -> `chooseMatch`(바닥 같은 월 2장 중 선택) -> `goStop`(7점 이상) -> `ended`(`state.result`).

## 1단계 범위
2인 맞고, 분배(10/8/20), 기본 매칭(0/1/2/3장), 기본 점수(광·열끗·고도리·띠·단·피), 고/스톱(+n, 3고 x2, 4고 x4), 나가리,
흔들기(손패 같은 월 3장 + 바닥 0장, 선언 시 x2 누적, `play`+`shake:true`), 폭탄(손패 3장 + 바닥 1장, 4장 획득 + 상대 피 1장 + 빈 패 2장 + x2, `bomb`), 빈 패 내기(`dummy`: 손패 없이 더미만 뒤집기).
배수는 `state.shakes`(흔들기+폭탄 횟수), 빈 패는 `state.dummies`. 정산 시 이긴 사람 기준 `shakeMultiplier`(2^횟수)가 finalScore에 곱해진다. `special.shake/bomb` 기본 true.

## 특수 룰 (뻑·쪽·따닥·싹쓸이·뻑 먹기) 와 정산 구조
한 차례 = 손패 내기(또는 폭탄/빈 패) -> **더미 뒤집기** -> 두 장을 함께 보고 정산 (rules.md 3.2/3.3).
- 이벤트 순서: `play`(또는 `bomb`/`dummy`) -> `flip` -> [`ppeok` | `jjok` | `ttadak` | `ppeokEat`] -> `capture`/`place` -> `steal`들 -> [`sweep` -> `steal`]. flip 전에는 capture가 나오지 않는다(더미가 비어 flip이 없으면 바로 정산). 폭탄의 피 1장은 예전처럼 bomb 직후 바로 나온다.
- 뻑: 바닥 1장 + 손패 짝 + 뒤집은 패 같은 월 -> 3장 바닥에 남음(`place` 없이 `ppeok` 이벤트의 `cards`가 3장 전체), `state.ppeok[월] = 싼 사람`. 그 월을 먹으면 기록 삭제. 뻑 먹기는 남 1장 / 자뻑 2장(R09), 3연뻑 특수 처리 없음.
- 쪽(`jjok`): 바닥에 없던 월을 손패로 놓고 뒤집은 패가 같은 월 -> 2장 + 피 1장. 따닥(`ttadak`): 바닥 2장 + 손패 + 뒤집은 패 -> 4장 + 피 1장(고르기 없음).
- 싹쓸이: 차례 정산이 끝났을 때 바닥이 비면 피 1장(마지막 턴 포함, R16). 피 가져오기는 일반 피 -> 쌍피 -> 보너스 2피 -> 보너스 3피 순(R18, 없으면 못 가져옴). 차례 중 쌓인 피 가져오기는 `state.stealDue`에 모였다가 차례 끝에 한꺼번에.
- `special.ppeok/ttadak/jjok/sweep` 기본 true. 끄면 그 룰 없이 1단계 단순 처리(손패 -> 더미 순서).
- **고르기 시점 정책**: 뒤집기는 항상 고르기보다 먼저 끝난다. 고르기는 정산 중 "정확히 2장 중 선택"이 필요할 때만 대기한다. 손패가 2장 중 고르기 상태여도 뒤집은 패가 같은 월이면 따닥이라 고르지 않는다. 손패 쪽 대기(`pending.source==='hand'`) 중에는 이미 뒤집은 패가 `pending.later`에 보관되며(바닥·손에 없음), 고른 뒤 이어서 정산된다. 그 패가 또 2장 중 선택이 필요하면 다시 대기(`source==='flip'`). 효과 이벤트(뻑/쪽/따닥/뻑 먹기)는 첫 대기 전에 미리 나온다. `countCards`는 `pending.card`와 `pending.later`를 함께 센다.
- 훅 `afterPlay`/`afterFlip`은 정산이 끝난 뒤 연달아 호출된다.

## 보너스 패
`RuleOptions.bonus = { two: 2, three: 1 }` (기본). 덱 = 48 + 2피 2장(`13-B2-0/1`, kind `B2`) + 3피 1장(`13-B3-0`, kind `B3`), month 13. 둘 다 0이면 48장. 피 장수 값: P1 / D2 / B2=2 / B3=3.
- 손패에서 내면: `bonus`(from 'hand') -> `draw`(더미 맨 위를 손패로). 차례는 그대로 `play`. 더미가 비면 획득만. 더 낼 패가 없으면 차례 종료.
- 뒤집으면: `flip` -> `bonus`(from 'flip') -> 다음 `flip` (연속 가능).
- 처음 분배: 바닥의 보너스는 선이 가져가고 더미에서 채움 -> `bonus`(from 'deal'), `deal` 이벤트 뒤에 나온다.
- `ALL_CARDS`는 계속 기본 48장. 보너스는 `buildBonusCards`. `countCards`는 덱 전체 장수(48 또는 51).

## 3단계 특수 룰 (총통·박·국진·나가리 이월·재분배)
- **총통**(R11): 분배 직후 손패 같은 월 4장이면 그 사람 즉시 승리 10점. 둘 다면 선 우선. 흔들기·고·박·이월 배수 없음. `createGame`이 돌려준 state가 이미 `phase:'ended'`, `result.by==='chongtong'`. 이벤트 `deal` -> (`redeal`) -> (`bonus` from deal) -> `chongtong{player,month,cards}` -> `end`. `special.chongtong`(기본 true)로 끔.
- **재분배**(R15): 분배 직후 바닥 같은 월 4장이면 시드+`#re1`, `#re2`...로 결정적으로 다시 섞는다. 횟수만큼 `{type:'redeal',reason:'floor4'}` 이벤트. `state.seed`는 원래 시드.
- **박**(R08 곱셈, 패자 기준, `special.bak` 기본 true): 피박 = 승자가 피 점수(피 10장+)를 냈고 패자 피 합(쌍피·보너스 포함) 0~5. 광박 = 승자 광 점수 + 패자 광 0장. 멍따 = 승자 열끗 7장 이상(패자 조건 없음). 각 x2.
- **국진**(R04, `special.gukjin:'auto'`): `score()`가 열끗/쌍피 중 총점이 높은 쪽(같으면 열끗)을 매번 자동 선택. `ScoreResult.gukjin`('yeol'|'pi'|null)과 details label("국진→쌍피")로 확인. 정산(`settleWin`)은 승자의 최종 점수가 더 큰 쪽을, 패자는 쌍피로 세어 피박 판정(유리하게). 피 가져오기 대상에서는 항상 제외(kind가 Y라서). `score(captured, options, 'yeol'|'pi')`로 고정도 가능.
- **나가리 이월**(R12): `createGame(seed, { carry })`(기본 1)이 승자 finalScore에 곱해진다. 나가리 결과 `nextCarry = min(carry*2, 4)`, 승리 결과 `nextCarry = 1`. 화면이 다음 판 `createGame`에 넘긴다.
- **바닥 3장 먹기**: 뻑이든 아니든 바닥 같은 월 3장을 4장째로 먹으면 `ppeokEat{player,month,self,fromPpeok}`. 남이 싼 뻑 1장 / 자뻑 2장 / 뻑이 아닌 3장(`fromPpeok:false`) 1장을 `stealDue`로 가져온다.
- 결과 타입: `win{ ..., bak:{pi,gwang,meong}, bakMultiplier, carry, nextCarry, finalScore, by:'stop'|'exhaust'|'chongtong' }`, `nagari{ nextCarry }`. finalScore = (기본 + 고가산) x 고배수 x 흔들기·폭탄 x 박 x carry. `settle(base, goCount, options, shakes, bakMultiplier=1, carry=1)`.

## AI (`src/ai/`)
```ts
import { chooseAction, AI_LEVELS, type AiLevel } from './ai/simple'; // 또는 './ai' (index.ts)
chooseAction(state)                 // 쉬움 (기존 호출 그대로)
chooseAction(state, 'normal')       // 보통
chooseAction(state, 'hard', { rng, samples, candidates })   // 어려움. 옵션은 모두 선택 (rng: 표본 난수, 테스트용 주입)
```
- 항상 `getLegalActions(state)` 중 하나를 돌려준다. phase `play`/`chooseMatch`/`goStop`, 흔들기·폭탄·빈 패·보너스 패 모두 처리.
- **패 분배는 난이도와 무관하게 항상 무작위**(`createGame(seed)`). AI는 덱·시드에 손대지 않는다.
- **반칙 없음**: `observe(state, me)`(`observe.ts`)가 "보이는 정보"만 담은 뷰 `View`를 만들고, 보통·어려움은 이 뷰만 쓴다. 뷰에는 내 손패·바닥·양쪽 먹은 패·상대 손패 *장수*·더미 *장수*·고/흔들기/빈 패 횟수·공개 이벤트만 있고, 상대 손패·더미는 내용 없이 **미지 카드 집합 `unseen`**(= 상대 손패 + 더미)으로만 들어 있다. 이벤트의 시드와 상대가 더미에서 받은 카드(`draw`)는 지운다. 흔들기·폭탄으로 상대가 공개한 카드는 `oppKnown`.
- **쉬움**(`simple.ts`): 먹을 수 있는 좋은 패 우선, 못 먹으면 가치 낮은 패 버리기, 폭탄·보너스 즉시, 점수 10 미만·손패 3장 이상이면 고.
- **보통**(`normal.ts`): 휴리스틱. 행동마다 (먹는 패 가치 = 광 3장·고도리·홍/청/초단 남은 장·피 10장·열끗/띠 5장 진행도 변화) + (상대가 노리는 족보를 막는 가치, 상대가 그 월 패를 가졌을 확률은 `unseen`으로 계산) − (바닥에 낸 패를 상대가 먹을 위험) − (뻑 위험: 바닥 1장 + 미지 카드에 같은 월이 남음, 내가 나머지를 쥐고 있으면 안전) + (쪽·따닥 기대), 같은 월 2장 + 나머지 2장이 다 나온 "안전 패"는 아주 약하게 뒤로 미룸. 고/스톱은 남은 손패·상대 점수와 족보 진행·박 위험을 보고 `고의 기대 점수 vs 스톱 점수`로 판단(`goStopMargin`). 튜닝 값은 `TUNE`.
- **어려움**(`hard.ts`): 후보 행동(보통 점수 상위 4개)마다 `determinize(view)`로 미지 카드를 상대 손패·더미에 무작위 배정한 표본 24개를 만들고, 엔진 `applyAction`으로 보통 정책을 양쪽에 써서 두 차례(내 수 + 상대 응수) 둔 뒤 족보 진행도 차이로 평가해 평균이 좋은 행동을 고른다(같은 표본을 모든 후보에 써서 비교 오차를 줄이고, 보통의 1순위를 유의하게 넘을 때만 바꿈). 판이 끝나면 실제 점수. 고/스톱은 보통의 판단식을 쓴다.

측정 결과(선·후 번갈아, 나가리 제외 승률): 보통 vs 쉬움 2000판 55.6%·판당 점수차 +11.4, 어려움 vs 보통 2500판 약 53.5%·+3 안팎(점수차는 오차가 커서 ±4), 어려움 vs 쉬움 300판 58.7%. 어려움 한 수는 node 평균 약 22ms·최대 약 70ms(표본 24, 후보 4).

대전 측정: `npm run ai-match -- <A> <B> [판수] [시드접두]` (같은 시드를 선·후 번갈아, 승률·평균 점수차·한 수 시간). 테스트: `tests/ai.test.ts`.

## 아직 없는 것
바닥 2장일 때 3장 폭탄 등 변형, 매직(4단계). 화면·AI는 별도(`src/ui`, `src/ai`).
자리만 있음: `RuleOptions.magic`, `EngineHooks`(`hooks.ts`, `magic.enabled=true`일 때만 호출), `state.events` 로그.
돈 개념 없음: 점수만 있다.
