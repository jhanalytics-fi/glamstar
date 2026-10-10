import { BACKGROUNDS, GENRES, GENRE_LABEL, HIDDEN_TRAITS, ROLE_LABEL, overall, traitDisplay } from '../game/characters';
import { available, chemistry, getAffinity, missingForGig } from '../game/chemistry';
import { CHART_NAME, hotGenres, playerPosition, type ChartId } from '../game/world';
import { DEADLINE_WEEK, MAX_MEMBERS, WIN_BUZZ, WIN_FANS, act, canAct, dateLabel, fire, first, hire, newGame, upgradeSave } from '../game/engine';
import { Rng } from '../game/rng';
import { bandName, bestVenue, stageName } from '../game/names';
import type { Action, Background, GameState, Genre, Musician, NewGameInput, PlayerInstrument, Role } from '../game/types';

const SAVE_KEY = 'glamstar.save.v1';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

let state: GameState | null = load();
let draft: NewGameInput = {
  name: '',
  stageName: '',
  instrument: 'none',
  bandName: bandName(new Rng(Date.now() % 100000)),
  background: 'artschool',
  style: 'glam',
};
let adRole: Role = 'guitar';
let chartTab: ChartId = 'london';
let chartAll = false;
let error = '';

function load(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    if (s.version !== 1) return null;
    // Saves from before real names existed.
    for (const m of [...s.members, ...s.candidates]) {
      m.realName ??= m.name;
      m.from ??= 'London';
    }
    return upgradeSave(s);
  } catch {
    return null;
  }
}

function save(): void {
  try {
    if (state) localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    else localStorage.removeItem(SAVE_KEY);
  } catch {
    /* storage unavailable: the game still runs, it just won't persist */
  }
}

export function mount(root: HTMLElement): void {
  root.addEventListener('click', (e) => onClick(e, root));
  root.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.name === 'name') draft.name = t.value;
    if (t.name === 'stageName') draft.stageName = t.value;
    if (t.name === 'bandName') draft.bandName = t.value;
  });
  root.addEventListener('change', (e) => {
    const t = e.target as HTMLSelectElement;
    if (t.name === 'adRole') { adRole = t.value as Role; render(root); }
  });
  render(root);
}

function onClick(e: Event, root: HTMLElement): void {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-do]');
  if (!el) return;
  if (el.tagName === 'A') e.preventDefault();
  const { do: what, arg, arg2 } = el.dataset;
  error = '';
  try {
    switch (what) {
      case 'instrument': draft.instrument = arg as PlayerInstrument; break;
      case 'background': draft.background = arg as Background; break;
      case 'style': draft.style = arg as Genre; break;
      case 'genStage': draft.stageName = stageName(new Rng(Math.floor(Math.random() * 1e9))); break;
      case 'genBand': draft.bandName = bandName(new Rng(Math.floor(Math.random() * 1e9))); break;
      case 'start':
        if (!draft.name.trim()) { error = 'Enter your real name first. Your stage name is optional.'; break; }
        state = newGame(draft);
        break;
      case 'act': {
        const a: Action = arg === 'advertise' ? { type: 'advertise', role: adRole } : ({ type: arg } as Action);
        state = act(state!, a);
        break;
      }
      case 'hire': state = hire(state!, arg!, arg2 || undefined); break;
      case 'fire': {
        const m = state!.members.find((x) => x.id === arg)!;
        if (confirmFire(el, m)) state = fire(state!, arg!);
        else { render(root); return; }
        break;
      }
      case 'chart': chartTab = arg as ChartId; chartAll = false; break;
      case 'chartAll': chartAll = !chartAll; break;
      case 'newGame': state = null; break;
    }
  } catch (err) {
    error = (err as Error).message;
  }
  save();
  render(root);
  if (what === 'start' || what === 'newGame') window.scrollTo(0, 0);
}

/** Two-step fire button instead of a browser dialog. */
function confirmFire(el: HTMLElement, m: Musician): boolean {
  if (el.dataset.armed === '1') return true;
  el.dataset.armed = '1';
  el.textContent = `Really fire ${first(m)}?`;
  return false;
}

function render(root: HTMLElement): void {
  root.innerHTML = state ? renderGame(state) : renderCreate();
}

// ---------------------------------------------------------------- creation

