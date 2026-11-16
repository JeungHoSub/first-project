# 입찰 플랫폼 D1 수집기 (Windows 안내)

이 폴더는 나라장터 공고를 30분마다 모아 내 PC의 SQLite 파일에 쌓는 프로그램이다. 지금(D1)은 수집만 한다. 알림 발송은 D2에서 붙는다.

- 화면 이름 뒤의 **[화면 미확인]** 은 실제 화면을 열어 보지 않고 쓴 이름이라는 뜻이다. 다르면 가장 비슷한 것을 누르고, 어디가 달랐는지 Claude에게 알려 준다(키 값은 빼고).
- **서비스키와 봇 토큰은 채팅에 붙이지 않는다.** `.env` 파일에만 둔다. 이 파일은 git에 올라가지 않는다.
- "명령 프롬프트 열기": 키보드의 Windows 키를 누른다 -> `cmd`를 입력한다 -> 맨 위의 [명령 프롬프트]가 보이면 Enter를 누른다. 검은 창이 열린다. [화면 미확인]

## A. 코드 받기

방법 1(git)과 방법 2(zip) 중 하나만 한다.

**방법 1. git**

1. 명령 프롬프트를 연다.
2. 코드를 둘 폴더로 이동한다. 예: `cd C:\` 를 입력하고 Enter를 누른다. 프롬프트가 `C:\>` 로 바뀐다.
3. `git clone -b project/g2b-bid-platform https://github.com/jeunghosub/first-project.git` 를 입력하고 Enter를 누른다. GitHub 로그인 창이 뜨면 로그인한다. [화면 미확인] 진행 문구가 나오고 `C:\first-project` 폴더가 생긴다.
4. 새로 생긴 폴더 안의 `projects\g2b-bid-platform` 으로 이동한다. 예: `cd C:\first-project\projects\g2b-bid-platform` 를 입력하고 Enter를 누른다. 프롬프트 끝이 `g2b-bid-platform>` 로 바뀐다.

**방법 2. zip**

1. 브라우저에서 `https://github.com/jeunghosub/first-project/tree/project/g2b-bid-platform` 에 접속한다(로그인 필요). 브랜치 이름이 `project/g2b-bid-platform` 으로 보인다. [화면 미확인]
1-1. 초록색 [Code] 버튼을 누른다. [화면 미확인]
1-2. [Download ZIP]을 누른다. zip 파일이 내려받아진다.
2. 내려받은 zip을 오른쪽 클릭하고 [압축 풀기]([모두 압축 풀기])를 누른다. [화면 미확인] 폴더가 생긴다.
3. 명령 프롬프트를 연다.
4. 풀린 폴더 안의 `projects\g2b-bid-platform` 으로 이동한다. 예: `cd C:\Users\내이름\Downloads\first-project-project-g2b-bid-platform\projects\g2b-bid-platform` 를 입력하고 Enter를 누른다. 프롬프트 끝이 `g2b-bid-platform>` 로 바뀐다.

## B. 가상환경과 설치

(A에서 이동한 `g2b-bid-platform>` 프롬프트에서 이어서 한다. 창을 닫았다면 A의 마지막 단계를 다시 한다.)

1. `python -m venv app\.venv` 를 입력하고 Enter를 누른다. 잠시 뒤 아무 문구 없이 다음 줄로 넘어간다.
2. `app\.venv\Scripts\activate` 를 입력하고 Enter를 누른다. 프롬프트 맨 앞에 `(.venv)` 가 붙는다.
3. `pip install -r app\requirements.txt` 를 입력하고 Enter를 누른다. `Successfully installed requests ...` 가 보인다.
4. (선택) `python -m unittest discover -s app\tests -t .` 를 입력하고 Enter를 누른다. 마지막 줄에 `OK` 가 보이면 코드가 정상이다. 인터넷·키는 쓰지 않는다.

## C. 서비스키 옮기기

1. `copy C:\g2b-secrets\keys.env app\.env` 를 입력하고 Enter를 누른다. `1개 파일이 복사되었습니다.` 가 보인다.
2. `notepad app\.env` 를 입력하고 Enter를 누른다. 메모장에 세 줄(`DATA_GO_KR_KEY_ENCODING=...`, `DATA_GO_KR_KEY_DECODING=...`, `TELEGRAM_BOT_TOKEN=...`)이 보인다.
3. 줄 이름이 위와 다르면 `app\.env.example` 의 이름에 맞게 고치고 Ctrl+S를 누른다. 같으면 메모장을 닫는다.
4. (D2 이후 PC에서 `C:\g2b-secrets\keys.env` 를 지운다. 지금은 두어도 된다.)

## D. 실측(probe) 실행

