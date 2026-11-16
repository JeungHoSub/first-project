# 매직고스톱 game (1단계: 기본 룰 엔진)

화면 없이 규칙 엔진만 있다. 순수 TypeScript, DOM 의존 없음. 상태는 JSON 직렬화 가능한 plain object.

## 실행
```bash
npm install
npm test        # vitest (카드/셔플/매칭/점수/고스톱/1000판 자동 대전)
npm run sim     # 랜덤 vs 랜덤 한 판 로그. 시드 지정: npm run sim -- 42
npm run typecheck
```

## 공개 API (`src/engine/index.ts`)
- `createGame(seed, options?)` -> `GameState` (같은 시드 = 같은 판)
- `getLegalActions(state)` -> `Action[]` (`play` / `choose` / `go` / `stop`)
- `applyAction(state, action, hooks?)` -> 새 `GameState` (불변, 불법 행동은 예외)
- `score(captured, options?)` -> `{ total, details }`, `settle(base, goCount, options?)`
- `countCards(state)` 카드 총합(48 보존 검사용), `createRng`, `shuffle`, `ALL_CARDS`

페이즈: `play`(손패 내기) -> `chooseMatch`(바닥 같은 월 2장 중 선택) -> `goStop`(7점 이상) -> `ended`(`state.result`).

## 1단계 범위
2인 맞고, 분배(10/8/20), 기본 매칭(0/1/2/3장), 기본 점수(광·열끗·고도리·띠·단·피), 고/스톱(+n, 3고 x2, 4고 x4), 나가리.

## 1단계 제외 (3단계 이후)
뻑·따닥·쪽·싹쓸이·피 뺏기·흔들기·폭탄·총통·박·국진 선택·나가리 이월·바닥 동월 4장 재분배, 매직(4단계), 화면·AI(2단계).
자리만 있음: `RuleOptions.special/magic`, `EngineHooks`(`hooks.ts`, `magic.enabled=true`일 때만 호출), `state.events` 로그.
돈 개념 없음: 점수만 있다.
