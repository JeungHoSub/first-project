# 조사: 쇼츠 자동 업로드 제약 (YouTube / TikTok / Instagram)

- 조사일: 2026-11-12
- 조사자: researcher
- **중요한 한계**: 이 세션은 공식 도메인(support.google.com, developers.google.com, developers.tiktok.com, developers.facebook.com)에 접속할 수 없었다(DNS 차단). 그래서 공식 페이지 원문을 직접 열어 보지 못했고, **웹 검색 결과 요약(공식 페이지 URL이 결과에 나온 것 포함)과 제3자 글**에 의존했다. 아래 "확인 수준"에 `공식 URL(검색 요약만)` / `제3자` / `충돌`을 표시했다. 구현 전에 공식 원문 재확인이 필요하다.
- 정책·법률 관련 내용은 일반 정보이며 확정 판단은 전문가·공식 문서 확인이 필요하다.

## 한 줄 결론

YouTube만 먼저 가는 것은 가능하다(쇼츠는 정사각형·세로, 최대 3분). 다만 **API 할당량은 최근 바뀐 것으로 보이나 출처끼리 충돌**하고, **미감사 프로젝트는 비공개 고정**(이 부분도 공식 문서 표기가 엇갈림)이라서, 감사 신청 또는 "업로드 전 사람이 승인·수동 공개" 설계를 먼저 정해야 한다. TikTok·Instagram은 심사 없이는 사실상 테스트 수준이다.

## 핵심 사실

### 1. YouTube Shorts 규격·정책
1. **길이 3분, 정사각형 또는 세로면 Shorts로 분류**. 공식 도움말 "Understand three-minute YouTube Shorts"에 따르면 정사각형·세로 비율이고 3분 이하면 Shorts로 간주. 가로(16:9 등)는 일반 영상.
   - 출처: https://support.google.com/youtube/answer/15424877 (확인 2026-11-12, 검색 요약으로만 확인)
   - 주의: 같은 페이지 요약에 시작일이 "2024-10-15"와 "2025-12-08 이후 업로드"로 두 개 나옴. 어느 쪽이 무엇에 대한 날짜인지 불명(음악 채널 예외 관련 문구는 2025-12-08로 보임). 적용일은 원문 확인 필요.
2. **권장 해상도 1080x1920(9:16)** 은 제3자 가이드 기준. 공식 수치는 확인 못 함.
   - 출처(제3자): https://timeskip.io/blog/youtube-shorts-video-size , https://postfa.st/sizes/youtube/shorts/2025 (확인 2026-11-12)
3. **쇼츠 -> 본편 연결은 '관련 동영상(related video)' 기능**: YouTube Studio 데스크톱에서 쇼츠 편집 시 같은 채널의 영상 1개를 연결(2023년 도입).
   - 출처: https://searchengineland.com/youtube-enables-linking-shorts-long-form-videos-430655 , https://tubefilter.com/2023/09/01/youtube-related-links-multi-format-creators-shorts-live-long-form/ (2023-09 기사, 확인 2026-11-12)
   - 쇼츠 설명란·댓글 링크가 클릭되지 않는다는 서술이 일부 글에 있음(제3자, 날짜 불명). 공식 확인 못 함.
   - 업로드 도구 일부(Vizard, Post Bridge)는 "YouTube API가 관련 동영상 연결을 지원하지 않는다"고 설명. 즉 **API 자동 업로드로는 연결이 안 될 가능성**.
   - 출처(제3자): https://help.vizard.ai/en/articles/13643189-can-i-add-a-link-to-my-long-form-youtube-video-when-publishing-shorts-via-vizard , https://support.post-bridge.com/social-media-scheduling/can-i-link-youtube-shorts-to-long-form-videos (확인 2026-11-12)

