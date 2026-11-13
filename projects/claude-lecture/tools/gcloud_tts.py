#!/usr/bin/env python3
"""대본(.md) → Google Cloud TTS → 챕터별 mp3 + 전체 episode.mp3

사용법
  python3 gcloud_tts.py list-voices                 # 한국어 음성 목록 확인
  python3 gcloud_tts.py sample 대본.md out/          # 첫 단락만 (크레딧 절약용 샘플)
  python3 gcloud_tts.py build 대본.md out/           # 전체
  python3 gcloud_tts.py build 대본.md out/ --only 3  # 3번 챕터만 다시 만들기

대본 형식
  - '## 제목' 줄 = 챕터 구분 (챕터마다 파일 하나 → 문제 있는 챕터만 재생성 가능)
  - '진행자:' / '해설자:' 로 시작하는 줄은 해당 목소리로 읽음. 없으면 진행자 목소리.
  - '#', '>', '|', '---' 로 시작하는 줄, (괄호 지문)은 읽지 않음.

API 키: 환경변수 GOOGLE_TTS_API_KEY. 클라우드 세션에서는 네트워크 프록시가 키를 대신 넣어 주므로 비워 둬도 됨.
"""
import argparse, base64, json, os, re, subprocess, sys, pathlib
import requests

API = "https://texttospeech.googleapis.com/v1"
VOICES = {  # 이름은 list-voices로 실제 존재 여부를 확인한 뒤 바꿔도 됨
    "진행자": os.environ.get("TTS_VOICE_HOST", "ko-KR-Neural2-A"),      # 여성
    "해설자": os.environ.get("TTS_VOICE_NARRATOR", "ko-KR-Neural2-C"),  # 남성
}
RATE = float(os.environ.get("TTS_RATE", "1.0"))
MAX_BYTES = 4500  # API 한도 5000바이트, 한국어 1자 ≈ 3바이트


def headers():
    h = {"Content-Type": "application/json"}
    key = os.environ.get("GOOGLE_TTS_API_KEY")
    if key:
        h["X-Goog-Api-Key"] = key
    return h


def list_voices():
    r = requests.get(f"{API}/voices", params={"languageCode": "ko-KR"}, headers=headers(), timeout=60)
    r.raise_for_status()
    for v in r.json().get("voices", []):
        print(v["name"], v["ssmlGender"])


def parse(md: str):
    """[(챕터제목, [(화자, 텍스트), ...]), ...]"""
    chapters, cur = [], None
    for raw in md.splitlines():
        line = raw.strip()
        if line.startswith("## "):
            cur = (line[3:].strip(), [])
            chapters.append(cur)
            continue
        if not line or line[0] in "#>|" or line.startswith("---"):
            continue
        if cur is None:
            cur = ("intro", [])
            chapters.append(cur)
        speaker = "진행자"
        m = re.match(r"^\**(진행자|해설자)\**\s*[:：]\s*(.*)$", line)
        if m:
            speaker, line = m.group(1), m.group(2)
        line = re.sub(r"\([^)]*\)", "", line)          # (지문) 제거
        line = re.sub(r"[*_`]", "", line).strip()       # 마크다운 기호 제거
        if not line:
            continue
        segs = cur[1]
        if segs and segs[-1][0] == speaker:
            segs[-1] = (speaker, segs[-1][1] + "\n" + line)
        else:
            segs.append((speaker, line))
    return [c for c in chapters if c[1]]


def chunks(text: str):
    sents = re.split(r"(?<=[.!?。…])\s+|\n", text)
    buf = ""
    for s in sents:
        if not s.strip():
            continue
        cand = (buf + " " + s).strip()
        if len(cand.encode()) > MAX_BYTES and buf:
            yield buf
            buf = s
        else:
            buf = cand
    if buf:
        yield buf


def synth(text: str, voice: str, out: pathlib.Path):
    body = {
        "input": {"text": text},
        "voice": {"languageCode": "ko-KR", "name": voice},
        "audioConfig": {"audioEncoding": "MP3", "speakingRate": RATE, "sampleRateHertz": 44100},
    }
    r = requests.post(f"{API}/text:synthesize", headers=headers(), data=json.dumps(body), timeout=120)
    if r.status_code != 200:
        sys.exit(f"TTS 실패 {r.status_code}: {r.text[:500]}")
    out.write_bytes(base64.b64decode(r.json()["audioContent"]))


def concat(files, out: pathlib.Path):
    lst = out.with_suffix(".txt")
    lst.write_text("".join(f"file '{f.resolve()}'\n" for f in files))
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0",
                    "-i", str(lst), "-c:a", "libmp3lame", "-b:a", "128k", str(out)], check=True)
    lst.unlink()


def duration(f: pathlib.Path) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "csv=p=0", str(f)], capture_output=True, text=True)
    return float(r.stdout.strip() or 0)


def build(md_path, out_dir, only=None, sample=False):
    out = pathlib.Path(out_dir); out.mkdir(parents=True, exist_ok=True)
    chapters = parse(pathlib.Path(md_path).read_text(encoding="utf-8"))
    if sample:
        title, segs = chapters[0]
        chapters = [(title, [(segs[0][0], segs[0][1][:600])])]
    total_chars, ch_files, t = 0, [], 0.0
    report = []
    for i, (title, segs) in enumerate(chapters, 1):
        ch_file = out / f"ch{i:02d}.mp3"
        if only is None or i == only or not ch_file.exists():
            parts = []
            for j, (spk, text) in enumerate(segs):
                for k, c in enumerate(chunks(text)):
                    p = out / f".ch{i:02d}_{j:03d}_{k:02d}.mp3"
                    synth(c, VOICES[spk], p)
                    parts.append(p)
                    total_chars += len(c)
            concat(parts, ch_file)
            for p in parts:
                p.unlink()
        ch_files.append(ch_file)
        d = duration(ch_file)
        report.append(f"{int(t//60):02d}:{int(t%60):02d} {title} ({d:.0f}초)")
        t += d
    final = out / ("sample.mp3" if sample else "episode.mp3")
    concat(ch_files, final)
    print(f"이번 요청 글자 수: {total_chars}자")
    print(f"완성: {final} ({int(t//60)}분 {int(t%60)}초)")
    print("챕터 시각:"); print("\n".join(report))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["list-voices", "sample", "build"])
    ap.add_argument("script", nargs="?")
    ap.add_argument("out", nargs="?", default="out")
    ap.add_argument("--only", type=int)
    a = ap.parse_args()
    if a.cmd == "list-voices":
        list_voices()
    else:
        build(a.script, a.out, a.only, sample=a.cmd == "sample")
