# 무료로 노래(보컬 곡) 만들 방법 (2026-11-13 조사, 2차 자료 — 사용 전 공식 라이선스 재확인)

## Claude로 만들 수 있나?
- **못 만든다.** Claude는 소리(음악·노래)를 직접 생성하지 못한다. 가사, 스타일 프롬프트, 곡 구성, 편집 스크립트, 썸네일·메타데이터까지가 Claude의 몫이다.

## 무료 웹 서비스 (대부분 상업 이용 불가)
| 서비스 | 무료 플랜 | 수익화 |
|---|---|---|
| Suno 무료 | 생성 가능, 다운로드 제한 | ✕ (나중에 유료로 바꿔도 소급 안 됨) |
| Stable Audio 무료 | 월 10곡 | ✕ 비상업 |
| Mubert 무료 | 가능 | ✕ 비상업 + 출처 표기 |
| Udio | 2025-10 이후 다운로드 중단 | ✕ |
| YouTube 오디오 보관함 | 무료, 수익화 가능 | ○ 단, 연주곡 위주, 남의 곡이라 차별성 없음 |

## 무료 + 상업 이용 가능: 오픈소스 모델을 직접 돌리기
| 모델 | 라이선스 | 한국어 가사 | 필요 장비 |
|---|---|---|---|
| **ACE-Step 1.5** (2026-01, XL 2026-04) | MIT 또는 Apache-2.0 (자료마다 다름 — 공식 LICENSE 확인 필요). 생성곡 상업 이용 가능하다는 설명 | "50개 이상 언어" — 한국어 품질 미확인 | NVIDIA GPU(VRAM 8GB 이상 권장) 또는 클라우드 GPU |
| **YuE (1세대)** | Apache-2.0, 상업 이용 시 "YuE by HKUST/M-A-P" 표기 권장 | 지원 언어에 한국어(ko) 포함 | 고사양 GPU(7B 모델, VRAM 24GB급 권장) |
| YuE 2 | 가중치 CC BY-NC → **상업 불가** | — | — |
| Meta MusicGen | 가중치 CC BY-NC → **상업 불가**, 보컬 없음 | — | — |

### 주의
- 품질: 한국어 발라드 보컬은 Suno보다 어색할 가능성이 크다(발음·감정 표현). 직접 들어 보고 판단해야 한다.
- 학습 데이터 저작권 문제는 오픈소스 모델도 피할 수 없다. 모델 라이선스가 "상업 가능"이어도 생성 결과의 분쟁 위험은 남는다.
- 비용: GPU가 없으면 클라우드 GPU를 빌려야 해서 시간당 몇백 원~천 원대 비용이 든다. Suno Pro $10와 비교해 수고가 크다.

## 추천
- ★ A) EP01은 **Suno Pro $10 한 달**로 만들어 반응을 본다 (가장 빠르고 품질 좋음)
- B) 고성능 NVIDIA 그래픽카드가 있는 PC가 있으면 **ACE-Step 1.5**를 무료로 시험해 보고, 한국어 품질이 괜찮으면 병행한다
- C) 보컬을 포기하고 YouTube 오디오 보관함 연주곡으로 BGM 플리를 만든다 (취향과 다름)

출처: [ACE-Step 1.5 논문](https://arxiv.org/abs/2602.00744), [ACE-Step 1.5 소개](https://ace-step.github.io/ace-step-v1.5.github.io), [ACE-Step ComfyUI wiki](https://comfyui-wiki.com/en/models/ace-step/ace-step-v1-5), [YuE 모델 카드](https://huggingface.co/m-a-p/YuE-s1-0.5B), [YuE 2 라이선스 언급](https://codersera.com/blog/run-yue-7b-for-text-to-audio-generation-on-mac/amp/), research-music.md
