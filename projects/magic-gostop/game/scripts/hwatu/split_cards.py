"""all.svg(ai2svg 결과)에서 빨간 카드 테두리 48개를 찾아 카드별 SVG로 나눈다.
배치: 위에서부터 12월→1월, 왼쪽부터 엔진 cards.ts 순서(광/열끗, 띠/쌍피, 피, 피)."""
import re, sys, json, os
src, outdir, tsout = sys.argv[1], sys.argv[2], sys.argv[3]
svg = open(src).read()
paths = re.findall(r'<path d="([^"]+)" ([^/]*)/>', svg)
def bbox(d):
    n = [float(x) for x in re.findall(r'-?\d+\.?\d*', d)]
    xs, ys = n[0::2], n[1::2]
    return min(xs), min(ys), max(xs), max(ys)
items = [(d, a, bbox(d)) for d, a in paths]
frames = [b for d, a, b in items if 'fill="#ff0000"' in a and abs((b[2]-b[0]) - 153.1) < 1 and abs((b[3]-b[1]) - 238.1) < 1]
assert len(frames) == 48, len(frames)
frames.sort(key=lambda b: (round(b[1] / 50), b[0]))
SPEC = {1: 'G T P P', 2: 'Y T P P', 3: 'G T P P', 4: 'Y T P P', 5: 'Y T P P', 6: 'Y T P P', 7: 'Y T P P', 8: 'G Y P P', 9: 'Y T P P', 10: 'Y T P P', 11: 'G D P P', 12: 'G Y T D'}
def ids(month):
    seq, res = {}, []
    for k in SPEC[month].split():
        seq[k] = seq.get(k, -1) + 1
        res.append(f'{month:02d}-{k}-{seq[k]}')
    return res
os.makedirs(outdir, exist_ok=True)
def r1(d):
    return re.sub(r'-?\d+\.\d+', lambda m: f'{float(m.group()):.1f}'.rstrip('0').rstrip('.'), d)
out = {}
for i, fr in enumerate(frames):
    row, col = divmod(i, 4)
    month = 12 - row
    cid = ids(month)[col]
    x0, y0, x1, y1 = fr
    body = []
    for d, a, b in items:
        cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
        if x0 - 0.5 <= cx <= x1 + 0.5 and y0 - 0.5 <= cy <= y1 + 0.5 and (b[2] - b[0]) < 160:
            # 좌표를 카드 기준으로 옮긴다
            body.append(f'<path d="{r1(d)}" {a.strip()}/>')
    vb = f'{x0:.1f} {y0:.1f} {x1 - x0:.1f} {y1 - y0:.1f}'
    s = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" preserveAspectRatio="xMidYMid slice">{"".join(body)}</svg>'
    open(os.path.join(outdir, f'{cid}.svg'), 'w').write(s)
    out[cid] = s
open(tsout, 'w').write('// 자동 생성: scripts/hwatu/split_cards.py — 직접 고치지 말 것\n// 화투 일러스트: 사용자가 제공한 디자인메카 화투 일러스트(.ai)에서 변환\nexport const HWATU_SVG: Record<string, string> = ' + json.dumps(out, ensure_ascii=False) + ';\n')
print(len(out), 'cards;', sum(len(v) for v in out.values()) // 1024, 'KB')
