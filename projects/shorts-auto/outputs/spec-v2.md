# 쇼츠 편집 + 자동 업로드 기능 명세 v2

- 작성: planner / 2026-11-12 (v1 `spec.md` + reviewer 검수 `review-plan.md` 반영. v1은 그대로 둠)
- 표시 규칙: **[기본 가정]** = 사용자 답변 전 추천안을 임시로 쓴 것. **[구현 전 실측]** = 리서치 수치가 엇갈려 단정하지 않은 것.
- 정책·법률 내용은 일반 정보이며 확정 판단은 공식 문서·전문가 확인이 필요하다.

## 쉬운 요약 (5줄)
1. 우리가 이미 만든 영상(책 해설, 음악, 강의)에서 하이라이트 구간을 골라 세로 쇼츠로 잘라 올리는 일이다.
2. 각 프로젝트가 "쓸 만한 구간 목록"(`shorts-candidates.md`)을 남기면, 이쪽에서 모아 자르고 자막을 입힌다.
3. 택배 보내기 전 확인하듯, **올리기 전에 반드시 내가 승인**한다. 승인한 그 파일만 나간다(파일이 바뀌면 거부).
4. 처음엔 **비공개로 올리고**, 내가 YouTube Studio에서 본편을 연결하고 공개로 바꾼다.
5. 같은 쇼츠를 두 번 올리지 않게 기록(upload-log.csv)을 남기고, 영상 파일과 비밀번호 같은 파일은 저장소에 올리지 않는다.

---

## 1. 목표와 사용자
- 다른 프로젝트 영상을 재사용·짜깁기해 쇼츠를 만들고, 본편 영상으로 유입시킨다.
- 편집은 자동, 업로드 전 사람 승인 [기본 가정].
- 업로드 모듈은 `projects/shared/uploader/`로 빼서 music-video-upload, book-podcast도 쓴다(재활용 선호).
- 사용자: 채널 주인(승인·Studio 마무리), 다른 프로젝트 에이전트(후보 작성), shorts-auto 에이전트들.

## 2. 범위
- **MVP(1~2주)**: 표준 후보 형식 확정 → 쇼츠 1편 렌더(9:16, 자막, 썸네일) → 메타 → 사람 승인 → 비공개 업로드 → 사용자가 Studio에서 공개 → 로그.
- **이후**: 자동 수집(scan), 배치 처리, 짜깁기, 자동 자막, 예약 공개, API 감사, TikTok/Reels(처음엔 파일 내보내기).
- **안 함(지금)**: 완전 자동 업로드, 남의 영상 사용, TikTok/Reels API 자동 게시.

## 3. 기본 가정 요약
| 항목 | 기본 가정 |
|---|---|
| 업로드 채널 | 유튜브만 |
| 자동화 수준 | 편집 자동 + 업로드 전 사람 승인 |
| 채널 구조 | 프로젝트별 각 채널 |
| 공개 방식 | 비공개 업로드 → 사람이 Studio에서 확인·본편 연결·공개 |
| **실행 장소(신규)** | **후보·계획·메타데이터는 클라우드 세션, 렌더·업로드는 사용자 PC** |
| 하루 상한 | 3개(설정값, 할당량 실측 전 보수적) |
| 규격 | 1080x1920, 30fps, 3분 이하(처음엔 15~60초 권장) |

## 4. 실행 장소 (신규, H1 반영)
이유: 원본 영상은 사용자 PC에 있고, 토큰은 git에 못 올리고, OAuth 브라우저 로그인은 PC에서만 된다. 클라우드 세션은 끝나면 사라진다.

| 작업 | 어디서 | 이유 |
|---|---|---|
| 후보 작성·수집(scan), 권리 확인, 편집 계획, 메타데이터, 검수 문서 | 클라우드 세션(저장소 커밋) | 텍스트 파일뿐. 원본 영상 불필요 |
| ffmpeg 렌더(자르기·9:16·자막·썸네일) | **사용자 PC** | 원본 영상이 PC에 있음 |
| OAuth 로그인, 업로드 | **사용자 PC** | 비밀 파일·브라우저 로그인 |
| 승인 | 사용자 → 총괄이 `approval.yaml` 기록(클라우드) | 아래 8절 |

