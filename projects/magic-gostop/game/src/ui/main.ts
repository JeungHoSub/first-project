import { applyAction, createGame, getLegalActions, score, scoreOf, setGukjin, setMagicState, magicSwap, magicSweep, magicExtraFlip, PI_VALUE, ALL_CARDS, buildBonusCards } from '../engine';
import * as net from './online';
import * as items from './items-runtime';
import { copyOf, USE_LABEL, STACK_RULE } from './item-copy';
import type { Action, Card, GameEvent, GameState, PlayerId } from '../engine';
import { chooseAction, AI_LEVELS, type AiLevel } from '../ai/simple';
import { cardArt } from './art';
import * as sfx from './sound';
import { initNative, askConfirm } from './native';
import { initMonet, openCharge, needCoins } from './monet';
import { initGacha, openGacha, attachItemTip, onZoomChange } from './gacha';
import { initEconomy, record as missionRecord, missionReady, syncCurrencies } from './economy';
import * as chars from './characters';
import { installCoinIcons, coinSvg, norigaeGroup } from './coin-art';
installCoinIcons();
// 홈 뽑기 버튼: 옻칠판 + 나전 구름 + 양옆 금화·용옥패
{
  const g = document.getElementById('btn-gacha');
  if (g) g.innerHTML = `<span class="gb-art l">${coinSvg('geum', 60)}</span><span class="gb-txt"><b>뽑기</b><small>엽전 · 은화 · 금화로 뽑기</small></span><span class="gb-art r"><svg viewBox="-42 -74 84 150" aria-hidden="true">${norigaeGroup(true)}</svg></span><i class="gb-shine" aria-hidden="true"></i>`;
  const sh = document.getElementById('btn-shop');
  if (sh) sh.insertAdjacentHTML('beforeend', `<span class="sp-coins" aria-hidden="true">${[0, 1, 2].map((i) => `<span style="--k:${i}">${coinSvg('yeop', 26, false)}</span>`).join('')}</span>`);
}
import { earn, lose, coins, fmt, FIRST_PPEOK_COINS, add as addCur, ROOMS } from './wallet';
import { ITEMS, GRADES, GRADE_RATE, CATEGORY_LABEL, EQUIP_LIMITS, DROP_RATE, itemArt, gradeFill, ownedOf, bestGrade, ownedKinds, rollDrop, type Drop, type ItemDef, type Category, MAGIC_IDS, magicParams, grantTestMagic, type MagicId } from './collection';

// 화면 = 엔진 상태를 그리기만 한다. 규칙 판단은 전부 엔진(getLegalActions/applyAction)에 맡긴다.
// 엔진은 한 행동을 한 번에 처리하므로, 화면은 이벤트로 중간 장면(낸 패가 바닥에 놓임 → 뒤집은 패가 놓임 → 먹은 패가 들어옴)을
// 차례로 다시 만들어 보여 준다.
const ME: PlayerId = 0;
const AI: PlayerId = 1;
const MOVE = 420; // 카드 한 번 움직이는 시간
const BEAT = 160; // 장면 사이 쉬는 시간
const AI_THINK = 550; // 상대가 내기 전 뜸
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let speed = 1; // 패 속도: 1 보통 · 0.6 빠르게
try { if (localStorage.getItem('mg-speed') === 'fast') speed = 0.6; } catch { /* 무시 */ }
const wait = (ms: number) => new Promise((r) => setTimeout(r, reduced ? 0 : ms * speed));
const GO_WORD = ['', '고', '투 고', '쓰리 고', '포 고', '파이브 고', '식스 고'];
/** 한 수에서 나온 일 중 가장 중요한 것 하나를 음성으로 (상위 맞고 앱의 효과 음성) */
function announce(evs: GameEvent[]) {
  const pri: [string, (e: GameEvent) => string | null][] = [
    ['chongtong', () => '총통!'], ['bomb', () => '폭탄!'],
    ['go', (e) => { const n = (e as { goCount: number }).goCount; return `${GO_WORD[n] ?? `${n} 고`}!`; }], ['stop', () => '스톱!'],
    ['sweep', () => '싹쓸이!'], ['firstPpeok', () => '첫 뻑!'],
    ['ppeokEat', (e) => ((e as { fromPpeok: boolean; self: boolean }).fromPpeok ? ((e as { self: boolean }).self ? '자뻑!' : '뻑 먹었다!') : null)],
    ['ttadak', () => '따닥!'], ['jjok', () => '쪽!'], ['ppeok', () => '뻑!'],
  ];
  for (const [t, f] of pri) {
    const e = evs.find((x) => x.type === t);
    if (e) { const w = f(e); if (w) { sfx.say(w, t !== 'stop'); return; } }
  }
}

const FLOWER = ['', '송학', '매조', '벚꽃', '흑싸리', '난초', '모란', '홍싸리', '공산', '국화', '단풍', '오동', '비', '보너스'];
const KIND_LABEL: Record<Card['kind'], string> = { G: '광', Y: '열끗', T: '띠', P: '피', D: '쌍피', B2: '보너스 2피', B3: '보너스 3피' };
const TAG_LABEL: Record<string, string> = { hong: '홍단', cheong: '청단', cho: '초단', godori: '고도리', gukjin: '국진', bi: '비광' };

const $ = (id: string) => document.getElementById(id)!;
let s: GameState; // 엔진의 진짜 상태 (온라인에서는 서버가 보내 준 내 시점의 판)
/** 온라인 대전 중이면 서버로 수를 보내는 함수와 상대 프로필 */
let online: { send: (a: Action) => void; opp: net.OppProfile; ended: boolean } | null = null;
let remoteQ: Promise<void> = Promise.resolve();
let busy = false; // 연출 중에는 입력을 막는다
let gameNo = 0; // 새 판을 누르면 진행 중인 연출을 끊기 위한 번호

// 바닥 자리 12곳: 가운데 더미를 둘러싸게 위 4 / 왼쪽 2 / 오른쪽 2 / 아래 4.
const SLOTS: [number, number][] = [
  [13, 24], [33, 24], [67, 24], [87, 24], // 0~3 위 줄
  [13, 76], [33, 76], [67, 76], [87, 76], // 4~7 아래 줄
  [50, 22], [50, 78], // 8~9 더미 바로 위·아래 (마지막에 사용)
  [13, 50], [87, 50], // 10~11 양 끝 가운데
];
const SLOT_ORDER = [1, 2, 5, 6, 0, 3, 4, 7, 8, 9, 10, 11]; // 더미 둘레 위·아래 두 줄부터 고르게
const slotOf = new Map<number, number>();
function hash(t: string) { let h = 7; for (const ch of t) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }

const allCards = new Map<string, Card>();
const byId = (id: string) => allCards.get(id)!;
const cardName = (c: Card) => (c.month === 13 ? KIND_LABEL[c.kind] : `${c.month}월 ${c.tag === 'bi' ? '비광' : KIND_LABEL[c.kind]}`);

function cardEl(c: Card, tag: 'div' | 'button' = 'div'): HTMLElement {
  const el = document.createElement(tag);
  el.className = `card k-${c.kind}`;
  el.dataset.id = c.id;
  el.innerHTML = `${cardArt(c)}${c.month === 13 ? '' : `<span class="mo">${c.month}</span>`}`;
  el.setAttribute('aria-label', `${FLOWER[c.month]} ${cardName(c)}${c.tag ? ' ' + TAG_LABEL[c.tag] : ''}`);
  if (tag === 'button') (el as HTMLButtonElement).type = 'button';
  return el;
}

type ScoreRes = ReturnType<typeof score>;
const COMBOS: { key: string; label: string; tag: string; group: string }[] = [
  { key: 'godori', label: '고도리', tag: 'godori', group: '열끗' },
  { key: 'hong', label: '홍단', tag: 'hong', group: '띠' },
  { key: 'cheong', label: '청단', tag: 'cheong', group: '띠' },
  { key: 'cho', label: '초단', tag: 'cho', group: '띠' },
];
/** 먹은 패 칸: 칸마다 장수 + (점수 났으면 +n점 / 아니면 다음 점수까지 n/목표) + 족보 진행(2장 이상부터) */
function renderCaps(target: HTMLElement, cards: Card[], sc: ScoreRes) {
  target.innerHTML = '';
  const gukjinAsPi = (sc as ScoreRes & { gukjin?: string | null }).gukjin === 'pi';
  const isGukjin = (c: Card) => c.month === 9 && c.kind === 'Y';
  const groups: [string, (c: Card) => boolean, string[], number][] = [
    ['광', (c) => c.kind === 'G', ['gwang'], 3],
    ['열끗', (c) => c.kind === 'Y' && !(gukjinAsPi && isGukjin(c)), ['yeol', 'godori'], 5],
    ['띠', (c) => c.kind === 'T', ['tti', 'hong', 'cheong', 'cho'], 5],
    ['피', (c) => ['P', 'D', 'B2', 'B3'].includes(c.kind) || (gukjinAsPi && isGukjin(c)), ['pi'], 10],
  ];
  for (const [label, pick, keys, goal] of groups) {
    const list = cards.filter(pick);
    const n = label === '피' ? list.reduce((a, c) => a + (isGukjin(c) ? 2 : PI_VALUE[c.kind] ?? 1), 0) : list.length;
    const pts = sc.details.filter((d) => keys.includes(d.key)).reduce((a, d) => a + d.points, 0);
    const grp = document.createElement('div');
    grp.className = 'cap-group' + (pts ? ' scored' : '');
    const status = pts ? `<em class="pts">+${pts}</em>` : `<em class="need">${Math.min(n, goal)}/${goal}</em>`;
    const combos = COMBOS.filter((cb) => cb.group === label).map((cb) => {
      const k = cards.filter((c) => c.tag === cb.tag).length;
      if (k < 2) return '';
      return `<span class="combo ${k >= 3 ? 'done' : ''} cb-${cb.key}">${cb.label} ${k}/3</span>`;
    }).join('');
    grp.innerHTML = `<div class="cap-label">${label}<b>${n}</b>${status}</div>${combos ? `<div class="combos">${combos}</div>` : ''}<div class="cap-cards"></div>`;
    const box = grp.querySelector('.cap-cards') as HTMLElement;
    box.style.setProperty('--n', String(Math.max(list.length, 1)));
    list.forEach((c) => box.append(cardEl(c)));
    if (!list.length) box.classList.add('empty');
    target.append(grp);
  }
}

/** 먹은 패 자세히 보기: 두 사람 패를 크게, 점수 내역과 함께 */
function showCapsDetail() {
  const view = s;
  const grid = $('cd-grid'); grid.innerHTML = '';
  ([AI, ME] as PlayerId[]).forEach((p) => {
    const sc = scoreOf(view, p);
    const col = document.createElement('section');
    col.className = 'cd-col';
    col.innerHTML = `<div class="cd-head"><b>${p === ME ? '나' : '상대'}</b><span>${sc.total}점</span></div><div class="cd-caps"></div>
      <ul class="cd-list">${sc.details.map((d) => `<li><span>${d.label}</span><span>${d.points}점</span></li>`).join('') || '<li><span>아직 점수 없음</span><span></span></li>'}</ul>`;
    renderCaps(col.querySelector('.cd-caps') as HTMLElement, view.captured[p], sc);
    grid.append(col);
  });
  $('caps-detail').hidden = false;
}

/** 아이템이 화면에 남기는 표시: 안개(가려진 바닥 패), 도깨비불 등롱(안 보인 패 정보) */
function decorateItems(view: GameState) {
  const run = items.current();
  document.querySelectorAll<HTMLElement>('#floor .card').forEach((el) => {
    const id = el.dataset.id ?? '';
    const hidden = !!run?.fogHidden.has(id);
    el.classList.toggle('fogged', hidden && !run!.fogPeeked.has(id));
    el.classList.toggle('fog-peek', hidden && run!.fogPeeked.has(id));
    if (hidden && !run!.fogPeeked.has(id)) el.classList.remove('target', 'only-me', 'm2', 'm3', 'risk');
  });
  const box = $('lantern');
  const lg = items.lanternGrade();
  if (lg < 0 || view.phase === 'ended') { box.hidden = true; return; }
  box.hidden = false;
  const seen = new Set<string>([...view.hands[ME], ...view.floor, ...view.captured[ME], ...view.captured[AI]].map((c) => c.id));
  if (view.pending) { seen.add(view.pending.card.id); if (view.pending.later) seen.add(view.pending.later.id); }
  const unseen = [...allCards.values()].filter((c) => !seen.has(c.id) && c.month <= 12 && !run?.fogHidden.has(c.id));
  const myMonths = new Set(view.hands[ME].map((c) => c.month));
  const floorMonths = new Set(view.floor.map((c) => c.month));
  const months = Array.from({ length: 12 }, (_, i) => i + 1).filter((m) => lg >= 2 || myMonths.has(m) || (lg >= 1 && floorMonths.has(m)));
  const gwangMonths = new Set(unseen.filter((c) => c.kind === 'G').map((c) => c.month));
  // 기본은 접힌 작은 버튼 — 판을 가리지 않게. 누르면 펼침(이 기기에 기억)
  if (!box.dataset.wired) {
    box.dataset.wired = '1';
    box.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).closest('.ln-chip')) return;
      const open = !box.classList.contains('open'); box.classList.toggle('open', open);
      try { localStorage.setItem('mg-lantern-open', open ? '1' : '0'); } catch { /* 무시 */ }
      sfx.click();
    });
    try { box.classList.toggle('open', localStorage.getItem('mg-lantern-open') === '1'); } catch { /* 무시 */ }
  }
  let html = `<button type="button" class="ln-chip" aria-label="도깨비불 등롱 정보 펼치기·접기">등롱</button><div class="ln-body"><div class="ln-title">도깨비불 등롱 <small>안 보인 패</small></div><div class="ln-months">${months.map((m) => {
    const n = unseen.filter((c) => c.month === m).length;
    return `<span class="${n ? '' : 'zero'}${lg >= 7 && gwangMonths.has(m) ? ' gw' : ''}"><b>${m}월</b>${n}</span>`;
  }).join('')}</div>`;
  if (lg >= 3) {
    const k = (kk: string[]) => unseen.filter((c) => kk.includes(c.kind)).length;
    html += `<div class="ln-row">남은 종류 · 광 ${k(['G'])} · 열끗 ${k(['Y'])} · 띠 ${k(['T'])} · 피 ${k(['P', 'D'])}</div>`;
  }
  if (lg >= 4) {
    const oc = view.captured[AI];
    const k = (kk: string[]) => oc.filter((c) => kk.includes(c.kind)).length;
    html += `<div class="ln-row">상대가 먹은 패 · 광 ${k(['G'])} · 열끗 ${k(['Y'])} · 띠 ${k(['T'])} · 피류 ${k(['P', 'D', 'B2', 'B3'])}</div>`;
  }
  if (lg >= 5) {
    const opp = new Set(view.captured[AI].map((c) => c.id));
    const can = (f: (c: Card) => boolean) => [...allCards.values()].filter(f).every((c) => !opp.has(c.id));
    const tag = (t: string) => can((c) => c.tag === t);
    html += `<div class="ln-row">완성 가능 · 홍단 ${tag('hong') ? '○' : '×'} · 청단 ${tag('cheong') ? '○' : '×'} · 초단 ${tag('cho') ? '○' : '×'} · 고도리 ${tag('godori') ? '○' : '×'}</div>`;
  }
  if (lg >= 8) html += `<div class="ln-row">상대는 7점까지 <b>${Math.max(0, view.options.winScore - scoreOf(view, AI).total)}점</b> 남음</div>`;
  if (lg >= 6) {
    const log = view.events.filter((e) => e.type === 'capture').slice(-(lg >= 7 ? 12 : 6)).reverse()
      .map((e) => (e.type === 'capture' ? `${e.player === ME ? '나' : '상대'} ${e.cards.map((x) => byId(x).month).filter((m) => m <= 12).join('·')}월` : ''));
    if (log.length) html += `<div class="ln-row ln-log">먹기 기록 · ${log.join(' / ')}</div>`;
  }
  box.innerHTML = html + '</div>';
}

