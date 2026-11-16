# 매직고스톱 game (1단계: 기본 룰 엔진)

화면 없이 규칙 엔진만 있다. 순수 TypeScript, DOM 의존 없음. 상태는 JSON 직렬화 가능한 plain object.

## 실행
```bash
npm install
npm test        # vitest (카드/셔플/매칭/점수/고스톱/1000판 자동 대전)
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

## 1단계 제외 (3단계 이후)
뻑·따닥·쪽·싹쓸이·피 뺏기(폭탄의 피 1장 제외)·총통(손패 4장)·바닥 2장일 때 3장 폭탄 등 변형·박·국진 선택·나가리 이월·바닥 동월 4장 재분배, 매직(4단계), 화면·AI(2단계).
자리만 있음: `RuleOptions.special/magic`, `EngineHooks`(`hooks.ts`, `magic.enabled=true`일 때만 호출), `state.events` 로그.
돈 개념 없음: 점수만 있다.
