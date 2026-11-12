# 프로젝트: 쇼츠 편집 + 자동 업로드

## 목표
- 원본 영상에서 쇼츠를 잘라 편집(세로 변환·자막)하고 자동 업로드하는 파이프라인

## 역할 분담
| 단계 | 담당 에이전트 | 하는 일 |
|---|---|---|
| 1 | planner | 원본 출처·처리 흐름·승인 단계 정의 |
| 2 | media-producer | 하이라이트 구간 선정 → 9:16 변환 → 자막 → 썸네일 |
| 3 | content-writer | 쇼츠 제목·설명·해시태그 |
| 4 | developer | 업로드 자동화(YouTube API), 예약·로그 |
| 5 | reviewer | 샘플 검수 → 사용자 승인 후 일괄 처리 |

## 필요한 스킬
- 있음: youtube-upload, copyright-check, handoff, request-review
- 필요 시 skill-scout: 자동 자막(음성 인식), 하이라이트 자동 감지

## 공유
- 업로드 모듈은 music-video-upload, book-podcast와 같이 쓴다 → `projects/shared/uploader/` (developer가 만들 때 생성)

## 확인 필요
1. 원본 영상: A) 내가 찍은/만든 영상 — 추천 B) 다른 프로젝트(책읽기·음악) 영상 재가공 C) 남의 영상(저작권 문제로 비추천)
2. 업로드 채널: A) 유튜브만 B) 유튜브 + 틱톡/인스타 릴스
3. 자동화 수준: A) 편집 자동 + 업로드 전 내가 승인 — 추천 B) 완전 자동
