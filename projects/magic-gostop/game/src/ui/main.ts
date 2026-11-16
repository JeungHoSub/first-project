import { applyAction, createGame, getLegalActions, score } from '../engine';
import type { Action, Card, GameEvent, GameState, PlayerId } from '../engine';
import { chooseAction } from '../ai/simple';

// 화면 = 엔진 상태를 그리기만 한다. 규칙 판단은 전부 엔진(getLegalActions/applyAction)에 맡긴다.
const ME: PlayerId = 0;
const AI: PlayerId = 1;
const AI_DELAY = 750;

const FLOWER = ['', '송학', '매조', '벚꽃', '흑싸리', '난초', '모란', '홍싸리', '공산', '국화', '단풍', '오동', '비'];
const MONTH_COLOR = ['', '#2f6b3a', '#b23a6b', '#d0668a', '#3d3a36', '#3f6ea8', '#a12f63', '#9b3b2a', '#6e5a2c', '#b48a1c', '#c9532a', '#56478a', '#3e5c6b'];
const KIND_LABEL: Record<Card['kind'], string> = { G: '광', Y: '열끗', T: '띠', P: '피', D: '쌍피' };
const TAG_LABEL: Record<string, string> = { hong: '홍단', cheong: '청단', cho: '초단', godori: '고도리', gukjin: '국진', bi: '비광' };

const $ = (id: string) => document.getElementById(id)!;
let s: GameState;
let busy = false;
let fresh = new Set<string>();

function cardName(c: Card) {
  return `${c.month}월 ${c.tag === 'bi' ? '비광' : KIND_LABEL[c.kind]}`;
}

function cardEl(c: Card, tag: 'div' | 'button' = 'div'): HTMLElement {
  const el = document.createElement(tag);
  el.className = `card k-${c.kind}${c.tag ? ' t-' + c.tag : ''}`;
  el.style.setProperty('--mc', MONTH_COLOR[c.month]);
  el.dataset.id = c.id;
  const kd = c.kind === 'G' ? '光' : c.kind === 'T' ? (c.tag === 'hong' ? '홍' : c.tag === 'cheong' ? '청' : c.tag === 'cho' ? '초' : '띠') : KIND_LABEL[c.kind];
  const sub = c.tag ? TAG_LABEL[c.tag] : c.kind === 'G' ? '광' : '';
  el.innerHTML = `<span class="band"><span class="mo">${c.month}</span><span class="fl">${FLOWER[c.month]}</span></span><span class="kd"><span>${kd}</span></span><span class="sub">${sub}</span>`;
  el.setAttribute('aria-label', `${FLOWER[c.month]} ${cardName(c)}${c.tag ? ' ' + TAG_LABEL[c.tag] : ''}`);
  if (tag === 'button') (el as HTMLButtonElement).type = 'button';
  return el;
}

function renderCaps(target: HTMLElement, cards: Card[]) {
  target.innerHTML = '';
  const groups: [string, Card['kind'][]][] = [['광', ['G']], ['열끗', ['Y']], ['띠', ['T']], ['피', ['P', 'D']]];
  for (const [label, kinds] of groups) {
    const list = cards.filter((c) => kinds.includes(c.kind));
    const n = label === '피' ? list.reduce((a, c) => a + (c.kind === 'D' ? 2 : 1), 0) : list.length;
    const g = document.createElement('div');
    g.className = 'cap-group';
    g.innerHTML = `<div class="cap-label">${label}<b>${n}</b></div><div class="cap-cards"></div>`;
    const box = g.querySelector('.cap-cards')!;
    list.forEach((c) => { const el = cardEl(c); if (fresh.has(c.id)) el.classList.add('fresh'); box.append(el); });
    target.append(g);
  }
}

