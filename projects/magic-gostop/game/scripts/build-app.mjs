// 앱 포장용 빌드: ../app/www 에 완전한 index.html + manifest + 서비스워커 + 아이콘을 만든다.
// 같은 결과물을 PWA(홈 화면에 설치)와 Capacitor(안드로이드·iOS 앱)가 함께 쓴다.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';

const OUT = '../app/www';
const r = await build({ entryPoints: ['src/ui/main.ts'], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020' });
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync('src/ui/style.css', 'utf8');
const body = readFileSync('src/ui/body.html', 'utf8');
const version = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<meta name="theme-color" content="#140b08">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="description" content="한국 화투로 즐기는 맞고 · 아이템 수집">
<title>매직고스톱</title>
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Noto+Sans+KR:wght@400;500;700&family=Noto+Serif+KR:wght@700;900&family=Nanum+Myeongjo:wght@700;800&family=Nanum+Brush+Script&display=swap">
<style>html,body{margin:0;height:100%;background:#0c1714}[hidden]{display:none!important}${css}</style>
</head>
<body>
${body}
<script>${js}</script>
<script>if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});</script>
</body>
</html>
`;
const manifest = {
  name: '매직고스톱', short_name: '매직고스톱', lang: 'ko', dir: 'ltr',
  description: '한국 화투로 즐기는 맞고 · 아이템 수집',
  start_url: './', scope: './', display: 'standalone', orientation: 'any',
  background_color: '#0c1714', theme_color: '#140b08', categories: ['games'],
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};
// 오프라인: 앱 파일은 먼저 저장해 두고, 글꼴은 처음 받은 뒤 저장해 쓴다
const sw = `const C='mg-${version}';const CORE=['./','index.html','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET')return;
if(u.pathname.includes('/bgm/'))return;
if(u.origin===location.origin){e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp));return r;}).catch(()=>caches.match(e.request)));return;}
if(/fonts\\.(googleapis|gstatic)\\.com/.test(u.host)){e.respondWith(caches.match(e.request).then(m=>m||fetch(e.request).then(r=>{const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp));return r;})));}});
`;
mkdirSync(`${OUT}/icons`, { recursive: true });
writeFileSync(`${OUT}/index.html`, html);
writeFileSync(`${OUT}/manifest.webmanifest`, JSON.stringify(manifest, null, 2));
writeFileSync(`${OUT}/sw.js`, sw);
mkdirSync(`${OUT}/bgm`, { recursive: true });
for (const f of readdirSync('assets/bgm')) if (f.endsWith('.mp3')) copyFileSync(`assets/bgm/${f}`, `${OUT}/bgm/${f}`);
for (const f of readdirSync('../app/icons')) if (f.endsWith('.png')) copyFileSync(`../app/icons/${f}`, `${OUT}/icons/${f}`);
console.log(`${OUT}/index.html`, (html.length / 1024).toFixed(1) + 'KB', 'version', version);
