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

## 2026-11-13 총괄(메인 세션)
- 한 일: 사용자 1화 유튜브 공개 확인(https://youtu.be/G1DZntyZjBQ — 이 세션에서 유튜브 접속이 막혀 내용은 못 봄). 2~12화 대본을 저장소 전 브랜치에서 찾았으나 없음. 일레븐랩스 대체 무료 TTS 조사.
- 결과물: outputs/tts-alternatives.md
- 다음 담당: 사용자 — 2~12화 대본(또는 1화 대본)을 source/에 넣기, TTS 후보 선택
- 넘길 메모: 사용자 방향 = 12화까지 완결 후 부족한 부분 리뷰. 대본이 들어오면 reviewer가 12화 전체 검수 → 보강 회차 기획.

## 2026-11-13 총괄(메인 세션)
- 한 일: Google Cloud TTS 변환 스크립트 작성(챕터별 mp3 → episode.mp3, 진행자/해설자 2목소리, 챕터 시각 출력, 챕터 단위 재생성). 대본 파싱만 오프라인 테스트, 실제 API 호출은 키가 없어 미실행.
- 결과물: tools/gcloud_tts.py
- 다음 담당: 사용자 — (1) PC의 '강의 만들기' 세션 결과물(EP001 대본, EP002 research·outline·대본, 파이프라인 문서)을 이 저장소 project/claude-lecture 브랜치에 푸시 (2) Google Cloud TTS API 키를 환경 설정에 등록
- 넘길 메모: EP001·EP002는 PC 로컬 세션(앱이 만든 폴더)에서 만들어져 GitHub에 없음 → 클라우드 세션들은 내용을 볼 수 없다. 앞으로 모든 결과물은 이 저장소에 커밋·푸시하는 것으로 통일 필요. 기본 음성 ko-KR-Neural2-A(진행자)/C(해설자), 키 등록 후 list-voices로 Chirp3-HD 음성도 비교.
