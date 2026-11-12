# 음악 출처·YouTube 정책·채널 유형 조사 (music-video-upload)

- 조사일: 2026-11-12 / 담당: researcher
- **일반 정보이며 법률 자문이 아닙니다.** 저작권·약관 해석의 확정 판단은 전문가(변호사 등) 확인이 필요합니다.

## 3줄 요약
1. 음악 출처는 **"유료 AI 서비스(상업 이용·YouTube 수익화를 약관에 명시한 곳) + 사람이 손댄 편집"** 조합을 추천합니다. 무료 요금제 곡, Udio, 남의 곡 플리 재업로드는 피하세요.
2. 지금 YouTube 수익화의 가장 큰 변수는 **'비진정성(inauthentic) 콘텐츠' 정책**입니다. "AI 곡 + 정지 이미지 + 대량 업로드"는 가장 위험한 조합이라, 채널 단위로 수익이 끊길 수 있습니다.
3. 이 보고서의 많은 수치는 **공식 페이지를 직접 열어 확인하지 못했고**(이 세션에서 외부 사이트 접속이 막힘), 검색 결과 요약과 2차 자료에 의존했습니다. 결제 전에 공식 약관을 꼭 다시 확인해야 합니다.

> **확인 한계 (중요)**: 이번 세션에서는 suno.com, support.google.com, pixabay.com, incompetech.com 등에 직접 접속이 되지 않았습니다(네트워크 허용 목록 문제). 그래서 아래 내용은 웹 검색이 돌려준 요약 + 2차 자료(블로그·언론) 기반입니다. 표에서 "(2차)"는 공식 페이지로 확인하지 못했다는 뜻이고, 공식 URL이 붙어 있어도 **검색 요약으로만 본 것**입니다. 공식 페이지 접속이 허용되면 재확인이 필요합니다.

---

## 1. AI 음악 생성 서비스 비교 (확인일 2026-11-12)

### 1-1. 먼저 알아둘 큰 흐름 (2025~2026 소송·합의)

