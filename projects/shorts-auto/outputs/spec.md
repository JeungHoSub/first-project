# 쇼츠 편집 + 자동 업로드 기능 명세 (초안)

- 작성: planner / 2026-11-12
- 근거: `brief.md`, `outputs/research-shorts.md`, `.claude/skills/youtube-upload`, `.claude/skills/copyright-check`
- 표시 규칙: **[기본 가정]** = 사용자 답변이 없어 추천안을 임시로 쓴 부분. **[구현 전 실측]** = 리서치 수치가 엇갈려서 단정하지 않은 부분.
- 정책·법률 내용은 일반 정보이고, 확정 판단은 공식 문서·전문가 확인이 필요하다.

---

## 1. 목표

- 우리가 이미 만든 영상(책 해설, 음악, 강의, 게임 플레이)에서 쓸 만한 구간을 골라 **세로 쇼츠**로 만든다.
- 쇼츠를 본 사람이 **본편 영상으로 넘어가게** 하는 것이 목적이다.
- 편집은 자동, **업로드 전에는 사람이 한 번 승인**한다. [기본 가정: 확인 필요 2번 A안]
- "하나 만들어 여러 곳에 재활용"하는 사용자 선호(style-guide)에 맞게, 업로드 모듈은 `projects/shared/uploader/`로 빼서 다른 프로젝트도 쓴다.

## 2. 대상 사용자

| 누구 | 하는 일 |
|---|---|
| 사용자(채널 주인) | 후보·편집본을 검토하고 승인. YouTube Studio에서 본편 연결·공개 전환(필요 시). |
| 다른 프로젝트 에이전트 | 영상 완성 때 `shorts-candidates.md`를 남긴다. |
| shorts-auto 에이전트들 | 후보 수집 → 편집 → 메타데이터 → 업로드. |
| 시청자 | 쇼츠를 보고 본편으로 이동. |

## 3. 범위

### MVP (1~2주, 쇼츠 1편을 끝까지)
- 표준 `shorts-candidates.md` 형식 확정, 후보 1개를 손으로 작성해 시험.
- ffmpeg로 구간 자르기 → 9:16(1080x1920) 변환 → 자막 번인 → 썸네일 1장.
- 메타데이터(제목·설명·태그) 초안 작성.
- 사람 승인 후 **YouTube에 비공개로 업로드**, 사람이 Studio에서 확인·공개.
- `upload-log.csv`에 기록.

### 이후
- 여러 프로젝트에서 후보 자동 수집(scan), 배치 편집.
- 짜깁기(여러 구간 이어붙이기), 자동 자막(음성 인식, skill-scout).
- 예약 공개, 중복 방지 강화, 감사(audit) 신청 후 공개 업로드 자동화.
- TikTok/Reels: 처음엔 파일 내보내기(수동 업로드), 이후 어댑터 추가.
- 하이라이트 자동 감지(skill-scout).

### 하지 않는 것 (지금은)
- 완전 자동(승인 없는 업로드), 남의 영상 사용, TikTok/Reels API 자동 게시.

## 4. 기본 가정 요약

| 항목 | 기본 가정 | 출처 |
|---|---|---|
| 업로드 채널 | 유튜브만. 틱톡/릴스는 나중 | brief 확인 필요 1번 A안(추천) |
| 자동화 수준 | 편집 자동 + 업로드 전 사람 승인 | brief 확인 필요 2번 A안(추천) |
| 채널 구조 | 프로젝트별 각 채널에 올림 | 이 문서 추천(14절 참고) |
| 공개 방식 | 우선 비공개 업로드 → 사람이 Studio에서 확인·공개 | 리서치 결과 |
| 하루 업로드 상한 | 설정값 3개 (할당량 실측 전 보수적으로) | 이 문서 |
| 쇼츠 규격 | 1080x1920, 30fps, 3분 이하(처음엔 15~60초 권장) | 리서치(제3자 기준) |

## 5. 입력 표준: `shorts-candidates.md`

각 프로젝트는 `projects/<이름>/outputs/shorts-candidates.md`를 남긴다. 사람이 읽어도 되고 기계도 읽도록 **YAML 블록 하나당 후보 하나**로 쓴다. 파일 맨 위에는 공통 정보를 적는다.

### 템플릿

````markdown
# 쇼츠 후보: <프로젝트 이름>

