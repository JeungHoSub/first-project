// 주화 그림: 상평통보 실물을 본뜬 모양(넓고 평평한 테, 한 단 낮고 어두운 바닥, 도드라진 네모 구멍 테, 닳은 금속 결)
// 한자는 쓰지 않고 한글 네 글자를 위→아래→오른쪽→왼쪽 순서로 새긴다. 엽전(놋쇠)·은화(은)·금화(금).
export type Metal = 'yeop' | 'eun' | 'geum';
interface Pal { hi: string; mid: string; lo: string; edge: string; field: string; fieldLo: string; ink: string; words: [string, string, string, string] }
export const PAL: Record<Metal, Pal> = {
  // 엽전: 사진 속 상평통보처럼 누런 놋쇠, 바닥은 검게 삭은 색
  yeop: { hi: '#f2c98a', mid: '#c0843a', lo: '#6e4316', edge: '#4e2e0c', field: '#7a4e1e', fieldLo: '#3a230a', ink: '#e0a860', words: ['매', '직', '엽', '전'] },
  eun: { hi: '#e9edf1', mid: '#97a0aa', lo: '#4a525c', edge: '#2e343b', field: '#5a626b', fieldLo: '#262b31', ink: '#c9d0d7', words: ['매', '직', '은', '화'] },
  geum: { hi: '#fff8d6', mid: '#f2c54a', lo: '#a8761a', edge: '#6e5014', field: '#b08a30', fieldLo: '#5e4410', ink: '#fff0b8', words: ['매', '직', '금', '화'] },
};
let seq = 0;
/** 꽃잎 테(금화): n개 꽃잎을 가진 둥근 테 경로 */
function flower(r: number, n: number): string {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2, am = (a0 + a1) / 2;
    const p0 = [r * 0.965 * Math.cos(a0), r * 0.965 * Math.sin(a0)], p1 = [r * 0.965 * Math.cos(a1), r * 0.965 * Math.sin(a1)], c = [r * 1.06 * Math.cos(am), r * 1.06 * Math.sin(am)];
    d += `${i ? '' : `M${p0[0].toFixed(1)} ${p0[1].toFixed(1)} `}Q${c[0].toFixed(1)} ${c[1].toFixed(1)} ${p1[0].toFixed(1)} ${p1[1].toFixed(1)} `;
  }
  return d + 'Z';
}
/** 반지름 56짜리 주화를 (0,0) 중심으로 그린 SVG 조각 (defs 포함). 다른 SVG 안에 넣어 translate/scale 해서 쓴다
 *  입체감: 테(바깥 고리)와 네모 구멍 테를 각각 빛 받는 돋을새김(조명 필터)으로, 바닥은 한 단 낮게 안쪽 그림자. 글자 없음. */
