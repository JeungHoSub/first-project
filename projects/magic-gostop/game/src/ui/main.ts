import { applyAction, createGame, getLegalActions, score, PI_VALUE } from '../engine';
import type { Action, Card, GameEvent, GameState, PlayerId } from '../engine';
import { chooseAction } from '../ai/simple';
import { cardArt } from './art';
import * as sfx from './sound';

// 화면 = 엔진 상태를 그리기만 한다. 규칙 판단은 전부 엔진(getLegalActions/applyAction)에 맡긴다.
// 엔진은 한 행동을 한 번에 처리하므로, 화면은 이벤트로 중간 장면(낸 패가 바닥에 놓임 → 뒤집은 패가 놓임 → 먹은 패가 들어옴)을
// 차례로 다시 만들어 보여 준다.
const ME: PlayerId = 0;
const AI: PlayerId = 1;
const MOVE = 420; // 카드 한 번 움직이는 시간
const BEAT = 160; // 장면 사이 쉬는 시간
const AI_THINK = 550; // 상대가 내기 전 뜸
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms: number) => new Promise((r) => setTimeout(r, reduced ? 0 : ms));

const FLOWER = ['', '송학', '매조', '벚꽃', '흑싸리', '난초', '모란', '홍싸리', '공산', '국화', '단풍', '오동', '비', '보너스'];
const KIND_LABEL: Record<Card['kind'], string> = { G: '광', Y: '열끗', T: '띠', P: '피', D: '쌍피', B2: '보너스 2피', B3: '보너스 3피' };
const TAG_LABEL: Record<string, string> = { hong: '홍단', cheong: '청단', cho: '초단', godori: '고도리', gukjin: '국진', bi: '비광' };

const $ = (id: string) => document.getElementById(id)!;
let s: GameState; // 엔진의 진짜 상태
let busy = false; // 연출 중에는 입력을 막는다
let gameNo = 0; // 새 판을 누르면 진행 중인 연출을 끊기 위한 번호

// 바닥 자리 12곳: 가운데 더미를 둘러싸게 위 4 / 왼쪽 2 / 오른쪽 2 / 아래 4.
const SLOTS: [number, number][] = [
  [13, 24], [36, 19], [64, 19], [87, 24],
  [8, 50], [27, 50], [73, 50], [92, 50],
  [13, 76], [36, 81], [64, 81], [87, 76],
];
const SLOT_ORDER = [1, 2, 9, 10, 5, 6, 0, 11, 3, 8, 4, 7];
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

function renderCaps(target: HTMLElement, cards: Card[], details: string[]) {
  target.innerHTML = '';
  const groups: [string, Card['kind'][], string[], number][] = [
    ['광', ['G'], ['gwang'], 3], ['열끗', ['Y'], ['yeol', 'godori'], 5], ['띠', ['T'], ['tti', 'hong', 'cheong', 'cho'], 5], ['피', ['P', 'D', 'B2', 'B3'], ['pi'], 10],
  ];
  for (const [label, kinds, keys, goal] of groups) {
    const list = cards.filter((c) => kinds.includes(c.kind));
    const n = label === '피' ? list.reduce((a, c) => a + (PI_VALUE[c.kind] ?? 1), 0) : list.length;
    const grp = document.createElement('div');
    grp.className = 'cap-group' + (keys.some((k) => details.includes(k)) ? ' scored' : '');
    grp.innerHTML = `<div class="cap-label">${label}<b>${n}</b><span class="bar" style="--p:${Math.min(n / goal, 1)}"></span></div><div class="cap-cards"></div>`;
    const box = grp.querySelector('.cap-cards') as HTMLElement;
    box.style.setProperty('--n', String(Math.max(list.length, 1)));
    list.forEach((c) => box.append(cardEl(c)));
    target.append(grp);
  }
}

