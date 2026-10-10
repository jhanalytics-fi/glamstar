import { BACKGROUNDS, GENRES, GENRE_LABEL, HIDDEN_TRAITS, ROLE_LABEL, estimate, overall, seenRange, traitDisplay } from '../game/characters';
import { available, chemistry, getAffinity, missingForGig } from '../game/chemistry';
import { CHART_NAME, hotGenres, playerPosition, type ChartId } from '../game/world';
import { DEADLINE_WEEK, MAX_MEMBERS, act, dateLabel, dismissCandidates, fire, first, hire, newGame, upgradeSave } from '../game/engine';
import { Rng } from '../game/rng';
import { ACTION_LABEL, actionOptions } from '../game/actions';
import { resolvePending, viewPending } from '../game/events';
import { POLICY_HINT, POLICY_LABEL, TOUR_TIERS, strugglers, tierById, tierLocked, visibleTiers } from '../game/tour';
import { bandName, bestVenue, stageName } from '../game/names';
import type { TourPolicy } from '../game/types';
import type { ActionType, Background, Beat, EffectChip, GameState, Genre, Musician, NewGameInput, PlayerInstrument, Role } from '../game/types';

import { tip } from './glossary';
import { nextGoal } from '../game/goals';

const SAVE_KEY = 'glamstar.save.v1';
const DEBUG_KEY = 'glamstar.debug';

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
let openAction: ActionType | null = null;
let panelTab: PanelTab = 'band';
let historyView: 'milestones' | 'all' = 'milestones';
/** Scene already played back, so re-renders don't replay it. */
let playedScene: number | null = null;
let armedFire: string | null = null;
let armedAbandon = false;
let tourTier: string | null = null;
let tourWeeks = 1;
let tourPolicy: TourPolicy = 'steady';
/** Development aid: shows true values and hidden changes. */
let debug = (() => { try { return localStorage.getItem(DEBUG_KEY) === '1'; } catch { return false; } })();
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
  playedScene = state?.scene?.id ?? null;
  render(root);
}

function onClick(e: Event, root: HTMLElement): void {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-do]');
  if (!el) return;
  if (el.tagName === 'A') e.preventDefault();
  const { do: what, arg, arg2 } = el.dataset;
  error = '';
  // Any interaction finishes the playback of the current scene.
  playedScene = state?.scene?.id ?? null;
  if (what !== 'fire') armedFire = null;
  if (what !== 'abandon') armedAbandon = false;
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
      case 'open': openAction = openAction === arg ? null : (arg as ActionType); tourTier = null; break;
      case 'tourTier': {
        tourTier = arg!;
        const t = tierById(arg!)!;
        tourWeeks = t.minWeeks;
        break;
      }
      case 'tourWeeks': tourWeeks = Number(arg); break;
      case 'tourPolicy': tourPolicy = arg as TourPolicy; break;
      case 'startTour':
        state = act(state!, { type: 'tour', option: tourTier!, weeks: tourWeeks, policy: tourPolicy });
        openAction = null;
        tourTier = null;
        break;
      case 'tourNext': state = act(state!, { type: 'tour', option: `continue:${arg}` }); break;
      case 'abandon':
        if (armedAbandon) { state = act(state!, { type: 'tour', option: 'abandon' }); armedAbandon = false; }
        else armedAbandon = true;
        break;
      case 'choose':
        state = act(state!, { type: arg as ActionType, option: arg2!, role: adRole });
        openAction = null;
        break;
      case 'respond': state = resolvePending(state!, Number(arg)); break;
      case 'hire': state = hire(state!, arg!, arg2 || undefined); break;
      case 'dismiss': state = dismissCandidates(state!); break;
      case 'fire':
        // Two-step button instead of a browser dialog.
        if (armedFire === arg) { state = fire(state!, arg!); armedFire = null; }
        else armedFire = arg!;
        break;
      case 'chart': chartTab = arg as ChartId; chartAll = false; break;
      case 'tab': panelTab = arg as PanelTab; break;
      case 'historyView': historyView = arg as 'milestones' | 'all'; break;
      case 'skip': playedScene = state?.scene?.id ?? null; break;
      case 'chartAll': chartAll = !chartAll; break;
      case 'newGame': state = null; break;
      case 'debug':
        debug = !debug;
        try { localStorage.setItem(DEBUG_KEY, debug ? '1' : '0'); } catch { /* fine */ }
        break;
    }
  } catch (err) {
    error = (err as Error).message;
  }
  save();
  render(root);
  if (what === 'start' || what === 'newGame') window.scrollTo(0, 0);
  // Keep the eyes on the action zone after a decision.
  if (what === 'choose' || what === 'respond' || what === 'hire' || what === 'dismiss' || what === 'startTour' || what === 'tourNext' || (what === 'abandon' && !armedAbandon)) {
    const z = document.getElementById('zone');
    if (z && z.getBoundingClientRect().top < 0) z.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' });
  }
}