function render() {
  const legal = getLegalActions(s);
  const myTurn = s.turn === ME && !busy && s.phase !== 'ended';
  const sc = [score(s.captured[0]).total, score(s.captured[1]).total];

  $('my-score').textContent = `${sc[ME]}점`;
  $('opp-score').textContent = `${sc[AI]}점`;
  $('my-go').textContent = s.goCount[ME] ? `${s.goCount[ME]}고` : '';
  $('opp-go').textContent = s.goCount[AI] ? `${s.goCount[AI]}고` : '';
  $('deck-n').textContent = `${s.deck.length}장`;
  $('seed').textContent = s.seed;

  const oh = $('opp-hand'); oh.innerHTML = '';
  s.hands[AI].forEach(() => { const b = document.createElement('div'); b.className = 'back'; oh.append(b); });

  renderCaps($('opp-caps'), s.captured[AI]);
  renderCaps($('my-caps'), s.captured[ME]);

  // 바닥: 같은 월끼리 묶어서
  const floor = $('floor'); floor.innerHTML = '';
  const months = [...new Set(s.floor.map((c) => c.month))].sort((a, b) => a - b);
  const pickable = myTurn && s.phase === 'chooseMatch' ? new Set(s.pending!.options) : new Set<string>();
  for (const m of months) {
    const grp = document.createElement('div'); grp.className = 'floor-month';
    for (const c of s.floor.filter((f) => f.month === m)) {
      if (pickable.has(c.id)) {
        const b = cardEl(c, 'button'); b.classList.add('pick');
        b.addEventListener('click', () => act({ type: 'choose', cardId: c.id }));
        grp.append(b);
      } else grp.append(cardEl(c));
    }
    floor.append(grp);
  }

  // 내 손패
  const hand = $('hand'); hand.innerHTML = '';
  hand.classList.toggle('locked', !(myTurn && s.phase === 'play'));
  const floorMonths = new Set(s.floor.map((c) => c.month));
  for (const c of [...s.hands[ME]].sort((a, b) => a.month - b.month || a.id.localeCompare(b.id))) {
    const b = cardEl(c, 'button') as HTMLButtonElement;
    const canPlay = myTurn && s.phase === 'play' && legal.some((a) => a.type === 'play' && a.cardId === c.id);
    b.disabled = !canPlay;
    if (canPlay && floorMonths.has(c.month)) b.classList.add('match');
    b.addEventListener('click', () => act({ type: 'play', cardId: c.id }));
    hand.append(b);
  }

  // 안내 문구
  let prompt = '';
  if (s.phase === 'ended') prompt = '';
  else if (s.turn === AI) prompt = '상대 차례';
  else if (s.phase === 'play') prompt = '낼 패를 고르세요 · 금색 테두리는 먹을 수 있는 패';
  else if (s.phase === 'chooseMatch') prompt = `${cardName(s.pending!.card)}로 먹을 패를 고르세요`;
  $('prompt').textContent = prompt;

  // 고/스톱
  const gs = myTurn && s.phase === 'goStop';
  $('gostop').hidden = !gs;
  if (gs) {
    const n = s.goCount[ME];
    const canGo = legal.some((a) => a.type === 'go');
    $('gs-title').textContent = `${sc[ME]}점 났습니다`;
    $('gs-sub').textContent = canGo
      ? `고 하면 계속 진행해서 점수를 더 냅니다. 지금 고 하면 ${n + 1}고 (+${n + 1}점${n + 1 >= 3 ? `, ×${2 ** (n + 1 - 2)}` : ''}). 스톱하면 지금 점수로 이깁니다.`
      : '마지막 차례라서 스톱만 할 수 있습니다.';
    ($('btn-go') as HTMLButtonElement).hidden = !canGo;
  }

  if (s.phase === 'ended') showResult(sc);
  else $('result').hidden = true;
}

function showResult(sc: number[]) {
  const r = s.result!;
  $('result').hidden = false;
  if (r.type === 'nagari') {
    $('res-title').textContent = '나가리';
    $('res-formula').textContent = '아무도 7점을 못 냈습니다. (다음 판 배수 이월은 3단계에서 넣습니다)';
  } else {
    $('res-title').textContent = r.winner === ME ? '이겼습니다' : '졌습니다';
    const mult = r.multiplier > 1 ? ` × ${r.multiplier}` : '';
    $('res-formula').textContent = `${r.winner === ME ? '내' : '상대'} 점수: (기본 ${r.base}점 + 고 ${r.goBonus}점)${mult} = ${r.finalScore}점`;
  }
  const grid = $('res-grid'); grid.innerHTML = '';
  ([ME, AI] as PlayerId[]).forEach((p) => {
    const d = score(s.captured[p]).details;
    const col = document.createElement('div'); col.className = 'res-col';
    col.innerHTML = `<h3>${p === ME ? '나' : '상대'}</h3><div class="tot">${sc[p]}점</div><ul>${d.map((x) => `<li>${x.label} ${x.points}점</li>`).join('') || '<li>점수 없음</li>'}</ul>`;
    grid.append(col);
  });
}

function describe(events: GameEvent[]): string {
  const parts: string[] = [];
  let who = '';
  for (const e of events) {
    if (e.type === 'play') { who = e.player === ME ? '나' : '상대'; parts.push(`<b>${who}</b> ${cardName(byId(e.card))} 냄`); }
    else if (e.type === 'flip') parts.push(`뒤집기 ${cardName(byId(e.card))}`);
    else if (e.type === 'capture') parts.push(`→ ${e.cards.length}장 먹음`);
    else if (e.type === 'place') parts.push('→ 바닥에 깔림');
    else if (e.type === 'go') parts.push(`<b>${e.player === ME ? '나' : '상대'}</b> ${e.goCount}고!`);
    else if (e.type === 'stop') parts.push(`<b>${e.player === ME ? '나' : '상대'}</b> 스톱`);
  }
  return parts.join(' ');
}

const allCards = new Map<string, Card>();
function byId(id: string) { return allCards.get(id)!; }

function act(a: Action) {
  if (busy) return;
  step(a);
  runAi();
}

function step(a: Action) {
  const before = s.events.length;
  s = applyAction(s, a);
  const evs = s.events.slice(before);
  fresh = new Set(evs.flatMap((e) => (e.type === 'capture' ? e.cards : [])));
  const text = describe(evs);
  if (text) $('feed').innerHTML = text;
  render();
}

function runAi() {
  if (s.phase === 'ended' || s.turn !== AI) return;
  busy = true; render();
  setTimeout(() => {
    busy = false;
    step(chooseAction(s));
    runAi();
  }, AI_DELAY);
}

function newGame() {
  const seed = Math.floor(Math.random() * 1e9).toString(36);
  s = createGame(seed);
  for (const c of [...s.hands[0], ...s.hands[1], ...s.floor, ...s.deck]) allCards.set(c.id, c);
  fresh = new Set();
  $('feed').innerHTML = '새 판입니다. 내가 선입니다.';
  render();
}

$('btn-go').addEventListener('click', () => act({ type: 'go' }));
$('btn-stop').addEventListener('click', () => act({ type: 'stop' }));
$('btn-new').addEventListener('click', newGame);
$('btn-info').addEventListener('click', () => { $('info').hidden = false; });
$('btn-info-close').addEventListener('click', () => { $('info').hidden = true; });
newGame();