### 2. YouTube Data API v3
4. **videos.insert 비용: 출처끼리 충돌.**
   - 구버전: 1회 1,600 단위(일일 기본 10,000 -> 하루 약 6개). 현재 `youtube-upload` 스킬이 이 값을 쓰고 있음.
   - 신버전(제3자 다수): 2025-12-04 개정 이력에서 약 100 단위로 인하, 이후 2026-06-01 videos.insert가 별도 "Video Uploads" 할당량 묶음으로 분리되어 **기본 하루 100콜, 호출당 1 단위**.
   - 같은 공식 Quota Calculator 페이지가 본문(100/1)과 요약(1,600)이 서로 다르게 나온다는 보고가 있음.
   - 출처: https://www.blotato.com/blog/youtube-api-pricing , https://www.upload-post.com/youtube-api/ , https://ytmoneycalculator.com/blog/youtube-data-api-guide/ , 공식 URL https://developers.google.com/youtube/v3/determine_quota_cost (원문 미확인). 확인 2026-11-12, **충돌**
   - 하루 업로드 수 추정: 신버전이면 ~100개, 구버전이면 ~6개. 우리 규모(하루 몇 개)에서는 어느 쪽이든 보통 문제 안 되지만, 구현 전 Cloud Console 할당량 화면에서 실측해야 함.
5. **thumbnails.set 50 단위**(제3자 표). 출처: https://adaptlypost.com/blog/youtube-api-quota-extension (확인 2026-11-12, 제3자)
6. **미감사 프로젝트 비공개 고정**: 2020-07-28 이후 만든 미검증(unverified) API 프로젝트가 videos.insert로 올린 영상은 비공개로 제한, 해제하려면 API 감사 필요. 할당량 문제와는 별개 시스템. 비공개로 잠긴 영상은 이의제기 불가이고 재업로드(검증된 경로 또는 앱/웹) 필요.
   - 출처: https://developers.google.com/youtube/v3/docs/videos/insert , https://www.ayrshare.com/solutions/google-api-error-403-unverified-app-how-to-fix-the-audit-pipeline/ (제3자) (확인 2026-11-12)
   - **충돌**: 공식 reference 페이지 버전에 따라 "제한됨"/"제한되지 않음" 문구가 엇갈린다는 검색 결과가 있음. 최신 문구는 원문 확인 필요.
7. **감사 신청 방법**: "YouTube API Services - Audit and Quota Extension Form" 제출(사업·API 클라이언트·사용 목적 기재). 가이드: Quota and Compliance Audits.
   - 출처: https://support.google.com/youtube/contact/yt_api_form , https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits (확인 2026-11-12, 검색 요약만)
8. **예약 공개(status.publishAt)**, **고정 댓글 API**: 이번 조사에서 근거 출처를 찾지 못함 -> "확인 못 한 것" 참조.

### 3. TikTok / Instagram
9. **TikTok Content Posting API**: 미감사(unaudited) 클라이언트는 게시물이 **비공개로만** 게시, 24시간 내 게시 가능 사용자 최대 5명, 게시 시점에 계정이 비공개여야 함. 공개 게시는 감사 통과 필요. 공개 계정으로 시도 시 `unaudited_client_can_only_post_to_private_accounts` 오류.
   - 출처: https://developers.tiktok.com/doc/content-sharing-guidelines , https://developers.tiktok.com/doc/content-posting-api-reference-direct-post (확인 2026-11-12, 검색 요약만)
   - 크리에이터 계정당 24시간 게시 한도가 존재한다고 공식 문서가 밝힘. 구체 수치("약 15개")는 제3자 인용만 있음 -> 미확인.
10. **Instagram Graph API(콘텐츠 게시)**: 프로페셔널(비즈니스/크리에이터) 계정 대상, `media_publish` 엔드포인트로 게시. 24시간 롤링 한도가 **100건(공식 가이드 본문)** vs **50건(같은 가이드 다른 절·reference)** 으로 문서 내 불일치. `GET /<IG_ID>/content_publishing_limit`로 잔여량 조회 가능. 한도 초과 시 HTTP 400 code 9 subcode 2207042.
    - 출처: https://developers.facebook.com/docs/instagram-platform/content-publishing/ (확인 2026-11-12, 검색 요약만)
    - Reels가 같은 한도에 포함되는지는 문서로 확인 못 함(추정만 가능). 앱 심사(권한 승인) 세부 조건도 미확인.