- PC에서 할 일은 저장소를 받아(`git pull`) 스크립트 한두 개를 실행하는 수준으로 한다(렌더 `render`, 업로드 `uploader upload`). 사용자가 어려우면 대안은 14절 질문 1번.
- 클라우드에서 만든 `edit-plan.yaml`·`metadata.yaml`·`approval.yaml`을 PC가 받아 쓰고, 렌더 결과의 **해시**(`file_sha256`)를 다시 클라우드로 돌려줘야 승인 연결이 되므로 PC 쪽 렌더는 `renders/<쇼츠ID>/render-info.yaml`(해시·길이·해상도)을 커밋한다(영상 파일 자체는 커밋 안 함).
- 흐름 순서 주의: 승인은 **렌더 완료 후**(사용자가 영상을 직접 본 뒤)에 한다. 따라서 "계획·메타(클라우드) → 렌더(PC) → render-info 커밋 → 검수·승인(클라우드, 사용자가 PC에서 영상 확인) → 업로드(PC)" 순이다.

## 5. 입력 표준: `shorts-candidates.md`

각 프로젝트는 `projects/<이름>/outputs/shorts-candidates.md`를 남긴다. **파일 안에 YAML 블록 2개**: ① 공통(영상 목록·권리) ② 후보 목록. 후보는 목록 항목 하나당 하나다.

### 규칙
- **ID는 전역 유일**: 영상 ID = `<프로젝트>/<영상ID>` (예: `book-podcast/ep003`). 후보 ID = `<프로젝트>-<영상ID>-c<번호>` (예: `book-podcast-ep003-c01`). 짜깁기에서 다른 프로젝트 영상을 섞어도 충돌하지 않는다.
- **영상은 여러 편 지원**: `source_videos:` 목록. 모든 후보(single 포함)에 `video` 필드로 영상을 지정한다.
- **원본 경로는 git 밖**: 경로는 `${SHORTS_SRC_ROOT}` 환경변수(원본이 있는 PC 폴더) 기준 **상대경로**로 쓴다. 저장소 안 경로를 쓰지 않는다. 절대경로·사용자 이름이 들어간 경로 금지. (사용자 PC 설정에서 `SHORTS_SRC_ROOT`만 지정하면 됨)
- **시간 표기**: `HH:MM:SS.s` 문자열(따옴표). 한 후보는 3분 이하, 권장 15~60초.
- 필수: `id`, `video`(montage는 `parts`), `start`, `end`, `reason`, `rights_ref`(공통 블록), `contains_third_party`. 선택: 나머지.
- `rights_ref` 파일이 없으면 `contains_third_party: true`로 두고 shorts-auto가 보류한다.
- `main_url`이 비어 있으면 본편 공개 전이라는 뜻 → 업로드하지 않는다.
- 후보를 적는 쪽은 최소 버전만 써도 된다(아래). 나머지는 shorts-auto가 채운다.

### 최소 버전 (다른 프로젝트 담당은 이것만 써도 됨)
````markdown
# 쇼츠 후보: book-podcast

```yaml
schema: shorts-candidates/v1
project: book-podcast
rights_ref: projects/book-podcast/rights.md
source_videos:
  - {id: book-podcast/ep003, path: book/ep003.mp4}   # ${SHORTS_SRC_ROOT} 기준 상대경로
```

```yaml
candidates:
  - id: book-podcast-ep003-c01
    video: book-podcast/ep003
    start: "00:03:12.0"
    end: "00:03:58.5"
    reason: "일상 예시로 풀어 설명한 가장 쉬운 대목"
```
````