/** 상태 하나를 그린다. view가 진짜 상태이고 내 차례이며 연출 중이 아닐 때만 누를 수 있다. */
function render(view: GameState) {
  const live = view === s && !busy;
  const legal = live ? getLegalActions(view) : [];
  const myTurn = live && view.turn === ME && view.phase !== 'ended';
  const sc = [scoreOf(view, 0), scoreOf(view, 1)];

  if (online) { const tm = document.getElementById('turn-timer'); const host = document.querySelector(`.player.${view.turn === ME ? 'me' : 'opp'} .pname`); if (tm && host && tm.parentElement !== host) host.append(tm); }
  for (const [p, sfx] of [[ME, 'my'], [AI, 'opp']] as const) {
    const b = $(`${sfx}-score`);
    b.textContent = String(sc[p].total);
    { const m = document.getElementById(`${sfx}-money`); if (m) m.textContent = online ? '' : fmt(sc[p].total * ROOMS[level].per); }
    b.parentElement!.classList.toggle('hot', sc[p].total >= view.options.winScore);
    b.parentElement!.style.setProperty('--pct', String(Math.min(sc[p].total / view.options.winScore, 1)));
    const go = $(`${sfx}-go`);
    const ip = (view.itemPts?.[p] ?? []).reduce((a, x) => a + x.points, 0);
    const tags = [view.goCount[p] ? `${view.goCount[p]}고` : '', view.shakes[p] ? `흔들 ×${2 ** view.shakes[p]}` : '', ip ? `아이템 +${ip}` : ''].filter(Boolean);
    go.hidden = !tags.length;
    go.textContent = tags.join(' · ');
  }
  document.querySelector('.player.me')!.classList.toggle('turn', view.turn === ME && view.phase !== 'ended');
  document.querySelector('.player.opp')!.classList.toggle('turn', view.turn === AI && view.phase !== 'ended');
  const oppN = view.hands[AI].length + view.dummies[AI];
  $('opp-hand').textContent = `손패 ${oppN}장`;
  const fan = $('opp-fan');
  if (fan.querySelectorAll('i').length !== oppN) {
    fan.innerHTML = '';
    for (let i = 0; i < oppN; i++) { const d = document.createElement('i'); d.style.setProperty('--k', String(i - (oppN - 1) / 2)); fan.append(d); }
    const n = document.createElement('span'); n.textContent = String(oppN); fan.append(n);
  }
  $('deck-n').textContent = String(view.deck.length);
  ($('deck') as HTMLElement).style.visibility = view.deck.length ? 'visible' : 'hidden';
  $('seed').textContent = view.seed;

  renderCaps($('opp-caps'), view.captured[AI], sc[AI]);
  renderCaps($('my-caps'), view.captured[ME], sc[ME]);

  // 바닥: 가운데 더미 둘레. 같은 월은 한 자리에 겹쳐 놓고, 자리는 판이 끝날 때까지 유지한다.
  // 고르는 중인 패(pending)도 그 월 자리에 같이 보여 준다.
  const floorCards = view.pending ? [...view.floor, view.pending.card, ...(view.pending.later ? [view.pending.later] : [])] : view.floor;
  const floor = $('floor');
  floor.querySelectorAll('.floor-month').forEach((n) => n.remove());
  const onFloor = new Set(floorCards.map((c) => c.month));
  for (const [m] of slotOf) if (!onFloor.has(m)) slotOf.delete(m);
  for (const c of floorCards) {
    if (!slotOf.has(c.month)) {
      const used = new Set(slotOf.values());
      slotOf.set(c.month, SLOT_ORDER.find((i) => !used.has(i)) ?? 0);
    }
  }
  const pickable = myTurn && view.phase === 'chooseMatch' ? new Set(view.pending!.options) : new Set<string>();
  for (const m of onFloor) {
    const [x, y] = SLOTS[slotOf.get(m)!];
    const j = hash(view.seed + m);
    const grp = document.createElement('div');
    grp.className = 'floor-month';
    if (floorCards.some((f) => f.month === m && pickable.has(f.id))) grp.classList.add('choosing');
    grp.style.left = `${x}%`;
    grp.style.top = `${y}%`;
    grp.style.setProperty('--rot', `${((j % 5) - 2) * 0.6}deg`); // 아주 살짝만 — 가지런하게
    for (const c of floorCards.filter((f) => f.month === m)) {
      if (pickable.has(c.id)) {
        const el = cardEl(c); el.classList.add('pick');
        grp.append(el);
      } else {
        const el = cardEl(c);
        if (view.pending && (c.id === view.pending.card.id || c.id === view.pending.later?.id)) el.classList.add('held');
        if (myTurn && view.phase === 'play' && view.hands[ME].some((h) => h.month === c.month)) {
          el.classList.add('target');
          const k = monthState(view, c.month);
          // 폭탄이 되는 월: 빨간 ▼로 강조 (회색보다 우선)
          if (legal.some((a) => a.type === 'bomb' && a.month === c.month)) { el.classList.add('bomb-target'); grp.classList.add('gbomb'); }
          else if (k.onlyMe) { el.classList.add('mine-only'); grp.classList.add('gonly'); }
          else if (k.floorN >= 2) { el.classList.add(k.floorN >= 3 ? 'm3' : 'm2'); grp.classList.add(k.floorN >= 3 ? 'g3' : 'g2'); }
        }
        grp.append(el);
      }
    }
    // 겹친 장수 배지(2장 이상), 내가 1장 들고 바닥 2장이면 "택1"
    const fn = floorCards.filter((f) => f.month === m).length;
    if (fn >= 2) {
      const k = monthState(view, m);
      const badge = document.createElement('span');
      badge.className = 'stack-n' + (fn >= 3 ? ' s3' : '');
      badge.textContent = myTurn && view.phase === 'play' && fn === 2 && k.mineN === 1 && !k.onlyMe ? '2 · 택1' : String(fn);
      if (badge.textContent.includes('택1')) badge.classList.add('pick1');
      grp.append(badge);
    }
    floor.append(grp);
  }

  // 내 손패 (+ 폭탄 뒤 받은 빈 패)
  const hand = $('hand'); hand.innerHTML = '';
  const canPlayPhase = myTurn && view.phase === 'play';
  hand.classList.toggle('locked', !canPlayPhase);
  hand.style.setProperty('--n', String(Math.max(view.hands[ME].length + view.dummies[ME], 1)));
  for (const c of [...view.hands[ME]].sort((a, b) => a.month - b.month || a.id.localeCompare(b.id))) {
    const b = cardEl(c, 'button') as HTMLButtonElement;
    const canPlay = canPlayPhase && legal.some((a) => a.type === 'play' && a.cardId === c.id);
    b.disabled = !canPlay;
    if (canPlay && (onFloor.has(c.month) || c.month === 13)) {
      b.classList.add('match');
      // 바닥 같은 월 장수에 따라 색: 1장 금색 / 2장 파랑(골라 먹기) / 3장 빨강(다 먹고 피 뺏기)
      const k = monthState(view, c.month);
      if (legal.some((a) => a.type === 'bomb' && a.month === c.month)) {
        // 폭탄 가능: 빨간 ▼ + 가장 높이 튀어나오게
        b.classList.add('bomb-ready');
        const ar = document.createElement('span'); ar.className = 'only-arrow bomb-arrow'; ar.textContent = '▼';
        ar.setAttribute('aria-label', '폭탄 가능'); b.append(ar);
      }
      else if (k.onlyMe && k.floorN > 0) {
        b.classList.add('mine-only');
        const ar = document.createElement('span'); ar.className = 'only-arrow'; ar.textContent = '▼';
        ar.setAttribute('aria-label', '나만 먹을 수 있는 패'); b.append(ar);
      }
      else if (k.floorN >= 2) b.classList.add(k.floorN >= 3 ? 'm3' : 'm2');
    }
    // 힌트 점: 회색 = 남은 같은 월이 내 손에만 있어 나중에 내도 되는 패, 노랑 = 바닥 1장 + 남은 1장이 아직 안 나와 뻑(쌀) 위험이 있는 패
    if (canPlay && c.month !== 13) {
      const h = hintFor(view, c);
      if (h) { const dot = document.createElement('span'); dot.className = `hint ${h}`; dot.title = h === 'safe' ? '나중에 내도 되는 패' : '쌀 위험이 있는 패'; dot.setAttribute('aria-label', dot.title); b.append(dot); }
    }
    b.addEventListener('pointerenter', () => markTargets(c.month, true));
    b.addEventListener('pointerleave', () => markTargets(c.month, false));
    if (canPlay && specialFor(c, legal)) b.classList.add('triple');
    b.addEventListener('click', () => onHandCard(c));
    hand.append(b);
  }
  for (let i = 0; i < view.dummies[ME]; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'card dummy-card';
    b.innerHTML = '<span>빈 패</span><small>뒤집기만</small>';
    b.disabled = !(canPlayPhase && legal.some((a) => a.type === 'dummy'));
    b.addEventListener('click', () => perform({ type: 'dummy' }));
    hand.append(b);
  }

  let prompt = '';
  if (view.phase === 'ended') prompt = '판이 끝났습니다';
  else if (view.turn === AI) prompt = '상대 차례';
  else if (!live) prompt = '';
  else if (view.phase === 'play') prompt = '낼 패를 고르세요';
  else if (view.phase === 'chooseMatch') prompt = `${cardName(view.pending!.card)}로 먹을 패를 고르세요`;
  $('prompt').textContent = prompt;

  // 바닥 2장 중 고르기: 내가 낸 패는 빼고, 깔려 있던 두 장만 크게 보여 준다
  const choosing = myTurn && view.phase === 'chooseMatch' && !sameChoice(view);
  $('choose').hidden = !choosing;
  if (choosing) {
    const pend = view.pending!;
    $('ch-title').textContent = `${pend.card.month}월 두 장 중 어느 패를 먹을까요?`;
    $('ch-sub').textContent = `${pend.source === 'hand' ? '낸 패' : '뒤집은 패'}: ${cardName(pend.card)}`;
    const box = $('ch-cards'); box.innerHTML = '';
    for (const id of pend.options) {
      const c = view.floor.find((f) => f.id === id)!;
      const b = cardEl(c, 'button');
      b.classList.add('choice');
      const tag = c.tag ? TAG_LABEL[c.tag] : KIND_LABEL[c.kind];
      const wrap = document.createElement('div'); wrap.className = 'choice-wrap';
      wrap.append(b);
      const cap = document.createElement('div'); cap.className = 'choice-cap'; cap.textContent = tag;
      wrap.append(cap);
      b.addEventListener('click', () => { $('choose').hidden = true; perform({ type: 'choose', cardId: c.id }); });
      box.append(wrap);
    }
  }

  renderMagicBar(view);
  const gs = myTurn && view.phase === 'goStop' && $('gukjin').hidden;
  $('gostop').hidden = !gs;
  if (gs) {
    const n = view.goCount[ME];
    const canGo = legal.some((a) => a.type === 'go');
    $('gs-title').textContent = `${sc[ME].total}점 났습니다`;
    $('gs-sub').textContent = canGo
      ? `고 하면 판을 계속해서 점수를 더 냅니다. 지금 고 하면 ${n + 1}고(+${n + 1}점${n + 1 >= 3 ? `, ×${2 ** (n + 1 - 2)}` : ''}). 스톱하면 지금 점수로 이깁니다.`
      : '마지막 차례라 스톱만 할 수 있습니다.';
    ($('btn-go') as HTMLButtonElement).hidden = !canGo;
  }
  decorateItems(view);
}

// ---------- 매직 카드 (실제 판 적용) ----------
interface Equipped { id: MagicId; g: number; uses: number }
const MAGIC_SET = new Set<string>(MAGIC_IDS);
let picked: string[] = []; // 다음 판에 가져갈 아이템 (분류별 장착 한도 · items-runtime)
let equipped: Equipped[] = [];
let selectMode: null | { kind: 'swap' | 'sweep'; slot: Equipped; need: number; chosen: string[] } = null;
let prevTurnStart: GameState | null = null; // 되돌리기: 내 직전 차례가 시작될 때 상태
let curTurnStart: GameState | null = null;
const itemOf = (id: string) => ITEMS.find((x) => x.id === id)!;
picked = items.loadLoadout();
items.setLookup((id) => allCards.get(id));

function ownedMagic() { return MAGIC_IDS.filter((id) => bestGrade(id) >= 0); }

