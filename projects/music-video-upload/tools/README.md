# tools — 노래모음 영상 만들기

`make_playlist_video.py`: 곡 폴더 → 음량 맞추기 → 크로스페이드로 이어 붙이기 → 배경+음파 영상 → N번 반복(기본 2번) + 썸네일 + 타임스탬프

## 준비 (PC에 1회)
1. Python 3.9 이상 설치
2. ffmpeg 설치 — Windows: `winget install ffmpeg` / Mac: `brew install ffmpeg`
3. `pip install pillow`

## 실행
```
python make_playlist_video.py --songs ./songs --out ./ep01 --title "제목" --subtitle "부제" --bg ./bg.jpg
```
| 옵션 | 기본값 | 설명 |
|---|---|---|
| `--songs` | (필수) | 곡 폴더. 파일 이름은 `01 곡제목.mp3` 형식 |
| `--out` | (필수) | 결과 폴더 |
| `--bg` | 그라데이션 | 배경 이미지 |
| `--crossfade` | 3 | 곡 사이를 겹치는 시간(초) |
| `--loops` | 2 | 반복 횟수 (2 = 30분 믹스 × 2 = 1시간) |
| `--font` | 자동 탐색 | 한글 폰트 경로(Windows는 맑은 고딕 자동) |

## 결과
- `video_2x.mp4` — 업로드할 영상 (1920×1080)
- `thumbnail.jpg` — 썸네일 (1280×720)
- `timestamps.txt` — 설명란에 붙일 트랙리스트
- `work/` — 중간 파일 (지워도 됨)

30분 믹스 기준으로 인코딩에 일반 PC에서 대략 10~20분 걸린다(1회분만 인코딩하고 반복은 복사라 빠름).
테스트: 2026-11-13, 20초짜리 테스트 음 4개로 실행해 2회 반복 영상·타임스탬프가 정상으로 나오는 것을 확인했다.
