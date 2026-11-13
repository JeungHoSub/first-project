#!/usr/bin/env python3
"""ACE-Step 1.5로 곡 목록(JSON)을 한 번에 생성한다.

ACE-Step 1.5 저장소 폴더 안에서 실행한다 (공식 cli.py를 곡마다 호출).
  uv run python gen_songs_acestep.py --songs ep01-songs.json --out songs_raw

- 곡마다 후보 N개(기본 2개)를 만든다 → 직접 들어 보고 좋은 것을 고른다.
- 결과: songs_raw/01 첫눈이 오기 전에/  안에 후보 오디오 파일들
- 이미 결과가 있는 곡은 건너뛴다(중간에 끊겨도 다시 실행하면 이어서 진행).
- --only 03,07 처럼 특정 곡만 다시 만들 수 있다.
- --dry-run: 실제 생성 없이 곡별 설정 파일(.toml)만 만든다.

라이선스: ACE-Step 1.5 코드·모델은 MIT 라이선스 (github.com/ace-step/ACE-Step-1.5, 2026-11-13 확인).
"""
import argparse
import json
import os
import pathlib
import subprocess
import sys

AUDIO_EXT = {".flac", ".mp3", ".wav", ".opus", ".aac"}


def toml_str(s):
    """TOML 기본 문자열로 안전하게 변환 (json 문자열 규칙과 호환)."""
    return json.dumps(s, ensure_ascii=False)


def write_config(path, song, lang, args, save_dir):
    lines = [
        f'config_path = {toml_str(args.dit)}',
        f'lm_model_path = {toml_str(args.lm)}',
        f'backend = {toml_str(args.backend)}',
        'device = "auto"',
        'task_type = "text2music"',
        'thinking = true',
        f'caption = {toml_str(song["caption"])}',
        f'lyrics = {toml_str(song["lyrics"])}',
        f'vocal_language = {toml_str(lang)}',
        f'bpm = {int(song["bpm"])}',
        f'duration = {float(song.get("duration", 160))}',
        f'batch_size = {args.candidates}',
        f'audio_format = {toml_str(args.format)}',
        f'save_dir = {toml_str(str(save_dir))}',
    ]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--songs", required=True, help="곡 목록 JSON (ep01-songs.json)")
    ap.add_argument("--out", default="songs_raw")
    ap.add_argument("--candidates", type=int, default=2, help="곡당 후보 수")
    ap.add_argument("--dit", default="acestep-v15-turbo")
    ap.add_argument("--lm", default="acestep-5Hz-lm-1.7B",
                    help="GPU 메모리가 부족하면 acestep-5Hz-lm-0.6B")
    ap.add_argument("--backend", default="pt", help="pt(안전) 또는 vllm(빠름)")
    ap.add_argument("--format", default="mp3")
    ap.add_argument("--only", default="", help="예: 03,07")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    data = json.loads(pathlib.Path(args.songs).read_text(encoding="utf-8"))
    lang = data.get("vocal_language", "ko")
    only = {x.strip().zfill(2) for x in args.only.split(",") if x.strip()}
    out = pathlib.Path(args.out).resolve()
    cfg_dir = out / "_configs"
    cfg_dir.mkdir(parents=True, exist_ok=True)

    if not args.dry_run and not pathlib.Path("cli.py").exists():
        sys.exit("ACE-Step-1.5 저장소 폴더 안에서 실행하세요 (cli.py가 있는 곳).")

    done, failed = [], []
    for song in data["songs"]:
        num, title = song["num"], song["title"]
        if only and num not in only:
            continue
        save_dir = out / f"{num} {title}"
        if not only and save_dir.exists() and any(p.suffix in AUDIO_EXT for p in save_dir.iterdir()):
            print(f"⏭  {num} {title}: 이미 있음, 건너뜀")
            continue
        save_dir.mkdir(parents=True, exist_ok=True)
        cfg = cfg_dir / f"{num}.toml"
        write_config(cfg, song, lang, args, save_dir)
        if args.dry_run:
            print(f"📝 {cfg}")
            continue

        # cli.py는 instruction.txt가 있으면 그 내용을 재사용하므로, 곡마다 지운다.
        pathlib.Path("instruction.txt").unlink(missing_ok=True)
        print(f"\n🎵 {num} {title} 생성 중...")
        # 프롬프트 편집 대기(Enter)를 자동으로 넘기기 위해 줄바꿈을 넣어 준다.
        r = subprocess.run([sys.executable, "cli.py", "--config", str(cfg)],
                           input="\n" * 10, text=True)
        ok = r.returncode == 0 and any(p.suffix in AUDIO_EXT for p in save_dir.iterdir())
        (done if ok else failed).append(f"{num} {title}")

    pathlib.Path("instruction.txt").unlink(missing_ok=True)
    print(f"\n완료 {len(done)}곡, 실패 {len(failed)}곡")
    for f in failed:
        print("  ✕", f)


if __name__ == "__main__":
    main()
