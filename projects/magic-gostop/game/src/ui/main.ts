import { applyAction, createGame, getLegalActions, score } from '../engine';
import type { Action, Card, GameEvent, GameState, PlayerId } from '../engine';
import { chooseAction } from '../ai/simple';
import { cardArt } from './art';

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

const FLOWER = ['', '송학', '매조', '벚꽃', '흑싸리', '난초', '모란', '홍싸리', '공산', '국화', '단풍', '오동', '비'];
const KIND_LABEL: Record<Card['kind'], string> = { G: '광', Y: '열끗', T: '띠', P: '피', D: '쌍피' };
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
const cardName = (c: Card) => `${c.month}월 ${c.tag === 'bi' ? '비광' : KIND_LABEL[c.kind]}`;

function cardEl(c: Card, tag: 'div' | 'button' = 'div'): HTMLElement {
  const el = document.createElement(tag);
  el.className = `card k-${c.kind}`;
  el.dataset.id = c.id;
  el.innerHTML = `${cardArt(c)}<span class="mo">${c.month}</span>`;
  el.setAttribute('aria-label', `${FLOWER[c.month]} ${cardName(c)}${c.tag ? ' ' + TAG_LABEL[c.tag] : ''}`);
  if (tag === 'button') (el as HTMLButtonElement).type = 'button';
  return el;
}

function renderCaps(target: HTMLElement, cards: Card[], details: string[]) {
  target.innerHTML = '';
  const groups: [string, Card['kind'][], string[]][] = [
    ['광', ['G'], ['gwang']], ['열끗', ['Y'], ['yeol', 'godori']], ['띠', ['T'], ['tti', 'hong', 'cheong', 'cho']], ['피', ['P', 'D'], ['pi']],
  ];
  for (const [label, kinds, keys] of groups) {
    const list = cards.filter((c) => kinds.includes(c.kind));
    const n = label === '피' ? list.reduce((a, c) => a + (c.kind === 'D' ? 2 : 1), 0) : list.length;
    const grp = document.createElement('div');
    grp.className = 'cap-group' + (keys.some((k) => details.includes(k)) ? ' scored' : '');
    grp.innerHTML = `<div class="cap-label">${label}<b>${n}</b></div><div class="cap-cards"></div>`;
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
    const go = $(`${sfx}-go`);
    const tags = [view.goCount[p] ? `${view.goCount[p]}고` : '', view.shakes[p] ? `흔들 ×${2 ** view.shakes[p]}` : ''].filter(Boolean);
    go.hidden = !tags.length;
    go.textContent = tags.join(' · ');
  }
  document.querySelector('.player.me')!.classList.toggle('turn', view.turn === ME && view.phase !== 'ended');
  document.querySelector('.player.opp')!.classList.toggle('turn', view.turn === AI && view.phase !== 'ended');
  $('opp-hand').textContent = String(view.hands[AI].length + view.dummies[AI]);
  $('deck-n').textContent = String(view.deck.length);
  ($('deck') as HTMLElement).style.visibility = view.deck.length ? 'visible' : 'hidden';
  $('seed').textContent = view.seed;

  renderCaps($('opp-caps'), view.captured[AI], sc[AI].details.map((d) => d.key));
  renderCaps($('my-caps'), view.captured[ME], sc[ME].details.map((d) => d.key));

  // 바닥: 가운데 더미 둘레. 같은 월은 한 자리에 겹쳐 놓고, 자리는 판이 끝날 때까지 유지한다.
  // 고르는 중인 패(pending)도 그 월 자리에 같이 보여 준다.
  const floorCards = view.pending ? [...view.floor, view.pending.card] : view.floor;
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
        const b = cardEl(c, 'button'); b.classList.add('pick');
        b.addEventListener('click', () => perform({ type: 'choose', cardId: c.id }));
        grp.append(b);
      } else {
        const el = cardEl(c);
        if (view.pending && c.id === view.pending.card.id) el.classList.add('held');
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
    if (canPlay && onFloor.has(c.month)) b.classList.add('match');
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
  else if (view.phase === 'play') prompt = '낼 패를 고르세요 · 빛나는 패는 먹을 수 있어요';
  else if (view.phase === 'chooseMatch') prompt = `${cardName(view.pending!.card)}로 먹을 패를 고르세요`;
  $('prompt').textContent = prompt;

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
    else if (e.type === 'flip') parts.push(`뒤집기 ${cardName(byId(e.card))}`);
    else if (e.type === 'capture') parts.push(`<b>${e.cards.length}장 먹음</b>`);
    else if (e.type === 'place') parts.push('깔림');
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
  const who = prev.turn;
  const fromOpp = who === AI ? new Set<string>() : undefined;
  $('feed').innerHTML = describe(evs) || $('feed').innerHTML;

  const shake = evs.find((e) => e.type === 'shake');
  const bomb = evs.find((e) => e.type === 'bomb');
  if (shake && shake.type === 'shake') { banner('흔들기!'); await wait(700); }
  if (bomb && bomb.type === 'bomb') banner('폭탄!');

  // 1) 낸 패를 바닥으로
  const v1: GameState = structuredClone(prev);
  v1.pending = null;
  const moved: string[] = [];
  for (const e of evs) {
    if (e.type === 'play' || (e.type === 'choose' && prev.pending)) moved.push(e.type === 'play' ? e.card : prev.pending!.card.id);
    if (e.type === 'bomb') moved.push(...e.cards);
  }
  if (prev.pending && moved.length) v1.floor.push(prev.pending.card);
  moveToFloor(v1, moved.filter((id) => id !== prev.pending?.card.id), who);
  if (moved.length) {
    moved.forEach((id) => fromOpp?.add(id));
    await show(v1, { opp: fromOpp });
    if (no !== gameNo) return;
  }

  // 2) 더미에서 뒤집은 패
  const flip = evs.find((e) => e.type === 'flip');
  let v2 = v1;
  if (flip && flip.type === 'flip') {
    v2 = structuredClone(v1);
    const i = v2.deck.findIndex((c) => c.id === flip.card);
    if (i >= 0) v2.floor.push(v2.deck.splice(i, 1)[0]);
    await show(v2, { deck: new Set([flip.card]) }, MOVE + BEAT + 120);
    if (no !== gameNo) return;
  }

  // 3) 최종 상태 (먹은 패가 트레이로, 고르기 대기면 그 상태로)
  s = next;
  busy = false;
  await show(s, flip && flip.type === 'flip' && v2 === v1 ? { deck: new Set([flip.card]) } : {});
  if (no !== gameNo) return;
  const go = evs.find((e) => e.type === 'go');
  if (go && go.type === 'go') banner(`${go.goCount}고!`);
  if (evs.some((e) => e.type === 'stop')) banner('스톱!');

  if (s.phase === 'ended') { await wait(700); if (no === gameNo) showResult(); return; }
  if (s.turn === AI) {
    busy = true; render(s);
    await wait(AI_THINK);
    if (no !== gameNo) return;
    busy = false;
    perform(chooseAction(s));
  }
}

