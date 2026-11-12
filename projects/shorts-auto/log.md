# 작업 로그

## 2026-11-12 총괄(메인 세션)
- 한 일: 프로젝트 등록, 역할·담당 에이전트 배정
- 결과물: brief.md
- 다음 담당: 사용자 — brief.md의 "확인 필요" 답변
- 넘길 메모: 답변이 오면 planner가 spec.md / roadmap.md 작성

## 2026-11-12 researcher
- 한 일: YouTube Shorts 규격, YouTube Data API 할당량·미감사 프로젝트 비공개 제한, 틱톡/릴스 자동 업로드 가능 여부, 재사용 콘텐츠 정책 조사
- 결과물: outputs/research-shorts.md
- 다음 담당: planner
- 넘길 메모: 공식 문서 도메인(support.google.com, developers.google.com, developers.tiktok.com, developers.facebook.com)이 세션에서 차단되어 원문 미확인. 검색 요약·제3자 자료 기준이며 확인 수준을 문서에 표시함. videos.insert 비용(1,600단위 vs 최근 인하설)이 엇갈림 → 구현 전 실측.

## 2026-11-12 planner
- 한 일: 기능 명세·로드맵 초안 작성(shorts-candidates.md 표준 형식, 10단계 처리 흐름, 승인 단계, 폴더 구조, 공유 업로더 projects/shared/uploader/ 설계 — 코드 없음)
- 결과물: outputs/spec.md, outputs/roadmap.md
- 다음 담당: reviewer

## 2026-11-12 reviewer
- 한 일: research·spec·roadmap 1차 검수, spec.md 사소한 문구 직접 수정
- 결과물: outputs/review-plan.md (판정: 조건부 통과 — 높음 2건: 실행 장소 미정, 승인과 파일 미연결)
- 다음 담당: planner

## 2026-11-12 planner (검수 반영)
- 한 일: 검수 지적 반영본 작성 — 실행 장소(클라우드=후보·계획·메타, 내 PC=렌더·업로드), approval.yaml 해시 연결, 후보 템플릿 개선(여러 영상·전역 ID·SHORTS_SRC_ROOT 상대경로·최소 예시), 쉬운 요약 5줄
- 결과물: outputs/spec-v2.md, outputs/roadmap-v2.md (v1 대비 변경분)
- 다음 담당: 사용자 — 아래 질문 답변
- 넘길 메모:
  - **사용자 질문** (기본 가정 = 추천안, spec-v2 마지막 절 참고)
    1. 실행 장소: A) 후보·계획·메타는 클라우드, 렌더·업로드는 내 PC — 추천 B) 전부 내 PC C) 전부 클라우드(비추천)
    2. 업로드 채널: A) 유튜브만 — 추천 B) 유튜브 + 틱톡/릴스 자동 C) 유튜브 자동 + 틱톡/릴스는 파일만 내보내 수동
    3. 자동화 수준: A) 편집 자동 + 업로드 전 내가 승인 — 추천 B) 완전 자동
    4. 채널 구조: A) 프로젝트별 각 채널(본편 연결·유입에 유리) — 추천 B) 쇼츠 전용 채널 하나 C) 임시 전용 채널 후 이전
    5-1. 시범 프로젝트: A) 완성 영상이 가장 먼저 나오는 한 곳 — 추천 B) 책 해설 먼저 C) 여러 곳 동시
    5-2. 원본 보관: A) 내 PC의 한 폴더(SHORTS_SRC_ROOT) — 추천 B) 동기화되는 개인 클라우드 폴더 C) git LFS(비추천)
  - **총괄 후속 조치(이번 세션 범위 밖이라 보류)**
    - 루트 .gitignore에 spec-v2 7절 목록(work/, renders 영상, client_secret*.json, token*.json, state/, uploader.yaml, shared/uploader/secrets/) 추가 — 코드 작성 전 필수
    - .claude/skills/youtube-upload/SKILL.md의 "1,600단위·하루 약 6개"는 실측 후 수정
    - brief.md의 "설명란·고정 댓글에 본편 링크" 전제는 리서치상 불확실 → Studio '관련 동영상' 연결(사람이 수동)로 갱신 검토
    - 공식 문서 재조사를 원하면 위 4개 도메인을 네트워크 허용 목록에 추가
    - 다른 프로젝트(book-podcast, music-video-upload, claude-lecture)에 shorts-candidates.md 템플릿(spec-v2 5절) 안내 필요
    - 게임 프로젝트 영상은 사행성·음주 표현 검토 필요로 2단계 이후