| 시점 | 사건 | 우리에게 주는 의미 | 출처 |
|---|---|---|---|
| 2025-10 | Universal이 Udio와 합의, 2026년 "허가된 환경" 구독 플랫폼 계획. 이후 Warner도 합의. 기존 곡 다운로드는 중단됨 | Udio는 "만든 곡을 밖으로 가져가는" 용도로 쓰기 어려움 | [MBW](https://www.musicbusinessworldwide.com/universal-music-settles-udio-lawsuit-strikes-deal-for-licensed-ai-music-platform), [RouteNote](https://routenote.com/blog/udio-stops-user-downloads-after-umg-deal-heres-why/) |
| 2025-11 | Warner가 Suno와 합의. Suno는 "허가받은 새 모델"로 교체 + 다운로드를 유료 계정 쪽으로 이동 | Suno 무료 곡은 재생·공유만 가능해지는 방향 | [MBW](https://www.musicbusinessworldwide.com/warner-music-group-settles-with-suno/) |
| 2026-09-03 | Suno 다운로드 상한 시행: 무료는 평생 7회(체험), Pro 월 20곡, Premier 월 60곡(Studio 사용 시 무제한). 이전에 만든 곡에도 적용 (2차) | 곡을 많이 뽑아야 하는 채널엔 Pro 상한이 빡빡함. 무료 수치는 자료마다 달라 **확인 필요** | [Suno 공지](https://suno.com/blog/suno-updates-tos), [DMN](https://www.digitalmusicnews.com/2026/08/10/suno-limiting-downloads-ai-slop/) |
| 2026-09-09 | Suno v6 출시(Warner·BMG·Believe 라이선스 기반), 이전 모델 전부 종료 | 모델이 바뀌면 같은 스타일 재현이 어려울 수 있음 | [MBW](https://musicbusinessworldwide.com/suno-v6-ai-music-models-launch-in-partnership-with-wmg-bmg-and-believe) |
| 2026-09-18 | Universal·Sony가 v6를 겨냥해 Suno를 또 제소("같은 독나무의 열매"). 기존 소송도 진행 중 | 소송 결과에 따라 서비스·약관이 또 바뀔 수 있음. Sony·Universal 합의는 **미확인(못 찾음)** | [MBW](https://www.musicbusinessworldwide.com/universal-and-sony-sue-suno-for-a-second-time-claiming-platforms-v6-models-are-the-fruit-of-the-same-poisoned-tree/) |
| 2026-07-31 / 09-02 | 독일 뮌헨 법원이 GEMA 사건에서 Suno에 불리하게 판결(2026-07-31), 캐나다 SOCAN도 제소(2026-09-02) (2차, 한 요약에서만 확인) | 유럽 쪽 리스크도 존재 | [Soundraw 소송 정리(2차)](https://soundraw.io/blog/post/every-major-ai-music-generator-lawsuit-tracked) |

### 1-2. 서비스별 비교표

| 서비스 | 월 요금 (2차, 불일치 있음) | 상업 이용 | YouTube 수익화 | 소유권 | 무료→유료 소급 | Content ID | 표기 의무 |
|---|---|---|---|---|---|---|---|
| **Suno** | Free $0 / Pro $8(연결제)~$10 / Premier $24(연결제)~$30 | 무료: 불가 (개인·비상업). Pro·Premier: 가능 | 유료 가능(2차). 무료 곡은 불가 | 유료 기간에 만든 곡은 Suno가 권리를 사용자에게 **양도**(2차). 무료 곡은 Suno 보유 | **소급 안 됨**(2차: 무료 시절 곡은 업그레이드해도 상업 권리 없음). 유료 기간에 만든 곡은 해지 후에도 유지(2차, 직접 확인 못 함) | **미확인**. 이 서비스 곡도 다른 곡과 닮으면 클레임 가능(Content ID는 AI 여부를 보지 않음, 2차) | 무료: Suno 크레딧 표기 요구 |
| **Udio** | 현재 요금 **미확인** | 현재 **불명확** | **미확인** | **미확인** | **미확인** | **미확인** | **미확인** |
| **Stable Audio** | 플랜명·가격 자료마다 다름($12~$19/월 등, 2025~2026 개편 보도). 정확한 값 **미확인** | 유료 구독 필요, 무료는 "개인·비상업" 표기 | 유료 시 가능(공식 FAQ 요약) | 약관 원문 **미확인** | 유료 기간 생성분은 해지 후에도 유효하다는 후기(2차) | **미확인** | **미확인** |
| **Mubert** | Free $0 / Pro $39(한 페이지 표기) 등 | 무료: **비상업 + 크레딧 표기**. 유료: 수익화 채널·장편 콘텐츠 허용 | 유료 가능 | 서비스 이용 라이선스 방식으로 보임(양도 여부 **확인 필요**) | 유료 구독 중 게시한 영상은 해지 후에도 계속 수익화 가능(공식 요금 페이지 요약) | **모든 플랜에서 Content ID 등록 라이선스 불포함**. 오탐 클레임은 라이선스 인증서로 대응 | 무료: 필수 |
| **AIVA** | Free €0 / Standard 약 €11(연결제)~€15 / Pro 약 €33(연결제)~€49 | Standard: 일부 플랫폼 한정 | Standard: YouTube·Twitch·TikTok·Instagram 수익화 가능(2차) | **Free·Standard는 AIVA 소유, Pro만 사용자 소유**(2차) | **미확인** | **미확인** | **미확인** |
| **Soundraw** | Creator 약 $16.99/월(공식 확인 못 함) | 개인·상업 가능(공식 라이선스 페이지 요약) | 수익화 영상 포함 가능 | 라이선스 방식. 다운로드한 곡은 해지 후에도 사용 가능(Soundraw 블로그 요약) | 무료 상업 이용 여부 **미확인** | FAQ에 "Content ID에 전 곡 등록해 스트라이크 방지"라는 문구와 "사용자의 Content ID 등록 금지"가 함께 있음. 그런데도 클레임 받았다는 후기 있음(2차) | **미확인** |
| **Beatoven.ai** | Creator $10 / Visionary $20 정도(출처 불일치, 연 결제 시 더 저렴) | 무료: 자료마다 다름(안전하게는 **상업 불가로 간주**). 유료: 상업 라이선스 | 유료 가능 | **미확인** | **미확인** | 유료 다운로드마다 Track ID 제공해 클레임 대응용이라는 설명(2차) | 무료는 표기 요구, 유료는 "Music by Beatoven.ai"를 "가능한 곳에" 요청(2차) |

출처: Suno [Pricing 요약](https://www.activepieces.com/blog/suno-pricing-2026-free-pro-and-premier-compared.md), [Suno 권리 해설(2차)](https://dynamoi.com/learn/guides/suno-commercial-rights-explained), [Suno 약관 개정 공지](https://suno.com/blog/suno-updates-tos) / Udio [MBW](https://www.musicbusinessworldwide.com/universal-music-settles-udio-lawsuit-strikes-deal-for-licensed-ai-music-platform), [Starstruck 보도](https://www.musicbusinessworldwide.com/udios-licensed-ai-music-app-will-be-called-starstruck-with-four-creation-modes-for-fans-report/) / Stable Audio [FAQ](https://stableaudio.com/faqs), [리뷰(2차)](https://fast.io/resources/stability-ai-review-2026/) / Mubert [요금제](https://mubert.com/pricing) / AIVA [비교(2차)](https://toolradar.com/tools/aiva) / Soundraw [라이선스](https://explore.soundraw.io/license), [Licensing explained](https://soundraw.io/blog/post/soundraw-licensing-explained) / Beatoven [ClipJury(2차)](https://clipjury.pages.dev/can-you-monetize/beatoven), [CostBench(2차)](https://costbench.com/software/ai-music-apis/beatoven-ai/)

### 1-3. 쉽게 풀어 읽기

- **"유료 가입 = 그 기간에 만든 곡부터 상업 OK"**가 기본 구조입니다. 무료로 만든 곡을 나중에 유료로 바꿔도 거슬러 올라가 허락되지 않는다는 해설이 많습니다(2차). 그러니 **무료로 만든 곡은 업로드 후보에서 아예 빼는 게 안전**합니다.
- **상업 이용 허락 ≠ 클레임 안 받음.** 라이선스는 "써도 된다"는 허락이고, Content ID는 소리 지문을 비교하는 자동 시스템이라 둘은 별개입니다. 서비스 약관을 보관해 두고, 클레임이 오면 이의제기할 증거(결제 내역, 곡 생성일, 플랜)를 남기세요.
- **AI 곡의 저작권(누가 갖나)**: 서비스가 "양도"해 줘도, 순수 AI 생성물이 법적으로 저작권 보호를 받는지는 나라마다 다릅니다. 이번 조사에서는 **확인하지 못했습니다(미확인)**. 전문가 확인이 필요합니다.
- **자기 곡을 Content ID에 등록하는 것**은 서비스별로 금지·허용이 다르고(Mubert 불포함, Soundraw 사용자 금지), 남의 AI 곡과 겹쳐 분쟁이 날 위험도 있습니다. **등록은 하지 않는 것을 권합니다.**

---

## 2. 무료 라이선스 음악 출처 (확인일 2026-11-12)

| 출처 | 라이선스 핵심 | 출처 표기 | 상업·수익화 | Content ID 클레임 위험 | "플레이리스트로 재업로드" 가능? |
|---|---|---|---|---|---|
| **YouTube 오디오 보관함** | 표준 YouTube 라이선스 + 일부 CC BY(표기 필요) | 표준: 불필요. CC BY 트랙: 설명란에 표기 필요 | 표준 라이선스는 **YouTube 영상용**(2차) | 보관함에서 받은 곡은 Content ID 클레임 대상이 아니라는 안내가 있으나, 제3자 오등록으로 일부 클레임 가능성(2차) | 곡 자체가 주인공인 플리 업로드가 허용되는지 **미확인**. 허용돼도 **재사용 콘텐츠 정책**에서 별도 위험 |
| **Pixabay Music** | Pixabay 콘텐츠 라이선스 | 불필요(권장) | 상업 이용 가능 | 일부 작곡가가 Content ID에 등록해 클레임 가능. 라이선스 인증서로 이의제기 | **"독립 상태(standalone)"로 판매·배포 금지.** 창작적 가공 없이 원형 그대로 올리는 것에 해당하면 위반 소지. 이미지 한 장 + 곡 영상이 이에 해당하는지는 **미확인(약관 직접 확인 필요)** |
| **Free Music Archive (FMA)** | 곡마다 CC 종류가 다름(CC BY, CC BY-NC, CC BY-SA 등) | CC BY류는 필수(곡명·아티스트·링크·라이선스) | **BY-NC는 수익화 영상에 위험(해석 갈림, 위험으로 취급).** BY/BY-SA 위주로 | 아티스트가 다른 곳에서 등록해 클레임 가능, 이의제기 필요 | 곡별 라이선스가 다르므로 **곡마다 확인**. FMA 자체 약관은 **미확인** |
| **Incompetech (Kevin MacLeod)** | CC BY 4.0 | **필수**: 곡명 + Kevin MacLeod (incompetech.com) + 라이선스 문구 | 수익화 가능(표기 전제) | **제3자 유통사 등록으로 클레임이 올 수 있음**(2차). 사이트에 대응 안내 페이지가 있음 | 표기하면 사용 가능하다는 설명이 일반적이나 플리 재업로드 허용 여부는 **미확인**. 인기 곡이라 다른 채널과 똑같은 곡이 되기 쉬움 |
| **기타(예: Free To Use 등)** | 사이트별 상이 | 상이 | 상이 | 상이 | 사이트별 **확인 필요**, 이번엔 조사하지 않음(미확인) |

출처: [YouTube 오디오 보관함 안내](https://support.google.com/youtube/answer/3376882), [오디오 보관함 2차 해설](https://www.foximusic.com/blog/?p=546), [Pixabay 라이선스](https://pixabay.com/id/service/license), [Pixabay 이용약관](https://pixabay.com/cs/service/terms/), [FMA·CC 해설(2차)](https://wildandfreetools.com/blog/creative-commons-music-youtube/), [Incompetech FAQ](https://incompetech.com/music/royalty-free/faq.html), [Incompetech Content ID 안내](https://incompetech.com/music/royalty-free/youtube-contentid.html)

**한 줄 정리**: "무료 음악"이라도 대부분 **영상의 배경(BGM)으로 쓰는 것**을 전제로 하고, **그 곡이 영상의 주인공인 플리 채널**까지 명시적으로 허락하는지는 이번에 확인하지 못했습니다(Pixabay는 standalone 배포 금지 조항이 있음). 곡을 모아 틀어주는 플리 채널은 **CC BY(표기 필수)이거나, 아티스트에게 직접 허락**을 받는 방식이 더 안전해 보입니다(내 판단).

---

## 3. YouTube 파트너 프로그램(YPP) 정책 (확인일 2026-11-12)

### 3-1. 용어·정책 정리

| 정책 | 쉽게 말하면 | 음악·BGM 채널에 미치는 영향 | 출처 |
|---|---|---|---|
| **비진정성(inauthentic) 콘텐츠** (2025-07-15 "반복적 콘텐츠"에서 명칭 변경) | 템플릿처럼 거의 변화 없는 영상, 대량 복제하기 쉬운 영상은 수익화 불가. YouTube는 "기존에도 안 되던 것의 명확화"라고 설명 | 정지 이미지 + 곡만 바꿔 대량 업로드하는 방식이 정면 타깃으로 읽힘. **채널 전체**의 수익화가 제한될 수 있음 | [YouTube 도움말](https://support.google.com/youtube/answer/1311392), [Plagiarism Today](https://www.plagiarismtoday.com/2025/07/08/youtube-targets-inauthentic-content/), [PPC Land](https://ppc.land/youtube-clarifies-inauthentic-content-policy-changes/) |
| **재사용(reused) 콘텐츠** | 남의 콘텐츠를 최소 편집으로 올리면 불가. 해설·편집 등 변형 가치가 필요 | 남의 곡 모음 플리는 위험(곡 사용 허락이 있어도 별개로 걸릴 수 있음) | [YouTube 도움말](https://support.google.com/youtube/answer/1311392), [PPC Land](https://ppc.land/understanding-youtubes-reused-content-policy) |
| **AI 표시(변경/합성 콘텐츠)** | 사실적으로 보이는 변경·합성 콘텐츠는 업로드 시 공개해야 함. 공개해도 노출·수익 자격에 불이익 없다고 안내 | AI 음악이 영상의 중심이면 표시 대상이라는 해설이 있음. **배경음악만 쓸 때는 해석이 갈림 → 애매하면 표시** | [AI 콘텐츠 공개 도움말](https://support.google.com/youtube/answer/14328491), [AIR 해설(2차)](https://air.io/en/youtube-hacks/youtube-ai-disclosure-in-2026-label-it-yourself-or-youtube-will) |
| 최근 단속 동향 | 2026년에도 "AI 슬롭" 단속이 이어짐. 채널 단위 심사, 업로드 빈도·형식 유사도·최소 편집이 위험 신호로 거론됨(2차). 구체 임계값(예: "해설 30% 미만")은 **근거 없음 — 무시** | 순수 AI 음악 채널이 주요 대상으로 거론됨(2차). 다만 "AI 금지"가 아니라 "품질 필터"라는 해설 | [SEJ](https://searchenginejournal.com/youtubes-ai-slop-problem-and-how-marketers-can-compete/567297/), [AIR 2026(2차)](https://air.io/news-air/how-youtube-treats-ai-in-2026-new-update) |

> 2026-05에 AI 표시 문구가 "AI 콘텐츠"로 바뀌었다는 2차 보도가 있으나 공식 문구는 확인하지 못했습니다([Minimatters, 2차](https://minimatters.com/?p=6160)).

### 3-2. 가입(YPP) 기준

| 구분 | 현재(2026-11-12) | 2027-02-01부터 신규 신청 |
|---|---|---|
| 광고 수익 (정식) | 구독자 1,000 + 공개 장편 시청 4,000시간(365일) 또는 쇼츠 조회 1,000만(90일) | 구독자 1,000 + **8,000시간** 또는 쇼츠 **2,000만** |
| 팬 후원·쇼핑 (초기 접근) | 구독자 500 + 공개 업로드 3개(90일) + 시청 3,000시간(12개월) 또는 쇼츠 300만(90일) | 변동 없음(보도 기준) |

출처: [YouTube 확대 YPP 안내](https://support.google.com/youtube/answer/13429240), [vidIQ 2027 변경](https://vidiq.com/blog/post/youtube-partner-program-changes-2027/), [Shacknews](https://www.shacknews.com/article/150324/youtube-partner-program-minimum-qualified-public-watch-hours-shorts-views)  
※ 2027년 변경은 **2차 보도만 확인**했고 YouTube 공식 공지는 못 봤습니다(미확인). 신규 채널은 2027-02-01 이후 신청이 될 가능성이 높으므로 8,000시간 기준으로 계획하는 편이 안전합니다(내 판단).

### 3-3. 안전 운영 실무 기준 (정책 문구 + 2차 해설을 바탕으로 한 제안, 공식 기준 아님)

| 해야 할 것 | 이유 |
|---|---|
| 영상마다 **눈에 띄게 다른 비주얼·구성**(곡 목록, 분위기별 다른 배경, 직접 만든 영상 루프) | "템플릿 + 변화 없음"을 피함 |
| 곡 소개글, 선곡 이유, 사용 상황 등 **사람이 쓴 설명·큐레이션** 넣기 | 재사용·비진정성 판단에서 변형 가치로 작용할 수 있음 |
| 업로드 속도를 **감당 가능한 수준으로**(주 1~3개부터) | 대량 생산 신호 완화 |
| 음악 출처·라이선스를 설명란에 표기, 결제·약관 캡처 보관 | 클레임 이의제기 증거 |
| AI 곡은 **AI 표시** 켜기(애매하면 표시) | 표시해도 수익 자격 불이익 없다고 안내됨 |
| 정책 위반 시 **채널 전체**가 영향 받음을 전제로 설계 | 채널 단위 심사 |
| 하지 말 것: 무료 요금제 AI 곡 사용, 남의 곡만 모은 플리, 한 템플릿 복붙 대량 업로드 | 라이선스·정책 양쪽 위험 |

---

## 4. 잘 되는 음악 채널 유형 (확인일 2026-11-12)

> 수익·구독자 수치는 대부분 서드파티 집계나 마케팅 글이라 **정확한 수익 수치는 확인하지 못했습니다(미확인)**. YouTube가 이런 채널의 평균 RPM을 공식 공개한 자료도 찾지 못했습니다. 구독자 수는 시점·집계처마다 다릅니다. 영상 길이·업로드 빈도·비주얼 열은 **일반적으로 알려진 경향(내 정리)** 이며 출처로 검증한 수치가 아닙니다.

| 유형 | 영상 길이 | 비주얼 | 업로드 빈도 | 경쟁도 | 수익 구조 | 대표 채널(예) |
|---|---|---|---|---|---|---|
| **작업용/공부용 로파이** | 1~3시간 또는 24/7 라이브 | 애니 루프, 공부하는 캐릭터 | 라이브 상시 / 영상 주 1~2 | **매우 높음**(선두 채널이 압도) | 광고 + 굿즈·레이블·스트리밍 유입(마케팅 성격이 크다는 해설) | Lofi Girl(약 1,580만, 2026-11 집계), Chillhop Music(약 332만, 2026-10 집계) |
| **카페·재즈 BGM** | 1~3시간 | 카페 사진·짧은 루프 | 주 1~3 | 높음 | 광고 위주 | Cafe Music BGM channel(약 1,500만), Relax Jazz Cafe(약 27만, 구 집계) |
| **수면·명상·자연음(빗소리 등)** | 8시간급 장편 시도가 많다고 알려짐(최적 길이 근거는 **미확인**) | 정지 이미지·루프 | 주 1~3 | 매우 높음(비슷한 이름 채널 수천 개라는 평가, 2차) | 광고. **반복적·재사용 정책 위험이 가장 거론되는 유형** | Yellow Brick Cinema(약 460만, 2차) |
| **게임·판타지 앰비언트** | 1~3시간 | 일러스트·게임풍 장면 | 주 1~2 | 중간(추정) | 광고 + 후원(추정) | 구체 채널명 **미확인**(이번 검색에서 못 찾음) |
| **시티팝·레트로 플레이리스트** | 1시간 내외 믹스 | 80년대풍 애니·일러스트 | 주 1~3 | 중간~높음(추정) | 광고. 남의 인기곡 믹스는 저작권 허락 문제 큼 | "Plastic Love" 업로드가 5,500만 조회(2차, 장르 인기의 예). 채널명 **미확인** |
| **한국 감성 '플리' 채널** | 30분~1시간+ | 일러스트·사진·가사 자막 | 비정기~주 수회 | 중간~높음(음원사 운영 채널 강세) | **광고보다 간접 수익(굿즈, 브랜드 협업, 음원 서비스 홍보) 중심**이라는 설명(블로그, 2차) | essential;(벅스, 약 97만), 리플레이 LEEPLAY(약 54만), Offweb·Ode Studio Seoul(각 약 12만), by the way, POCLANOS (2021년경 기사, 현재 수치 **미확인**) |

출처: [Lofi Girl, YouTube 블로그](https://blog.youtube/culture-and-trends/rise-lofi-girl), [로파이 경제(2차)](https://www.waterandmusic.com/the-economics-of-24-7-lo-fi-hip-hop-youtube-livestreams), [Chillhop, vidIQ](https://vidiq.com/youtube-stats/channel/@chillhopmusic/), [Cafe Music BGM, Social Blade](https://socialblade.com/youtube/user/cafemusicbgmchannel), [Cafe YouTubers, FeedSpot](https://videos.feedspot.com/cafe_youtube_channels), [수면·앰비언트 감사(2차)](https://outlierkit.com/resources/sleep-ambient-niche-audit/), [Yellow Brick Cinema(2차)](https://creatordb.app/creatorstats/yellowbrickcinema/), [시티팝 해설](https://melmagazine.com/en-us/story/japanese-city-pop-youtube-plastic-love), [한국 플리 소개 기사(2021)](https://www.gqkorea.co.kr/2021/11/21/%ec%9a%94%ec%a6%98-%ec%9c%a0%ed%8a%9c%eb%b8%8c-%ed%94%8c%eb%a0%88%ec%9d%b4%eb%a6%ac%ec%8a%a4%ed%8a%b8-%eb%aa%a8%ec%9d%8c/), [플리 수익 구조(블로그, 2차)](https://vling.net/post/222753763109)

---

## 5. 이 프로젝트에 주는 의미 · 추천안

### 5-1. 음악 출처 A/B/C 판단

| 선택지 | 장점 | 단점·위험 | 판정 |
|---|---|---|---|
| **A) AI 음악 서비스(유료)** | 곡 수급이 쉬움. 약관에 상업·수익화가 명시된 서비스가 있음 | 소송·약관 변경, Suno 월 다운로드 상한(Pro 20곡, 2차 — 확인 필요), 소유권 해석, "AI 슬롭" 낙인 | **추천(조건부)** |
| **B) 직접 만든 음악** | 권리 문제가 가장 깨끗, 차별화 | 제작 시간·실력 필요, 자동화 어려움 | 장기 목표. A에 사람 손을 섞는 방식으로 부분 도입 |
| **C) 무료 라이선스 음악** | 비용 0 | 플리 재업로드가 라이선스 위반 소지, 다른 채널과 같은 곡, Content ID 클레임 | 보조용(배경·효과음). 메인 곡 출처로는 비추천 |

**추천 조합: "A(유료, 약관에 YouTube 수익화 명시된 서비스) + 사람의 선곡·편집·비주얼 차별화"**
- 소송 리스크를 낮추려면 "허가된 데이터로 학습했다"고 밝힌 서비스 쪽이 상대적으로 나을 수 있습니다(Stability는 Stable Audio 2.5를 "fully licensed dataset"으로 학습했다고 설명, [CO/AI 보도](https://getcoai.com/news/stable-audio-2-5-creates-3-minute-custom-tracks-for-enterprise-sonic-branding)). 다만 약관 직접 확인이 먼저입니다. Suno는 v6가 Warner 등 라이선스 모델이지만 Universal·Sony의 새 소송이 걸려 있습니다.
- Suno를 쓴다면 **유료 가입 후 만든 곡만**, 곡별로 생성일·플랜·약관 캡처를 `rights.md`에 기록하세요.

### 5-2. 피해야 할 것

| 피할 것 | 이유 |
|---|---|
| 무료 요금제로 만든 곡 | 상업 이용 불가, 나중에 유료 전환해도 소급 안 됨(2차) |
| Udio 곡을 밖으로 가져오는 방식 | 다운로드 중단, 현재 상태 미확인 |
| 남의 인기곡(K-pop 등) 플리 재업로드 | 영상 자체가 저작권·재사용 문제 |
| "AI 곡 + 같은 이미지 + 대량 업로드" | 비진정성 정책이 겨냥하는 전형적 사례로 거론됨 |
| 자기 곡을 Content ID에 등록 | 서비스 약관 위반 가능, 타인 곡과 충돌 |
| Pixabay·무료곡을 원형 그대로 모음만 업로드 | standalone 금지 조항에 걸릴 소지 |

### 5-3. 위험 요소 목록 (가능성/영향은 내 판단)

| # | 위험 | 가능성/영향 | 대응 |
|---|---|---|---|
| 1 | 비진정성·재사용 정책으로 채널 수익화 거절 | 높음 / 큼 | 비주얼 다양화, 사람이 쓴 설명, 업로드 속도 조절 |
| 2 | AI 서비스 소송·약관 변경(Suno v6 소송 등) | 중~높음 / 중 | 서비스 한 곳에 의존하지 않기, 곡별 증빙 보관, 업로드 전 약관 재확인 |
| 3 | Content ID 오탐·타사 등록 클레임 | 중 / 중 | 이의제기용 증빙(결제·약관·생성일), 클레임 이력 기록 |
| 4 | 다운로드 상한·모델 교체로 곡 수급 불안정 | 중 / 중 | 월 업로드 계획을 상한에 맞춰 설계 |
| 5 | AI 곡 저작권 소유 인정 불확실(국가별) | 불명 / 중 | **미확인** — 전문가 확인 |
| 6 | 2027-02 YPP 기준 상향(8,000시간, 2차 보도) | 높음 / 중 | 수익화 시점 늦춰 계획, 팬 후원(500 구독) 경로 검토 |
| 7 | AI 표시 누락 | 중 / 중 | 업로드 체크리스트에 AI 표시 항목 추가 |
| 8 | 레드오션(로파이·수면) 경쟁 | 높음 / 중 | 세부 컨셉(예: 한국 일상·계절 테마)으로 차별화 |

### 5-4. 다음 단계 제안
1. 사용자가 brief의 "음악 출처 A/B/C"와 "영상 형태·길이"를 결정(추천: A + 직접 편집, 정지 이미지 → 테마별 루프 영상, 1곡/30분 플리부터).
2. 결정 전에 **공식 약관 직접 확인**(Suno·Stable Audio·Soundraw·Beatoven 요금제와 라이선스 원문) — 이 세션에서는 접속이 막혀 못 했습니다.
3. planner가 채널 컨셉·업로드 주기 작성 시 위 정책(비진정성, 2027 YPP 기준) 반영.

---

## 확인 못 한 것 (미확인)
- 공식 페이지 원문 전부(Suno 요금·약관, YouTube 도움말, Pixabay·Incompetech 라이선스). 접속 불가 → 검색 요약과 2차 자료에 의존
- Udio의 현재(2026-11) 요금·상업 이용·다운로드 정책, Starstruck 정식 출시 여부
- Stable Audio·AIVA·Beatoven의 정확한 현재 요금과 소유권 문구, Content ID 관련 문구
- 순수 AI 생성곡의 저작권 인정 여부(미국·한국 등)
- 오디오 보관함 표준 라이선스로 곡 자체가 주인공인 플리 업로드가 허용되는지
- Pixabay "standalone 금지"가 정지 이미지 + 곡 영상에 적용되는지
- YouTube의 2027 YPP 기준 변경 공식 공지(2차 보도만 확인), 2026-05 AI 표시 문구 변경의 공식 확인
- 채널 유형별 실제 수익(RPM) 수치, 게임·판타지 앰비언트와 시티팝의 대표 채널명, 한국 플리 채널의 현재 업로드 주기
- Sony·Universal과 Suno의 합의 여부(합의 보도 못 찾음)

## 출처 목록 (확인일 2026-11-12, 별도 표기 없는 것은 웹 검색 결과로 확인)
- Suno 약관·다운로드 정책 공지: https://suno.com/blog/suno-updates-tos
- Suno 요금 요약(2차): https://www.activepieces.com/blog/suno-pricing-2026-free-pro-and-premier-compared.md
- Suno 권리 해설(2차): https://dynamoi.com/learn/guides/suno-commercial-rights-explained
- Suno 다운로드 상한 보도: https://www.digitalmusicnews.com/2026/08/10/suno-limiting-downloads-ai-slop/
- Suno v6 출시: https://musicbusinessworldwide.com/suno-v6-ai-music-models-launch-in-partnership-with-wmg-bmg-and-believe
- Universal·Sony의 Suno 2차 소송: https://www.musicbusinessworldwide.com/universal-and-sony-sue-suno-for-a-second-time-claiming-platforms-v6-models-are-the-fruit-of-the-same-poisoned-tree/
- Warner–Suno 합의: https://www.musicbusinessworldwide.com/warner-music-group-settles-with-suno/
- Universal–Udio 합의: https://www.musicbusinessworldwide.com/universal-music-settles-udio-lawsuit-strikes-deal-for-licensed-ai-music-platform
- Udio 다운로드 중단: https://routenote.com/blog/udio-stops-user-downloads-after-umg-deal-heres-why/
- Udio Starstruck(보도): https://www.musicbusinessworldwide.com/udios-licensed-ai-music-app-will-be-called-starstruck-with-four-creation-modes-for-fans-report/
- AI 음악 소송 정리(2차): https://soundraw.io/blog/post/every-major-ai-music-generator-lawsuit-tracked
- Stable Audio FAQ: https://stableaudio.com/faqs
- Stable Audio 2.5 보도: https://getcoai.com/news/stable-audio-2-5-creates-3-minute-custom-tracks-for-enterprise-sonic-branding
- Stability AI 리뷰(2차): https://fast.io/resources/stability-ai-review-2026/
- Mubert 요금제: https://mubert.com/pricing
- AIVA(2차): https://toolradar.com/tools/aiva
- Soundraw 라이선스: https://explore.soundraw.io/license
- Soundraw Licensing explained: https://soundraw.io/blog/post/soundraw-licensing-explained
- Beatoven(2차): https://clipjury.pages.dev/can-you-monetize/beatoven , https://costbench.com/software/ai-music-apis/beatoven-ai/
- YouTube YPP 정책: https://support.google.com/youtube/answer/1311392
- YouTube 확대 YPP: https://support.google.com/youtube/answer/13429240
- YouTube AI 콘텐츠 공개: https://support.google.com/youtube/answer/14328491
- YouTube 오디오 보관함: https://support.google.com/youtube/answer/3376882
- 오디오 보관함 2차 해설: https://www.foximusic.com/blog/?p=546
- 비진정성 정책 해설: https://www.plagiarismtoday.com/2025/07/08/youtube-targets-inauthentic-content/ , https://ppc.land/youtube-clarifies-inauthentic-content-policy-changes/
- 재사용 콘텐츠: https://ppc.land/understanding-youtubes-reused-content-policy
- AI 슬롭 단속: https://searchenginejournal.com/youtubes-ai-slop-problem-and-how-marketers-can-compete/567297/ , https://air.io/news-air/how-youtube-treats-ai-in-2026-new-update
- AI 공개 해설(2차): https://air.io/en/youtube-hacks/youtube-ai-disclosure-in-2026-label-it-yourself-or-youtube-will , https://minimatters.com/?p=6160
- YPP 2027 변경: https://vidiq.com/blog/post/youtube-partner-program-changes-2027/ , https://www.shacknews.com/article/150324/youtube-partner-program-minimum-qualified-public-watch-hours-shorts-views
- Pixabay 라이선스·약관: https://pixabay.com/id/service/license , https://pixabay.com/cs/service/terms/
- CC·FMA 해설(2차): https://wildandfreetools.com/blog/creative-commons-music-youtube/
- Incompetech: https://incompetech.com/music/royalty-free/faq.html , https://incompetech.com/music/royalty-free/youtube-contentid.html
- Lofi Girl: https://blog.youtube/culture-and-trends/rise-lofi-girl
- 로파이 경제(2차): https://www.waterandmusic.com/the-economics-of-24-7-lo-fi-hip-hop-youtube-livestreams
- Chillhop: https://vidiq.com/youtube-stats/channel/@chillhopmusic/
- Cafe Music BGM: https://socialblade.com/youtube/user/cafemusicbgmchannel
- 카페 채널 목록: https://videos.feedspot.com/cafe_youtube_channels
- 수면·앰비언트(2차): https://outlierkit.com/resources/sleep-ambient-niche-audit/ , https://creatordb.app/creatorstats/yellowbrickcinema/
- 시티팝: https://melmagazine.com/en-us/story/japanese-city-pop-youtube-plastic-love
- 한국 플리 채널 소개(2021): https://www.gqkorea.co.kr/2021/11/21/%ec%9a%94%ec%a6%98-%ec%9c%a0%ed%8a%9c%eb%b8%8c-%ed%94%8c%eb%a0%88%ec%9d%b4%eb%a6%ac%ec%8a%a4%ed%8a%b8-%eb%aa%a8%ec%9d%8c/
- 한국 플리 수익 구조(블로그, 2차): https://vling.net/post/222753763109
