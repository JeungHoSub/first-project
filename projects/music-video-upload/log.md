# 작업 로그

## 2026-11-12 총괄(메인 세션)
- 한 일: 프로젝트 등록, 역할·담당 에이전트 배정
- 결과물: brief.md
- 다음 담당: 사용자 — brief.md의 "확인 필요" 답변
- 넘길 메모: 답변이 오면 planner가 spec.md / roadmap.md 작성

## 2026-11-12 researcher
- 한 일: AI 음악 서비스 상업 이용·수익화 조건 비교, 무료 라이선스 음악 출처, YPP 반복/비진정성 콘텐츠 정책, 잘 되는 음악 채널 유형 조사
- 결과물: outputs/research-music.md
- 다음 담당: planner
- 넘길 메모: suno.com, support.google.com, pixabay.com, incompetech.com에 접속이 안 돼서(네트워크 제한) 공식 약관 원문은 직접 확인하지 못했고, 전부 2차 자료 기준이다("(2차)"/"미확인" 표시). 결제 전에 공식 약관을 다시 확인해야 한다. 추천안: 유료 AI 서비스 2곳 이상 + 사람의 선곡·편집·비주얼 차별화. 무료 요금제로 만든 곡과 Udio는 쓰지 않는다.

## 2026-11-12 planner
- 한 일: 기본 가정 13항목(추천안 기본값), 채널 컨셉 3개, 제작 파이프라인 10단계, rights.md 형식, shorts-candidates.md 규칙, 단계별 로드맵(0~3단계)
- 결과물: outputs/spec.md, outputs/roadmap.md
- 다음 담당: reviewer
- 넘길 메모: rights.md는 프로젝트 루트(`projects/music-video-upload/rights.md`)에 둔다고 가정했다. 영상·오디오 원본은 git에 올리지 않는다는 전제로 썼다.

## 2026-11-12 reviewer
- 한 일: 1차 검수. 판정은 조건부 통과. 작은 수정 9건을 직접 반영했다(rights 열 추가, 태그 규칙, 쇼츠 개수 충돌 정리, 면책 문구 등).
- 결과물: outputs/review-notes.md
- 다음 담당: 총괄
- 넘길 메모: 남은 제안 3건 중 곡 수 계산과 Suno Premier 누락은 총괄이 spec.md에 반영했다. 업로드 시간대는 사용자 답변이 필요하다.

## 2026-11-12 총괄(music-video-upload 세션)
- 한 일: researcher → planner → reviewer 순으로 진행. spec.md의 곡 수와 다운로드 상한 계산을 고쳤다(30분 플리 = 8~10곡, 월 35~43곡 필요).
- 결과물: outputs/research-music.md, spec.md, roadmap.md, review-notes.md
- 다음 담당: 사용자 — 아래 질문에 답하기. 답이 오면 planner가 spec-v2를 쓰고, 이어서 media-producer가 파일럿 1편을 만든다.
- 넘길 메모 (사용자 질문, ★ = 추천):
  1. 채널 컨셉: ★A) 한국 일상·계절 테마 플리 / B) 게임·판타지 앰비언트 / C) 1곡 싱글 영상
  2. 영상 길이: ★A) 30분 플리(가끔 1곡 영상) / B) 1곡씩 / C) 1시간 플리
  3. 음악 서비스 예산: ★A) 월 $20~40로 2곳 구독 / B) 월 $10 안팎으로 1곳 / C) 약관만 확인하고 결제는 나중에
  4. 영상·음원 파일 저장 위치(용량이 커서 git에 맞지 않음): ★A) 사용자 드라이브·로컬 / B) 별도 비공개 저장소 / C) 작은 파일만 repo
  5. 첫 업로드 방식: ★A) 파일럿은 YouTube Studio에서 직접 수동 업로드 / B) 처음부터 API 자동 업로드
  6. 예약 업로드 시간대: ★A) 평일 저녁 7~9시(KST) / B) 주말 오전 / C) 아직 미정
  7. 공식 약관 재확인 방식: ★A) researcher가 다시 조사하고, 막히면 사용자가 약관 페이지 캡처를 제공 / B) 사용자가 직접 확인

## 2026-11-13 총괄(music-video-upload 세션)
- 한 일: 사용자 요청에 따라 EP01을 설계했다. 취향은 이수영풍 발라드, 대중가요, 감미로운 힙합이다. 12곡에 대해 Suno 스타일 프롬프트와 창작 가사를 썼다. 영상 제작 스크립트는 30분 믹스를 2회 반복해 1시간 영상을 만들고, 썸네일과 타임스탬프도 같이 만든다. 테스트 음원으로 동작을 확인했다. 그 밖에 요금 3곳 비교, 업로드 정보 초안, rights.md 틀을 만들었다.
- 결과물: outputs/ep01-tracklist.md, outputs/ep01-metadata.md, outputs/pricing-3services.md, rights.md, tools/make_playlist_video.py, tools/README.md
- 다음 담당: 사용자 — Suno Pro 가입 → 12곡 생성·다운로드 → 스크립트 실행(또는 곡 파일 전달)
- 넘길 메모: 곡 생성은 사용자 계정으로만 가능하다(이 세션은 Suno에 접근할 수 없음). 가수 이름은 프롬프트에 넣지 않는다. 채널은 계정 1개에 재생목록으로 테마를 나누는 것을 추천했다. 30분×2 반복은 플리 채널에서 흔한 형식이지만, 매번 같은 구성으로만 올리면 반복 콘텐츠로 볼 위험이 있어 회차마다 곡·배경을 새로 만든다.

## 2026-11-13 총괄(music-video-upload 세션)
- 한 일: 사용자 결정에 따라 음악 생성을 ACE-Step 1.5(MIT 라이선스, 한국어 `ko` 지원)로 전환했다. 공식 저장소 코드를 확인해 12곡을 일괄 생성하는 스크립트와 Colab 노트북(T4 무료 GPU)을 만들었다. 노트북은 설치 → 생성 → 후보 고르기 → 1시간 영상 → Drive 저장 순서로 진행된다.
- 결과물: outputs/ep01-songs.json, tools/gen_songs_acestep.py, tools/ep01_acestep_colab.ipynb, rights.md(서비스 열 갱신)
- 다음 담당: 사용자 — Colab에서 노트북 실행, 곡 후보 청취·선택
- 넘길 메모:
  - 이 클라우드 세션은 GPU가 없고 huggingface.co 접속이 막혀 직접 생성하지 못했다. 그래서 Hugging Face 접속을 허용한 개인 환경 `first-project`를 새로 만들었다(다음 세션부터 선택 가능).
  - 노트북은 실제 GPU에서 돌려 보지 못했다. 설정 파일 생성(dry-run)만 검증했다. 오류가 나면 메시지를 받아 수정한다.
  - acemusic.ai(공식 무료 웹)는 상업 이용 약관을 확인하지 못해 쓰지 않았다.
  - 한국어 보컬 품질은 아직 미확인이다. 결과를 들어 보고 Suno와 비교해 판단한다.