```yaml
schema: shorts-candidates/v1
project: book-podcast               # projects/ 아래 폴더 이름
source_video:
  id: bp-ep003                      # 프로젝트 안에서 유일한 영상 ID
  path: projects/book-podcast/outputs/ep003/final.mp4   # 원본 영상 파일 경로(저장소 기준)
  duration_sec: 1124
  main_url: https://www.youtube.com/watch?v=XXXXXXXXXXX  # 본편 URL. 업로드 전이면 빈 값("")
  main_title: "제목"                # 설명란에 텍스트로 남길 본편 제목
  channel: book-podcast             # 본편이 올라간 채널 키 (config.yaml의 channels 키)
rights_ref: projects/book-podcast/rights.md   # 이 영상의 권리 기록
```

## 후보

```yaml
- id: bp-ep003-c01                  # <영상ID>-c<번호>, 전체에서 유일
  start: "00:03:12.0"               # 시작 (HH:MM:SS.s)
  end: "00:03:58.5"                 # 끝
  reason: "일상 예시로 풀어 설명한 가장 쉬운 대목"   # 한 줄 이유
  type: single                      # single(한 구간) | montage(여러 구간, 아래 parts 사용)
  priority: 1                       # 1(강추) ~ 3(보통)
  hook: "월요일 아침이 힘든 진짜 이유"  # 첫 3초에 쓸 문구 후보
  caption_ideas:                    # 자막 문구 후보 (선택)
    - "알람 끄고 5분 더 자는 건 의지 문제가 아니다"
  rights_items:                     # 이 구간에 걸린 권리 항목 (rights.md의 작품명 그대로)
    - "논어 (번역: 직접 번역)"
    - "BGM: 오디오 보관함 - 곡명"
  contains_third_party: true        # 구간 안에 남의 저작물(음악·책 인용 등)이 있나
  status: proposed                  # proposed | selected | rendered | uploaded | rejected
- id: bp-ep003-c02
  type: montage
  parts:                            # montage일 때만. 순서대로 이어붙임
    - {video_id: bp-ep003, start: "00:10:00.0", end: "00:10:20.0"}
    - {video_id: bp-ep001, start: "00:02:00.0", end: "00:02:25.0"}
  reason: "같은 주제를 두 책이 다르게 말하는 대비"
  # (priority, hook, rights_items, contains_third_party, status 등 나머지 필드는 c01과 같은 형식)
```
````

### 규칙
- 필수: `id`, `start`, `end`(montage는 `parts`), `reason`, `source_video.path`, `rights_ref`, `contains_third_party`.
- 선택: `hook`, `caption_ideas`, `priority`, `main_url`(본편 업로드 전이면 비워 둔다).
- 시간은 원본 영상 기준. 한 후보는 길이 3분 이하(쇼츠 한도), 권장 15~60초.
- 후보를 적는 쪽(각 프로젝트 에이전트)은 `rights_ref`가 가리키는 파일이 실제로 있는지 확인한다. 없으면 `contains_third_party: true`로 두고 shorts-auto가 보류한다.
- `main_url`이 비어 있는 후보는 "본편 공개 전"이라는 뜻이다. 본편 공개 전에는 업로드하지 않는다(쇼츠가 유입시킬 곳이 없으므로).

## 6. 처리 흐름 (단계별 입력/출력/담당)