function renderCreate(): string {
  const pressed = (b: boolean) => `aria-pressed="${b}"`;
  return `
    <h1 class="logo">GLAMSTAR</h1>
    <p class="tagline">London, January 1982. You have a voice, three mates from the pub and a band name scribbled on a beer mat.</p>
    <div class="create">
      <div class="names">
        <div class="field">
          <label for="name">Real name</label>
          <input class="text" id="name" name="name" value="${esc(draft.name)}" placeholder="e.g. John Whitaker" autocomplete="off" />
        </div>
        <div class="field">
          <label for="stageName">Known as</label>
          <div class="row">
            <input class="text" id="stageName" name="stageName" value="${esc(draft.stageName ?? '')}" placeholder="e.g. Johnny Vain" autocomplete="off" />
            <button class="btn ghost" data-do="genStage">Suggest</button>
          </div>
        </div>
      </div>
      <p class="hint names-hint">The crowd chants your stage name. Contracts, landlords and gossip columns use the real one.</p>
      <div class="field">
        <span class="label">You sing lead. Do you also play?</span>
        <div class="chips">
          ${(['none', 'guitar', 'keys'] as PlayerInstrument[]).map((i) => `<button class="chip" data-do="instrument" data-arg="${i}" ${pressed(draft.instrument === i)}>${i === 'none' ? 'Just sing' : i === 'guitar' ? 'Rhythm guitar' : 'Keyboards'}</button>`).join('')}
        </div>
      </div>
      <div class="field">
        <label for="bandName">Band name</label>
        <div class="row">
          <input class="text" id="bandName" name="bandName" value="${esc(draft.bandName)}" autocomplete="off" />
          <button class="btn ghost" data-do="genBand">Another one</button>
        </div>
      </div>
      <div class="field">
        <span class="label">Where you come from</span>
        <div class="options">
          ${(Object.keys(BACKGROUNDS) as Background[]).map((b) => `<button class="option" data-do="background" data-arg="${b}" ${pressed(draft.background === b)}><strong>${BACKGROUNDS[b].label}</strong><span>${BACKGROUNDS[b].text}</span></button>`).join('')}
        </div>
      </div>
      <div class="field">
        <span class="label">Your sound</span>
        <div class="chips">
          ${GENRES.map((g) => `<button class="chip" data-do="style" data-arg="${g}" ${pressed(draft.style === g)}>${GENRE_LABEL[g]}</button>`).join('')}
        </div>
        <p class="hint">Your mates mostly share your taste. Mostly.</p>
      </div>
      ${error ? `<p class="hint" role="alert" style="color:var(--bad)">${esc(error)}</p>` : ''}
      <button class="btn big" data-do="start">Form the band</button>
    </div>`;
}

// ---------------------------------------------------------------- game