export function coinGroup(m: Metal, detail = true): string {
  const p = PAL[m]; const k = `cn${++seq}`;
  const gold = m === 'geum';
  const outer = gold ? flower(57, 16) : circ(56);
  const rimPath = `${outer} ${circ(44)}`; // 바깥 - 바닥 = 테 (evenodd)
  const sqPath = 'M-18 -18 H18 V18 H-18Z M-12 -12 V12 H12 V-12Z';
  const bevel = (id: string, depth: number) => `<filter id="${id}" x="-15%" y="-15%" width="130%" height="130%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="${depth}" result="b"/>
      <feSpecularLighting in="b" surfaceScale="${3 + depth}" specularConstant="1.1" specularExponent="18" lighting-color="#ffffff" result="s"><feDistantLight azimuth="225" elevation="42"/></feSpecularLighting>
      <feComposite in="s" in2="SourceAlpha" operator="in" result="si"/>
      <feDiffuseLighting in="b" surfaceScale="${3 + depth}" diffuseConstant="1" lighting-color="#ffffff" result="d"><feDistantLight azimuth="225" elevation="50"/></feDiffuseLighting>
      <feComposite in="SourceGraphic" in2="d" operator="arithmetic" k1="1.15" k2="0" k3="0" k4="0" result="lit"/>
      <feComposite in="lit" in2="si" operator="arithmetic" k1="0" k2="1" k3=".85" k4="0" result="o"/>
      <feComposite in="o" in2="SourceAlpha" operator="in"/>
    </filter>`;
  return `<defs>
    <linearGradient id="${k}m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.hi}"/><stop offset=".45" stop-color="${p.mid}"/><stop offset="1" stop-color="${p.lo}"/></linearGradient>
    <radialGradient id="${k}f" cx="60%" cy="62%" r="70%"><stop offset="0" stop-color="${p.field}"/><stop offset="1" stop-color="${p.fieldLo}"/></radialGradient>
    <linearGradient id="${k}rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".75"/><stop offset=".5" stop-color="#000" stop-opacity=".15"/><stop offset="1" stop-color="#fff" stop-opacity=".45"/></linearGradient>
    <linearGradient id="${k}t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.hi}"/><stop offset="1" stop-color="${p.ink}"/></linearGradient>
    ${detail ? `${bevel(`${k}bv`, 2.2)}${bevel(`${k}bs`, 1.4)}
    <filter id="${k}n" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="3" seed="${seq % 9}" result="g"/>
      <feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="2" seed="${(seq * 7) % 13}" result="bb"/>
      <feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .4 -.08" result="ga"/>
      <feColorMatrix in="bb" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.3 -.7" result="ba"/>
      <feComposite in="ga" in2="SourceAlpha" operator="in" result="gw"/>
      <feComposite in="ba" in2="SourceAlpha" operator="in" result="bw"/>
      <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="bw"/><feMergeNode in="gw"/></feMerge>
    </filter>
    <filter id="${k}is" x="-10%" y="-10%" width="120%" height="120%"><feOffset dx="2.2" dy="2.6" in="SourceAlpha"/><feGaussianBlur stdDeviation="2.2" result="o"/><feComposite in="SourceAlpha" in2="o" operator="out" result="inv"/><feFlood flood-color="#000" flood-opacity=".7"/><feComposite in2="inv" operator="in" result="sh"/><feComposite in="sh" in2="SourceAlpha" operator="in"/></filter>` : ''}
  </defs>
  <path d="${outer}" fill="#000" opacity=".4" transform="translate(3 5)"/>
  <!-- 바닥(한 단 낮음) -->
  <g ${detail ? `filter="url(#${k}n)"` : ''}><path d="${circ(44)} M-12 -12 V12 H12 V-12Z" fill-rule="evenodd" fill="url(#${k}f)"/></g>
  ${detail ? `<path d="${circ(44)} M-18 -18 H18 V18 H-18Z" fill-rule="evenodd" fill="#000" filter="url(#${k}is)"/>` : ''}
  <!-- 테(돋을새김) -->
  <g ${detail ? `filter="url(#${k}bv)"` : ''}><path d="${rimPath}" fill-rule="evenodd" fill="url(#${k}m)"/></g>
  ${gold ? Array.from({ length: 40 }, (_, i) => { const a = (i / 40) * Math.PI * 2; return `<circle cx="${(50 * Math.cos(a)).toFixed(1)}" cy="${(50 * Math.sin(a)).toFixed(1)}" r="1.6" fill="url(#${k}t)" stroke="${p.lo}" stroke-width=".4"/>`; }).join('') : `<circle r="50" fill="none" stroke="${p.lo}" stroke-opacity=".5" stroke-width=".8"/>`}
  ${gold && detail ? `<g fill="none" stroke="${p.hi}" stroke-opacity=".5" stroke-width="1.1">${[45, 135, 225, 315].map((a) => `<path transform="rotate(${a})" d="M0 -40 c-5 2 -6 7 -2 9 c3 1 5 -2 3 -4 M0 -40 c5 2 6 7 2 9 c-3 1 -5 -2 -3 -4"/>`).join('')}</g>` : ''}
  <!-- 네모 구멍 테(돋을새김) -->
  <g ${detail ? `filter="url(#${k}bs)"` : ''}><path d="${sqPath}" fill-rule="evenodd" fill="url(#${k}m)"/></g>
  <path d="${outer}" fill="none" stroke="${p.edge}" stroke-width="1.2"/>
  <circle r="44" fill="none" stroke="url(#${k}rim)" stroke-width="1.4"/>
  <rect x="-12" y="-12" width="24" height="24" fill="none" stroke="${p.edge}" stroke-width="1.4"/>
  <path d="M-40 -30 A50 50 0 0 1 10 -50" fill="none" stroke="#fff" stroke-opacity="${gold ? '.6' : '.4'}" stroke-width="2.4" stroke-linecap="round"/>
  ${gold && detail ? [[-36, -38, 7, 0], [40, -22, 5, 0.7], [22, 42, 6, 1.3], [-44, 22, 4, 1.9]].map(([x, y, r, d]) => `<g transform="translate(${x} ${y})"><path d="M0 -${r} C1 -1 1 -1 ${r} 0 C1 1 1 1 0 ${r} C-1 1 -1 1 -${r} 0 C-1 -1 -1 -1 0 -${r}Z" fill="#fffbe8" opacity="0"><animate attributeName="opacity" values="0;1;0" dur="2.4s" begin="${d}s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="scale" values=".3;1.15;.3" dur="2.4s" begin="${d}s" repeatCount="indefinite"/></path></g>`).join('') : ''}`;
}
const circ = (r: number) => `M${r} 0 A${r} ${r} 0 1 0 ${-r} 0 A${r} ${r} 0 1 0 ${r} 0Z`;
/** 단독 주화 SVG */
export function coinSvg(m: Metal, size = 120, detail = true): string {
  return `<svg viewBox="-60 -60 120 120" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${coinGroup(m, detail)}</svg>`;
}
/** 엽전·은화·금화 작은 아이콘(.cur-ico, .coin-ico)을 새 주화 그림으로 바꾼다 */
export function installCoinIcons() {
  const uri = (m: Metal) => `url("data:image/svg+xml,${encodeURIComponent(coinSvg(m, 64, false))}")`;
  const st = document.createElement('style');
  st.textContent = `:root { --coin-yeop: url("data:image/svg+xml,${encodeURIComponent(coinSvg('yeop', 48, false))}"); --coin-eun: url("data:image/svg+xml,${encodeURIComponent(coinSvg('eun', 96))}"); --coin-geum: url("data:image/svg+xml,${encodeURIComponent(coinSvg('geum', 96))}"); }
    .cur-ico.yeop, .coin-ico { background: ${uri('yeop')} center / contain no-repeat !important; box-shadow: none !important; border-radius: 0 !important; }
    .cur-ico.eun { background: ${uri('eun')} center / contain no-repeat !important; box-shadow: none !important; border-radius: 0 !important; }
    .cur-ico.geum { background: ${uri('geum')} center / contain no-repeat !important; box-shadow: none !important; border-radius: 0 !important; }
    .cur-ico::after, .coin-ico::after { display: none !important; }`;
  document.head.append(st);
}