| # | 단계 | 입력 | 출력 | 담당 |
|---|---|---|---|---|
| 1 | **scan** 후보 수집 | `projects/*/outputs/shorts-candidates.md` | `plans/candidates-index.csv` (후보 ID, 프로젝트, 상태, 권리확인 여부) | developer(스크립트) |
| 2 | **권리 확인** | 후보의 `rights_ref`, `rights_items` | `plans/<쇼츠ID>/rights-check.md` (통과/보류/불가) | reviewer (스킬: copyright-check) |
| 3 | **선정·짜깁기 계획** | 인덱스 + 통과 후보 | `plans/<쇼츠ID>/edit-plan.yaml` (7절) | media-producer |
| 4 | **렌더** (자르기·이어붙이기·9:16·자막·썸네일) | edit-plan.yaml, 원본 영상 | `renders/<쇼츠ID>/short.mp4`, `thumb.jpg`, `subs.srt` | media-producer + developer(스크립트) |
| 5 | **메타데이터** | edit-plan, 후보 `reason`·`main_title`·`main_url` | `renders/<쇼츠ID>/metadata.yaml` (제목·설명·태그·본편 연결 메모) | content-writer (스킬: youtube-upload 규칙) |
| 6 | **1차 검수** | 렌더 결과 + 메타 + 권리확인 | `renders/<쇼츠ID>/review.md` | reviewer |
| 7 | **사람 승인** (8절) | review.md, `review/QUEUE.md` 항목 | `renders/<쇼츠ID>/approval.yaml` | 사용자 (총괄이 기록) |
| 8 | **업로드** (비공개) | approval이 approved인 항목 | YouTube 비공개 영상, `upload-log.csv` 줄 | developer (shared/uploader) |
| 9 | **본편 연결·공개 전환** | 비공개 영상 | Studio에서 관련 동영상 연결 + 공개 | 사용자(수동) → `upload-log.csv`에 공개 기록 |
| 10 | **로그** | 위 전부 | `projects/shorts-auto/log.md` 항목, 후보 `status` 갱신 | 총괄(메인 세션) |

### 7. 편집 계획 파일 `edit-plan.yaml` (쇼츠 1개당 1개)

```yaml
short_id: sh-0001
candidates: [bp-ep003-c01]          # 짜깁기면 여러 개
parts:
  - {video_path: ..., start: "00:03:12.0", end: "00:03:58.5"}
layout: crop-center                 # crop-center(가운데 잘라 채움) | blur-bg(가로 영상을 세로 중앙에 두고 흐린 배경) 
subtitle: {source: caption_ideas | auto-stt | manual, style: default}
variation:                          # 9절 변화 주기 기록
  hook_text: "..."
  intro_outro: none | custom
  commentary: "새로 덧붙인 한 줄 해설"
target_channel: book-podcast
```

### 렌더 규격 (기본 가정)
- 1080x1920, 30fps, H.264 + AAC, 3분 이하. 소리 크기 맞춤(loudnorm).
- 가로 원본은 `blur-bg`(흐린 배경 위에 원본 중앙)를 기본으로, 인물·자막이 잘리면 안 되는 영상에 쓴다. 화면 중앙에 핵심이 있으면 `crop-center`.
- 자막은 영상에 구워 넣는다(번인). `.srt`도 따로 남긴다.
- 썸네일은 쇼츠에서는 영향이 작아서 MVP는 1장 자동 추출 + 문구 얹기만. thumbnails.set은 비용 50단위(제3자 표)라 **[구현 전 실측]** 후 사용 여부 결정.

## 8. 승인 단계

### 흐름
1. reviewer가 `review.md` 작성 (규격·자막 오탈자·권리 확인·메타 규칙 점검).
2. 총괄이 `review/QUEUE.md`에 항목 추가(`request-review` 스킬). **설계(아직 구현 아님):**
   - 항목 1개 = 쇼츠 1개 또는 같은 날 배치. 제목에 쇼츠ID 포함.
   - 항목에 적을 것: 미리보기 파일 경로, 제목·설명 초안, 대상 채널, 공개 방식(비공개), 권리 확인 결과 한 줄.
   - 사용자가 항목에 `승인` / `수정요청` / `반려`로 답한다.
3. 총괄이 사용자의 답을 `approval.yaml`에 옮긴다 (`status: approved|changes|rejected`, 승인일, 메모).
4. **업로더는 `approval.yaml`이 approved일 때만 업로드한다.** 파일이 없거나 approved가 아니면 거부. (QUEUE.md를 직접 읽지 않는다. 사람이 쓰는 문서와 기계가 읽는 상태를 분리해 오작동을 막는다.)
5. 수정요청이면 3~6단계로 되돌아간다.

### 비공개 업로드 → Studio에서 사람이 마무리 [기본 가정]
리서치 결과 두 가지가 불확실하다.
- 감사를 받지 않은 API 프로젝트는 업로드가 **비공개로 고정**될 수 있다 (문서 표기가 엇갈려 **[구현 전 실측]**).
- 쇼츠 → 본편 연결(관련 동영상)은 **API로 안 될 가능성**이 높다 (제3자 설명).

