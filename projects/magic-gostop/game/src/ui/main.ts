import { applyAction, createGame, getLegalActions, score } from '../engine';
import type { Action, Card, GameEvent, GameState, PlayerId } from '../engine';
import { chooseAction } from '../ai/simple';
import { cardArt } from './art';

// 화면 = 엔진 상태를 그리기만 한다. 규칙 판단은 전부 엔진(getLegalActions/applyAction)에 맡긴다.
const ME: PlayerId = 0;
const AI: PlayerId = 1;
const AI_THINK = 650; // 상대가 내기 전 뜸 들이는 시간
const MOVE = 380; // 카드 한 번 움직이는 시간
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const FLOWER = ['', '송학', '매조', '벚꽃', '흑싸리', '난초', '모란', '홍싸리', '공산', '국화', '단풍', '오동', '비'];
const KIND_LABEL: Record<Card['kind'], string> = { G: '광', Y: '열끗', T: '띠', P: '피', D: '쌍피' };
const TAG_LABEL: Record<string, string> = { hong: '홍단', cheong: '청단', cho: '초단', godori: '고도리', gukjin: '국진', bi: '비광' };

const $ = (id: string) => document.getElementById(id)!;
let s: GameState;
let busy = false;

// 바닥 자리 12곳: 가운데 더미를 둘러싸게 위 4 / 왼쪽 2 / 오른쪽 2 / 아래 4.
const SLOTS: [number, number][] = [
  [13, 24], [36, 19], [64, 19], [87, 24],
  [8, 50], [27, 50], [73, 50], [92, 50],
  [13, 76], [36, 81], [64, 81], [87, 76],
];
const SLOT_ORDER = [1, 2, 9, 10, 5, 6, 0, 11, 3, 8, 4, 7]; // 처음 8장이 더미 둘레에 고르게
const slotOf = new Map<number, number>();
function hash(t: string) { let h = 7; for (const ch of t) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }

function cardName(c: Card) {
  return `${c.month}월 ${c.tag === 'bi' ? '비광' : KIND_LABEL[c.kind]}`;
}

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

