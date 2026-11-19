# 온라인 대전 서버 올리기 — Render 무료

10분이면 됩니다. 카드 등록은 필요 없습니다.
끝나면 서비스 주소(예: `https://magic-gostop.onrender.com`)만 알려 주세요. 제가 게임에 연결하고 실제로 붙는지 확인합니다.

## 1. 가입
1. **render.com** 접속 → 오른쪽 위 **Get Started** (또는 Sign Up)
2. **GitHub로 가입**을 고릅니다. GitHub 계정(jeunghosub)으로 로그인·허락합니다.

## 2. 서버 만들기
1. 대시보드에서 **+ New** → **Web Service**
2. **Git Provider**에서 GitHub의 `first-project` 저장소를 고릅니다.
   - 저장소가 안 보이면 "Configure account"를 눌러 Render가 이 저장소를 볼 수 있게 허락합니다.
3. 아래처럼 채웁니다. (나머지는 그대로 둠)

| 칸 | 넣을 값 |
|---|---|
| Name | `magic-gostop` ← 이 이름이면 주소가 `magic-gostop.onrender.com`이 됩니다. 이미 쓰이고 있으면 다른 이름도 괜찮습니다 |
| Region | **Singapore** (한국에서 가장 가까움) |
| Branch | `project/magic-gostop` |
| Root Directory | `projects/magic-gostop` |
| Runtime / Language | **Node** |
| Build Command | `cd server && npm ci && npm run build` |
| Start Command | `node server/dist/server.js` |
| Instance Type | **Free** |

4. 맨 아래 **Deploy Web Service**를 누릅니다.
5. 2~3분 뒤 화면 위쪽에 초록색 **Live**가 뜨면 완료입니다.
6. 이름 아래 보이는 주소(`https://○○○.onrender.com`)를 눌렀을 때 `{"ok":true,...}`가 보이면 정상입니다.

## 3. 알려 주실 것
- 서비스 주소 한 줄 (예: `https://magic-gostop.onrender.com`)

## 알아 두실 점 (무료 요금제)
- **15분 동안 아무도 접속하지 않으면 서버가 잠듭니다.** 그다음 첫 접속은 깨어나는 데 30초~1분 걸립니다. 게임은 이 동안 "서버를 깨우는 중입니다 (처음엔 최대 1분)"을 보여 주며 기다립니다.
- 앞으로 이 브랜치에 코드를 올리면 Render가 자동으로 다시 배포합니다.
- 사람이 많아지면 유료(월 약 7달러, 항상 켜짐)로 바꾸거나 다른 곳으로 옮기면 됩니다. 코드는 그대로 씁니다.
- 지금 서버는 판을 메모리에만 들고 있어서, 다시 배포되는 순간 진행 중인 판은 끊깁니다(양쪽에 "연결 끊김" 표시).