function showResult() {
  const r = s.result!;
  const sc = [score(s.captured[0]), score(s.captured[1])];
  $('result').hidden = false;
  if (r.type === 'nagari') {
    $('res-kicker').textContent = '판 결과';
    $('res-title').textContent = '나가리';
    $('res-formula').textContent = '아무도 7점을 못 냈습니다';
  } else {
    $('res-kicker').textContent = r.by === 'stop' ? '스톱으로 끝' : '패가 다 떨어져 끝';
    $('res-title').textContent = r.winner === ME ? '이겼습니다!' : '졌습니다';
    const mult = r.multiplier > 1 ? ` × 고${r.multiplier}` : '';
    const shake = r.shakeMultiplier > 1 ? ` × 흔들${r.shakeMultiplier}` : '';
    $('res-formula').textContent = `(${r.base}점 + 고 ${r.goBonus}점)${mult}${shake} = ${r.finalScore}점`;
  }
  const grid = $('res-grid'); grid.innerHTML = '';
  ([ME, AI] as PlayerId[]).forEach((p) => {
    const col = document.createElement('div');
    col.className = 'res-col' + (r.type === 'win' && r.winner === p ? ' win' : '');
    const items = sc[p].details.map((x) => `<li><span>${x.label}</span><span>${x.points}</span></li>`).join('') || '<li><span>점수 없음</span><span></span></li>';
    col.innerHTML = `<h3>${p === ME ? '나' : '상대'}</h3><div class="tot">${sc[p].total}점</div><ul>${items}</ul>`;
    grid.append(col);
  });
}

function newGame() {
  gameNo++;
  busy = false;
  const seed = Math.floor(Math.random() * 1e9).toString(36);
  s = createGame(seed);
  slotOf.clear();
  for (const c of [...s.hands[0], ...s.hands[1], ...s.floor, ...s.deck]) allCards.set(c.id, c);
  $('feed').innerHTML = '새 판 · 내가 선입니다';
  $('result').hidden = true;
  $('special').hidden = true;
  render(s);
}

$('btn-go').addEventListener('click', () => perform({ type: 'go' }));
$('btn-stop').addEventListener('click', () => perform({ type: 'stop' }));
$('btn-new').addEventListener('click', newGame);
$('btn-restart').addEventListener('click', newGame);
$('btn-info').addEventListener('click', () => { $('info').hidden = false; });
$('btn-info-close').addEventListener('click', () => { $('info').hidden = true; });
$('sp-cancel').addEventListener('click', () => { $('special').hidden = true; });
newGame();