function renderGame(s: GameState): string {
  const chem = chemistry(s);
  const missing = missingForGig(s);
  return `
    <header class="top">
      <div>
        <h1 class="bandname">${esc(s.bandName)}</h1>
        <p class="when">${dateLabel(s.week)}, week ${s.week + 1} of ${DEADLINE_WEEK}. <a href="#" data-do="newGame">New game</a></p>
      </div>
      <div>
        <dl class="stats">
          <div><dt>Money</dt><dd class="${s.money < 0 ? 'neg' : ''}">£${s.money}</dd></div>
          <div><dt>Fans</dt><dd>${s.fans}</dd></div>
          <div><dt>Buzz</dt><dd>${s.buzz}</dd></div>
          <div><dt>Chemistry</dt><dd>${chem.total}</dd></div>
          <div><dt>Tightness</dt><dd>${s.tightness}</dd></div>
          <div><dt>Songs</dt><dd>${s.songs.length}</dd></div>
          <div><dt>London chart</dt><dd>${(() => { const p = playerPosition(s.world, 'london'); return p ? `#${p}` : 'Not yet'; })()}</dd></div>
        </dl>
        <p class="chem-detail">Chemistry: style ${chem.style}, relationships ${chem.affinity}, mood ${chem.mood}${chem.egoPenalty ? `, egos -${chem.egoPenalty}` : ''}</p>
      </div>
    </header>
    ${s.over ? `<div class="over"><h2>${s.over.won ? 'You made it. Sort of.' : 'The end of the road'}</h2><p>${esc(s.over.reason)}</p><button class="btn" data-do="newGame">Start again</button></div>` : ''}
    <div class="board">
      <div class="band">
        <section>
          <h2>The band</h2>
          <div class="cards">${s.members.map((m) => card(s, m)).join('')}</div>
        </section>
        ${chartsSection(s)}
        ${s.candidates.length ? `
        <section>
          <h2>Auditions: ${ROLE_LABEL[s.candidateRole!].toLowerCase()}</h2>
          <div class="cards">${s.candidates.map((c) => card(s, c, true)).join('')}</div>
        </section>` : ''}
      </div>
      <section class="turn">
        <h2>${s.week === 0 ? 'The story so far' : 'Last week'}</h2>
        ${logList(s, (w) => w >= s.week - 1)}
        <h2 class="next">This week</h2>
        ${error ? `<p class="hint" role="alert" style="color:var(--bad)">${esc(error)}</p>` : ''}
        <div class="actions">
          ${actionBtn(s, 'rehearse', 'Rehearse', 'Get tighter. Egos may collide.')}
          ${actionBtn(s, 'write', 'Write songs', s.songs.length ? `${s.songs.length} original${s.songs.length === 1 ? '' : 's'} so far.` : 'You only have covers.')}
          ${actionBtn(s, 'gig', 'Play a gig', missing.length ? `Need ${missing.join(' and ')}.` : `Best you can book: ${bestVenue(s.fans).name}.`)}
          ${actionBtn(s, 'party', 'Party', '£15. Good for mood, bad for livers.')}
          ${actionBtn(s, 'rest', 'Rest', 'Recover energy and dry out a bit.')}
          <div class="ad">
            <select name="adRole" aria-label="Role to advertise for">
              ${(['guitar', 'bass', 'drums', 'keys'] as Role[]).map((r) => `<option value="${r}" ${r === adRole ? 'selected' : ''}>${ROLE_LABEL[r]}</option>`).join('')}
            </select>
            ${actionBtn(s, 'advertise', 'Place an ad', '£12. Three hopefuls audition.')}
          </div>
        </div>
        <p class="hint">Goal: ${WIN_FANS} fans and ${WIN_BUZZ} buzz gets a label interested before the end of 1983.</p>
      </section>
      ${s.week > 1 ? `<section class="history"><h2>Earlier</h2>${logList(s, (w) => w < s.week - 1)}</section>` : ''}
    </div>`;
}

function chartsSection(s: GameState): string {
  const tabs = (Object.keys(CHART_NAME) as ChartId[])
    .map((id) => `<button class="chip" data-do="chart" data-arg="${id}" aria-pressed="${id === chartTab}">${id === 'london' ? 'London' : id === 'uk' ? 'National' : id === 'europe' ? 'Europe' : 'World'}</button>`)
    .join('');
  const rows = s.world.charts[chartTab];
  const mine = rows.find((r) => r.isPlayer);
  const shown = chartAll ? rows : rows.filter((r) => r.pos <= 10 || r.isPlayer);
  const move = (r: (typeof rows)[number]) =>
    r.last === null ? '<span class="mv new">New</span>' : r.last === r.pos ? '<span class="mv">=</span>' : r.last > r.pos ? `<span class="mv up">+${r.last - r.pos}</span>` : `<span class="mv down">-${r.pos - r.last}</span>`;
  const note =
    chartTab === 'london'
      ? mine ? `You're at #${mine.pos}.` : 'Ranked by fans and buzz on the gig circuit. Keep gigging to break in.'
      : 'Release a record to chart here. Records come with a label deal.';
  const hot = hotGenres(s.week).slice(0, 2).map((g) => GENRE_LABEL[g].toLowerCase()).join(' and ');
  return `
    <section class="charts">
      <h2>The charts</h2>
      <div class="chips">${tabs}</div>
      <p class="hint">${CHART_NAME[chartTab]}, ${dateLabel(s.week)}. ${note} Selling right now: ${hot}.</p>
      <div class="chart-wrap">
        <table class="chart">
          <thead><tr><th>#</th><th>Move</th><th>Artist</th>${chartTab === 'london' ? '' : '<th>Single</th><th>From</th>'}<th>Wks</th></tr></thead>
          <tbody>${shown
            .map(
              (r) => `<tr class="${r.isPlayer ? 'me' : ''}"><td class="pos">${r.pos}</td><td>${move(r)}</td><td>${esc(r.artist)}</td>${chartTab === 'london' ? '' : `<td>${esc(r.title ?? '')}</td><td>${r.origin ?? ''}</td>`}<td>${r.weeks}</td></tr>`,
            )
            .join('')}</tbody>
        </table>
      </div>
      <button class="btn ghost small" data-do="chartAll">${chartAll ? 'Show top 10' : `Show all ${rows.length}`}</button>
    </section>`;
}

function actionBtn(s: GameState, type: Action['type'], title: string, sub: string): string {
  const a = (type === 'advertise' ? { type, role: adRole } : { type }) as Action;
  const why = canAct(s, a);
  return `<button class="action" data-do="act" data-arg="${type}" ${why ? 'disabled' : ''} title="${esc(why ?? '')}"><strong>${title}</strong><span>${esc(why ?? sub)}</span></button>`;
}