### 전체 버전 (추가 칸)
```yaml
source_videos:
  - id: book-podcast/ep003
    path: book/ep003.mp4
    duration_sec: 1124
    main_url: "https://www.youtube.com/watch?v=XXXXXXXXXXX"   # 본편 URL, 공개 전이면 ""
    main_title: "본편 제목"
    channel: book-podcast            # config.yaml channels 키
candidates:
  - id: book-podcast-ep003-c01
    video: book-podcast/ep003
    start: "00:03:12.0"
    end: "00:03:58.5"
    reason: "..."
    type: single                     # single | montage
    priority: 1                      # 1(강추)~3
    hook: "첫 3초 문구"
    caption_ideas: ["자막 후보"]
    rights_items: ["논어 (번역: 직접 번역)"]   # rights.md 작품명 그대로
    contains_third_party: true
    status: proposed                 # proposed|selected|rendered|uploaded|rejected
  - id: book-podcast-ep003-c02
    type: montage
    parts:
      - {video: book-podcast/ep003, start: "00:10:00.0", end: "00:10:20.0"}
      - {video: book-podcast/ep001, start: "00:02:00.0", end: "00:02:25.0"}
    reason: "같은 주제를 두 책이 다르게 말하는 대비"
    contains_third_party: true
```

## 6. 처리 흐름

| # | 단계 | 입력 | 출력 | 담당 | 장소 |
|---|---|---|---|---|---|
| 1 | scan | 각 `shorts-candidates.md` | `plans/candidates-index.csv` | developer | 클라우드 |
| 2 | 권리 확인 | `rights_ref`, `rights_items` | `plans/<쇼츠ID>/rights-check.md` | reviewer(copyright-check) | 클라우드 |
| 3 | 선정·편집 계획 | 인덱스 | `plans/<쇼츠ID>/edit-plan.yaml` | media-producer | 클라우드 |
| 4 | 메타데이터 | edit-plan, `reason`, `main_title` | `plans/<쇼츠ID>/metadata.yaml` | content-writer | 클라우드 |
| 5 | 렌더 | edit-plan, 원본 | `renders/<쇼츠ID>/short.mp4`, `thumb.jpg`, `subs.srt`, `render-info.yaml` | developer(스크립트)+media-producer | **PC** |
| 6 | 1차 검수 | 렌더 정보·메타·권리 | `renders/<쇼츠ID>/review.md` | reviewer | 클라우드 |
| 7 | 사람 승인 | review.md, QUEUE 항목 | `approval.yaml` | 사용자→총괄 | 클라우드 |
| 8 | 업로드(비공개) | approved + 해시 일치 | YouTube 비공개 영상, 로그 줄 | developer(shared/uploader) | **PC** |
| 9 | 본편 연결·공개 | 비공개 영상 | Studio 수동 작업, 로그 `made_public` | 사용자 | PC/브라우저 |
| 10 | 로그 | 전부 | `log.md`, 후보 `status` 갱신 | 총괄 | 클라우드 |

(v1과 달리 메타데이터(4)를 렌더(5) 앞으로 옮겼다. 메타는 텍스트 작업이라 클라우드에서 먼저 할 수 있다.)

### 편집 계획 `edit-plan.yaml`
```yaml
short_id: sh-0001
candidates: [book-podcast-ep003-c01]
parts: [{video: book-podcast/ep003, start: "00:03:12.0", end: "00:03:58.5"}]
layout: blur-bg        # blur-bg(흐린 배경+원본 중앙) | crop-center
subtitle: {source: caption_ideas, style: default}   # caption_ideas | auto-stt | manual
variation: {hook_text: "...", commentary: "새로 덧붙인 한 줄", intro_outro: none}
target_channel: book-podcast
```
렌더 규격: 1080x1920, 30fps, H.264+AAC, 음량 맞춤, 자막 번인(+srt). 썸네일은 MVP에서 1장 추출 수준, thumbnails.set은 비용 미확인이라 **[구현 전 실측]** 후 결정.