/** 상태 하나를 그린다. view가 진짜 상태이고 내 차례이며 연출 중이 아닐 때만 누를 수 있다. */
function render(view: GameState) {
  const live = view === s && !busy;
  const legal = live ? getLegalActions(view) : [];
  const myTurn = live && view.turn === ME && view.phase !== 'ended';
  const sc = [score(view.captured[0]), score(view.captured[1])];

  for (const [p, sfx] of [[ME, 'my'], [AI, 'opp']] as const) {
    const b = $(`${sfx}-score`);
    b.textContent = String(sc[p].total);
    b.parentElement!.classList.toggle('hot', sc[p].total >= view.options.winScore);
    b.parentElement!.style.setProperty('--pct', String(Math.min(sc[p].total / view.options.winScore, 1)));
    const go = $(`${sfx}-go`);
    const tags = [view.goCount[p] ? `${view.goCount[p]}고` : '', view.shakes[p] ? `흔들 ×${2 ** view.shakes[p]}` : ''].filter(Boolean);
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

  renderCaps($('opp-caps'), view.captured[AI], sc[AI].details.map((d) => d.key));
  renderCaps($('my-caps'), view.captured[ME], sc[ME].details.map((d) => d.key));

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
    grp.style.left = `${x + ((j % 5) - 2) * 0.5}%`;
    grp.style.top = `${y + (((j >> 3) % 5) - 2) * 0.8}%`;
    grp.style.setProperty('--rot', `${(j % 11) - 5}deg`);
    for (const c of floorCards.filter((f) => f.month === m)) {
      if (pickable.has(c.id)) {
        const el = cardEl(c); el.classList.add('pick');
        grp.append(el);
      } else {
        const el = cardEl(c);
        if (view.pending && (c.id === view.pending.card.id || c.id === view.pending.later?.id)) el.classList.add('held');
        grp.append(el);
      }
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
    if (canPlay && (onFloor.has(c.month) || c.month === 13)) b.classList.add('match');
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
  const choosing = myTurn && view.phase === 'chooseMatch';
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

  const gs = myTurn && view.phase === 'goStop';
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
}

// ---------- 흔들기 / 폭탄 선택 ----------
function specialFor(c: Card, legal: Action[]) {
  const bomb = legal.find((a) => a.type === 'bomb' && a.month === c.month);
  const shake = legal.find((a) => a.type === 'play' && a.cardId === c.id && a.shake);
  return bomb || shake ? { bomb, shake } : null;
}

function onHandCard(c: Card) {
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
        : [{ transform: `translate(${dx}px, ${dy}px) scale(${sc})` }, { transform: `translate(${dx * 0.08}px, ${dy * 0.08 - 10}px) scale(1.08)`, offset: 0.7 }, { transform: 'none' }],
      { duration: MOVE, easing: 'cubic-bezier(.2,.7,.2,1)' },
    );
  });
  await wait(settle);
}

/** 카드가 바닥에 "탁" 닿는 순간: 눌림 + 퍼지는 고리 + 소리 + 진동 */
function slamAt(ids: string[], power = 0.7, delay = MOVE * 0.78) {
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
    sfx.slap(power);
    sfx.buzz(power > 0.8 ? 35 : 15);
  }, delay);
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

function banner(text: string) {
  if (reduced) return;
  const b = $('banner');
  b.textContent = text;
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
  if (busy) return;
  busy = true;
  const no = gameNo;
  const prev = s;
  const next = applyAction(prev, a);
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
      v = structuredClone(v); moveToFloor(v, ids, who);
      ids.forEach((id) => fromOpp?.add(id));
      if (e.type === 'bomb') setTimeout(() => { banner('폭탄!'); sfx.bomb(); shakeScreen(true); sfx.buzz([60, 30, 90]); }, MOVE * 0.75);
      else slamAt(ids, 0.75);
      await show(v, { opp: fromOpp }, e.type === 'bomb' ? MOVE + 650 : MOVE + BEAT);
    } else if (e.type === 'dummy') {
      sfx.tick(); await wait(200);
    } else if (e.type === 'flip') {
      v = structuredClone(v);
      const i = v.deck.findIndex((c) => c.id === e.card);
      if (i >= 0) v.floor.push(v.deck.splice(i, 1)[0]);
      lastFlip = e.card;
      sfx.flip(); slamAt([e.card], 0.55, MOVE * 0.8);
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

  // 3) 뻑·쪽·따닥·뻑 먹기·싹쓸이 알림
  const special = evs.find((e) => ['ppeok', 'jjok', 'ttadak', 'ppeokEat', 'sweep'].includes(T(e)));
  if (special) {
    const kind = T(special);
    if (kind === 'ppeok') { banner('뻑!'); sfx.ppeok(); shakeScreen(); sfx.buzz([40, 60, 40]); }
    else if (kind === 'ppeokEat') {
      const x = special as { self?: boolean; fromPpeok?: boolean };
      banner(x.fromPpeok === false ? '3장 먹기!' : x.self ? '자뻑! 피 2장' : '뻑 먹기!'); sfx.bonus(); shakeScreen();
    }
    else { banner(kind === 'jjok' ? '쪽!' : kind === 'ttadak' ? '따닥!' : '싹쓸이!'); sfx.bonus(); shakeScreen(); sfx.buzz(40); }
    await wait(650);
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
  if (evs.some((e) => e.type === 'steal')) { sfx.steal(); }
  const goEv = evs.find((e) => e.type === 'go');
  if (goEv && goEv.type === 'go') { banner(`${goEv.goCount}고!`); sfx.go(); sfx.buzz(30); }
  if (evs.some((e) => e.type === 'stop')) { banner('스톱!'); sfx.stop(); }

  if (s.phase === 'ended') {
    await wait(800);
    if (no !== gameNo) return;
    const r = s.result!;
    if (r.type === 'win' && r.winner === ME) sfx.win(); else sfx.lose();
    showResult();
    return;
  }
  if (s.turn === AI) {
    busy = true; render(s);
    await wait(AI_THINK);
    if (no !== gameNo) return;
    busy = false;
    perform(chooseAction(s));
  }
}

// 나가리면 다음 판 점수에 배수가 붙는다 (×2, 최대 ×4)
let carry = 1;

type WinExtra = { by: string; bak?: { pi: boolean; gwang: boolean; meong: boolean }; bakMultiplier?: number; carry?: number; nextCarry?: number };

function showResult() {
  const r = s.result!;
  const sc = [score(s.captured[0]), score(s.captured[1])];
  const x = r as unknown as WinExtra;
  carry = x.nextCarry ?? 1;
  $('result').hidden = false;
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
    $('res-formula').textContent = `${parts.join(' · ')} = ${r.finalScore}점`;
    if (x.bak?.pi) badge('피박');
    if (x.bak?.gwang) badge('광박');
    if (x.bak?.meong) badge('멍따');
    if (r.shakeMultiplier > 1) badge('흔들기');
  }
  const grid = $('res-grid'); grid.innerHTML = '';
  ([ME, AI] as PlayerId[]).forEach((p) => {
    const col = document.createElement('div');
    col.className = 'res-col' + (r.type === 'win' && r.winner === p ? ' win' : '');
    const items = sc[p].details.map((d) => `<li><span>${d.label}</span><span>${d.points}</span></li>`).join('') || '<li><span>점수 없음</span><span></span></li>';
    col.innerHTML = `<h3>${p === ME ? '나' : '상대'}</h3><div class="tot">${sc[p].total}점</div><ul>${items}</ul>`;
    grid.append(col);
  });
  $('btn-new').textContent = carry > 1 ? `새 판 (×${carry})` : '새 판';
}

