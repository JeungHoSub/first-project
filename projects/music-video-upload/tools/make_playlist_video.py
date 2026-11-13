#!/usr/bin/env python3
"""노래모음(플레이리스트) 영상 만들기.

곡 파일 폴더를 넣으면:
  1) 곡마다 음량을 맞추고(-14 LUFS, 유튜브 기준)
  2) 곡 사이를 부드럽게 이어 붙여(크로스페이드) 약 30분짜리 믹스를 만들고
  3) 배경 이미지 + 제목 + 음파 비주얼라이저 영상(1920x1080)을 만들고
  4) 같은 30분을 N번(기본 2번) 이어 붙여 1시간 영상을 만든다.
  5) 썸네일(1280x720)과 유튜브 설명란용 타임스탬프도 같이 만든다.

필요한 것: Python 3.9+, ffmpeg/ffprobe, Pillow (pip install pillow)

곡 파일 이름 규칙: "01 첫눈이 오기 전에.mp3" 처럼 번호 + 공백 + 곡 제목.
번호 순서대로 이어 붙이고, 제목은 타임스탬프에 그대로 쓴다.

사용 예:
  python make_playlist_video.py --songs ./songs --title "늦가을 밤, 편하게 듣는 노래" \
      --subtitle "감성 발라드 & 멜로우 힙합 플레이리스트" --bg ./bg.jpg --out ./ep01
"""
import argparse
import pathlib
import shutil
import subprocess
import sys

AUDIO_EXT = {".mp3", ".wav", ".m4a", ".flac", ".ogg", ".aac"}
FONT_CANDIDATES = [
    "C:/Windows/Fonts/malgunbd.ttf",
    "C:/Windows/Fonts/malgun.ttf",
    "/System/Library/Fonts/AppleSDGothicNeo.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
    "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf",
    "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
]
W, H = 1920, 1080


def run(cmd):
    print("▶", " ".join(str(c) for c in cmd[:6]), "...")
    subprocess.run([str(c) for c in cmd], check=True)


def duration(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", str(path)],
        capture_output=True, text=True, check=True).stdout
    return float(out.strip())


def fmt_time(sec):
    sec = int(round(sec))
    h, rem = divmod(sec, 3600)
    m, s = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"


def find_font(user_font):
    if user_font:
        return user_font
    for f in FONT_CANDIDATES:
        if pathlib.Path(f).exists():
            return f
    sys.exit("한글 폰트를 찾지 못했습니다. --font 로 .ttf/.ttc 경로를 지정하세요.")


def list_tracks(folder):
    files = sorted(p for p in pathlib.Path(folder).iterdir()
                   if p.suffix.lower() in AUDIO_EXT)
    if len(files) < 2:
        sys.exit("곡 파일이 2개 이상 필요합니다.")
    tracks = []
    for p in files:
        stem = p.stem
        num, _, rest = stem.partition(" ")
        title = rest.strip() if num.isdigit() and rest.strip() else stem
        tracks.append((p, title))
    return tracks