## 7. 폴더 구조
```
projects/shorts-auto/
  config.yaml            # 채널·규격·상한 (비밀 없음, 커밋)
  plans/                 # 커밋: candidates-index.csv, <쇼츠ID>/{rights-check.md, edit-plan.yaml, metadata.yaml}
  renders/<쇼츠ID>/      # 커밋: thumb.jpg, subs.srt, render-info.yaml, review.md, approval.yaml / 제외: short.mp4
  work/                  # 전부 git 제외
  scripts/               # developer가 만드는 Python
  outputs/
```
- 영상은 git 제외. `edit-plan.yaml` + 원본 경로로 언제든 **다시 렌더 가능**해야 한다.
- 원본 영상은 사용자 PC `${SHORTS_SRC_ROOT}` 아래에 둔다(질문 5번).

### `.gitignore` 추가 목록 (총괄이 0단계 전에 반영)
`projects/*/work/`, `projects/*/renders/**/*.mp4`, `*.mov`, `*.mkv`, `client_secret*.json`, `token*.json`, `projects/shared/uploader/secrets/`, **`projects/shared/uploader/state/`**, **`projects/shared/uploader/uploader.yaml`**(실제 설정은 제외, `uploader.yaml.example`만 커밋)

## 8. 승인 단계 (H2 반영)

1. reviewer가 `review.md` 작성(규격, 자막 오탈자, 권리, 메타 규칙, 변화 주기).
2. 총괄이 `review/QUEUE.md`에 항목 추가(`request-review`). 항목에 쇼츠ID, 미리보기 위치(PC 경로), 제목·설명 초안, 대상 채널, 공개 방식(비공개), 권리 한 줄, **파일 해시 앞 8자리**를 적는다. 사용자가 `승인`/`수정요청`/`반려`로 답한다.
3. 총괄이 `approval.yaml`에 기록한다.
```yaml
short_id: sh-0001
status: approved            # approved | changes | rejected
file_sha256: "<short.mp4 전체 해시>"
title: "<승인한 제목>"
channel: book-podcast
visibility: private
approved_at: "2026-11-12"
memo: ""
```
4. **업로더는 다음이 모두 맞을 때만 업로드한다**: `status=approved`, 승인 `short_id`가 요청과 같음, 현재 `short.mp4`의 해시가 `file_sha256`과 같음, `metadata.yaml` 제목이 `title`과 같음. 하나라도 다르면 거부하고 "다시 승인 필요"라고 알린다.
5. **배치 승인**은 `approvals:` 목록에 쇼츠 ID마다 위 칸을 모두 적는다. 목록에 없는 쇼츠는 같은 날 렌더돼도 업로드 불가.
6. 수정요청이면 3~6단계로 돌아간다. 업로더는 QUEUE.md를 읽지 않는다(사람용 문서와 기계용 상태 분리).

### 비공개 업로드 → Studio 마무리 [기본 가정]
- 감사 전 API 프로젝트는 비공개로 고정될 수 있고(문서 표기 엇갈림 **[구현 전 실측]**), 쇼츠→본편 연결(관련 동영상)은 API로 안 될 가능성이 있다(제3자 설명).
- 그래서 항상 비공개로 올리고, 사용자가 Studio(데스크톱)에서 ① 확인 ② 관련 동영상으로 본편 연결 ③ 공개 전환. 업로드 완료 때 쇼츠 링크와 연결할 본편 제목을 QUEUE 항목에 적어준다.
- 설명란에는 클릭이 안 될 수 있어도 본편 제목을 텍스트로 남기고, URL도 적는다. 고정 댓글 API는 근거 없어 MVP 제외.
- brief의 "설명란·고정 댓글에 본편 링크" 문구는 위 방식으로 고치는 것을 권장(총괄).

