# 매직고스톱 앱 포장 (Capacitor)

웹 게임(`../game`)을 안드로이드·iOS 앱으로 감싼다. 같은 결과물이 PWA(홈 화면 설치)로도 동작한다.

| 위치 | 내용 |
|---|---|
| `www/` | 앱에 들어가는 웹 파일. `cd ../game && npm run build:app` 으로 만든다 (index.html, manifest, 서비스워커, 아이콘) |
| `icons/`, `assets/` | 앱 아이콘 원본(icon.svg)과 생성된 PNG, 스플래시 원본 |
| `android/` | Capacitor가 만든 안드로이드 프로젝트 (타깃 API 36 = Android 16) |
| `ci/android-build.yml` | GitHub Actions 클라우드 빌드 템플릿 (저장소 루트 `.github/workflows/`로 복사해서 사용) |
| `capacitor.config.json` | 앱 ID `kr.magicgostop.app`(임시 — **첫 업로드 전에 확정**, 올린 뒤에는 못 바꿈), 앱 이름 |

## 빌드
```bash
cd ../game && npm ci && npm run build:app      # 웹 결과물 → app/www
cd ../app && npm ci && npx cap sync android    # 안드로이드에 복사
cd android && ./gradlew assembleDebug          # 테스트용 APK (안드로이드 SDK 필요)
./gradlew bundleRelease                        # 스토어용 AAB (업로드 키로 서명 필요)
```
- iOS: Mac(Xcode 26 이상)에서 `npx cap add ios && npx cap open ios`. Mac이 없으면 클라우드 Mac 빌드 서비스.
- 아이콘 다시 만들기: `npx @capacitor/assets generate --android`