let pickTab: Category | null = null;
function openMagicPick() {
  picked = items.sanitize(picked);
  const cats = (Object.keys(CATEGORY_LABEL) as Category[]).filter((c) => ITEMS.some((it) => it.category === c && bestGrade(it.id) >= 0));
  $('mp-empty').hidden = cats.length > 0;
  if (!pickTab || !cats.includes(pickTab)) pickTab = cats[0] ?? null;
  // 장착 슬롯 요약
  $('mp-slots').innerHTML = (Object.keys(CATEGORY_LABEL) as Category[]).map((c) => {
    const on = picked.filter((id) => items.catOf(id) === c);
    const cap = EQUIP_LIMITS[c];
    const cells = Array.from({ length: c === 'cosmetic' ? Math.max(on.length, 1) : cap }, (_, i) => on[i]
      ? `<i class="sl-fill" title="${itemOf(on[i]).name}">${itemArt(itemOf(on[i]), bestGrade(on[i]))}</i>` : '<i class="sl-empty"></i>').join('');
    return `<button type="button" class="slot-grp${pickTab === c ? ' cur' : ''}${cats.includes(c) ? '' : ' none'}" data-cat="${c}"><span>${CATEGORY_LABEL[c].replace('판 ', '')}</span><div>${cells}</div></button>`;
  }).join('');
  $('mp-slots').querySelectorAll<HTMLButtonElement>('.slot-grp').forEach((b) => b.addEventListener('click', () => {
    const c = b.dataset.cat as Category; if (!cats.includes(c)) return; pickTab = c; sfx.click(); openMagicPick();
  }));
  const box = $('mp-grid'); box.innerHTML = '';
  if (pickTab) {
    const cap = EQUIP_LIMITS[pickTab];
    const n = picked.filter((id) => items.catOf(id) === pickTab).length;
    $('mp-tabinfo').innerHTML = `<b>${CATEGORY_LABEL[pickTab]}</b> <span>${pickTab === 'cosmetic' ? '종류별 1개씩' : `${n} / ${cap} 장착`}</span>`;
    for (const it of ITEMS.filter((x) => x.category === pickTab && bestGrade(x.id) >= 0)) {
      const id = it.id; const g = bestGrade(id); const on = picked.includes(id);
      const cp = copyOf(id);
      const row = document.createElement('button');
      row.type = 'button'; row.className = 'inv-row' + (on ? ' on' : '');
      row.innerHTML = `<span class="inv-art">${itemArt(it, g)}</span>
        <span class="inv-body"><span class="inv-name">${it.name} ${gradeBadge(g)}</span><span class="inv-one">${cp.one}</span><span class="inv-eff">${it.effect(g)}</span></span>
        <span class="inv-check" aria-hidden="true">${on ? '✓' : ''}</span>`;
      row.setAttribute('aria-pressed', String(on));
      row.addEventListener('click', () => {
        sfx.click();
        if (picked.includes(id)) picked = picked.filter((x) => x !== id);
        else {
          const why = items.canAdd(picked, id);
          if (why) {
            if (EQUIP_LIMITS[it.category] === 1 && !why.includes('배수')) picked = [...picked.filter((x) => items.catOf(x) !== it.category), id];
            else { banner(why); return; }
          } else picked = [...picked, id];
        }
        openMagicPick();
      });
      box.append(row);
    }
  } else $('mp-tabinfo').innerHTML = '';
  $('mp-count').textContent = picked.length ? `${picked.length}개` : '';
  $('btn-mp-go').textContent = picked.length ? `시작 · ${picked.length}개 장착` : '시작';
  $('magic-pick').hidden = false;
}

/** 판 시작: 고른 주문 카드를 장착하고, 방패·점수 2배 같은 지속 효과와 나머지 아이템 효과를 적용한다 */
function equipForGame(): string[] {
  const notes: string[] = [];
  const run = items.current();
  const spells = (run?.slots ?? []).filter((x) => MAGIC_SET.has(x.id));
  let extraGiven = !items.gourdExtraUse();
  equipped = spells.map(({ id, g }) => {
    let uses = magicParams(id as MagicId, g).uses;
    if (!extraGiven && uses === 1) { uses = 2; extraGiven = true; notes.push(`호리병 · ${itemOf(id).name} +1회`); }
    return { id: id as MagicId, g, uses };
  });
  let shield = 0; const patch: { noPibak?: boolean; noGwangbak?: boolean; double?: boolean } = {};
  for (const e of equipped) {
    const p = magicParams(e.id, e.g) as { chancePct: number; shield?: number; noPibak?: boolean; noGwangbak?: boolean };
    const ok = Math.random() * 100 < Math.min(100, p.chancePct + items.spellBonus());
    if (e.id === 'shield') {
      if (ok) { shield = p.shield ?? 0; patch.noPibak = p.noPibak; patch.noGwangbak = p.noGwangbak; notes.push(`금강 방패 ${p.shield}회${p.noPibak ? '·피박' : ''}${p.noGwangbak ? '·광박' : ''}`); }
      else notes.push('금강 방패 불발');
    }
    if (e.id === 'double') {
      if (ok) { patch.double = true; notes.push('황금 배수 대기'); } else notes.push('황금 배수 불발');
    }
  }
  s = items.begin(s, shield, patch);
  notes.push(...(run?.notes ?? []));
  renderOppItems();
  applyCosmetics();
  selectMode = null; prevTurnStart = null; curTurnStart = s;
  return notes;
}

/** 상대(AI) 장착 아이템 표시: 이름표 옆 작은 카드 줄. 누르면 목록 */
function renderOppItems() {
  const box = $('opp-items');
  const ai = items.current()?.ai;
  if (!ai || !ai.slots.length) { box.hidden = true; box.innerHTML = ''; return; }
  box.hidden = false;
  box.innerHTML = ai.slots.map((x) => `<i class="oi${ai.on[x.id] ? '' : ' off'}" title="${itemOf(x.id).name} ${GRADES[x.g]}${ai.on[x.id] ? '' : ' (불발)'}">${itemArt(itemOf(x.id), x.g)}</i>`).join('');
  box.onclick = () => {
    sfx.click();
    banner(`상대 아이템 · ${ai.slots.map((x) => `${itemOf(x.id).name} ${GRADES[x.g]}${ai.on[x.id] ? '' : '(불발)'}`).join(', ')}`);
  };
}

/** 꾸미기: 카드 뒷면·판 테마·먹기 이펙트·이름표 테두리·효과음 팩 (능력치 없음) */
function applyCosmetics() {
  const tier = (id: string) => { const g = items.cosmetic(id); return g < 0 ? '' : String(Math.min(4, Math.floor(g / 2))); };
  const b = document.body.dataset;
  b.cb = tier('cardback'); b.theme = tier('theme'); b.fx = tier('effect'); b.frame = tier('frame');
  sfx.setPack(items.cosmetic('voice'));
}

function renderMagicBar(view: GameState) {
  const bar = $('magic-bar'); bar.innerHTML = '';
  const live = view === s && !busy && view.turn === ME && view.phase === 'play';
  for (const e of equipped) {
    const it = itemOf(e.id);
    const passive = e.id === 'shield' || e.id === 'double';
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'mbar-btn' + (passive ? ' passive' : '') + (selectMode?.slot === e ? ' active' : '');
    let label = '';
    if (e.id === 'shield') label = `${view.magic?.shield[ME] ?? 0}`;
    else if (e.id === 'double') label = view.magic?.double[ME] ? 'ON' : 'OFF';
    else label = `${e.uses}`;
    b.innerHTML = `<span class="mbar-card">${itemArt(it, e.g)}</span><span class="mbar-n">${label}</span>`;
    b.title = `${it.name} ${GRADES[e.g]} · ${it.effect(e.g)}`;
    b.setAttribute('aria-label', b.title);
    b.disabled = passive || e.uses <= 0 || !live || (e.id === 'undo' && !canUndo(e));
    b.addEventListener('click', () => useMagic(e));
    bar.append(b);
  }
  // 쌍둥이 그림자(정령): 내 차례에 더미 한 번 더 뒤집기
  const tf = items.twoflipInfo();
  if (items.isOn('twoflip') && tf) {
    const it = itemOf('twoflip'); const g = bestGrade('twoflip');
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'mbar-btn';
    b.innerHTML = `<span class="mbar-card">${itemArt(it, g)}</span><span class="mbar-n">${tf.left}</span>`;
    b.title = tf.turn < tf.from ? `${it.name} · ${tf.from}턴째부터` : `${it.name} · 더미 한 번 더 뒤집기 (${tf.left}회)`;
    b.setAttribute('aria-label', b.title);
    b.disabled = !live || !items.canExtraFlip(view);
    b.addEventListener('click', () => extraFlip());
    bar.append(b);
  }
  bar.hidden = !bar.children.length;
  // 고르는 중이면 대상 표시
  document.body.classList.toggle('selecting', !!selectMode);
  if (selectMode) {
    $('prompt').textContent = selectMode.kind === 'swap' ? '바꿀 손패를 고르세요' : `더미 밑으로 보낼 바닥 패 ${selectMode.need - selectMode.chosen.length}장을 고르세요`;
    if (selectMode.kind === 'sweep') {
      const p = magicParams('sweep', selectMode.slot.g) as { anyCard: boolean };
      document.querySelectorAll<HTMLElement>('#floor .card').forEach((el) => {
        const c = allCards.get(el.dataset.id ?? '');
        if (!c) return;
        const ok = p.anyCard || ['P', 'D', 'B2', 'B3'].includes(c.kind);
        el.classList.toggle('selectable', ok);
        if (ok) el.closest('.floor-month')?.classList.add('choosing'); // 겹친 패를 벌려서 누르기 쉽게
        el.classList.toggle('chosen', selectMode!.chosen.includes(c.id));
        if (ok) el.onclick = () => pickSweep(c.id);
      });
    } else {
      document.querySelectorAll<HTMLElement>('#hand .card').forEach((el) => el.classList.add('selectable'));
    }
  }
  $('magic-cancel').hidden = !selectMode;
}

function canUndo(e: Equipped) {
  if (!prevTurnStart) return false;
  if (!(magicParams('undo', e.g) as { undoPpeok: boolean }).undoPpeok) {
    const evs = s.events.slice(prevTurnStart.events.length);
    if (evs.some((x) => (x.type as string) === 'ppeok' && (x as { player: PlayerId }).player === ME)) return false;
  }
  return true;
}

/** 발동 확률 굴림 (실패해도 사용 횟수는 줄어듦) */
function rollMagic(e: Equipped): boolean {
  const p = magicParams(e.id, e.g) as { chancePct: number };
  e.uses -= 1;
  if (Math.random() * 100 < Math.min(100, p.chancePct + items.spellBonus())) return true;
  banner(`${itemOf(e.id).name} 불발`); sfx.lose();
  render(s);
  return false;
}

async function useMagic(e: Equipped) {
  if (busy || s.turn !== ME || s.phase !== 'play' || e.uses <= 0) return;
  sfx.unlock(); sfx.click();
  const it = itemOf(e.id);
  if (e.id === 'peek') {
    e.uses -= 1;
    const p = magicParams('peek', e.g) as { count: number; seconds: number };
    const pool = [...s.hands[AI]].sort(() => Math.random() - 0.5).slice(0, p.count);
    sfx.magic();
    busy = true; render(s);
    await peekShow(`엿보기 · 상대 손패 ${pool.length}장`, pool.map((c) => c.id), p.seconds);
    busy = false; render(s);
    return;
  }
  if (e.id === 'undo') {
    if (!canUndo(e) || !rollMagic(e)) return;
    s = items.recompute(structuredClone(prevTurnStart!));
    curTurnStart = s; prevTurnStart = null;
    $('feed').innerHTML = '<b>되돌리기</b> · 내 직전 차례로 돌아갔습니다';
    banner('되돌리기!'); sfx.magic();
    await show(s, {}, MOVE + BEAT);
    return;
  }
  if (e.id === 'swap') {
    if (!s.deck.length) { banner('더미가 비었습니다'); return; }
    if (!rollMagic(e)) return;
    const p = magicParams('swap', e.g) as { preview: boolean };
    selectMode = { kind: 'swap', slot: e, need: 1, chosen: [] };
    if (p.preview) await peekShow('패 바꾸기 · 더미 맨 위 패', [s.deck[0].id], 2);
    render(s);
    return;
  }
  if (e.id === 'sweep') {
    const p = magicParams('sweep', e.g) as { count: number; anyCard: boolean };
    const can = s.floor.filter((c) => p.anyCard || ['P', 'D', 'B2', 'B3'].includes(c.kind)).length;
    if (!can) { banner(p.anyCard ? '바닥이 비었습니다' : '바닥에 피가 없습니다'); return; }
    if (!rollMagic(e)) return;
    selectMode = { kind: 'sweep', slot: e, need: Math.min(p.count, can), chosen: [] };
    render(s);
    return;
  }
  void it;
}

async function extraFlip() {
  if (busy || !items.canExtraFlip(s)) return;
  sfx.unlock();
  const run = items.current()!;
  items.markExtraFlip();
  if (Math.random() * 100 >= items.CH[run.g.twoflip]) { banner('쌍둥이 그림자 불발'); sfx.lose(); render(s); return; }
  const prev = s;
  const top = s.deck[0].id;
  const next = items.after(prev, magicExtraFlip(prev, ME)).state;
  busy = true;
  banner('쌍둥이 그림자!'); sfx.magic(); sfx.flip();
  const got = next.events.slice(prev.events.length).find((e) => e.type === 'capture');
  $('feed').innerHTML = `<b>쌍둥이 그림자</b> · 더미에서 ${cardName(byId(top))}${got && got.type === 'capture' ? ` → ${got.cards.length}장 먹음` : ' → 바닥에 놓음'}`;
  s = next;
  curTurnStart = s;
  await show(s, { deck: new Set([top]) }, MOVE + BEAT);
  if (got) sfx.capture(2);
  busy = false; render(s);
}

async function pickSwap(id: string) {
  if (!selectMode || selectMode.kind !== 'swap') return;
  const top = s.deck[0].id;
  selectMode = null;
  s = items.recompute(magicSwap(s, ME, id));
  $('feed').innerHTML = `<b>패 바꾸기</b> · ${cardName(byId(id))} ↔ ${cardName(byId(top))}`;
  banner('패 바꾸기!'); sfx.magic();
  busy = true;
  await show(s, { deck: new Set([top]) }, MOVE + BEAT);
  busy = false; render(s);
}