그래서 기본은 **항상 비공개로 올린다**. 그 뒤 사용자가 Studio(데스크톱)에서 ① 쇼츠 확인 ② 관련 동영상으로 본편 연결 ③ 공개 전환을 한다. 이 3개를 1~2분 안에 하도록 업로드 완료 알림(QUEUE 항목 갱신)에 쇼츠 링크와 연결할 본편 제목을 적어준다.
- 설명란에는 링크가 클릭이 안 될 수 있어도 **본편 제목을 텍스트로** 남기고, 가능하면 URL도 같이 적는다.
- 고정 댓글 API는 근거를 못 찾았으므로 MVP에서 쓰지 않는다. **[구현 전 실측]**
- 나중에 감사를 통과하고 연결이 API로 되는 것이 확인되면 이 수동 단계를 줄인다.

## 9. 저작권·재사용(inauthentic content) 대응

### 권리 승계 (2단계)
- 쇼츠의 모든 구간은 원본 프로젝트의 `rights.md` 조건을 **그대로 승계**한다. 새 권리는 생기지 않는다.
- 확인 절차(reviewer, `copyright-check` 스킬 기준):
  1. 후보의 `rights_ref` 파일이 존재하는가. 없으면 **보류**.
  2. `rights_items`의 각 항목이 rights.md에 "사용 가능"으로 있는가. 한 항목이라도 없거나 애매하면 **보류 후 사용자에게 보고**.
  3. 조건(출처 표시, 크레딧 문구, 상업적 이용 가능 여부, 수익화 가능 여부)이 **쇼츠에도 지켜지는가**: 크레딧은 설명란에 옮기고, 구간이 조건이 붙은 음악·인용을 일부만 쓰더라도 조건은 동일 적용.
  4. 결과를 `rights-check.md`에 한 줄 근거와 함께 기록.
- 권리가 불명확한 구간이나 `rights_ref`가 없는 프로젝트는 쇼츠로 만들지 않는다.
- 쇼츠에서 음악 구간만 따로 쓰는 경우(음악 프로젝트)도, 원곡 라이선스가 쇼츠 같은 파생 사용을 허용하는지 rights.md에서 확인.

### 변화 주기 (inauthentic content 대응)
YouTube는 템플릿으로 변이 없이 대량 생산하는 콘텐츠를 "inauthentic content"로 보고, 제목·썸네일·설명도 감지에 쓴다고 알려져 있다(제3자 요약, 공식 원문 미확인). 우리 영상을 쓰더라도 이렇게 변화를 준다.
- 쇼츠마다 **서로 다른 구간·첫 문구(hook)·자막**을 쓴다. 같은 영상에서 뽑더라도 구간이 겹치지 않게.
- 각 쇼츠에 **새로 덧붙인 한 줄 해설**(`commentary`)을 넣는다. 단순 잘라내기 금지.
- 제목·설명은 템플릿 문구 반복 금지. content-writer가 매번 새로 쓴다.
- 같은 날 올리는 수를 제한(기본 하루 3개), 같은 본편에서 나온 쇼츠는 주 몇 개까지만 (설정값, 기본 3개/주).
- `variation` 필드에 무엇을 바꿨는지 기록하고 reviewer가 확인.
- 이것은 위험을 줄이는 설계일 뿐 안전 보장이 아니다. 수익화 심사 결과는 지켜봐야 한다.

### 그 외
- AI로 만든 사실적 콘텐츠는 YouTube "변경/합성 콘텐츠" 표시 정책을 따른다(youtube-upload 스킬).

## 10. 폴더 구조

```
projects/shorts-auto/
  brief.md  log.md
  config.yaml                 # 채널·규격·상한 설정 (비밀 없음, 커밋)
  outputs/
    spec.md  roadmap.md  research-shorts.md
  plans/                      # 커밋: 작은 텍스트 파일
    candidates-index.csv
    <쇼츠ID>/rights-check.md, edit-plan.yaml
  renders/                    # 영상은 git 제외, 메타 파일만 커밋
    <쇼츠ID>/short.mp4(제외), thumb.jpg, subs.srt, metadata.yaml, review.md, approval.yaml
  work/                       # 임시 작업(잘라낸 조각, 중간 파일) 전부 git 제외
  scripts/                    # developer가 만드는 Python 코드(scan, render 등)
```