async function newGame() {
  gameNo++;
  const no = gameNo;
  busy = false;
  const seed = Math.floor(Math.random() * 1e9).toString(36);
  s = createGame(seed, { carry } as Parameters<typeof createGame>[1]);
  slotOf.clear();
  for (const c of [...s.hands[0], ...s.hands[1], ...s.floor, ...s.deck, ...s.captured[0], ...s.captured[1]]) allCards.set(c.id, c);
  const redeal = s.events.some((e) => (e.type as string) === 'redeal');
  $('feed').innerHTML = `새 판 · 내가 선입니다${carry > 1 ? ` · <b>나가리 이월 ×${carry}</b>` : ''}${redeal ? ' · 바닥 같은 월 4장이라 다시 섞음' : ''}`;
  $('result').hidden = true;
  $('special').hidden = true;
  $('choose').hidden = true;
  render(s);
  // 총통: 분배하자마자 같은 월 4장 → 보여 주고 바로 끝
  const ct = s.events.find((e) => (e.type as string) === 'chongtong') as (GameEvent & { player: PlayerId; cards: string[] }) | undefined;
  if (ct) {
    await wait(500);
    if (no !== gameNo) return;
    await reveal(`${ct.player === ME ? '나' : '상대'} 총통!`, ct.cards);
    if (no !== gameNo) return;
    banner('총통!'); sfx.bonus();
    await wait(700);
    if (no !== gameNo) return;
    if (s.result?.type === 'win' && s.result.winner === ME) sfx.win(); else sfx.lose();
    showResult();
  }
}

function syncSoundBtn() {
  const b = $('btn-sound');
  b.classList.toggle('off', sfx.isMuted());
  b.setAttribute('aria-label', sfx.isMuted() ? '소리 켜기' : '소리 끄기');
}

$('btn-go').addEventListener('click', () => perform({ type: 'go' }));
$('btn-stop').addEventListener('click', () => perform({ type: 'stop' }));
$('btn-new').addEventListener('click', newGame);
$('btn-restart').addEventListener('click', newGame);
$('btn-info').addEventListener('click', () => { $('info').hidden = false; });
$('btn-info-close').addEventListener('click', () => { $('info').hidden = true; });
$('btn-sound').addEventListener('click', () => { sfx.unlock(); sfx.setMuted(!sfx.isMuted()); syncSoundBtn(); if (!sfx.isMuted()) sfx.slap(0.6); });
document.addEventListener('pointerdown', () => sfx.unlock(), { capture: true });
syncSoundBtn();
$('sp-cancel').addEventListener('click', () => { $('special').hidden = true; });
newGame();