## 9. 저작권·재사용 대응
**권리 승계 확인(2단계, reviewer, copyright-check 기준)**
1. `rights_ref` 파일 존재 확인. 없으면 보류.
2. `rights_items`가 rights.md에 "사용 가능"으로 있는지. 하나라도 없거나 애매하면 보류하고 사용자에게 보고.
3. 조건(출처 표시, 상업·수익화 가능 여부, 파생 사용 허용)이 쇼츠에도 지켜지는지. 크레딧은 설명란으로 옮긴다. 음악만 쓴 구간은 원곡 라이선스가 파생 사용을 허용하는지 확인.
4. 결과를 `rights-check.md`에 근거 한 줄과 함께 기록.

**변화 주기(inauthentic content 대응; 제3자 요약, 공식 원문 미확인)**
- 쇼츠마다 구간·첫 문구·자막이 다르게, 같은 영상에서 뽑을 때 구간이 겹치지 않게.
- `commentary`(새로 덧붙인 해설 한 줄) 필수. 단순 잘라내기 금지.
- 제목·설명은 템플릿 반복 금지, 매번 새로 씀.
- 상한: 하루 3개, 같은 본편에서 주 3개(설정값). `variation` 기록을 reviewer가 확인.
- 위험을 줄이는 설계일 뿐 안전 보장이 아니다.
- AI로 만든 사실적 콘텐츠는 "변경/합성 콘텐츠" 표시 정책을 따른다.

## 10. 공유 업로드 모듈 `projects/shared/uploader/` (설계만, 코드 없음)

**구조**: `adapters/`(base, youtube, 확장 자리), `core/`(중복 방지·로그·재시도·할당량 기록), `secrets/`(git 제외), `state/`(git 제외), `uploader.yaml.example`(커밋), `README.md`.

**CLI**
```
uploader auth   --platform youtube --channel <키>
uploader upload --platform youtube --channel <키> --video <경로> --meta <metadata.yaml> --approval <approval.yaml> [--dry-run]
uploader status --platform youtube --channel <키>
uploader log    [--project <이름>] [--since <날짜>] [--mark-public <영상ID>]
```
함수: `upload`, `check_quota`, `is_duplicate`, `auth`. `--dry-run`은 전송 없이 파일·규격·메타·중복·승인(해시 포함)만 검증하고, 개발·테스트는 이것으로 한다. `require_approval: true`가 기본이라 `--approval` 없으면 거부.

**설정·비밀**: `uploader.yaml`(채널별 프로필, 상한, 재시도, 로그 위치; 실제 파일은 git 제외). `client_secret.json`·토큰은 `secrets/`, 절대 커밋 금지, 채널마다 토큰 1개(채널마다 1회 브라우저 로그인). 에이전트는 비밀 내용을 출력하지 않는다.

**할당량**: videos.insert 비용이 1,600 / 100 / 1단위로 문서마다 달라 **단정하지 않는다 [구현 전 실측]**. 업로더는 오늘 사용량을 `state/`에 기록하고 `daily_budget`(실측 전 보수적 6건, 우리 상한 3건이 더 작음)을 넘으면 멈춘다. 초기화 시각은 일반 지식으로 태평양 시간 자정이라고 알려져 있으나 이번 리서치에 출처 없음 → 실측. quotaExceeded는 재시도하지 않고 "내일 재개".

**재시도**: 일시 오류(네트워크·5xx)는 재개 가능 업로드로 최대 3회(10초/60초/300초). 영구 오류(인증, 규격, 할당량, 정책)는 재시도 없이 로그 후 멈춤. 업로드 시작 전 `pending` 줄을 먼저 쓰고 성공 시 영상 ID를 기록. 결과를 모르는 pending은 사람이 확인하기 전 재업로드 금지.

**중복 방지**: `dedup_key` = 플랫폼+채널+`source_id`+파일 해시 앞 16자리. 같은 `source_id`가 `uploaded`/`pending`이면 거부(`--force`는 사유 필요). 파일 해시 같으면 거부. **추가(M1)**: 업로드 직전에 YouTube 내 채널의 업로드 목록을 조회해 같은 제목·길이 영상이 있으면 경고하는 이중 확인(조회 비용은 **[구현 전 실측]**).