async function pickSweep(id: string) {
  if (!selectMode || selectMode.kind !== 'sweep') return;
  if (!selectMode.chosen.includes(id)) selectMode.chosen.push(id);
  if (selectMode.chosen.length < selectMode.need) { sfx.click(); render(s); return; }
  const ids = selectMode.chosen;
  selectMode = null;
  const before = snapshot();
  s = items.recompute(magicSweep(s, ME, ids));
  $('feed').innerHTML = `<b>바닥 정리</b> · ${ids.map((x) => cardName(byId(x))).join(', ')} → 더미 밑`;
  banner('바닥 정리!'); sfx.magic();
  // 바닥에서 더미로 날아가는 연출
  const deck = $('deck').getBoundingClientRect();
  for (const x of ids) {
    const r = before.get(x); if (!r) continue;
    const ghost = cardEl(byId(x)); ghost.classList.add('ghost');
    Object.assign(ghost.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px` });
    document.body.append(ghost);
    ghost.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${deck.left - r.left}px, ${deck.top - r.top}px) scale(.8) rotate(25deg)`, opacity: 0.2 }], { duration: 520, easing: 'ease-in' }).onfinish = () => ghost.remove();
  }
  render(s);
}

/** 엿보기 등: 카드를 가운데 펼쳐 잠깐 보여 준다 */
async function peekShow(title: string, ids: string[], seconds: number) {
  const box = $('reveal');
  $('rv-title').textContent = title;
  const cards = $('rv-cards'); cards.innerHTML = '';
  ids.forEach((id, i) => { const el = cardEl(byId(id)); el.style.setProperty('--i', String(i)); cards.append(el); });
  box.classList.add('peek');
  box.hidden = false;
  box.classList.remove('on'); void box.offsetWidth; box.classList.add('on');
  await wait(seconds * 1000);
  box.hidden = true; box.classList.remove('peek');
}

/** 내 차례가 시작될 때마다 되돌리기 기준점을 기록 */
function markMyTurnStart() {
  if (s.turn === ME && s.phase === 'play' && curTurnStart !== s) { prevTurnStart = curTurnStart; curTurnStart = s; }
}

// ---------- 국진 선택 ----------
function askGukjin(): Promise<void> {
  return new Promise((done) => {
    const y = score(s.captured[ME], s.options, 'yeol').total;
    const p = score(s.captured[ME], s.options, 'pi').total;
    $('gk-yeol-pts').textContent = `지금 점수 ${y}점`;
    $('gk-pi-pts').textContent = `지금 점수 ${p}점`;
    $('gk-card').innerHTML = '';
    $('gk-card').append(cardEl(byId('09-Y-0')));
    $('gukjin').hidden = false;
    sfx.click();
    const pick = (mode: 'yeol' | 'pi') => {
      $('gukjin').hidden = true;
      s = setGukjin(s, ME, mode);
      banner(mode === 'pi' ? '국진 → 쌍피' : '국진 → 열끗');
      sfx.click();
      render(s);
      done();
    };
    ($('btn-gk-yeol') as HTMLButtonElement).onclick = () => pick('yeol');
    ($('btn-gk-pi') as HTMLButtonElement).onclick = () => pick('pi');
  });
}

/** 고를 바닥 패 2장이 사실상 같은 패(종류·띠·피 값이 같음)면 true */
function sameChoice(view: GameState) {
  if (!view.pending) return false;
  const [a, b] = view.pending.options.map((id) => view.floor.find((f) => f.id === id));
  return !!a && !!b && a.kind === b.kind && a.tag === b.tag;
}

// ---------- 손패 힌트 ----------
/** 한 월의 상황: 바닥·내 손·이미 먹힌 장수와, 내가 볼 수 없는 곳(상대 손·더미)에 남은 장수 */
function monthState(view: GameState, m: number) {
  const floorN = view.floor.filter((f) => f.month === m).length;
  const mineN = view.hands[ME].filter((h) => h.month === m).length;
  const goneN = view.captured[0].filter((x) => x.month === m).length + view.captured[1].filter((x) => x.month === m).length;
  const unseen = 4 - floorN - mineN - goneN;
  return { floorN, mineN, goneN, unseen, onlyMe: mineN > 0 && unseen <= 0 };
}
function hintFor(view: GameState, c: Card): 'safe' | 'risk' | null {
  const m = c.month;
  const floorN = view.floor.filter((f) => f.month === m).length;
  const mineN = view.hands[ME].filter((h) => h.month === m).length;
  const goneN = view.captured[0].filter((x) => x.month === m).length + view.captured[1].filter((x) => x.month === m).length;
  const unseen = 4 - floorN - mineN - goneN; // 상대 손패나 더미 어딘가에 있는 같은 월 (내가 볼 수 없는 것)
  if (floorN === 0 && unseen === 0) return 'safe';
  if (floorN === 1 && unseen >= 1) return 'risk';
  return null;
}
function markTargets(month: number, on: boolean) {
  document.querySelectorAll<HTMLElement>('#floor .card').forEach((el) => {
    const c = allCards.get(el.dataset.id ?? '');
    el.classList.toggle('aim', on && !!c && c.month === month);
  });
}

// ---------- 흔들기 / 폭탄 선택 ----------
function specialFor(c: Card, legal: Action[]) {
  const bomb = legal.find((a) => a.type === 'bomb' && a.month === c.month);
  const shake = legal.find((a) => a.type === 'play' && a.cardId === c.id && a.shake);
  return bomb || shake ? { bomb, shake } : null;
}

function onHandCard(c: Card) {
  if (selectMode?.kind === 'swap') { pickSwap(c.id); return; }
  if (selectMode) return;
  if (busy) return;
  const sp = specialFor(c, getLegalActions(s));
  if (!sp) { perform({ type: 'play', cardId: c.id }); return; }
  const same = s.hands[ME].filter((h) => h.month === c.month);
  const box = $('sp-cards'); box.innerHTML = '';
  same.forEach((h) => box.append(cardEl(h)));
  const btns = $('sp-btns'); btns.innerHTML = '';
  const add = (label: string, sub: string, cls: string, a: Action) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = `big ${cls}`;
    b.innerHTML = `${label}<small>${sub}</small>`;
    b.addEventListener('click', () => { $('special').hidden = true; perform(a); });
    btns.append(b);
  };
  if (sp.bomb) {
    $('sp-title').textContent = `${c.month}월 3장 · 폭탄 할까요?`;
    $('sp-sub').textContent = `바닥의 ${c.month}월까지 4장을 한꺼번에 먹고, 상대 피 1장을 가져옵니다. 이기면 점수 ×2. 대신 빈 패 2장을 받습니다.`;
    add('폭탄', '3장 한꺼번에 내기', 'go-btn', sp.bomb);
    add('그냥 내기', `${cardName(c)} 1장만`, 'stop-btn', { type: 'play', cardId: c.id });
  } else if (sp.shake) {
    $('sp-title').textContent = `${c.month}월 3장 · 흔들까요?`;
    $('sp-sub').textContent = '같은 월 3장을 상대에게 보여 주고 1장을 냅니다. 이기면 점수 ×2.';
    add('흔들기', '보여 주고 내기', 'go-btn', sp.shake);
    add('그냥 내기', '보여 주지 않고 내기', 'stop-btn', { type: 'play', cardId: c.id });
  }
  $('special').hidden = false;
}

// ---------- 연출 ----------
function snapshot() {
  const m = new Map<string, DOMRect>();
  document.querySelectorAll<HTMLElement>('#app [data-id]').forEach((el) => m.set(el.dataset.id!, el.getBoundingClientRect()));
  return m;
}

/** view를 그리고, 이전 위치에서 새 위치로 카드가 미끄러지게 한다. 새로 나타난 카드는 from 규칙으로 출발점을 정한다. */
async function show(view: GameState, from: { deck?: Set<string>; opp?: Set<string> } = {}, settle = MOVE + BEAT) {
  const before = snapshot();
  const wasFloor = new Set([...document.querySelectorAll<HTMLElement>('#floor [data-id]')].map((e) => e.dataset.id!));
  render(view);
  if (reduced) return;
  const deck = $('deck').getBoundingClientRect();
  const opp = $('opp-avatar').getBoundingClientRect();
  document.querySelectorAll<HTMLElement>('#app [data-id]').forEach((el) => {
    const id = el.dataset.id!;
    const to = el.getBoundingClientRect();
    const start = from.deck?.has(id) ? deck : before.get(id) ?? (from.opp?.has(id) ? opp : undefined);
    if (!start) return;
    const dx = start.left + start.width / 2 - (to.left + to.width / 2);
    const dy = start.top + start.height / 2 - (to.top + to.height / 2);
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    const sc = start.width / Math.max(to.width, 1);
    const flipIn = from.deck?.has(id);
    el.animate(
      flipIn
        ? [{ transform: `translate(${dx}px, ${dy}px) scale(${sc}) rotateY(90deg)` }, { transform: `translate(${dx * 0.5}px, ${dy * 0.5}px) scale(1.15) rotateY(0deg)`, offset: 0.45 }, { transform: 'none' }]
        : el.closest('#floor') && !wasFloor.has(id) && (before.has(id) || from.opp?.has(id))
          // 손패(또는 상대 손)에서 바닥으로: 살짝 들어 올렸다가 비스듬히 날아가 "착" 내려앉음
          ? [{ transform: `translate(${dx}px, ${dy}px) scale(${sc})` }, { transform: `translate(${dx * 0.55}px, ${dy * 0.55 - 34}px) scale(1.22) rotate(${dx > 0 ? -7 : 7}deg)`, offset: 0.45 }, { transform: `translate(${dx * 0.06}px, ${dy * 0.06 - 6}px) scale(1.1)`, offset: 0.8 }, { transform: 'none' }]
          : [{ transform: `translate(${dx}px, ${dy}px) scale(${sc})` }, { transform: `translate(${dx * 0.08}px, ${dy * 0.08 - 10}px) scale(1.08)`, offset: 0.7 }, { transform: 'none' }],
      { duration: MOVE * speed, easing: 'cubic-bezier(.2,.7,.2,1)' },
    );
  });
  await wait(settle);
}

/** 카드가 바닥에 "탁" 닿는 순간: 눌림 + 퍼지는 고리 + 소리 + 진동 */
function slamAt(ids: string[], power = 0.7, delay = MOVE * 0.78 * speed, hit = true) {
  if (reduced) return;
  setTimeout(() => {
    for (const id of ids) {
      const el = document.querySelector<HTMLElement>(`#floor [data-id="${CSS.escape(id)}"]`);
      if (!el) continue;
      el.animate([{ transform: 'scale(1.18)', filter: 'brightness(1.25)' }, { transform: 'scale(.94)' }, { transform: 'scale(1)' }], { duration: 220, easing: 'ease-out' });
      const r = el.getBoundingClientRect();
      const ring = document.createElement('div');
      ring.className = 'ring';
      ring.style.left = `${r.left + r.width / 2}px`; ring.style.top = `${r.top + r.height / 2}px`;
      document.body.append(ring);
      setTimeout(() => ring.remove(), 600);
    }
    if (hit) sfx.slap(power); else sfx.place(power); // 먹는 패 위 "착!" / 빈 자리에 "툭"
    sfx.buzz(hit ? (power > 0.8 ? 35 : 15) : 8);
  }, delay);
}
/** 뻑: 겹친 세 장이 잿빛으로 굳고 금이 가며, 화면이 잠깐 어두워진다 (절망) */
function ppeokFx(ids: string[]) {
  if (reduced) return;
  const els = ids.map((id) => document.querySelector<HTMLElement>(`#floor [data-id="${CSS.escape(id)}"]`)).filter((x): x is HTMLElement => !!x);
  els.forEach((el, i) => el.animate([
    { filter: 'none', transform: 'none' },
    { filter: 'grayscale(.9) brightness(.55)', transform: `translateY(4px) rotate(${i % 2 ? 2 : -2}deg)`, offset: 0.25 },
    { filter: 'grayscale(.9) brightness(.55)', transform: `translateX(-3px) rotate(${i % 2 ? 2 : -2}deg)`, offset: 0.35 },
    { filter: 'grayscale(.9) brightness(.55)', transform: `translateX(3px) rotate(${i % 2 ? 2 : -2}deg)`, offset: 0.45 },
    { filter: 'grayscale(.8) brightness(.6)', transform: `rotate(${i % 2 ? 1 : -1}deg)`, offset: 0.85 },
    { filter: 'none', transform: 'none' },
  ], { duration: 1500, easing: 'ease-out' }));
  if (els[0]) {
    const r = els.map((e) => e.getBoundingClientRect()).reduce((a, b) => ({ left: Math.min(a.left, b.left), top: Math.min(a.top, b.top), right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom) }), { left: 1e9, top: 1e9, right: -1e9, bottom: -1e9 });
    const crack = document.createElement('div'); crack.className = 'pp-crack';
    Object.assign(crack.style, { left: `${r.left - 10}px`, top: `${r.top - 10}px`, width: `${r.right - r.left + 20}px`, height: `${r.bottom - r.top + 20}px` });
    crack.innerHTML = '<svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M50 0 L46 22 L56 34 L44 52 L58 66 L48 82 L54 100" /><path d="M46 22 L30 30 M56 34 L74 40 M44 52 L24 60 M58 66 L80 74" /></svg>';
    document.body.append(crack); setTimeout(() => crack.remove(), 1500);
  }
  const dim = document.createElement('div'); dim.className = 'pp-dim'; document.body.append(dim); setTimeout(() => dim.remove(), 1400);
}
/** 폭탄: 흰 섬광 + 충격파 고리 + 불꽃 파편 + 연기 + 화면 붉게 번쩍 + 강한 흔들림 */
function explodeAt(ids: string[]) {
  sfx.cannon(); sfx.buzz([160, 40, 30, 20, 20]);
  if (reduced) { banner('폭탄!'); return; }
  const rects = ids.map((id) => document.querySelector(`#floor [data-id="${CSS.escape(id)}"]`)?.getBoundingClientRect()).filter(Boolean) as DOMRect[];
  const r = rects[0] ?? $('floor').getBoundingClientRect();
  const x = rects.length ? rects.reduce((a, b) => a + b.left + b.width / 2, 0) / rects.length : r.left + r.width / 2;
  const y = rects.length ? rects.reduce((a, b) => a + b.top + b.height / 2, 0) / rects.length : r.top + r.height / 2;
  const boom = document.createElement('div');
  boom.className = 'boom';
  boom.style.left = `${x}px`; boom.style.top = `${y}px`;
  let html = '<i class="core"></i><i class="shock"></i><i class="shock s2"></i><i class="shock s3"></i>';
  for (let i = 0; i < 22; i++) html += `<i class="spark" style="--a:${(i / 22) * 360 + (i % 3) * 7}deg;--d:${70 + (i * 37) % 90}px;--t:${0.45 + (i % 5) * 0.08}s"></i>`;
  for (let i = 0; i < 7; i++) html += `<i class="smoke" style="--a:${i * 51}deg;--d:${30 + (i * 13) % 30}px"></i>`;
  boom.innerHTML = html;
  document.body.append(boom);
  const tint = document.createElement('div'); tint.className = 'bomb-tint'; document.body.append(tint);
  setTimeout(() => { boom.remove(); tint.remove(); }, 1600);
  shakeScreen(true);
  setTimeout(() => shakeScreen(false), 380);
  setTimeout(() => banner('폭탄!'), 120);
  for (const id of ids) document.querySelector<HTMLElement>(`#floor [data-id="${CSS.escape(id)}"]`)?.animate(
    [{ transform: 'scale(1.35) rotate(-6deg)', filter: 'brightness(2.2)' }, { transform: 'scale(.92) rotate(3deg)' }, { transform: 'none', filter: 'none' }], { duration: 520, easing: 'ease-out' });
}