- **대용량 영상 방침**: `*.mp4`, `*.mov`, `*.mkv`, `work/` 는 git에서 제외한다. 클라우드 세션은 끝나면 사라지므로(CLAUDE.md), **영상은 재생성 가능해야 한다**: 원본 경로 + edit-plan.yaml만 커밋하면 같은 쇼츠를 다시 렌더할 수 있게 한다. 원본 영상 자체의 보관 장소는 각 프로젝트가 정한다 **(원본 저장 위치는 사용자 확인 필요 4번 참고)**.
- 필요한 `.gitignore` 줄(총괄/developer가 추가): `projects/*/work/`, `projects/*/renders/**/*.mp4`, `*.mov`, `*.mkv`, `client_secret*.json`, `token*.json`, `projects/shared/uploader/secrets/`.

### config.yaml 항목 (예)
```yaml
channels:                       # 채널 키 → 업로더가 쓸 인증 프로필
  book-podcast: {profile: book-podcast}
  music-video: {profile: music-video}
default_visibility: private
limits: {per_day: 3, per_week_per_main_video: 3}
render: {width: 1080, height: 1920, fps: 30, max_sec: 180}
```

## 11. 공유 업로드 모듈 `projects/shared/uploader/` (설계만, 코드 없음)

### 목적
YouTube부터 시작하고, TikTok/Reels는 어댑터만 추가하면 되는 구조. shorts-auto, music-video-upload, book-podcast가 같이 쓴다.

### 구조 (논리적 구성)
```
projects/shared/uploader/
  README.md              # 사용법
  uploader.yaml.example  # 설정 예시 (커밋)
  adapters/              # 플랫폼별 어댑터
    base                 # 공통 약속(인터페이스)
    youtube              # 처음 구현
    (tiktok, instagram)  # 확장 자리, 지금은 비워 둠
  core/                  # 플랫폼과 무관한 부분: 중복 방지, 로그, 재시도, 할당량 기록
  secrets/               # git 제외 (client_secret, 토큰)
  state/                 # git 제외 (할당량 사용 기록 등)
```

### 인터페이스
**함수 (Python에서 불러 쓰기)**
| 함수 | 하는 일 |
|---|---|
| `upload(platform, channel, video_path, metadata, *, visibility, publish_at=None, dry_run=False)` | 1건 업로드. 결과(영상 ID, URL, 상태) 반환 |
| `check_quota(platform, channel)` | 오늘 남은 할당량(기록 기반 추정 + 가능하면 실측) |
| `is_duplicate(platform, channel, dedup_key)` | 이미 올렸는지 확인 |
| `auth(platform, channel)` | 최초 1회 로그인(토큰 발급) |

**CLI (사람/에이전트가 터미널에서)**
```
uploader auth    --platform youtube --channel <채널키>
uploader upload  --platform youtube --channel <채널키> --video <경로> --meta <metadata.yaml> [--visibility private] [--dry-run]
uploader status  --platform youtube --channel <채널키>        # 남은 할당량, 오늘 업로드 수
uploader log     [--project <이름>] [--since <날짜>]
```
- `--dry-run`: 실제 전송 없이 검증(파일 존재, 규격, 메타 규칙, 중복, 승인 여부)만 한다. 기본 개발·테스트는 이것으로.
- 호출하는 쪽이 `--approval <approval.yaml>`을 넘기면 승인 상태를 확인하고, 승인 필요 설정(`require_approval: true`, 기본값)에서 이것이 없으면 거부한다.

### 메타데이터 입력 (metadata.yaml, 플랫폼 공통 + 플랫폼 전용 칸)
공통: `title`, `description`, `tags`, `language`, `visibility`, `thumbnail`(선택), `source_project`, `source_id`(후보/영상 ID), `main_url`.
플랫폼 전용: `youtube: {category_id, made_for_kids, altered_content}` 등. 다른 플랫폼은 자기 칸을 추가.

### 설정과 비밀
- 설정 `uploader.yaml`: 채널별 프로필, 기본 공개 설정, 하루 상한, 재시도 횟수, 로그 위치. 비밀 없음.
- 비밀: `client_secret.json`, 채널별 토큰 파일은 `secrets/` 아래, **절대 커밋 금지**(`.gitignore` 필수). 파일 권한은 본인만 읽기.
- 채널이 여러 개면 채널마다 로그인 토큰이 따로 필요하다(사용자가 채널마다 1회 브라우저 로그인).
- 에이전트는 비밀 파일 내용을 로그·대화에 출력하지 않는다.