function render() {
  const legal = getLegalActions(s);
  const myTurn = s.turn === ME && !busy && s.phase !== 'ended';
  const sc = [score(s.captured[0]), score(s.captured[1])];

  for (const [p, sfx] of [[ME, 'my'], [AI, 'opp']] as const) {
    const b = $(`${sfx}-score`);
    b.textContent = String(sc[p].total);
    b.parentElement!.classList.toggle('hot', sc[p].total >= s.options.winScore);
    const go = $(`${sfx}-go`);
    go.hidden = !s.goCount[p];
    go.textContent = `${s.goCount[p]}고`;
  }
  document.querySelector('.player.me')!.classList.toggle('turn', s.turn === ME && s.phase !== 'ended');
  document.querySelector('.player.opp')!.classList.toggle('turn', s.turn === AI && s.phase !== 'ended');
  $('opp-hand').textContent = String(s.hands[AI].length);
  $('deck-n').textContent = String(s.deck.length);
  ($('deck') as HTMLElement).style.visibility = s.deck.length ? 'visible' : 'hidden';
  $('seed').textContent = s.seed;

  renderCaps($('opp-caps'), s.captured[AI], sc[AI].details.map((d) => d.key));
  renderCaps($('my-caps'), s.captured[ME], sc[ME].details.map((d) => d.key));

  // 바닥: 가운데 더미를 중심으로 둘레에 뿌린다. 같은 월은 한 자리에 겹쳐 놓고, 자리는 판이 끝날 때까지 유지한다.
  const floor = $('floor');
  floor.querySelectorAll('.floor-month').forEach((n) => n.remove());
  const onFloor = new Set(s.floor.map((c) => c.month));
  for (const [m] of slotOf) if (!onFloor.has(m)) slotOf.delete(m);
  for (const c of s.floor) {
    if (!slotOf.has(c.month)) {
      const used = new Set(slotOf.values());
      slotOf.set(c.month, SLOT_ORDER.find((i) => !used.has(i)) ?? 0);
    }
  }
  const pickable = myTurn && s.phase === 'chooseMatch' ? new Set(s.pending!.options) : new Set<string>();
  for (const m of onFloor) {
    const [x, y] = SLOTS[slotOf.get(m)!];
    const j = hash(s.seed + m);
    const grp = document.createElement('div');
    grp.className = 'floor-month';
    if (s.floor.some((f) => f.month === m && pickable.has(f.id))) grp.classList.add('choosing');
    grp.style.left = `${x + ((j % 5) - 2) * 0.5}%`;
    grp.style.top = `${y + (((j >> 3) % 5) - 2) * 0.8}%`;
    grp.style.setProperty('--rot', `${(j % 11) - 5}deg`);
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
  hand.style.setProperty('--n', String(Math.max(s.hands[ME].length, 1)));
  for (const c of [...s.hands[ME]].sort((a, b) => a.month - b.month || a.id.localeCompare(b.id))) {
    const b = cardEl(c, 'button') as HTMLButtonElement;
    const canPlay = myTurn && s.phase === 'play' && legal.some((a) => a.type === 'play' && a.cardId === c.id);
    b.disabled = !canPlay;
    if (canPlay && onFloor.has(c.month)) b.classList.add('match');
    b.addEventListener('click', () => act({ type: 'play', cardId: c.id }));
    hand.append(b);
  }

  let prompt = '';
  if (s.phase === 'ended') prompt = '판이 끝났습니다';
  else if (s.turn === AI) prompt = '상대가 생각하는 중…';
  else if (s.phase === 'play') prompt = '낼 패를 고르세요 · 빛나는 패는 먹을 수 있어요';
  else if (s.phase === 'chooseMatch') prompt = `${cardName(s.pending!.card)}로 먹을 패를 고르세요`;
  $('prompt').textContent = prompt;

  const gs = myTurn && s.phase === 'goStop';
  $('gostop').hidden = !gs;
  if (gs) {
    const n = s.goCount[ME];
    const canGo = legal.some((a) => a.type === 'go');
    $('gs-title').textContent = `${sc[ME].total}점 났습니다`;
    $('gs-sub').textContent = canGo
      ? `고 하면 판을 계속해서 점수를 더 냅니다. 지금 고 하면 ${n + 1}고(+${n + 1}점${n + 1 >= 3 ? `, ×${2 ** (n + 1 - 2)}` : ''}). 스톱하면 지금 점수로 이깁니다.`
      : '마지막 차례라 스톱만 할 수 있습니다.';
    ($('btn-go') as HTMLButtonElement).hidden = !canGo;
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
    const mult = r.multiplier > 1 ? ` × ${r.multiplier}` : '';
    $('res-formula').textContent = `(${r.base}점 + 고 ${r.goBonus}점)${mult} = ${r.finalScore}점`;
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

function describe(events: GameEvent[]): string {
  const parts: string[] = [];
  for (const e of events) {
    if (e.type === 'play') parts.push(`<b>${e.player === ME ? '나' : '상대'}</b> ${cardName(byId(e.card))}`);
    else if (e.type === 'flip') parts.push(`뒤집기 ${cardName(byId(e.card))}`);
    else if (e.type === 'capture') parts.push(`<b>${e.cards.length}장 먹음</b>`);
    else if (e.type === 'place') parts.push('깔림');
    else if (e.type === 'go') parts.push(`<b>${e.player === ME ? '나' : '상대'} ${e.goCount}고</b>`);
    else if (e.type === 'stop') parts.push(`<b>${e.player === ME ? '나' : '상대'} 스톱</b>`);
  }
  return parts.join(' · ');
}

const allCards = new Map<string, Card>();
function byId(id: string) { return allCards.get(id)!; }

function banner(text: string) {
  if (reduced) return;
  const b = $('banner');
  b.textContent = text;
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
}

/** 카드 이동 연출 (FLIP): 바뀌기 전 위치에서 새 위치로 미끄러지게. 새로 나타난 카드는 더미나 상대 쪽에서 날아온다. */
function snapshot() {
  const m = new Map<string, DOMRect>();
  document.querySelectorAll<HTMLElement>('#app [data-id]').forEach((el) => m.set(el.dataset.id!, el.getBoundingClientRect()));
  return m;
}
function animateMoves(before: Map<string, DOMRect>, evs: GameEvent[]) {
  if (reduced) return 0;
  const flipped = new Set(evs.filter((e) => e.type === 'flip').map((e) => (e as { card: string }).card));
  const played = new Set(evs.filter((e) => e.type === 'play').map((e) => (e as { card: string }).card));
  const deck = $('deck').getBoundingClientRect();
  const opp = $('opp-avatar').getBoundingClientRect();
  let longest = 0;
  document.querySelectorAll<HTMLElement>('#app [data-id]').forEach((el) => {
    const id = el.dataset.id!;
    const to = el.getBoundingClientRect();
    let from = before.get(id);
    let delay = 0;
    if (flipped.has(id)) { from = deck; delay = MOVE * 0.8; }
    else if (!from && played.has(id)) from = opp;
    if (!from) return;
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    const sc = from.width / Math.max(to.width, 1);
    if (!flipped.has(id) && !played.has(id)) delay = MOVE * 1.4; // 바닥에서 먹은 패는 낸 패·뒤집은 패 다음에
    el.animate(
      [{ transform: `translate(${dx}px, ${dy}px) scale(${sc})`, zIndex: 30 }, { transform: 'translate(0, 0) scale(1)', zIndex: 30 }],
      { duration: MOVE, delay, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' },
    );
    longest = Math.max(longest, delay + MOVE);
  });
  return longest;
}

function act(a: Action) {
  if (busy) return;
  const wait = step(a);
  if (s.phase !== 'ended' && s.turn === AI) {
    busy = true; render();
    setTimeout(runAi, wait + AI_THINK);
  }
}

/** 행동 하나를 적용하고 화면을 다시 그린다. 연출이 끝나는 데 걸리는 시간(ms)을 돌려준다. */
function step(a: Action): number {
  const before = snapshot();
  const n = s.events.length;
  s = applyAction(s, a);
  const evs = s.events.slice(n);
  const text = describe(evs);
  if (text) $('feed').innerHTML = text;
  render();
  const t = animateMoves(before, evs);
  const go = evs.find((e) => e.type === 'go');
  if (go && go.type === 'go') banner(`${go.goCount}고!`);
  if (evs.some((e) => e.type === 'stop')) banner('스톱!');
  if (s.phase === 'ended') setTimeout(showResult, t + 500);
  return t;
}

function runAi() {
  busy = false;
  const wait = step(chooseAction(s));
  if (s.phase !== 'ended' && s.turn === AI) {
    busy = true; render();
    setTimeout(runAi, wait + AI_THINK);
  }
}

function newGame() {
  const seed = Math.floor(Math.random() * 1e9).toString(36);
  s = createGame(seed);
  busy = false;
  slotOf.clear();
  for (const c of [...s.hands[0], ...s.hands[1], ...s.floor, ...s.deck]) allCards.set(c.id, c);
  $('feed').innerHTML = '새 판 · 내가 선입니다';
  $('result').hidden = true;
  render();
}

$('btn-go').addEventListener('click', () => act({ type: 'go' }));
$('btn-stop').addEventListener('click', () => act({ type: 'stop' }));
$('btn-new').addEventListener('click', newGame);
$('btn-restart').addEventListener('click', newGame);
$('btn-info').addEventListener('click', () => { $('info').hidden = false; });
$('btn-info-close').addEventListener('click', () => { $('info').hidden = true; });
newGame();