**upload-log.csv** (`projects/shared/uploader/upload-log.csv`, 모든 프로젝트가 기록)
`log_id, timestamp, project, platform, channel, source_id, short_id, dedup_key, file_path, file_sha256, title, visibility, publish_at, status(pending|uploaded|failed|made_public|skipped), remote_id, remote_url, quota_cost, attempts, error, approval_ref, main_url, linked_main`
- 상태가 바뀔 때마다 줄을 **추가**(수정 안 함). 최신 상태는 `dedup_key` 기준 마지막 줄.
- **보존 방침(M1)**: 로그는 중복 방지의 근거이므로 (a) 업로드 줄 기록 **직후 바로 커밋·푸시**를 절차에 넣는다(PC에서 업로드하므로 PC 저장소가 원본, 푸시가 백업). (b) 삭제·정리 금지, 용량이 커지면 연도별 파일로 나누되 이전 파일도 보존. (c) 로그가 사라졌다면 위 이중 확인(업로드 목록 조회)으로 복구.
- 비밀과 영상 파일은 로그에 넣지 않는다.

**어댑터 약속**: `auth`, `validate`, `upload`, `quota_status`, `capabilities`(비공개만 가능, 연결 API 없음, 예약 지원 등). YouTube 먼저. TikTok(미감사는 비공개만 등, 검색 요약만)과 Instagram(한도 100 vs 50건 엇갈림)은 지금 구현하지 않고 "내보내기 폴더에 파일 모으기"로 대체.

**다른 프로젝트 사용법**: 자기 프로젝트에서 영상과 `metadata.yaml`(공통 칸: title, description, tags, language, visibility, source_project, source_id, main_url)을 만들고 자기 채널 키로 `uploader upload`. 승인은 자기 `request-review`를 거쳐 같은 형식 `approval.yaml`. `uploader.yaml`에 자기 채널 추가. 모듈 수정은 developer만.

## 11. 기술 스택
Python 3.11+, ffmpeg(+ffprobe, subprocess), YAML·CSV, Google API Python 클라이언트(YouTube Data API v3, OAuth 데스크톱 앱). 자막은 MVP 수동(`caption_ideas`), 자동 인식은 이후 skill-scout.

### 비용·법적 위험 (한 칸)
| 구분 | 내용 |
|---|---|
| 비용 | API 요금 없음(할당량제, 기본 무료), 서버비 없음(로컬 실행). 클라우드 STT를 쓰면 비용 발생(MVP는 수동 자막이라 0원). 원본 영상 보관 용량은 사용자 환경. |
| 법적 위험 | (1) 원본의 음악·책 인용 권리를 쇼츠에도 승계해야 함 → 권리 확인 필수. (2) 재사용·대량 생산 판정으로 수익화·노출 불이익 → 변화 주기로 완화(보장 아님). (3) 얼굴·목소리 등 개인정보, 토큰·client_secret 유출 금지. (4) 게임 영상(매직고스톱·술게임)은 사행성·음주 표현 별도 검토 전까지 대상 제외. |

## 12. 구현 전 실측 항목
| # | 항목 | 방법 |
|---|---|---|
| 1 | videos.insert 현재 비용·일일 한도(1,600/100/1, 별도 묶음) | Cloud Console 할당량 화면 + 테스트 업로드 전후 비교 |
| 2 | 미감사 프로젝트의 비공개 고정이 현재도 적용되는지 | 테스트 1편 |
| 3 | `status.publishAt` 사용 조건 | 테스트 |
| 4 | 고정 댓글 API 가능 여부·비용 | 공식 문서, MVP 제외 |
| 5 | 쇼츠 설명란 링크 클릭 가능 여부 | 비공개 업로드 후 직접 확인 |
| 6 | 관련 동영상 연결 API 가능 여부 | 기본은 수동 |
| 7 | Shorts 분류 적용일(2024-10-15 / 2025-12-08), 권장 해상도 | 업로드해 쇼츠로 분류되는지 확인 |
| 8 | **OAuth 토큰 만료(신규)**: 동의 화면이 "테스트" 상태일 때 토큰이 짧은 기간(약 7일로 알려짐, 일반 지식·공식 확인 필요)에 만료되는지, "프로덕션"으로 바꾸면 해결되는지 | 토큰 발급 후 만료 시점 관찰, 만료 시 재로그인 절차를 README에 기록 |
| 9 | 업로드 목록 조회(이중 확인) 비용 | Cloud Console |
| 10 | TikTok 24시간 한도, Instagram 100 vs 50건·Reels 포함 여부 | 해당 작업 시작 때만 |
| 11 | 공식 문서 열람(세션에서 공식 도메인 차단됨) | 허용 후 재조사 |
| 12 | `youtube-upload` 스킬의 1,600단위 서술 | 실측 후 총괄이 스킬 수정(완료 기준에 포함, roadmap-v2) |

