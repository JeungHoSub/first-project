"""Illustrator(AI 3~10 PostScript 본문) 벡터 경로 -> SVG 변환기 (경로·채우기·선만 처리)."""
import sys, re

def cmyk(c, m, y, k):
    r = round(255 * (1 - min(1, c + k))); g = round(255 * (1 - min(1, m + k))); b = round(255 * (1 - min(1, y + k)))
    return f'#{r:02x}{g:02x}{b:02x}'

def convert(src, out):
    lines = open(src, 'rb').read().decode('latin1').splitlines()
    start = next(i for i, l in enumerate(lines) if l.startswith('%%EndSetup'))
    fill, stroke, width = '#000000', '#000000', 1.0
    d = []  # 현재 경로
    comp = None  # compound path 모음
    out_parts = []
    def emit(paint_fill, paint_stroke, close):
        nonlocal d
        if not d: return
        if close: d.append('Z')
        attrs = f'fill="{fill if paint_fill else "none"}"'
        if paint_stroke: attrs += f' stroke="{stroke}" stroke-width="{width:g}"'
        if comp is not None:
            comp.append((' '.join(d), attrs))
        else:
            out_parts.append(f'<path d="{" ".join(d)}" {attrs} fill-rule="evenodd"/>')
        d = []
    for raw in lines[start:]:
        l = raw.strip()
        if not l or l.startswith('%'): continue
        t = l.split()
        op, a = t[-1], t[:-1]
        try:
            n = [float(x) for x in a]
        except ValueError:
            n = None
        if op == 'm' and n: d.append(f'M{n[0]:g} {-n[1]:g}')
        elif op in ('l', 'L') and n: d.append(f'L{n[0]:g} {-n[1]:g}')
        elif op in ('c', 'C') and n: d.append(f'C{n[0]:g} {-n[1]:g} {n[2]:g} {-n[3]:g} {n[4]:g} {-n[5]:g}')
        elif op in ('v', 'V') and n: d.append(f'S{n[0]:g} {-n[1]:g} {n[2]:g} {-n[3]:g}')  # 근사
        elif op in ('y', 'Y') and n: d.append(f'C{n[0]:g} {-n[1]:g} {n[2]:g} {-n[3]:g} {n[2]:g} {-n[3]:g}')
        elif op == 'k' and n and len(n) == 4: fill = cmyk(*n)
        elif op == 'K' and n and len(n) == 4: stroke = cmyk(*n)
        elif op == 'g' and n: fill = cmyk(0, 0, 0, 1 - n[0])
        elif op == 'G' and n: stroke = cmyk(0, 0, 0, 1 - n[0])
        elif op == 'Xa' and n: fill = '#%02x%02x%02x' % tuple(round(v * 255) for v in n[:3])
        elif op == 'XA' and n: stroke = '#%02x%02x%02x' % tuple(round(v * 255) for v in n[:3])
        elif op in ('x', 'X'):
            m = re.match(r'([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+) \((.*)\) ([\d.]+) ([\d]+ )?[xX]$', l)
            if m:
                c, mm, y, k, _, tint = m.groups()[:6]
                tt = float(tint); col = cmyk(*(float(v) * tt for v in (c, mm, y, k)))
                if op == 'x': fill = col
                else: stroke = col
        elif op == 'w' and n: width = n[0]
        elif op in ('f', 'F'): emit(True, False, op == 'f')
        elif op in ('s', 'S'): emit(False, True, op == 's')
        elif op in ('b', 'B'): emit(True, True, op == 'b')
        elif op in ('n', 'N'): d = []
        elif op == '*u': comp = []
        elif op == '*U':
            if comp:
                attrs = comp[0][1]
                out_parts.append(f'<path d="{" ".join(p for p, _ in comp)}" {attrs} fill-rule="evenodd"/>')
            comp = None
    x0, y0, x1, y1 = -161, -2174, 541, 900
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0} {-y1} {x1 - x0} {y1 - y0}">' + ''.join(out_parts) + '</svg>'
    open(out, 'w').write(svg)
    print('paths', len(out_parts), 'bytes', len(svg))

if __name__ == '__main__':
    convert(sys.argv[1], sys.argv[2])