### 할당량 관리
- **현재 값이 문서마다 달라서 단정하지 않는다 [구현 전 실측]**: videos.insert가 1회 1,600단위(하루 약 6개)인지, 약 100단위인지, 별도 "업로드 묶음" 하루 100콜인지 엇갈림. 스킬(`youtube-upload`)의 1,600단위 서술도 재확인 대상.
- 설계: 업로더는 **오늘 사용한 단위/호출 수를 `state/`에 기록**하고, 설정의 `daily_budget`을 넘기면 중단한다. `daily_budget`은 Cloud Console 할당량 화면에서 실측한 값으로 채운다. 실측 전 기본값은 가장 보수적인 6건으로 두되, 우리 설정 상한(하루 3개)이 더 작다.
- 할당량은 태평양 시간 자정에 초기화된다고 알려져 있음(일반 지식, 이번 리서치에는 출처 없음, **[구현 전 실측]**). 업로더는 날짜 경계를 설정으로 둔다.
- 할당량 초과 오류(quotaExceeded)가 오면 재시도하지 않고 "내일 재개"로 표시.

### 재시도
- 일시 오류(네트워크 끊김, 5xx): 재개 가능한 업로드(resumable upload)로 최대 3회, 간격을 늘려가며(예: 10초, 60초, 300초).
- 영구 오류(인증 실패, 규격 위반, 할당량 초과, 정책 거부): 재시도하지 않고 로그에 실패 사유와 함께 남기고 멈춘다.
- 재시도 중 같은 영상이 두 번 올라가지 않게 **업로드 시작 전에 로그에 `pending` 줄을 먼저 쓰고**, 성공 시 영상 ID로 갱신한다. 시작했는데 결과를 모르는(중간에 끊긴) 건은 사람이 확인하기 전까지 재업로드하지 않는다.

### 중복 방지
- `dedup_key` = 플랫폼 + 채널 + `source_id` + 렌더 파일 SHA-256 앞 16자리.
- 같은 `source_id`(후보)로 이미 `uploaded` 또는 `pending`이 있으면 거부. 다시 올리려면 `--force`와 사유 필요(로그에 남음).
- 파일 해시가 같아도 거부(제목만 바꿔 올리는 중복 방지).

### upload-log.csv 스키마
위치: `projects/shared/uploader/upload-log.csv` 하나에 모든 프로젝트가 기록. 로그에 비밀은 쓰지 않는다. (커밋 대상, 영상 파일 아님)

| 열 | 설명 |
|---|---|
| `log_id` | 순번 또는 UUID |
| `timestamp` | 기록 시각(ISO 8601, 시간대 포함) |
| `project` | 호출한 프로젝트(shorts-auto 등) |
| `platform` | youtube / tiktok / instagram |
| `channel` | 채널 키 |
| `source_id` | 후보 ID 또는 영상 ID |
| `dedup_key` | 위 규칙 |
| `file_path` | 렌더 파일 경로 |
| `file_sha256` | 파일 해시 |
| `title` | 올린 제목 |
| `visibility` | private / unlisted / public |
| `publish_at` | 예약 공개 시각(없으면 빈칸) |
| `status` | pending / uploaded / failed / made_public / skipped |
| `remote_id` | 플랫폼 영상 ID |
| `remote_url` | URL |
| `quota_cost` | 이 호출의 사용 단위(알면) |
| `attempts` | 시도 횟수 |
| `error` | 실패 사유(비밀 제외) |
| `approval_ref` | 승인 파일 경로 |
| `main_url` | 연결할 본편 URL |
| `linked_main` | Studio에서 본편 연결 완료 여부(수동 기입) |

- 한 건은 상태가 바뀔 때마다 **줄을 추가**(수정하지 않음)해서 이력이 남게 한다. 최신 상태는 `dedup_key` 기준 마지막 줄.
- `status=made_public`는 사람이 공개한 뒤 `uploader log --mark-public <remote_id>`처럼 기록(명령 이름은 구현 때 정함).