## 13. 사용자 확인 필요 (5개)

**1. 실행 장소 (신규)**
- **A) 후보·계획·메타는 클라우드, 렌더·업로드는 내 PC — 추천 [기본 가정]**: 원본·토큰이 PC에 있어 자연스럽다. PC에는 Python, ffmpeg, git 설치가 필요하다.
- B) 전부 내 PC에서 실행: 가장 단순하지만 에이전트(클라우드)와 파일 주고받기가 수동이 된다.
- C) 전부 클라우드: 원본 영상을 클라우드로 올려야 하고 OAuth 로그인·토큰 보관이 어려워 비추천.

**2. 업로드 채널**
- **A) 유튜브만 — 추천 [기본 가정]**: 플랫폼 심사 없이 비공개 업로드로 시작 가능(공개 자동화는 API 감사가 필요할 수 있음).
- B) 유튜브 + 틱톡/릴스 자동: 심사·계정 조건으로 지연.
- C) 유튜브 자동 + 틱톡/릴스는 파일만 내보내 수동 업로드(나중에 선택 가능).

**3. 자동화 수준**
- **A) 편집 자동 + 업로드 전 내가 승인 — 추천 [기본 가정]**
- B) 완전 자동: 권리·정책 실수가 바로 공개되므로 초기엔 비추천.

**4. 채널 구조 (추천안 없어서 planner 추천)**
- **A) 프로젝트별 각 채널 — 추천 [기본 가정]**: 근거는 ① 쇼츠→본편은 "같은 채널의 영상을 연결"하는 기능(2023년 기사 기준, 공식 원문 미확인)이라 같은 채널이 유리 ② 여러 주제를 섞은 클립 모음 채널은 재사용 판정 위험이 커질 수 있다는 일반적 우려(공식 확인 아님) ③ 본편 유입 목적에 맞음. 단점은 채널마다 로그인 필요, 채널이 없는 프로젝트는 먼저 개설해야 함.
- B) 쇼츠 전용 채널 하나: 관리는 쉬우나 본편 연결 불리, 클립 모음으로 보일 위험.
- C) 임시로 전용 채널에 올렸다가 이전: 쇼츠를 지우고 다시 올려야 해 번거로움.

**5. 시범 프로젝트와 원본 보관 위치 (v1 4번을 둘로 분리)**
- 5-1 시범 프로젝트: **A) 완성 영상이 가장 먼저 나오는 프로젝트 한 곳만 — 추천 [기본 가정]** / B) 책 해설(book-podcast) 먼저 / C) 여러 곳 동시(표준 형식 미검증이라 혼선 우려). (게임 프로젝트는 제외.)
- 5-2 원본 보관: **A) 내 PC의 한 폴더(`SHORTS_SRC_ROOT`)에 모아 두고 경로만 후보 파일에 적기 — 추천 [기본 가정]** / B) 개인 클라우드 드라이브 폴더를 PC에 동기화해 같은 방식으로 사용(백업이 되는 장점) / C) 저장소(git LFS 등)에 보관: 용량·비용 문제로 비추천.