// ---------- 노리개(옥패·용옥패) ----------
// 실물 노리개처럼: 위에서 내려오는 끈 + 산호·옥 구슬·옥꽃, 투각(뚫어 새긴) 녹옥 원판, 아래 녹옥 구슬, 긴 비단 술, 옆으로 늘어진 분홍 장식.
// (0,0) = 원판 중심. 위로 약 -64, 아래로 약 +72까지 그린다.
export function norigaeGroup(dragon: boolean): string {
  const k = `ng${++seq}`;
  const jade = dragon
    ? { hi: '#9be0b4', mid: '#2f8f5a', lo: '#0f3f26', edge: '#082a19' }
    : { hi: '#8fd3a0', mid: '#2b7a45', lo: '#0f3a20', edge: '#0a2716' };
  const R = 30;
  // 투각 무늬: 바깥 고리에 구름 말림 8개 + 안쪽 매듭
  const scroll = (a: number) => `<path transform="rotate(${a})" d="M0 -26 c-6 0 -8 5 -5 8 c3 3 8 1 7 -3 M0 -26 c6 0 8 5 5 8 c-3 3 -8 1 -7 -3"/>`;
  const carve = dragon
    ? `<path d="M-14 18 C-26 6 -18 -16 -2 -18 C14 -20 24 -6 16 8 C10 18 -4 16 -6 6 C-8 -2 2 -8 8 -3"/>`
    : `${[0, 45, 90, 135, 180, 225, 270, 315].map(scroll).join('')}
       <path d="M-9 0 C-9 -9 0 -9 0 0 C0 9 9 9 9 0 C9 -9 0 -9 0 0 C0 9 -9 9 -9 0Z"/>
       <path d="M0 -9 C9 -9 9 0 0 0 C-9 0 -9 9 0 9 C9 9 9 0 0 0 C-9 0 -9 -9 0 -9Z"/>`;
  const tassel = Array.from({ length: 23 }, (_, i) => { const x = -9 + i * 0.82; const sway = Math.sin(i * 1.7) * 1.4; return `<path d="M${(x * 0.45).toFixed(1)} 40 C${(x * 0.7).toFixed(1)} 52 ${(x + sway).toFixed(1)} 60 ${(x * 1.15 + sway).toFixed(1)} 72"/>`; }).join('');
  return `<defs>
    <radialGradient id="${k}j" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="${jade.hi}"/><stop offset=".45" stop-color="${jade.mid}"/><stop offset="1" stop-color="${jade.lo}"/></radialGradient>
    <radialGradient id="${k}s" cx="35%" cy="30%" r="60%"><stop offset="0" stop-color="#fff" stop-opacity=".7"/><stop offset=".35" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <linearGradient id="${k}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2c0"/><stop offset=".5" stop-color="#d9a940"/><stop offset="1" stop-color="#7d5a16"/></linearGradient>
    <linearGradient id="${k}t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2c5a3e"/><stop offset="1" stop-color="#0e2418"/></linearGradient>
    <mask id="${k}m"><circle r="${R}" fill="#fff"/><g fill="none" stroke="#000" stroke-width="${dragon ? 2 : 2.6}" stroke-linecap="round">${dragon ? '<circle r="22" stroke-dasharray="3 5"/>' : carve}</g></mask>
    <filter id="${k}n"><feTurbulence type="fractalNoise" baseFrequency=".09" numOctaves="3" seed="4"/><feColorMatrix values="0 0 0 0 .02  0 0 0 0 .12  0 0 0 0 .05  0 0 0 .55 -.18"/><feComposite in2="SourceAlpha" operator="in"/><feMerge><feMergeNode in="SourceGraphic"/><feMergeNode/></feMerge></filter>
  </defs>
  <!-- 끈과 위쪽 구슬 -->
  <path d="M2 -70 C1 -60 -1 -50 0 -${R}" fill="none" stroke="#14261c" stroke-width="1.4"/>
  <ellipse cx="1.6" cy="-62" rx="2.6" ry="3.6" fill="#e2632a"/><ellipse cx="1" cy="-63" rx=".9" ry="1.4" fill="#ffc29a" opacity=".8"/>
  <circle cx="1" cy="-55" r="2.8" fill="#d8e6c8" stroke="#8aa77c" stroke-width=".5"/>
  ${[-49, -47, -45, -43].map((y) => `<ellipse cx="0.6" cy="${y}" rx="3.4" ry="1" fill="#2fa860"/>`).join('')}
  <g transform="translate(0.3 -38)">${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="0" cy="-3.2" rx="2.6" ry="3.4" fill="#cfe0c4" stroke="#8fae86" stroke-width=".5" transform="rotate(${a})"/>`).join('')}<circle r="1.6" fill="#f3e7c8"/></g>
  <!-- 원판 -->
  <circle r="${R + 1.5}" fill="#000" opacity=".35" transform="translate(2 3)"/>
  <g mask="url(#${k}m)">
    <circle r="${R}" fill="url(#${k}j)" filter="url(#${k}n)"/>
    <g fill="none" stroke-linecap="round">
      <g stroke="${jade.edge}" stroke-opacity=".75" stroke-width="1.3" transform="translate(.9 .9)">${dragon ? '' : carve}</g>
      <g stroke="#d8ffe6" stroke-opacity=".35" stroke-width=".8" transform="translate(-.6 -.6)">${dragon ? '' : carve}</g>
    </g>
    ${dragon ? `<g fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="${'M-14 18 C-26 6 -18 -16 -2 -18 C14 -20 24 -6 16 8 C10 18 -4 16 -6 6 C-8 -2 2 -8 8 -3'}" stroke="${jade.edge}" stroke-width="6.4"/>
      <path d="${'M-14 18 C-26 6 -18 -16 -2 -18 C14 -20 24 -6 16 8 C10 18 -4 16 -6 6 C-8 -2 2 -8 8 -3'}" stroke="url(#${k}g)" stroke-width="4.4"/>
      <path d="${'M-14 18 C-26 6 -18 -16 -2 -18 C14 -20 24 -6 16 8 C10 18 -4 16 -6 6 C-8 -2 2 -8 8 -3'}" stroke="#5a3e0c" stroke-opacity=".6" stroke-width="1" stroke-dasharray="1.4 2"/>
      <path d="M-14 18 C-17 22 -22 22 -24 19 M-14 18 C-12 23 -15 26 -19 26" stroke="url(#${k}g)" stroke-width="1.8"/>
      <path d="M-2 -18 L-4 -24 M2 -19 L3 -25 M16 8 L22 10 M-20 -4 L-26 -6" stroke="url(#${k}g)" stroke-width="1.4"/>
    </g>
    <g transform="translate(8 -3)"><path d="M0 0 C4 -4 10 -2 10 3 C10 7 4 8 2 5" fill="url(#${k}g)" stroke="#5a3e0c" stroke-width=".6"/><path d="M6 -2 L10 -8 M3 -2 L4 -8" stroke="url(#${k}g)" stroke-width="1.2" stroke-linecap="round"/><path d="M9 5 C14 7 15 11 12 13" stroke="#fff2c0" stroke-width=".7" fill="none"/><circle cx="5" cy="1" r=".9" fill="#c0302a"/></g>
    <circle cx="-3" cy="2" r="4.6" fill="#fff6dc"/><circle cx="-4.4" cy=".6" r="1.6" fill="#fff" opacity=".9"/>` : ''}
    <circle r="${R}" fill="url(#${k}s)"/>
  </g>
  <circle r="${R}" fill="none" stroke="${dragon ? `url(#${k}g)` : jade.edge}" stroke-width="${dragon ? 2.4 : 1}"/>
  ${dragon ? `<circle r="${R - 3}" fill="none" stroke="url(#${k}g)" stroke-width=".6" opacity=".7"/>` : ''}
  <!-- 아래 구슬과 술 -->
  <path d="M0 ${R} V38" stroke="#14261c" stroke-width="1.4"/>
  <circle cx="0" cy="${R + 4}" r="3.6" fill="url(#${k}j)"/><circle cx="-1" cy="${R + 3}" r="1.1" fill="#fff" opacity=".6"/>
  <path d="M-4 38 H4 L5 42 H-5Z" fill="#1d3a28"/>
  <g fill="none" stroke="url(#${k}t)" stroke-width=".9">${tassel}</g>
  <!-- 옆으로 늘어진 분홍 장식 -->
  <path d="M0 37 C-10 40 -18 44 -26 50 M0 37 C-8 44 -14 50 -20 58" fill="none" stroke="#14261c" stroke-width=".8"/>
  ${[[-12, 43], [-15, 45], [-18, 46.5]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.2" fill="#f4efe6"/>`).join('')}
  ${[[-9, 47], [-12, 51], [-15, 54]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.2" fill="#f4efe6"/>`).join('')}
  <path d="M-26 50 C-31 49 -34 53 -31 56 C-28 55 -26 53 -26 50Z" fill="#f2b6c4" stroke="#c98597" stroke-width=".5"/>
  <path d="M-20 58 C-25 58 -27 62 -24 64 C-21 63 -20 61 -20 58Z" fill="#f2b6c4" stroke="#c98597" stroke-width=".5"/>`;
}