function shakeScreen(strong = false) {
  if (reduced) return;
  $('app').animate(
    strong
      ? [{ transform: 'translate(0,0)' }, { transform: 'translate(-9px,5px)' }, { transform: 'translate(8px,-6px)' }, { transform: 'translate(-6px,-3px)' }, { transform: 'translate(5px,4px)' }, { transform: 'translate(-2px,1px)' }, { transform: 'none' }]
      : [{ transform: 'translate(0,0)' }, { transform: 'translate(-4px,2px)' }, { transform: 'translate(3px,-2px)' }, { transform: 'none' }],
    { duration: strong ? 520 : 260, easing: 'ease-out' },
  );
}
/** 흔들기: 들고 있는 같은 월 3장을 잠깐 펼쳐 보여 준다 */
async function reveal(title: string, ids: string[]) {
  const box = $('reveal');
  $('rv-title').textContent = title;
  const cards = $('rv-cards'); cards.innerHTML = '';
  ids.forEach((id, i) => { const el = cardEl(byId(id)); el.style.setProperty('--i', String(i)); cards.append(el); });
  box.hidden = false;
  box.classList.remove('on'); void box.offsetWidth; box.classList.add('on');
  sfx.shake(); sfx.buzz([20, 40, 20, 40, 20]);
  await wait(1500);
  box.hidden = true;
}

/** 가운데 알림: 내용에 따라 붉은 낙관(좋은 일) · 옻칠 현판(고·스톱·폭탄 같은 큰 순간) · 먹 낙관(뻑·불발) · 한지 띠(긴 안내) */
function banner(text: string) {
  if (reduced) return;
  const b = $('banner');
  const t = text.trim();
  const big = /^(\d+고!|스톱!|폭탄!|총통!|흔들기|흔들어)/.test(t);
  const bad = /^뻑!$|불발|상대 첫뻑/.test(t);
  const good = /^(쪽!|따닥!|싹쓸이!|보너스!|뻑 먹기!|자뻑|3장 먹기!|첫뻑!|방패!|바닥 정리!|패 바꾸기!|되돌리기!|쌍둥이 그림자!)/.test(t);
  const kind = big ? 'plaque' : bad ? 'ink' : good ? 'seal' : 'note';
  const bang = t.indexOf('!');
  const head = bang >= 0 ? t.slice(0, bang + 1) : t;
  const rest = bang >= 0 && t.slice(bang + 1).trim() ? [t.slice(bang + 1).trim()] : [];
  b.dataset.kind = kind;
  b.innerHTML = kind === 'note' ? `<span class="bn-note">${t}</span>`
    : `<span class="bn-${kind}"><b>${head.replace(/!$/, '')}</b></span>${rest.length ? `<small class="bn-sub">${rest.join(' ')}</small>` : ''}`;
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
}

function moveToFloor(v: GameState, ids: string[], who: PlayerId) {
  for (const id of ids) {
    const i = v.hands[who].findIndex((c) => c.id === id);
    if (i >= 0) v.floor.push(v.hands[who].splice(i, 1)[0]);
    else if (v.pending?.card.id === id) { v.floor.push(v.pending.card); v.pending = null; }
  }
}

function describe(events: GameEvent[]): string {
  const who = (p: PlayerId) => (p === ME ? '나' : '상대');
  const parts: string[] = [];
  for (const e of events) {
    if (e.type === 'play') parts.push(`<b>${who(e.player)}</b> ${cardName(byId(e.card))}`);
    else if (e.type === 'bomb') parts.push(`<b>${who(e.player)} 폭탄!</b> ${e.month}월 3장`);
    else if (e.type === 'shake') parts.push(`<b>${who(e.player)} 흔들기</b>`);
    else if (e.type === 'dummy') parts.push(`<b>${who(e.player)}</b> 빈 패`);
    else if (e.type === 'steal') parts.push(`<b>피 1장 뺏음</b>`);
    else if ((e.type as string) === 'bonus') parts.push('<b>보너스 패</b>');
    else if (e.type === 'flip') parts.push(`뒤집기 ${cardName(byId(e.card))}`);
    else if (e.type === 'capture') parts.push(`<b>${e.cards.length}장 먹음</b>`);
    else if (e.type === 'place') parts.push('깔림');
    else if ((e.type as string) === 'ppeok') parts.push('<b>뻑!</b>');
    else if ((e.type as string) === 'jjok') parts.push('<b>쪽!</b>');
    else if ((e.type as string) === 'ttadak') parts.push('<b>따닥!</b>');
    else if ((e.type as string) === 'ppeokEat') parts.push('<b>뻑 먹기!</b>');
    else if ((e.type as string) === 'firstPpeok') parts.push('<b>첫뻑 +3</b>');
    else if ((e.type as string) === 'sweep') parts.push('<b>싹쓸이!</b>');
    else if (e.type === 'go') parts.push(`<b>${who(e.player)} ${e.goCount}고</b>`);
    else if (e.type === 'stop') parts.push(`<b>${who(e.player)} 스톱</b>`);
  }
  return parts.join(' · ');
}

/**
 * 행동 하나를 엔진에 적용하고 장면을 나눠 보여 준다.
 * 1) 낸 패(폭탄이면 3장)가 바닥 같은 월 위로 → 2) 더미에서 뒤집은 패가 바닥으로 → 3) 먹은 패가 트레이로.
 */
async function perform(a: Action) {
  if (busy || s.phase === 'ended') return;
  if (online) { busy = true; online.send(a); render(s); return; } // 온라인: 서버가 판정해서 보내 준 판으로 연출
  busy = true;
  const prev = s;
  const ia = items.after(prev, applyAction(prev, a));
  await playOut(prev, ia.state, ia.notes);
}
/** 한 수의 결과(prev → next)를 장면으로 보여 준다. 온라인에서는 서버가 보낸 판으로 부른다 */
async function playOut(prev: GameState, next: GameState, notes: { text: string; cards?: string[] }[]) {
  busy = true;
  const no = gameNo;
  const ia = { state: next, notes };
  const evs = next.events.slice(prev.events.length);
  const T = (e: GameEvent) => e.type as string; // 엔진에 새 이벤트가 붙어도 화면이 안전하게 읽도록
  const who = prev.turn;
  const fromOpp = who === AI ? new Set<string>() : undefined;
  $('feed').innerHTML = describe(evs) || $('feed').innerHTML;

  // 0) 흔들기·폭탄 알림
  const shake = evs.find((e) => e.type === 'shake');
  if (shake && shake.type === 'shake') { await reveal(`${who === ME ? '나' : '상대'} 흔들기!`, shake.cards); if (no !== gameNo) return; }
  const bomb = evs.find((e) => e.type === 'bomb');

  // 1) 낸 패(폭탄이면 3장)를 바닥 같은 월 위로 "탁". 고르기 뒤라면 들고 있던 패를 바닥에 둔 채로 시작
  let v: GameState = structuredClone(prev);
  v.pending = null;
  if (prev.pending) { v.floor.push(prev.pending.card); if (prev.pending.later) v.floor.push(prev.pending.later); }
  const steps = evs.filter((e) => ['play', 'bomb', 'flip', 'bonus', 'draw', 'dummy'].includes(T(e)));
  let lastFlip: string | null = null;
  for (const e of steps) {
    const ev = e as GameEvent & { card?: string; cards?: string[]; from?: string };
    if (e.type === 'play' || e.type === 'bomb') {
      const ids = e.type === 'play' ? [e.card] : e.cards;
      const pm = byId(ids[0]).month;
      const hit = pm <= 12 && v.floor.some((c) => c.month === pm);
      v = structuredClone(v); moveToFloor(v, ids, who);
      ids.forEach((id) => fromOpp?.add(id));
      if (e.type === 'bomb') setTimeout(() => explodeAt(ids), MOVE * 0.75 * speed);
      else slamAt(ids, 0.75, undefined, hit);
      await show(v, { opp: fromOpp }, e.type === 'bomb' ? MOVE + 650 : MOVE + BEAT);
    } else if (e.type === 'dummy') {
      sfx.tick(); await wait(200);
    } else if (e.type === 'flip') {
      v = structuredClone(v);
      const i = v.deck.findIndex((c) => c.id === e.card);
      const fm = byId(e.card).month;
      const fhit = fm <= 12 && v.floor.some((c) => c.month === fm);
      if (i >= 0) v.floor.push(v.deck.splice(i, 1)[0]);
      lastFlip = e.card;
      sfx.flip(); slamAt([e.card], 0.55, MOVE * 0.8 * speed, fhit);
      await show(v, { deck: new Set([e.card]) }, MOVE + BEAT + 160);
    } else if (T(e) === 'bonus' && ev.card) {
      // 보너스 패: 바로 내 피 칸으로
      v = structuredClone(v);
      const id = ev.card;
      const take = (arr: Card[]) => { const i = arr.findIndex((c) => c.id === id); return i >= 0 ? arr.splice(i, 1)[0] : null; };
      const card = take(v.hands[who]) ?? take(v.floor) ?? take(v.deck) ?? byId(id);
      v.captured[who].push(card);
      if (ev.from === 'hand') fromOpp?.add(id);
      banner('보너스!'); sfx.bonus();
      await show(v, { opp: fromOpp, deck: ev.from === 'flip' && !document.querySelector(`[data-id="${CSS.escape(id)}"]`) ? new Set([id]) : undefined }, MOVE + BEAT + 120);
    } else if (T(e) === 'draw' && ev.card) {
      // 보너스를 낸 뒤 더미에서 한 장 받아 온다
      v = structuredClone(v);
      const i = v.deck.findIndex((c) => c.id === ev.card);
      if (i >= 0) v.hands[who].push(v.deck.splice(i, 1)[0]);
      sfx.flip();
      await show(v, { deck: new Set([ev.card]) }, MOVE + BEAT);
    }
    if (no !== gameNo) return;
  }
  const flip = lastFlip;

  // 3) 뻑·쪽·따닥·뻑 먹기·싹쓸이 알림 (음성도 패가 다 내려앉은 뒤에)
  announce(evs);
  const special = evs.find((e) => ['ppeok', 'jjok', 'ttadak', 'ppeokEat', 'sweep'].includes(T(e)));
  if (special) {
    const kind = T(special);
    if (kind === 'ppeok') {
      await wait(120); // 세 장째가 완전히 겹친 뒤
      ppeokFx((special as { cards?: string[] }).cards ?? []);
      banner('뻑!'); sfx.ppeok(); sfx.buzz([60, 80, 120]);
      await wait(500);
    }
    else if (kind === 'ppeokEat') {
      const x = special as { self?: boolean; fromPpeok?: boolean };
      banner(x.fromPpeok === false ? '3장 먹기!' : x.self ? '자뻑! 피 2장' : '뻑 먹기!'); sfx.bonus(); shakeScreen();
    }
    else { banner(kind === 'jjok' ? '쪽!' : kind === 'ttadak' ? '따닥!' : '싹쓸이!'); if (kind === 'jjok') sfx.jjok(); else if (kind === 'ttadak') sfx.ttadak(); else sfx.sweep(); shakeScreen(); sfx.buzz(kind === 'ttadak' ? [40, 50, 60] : kind === 'sweep' ? [30, 30, 30, 30, 30, 30, 150] : 40); if (kind === 'sweep') await wait(900); }
    await wait(650);
    if (no !== gameNo) return;
  }
  const fp = evs.find((e) => (e.type as string) === 'firstPpeok') as (GameEvent & { player: PlayerId; points: number }) | undefined;
  if (fp) {
    if (fp.player === ME) earn(FIRST_PPEOK_COINS);
    banner(fp.player === ME ? `첫뻑! +${fp.points}점 · 엽전 +${FIRST_PPEOK_COINS}` : `상대 첫뻑! +${fp.points}점`); sfx.bonus(); sfx.buzz([30, 40, 30]);
    await wait(750);
    if (no !== gameNo) return;
  }

  // 4) 최종 상태: 먹은 패가 트레이로 들어간다
  const captured = evs.filter((e) => e.type === 'capture').flatMap((e) => (e.type === 'capture' ? e.cards : []));
  if (captured.length) {
    captured.forEach((id) => document.querySelector(`#floor [data-id="${CSS.escape(id)}"]`)?.classList.add('flash'));
    await wait(reduced ? 0 : 220);
    sfx.capture(captured.length);
  }
  s = next;
  busy = false;
  await show(s, flip && !document.querySelector(`#floor [data-id="${CSS.escape(flip)}"]`) ? { deck: new Set([flip]) } : {});
  if (no !== gameNo) return;
  // 내가 국진(9월 열끗)을 먹었고 아직 안 정했으면: 열끗으로 쓸지 쌍피로 쓸지 묻는다
  const tookGukjin = evs.some((e) => e.type === 'capture' && e.player === ME && e.cards.includes('09-Y-0'));
  if (tookGukjin && (s.gukjinAs?.[ME] ?? 'auto') === 'auto') {
    await askGukjin();
    if (no !== gameNo) return;
  }
  if (evs.some((e) => e.type === 'steal')) { sfx.steal(); }
  for (const n of ia.notes) { banner(n.text); sfx.magic(); $('feed').innerHTML = `<b>아이템</b> · ${n.text}`; await wait(700); if (no !== gameNo) return; }
  const goEv = evs.find((e) => e.type === 'go');
  if (goEv && goEv.type === 'go') { banner(`${goEv.goCount}고!`); sfx.go(goEv.goCount); sfx.buzz(goEv.goCount >= 3 ? [40, 60, 40] : 30); }
  if (evs.some((e) => e.type === 'stop')) { banner('스톱!'); sfx.stop(); }

  if (s.phase === 'ended') {
    await wait(800);
    if (no !== gameNo) return;
    const r = s.result!;
    if (r.type === 'win' && r.winner === ME) sfx.win(); else sfx.lose();
    showResult();
    return;
  }
  if (evs.some((e) => (e.type as string) === 'shieldBlock' && (e as { player: PlayerId }).player === ME)) { banner('방패! 피 지킴'); sfx.magic(); }
  // 같은 패 2장 중 고르기는 창 없이 바로
  if (s.turn === ME && s.phase === 'chooseMatch' && sameChoice(s)) {
    await wait(220);
    if (no !== gameNo) return;
    perform({ type: 'choose', cardId: s.pending!.options[0] });
    return;
  }
  markMyTurnStart();
  if (online) { busy = false; render(s); return; }
  if (s.turn === AI) {
    busy = true; render(s);
    await wait(AI_THINK);
    if (no !== gameNo) return;
    busy = false;
    if ((s.phase as string) === 'ended' || !getLegalActions(s).length) return;
    perform(chooseAction(s, level));
  }
}

