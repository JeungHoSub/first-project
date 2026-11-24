// 게임 화면 ♪ 버튼: 작은 소리 창 — 배경음악 켜기/끄기, 곡 바꾸기, 음악·효과음 크기, 목소리 안내
import * as sfx from './sound';

const $ = (id: string) => document.getElementById(id)!;
let pop: HTMLElement | null = null;

function build(): HTMLElement {
  const p = document.createElement('div'); p.id = 'snd-pop'; p.className = 'snd-pop'; p.hidden = true;
  p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', '소리 설정');
  p.innerHTML = `
    <div class="sp-row"><b>배경음악</b><button type="button" class="sp-sw" id="sp-bgm" role="switch"></button></div>
    <div class="sp-track"><button type="button" class="sp-arr" id="sp-prev" aria-label="이전 곡">‹</button><div class="sp-name"><b id="sp-tname"></b><small id="sp-tdesc"></small></div><button type="button" class="sp-arr" id="sp-next" aria-label="다음 곡">›</button></div>
    <label class="sp-row sp-vol"><b>음악 크기</b><input type="range" min="0" max="100" step="5" id="sp-mvol"><span id="sp-mval"></span></label>
    <label class="sp-row sp-vol"><b>효과음 크기</b><input type="range" min="0" max="100" step="5" id="sp-svol"><span id="sp-sval"></span></label>
    <div class="sp-row"><b>목소리 안내</b><button type="button" class="sp-sw" id="sp-voice" role="switch"></button></div>`;
  document.body.append(p);
  const step = (d: number) => {
    const list = sfx.BGM_TRACKS; const i = list.findIndex((t) => t.id === sfx.bgmTrack());
    const next = list[(i + d + list.length) % list.length];
    if (!sfx.isBgmOn()) sfx.setBgm(true);
    sfx.setBgmTrack(next.id); sync();
  };
  p.querySelector('#sp-prev')!.addEventListener('click', () => { sfx.click(); step(-1); });
  p.querySelector('#sp-next')!.addEventListener('click', () => { sfx.click(); step(1); });
  p.querySelector('#sp-bgm')!.addEventListener('click', () => { sfx.unlock(); sfx.setBgm(!sfx.isBgmOn()); sfx.click(); sync(); });
  p.querySelector('#sp-voice')!.addEventListener('click', () => { sfx.setVoice(!sfx.isVoiceOn()); sfx.click(); sync(); if (sfx.isVoiceOn()) sfx.say('고!'); });
  const m = p.querySelector<HTMLInputElement>('#sp-mvol')!, s = p.querySelector<HTMLInputElement>('#sp-svol')!;
  m.addEventListener('input', () => { sfx.setBgmVolume(+m.value / 100); if (!sfx.isBgmOn() && +m.value > 0) sfx.setBgm(true); sync(); });
  s.addEventListener('input', () => { sfx.setSfxVolume(+s.value / 100); sync(); });
  s.addEventListener('change', () => sfx.slap(0.7)); // 놓으면 이 크기로 한 번 들려 줌
  sfx.onBgmTrack(() => sync());
  return p;
}
function sync() {
  if (!pop) return;
  const tr = sfx.BGM_TRACKS.find((t) => t.id === sfx.bgmTrack());
  $('sp-tname').textContent = tr?.name ?? ''; $('sp-tdesc').textContent = tr?.desc ?? '';
  const on = sfx.isBgmOn();
  $('sp-bgm').setAttribute('aria-checked', String(on)); $('sp-bgm').textContent = on ? '켜짐' : '꺼짐';
  $('sp-voice').setAttribute('aria-checked', String(sfx.isVoiceOn())); $('sp-voice').textContent = sfx.isVoiceOn() ? '켜짐' : '꺼짐';
  const mv = Math.round(sfx.bgmVolume() * 100), sv = Math.round(sfx.sfxVolume() * 100);
  ($('sp-mvol') as HTMLInputElement).value = String(mv); $('sp-mval').textContent = `${mv}`;
  ($('sp-svol') as HTMLInputElement).value = String(sv); $('sp-sval').textContent = `${sv}`;
  pop.classList.toggle('bgm-off', !on);
  const b = $('btn-sound'); b.classList.toggle('off', !on);
}
function place() {
  const r = $('btn-sound').getBoundingClientRect();
  const w = pop!.offsetWidth;
  pop!.style.top = `${r.bottom + 8}px`;
  pop!.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.right - w + 10))}px`;
}
export function toggleSoundPanel() {
  pop ??= build();
  if (!pop.hidden) { pop.hidden = true; return; }
  sfx.unlock(); sync(); pop.hidden = false; place();
}
export function initSoundPanel() {
  $('btn-sound').setAttribute('aria-label', '소리 설정');
  document.addEventListener('pointerdown', (e) => {
    if (!pop || pop.hidden) return;
    const t = e.target as HTMLElement;
    if (!pop.contains(t) && !t.closest('#btn-sound')) pop.hidden = true;
  });
  addEventListener('resize', () => { if (pop && !pop.hidden) place(); });
}
