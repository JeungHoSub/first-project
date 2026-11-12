# 작업 로그

## 2026-11-12 총괄(메인 세션)
- 한 일: 프로젝트 공간 생성, 담당 에이전트·스킬 배정
- 결과물: brief.md
- 다음 담당: 사용자 — 기존 강의 1편을 `source/`에 붙여넣기
- 넘길 메모: 1편이 들어오면 lecture-writer가 스타일 분석 후 커리큘럼 제안

## 2026-11-12 lecture-writer
- 한 일: 출퇴근 오디오용 Claude 강의 12회 커리큘럼 임시 초안 작성(대본 아님). 흐름: 기본 → 프롬프트(2회) → 개인 지침·프로젝트 → 취향 데이터 → Claude Code → CLAUDE.md·메모리 → 스킬 → 서브에이전트 → 파일 인계 → 여러 세션 운영 → Remote Control·전체 지도. 8~12회는 이 저장소 시스템을 사례로 씀. 공식 문서(code.claude.com, support.claude.com, platform.claude.com)로 기능 확인, 확인 못 한 것은 ⚠️ 미확인 표시.
- 결과물: outputs/curriculum-draft.md
- 다음 담당: reviewer
- 넘길 메모: 미확인 — 모델 라인업, 요금제·한도, 대화 메모리·맞춤 스타일 제공 범위, CLAUDE.md 권장 길이, 병렬 세션 화면 기능 이름, skills/sub-agents 문서 후반부. 요금 관련은 대본 작성 시점에 재확인.

## 2026-11-12 reviewer
- 한 일: 커리큘럼 초안 1차 검수. 판정: 수정 후 통과(임시 초안 기준). 직접 수정 4건(9회 reviewer 권한 설명 정정, 7회 개념 3개로 정리, 1회·12회 ⚠️ 미확인 추가).
- 결과물: outputs/curriculum-draft-review.md, outputs/curriculum-draft.md(수정 반영)
- 다음 담당: 사용자 — 기존 강의 1편을 `source/`에 넣기 (2026-11-13 Remote Control로 PC에서 가져올 예정)
- 넘길 메모: 1편이 들어오면 lecture-writer가 말투·구성 분석 → 1편 위치(가정 A/B/C) 확정 → curriculum-draft-v2.md 작성 → reviewer 재검수. 그때 같이 정할 제안: 5회가 Claude Code(6회) 전에 파일 개념을 전제함, 6회 개념 1·2 불일치, 12회 Remote Control/전체 지도 분리 여부, 분량 기준(brief 3,000~5,000자 vs 스킬 3,000~6,000자), 빈틈 후보(권한 승인·민감정보·MCP). review/QUEUE.md 등록은 이 세션 범위 밖이라 하지 않음.