// 상대 난이도 (패 분배는 난이도와 무관하게 항상 무작위)
let level: AiLevel = 'easy';
try { const v = localStorage.getItem('mg-level'); if (v && AI_LEVELS.some((l) => l.id === v)) level = v as AiLevel; } catch { /* 무시 */ }
function syncLevel() {
  const i = AI_LEVELS.findIndex((l) => l.id === level);
  const b = $('btn-level');
  b.textContent = `${ROOMS[AI_LEVELS[i].id].name} ▾`; void i;
  b.dataset.level = level;
  renderProfiles();
}
/** 상대·나 프로필: 캐릭터 얼굴 + 이름 (상위 맞고 앱처럼 얼굴·닉네임·머니) */
const OPP_BY_LEVEL: Record<string, string[]> = { easy: ['bobu', 'jumo'], normal: ['jumo', 'maehwa'], hard: ['janggun', 'dosa'] };
function renderProfiles() {
  const me = chars.current();
  const oppId = online ? online.opp.char : (OPP_BY_LEVEL[level] ?? ['bobu']).find((x) => x !== me.def.id) ?? 'bobu';
  const opp = chars.CHARS.find((c) => c.id === oppId) ?? chars.CHARS[0];
  const oa = $('opp-avatar'); oa.innerHTML = chars.portrait(opp, level === 'hard' ? 10 : level === 'normal' ? 6 : 3); oa.classList.add('has-art');
  const ma = document.querySelector<HTMLElement>('.avatar.mine')!; ma.innerHTML = chars.portrait(me.def, me.lv); ma.classList.add('has-art');
  const on = document.getElementById('opp-name'); if (on) on.textContent = online ? online.opp.name : opp.name;
  const mn = document.getElementById('my-name'); if (mn) mn.innerHTML = `${me.def.name} <small>Lv.${me.lv}</small>`;
  const mc = document.getElementById('my-coins'); if (mc) mc.innerHTML = `<i class="cur-ico yeop" aria-hidden="true"></i>${fmt(coins())}`;
}

// 나가리면 다음 판 점수에 배수가 붙는다 (×2, 최대 ×4)
let carry = 1;

type WinExtra = { by: string; bak?: { pi: boolean; gwang: boolean; meong: boolean }; bakMultiplier?: number; carry?: number; nextCarry?: number };

const paidResults = new WeakSet<object>();
function showResult() {
  const r = s.result!;
  const sc = [scoreOf(s, 0), scoreOf(s, 1)];
  const x = r as unknown as WinExtra;
  carry = x.nextCarry ?? 1;
  $('result').hidden = false;
  // 결과 머리: 이긴 쪽 캐릭터 얼굴 + 승리/패배 낙관 (나가리는 둘 다)
  {
    const me = chars.current();
    const oppId = (OPP_BY_LEVEL[level] ?? ['bobu']).find((q) => q !== me.def.id) ?? 'bobu';
    const opp = chars.CHARS.find((c) => c.id === oppId)!;
    const win = r.type === 'win' && r.winner === ME; const lose = r.type === 'win' && r.winner !== ME;
    $('res-card').dataset.out = win ? 'win' : lose ? 'lose' : 'nagari';
    $('res-hero').innerHTML = r.type === 'nagari'
      ? `<div class="rh-face sm">${chars.portrait(me.def, me.lv)}</div><div class="rh-seal">무</div><div class="rh-face sm">${chars.portrait(opp, 3)}</div>`
      : `<div class="rh-face">${chars.portrait(win ? me.def : opp, win ? me.lv : 6)}</div><div class="rh-seal">${win ? '승' : '패'}</div>`;
  }
  const badges = $('res-badges'); badges.innerHTML = '';
  const badge = (t: string) => { const b = document.createElement('span'); b.className = 'res-badge'; b.textContent = t; badges.append(b); };
  if (r.type === 'nagari') {
    $('res-kicker').textContent = '판 결과';
    $('res-title').textContent = '나가리';
    $('res-formula').textContent = `아무도 7점을 못 냈습니다 · 다음 판 점수 ×${carry}`;
  } else {
    $('res-kicker').textContent = x.by === 'stop' ? '스톱으로 끝' : x.by === 'chongtong' ? '총통' : '패가 다 떨어져 끝';
    $('res-title').textContent = r.winner === ME ? '이겼습니다!' : '졌습니다';
    const parts = [`(${r.base}점 + 고 ${r.goBonus}점)`];
    if (r.multiplier > 1) parts.push(`고 ×${r.multiplier}`);
    if (r.shakeMultiplier > 1) parts.push(`흔들 ×${r.shakeMultiplier}`);
    if ((x.bakMultiplier ?? 1) > 1) parts.push(`박 ×${x.bakMultiplier}`);
    if ((x.carry ?? 1) > 1) parts.push(`나가리 ×${x.carry}`);
    if ((r as unknown as { magicDouble?: boolean }).magicDouble) parts.push('황금 배수 ×2');
    $('res-formula').textContent = `${parts.join(' · ')} = ${r.finalScore}점${online ? '' : ` × ${fmt(ROOMS[level].per)}엽전`}`;
    if (x.bak?.pi) badge('피박');
    if (x.bak?.gwang) badge('광박');
    if (x.bak?.meong) badge('멍따');
    const mx = r as unknown as { magicDouble?: boolean; magicBlocked?: string[] };
    if (mx.magicDouble) badge('황금 배수 ×2');
    const myIp = (s.itemPts?.[r.winner] ?? []).reduce((a2, x2) => a2 + x2.points, 0);
    if (myIp) badge(`아이템 +${myIp}점`);
    for (const b of mx.magicBlocked ?? []) badge(b === 'pi' ? '방패: 피박 막음' : '방패: 광박 막음');
    if (r.shakeMultiplier > 1) badge('흔들기');
  }
  const grid = $('res-grid'); grid.innerHTML = '';
  ([ME, AI] as PlayerId[]).forEach((p) => {
    const col = document.createElement('div');
    col.className = 'res-col' + (r.type === 'win' && r.winner === p ? ' win' : '');
    const ip = s.itemPts?.[p] ?? [];
    const ipSum = ip.reduce((a2, x2) => a2 + x2.points, 0);
    const lines = [...sc[p].details, ...ip.map((d) => ({ ...d, label: `${d.label} (아이템)` }))].map((d) => `<li><span>${d.label}</span><span>${d.points}</span></li>`).join('') || '<li><span>점수 없음</span><span></span></li>';
    col.innerHTML = `<h3>${p === ME ? '나' : '상대'}</h3><div class="tot">${sc[p].total}점${ipSum ? `<small> + 아이템 ${ipSum}</small>` : ''}</div><ul>${lines}</ul>`;
    grid.append(col);
  });
  $('btn-new').textContent = carry > 1 ? `새 판 (×${carry})` : '새 판';
  if (online) { // 온라인: 엽전·아이템 보상 없음
    online.ended = true;
    $('res-coins').hidden = true; $('btn-new').textContent = '다시 찾기';
    return;
  }
  $('btn-new').textContent = carry > 1 ? `새 판 (×${carry})` : '새 판';
  // 가상머니: 이긴 판 점수 × 100 엽전
  const rc = $('res-coins');
  const firstTime = !paidResults.has(r); paidResults.add(r); // 같은 결과로 두 번 정산하지 않음
  if (firstTime) {
    missionRecord('play');
    for (const nm of chars.recordGame(r.type === 'win' && r.winner === ME)) setTimeout(() => banner(`새 캐릭터 해금 · ${nm}`), 1600);
    if (r.type === 'win' && r.winner === ME) { missionRecord('win'); if ((r as unknown as WinExtra).bak?.pi) missionRecord('pibak'); }
    missionRecord('go', s.events.filter((e) => e.type === 'go' && e.player === ME).length);
    missionRecord('special', s.events.filter((e) => (e.type === 'ppeokEat' || e.type === 'jjok' || e.type === 'ttadak' || e.type === 'sweep') && e.player === ME).length);
  }
  if (!firstTime) { /* 이미 정산함: 표시만 유지 */ }
  else if (r.type === 'win' && r.winner === ME) {
    const ag = items.lossAfterGuard(r.finalScore, s.goCount[AI], AI); // 상대 해태 부적·고 보험
    const boost = chars.ability('coinBoost');
    const got = Math.round(ag.lost * ROOMS[level].per * (1 + boost / 100)); earn(got);
    rc.innerHTML = `<i class="coin-ico" aria-hidden="true"></i> +${fmt(got)} 엽전 <small>${boost ? `${chars.current().def.name} +${boost}% · ` : ''}${ag.saved ? `${ag.why.join(' · ')} → ${ag.saved}점 덜 받음 · ` : ''}보유 ${fmt(coins())}</small>`; rc.hidden = false; rc.classList.remove('minus');
  } else if (r.type === 'win') {
    const guard = items.lossAfterGuard(r.finalScore, s.goCount[ME], ME);
    const cg = chars.ability('coinGuard');
    const lost = lose(Math.round(guard.lost * ROOMS[level].per * (1 - cg / 100)));
    rc.innerHTML = `<i class="coin-ico" aria-hidden="true"></i> -${fmt(lost)} 엽전 <small>${cg ? `${chars.current().def.name} -${cg}% · ` : ''}${guard.saved ? `${guard.why.join(' · ')} → ${guard.saved}점 덜 잃음 · ` : ''}보유 ${fmt(coins())}</small>`; rc.hidden = false; rc.classList.add('minus');
  } else rc.hidden = true;
  // 겹친 아이템 효과 → 엽전, 금은 보따리 → 은화·금화
  if (firstTime) {
    const extra: string[] = [];
    const ov = items.overflowCoins();
    if (ov.coins > 0) { earn(ov.coins); extra.push(`아이템 겹침 보너스 +${fmt(ov.coins)} 엽전 <small>(${ov.why.join(' · ')})</small>`); }
    if (r.type === 'win' && r.winner === ME) {
      const tr = items.treasureRoll();
      if (tr.eun) { addCur('eun', tr.eun); extra.push(`금은 보따리 · 은화 +${tr.eun}`); }
      if (tr.geum) { addCur('geum', tr.geum); extra.push(`금은 보따리 · 금화 +${tr.geum}`); }
      if (tr.eun || tr.geum) sfx.reward();
    }
    if (extra.length) { rc.hidden = false; rc.innerHTML += extra.map((x) => `<div class="rc-extra">${x}</div>`).join(''); syncCurrencies(); }
  }
  // 매직 카드(수집품) 획득 판정 — 테스트용 봇전 드롭
  const outcome = r.type === 'nagari' ? 'nagari' : r.winner === ME ? 'win' : 'lose';
  const drop = firstTime ? rollDrop(outcome, level, Math.random, items.dropBonus()) : null;
  if (drop) setTimeout(() => showReward(drop), 900);
}

function gradeBadge(gi: number) {
  const c = gradeFill(gi);
  return `<span class="gbadge${c === 'rainbow' ? ' rainbow' : ''}" style="${c === 'rainbow' ? '' : `--gc:${c}`}">${GRADES[gi]}</span>`;
}

function showReward(d: Drop) {
  $('rw-card').innerHTML = itemArt(d.item, d.gi);
  $('rw-kicker').textContent = d.gi >= 6 ? `${d.grade} 등급 획득!!` : '아이템 획득!';
  $('rw-name').innerHTML = `${d.item.name} ${gradeBadge(d.gi)}`;
  $('rw-desc').textContent = `${CATEGORY_LABEL[d.item.category]} · ${d.item.effect(d.gi)}${d.isNewBest ? ' · 최고 등급 갱신' : ''}`;
  const box = $('reward');
  box.dataset.tier = d.gi >= 8 ? 'top' : d.gi >= 6 ? 'high' : 'normal';
  box.style.setProperty('--gc', gradeFill(d.gi) === 'rainbow' ? '#ffd23a' : gradeFill(d.gi));
  box.hidden = false;
  box.classList.remove('on'); void box.offsetWidth; box.classList.add('on');
  sfx.magic(); if (d.gi >= 6) setTimeout(() => sfx.reward(), 450);
  sfx.buzz(d.gi >= 6 ? [40, 60, 40, 60, 80] : [30, 50, 30]);
  syncHome();
}

