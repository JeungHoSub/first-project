# 매직고스톱 game (1단계: 기본 룰 엔진)

화면 없이 규칙 엔진만 있다. 순수 TypeScript, DOM 의존 없음. 상태는 JSON 직렬화 가능한 plain object.

## 실행
```bash
npm install
npm test        # vitest (카드/셔플/매칭/점수/고스톱/흔들기·폭탄/특수 룰/보너스/1000판 자동 대전)
npm run sim     # 랜덤 vs 랜덤 한 판 로그. 시드 지정: npm run sim -- 42
npm run typecheck
```

## 미리보기 화면 (사용자 확인용)
```bash
npm run dev          # 브라우저 개발 서버 (index.html)
npm run build:page   # 한 파일로 묶기 -> dist/magic-gostop.html (outputs/stage1-preview.html로 복사해 공유)
```
- `src/ui/` 화면(DOM). 엔진 상태를 그리기만 하고 규칙 판단은 엔진에 맡긴다.
- `src/ai/simple.ts` 임시 AI(먹을 수 있는 좋은 패 우선, 뒤집을 패는 보지 않음). 2단계에서 다듬는다.
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

## 아직 없는 것
총통(손패 4장)·바닥 2장일 때 3장 폭탄 등 변형·박·국진 선택·나가리 이월·바닥 동월 4장 재분배, 매직(4단계), 화면·AI(2단계).
자리만 있음: `RuleOptions.special/magic`, `EngineHooks`(`hooks.ts`, `magic.enabled=true`일 때만 호출), `state.events` 로그.
돈 개념 없음: 점수만 있다.