호출 약 25회를 쓴다(오늘 한도에서 빠진다). 한 번만 돌리면 된다.

1. `python -m app.probe` 를 입력하고 Enter를 누른다. 화면에 [1]~[5] 항목이 차례로 나온다. 1~2분 걸릴 수 있다.
2. 맨 아래에 `저장됨: ...\logs\probe-날짜.txt` 가 보이면 끝난 것이다.
3. 오류 문구가 나오면 멈추고, 문구를 그대로 Claude에게 알린다. 키 값이 보이면 그 줄은 가린다(프로그램이 자동으로 `***` 로 가리지만 한 번 더 확인한다).

## E. 결과를 Claude에게 알리기

1. `notepad app\logs\probe-` 까지만 입력하고 Tab 키를 눌러 파일 이름을 완성한 뒤 Enter를 누른다. 메모장에 probe 결과가 열린다. (Tab이 안 되면 탐색기에서 `app\logs` 폴더의 `probe-...txt` 를 두 번 누른다.)
2. Ctrl+A, Ctrl+C를 차례로 눌러 전체를 복사한다.
3. 채팅에 붙여 넣는다. **키 값은 이 파일에 들어 있지 않다.** 그래도 `serviceKey=` 뒤에 긴 글자가 보이면 보내지 않는다.
4. https가 안 된다고 나왔으면 `app\.env` 에 `G2B_SCHEME=http` 를 한 줄 더하고, R 값이 100이 아니면 `G2B_NUM_ROWS=<R값>` 도 더한다. 이 두 줄은 Claude가 probe 결과를 보고 알려 준다.

## F. 한 번 수동 실행

1. `app\run_cycle.bat` 를 입력하고 Enter를 누른다.
2. 마지막에 `완료` 가 보이면 한 바퀴가 돈 것이다. 첫 실행은 최근 6일치 공고를 하루 예산 안에서 며칠에 나눠 받기 시작한다.
3. `python -m app.status` 를 입력하고 Enter를 누른다. 오늘 호출 수, 저장된 공고 수, 백필 남은 조각이 보인다.

## G. 30분마다 자동 실행 (Windows 작업 스케줄러)

화면 이름은 모두 [화면 미확인]이다. 번호 단계는 `projects\g2b-bid-platform\outputs\roadmap-v4.md` 의 "D1 끝: Windows 작업 스케줄러로 30분마다 자동 실행하기" 를 그대로 따른다. 거기의 값은 아래처럼 채운다.

| 자리 | 넣을 값 |
|---|---|
| `<실행 파일>` | 받은 폴더 안의 `projects\g2b-bid-platform\app\run_cycle.bat` 의 전체 경로 (예: `C:\first-project\projects\g2b-bid-platform\app\run_cycle.bat`) |
| `<프로젝트 폴더>` ([시작 위치] 칸) | `projects\g2b-bid-platform` 의 전체 경로 (따옴표 없이) |
| 이름 | `입찰사이클` |
| 반복 | 30분마다, 무기한 |
| 중복 실행 | [새 인스턴스를 시작하지 않음] |

멈추기: 작업 스케줄러 -> [작업 스케줄러 라이브러리] -> [입찰사이클] 오른쪽 클릭 -> [사용 안 함].

## 폴더 안내

| 파일 | 하는 일 |
|---|---|
| `config.py` | `.env` 읽기, 기본값(겹침 15분, 경고 700/900 등) |
| `api.py` | 물품·용역·공사 목록 호출, 재시도·백오프, 에러코드 22, 오퍼레이션별 호출 카운터, 키 가리기 |
| `collector.py` | 등록일시+변경일시 두 갈래 증분 수집, 6일 조각, totalCount 검사, 백필 |
| `fields.py` | 허용 필드만 저장, 담당자 개인정보 제거 |
| `redact.py` | 키·토큰·전화·이메일 가리기 |
| `db.py` | SQLite(WAL) 스키마 |
| `run_cycle.py` / `run_cycle.bat` | 30분 사이클 진입점(수집만. 텔레그램·매칭·발송은 D2 자리만 있음) |
| `probe.py` | 실측 도구 |
| `status.py` | 상태 확인. `python -m app.status --backup 파일경로` 로 백업(VPS 이전 때 씀) |
| `tests\` | 가짜 응답으로 도는 테스트 |

- 저장 위치: DB `app\data\g2b.db`, 로그 `app\logs\` (둘 다 git에 올라가지 않음)
- 설정(`.env`, 모두 선택): `G2B_SCHEME`, `G2B_NUM_ROWS`, `G2B_OVERLAP_MIN`(10~15), `G2B_BACKFILL_DAYS`(최대 6)