function logList(s: GameState, keep: (week: number) => boolean): string {
  const items = [...s.log].reverse().filter((l) => keep(l.week)).slice(0, 40);
  let prevWeek = -2;
  return `<ol class="log">${items
    .map((l) => {
      const head = l.week !== prevWeek ? `<span class="wk">${dateLabel(l.week)}, week ${l.week + 1}</span>` : '';
      prevWeek = l.week;
      return `<li class="${l.tone}">${head}${esc(l.text)}</li>`;
    })
    .join('')}</ol>`;
}

function card(s: GameState, m: Musician, candidate = false): string {
  const ovr = overall(m);
  const tier = ovr >= 58 ? 'gold' : ovr >= 45 ? 'silver' : 'bronze';
  const out = !candidate && !available(s).includes(m);
  const roleText = m.isPlayer ? `Vocals${m.doubles ? ` + ${ROLE_LABEL[m.doubles].toLowerCase()}` : ''}` : ROLE_LABEL[m.role];
  const traits = HIDDEN_TRAITS.map((t) => {
    const v = traitDisplay(m, t);
    return `<dt>${t}</dt><dd class="${v === '?' ? 'unknown' : ''}">${v}</dd>`;
  }).join('');
  const meter = (label: string, v: number, cls = '') => `<div class="meter">${label}<div class="bar ${cls} ${cls !== 'habit' && v < 30 ? 'low' : ''}"><i style="width:${v}%"></i></div></div>`;

  let foot = '';
  if (candidate) {
    const same = s.members.filter((x) => !x.isPlayer && x.role === m.role);
    const btns = same.map((x) => `<button class="btn" data-do="hire" data-arg="${m.id}" data-arg2="${x.id}">Replace ${esc(first(x))}</button>`);
    if (s.members.length < MAX_MEMBERS) btns.push(`<button class="btn ${same.length ? 'ghost' : ''}" data-do="hire" data-arg="${m.id}">Add to band</button>`);
    foot = btns.join('');
  } else if (!m.isPlayer && !s.over) {
    foot = `<button class="btn ghost" data-do="fire" data-arg="${m.id}">Fire</button>`;
  }

  return `
    <article class="card ${tier} ${out ? 'out' : ''}">
      <div class="card-in">
        <div class="card-head">
          <div class="ovr">${ovr}<small>${roleText}</small></div>
          <div class="who"><strong>${esc(m.name)}${m.isPlayer ? ' (you)' : ''}</strong>${m.realName !== m.name && !m.name.includes('"') ? `<span class="real">${esc(m.realName)}</span>` : ''}<span>${m.age}, ${esc(m.from)}, ${GENRE_LABEL[m.style].toLowerCase()}</span></div>
        </div>
        <dl class="attrs">
          <div><dt>Skill</dt><dd>${m.skill}</dd></div>
          <div><dt>Stage</dt><dd>${m.stage}</dd></div>
          <div><dt>Image</dt><dd>${m.image}</dd></div>
          <div><dt>Write</dt><dd>${m.writing}</dd></div>
        </dl>
        <dl class="traits">${traits}</dl>
        ${candidate ? '' : `<div class="meters">${meter('Energy', m.energy)}${meter('Mood', m.mood)}${meter('Habit', m.habit, 'habit')}</div>`}
        ${out ? `<p class="status">Out for ${m.outWeeks} more week${m.outWeeks === 1 ? '' : 's'}</p>` : ''}
        ${candidate ? '' : relLine(s, m)}
        <p class="blurb">${esc(m.blurb)}</p>
        ${foot ? `<div class="card-foot">${foot}</div>` : ''}
      </div>
    </article>`;
}

function relLine(s: GameState, m: Musician): string {
  const others = s.members.filter((o) => o.id !== m.id).map((o) => ({ o, v: getAffinity(s, m.id, o.id) }));
  if (!others.length) return '';
  others.sort((a, b) => b.v - a.v);
  const best = others[0];
  const worst = others[others.length - 1];
  const name = (o: Musician) => (o.isPlayer ? 'you' : esc(first(o)));
  const parts = [];
  if (best.v >= 25) parts.push(`Tight with ${name(best.o)}`);
  if (worst.v <= -10) parts.push(`can't stand ${name(worst.o)}`);
  else if (worst !== best && worst.v < 10) parts.push(`cool on ${name(worst.o)}`);
  if (!parts.length) return '';
  const text = parts.join(', ');
  return `<p class="rel">${text.charAt(0).toUpperCase()}${text.slice(1)}.</p>`;
}