### 플랫폼 어댑터 약속 (확장 여지)
어댑터는 `auth`, `validate(video, metadata)`(플랫폼 규격 검사), `upload`, `quota_status`, `capabilities`(예: 비공개 업로드만 가능, 관련 동영상 연결 불가, 예약 공개 지원 여부)를 구현한다. 호출하는 쪽은 `capabilities`를 보고 "사람이 해야 할 후속 작업" 목록을 만들 수 있다.
- YouTube: 처음 구현. capabilities에 "본편 연결 API 없음(가정)" 표기.
- TikTok: 미감사 클라이언트는 비공개만, 24시간 게시 가능 사용자 5명 등 제한(검색 요약만). 지금은 구현하지 않고 **내보내기(export) 폴더에 파일만 모으기**로 대체.
- Instagram: 24시간 한도가 100건 vs 50건으로 문서가 엇갈림 **[구현 전 실측]**. 지금은 구현하지 않음.

### 다른 프로젝트가 쓰는 법
- **music-video-upload / book-podcast**: 자기 프로젝트에서 영상과 `metadata.yaml`(공통 칸)을 만들고 `uploader upload --channel <자기 채널 키> --project <이름>`을 부른다. 승인은 자기 프로젝트의 `request-review`를 거쳐 `approval.yaml`을 같은 형식으로 만든다.
- 각자 `uploader.yaml`에 자기 채널을 추가. 로그는 `project` 열로 구분.
- 모듈 수정은 developer만, 변경 시 이 spec과 README에 기록.
- `youtube-upload` 스킬의 체크리스트(승인 확인, 재시도·로그, 중복 방지)는 모두 이 모듈이 구현한다.

## 12. 기술 스택

| 용도 | 선택 |
|---|---|
| 언어 | Python 3.11+ |
| 영상 처리 | ffmpeg (ffprobe 포함), Python에서 subprocess로 호출 |
| 자막 | 후보의 `caption_ideas`·수동 자막(MVP). 자동 인식은 이후, skill-scout로 도구(예: Whisper 계열) 검토 |
| 설정·데이터 | YAML(설정·계획·후보), CSV(로그) |
| YouTube 연동 | Google API Python 클라이언트 (YouTube Data API v3), OAuth 데스크톱 앱 |
| 실행 환경 | 사용자의 PC 또는 클라우드 세션. 서버 없음(로컬 스크립트) |

### 비용·법적 위험 (한 칸 요약)

| 구분 | 내용 |
|---|---|
| 비용 | API 요금 없음(YouTube Data API는 할당량제, 기본 무료). 서버비 없음(로컬 실행). 자동 자막(STT)을 클라우드 API로 쓰면 비용 발생 — MVP는 수동 자막이라 0원. 로컬 오픈소스 STT를 쓰면 컴퓨터 시간만 든다. 원본 영상 보관 용량(디스크/클라우드 저장소)은 사용자 환경에 따라 별도. |
| 법적 위험 | (1) 원본 프로젝트의 음악·책 인용 권리를 쇼츠에도 승계해야 함: 권리 확인 단계 필수. (2) 재사용·대량 생산 콘텐츠로 분류돼 수익화·노출 불이익 위험: 변화 주기로 완화(안전 보장 아님). (3) 개인정보: 영상에 사람 얼굴·목소리가 있으면 동의 필요, 토큰·client_secret 유출 금지. (4) 사행성: 게임 프로젝트(매직고스톱, 술게임) 영상은 연령 제한·도박 표현·음주 권장 광고 규정에 걸릴 수 있으니 쇼츠로 만들기 전에 별도 검토 대상. |

## 13. 구현 전 실측 항목 (리서치에서 엇갈린 것)

| # | 항목 | 해야 할 일 |
|---|---|---|
| 1 | videos.insert의 현재 비용·일일 한도 (1,600 / 100 / 1단위, 별도 100콜 묶음) | Cloud Console 할당량 화면에서 확인, 테스트 업로드 1건 전후 사용량 비교 |
| 2 | 미감사 프로젝트의 비공개 고정이 현재도 적용되는지 | 테스트 계정으로 1편 올려 공개 설정이 유지되는지 확인 |
| 3 | `status.publishAt` 사용 조건(비공개여야 하는지) | 테스트로 확인, 안 되면 예약 기능 보류 |
| 4 | 고정 댓글 API 가능 여부·비용 | 공식 문서 확인 전까지 MVP에서 제외 |
| 5 | 쇼츠 설명란 링크 클릭 가능 여부 | 비공개 업로드 후 Studio·앱에서 직접 확인 |
| 6 | 관련 동영상 연결이 API로 되는지 | 기본은 수동(8절). 공식 문서 확인 시 재검토 |
| 7 | Shorts 분류 규칙 적용일(2024-10-15 / 2025-12-08), 권장 해상도 공식 문구 | 3분 이하·세로로 올려 쇼츠 선반에 분류되는지 확인 |
| 8 | TikTok 24시간 한도, Instagram 100 vs 50건, Reels 포함 여부 | TikTok/Reels 자동화를 시작할 때만 (지금은 불필요) |
| 9 | 공식 문서 접속 | 세션 네트워크에서 공식 도메인이 막혀 있었음. 허용하면 재조사 가능 |
| 10 | `youtube-upload` 스킬의 1,600단위 서술 | 실측 후 총괄이 스킬 수정 (이 문서에서는 수정 안 함) |