let collTab: Category | 'all' = 'all';
function renderCollection() {
  const own = ownedKinds();
  $('coll-count').textContent = `${own} / ${ITEMS.length}`;
  ($('coll-bar') as HTMLElement).style.setProperty('--p', String(own / ITEMS.length));
  const tabs = $('coll-tabs');
  const all: (Category | 'all')[] = ['all', ...(Object.keys(CATEGORY_LABEL) as Category[])];
  tabs.innerHTML = all.map((c) => {
    const list = ITEMS.filter((x) => c === 'all' || x.category === c);
    const got = list.filter((x) => bestGrade(x.id) >= 0).length;
    return `<button type="button" class="tab${collTab === c ? ' cur' : ''}" data-c="${c}">${c === 'all' ? '전체' : CATEGORY_LABEL[c].replace('판 ', '')} <small>${got}/${list.length}</small></button>`;
  }).join('');
  tabs.querySelectorAll<HTMLButtonElement>('.tab').forEach((b) => b.addEventListener('click', () => { collTab = b.dataset.c as Category | 'all'; sfx.click(); renderCollection(); }));
  const grid = $('coll-grid'); grid.innerHTML = '';
  for (const it of ITEMS.filter((x) => collTab === 'all' || x.category === collTab)) {
    const gi = bestGrade(it.id);
    const n = Object.values(ownedOf(it.id)).reduce((a, v) => a + (v ?? 0), 0);
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'cl-item' + (gi < 0 ? ' locked' : '');
    b.innerHTML = `<span class="cl-art">${itemArt(it, Math.max(gi, 0), gi < 0)}</span><span class="cl-name">${gi < 0 ? '???' : it.name}</span>${gi < 0 ? '' : `<span class="cl-meta">${gradeBadge(gi)}${n > 1 ? `<small>×${n}</small>` : ''}</span>`}`;
    attachItemTip(b, it.id);
    grid.append(b);
  }
  const rows = (['win', 'lose', 'nagari'] as const).map((o) => {
    const label = o === 'win' ? '이겼을 때' : o === 'lose' ? '졌을 때' : '나가리';
    return `<tr><td>${label}</td><td>${DROP_RATE[o].easy}%</td><td>${DROP_RATE[o].normal}%</td><td>${DROP_RATE[o].hard}%</td></tr>`;
  });
  const grades = GRADES.map((g, i) => `<span class="gr">${gradeBadge(i)} ${GRADE_RATE[g]}%</span>`).join('');
  $('drop-rates').innerHTML = `<table class="dr-table"><thead><tr><th>봇전 판 결과</th><th>쉬움</th><th>보통</th><th>어려움</th></tr></thead><tbody>${rows.join('')}</tbody></table>
    <div class="dt-sub">봇전에서 얻을 때 등급 확률</div><div class="gr-row">${grades}</div><div class="dt-sub">뽑기권 확률은 뽑기 화면에 따로 있습니다.</div>`;
}

function showItem(it: ItemDef) {
  const total = ITEMS.reduce((a, m) => a + m.weight, 0);
  const own = ownedOf(it.id);
  const gi = bestGrade(it.id);
  const cp = copyOf(it.id);
  $('id-card').innerHTML = itemArt(it, Math.max(gi, 0), gi < 0);
  $('id-chips').innerHTML = `<span class="chip">${CATEGORY_LABEL[it.category]}</span><span class="chip use-${cp.use}">${USE_LABEL[cp.use]}</span>`;
  $('id-title').textContent = gi < 0 ? '아직 못 얻은 아이템' : it.name;
  $('id-one').textContent = gi < 0 ? '뽑기나 봇전에서 얻을 수 있어요.' : cp.one;
  const cur = $('id-cur');
  if (gi < 0) cur.innerHTML = `<div class="ic-head">F 등급일 때</div><div class="ic-eff">${it.effect(0)}</div>`;
  else cur.innerHTML = `<div class="ic-head">내 등급 ${gradeBadge(gi)}</div><div class="ic-eff">${it.effect(gi)}</div>${gi < 9 ? `<div class="ic-next"><span>다음 ${gradeBadge(gi + 1)}</span>${it.effect(gi + 1)}</div>` : '<div class="ic-next"><span>최고 등급</span>더 오를 등급이 없습니다</div>'}`;
  const have = GRADES.map((g, i) => ({ g, i, n: own[g] ?? 0 })).filter((x) => x.n > 0);
  $('id-own').innerHTML = have.length ? `<span class="io-label">보유</span>${have.map((x) => `<span class="io">${gradeBadge(x.i)}×${x.n}</span>`).join('')}` : '';
  $('id-stack').innerHTML = it.category === 'cosmetic' ? '<b>함께 쓸 때</b>꾸미기는 종류마다 하나씩 쓸 수 있고, 게임 결과에는 영향이 없습니다.' : `<b>함께 쓸 때</b>${STACK_RULE}`;
  $('id-list').innerHTML = GRADES.map((g, i) => `<li class="${(own[g] ?? 0) ? 'have' : ''}${i === gi ? ' cur' : ''}">${gradeBadge(i)}<span>${it.effect(i)}</span></li>`).join('');
  $('id-rate').textContent = `이 아이템이 나올 확률 ${Math.round((it.weight / total) * 1000) / 10}% (모든 아이템 중)`;
  $('item-detail').hidden = false;
}

// ---------- 처음 화면 ----------
/** 배경음악 고르기 화면 */
function renderMusic() {
  $('mu-voice').textContent = sfx.isVoiceOn() ? '효과 음성 켜짐' : '효과 음성 꺼짐'; $('mu-voice').classList.toggle('off', !sfx.isVoiceOn());
  $('mu-speed').querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.setAttribute('aria-checked', String((b.dataset.v === 'fast') === (speed < 1))));
  $('mu-credits').innerHTML = sfx.BGM_CREDITS.map((c) => `<li><b>${c.name}</b> — ${c.credit} · <a href="${c.url}" target="_blank" rel="noopener">공유마당</a></li>`).join('');
  const on = sfx.isBgmOn();
  const onoff = $('mu-onoff');
  onoff.textContent = on ? '음악 켜짐' : '음악 꺼짐'; onoff.classList.toggle('off', !on);
  $('mu-mode').querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.m === sfx.bgmMode())));
  const favs = sfx.bgmFavs(); const cur = sfx.bgmTrack();
  const list = $('mu-list'); list.innerHTML = '';
  for (const t of sfx.BGM_TRACKS) {
    const li = document.createElement('li');
    li.className = 'mu-row' + (t.id === cur ? ' cur' : '') + (t.id === cur && on ? ' playing' : '');
    li.innerHTML = `<button type="button" class="mu-play" aria-label="${t.name} 듣기"><i class="eq"><b></b><b></b><b></b></i></button>
      <div class="mu-txt"><b>${t.name}</b><span>${t.desc}</span></div>
      <button type="button" class="mu-fav${favs.includes(t.id) ? ' on' : ''}" aria-pressed="${favs.includes(t.id)}" aria-label="좋아요">${favs.includes(t.id) ? '♥' : '♡'}</button>`;
    const pick = () => { sfx.unlock(); if (!sfx.isBgmOn()) sfx.setBgm(true); sfx.setBgmTrack(t.id); renderMusic(); };
    li.querySelector('.mu-play')!.addEventListener('click', pick);
    li.querySelector('.mu-txt')!.addEventListener('click', pick);
    li.querySelector('.mu-fav')!.addEventListener('click', () => { sfx.toggleFav(t.id); sfx.click(); renderMusic(); });
    list.append(li);
  }
}

function syncHome() {
  syncCurrencies();
  renderProfiles();
  { const n = missionReady(); const el = document.getElementById('home-ms'); if (el) { el.textContent = n ? `받을 보상 ${n}개` : '은화 받기'; el.parentElement!.classList.toggle('ready', n > 0); } const sh = document.getElementById('btn-shop'); if (sh) { sh.classList.toggle('ready', n > 0); const sub = document.getElementById('home-shop-sub'); if (sub) sub.textContent = n ? `미션 보상 ${n}개 받기` : '미션 · 윷놀이 · 환전'; } }
  document.querySelectorAll('.coin-amt').forEach((e) => { e.textContent = fmt(coins()); });
  $('home-level').textContent = `${ROOMS[level].name} · 점당 ${fmt(ROOMS[level].per)}엽전`;
  $('home-coll').textContent = `${ownedKinds()} / ${ITEMS.length}`;
  const seg = $('seg-level'); seg.innerHTML = '';
  for (const l of AI_LEVELS) {
    const b = document.createElement('button');
    b.type = 'button'; b.innerHTML = `${ROOMS[l.id as AiLevel].name}<small>점당 ${fmt(ROOMS[l.id as AiLevel].per)}</small>`; b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(l.id === level)); b.dataset.level = l.id;
    b.addEventListener('click', () => { setLevel(l.id as AiLevel); sfx.click(); });
    seg.append(b);
  }
  const bgm = $('btn-bgm'), fx = $('btn-sfx');
  bgm.classList.toggle('off', !sfx.isBgmOn()); bgm.querySelector('span')!.textContent = sfx.isBgmOn() ? (sfx.BGM_TRACKS.find((x) => x.id === sfx.bgmTrack())?.name ?? '켜짐') + (sfx.bgmMode() === 'favs' ? ' · 좋아요' : '') : '꺼짐';
  fx.classList.toggle('off', sfx.isMuted()); fx.querySelector('span')!.textContent = sfx.isMuted() ? '꺼짐' : '켜짐';
}
function setLevel(l: AiLevel) {
  level = l;
  try { localStorage.setItem('mg-level', level); } catch { /* 무시 */ }
  syncLevel(); syncHome();
}
function showHome() {
  if (online) { if (!online.ended) net.leave(); online = null; document.body.classList.remove('online'); }
  gameNo++; busy = false;
  for (const id of ['result', 'special', 'choose', 'gostop', 'info', 'reward', 'collection', 'caps-detail', 'item-detail', 'gukjin', 'magic-pick', 'gacha', 'gacha-run', 'music', 'missions', 'yut', 'silver', 'goldshop']) $(id).hidden = true;
  syncHome();
  $('home').hidden = false;
}
{
  const fan = $('home-fan');
  ['01-G-0', '03-G-0', '08-G-0', '11-G-0', '12-G-0'].forEach((id, i) => {
    const c = { id, month: Number(id.slice(0, 2)), kind: 'G' } as Card;
    const el = cardEl(c); el.style.setProperty('--i', String(i - 2)); fan.append(el);
  });
}

async function newGame() {
  gameNo++;
  const no = gameNo;
  busy = false;
  const seed = Math.floor(Math.random() * 1e9).toString(36);
  const aiSlots = items.aiLoadout(level as 'easy' | 'normal' | 'hard');
  picked = items.ownedAll();
  const itemOpts = items.prepare(picked, aiSlots);
  s = createGame(seed, { carry, ...itemOpts } as Parameters<typeof createGame>[1]);
  for (const c of [...s.hands[0], ...s.hands[1], ...s.floor, ...s.deck]) allCards.set(c.id, c);
  const magicNotes = equipForGame();
  slotOf.clear();
  for (const c of [...s.hands[0], ...s.hands[1], ...s.floor, ...s.deck, ...s.captured[0], ...s.captured[1]]) allCards.set(c.id, c);
  sfx.shuffle();
  const redeal = s.events.some((e) => (e.type as string) === 'redeal');
  $('feed').innerHTML = `새 판 · 내가 선입니다${carry > 1 ? ` · <b>나가리 이월 ×${carry}</b>` : ''}${redeal ? ' · 바닥 같은 월 4장이라 다시 섞음' : ''}`;
  $('result').hidden = true;
  $('special').hidden = true;
  $('choose').hidden = true;
  $('gukjin').hidden = true;
  await dealIn(no);
  if (no !== gameNo) return;
  if (magicNotes.length) { $('feed').innerHTML = `<b>아이템</b> · ${magicNotes.join(' · ')}`; sfx.magic(); }
  const seer = items.current()?.seerCards ?? [];
  if (seer.length) {
    busy = true; render(s);
    await peekShow(`달토끼 점쟁이 · 더미 위 ${seer.length}장 (위에서부터)`, seer, 3);
    busy = false; render(s);
    if (no !== gameNo) return;
  }
  // 총통: 분배하자마자 같은 월 4장 → 보여 주고 바로 끝
  const ct = s.events.find((e) => (e.type as string) === 'chongtong') as (GameEvent & { player: PlayerId; cards: string[] }) | undefined;
  if (ct) {
    await wait(500);
    if (no !== gameNo) return;
    await reveal(`${ct.player === ME ? '나' : '상대'} 총통!`, ct.cards);
    if (no !== gameNo) return;
    banner('총통!'); sfx.chongtong(); sfx.buzz([40, 40, 40, 40, 120]);
    await wait(2200);
    if (no !== gameNo) return;
    if (s.result?.type === 'win' && s.result.winner === ME) sfx.win(); else sfx.lose();
    showResult();
  }
}

/** 분배 직후 바닥 보너스 패를 선이 가져가기 "전" 모습 (엔진 bonus 이벤트의 slot·with로 되돌림) */
function preDeal(view: GameState): { pre: GameState; bonus: { card: string; with?: string }[] } {
  const evs = view.events.filter((e) => e.type === 'bonus' && (e as { from?: string }).from === 'deal') as { player: PlayerId; card: string; slot?: number; with?: string }[];
  if (!evs.length) return { pre: view, bonus: [] };
  const pre: GameState = structuredClone(view);
  for (const e of [...evs].reverse()) {
    const b = pre.captured[e.player].find((c) => c.id === e.card); if (!b) continue;
    pre.captured[e.player] = pre.captured[e.player].filter((c) => c.id !== e.card);
    const at = e.with ? pre.floor.findIndex((c) => c.id === e.with) : -1;
    if (at >= 0) { const [w] = pre.floor.splice(at, 1, b); pre.deck.unshift(w); } else pre.floor.splice(e.slot ?? pre.floor.length, 0, b);
  }
  return { pre, bonus: evs.map((e) => ({ card: e.card, with: e.with })) };
}