def make_images(args, font_path, out):
    from PIL import Image, ImageDraw, ImageFilter, ImageFont

    if args.bg:
        bg = Image.open(args.bg).convert("RGB")
        scale = max(W / bg.width, H / bg.height)
        bg = bg.resize((int(bg.width * scale) + 1, int(bg.height * scale) + 1))
        left, top = (bg.width - W) // 2, (bg.height - H) // 2
        bg = bg.crop((left, top, left + W, top + H))
    else:  # 배경이 없으면 늦은 밤 느낌 그라데이션
        bg = Image.new("RGB", (W, H))
        px = bg.load()
        for y in range(H):
            t = y / H
            c = (int(30 + 40 * t), int(28 + 20 * t), int(60 + 30 * (1 - t)))
            for x in range(W):
                px[x, y] = c
        bg = bg.filter(ImageFilter.GaussianBlur(2))

    def draw_text(img, scale_factor, darken):
        img = img.copy()
        shade = Image.new("RGB", img.size, (0, 0, 0))
        img = Image.blend(img, shade, darken)
        d = ImageDraw.Draw(img)
        iw, ih = img.size
        f1 = ImageFont.truetype(font_path, int(ih * 0.075 * scale_factor))
        f2 = ImageFont.truetype(font_path, int(ih * 0.04 * scale_factor))
        y = int(ih * 0.30)
        for text, font in ((args.title, f1), (args.subtitle, f2)):
            if not text:
                continue
            tw = d.textlength(text, font=font)
            d.text(((iw - tw) / 2, y), text, font=font, fill=(255, 255, 255),
                   stroke_width=max(2, font.size // 25), stroke_fill=(0, 0, 0))
            y += int(font.size * 1.6)
        return img

    frame = draw_text(bg, 1.0, 0.25)
    frame.save(out / "frame.png")
    thumb = draw_text(bg, 1.35, 0.35).resize((1280, 720))
    thumb.save(out / "thumbnail.jpg", quality=92)
    return out / "frame.png"


def main():
    ap = argparse.ArgumentParser(description="노래모음 영상 만들기")
    ap.add_argument("--songs", required=True, help="곡 파일 폴더")
    ap.add_argument("--out", required=True, help="결과 폴더")
    ap.add_argument("--title", required=True)
    ap.add_argument("--subtitle", default="")
    ap.add_argument("--bg", help="배경 이미지(없으면 그라데이션)")
    ap.add_argument("--font", help="한글 폰트 경로")
    ap.add_argument("--crossfade", type=float, default=3.0, help="곡 사이 겹침(초)")
    ap.add_argument("--loops", type=int, default=2, help="믹스 반복 횟수(2 = 30분 x2)")
    ap.add_argument("--fps", type=int, default=24)
    args = ap.parse_args()

    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg가 설치돼 있지 않습니다.")
    out = pathlib.Path(args.out)
    work = out / "work"
    work.mkdir(parents=True, exist_ok=True)
    font = find_font(args.font)
    tracks = list_tracks(args.songs)
    xf = args.crossfade

    # 1) 음량 맞추기
    norm = []
    for i, (p, _) in enumerate(tracks):
        dst = work / f"norm_{i:02d}.wav"
        run(["ffmpeg", "-y", "-v", "error", "-i", p,
             "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", "48000", "-ac", "2", dst])
        norm.append(dst)
    durs = [duration(p) for p in norm]

    # 2) 크로스페이드로 이어 붙이기 + 처음/끝 페이드
    total = sum(durs) - xf * (len(durs) - 1)
    inputs = []
    for p in norm:
        inputs += ["-i", p]
    chain, last = [], "[0:a]"
    for i in range(1, len(norm)):
        tag = f"[x{i}]"
        chain.append(f"{last}[{i}:a]acrossfade=d={xf}:c1=tri:c2=tri{tag}")
        last = tag
    chain.append(f"{last}afade=t=in:d=2,afade=t=out:st={total - 3:.2f}:d=3[mix]")
    mix = work / "mix.flac"
    run(["ffmpeg", "-y", "-v", "error", *inputs, "-filter_complex", ";".join(chain),
         "-map", "[mix]", mix])
    total = duration(mix)

    # 3) 타임스탬프
    starts, t = [], 0.0
    for d in durs:
        starts.append(t)
        t += d - xf
    lines = []
    for loop in range(args.loops):
        for (_, title), s in zip(tracks, starts):
            suffix = f" ({loop + 1}회차)" if args.loops > 1 else ""
            lines.append(f"{fmt_time(s + loop * total)} {title}{suffix}")
    (out / "timestamps.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")

    # 4) 영상(1회분) 만들기: 배경 + 음파
    frame = make_images(args, font, out)
    one = work / "one.mp4"
    vf = (f"[1:a]showwaves=s={W}x180:mode=cline:rate={args.fps}:"
          f"colors=white@0.55,format=rgba[w];[0:v][w]overlay=0:{H - 250},format=yuv420p[v]")
    run(["ffmpeg", "-y", "-v", "error", "-loop", "1", "-framerate", args.fps, "-i", frame,
         "-i", mix, "-filter_complex", vf, "-map", "[v]", "-map", "1:a",
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
         "-c:a", "aac", "-b:a", "192k", "-t", f"{total:.3f}", one])

    # 5) N번 반복(재인코딩 없이 이어 붙이기)
    lst = work / "list.txt"
    lst.write_text("".join(f"file '{one.resolve().as_posix()}'\n" for _ in range(args.loops)),
                   encoding="utf-8")
    final = out / f"video_{args.loops}x.mp4"
    run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst,
         "-c", "copy", "-movflags", "+faststart", final])

    print("\n완료")
    print(f"  1회분 길이: {fmt_time(total)}  / 최종: {fmt_time(duration(final))}")
    print(f"  영상: {final}\n  썸네일: {out / 'thumbnail.jpg'}\n  타임스탬프: {out / 'timestamps.txt'}")


if __name__ == "__main__":
    main()