let timers: number[] = [];

function render(root: HTMLElement): void {
  for (const t of timers) window.clearTimeout(t);
  timers = [];
  root.innerHTML = state ? renderGame(state) : renderCreate();
  playback(root);
}

/** Reveal the scene line by line, like a match report coming in. */
function playback(root: HTMLElement): void {
  const z = root.querySelector<HTMLElement>('#zone.playing');
  if (!z) return;
  const parts = [...z.querySelectorAll<HTMLElement>('[data-d]')];
  for (const el of parts) el.classList.add('wait');
  let last = 0;
  for (const el of parts) {
    const ms = Number(el.dataset.d) * 1000;
    last = Math.max(last, ms);
    timers.push(window.setTimeout(() => { el.classList.remove('wait'); el.classList.add('enter'); }, ms));
  }
  const id = state?.scene?.id ?? null;
  timers.push(window.setTimeout(() => {
    playedScene = id;
    z.classList.remove('playing');
    z.querySelector('.skip')?.remove();
  }, last + 300));
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
  const pos = playerPosition(s.world, 'london');
  return `
    <header class="top">
      <div>
        <h1 class="bandname">${esc(s.bandName)}</h1>
        <p class="when">${dateLabel(s.week)}, week ${s.week + 1} of ${DEADLINE_WEEK}. <a href="#" data-do="newGame">New game</a> <a href="#" data-do="debug" class="debug-toggle" title="Development aid: shows true values and hidden changes. * marks values you would not know yet.">${debug ? 'Debug on' : 'Debug off'}</a></p>
      </div>
      <dl class="stats">
        <div><dt>${tip('Money', 'money')}</dt><dd class="${s.money < 0 ? 'neg' : ''}">£${s.money}</dd></div>
        <div><dt>${tip('Fans', 'fans')}</dt><dd>${s.fans}</dd></div>
        <div><dt>${tip('Buzz', 'buzz')}</dt><dd>${s.buzz}</dd></div>
        <div title="Style ${chem.style}, relationships ${chem.affinity}, mood ${chem.mood}${chem.egoPenalty ? `, egos -${chem.egoPenalty}` : ''}"><dt>${tip('Chemistry', 'chemistry')}</dt><dd>${chem.total}</dd></div>
        <div><dt>${tip('Tightness', 'tightness')}</dt><dd>${s.tightness}</dd></div>
        <div><dt>${tip('London chart', 'londonchart')}</dt><dd>${pos ? `#${pos}` : '-'}</dd></div>
      </dl>
      ${bandPulse(s)}
    </header>
    <div class="layout">
      ${zone(s)}
      <aside class="panel">
        <div class="tabs" role="tablist">
          ${(['band', 'charts', 'records', 'history'] as PanelTab[]).map((t) => `<button role="tab" class="tab" data-do="tab" data-arg="${t}" aria-selected="${panelTab === t}">${PANEL_LABEL[t]}${t === 'band' && s.candidates.length ? ' <span class="dot" aria-label="auditions waiting"></span>' : ''}</button>`).join('')}
        </div>
        <div class="tab-body">${panelBody(s)}</div>
      </aside>
    </div>`;
}

/** Band-wide averages and red flags, so nobody has to scan every card. */
function bandPulse(s: GameState): string {
  const ms = s.members;
  if (!ms.length) return '';
  const avg = (f: (m: Musician) => number) => Math.round(ms.reduce((a, m) => a + f(m), 0) / ms.length);
  const meters: [string, string, number, boolean][] = [
    ['Energy', 'energy', avg((m) => m.energy), false],
    ['Mood', 'mood', avg((m) => m.mood), false],
    ['Habit', 'habit', avg((m) => m.habit), true],
    ['Stage', 'stage', avg((m) => (debug ? m.stage : estimate(m, m.stage))), false],
  ];
  const meter = ([label, key, v, badHigh]: [string, string, number, boolean]) => {
    const danger = badHigh ? v >= 50 : v < 35;
    return `<div class="pulse-m ${danger ? 'danger' : ''}"><span>${tip(label, key)} <b>${v}</b></span><div class="bar ${badHigh ? 'habit' : ''} ${danger && !badHigh ? 'low' : ''}"><i style="width:${v}%"></i></div></div>`;
  };
  const flags: string[] = [];
  for (const m of ms) {
    const who = m.isPlayer ? 'You' : first(m);
    if (m.outWeeks > 0) flags.push(`${who}: out ${m.outWeeks} wk`);
    else if (m.energy < 25) flags.push(`${who}: exhausted`);
    if (m.habit >= 60) flags.push(`${who}: using heavily`);
    if (m.mood < 25 && !m.isPlayer) flags.push(`${who}: might quit`);
  }
  const miss = missingForGig(s);
  if (miss.length) flags.unshift(`No ${miss.map((x) => x.replace(/^an? /, '')).join(', ')}`);
  return `
    <div class="pulse" aria-label="Band condition">
      <span class="pulse-label">Band</span>
      ${meters.map(meter).join('')}
      ${flags.length ? `<button class="flags" data-do="tab" data-arg="band" title="Open the band tab">${flags.map((f) => `<span class="flag">${esc(f)}</span>`).join('')}</button>` : '<span class="flag ok">All fit to play</span>'}
    </div>`;
}

type PanelTab = 'band' | 'charts' | 'records' | 'history';
const PANEL_LABEL: Record<PanelTab, string> = { band: 'The band', charts: 'Charts', records: 'Songs & records', history: 'History' };

function panelBody(s: GameState): string {
  switch (panelTab) {
    case 'band':
      return `
        ${s.candidates.length ? `<h3 class="sub">Auditions: ${ROLE_LABEL[s.candidateRole!].toLowerCase()} <button class="btn ghost small" data-do="dismiss">Send them home</button></h3><div class="cards">${s.candidates.map((c) => card(s, c, true)).join('')}</div><h3 class="sub">Your band</h3>` : ''}
        <div class="cards">${s.members.map((m) => card(s, m)).join('')}</div>`;
    case 'charts':
      return chartsSection(s);
    case 'records':
      return recordsSection(s) || '<p class="hint">No songs yet. Write some.</p>';
    case 'history': {
      const views = `<div class="chips">${(['milestones', 'all'] as const).map((v) => `<button class="chip" data-do="historyView" data-arg="${v}" aria-pressed="${historyView === v}">${v === 'milestones' ? 'Milestones' : 'Everything'}</button>`).join('')}</div>`;
      return views + (historyView === 'milestones' ? milestoneList(s) : logList(s, () => true));
    }
  }
}

const KIND_LABEL: Record<string, string> = {
  tour: 'On tour', gig: 'Live tonight', rehearse: 'Rehearsal', write: 'Songwriting', release: 'In the studio', party: 'Night out',
  rest: 'Time off', advertise: 'Auditions', event: 'Situation', start: 'Previously',
};

/** The action zone: last week played back line by line, its effects, then what to do next. */
function zone(s: GameState): string {
  const sc = s.scene;
  const playing = !!sc && sc.id !== playedScene && !reducedMotion();
  const step = sc?.vibe === 'gig' || sc?.vibe === 'wasted' ? 0.8 : sc?.vibe === 'trip' ? 0.9 : 0.45;
  const main = sc ? sc.beats.filter((b) => !b.late) : [];
  const late = sc ? sc.beats.filter((b) => b.late) : [];
  let t = 0.3;
  const delay = () => { const d = t; t += step; return d; };
  const beatLi = (b: Beat) => `<li class="beat ${b.tone}" data-d="${delay().toFixed(2)}">${b.time ? `<span class="t">${esc(b.time)}</span>` : '<span class="t"></span>'}<span class="txt">${esc(b.text)}</span></li>`;
  const mainHtml = main.map(beatLi).join('');
  const fxDelay = t;
  t += 0.4;
  const lateHtml = late.length ? `<div class="later" data-d="${t.toFixed(2)}"><h3>Later that week</h3><ul>${late.map((b) => `<li class="${b.tone}">${esc(b.text)}</li>`).join('')}</ul></div>` : '';
  if (late.length) t += 0.5;
  const nextDelay = t;
  return `
    <section id="zone" class="zone vibe-${sc?.vibe ?? 'quiet'} ${playing ? 'playing' : ''}" aria-live="polite">
      <div class="screen">
        <div class="screen-head">
          <div><span class="kicker">${KIND_LABEL[sc?.kind ?? 'start']}</span><h2>${esc(sc?.title ?? s.bandName)}</h2></div>
          ${playing ? '<button class="btn ghost small skip" data-do="skip">Skip</button>' : ''}
        </div>
        <ol class="beats">${mainHtml}</ol>
        ${sc && (sc.effects.length || (debug && sc.hidden)) ? `<div class="fx" data-d="${fxDelay.toFixed(2)}">${effectChips(sc.effects)}${debug && sc.hidden ? `<p class="hidden-fx">${esc(sc.hidden)}</p>` : ''}</div>` : ''}
        ${lateHtml}
      </div>
      <div class="next" data-d="${nextDelay.toFixed(2)}">${nextBlock(s)}</div>
    </section>`;
}

function effectChips(fx: EffectChip[]): string {
  const goodWhenUp = (stat: string) => stat !== 'habit';
  const chip = (e: EffectChip) => {
    const good = goodWhenUp(e.stat) ? e.delta > 0 : e.delta < 0;
    const val = e.stat === 'money' ? `${e.delta > 0 ? '+' : '-'}£${Math.abs(e.delta)}` : `${e.stat} ${e.delta > 0 ? '+' : ''}${e.delta}`;
    return `<span class="fxchip ${good ? 'up' : 'down'}">${esc(val)}</span>`;
  };
  const band = fx.filter((e) => e.who === null);
  const people = [...new Set(fx.filter((e) => e.who).map((e) => e.who!))];
  return `
    ${band.length ? `<div class="fxrow"><span class="fxwho">Band</span>${band.map(chip).join('')}</div>` : ''}
    ${people.map((p) => `<div class="fxrow"><span class="fxwho">${esc(p)}</span>${fx.filter((e) => e.who === p).map(chip).join('')}</div>`).join('')}`;
}

function nextBlock(s: GameState): string {
  if (s.over) {
    return `<div class="over"><h2>${s.over.won ? 'You made it. Sort of.' : 'The end of the road'}</h2><p>${esc(s.over.reason)}</p><button class="btn" data-do="newGame">Start again</button></div>`;
  }
  const ev = eventCard(s);
  if (ev) return ev;
  if (s.tour) return tourPanel(s);
  const missing = missingForGig(s);
  const subs: Record<ActionType, string> = {
    gig: missing.length ? `Need ${missing.join(' and ')}` : bestVenue(s.fans).name.split(',')[0],
    rehearse: `Tightness ${s.tightness}`,
    write: s.songs.length ? `${s.songs.length} original${s.songs.length === 1 ? '' : 's'}` : 'Covers only',
    release: s.releases.length ? `${s.releases.length} out` : 'Tape or vinyl',
    party: 'Morale up, livers down',
    rest: 'Recharge, dry out',
    advertise: 'Replace or add a player',
    tour: tourSub(s),
  };
  const types: ActionType[] = ['gig', 'tour', 'rehearse', 'write', 'release', 'party', 'rest', 'advertise'];
  const tourShut = TOUR_TIERS.every((t) => tierLocked(s, t));
  const open = openAction;
  const opts = open ? actionOptions(s, open) : [];
  const roleSelect =
    open === 'advertise'
      ? `<label class="role-pick">Looking for <select name="adRole">${(['guitar', 'bass', 'drums', 'keys'] as Role[]).map((r) => `<option value="${r}" ${r === adRole ? 'selected' : ''}>${ROLE_LABEL[r].toLowerCase()}</option>`).join('')}</select></label>`
      : '';
  return `
    ${hopefuls(s)}
    <h3 class="what-now">${s.candidates.length ? 'Or get on with the week' : 'What now?'}</h3>
    ${error ? `<p class="hint" role="alert" style="color:var(--bad)">${esc(error)}</p>` : ''}
    <div class="tiles">
      ${types.map((t) => `<button class="tile ${t === 'tour' && tourShut ? 'shut' : ''}" data-do="open" data-arg="${t}" aria-expanded="${open === t}"><strong>${ACTION_LABEL[t]}</strong><span>${esc(subs[t])}</span></button>`).join('')}
    </div>
    ${open === 'tour' ? tourSetup(s, opts) : open ? `<div class="choices">${roleSelect}${opts.map((o) => choiceBtn('choose', open, o.id, o.label, o.cost, o.hint, o.locked)).join('')}</div>` : ''}
    ${goalLine(s)}`;
}

/** The next rung on the road to rock immortality. */
function goalLine(s: GameState): string {
  const g = nextGoal(s);
  return `<p class="goal-line"><span class="goal-step">Road to rock immortality, ${g.step} of ${g.total}</span><strong>Next: ${esc(g.text)}</strong></p>`;
}

function tourSub(s: GameState): string {
  const open = visibleTiers(s).filter((t) => !tierLocked(s, t));
  if (open.length) return open[open.length - 1].name.replace(/,.*$/, '');
  return `Need ${TOUR_TIERS[0].fans} fans`;
}

/** Pick a tour: tier, then length and how wild, then go. */
function tourSetup(_s: GameState, opts: ReturnType<typeof actionOptions>): string {
  const tiers = opts.map((o) => {
    const sel = tourTier === o.id;
    return `<button class="choice ${sel ? 'selected' : ''}" data-do="tourTier" data-arg="${o.id}" ${o.locked ? 'disabled' : ''} aria-pressed="${sel}">
      <span class="choice-head"><strong>${esc(o.label)}</strong></span>
      <span class="choice-hint">${esc(o.locked ?? o.hint)}</span>
    </button>`;
  });
  let detail = '';
  const t = tourTier ? tierById(tourTier) : null;
  if (t) {
    const weeks = Array.from({ length: t.maxWeeks - t.minWeeks + 1 }, (_, i) => t.minWeeks + i);
    detail = `
      <div class="tour-setup">
        <span class="label">How long?</span>
        <div class="chips">${weeks.map((w) => `<button class="chip" data-do="tourWeeks" data-arg="${w}" aria-pressed="${tourWeeks === w}">${w} wk, ${w * t.gigsPerWeek} gigs</button>`).join('')}</div>
        <span class="label">On the road</span>
        <div class="chips">${(['wild', 'steady', 'clean'] as TourPolicy[]).map((p) => `<button class="chip" data-do="tourPolicy" data-arg="${p}" aria-pressed="${tourPolicy === p}" title="${esc(POLICY_HINT[p])}">${POLICY_LABEL[p]}</button>`).join('')}</div>
        <p class="hint">${esc(POLICY_HINT[tourPolicy])} Road costs about £${(t.weeklyCost * tourWeeks).toLocaleString('en-GB')} in total. Nothing else happens until you come home or give up.</p>
        <button class="btn big" data-do="startTour">Hit the road</button>
      </div>`;
  }
  return `<div class="choices">${tiers.join('')}</div>${detail}`;
}

/** While on tour: progress, who's struggling, and how to play the next week. */
function tourPanel(s: GameState): string {
  const tour = s.tour!;
  const t = tierById(tour.tier)!;
  const next = tour.route.slice(tour.week * tour.gigsPerWeek, (tour.week + 1) * tour.gigsPerWeek);
  const pct = Math.round((tour.week / tour.weeks) * 100);
  const net = s.money - tour.startMoney;
  const hurting = strugglers(s);
  return `
    <div class="tour-panel">
      <h3 class="what-now">${esc(t.name)}</h3>
      <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="${tour.weeks}" aria-valuenow="${tour.week}"><i style="width:${pct}%"></i></div>
      <p class="tour-stats">Week ${tour.week} of ${tour.weeks} done. ${tour.gigsPlayed} gigs, ${tour.people.toLocaleString('en-GB')} people, fans ${tour.fansGained >= 0 ? '+' : ''}${tour.fansGained}, money ${net >= 0 ? '+' : '-'}£${Math.abs(net).toLocaleString('en-GB')}.</p>
      <p class="hint">Next: ${next.map((x) => `${esc(x.city)}${x.country !== 'England' ? ` (${esc(x.country)})` : ''}`).join(' -> ')}</p>
      ${hurting.length ? `<p class="hint warn">Struggling: ${hurting.map((m) => `${esc(m.isPlayer ? 'you' : first(m))} (${m.energy < 25 ? 'exhausted' : m.habit >= 60 ? 'using heavily' : 'miserable'})`).join(', ')}.</p>` : ''}
      <div class="choices">
        ${(['wild', 'steady', 'clean'] as TourPolicy[]).map((p) => `<button class="choice ${tour.policy === p ? 'selected' : ''}" data-do="tourNext" data-arg="${p}">
          <span class="choice-head"><strong>Next week: ${esc(POLICY_LABEL[p].toLowerCase())}</strong>${tour.policy === p ? '<span class="cost free">current</span>' : ''}</span>
          <span class="choice-hint">${esc(POLICY_HINT[p])}</span>
        </button>`).join('')}
        <button class="choice danger" data-do="abandon">
          <span class="choice-head"><strong>${armedAbandon ? 'Really abandon the tour?' : 'Abandon the tour'}</strong></span>
          <span class="choice-hint">${armedAbandon ? 'Click again to go home. Cancellation fees and angry promoters.' : 'Go home now. Costs money, buzz and fans.'}</span>
        </button>
      </div>
    </div>`;
}

/** Candidates from an advert, compact, right where the decision is made. */
function hopefuls(s: GameState): string {
  if (!s.candidates.length) return '';
  const rows = s.candidates.map((c) => {
    const est = debug ? overall(c) : estimate(c, overall(c));
    const known = HIDDEN_TRAITS.filter((t) => c.known[t] > 0).map((t) => `${t} ${traitDisplay(c, t).toLowerCase()}`).join(', ');
    const same = s.members.filter((x) => !x.isPlayer && x.role === c.role);
    const btns = same.map((x) => `<button class="btn small" data-do="hire" data-arg="${c.id}" data-arg2="${x.id}">Replace ${esc(first(x))}</button>`);
    if (s.members.length < MAX_MEMBERS) btns.push(`<button class="btn small ${same.length ? 'ghost' : ''}" data-do="hire" data-arg="${c.id}">Add</button>`);
    return `<li><div class="hope-who"><strong>${esc(c.name)}</strong><span>~${est} overall, ${c.age}, ${GENRE_LABEL[c.style].toLowerCase()}${known ? `, ${esc(known)}` : ''}</span></div><div class="hope-btns">${btns.join('')}</div></li>`;
  });
  return `<div class="hopefuls"><h3>Hopefuls: ${ROLE_LABEL[s.candidateRole!].toLowerCase()}</h3><ul>${rows.join('')}</ul><div class="hope-done"><button class="btn ghost small" data-do="dismiss">${s.candidates.length === 1 ? 'Send them home' : 'Send the rest home'}</button><span class="hint">Full cards in <a href="#" data-do="tab" data-arg="band">The band</a> tab.</span></div></div>`;
}

function reducedMotion(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
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
      : mine ? `Your record is at #${mine.pos}.` : 'Release a single that sells and you could chart here.';
  const hot = hotGenres(s.week).slice(0, 2).map((g) => GENRE_LABEL[g].toLowerCase()).join(' and ');
  return `
    <section class="charts">
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

function choiceBtn(what: string, arg: string, arg2: string, label: string, cost: number, hint: string, locked?: string): string {
  return `<button class="choice" data-do="${what}" data-arg="${arg}" data-arg2="${arg2}" ${locked ? 'disabled' : ''}>
    <span class="choice-head"><strong>${esc(label)}</strong><span class="cost ${cost ? '' : 'free'}">${cost ? `£${cost}` : 'Free'}</span></span>
    <span class="choice-hint">${esc(locked ?? hint)}</span>
  </button>`;
}

function eventCard(s: GameState): string {
  const v = viewPending(s);
  if (!v) return '';
  return `
    <div class="event" role="alertdialog" aria-labelledby="event-title">
      <span class="kicker">Something's come up</span>
      <h3 id="event-title">${esc(v.title)}</h3>
      <p>${esc(v.text)}</p>
      <div class="choices">${v.options.map((o, i) => choiceBtn('respond', String(i), '', o.label, o.cost, o.hint, o.locked)).join('')}</div>
    </div>`;
}

function recordsSection(s: GameState): string {
  if (!s.releases.length && !s.songs.length) return '';
  const kind = { demo: 'Demo tape', single: '7" single', ep: '12" EP', album: 'Album' } as const;
  const songs = [...s.songs].sort((a, b) => b.quality - a.quality);
  return `
    <section class="records">
      ${s.releases.length ? `<ul class="rel-list">${s.releases.map((r) => `<li><strong>"${esc(r.title)}"</strong> ${kind[r.kind]}, ${dateLabel(r.week)}. ${r.sold} sold${r.lastWeek ? `, ${r.lastWeek} last week` : ''}.</li>`).join('')}</ul>` : ''}
      <p class="hint">Songs: ${songs.map((x) => `"${esc(x.title)}" ${x.quality}${x.kind === 'ballad' ? ' (ballad)' : ''}${x.released ? ' (released)' : ''}`).join(', ') || 'none yet'}.</p>
    </section>`;
}

const MILESTONE_LABEL: Record<string, string> = { career: 'Career', release: 'Record', lineup: 'Line-up', chart: 'Charts', tour: 'Tour', drama: 'Drama' };

function milestoneList(s: GameState): string {
  const items = [...(s.milestones ?? [])].reverse();
  if (!items.length) return '<p class="hint">Nothing worth remembering yet. Give it time.</p>';
  return `<ol class="milestones">${items
    .map((m) => `<li class="ms-${m.kind}"><span class="ms-when">${dateLabel(m.week)}</span><span class="ms-kind">${MILESTONE_LABEL[m.kind]}</span><span class="ms-text">${esc(m.text)}</span></li>`)
    .join('')}</ol>`;
}

function logList(s: GameState, keep: (week: number) => boolean): string {
  // Newest week first, but each week reads in the order things happened, so effects follow their cause.
  const kept = s.log.filter((l) => keep(l.week)).slice(-60);
  const weeks = [...new Set(kept.map((l) => l.week))].sort((a, b) => b - a);
  const items = weeks.flatMap((w) => kept.filter((l) => l.week === w));
  let prevWeek = -2;
  return `<ol class="log">${items
    .map((l) => {
      const head = l.week !== prevWeek ? `<span class="wk">${dateLabel(l.week)}, week ${l.week + 1}</span>` : '';
      prevWeek = l.week;
      return `<li class="${l.tone}">${head}${esc(l.text)}${debug && l.hidden ? `<span class="hidden-fx">${esc(l.hidden)}</span>` : ''}</li>`;
    })
    .join('')}</ol>`;
}

function card(s: GameState, m: Musician, candidate = false): string {
  // Everything shown is what you believe, not the truth, until you know them well.
  const ovr = debug ? overall(m) : estimate(m, overall(m));
  const fuzzy = !debug && seenRange(m, overall(m))[0] !== seenRange(m, overall(m))[1];
  const tier = ovr >= 58 ? 'gold' : ovr >= 45 ? 'silver' : 'bronze';
  const stat = (v: number) => {
    const [lo, hi] = seenRange(m, v);
    return debug || lo === hi ? String(v) : `<span class="range">${lo}-${hi}</span>`;
  };
  const out = !candidate && !available(s).includes(m);
  const roleText = m.isPlayer ? `Vocals${m.doubles ? ` + ${ROLE_LABEL[m.doubles].toLowerCase()}` : ''}` : ROLE_LABEL[m.role];
  const traits = HIDDEN_TRAITS.map((t) => {
    const v = debug ? `${m.hidden[t]}${m.known[t] < 2 || t === 'potential' ? '*' : ''}` : traitDisplay(m, t);
    return `<dt>${tip(t.charAt(0).toUpperCase() + t.slice(1), t)}</dt><dd class="${v === '?' ? 'unknown' : ''}">${v}</dd>`;
  }).join('');
  const meter = (label: string, v: number, cls = '') => `<div class="meter"><span>${tip(label, label.toLowerCase())}${debug ? ` ${v}` : ''}</span><div class="bar ${cls} ${cls !== 'habit' && v < 30 ? 'low' : ''}"><i style="width:${v}%"></i></div></div>`;

  let foot = '';
  if (candidate) {
    const same = s.members.filter((x) => !x.isPlayer && x.role === m.role);
    const btns = same.map((x) => `<button class="btn" data-do="hire" data-arg="${m.id}" data-arg2="${x.id}">Replace ${esc(first(x))}</button>`);
    if (s.members.length < MAX_MEMBERS) btns.push(`<button class="btn ${same.length ? 'ghost' : ''}" data-do="hire" data-arg="${m.id}">Add to band</button>`);
    foot = btns.join('');
  } else if (!m.isPlayer && !s.over) {
    foot = `<button class="btn ghost" data-do="fire" data-arg="${m.id}">${armedFire === m.id ? `Really fire ${esc(first(m))}?` : 'Fire'}</button>`;
  }

  return `
    <article class="card ${tier} ${out ? 'out' : ''}">
      <div class="card-in">
        <div class="card-head">
          <div class="ovr" title="${fuzzy ? 'Your best guess. Play together more to know for sure.' : 'Overall rating'}">${fuzzy ? '<span class="approx">~</span>' : ''}${ovr}<small>${roleText}</small></div>
          <div class="who"><strong>${esc(m.name)}${m.isPlayer ? ' (you)' : ''}</strong>${m.realName !== m.name && !m.name.includes('"') ? `<span class="real">${esc(m.realName)}</span>` : ''}<span>${m.age}, ${esc(m.from)}, ${GENRE_LABEL[m.style].toLowerCase()}</span></div>
        </div>
        <dl class="attrs">
          <div><dt>${tip('Skill', 'skill')}</dt><dd>${stat(m.skill)}</dd></div>
          <div><dt>${tip('Stage', 'stage')}</dt><dd>${stat(m.stage)}</dd></div>
          <div><dt>${tip('Image', 'image')}</dt><dd>${stat(m.image)}</dd></div>
          <div><dt>${tip('Write', 'write')}</dt><dd>${stat(m.writing)}</dd></div>
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