/** 새 판: 가운데 더미에서 손패·바닥(엎어서)으로 "촤라락" → 바닥 6장을 왼쪽부터 차례로 뒤집기 → 보너스 패면 "띵!" 하고 선이 가져감 */
async function dealIn(no: number) {
  const { pre, bonus } = preDeal(s);
  if (reduced) { render(s); return; }
  busy = true; render(pre);
  const floorEls = [...document.querySelectorAll<HTMLElement>('#floor .card')];
  floorEls.forEach((el) => el.classList.add('fd'));
  const deck = $('deck').getBoundingClientRect();
  // 맞고 순서처럼 상대·나·바닥을 번갈아 한 장씩
  const groups = ['#opp-fan i', '#hand .card', '#floor .card'].map((q) => [...document.querySelectorAll<HTMLElement>(q)]);
  const els: HTMLElement[] = [];
  for (let k = 0; k < Math.max(...groups.map((g) => g.length)); k++) for (const g of groups) if (g[k]) els.push(g[k]);
  els.forEach((el, i) => {
    const r = el.getBoundingClientRect();
    const dx = deck.left + deck.width / 2 - (r.left + r.width / 2);
    const dy = deck.top + deck.height / 2 - (r.top + r.height / 2);
    el.animate([{ transform: `translate(${dx}px, ${dy}px) scale(.6) rotate(${(i % 5) * 9 - 18}deg)`, opacity: 0.2 }, { transform: 'none', opacity: 1 }],
      { duration: 360, delay: i * 38, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
    setTimeout(() => { if (no === gameNo) sfx.deal(); }, i * 38 + 200);
  });
  await wait(els.length * 38 + 420);
  if (no !== gameNo) return;
  // 바닥 패를 왼쪽에서 오른쪽으로 한 장씩 뒤집는다
  const order = floorEls.map((el) => ({ el, r: el.getBoundingClientRect() })).sort((a, b) => a.r.left - b.r.left || a.r.top - b.r.top).map((x) => x.el);
  const bonusIds = new Set(bonus.map((b) => b.card));
  for (const el of order) {
    if (no !== gameNo) return;
    const isBonus = bonusIds.has(el.dataset.id!);
    el.animate([{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(90deg) scale(1.08)' }], { duration: 110, easing: 'ease-in' }).onfinish = () => {
      el.classList.remove('fd');
      el.animate([{ transform: 'rotateY(90deg) scale(1.08)' }, { transform: 'none' }], { duration: 130, easing: 'ease-out' });
    };
    sfx.flip();
    if (isBonus) {
      setTimeout(() => { if (no !== gameNo) return; el.classList.add('bonus-hit'); sfx.ding(); sfx.buzz(30); }, 200);
      await wait(620);
    } else await wait(230);
  }
  await wait(250);
  if (no !== gameNo) return;
  if (bonus.length) {
    banner(`보너스 패! 선(${s.options.dealer === ME ? '나' : '상대'})이 가져갑니다`);
    await wait(500);
    if (no !== gameNo) return;
    // 보너스 패는 선의 먹은 패로, 빈자리는 더미에서 한 장 뒤집어 채운다
    busy = false;
    await show(s, { deck: new Set(bonus.map((b) => b.with).filter((x): x is string => !!x)) });
    sfx.swish(1);
    if (no !== gameNo) return;
  }
  busy = false; render(s);
}

function syncSoundBtn() {
  const b = $('btn-sound');
  b.classList.toggle('off', !sfx.isBgmOn());
  b.setAttribute('aria-label', sfx.isBgmOn() ? '배경음악 끄기' : '배경음악 켜기');
}

$('btn-go').addEventListener('click', () => perform({ type: 'go' }));
$('btn-stop').addEventListener('click', () => perform({ type: 'stop' }));
$('btn-new').addEventListener('click', () => { if (online) { onlineAgain(); return; } newGame(); });
$('btn-restart').addEventListener('click', newGame);
$('btn-info').addEventListener('click', () => { $('info').hidden = false; });
$('btn-info-close').addEventListener('click', () => { $('info').hidden = true; });
$('btn-sound').addEventListener('click', () => { sfx.unlock(); sfx.setBgm(!sfx.isBgmOn()); syncSoundBtn(); sfx.click(); banner(sfx.isBgmOn() ? '배경음악 켬' : '배경음악 끔'); }); // 게임 안 ♪ = 배경음악 (효과음은 설정에서)
document.addEventListener('pointerdown', () => sfx.unlock(), { capture: true });
syncSoundBtn();
syncLevel();
$('btn-level').addEventListener('click', () => {
  const i = AI_LEVELS.findIndex((l) => l.id === level);
  level = AI_LEVELS[(i + 1) % AI_LEVELS.length].id as AiLevel;
  try { localStorage.setItem('mg-level', level); } catch { /* 무시 */ }
  syncLevel(); syncHome();
  banner(`${ROOMS[level].name} · 점당 ${fmt(ROOMS[level].per)}엽전`);
});
$('sp-cancel').addEventListener('click', () => { $('special').hidden = true; });
$('btn-start').addEventListener('click', () => {
  sfx.unlock(); sfx.click(); sfx.startBgm();
  const room = ROOMS[level];
  if (coins() < room.min) { sfx.buzz([40]); if (coins() < ROOMS.easy.min) needCoins(room.min); else banner(`${room.name}은 엽전 ${fmt(room.min)} 이상 있어야 들어갑니다`); return; }
  picked = items.ownedAll(); $('home').hidden = true; newGame();
}); // 장착 없이 가진 아이템 모두 자동 적용
$('btn-mp-go').addEventListener('click', () => { items.saveLoadout(picked); $('magic-pick').hidden = true; $('home').hidden = true; newGame(); });
$('btn-mp-none').addEventListener('click', () => { picked = []; $('magic-pick').hidden = true; $('home').hidden = true; newGame(); });
initGacha(() => syncHome());
initEconomy(() => syncHome(), (msg) => banner(msg));
initMonet(() => { syncCurrencies(); syncHome(); }, (msg) => banner(msg));
$('btn-charge').addEventListener('click', () => { sfx.unlock(); sfx.click(); openCharge(); });
chars.initChars(() => { syncCurrencies(); renderProfiles(); });
$('btn-gacha').addEventListener('click', () => { sfx.unlock(); sfx.click(); sfx.startBgm(); openGacha(); });
$('btn-mp-test').addEventListener('click', () => { grantTestMagic(); sfx.magic(); openMagicPick(); syncHome(); });
$('magic-cancel').addEventListener('click', () => { selectMode = null; render(s); });
for (const id of ['opp-caps', 'my-caps']) $(id).addEventListener('click', () => { if (s) { sfx.click(); showCapsDetail(); } });
$('btn-cd-close').addEventListener('click', () => { $('caps-detail').hidden = true; });
$('btn-res-home').addEventListener('click', () => { sfx.click(); showHome(); });
const inGame = () => $('home').hidden && $('result').hidden && !s.result;
$('btn-home').addEventListener('click', async () => {
  sfx.click();
  if (inGame() && !(await askConfirm('판을 그만둘까요?', online && !online.ended ? '온라인 대전에서 나가면 기권패가 됩니다.' : '진행 중인 판은 저장되지 않고 처음 화면으로 갑니다.', '그만두기', '계속하기'))) return;
  showHome();
});
initNative({ inGame, online: () => !!online && !online.ended, goHome: () => showHome(), toast: (m) => banner(m) });
onZoomChange(() => { if (!$('collection').hidden) renderCollection(); });
$('btn-collection').addEventListener('click', () => { sfx.click(); renderCollection(); $('collection').hidden = false; });
// 홈 정리: 상점(미션·윷놀이·은화·금화) / 설정(음악·효과음·규칙)
for (const id of ['shop', 'settings']) $(id).querySelectorAll<HTMLElement>('[data-close]').forEach((b) => b.addEventListener('click', () => { $(id).hidden = true; syncHome(); }));
$('btn-shop').addEventListener('click', () => { sfx.unlock(); sfx.click(); syncCurrencies(); $('shop').hidden = false; });
$('btn-settings').addEventListener('click', () => { sfx.unlock(); sfx.click(); syncHome(); $('settings').hidden = false; });
$('btn-id-close').addEventListener('click', () => { $('item-detail').hidden = true; });
$('btn-coll-close').addEventListener('click', () => { $('collection').hidden = true; $('gx-tip').hidden = true; });
$('btn-coll-x').addEventListener('click', () => { $('collection').hidden = true; });
$('btn-home-rules').addEventListener('click', () => { sfx.click(); $('info').hidden = false; });
$('btn-bgm').addEventListener('click', () => { sfx.unlock(); sfx.click(); renderMusic(); $('music').hidden = false; });
$('btn-music-x').addEventListener('click', () => { $('music').hidden = true; syncHome(); });
$('btn-music-close').addEventListener('click', () => { $('music').hidden = true; syncHome(); });
$('mu-voice').addEventListener('click', () => { sfx.setVoice(!sfx.isVoiceOn()); renderMusic(); if (sfx.isVoiceOn()) sfx.say('고!', true); });
$('mu-speed').querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.addEventListener('click', () => {
  speed = b.dataset.v === 'fast' ? 0.6 : 1; try { localStorage.setItem('mg-speed', b.dataset.v!); } catch { /* 무시 */ } sfx.click(); renderMusic();
}));
$('mu-onoff').addEventListener('click', () => { sfx.unlock(); sfx.setBgm(!sfx.isBgmOn()); renderMusic(); syncHome(); });
$('mu-mode').querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.addEventListener('click', () => { sfx.setBgmMode(b.dataset.m as 'one' | 'favs'); sfx.click(); renderMusic(); }));
sfx.onBgmTrack(() => { if (!$('music').hidden) renderMusic(); syncHome(); });
$('btn-sfx').addEventListener('click', () => { sfx.unlock(); sfx.setMuted(!sfx.isMuted()); syncSoundBtn(); syncHome(); sfx.click(); });
$('btn-reward-ok').addEventListener('click', () => { $('reward').hidden = true; });
document.addEventListener('pointerdown', () => { if (!$('home').hidden) return; sfx.startBgm(); }, { capture: true });
showHome();
(window as unknown as { __mgTest?: unknown }).__mgTest = { explodeAt, askGukjin }; // 화면 점검용(폭탄 연출 미리보기)


// ================= 온라인 대전 =================
/** 서버 판에 나오는 모든 카드(가린 패 제외)를 알아 둔다 */
function learnAllCards() { for (const c of [...ALL_CARDS, ...buildBonusCards(2, 1)]) allCards.set(c.id, c); }
async function startOnline(state: GameState, opp: net.OppProfile, send: (a: Action) => void) {
  gameNo++; const no = gameNo; busy = false; carry = 1;
  online = { send, opp, ended: false };
  document.body.classList.add('online');
  remoteQ = Promise.resolve();
  items.prepare([], []); equipped = []; slotOf.clear(); learnAllCards();
  for (const c of [...state.hands[0], ...state.floor]) allCards.set(c.id, c);
  s = state;
  for (const id of ['result', 'special', 'choose', 'gostop', 'gukjin', 'home', 'online']) $(id).hidden = true;
  renderProfiles(); sfx.shuffle();
  $('feed').innerHTML = `<b>${opp.name}</b> 님과 대전 · ${s.turn === ME ? '내가 선입니다' : '상대가 선입니다'}`;
  render(s);
  await dealIn(no);
  if (no !== gameNo) return;
  render(s);
}
function onlineState(next: GameState) {
  remoteQ = remoteQ.then(async () => {
    if (!online) return;
    if (next.events.length <= s.events.length) { s = next; busy = false; render(s); return; }
    await playOut(s, next, []);
  }).catch(() => {});
}
function onlineEnd(m: { reason: string; win?: boolean; state: GameState | null }) {
  remoteQ = remoteQ.then(async () => {
    if (!online) return;
    if (m.reason === 'normal' && m.state) { if (m.state.events.length > s.events.length) await playOut(s, m.state, []); return; }
    // 기권·연결 끊김
    online.ended = true; busy = false;
    const win = !!m.win;
    const why: Record<string, string> = { 'opp-left': '상대가 나갔습니다', 'opp-timeout': '상대가 시간을 넘겼습니다', 'you-left': '대전을 나갔습니다', 'you-timeout': '시간을 3번 넘겼습니다', disconnected: '서버와 연결이 끊겼습니다' };
    $('result').hidden = false;
    $('res-card').dataset.out = win ? 'win' : 'lose';
    const me = chars.current(); const op = chars.CHARS.find((c) => c.id === online!.opp.char) ?? chars.CHARS[0];
    $('res-hero').innerHTML = `<div class="rh-face">${chars.portrait(win ? me.def : op, win ? me.lv : 6)}</div><div class="rh-seal">${win ? '승' : '패'}</div>`;
    $('res-kicker').textContent = why[m.reason] ?? '대전 종료';
    $('res-title').textContent = win ? '기권승' : m.reason === 'disconnected' ? '연결 끊김' : '기권패';
    $('res-formula').textContent = '온라인 대전은 엽전이 오가지 않습니다';
    $('res-badges').innerHTML = ''; $('res-grid').innerHTML = ''; $('res-coins').hidden = true;
    $('btn-new').textContent = '다시 찾기';
    if (win) sfx.win(); else sfx.lose();
  }).catch(() => {});
}
function onlineAgain() { $('result').hidden = true; online = null; document.body.classList.remove('online'); net.again(); }
net.initOnline({
  start: (st, opp, send) => { startOnline(st, opp, send); },
  state: onlineState,
  end: onlineEnd,
  auto: () => { busy = false; },
  toast: (msg) => banner(msg),
  me: () => { const c = chars.current(); return { name: `${c.def.name}${Math.floor(Math.random() * 900 + 100)}`, char: c.def.id }; },
});

// 손패를 누르거나 올리면 같은 월 바닥 패가 반짝 (어디에 떨어질지 미리 보기)
{
  const hand = $('hand');
  const clear = () => document.querySelectorAll('#floor .card.preview').forEach((e) => e.classList.remove('preview'));
  const peek = (el: HTMLElement | null) => {
    clear(); if (!el || !el.dataset.id) return;
    const m = byId(el.dataset.id).month; if (m > 12) return;
    document.querySelectorAll<HTMLElement>('#floor .card').forEach((f) => { if (f.dataset.id && byId(f.dataset.id).month === m) f.classList.add('preview'); });
  };
  hand.addEventListener('pointerover', (e) => peek((e.target as HTMLElement).closest<HTMLElement>('.card')));
  hand.addEventListener('pointerdown', (e) => peek((e.target as HTMLElement).closest<HTMLElement>('.card')));
  hand.addEventListener('pointerleave', clear);
  document.addEventListener('pointerup', () => setTimeout(clear, 250));
}