## 14. 사용자 확인 필요

### 1. 업로드 채널 (brief 확인 필요 1번)
- **A) 유튜브만 — 추천 [기본 가정]**: 플랫폼 심사 없이 비공개 업로드로 시작 가능(공개 자동화는 API 감사가 필요할 수 있음). TikTok·Reels는 미심사 시 비공개·테스트 수준(리서치).
- B) 유튜브 + 틱톡/릴스 자동: 앱 심사·계정 조건 필요, 시간이 길어짐.
- C) 유튜브 자동 + 틱톡/릴스는 파일만 내보내 수동 업로드: 편집본을 재활용하는 선호와 맞음, 나중에 선택 가능.

### 2. 자동화 수준 (brief 확인 필요 2번)
- **A) 편집 자동 + 업로드 전 내가 승인 — 추천 [기본 가정]**
- B) 완전 자동: 권리·정책 실수가 곧바로 공개됨. 초기에는 비추천. 승인 방식이 안정되면 "권리 통과 + 규칙 위반 없음"이면 자동, 아니면 사람 승인 같은 중간안도 가능.

### 3. 채널 (brief 확인 필요 3번) — 추천안이 없어 planner가 추천
- **A) 프로젝트별 각 채널에 올림 — 추천 [기본 가정]**
  - 근거 1: 쇼츠 → 본편 연결(관련 동영상)은 **같은 채널의 영상**을 연결하는 기능(리서치: 2023년 기사 기준, 공식 원문 미확인). 본편 유입이 목적이라 쇼츠가 본편과 같은 채널에 있어야 한다.
  - 근거 2: 여러 주제(책·음악·강의·게임)를 한 채널에 섞으면 시청자·추천 알고리즘에 주제가 흐려지고, 다른 영상 클립만 모은 채널로 보여 재사용·대량 생산 판정 위험이 커질 수 있다(일반적 우려, 공식 확인 아님).
  - 근거 3: 각 프로젝트 채널이 쇼츠로 성장하는 구조가 "본편 유입" 목적에 맞음.
  - 단점: 채널마다 OAuth 로그인·토큰 관리가 필요하고, 채널이 아직 없는 프로젝트는 쇼츠를 올릴 곳이 없다(본편 채널을 먼저 만들어야 함). 업로더가 채널 키별 프로필을 지원하는 설계(11절)로 해결.
  - 참고: 게임 프로젝트는 아직 채널이 없고 사행성 검토도 필요하므로 쇼츠 대상에서 나중으로 미룬다.
- B) 쇼츠 전용 채널 하나: 관리는 쉬우나 본편 연결이 안 되고(다른 채널), 클립 모음 채널로 보일 위험. 비추천.
- C) 시작은 A, 단 본편 채널이 없는 프로젝트는 임시로 쇼츠 전용 채널 하나에 올렸다가 채널 개설 후 이전: 이전 시 쇼츠 삭제·재업로드가 필요해 번거로움. 채널 개설 전까지 업로드하지 않고 기다리는 편이 낫다.

### 4. 쇼츠 원본 영상 보관과 첫 시범 대상
- **A) 시범은 한 프로젝트만(추천 후보: 완성 영상이 먼저 나오는 쪽, 예: 클로드 강의 또는 책 해설) — 추천**: 1편으로 전체 흐름을 검증한 뒤 확장.
- B) 여러 프로젝트 동시에: 표준 형식이 아직 검증 안 돼 혼선 가능.
- 원본 영상 보관: 로컬/클라우드 저장소 중 어디에 둘지(git에는 못 올림)도 정해야 한다. 추천은 사용자 PC·개인 클라우드 폴더에 두고 경로만 후보 파일에 적기.
