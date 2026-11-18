// 화면을 한 파일(HTML)로 묶는다: dist/magic-gostop.html
// 휴대폰에서 링크 하나로 열어 보기 위한 미리보기용. (앱 포장은 이후 단계)
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';

const r = await build({ entryPoints: ['src/ui/main.ts'], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020' });
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync('src/ui/style.css', 'utf8');
const body = readFileSync('src/ui/body.html', 'utf8');
const page = `<title>매직고스톱</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Noto+Sans+KR:wght@400;500;700&family=Noto+Serif+KR:wght@700;900&family=Nanum+Myeongjo:wght@700;800&family=Nanum+Brush+Script&display=swap">
<style>${css}</style>
${body}
<script>${js}</script>
`;
mkdirSync('dist', { recursive: true });
writeFileSync('dist/magic-gostop.html', page);
// 배경음악(녹음 음원)은 페이지 옆 bgm/ 폴더로 (미리보기에서는 같은 폴더에 두고 함께 올린다)
mkdirSync('dist/bgm', { recursive: true });
mkdirSync('dist/chars', { recursive: true });
for (const f of readdirSync('assets/chars')) if (f.endsWith('.webp')) copyFileSync(`assets/chars/${f}`, `dist/chars/${f}`);
for (const f of readdirSync('assets/bgm')) if (f.endsWith('.mp3')) copyFileSync(`assets/bgm/${f}`, `dist/bgm/${f}`);
console.log('dist/magic-gostop.html', (page.length / 1024).toFixed(1) + 'KB');
