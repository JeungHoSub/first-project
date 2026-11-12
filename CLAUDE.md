# 에이전트 작업 시스템

이 저장소는 "사용자 스타일 데이터 → 프로젝트별 에이전트 → 결과물 공유 → 사용자 검토" 흐름으로 일하는 시스템이다.
모든 응답과 문서는 **한국어**로 작성한다.

## 구조

| 위치 | 역할 |
|---|---|
| `style/` | 사용자의 취향·문체·선호 데이터. 모든 에이전트가 작업 전에 읽는다. |
| `.claude/agents/` | 역할별 에이전트 정의 |
| `.claude/skills/` | 에이전트가 쓰는 스킬(작업 절차서) |
| `projects/<이름>/` | 프로젝트별 작업 공간. `brief.md`(목표), `log.md`(진행·인계 기록), `outputs/`(결과물) |
| `review/QUEUE.md` | 사용자 검토 대기열. 사용자는 여기만 보면 된다. |

## 프로젝트와 담당 에이전트

에이전트는 **역할별**로 두고 여러 프로젝트가 같이 쓴다. 프로젝트 고유 내용은 `brief.md`와 전용 스킬에 있다.

| 프로젝트 | 폴더 | 주요 담당 | 전용 스킬 |
|---|---|---|---|
| 클로드 강의 | `claude-lecture` | lecture-writer | audio-lecture-script |
| 매직고스톱 | `magic-gostop` | planner → game-designer → developer | — |
| 술게임 | `drinking-game` | planner → game-designer → developer | — |
| 책 읽어주기 유튜브 | `book-podcast` | researcher → content-writer → media-producer | copyright-check, youtube-upload |
| 쇼츠 편집·자동업로드 | `shorts-auto` | media-producer → content-writer → developer | youtube-upload, copyright-check |
| 음악·동영상 업로드 | `music-video-upload` | researcher → media-producer → developer | copyright-check, youtube-upload |
| 입찰 플랫폼 | `g2b-bid-platform` | researcher → planner → developer | g2b-bid-data |

공통: 모든 프로젝트의 마지막은 `reviewer` → 사용자 검토. 스킬이 없으면 `skill-scout`.
업로드 모듈처럼 여러 프로젝트가 같이 쓰는 코드는 `projects/shared/`에 둔다.
세션 운영 방법은 `SESSIONS.md`, 할 일은 `TODO.md`.

## 메인 세션(= 총괄 매니저)의 규칙

메인 Claude 세션이 오케스트레이터다. 사용자가 일을 주면:

1. **프로젝트 확인** — `projects/<이름>/brief.md`를 읽는다. 없으면 `projects/_template`을 복사해 만들고 목표를 적는다.
2. **스타일 로드** — `style/style-guide.md`를 확인한다.
3. **담당 에이전트 배정** — 프로젝트에 맞는 에이전트에 일을 넘긴다. 맞는 에이전트가 없으면 사용자에게 새 에이전트를 만들지 선택지를 준다.
4. **스킬 부족 시** — `skill-scout` 에이전트를 불러 필요한 스킬을 찾거나 초안을 만든다.
5. **인계** — 에이전트끼리 결과물은 `projects/<이름>/outputs/`에 파일로 남기고 `log.md`에 기록한다(`handoff` 스킬). 다음 에이전트는 그 파일을 읽고 이어서 작업한다.
6. **품질 확인** — 사용자에게 넘기기 전 `reviewer` 에이전트가 1차 검수한다.
7. **검토 요청** — `review/QUEUE.md`에 항목을 추가하고(`request-review` 스킬) 사용자에게 알린다.

## 원칙

- 크레딧·시간 절약: 짧은 작업은 메인 세션이 직접 한다. 여러 단계·대량 작업일 때만 에이전트를 쓴다.
- 판단이 애매하면 멈추고 사용자에게 2~4개 선택지를 준다(추천안 표시).
- 사용자가 피드백을 주면 반복될 만한 것은 `style/style-guide.md`의 "학습된 선호"에 추가한다. 이렇게 스타일 데이터가 쌓인다.
- 결과물은 반드시 파일로 남기고 커밋한다(클라우드 세션은 끝나면 사라짐).
