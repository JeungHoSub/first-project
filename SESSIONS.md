# 세션 운영 가이드

**프로젝트 1개 = 세션 1개**가 원칙이다. 세션을 나누면 대화 맥락이 섞이지 않고, 크레딧도 덜 든다.
모든 세션은 같은 저장소를 쓰므로 에이전트·스킬·스타일 데이터는 공유되고, 결과물은 각자 `projects/<이름>/`에 쌓인다.

## 현재 운영 중인 세션 (2026-11-12 생성)

각 세션은 `main`에서 출발해 자기 브랜치(`project/<이름>`)에만 올린다. 총괄 세션이 검토 후 `main`에 합친다.

| 프로젝트 | 세션 제목 | 브랜치 |
|---|---|---|
| 총괄 | (이 시스템을 만든 세션) | claude/agent-system-setup-l8cy1a |
| 매직고스톱 | [매직고스톱] magic-gostop | project/magic-gostop |
| 술게임 | [술게임] drinking-game | project/drinking-game |
| 책 읽어주기 | [책 읽어주기] book-podcast | project/book-podcast |
| 쇼츠 자동화 | [쇼츠 자동화] shorts-auto | project/shorts-auto |
| 음악 업로드 | [음악 업로드] music-video-upload | project/music-video-upload |
| 입찰 플랫폼 | [입찰 플랫폼] g2b-bid-platform | project/g2b-bid-platform |
| 클로드 강의 | [클로드 강의] claude-lecture | project/claude-lecture |

## 새 세션 시작할 때 첫 메시지 (세션을 새로 열어야 할 때 복사해서 사용)

| 프로젝트 | 첫 메시지 |
|---|---|
| 클로드 강의 | `claude-lecture 프로젝트 이어서 하자. brief와 log 확인해줘` |
| 매직고스톱 | `magic-gostop 프로젝트 시작. brief의 확인 필요부터 물어봐줘` |
| 술게임 | `drinking-game 프로젝트 시작. brief의 확인 필요부터 물어봐줘` |
| 책 읽어주기 | `book-podcast 프로젝트 시작. brief의 확인 필요부터 물어봐줘` |
| 쇼츠 자동화 | `shorts-auto 프로젝트 시작. brief의 확인 필요부터 물어봐줘` |
| 음악 업로드 | `music-video-upload 프로젝트 시작. brief의 확인 필요부터 물어봐줘` |
| 입찰 플랫폼 | `g2b-bid-platform 프로젝트 시작. brief의 확인 필요부터 물어봐줘` |
| 전체 점검 | `전체 프로젝트 현황이랑 review/QUEUE.md 정리해줘` |

## 세션이 끝나기 전
- 결과물은 커밋·푸시한다 (클라우드 세션은 시간이 지나면 사라진다).
- `log.md`에 다음 할 일을 적어 둔다 → 다음 세션이 거기서 이어간다.

## 세션끼리 충돌 막기
- 각 세션은 자기 프로젝트 폴더만 고친다.
- 공용 파일(`style/`, `.claude/`, `review/QUEUE.md`, `projects/shared/`)을 고칠 때는 커밋 전에 최신 내용을 받아(pull) 합친다.