### 4. 재사용 콘텐츠 정책 (짧게)
11. YouTube 도움말(수익 창출 정책): 2025-07-15에 "repetitious content"를 "inauthentic content(대량 생산·반복 콘텐츠)"로 명칭 변경·명확화. **reused content 정책은 변경 없음**, 해설·클립·모음·리액션 영상을 심사 대상으로 명시. 제3자 요약: 템플릿으로 변이가 거의 없거나 쉽게 대량 복제되는 콘텐츠가 대상, 제목·썸네일·설명도 감지에 쓰인다고 함.
    - 출처: https://support.google.com/youtube/answer/1311392 , https://ppc.land/youtube-improves-detection-systems-for-unoriginal-content/ (확인 2026-11-12, 검색 요약만)

## 프로젝트에 주는 의미

- **규격**: 9:16 세로, 1080x1920, 3분 이하로 만들면 안전. 지금은 3분까지 가능하므로 "강의 핵심 2분" 같은 구간도 쇼츠로 가능(15~60초 제약 불필요).
- **본편 유입**: brief의 "설명란·고정 댓글에 본편 링크" 전제는 불확실. 쇼츠 링크는 클릭이 안 될 수 있고, 고정 댓글 API도 미확인. 가장 확실한 경로는 **관련 동영상 기능**이지만 API 자동화가 안 될 가능성이 높아 **업로드 후 Studio에서 사람이 연결하는 단계**를 승인 절차에 넣는 편이 현실적. 설명란에는 클릭이 안 되더라도 본편 제목을 텍스트로 남긴다.
- **업로드 설계**: 승인 후 업로드 구조(brief 확인 필요 2번 A안)와 잘 맞는다. 감사 전에는 비공개로 올라올 수 있으므로 (a) 감사 신청, 또는 (b) 비공개 업로드 후 Studio에서 사람이 공개로 전환 중 하나를 선택해야 함. 후자는 초기 승인 절차와 겹쳐 부담이 적음. 감사는 1회성 서류 작업이라 `projects/shared/uploader/`를 공유 모듈로 만들 때 한 번에 신청하는 것이 효율적.
- **스킬 수정 필요**: `.claude/skills/youtube-upload/SKILL.md`의 "1,600단위, 하루 약 6개"는 최신 정보와 충돌 가능성이 큼(이번 조사 범위 밖이라 수정하지 않음, 총괄 확인 요청).
- **채널 결정(brief 확인 필요 1번)**: TikTok·Instagram 자동 게시는 심사·계정 조건이 있고 미심사 시 비공개(TikTok)라서 **처음엔 YouTube만(A안)** 이 타당. 릴스/틱톡은 수동 업로드용 파일 내보내기로 시작해도 됨.
- **재사용 정책**: 우리 영상을 가져다 쓰는 것은 본인 소유 원본이라는 점에서 타인 영상 재사용과 다르지만, 수익화 심사에서는 "변이 없는 템플릿 대량 생산"으로 보일 위험이 있음. 쇼츠마다 구간·자막·제목에 차이를 두고, 새 설명(해설·맥락)을 덧붙이는 설계가 안전하다(일반 정보, 확정 판단은 YouTube 정책 원문·전문가 확인 필요). 원본 안의 음악·책 인용은 기존 rights.md 조건을 따른다.

## 확인 못 한 것

- 공식 원문 직접 열람 전부(도메인 차단). 필요: support.google.com, developers.google.com, developers.tiktok.com, developers.facebook.com을 세션 네트워크 허용 목록에 추가하면 재조사 가능.
- videos.insert의 **현재 정확한 비용·일일 한도**(1,600 vs 100 vs 1 단위, 10,000 풀 vs 100콜 별도 버킷).
- 미감사 프로젝트의 비공개 고정이 **현재도 적용되는지**, 감사 소요 기간·승인 조건.
- `status.publishAt` 사용 조건(예: privacyStatus=private 필요 여부) — 출처 못 찾음.
- 고정 댓글을 API로 달 수 있는지 — 출처 못 찾음. comments 쓰기 비용도 미확인.
- 쇼츠 설명란 링크의 현재 클릭 가능 여부(공식).
- 쇼츠 권장 해상도의 공식 문구.
- Shorts 분류 규칙의 정확한 적용일(2024-10-15 / 2025-12-08).
- TikTok 계정당 24시간 게시 한도 수치, 감사 절차·기간.
- Instagram Reels의 한도 포함 여부, 100 vs 50건 중 적용값, 앱 심사 요건.
- 한국 거주자 대상 TikTok/Instagram API 이용 조건 차이.
