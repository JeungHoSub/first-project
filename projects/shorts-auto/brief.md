# 프로젝트: 쇼츠 편집 + 자동 업로드

## 목표
- **다른 프로젝트에서 만든 영상**을 다시 쓰거나 짜깁기해 쇼츠를 만들고 자동 업로드하는 파이프라인
- 원본: book-podcast(책 해설 명장면), music-video-upload(음악 하이라이트), claude-lecture(강의 핵심), 게임 프로젝트(플레이 영상) 등
- 쇼츠 → 본편 영상으로 유입시키는 역할 (설명란·고정 댓글에 본편 링크)

## 역할 분담
| 단계 | 담당 에이전트 | 하는 일 |
|---|---|---|
| 1 | planner | 원본 출처·처리 흐름·승인 단계 정의 |
| 2 | media-producer | 여러 프로젝트 영상에서 구간 선정 → 짜깁기 → 9:16 변환 → 자막 → 썸네일 |
| 3 | content-writer | 쇼츠 제목·설명·해시태그 |
| 4 | developer | 업로드 자동화(YouTube API), 예약·로그 |
| 5 | reviewer | 샘플 검수 → 사용자 승인 후 일괄 처리 |

## 필요한 스킬
- 있음: youtube-upload, copyright-check, handoff, request-review
- 필요 시 skill-scout: 자동 자막(음성 인식), 하이라이트 자동 감지

## 공유
- 업로드 모듈은 music-video-upload, book-podcast와 같이 쓴다 → `projects/shared/uploader/` (developer가 만들 때 생성)

## 결정됨 (2026-11-12)
- 원본 = 우리 다른 프로젝트 영상 (재사용·짜깁기)
- 원본 영상 안의 음악·책 인용도 원래 프로젝트의 rights.md 조건을 그대로 따른다

## 프로젝트 간 연결
- 각 프로젝트는 완성 영상과 함께 `outputs/shorts-candidates.md`(쇼츠로 쓸 만한 구간: 시작~끝 시간, 한 줄 이유)를 남긴다
- shorts-auto는 그 파일들을 모아 쇼츠를 만든다

## 확인 필요
1. 업로드 채널: A) 유튜브만 — 추천(처음엔) B) 유튜브 + 틱톡/인스타 릴스
2. 자동화 수준: A) 편집 자동 + 업로드 전 내가 승인 — 추천 B) 완전 자동
3. 채널: A) 프로젝트별 각 채널에 올림 B) 쇼츠 전용 채널 하나
