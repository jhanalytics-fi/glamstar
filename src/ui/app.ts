import { BACKGROUNDS, GENRES, GENRE_LABEL, HIDDEN_TRAITS, ROLE_LABEL, estimate, overall, seenRange, traitDisplay } from '../game/characters';
import { available, chemistry, chemistryLinks, getAffinity, missingForGig } from '../game/chemistry';
import { CHART_NAME, entryUnits, hotGenres, playerPosition, type ChartId } from '../game/world';
import { MAX_MEMBERS, finishTour, reach, splurge, upkeep, viceBill, act, dateLabel, dismissCandidates, fire, first, hire, newGame, rename, renameRelease, renameSong, dropSong, retire, canComeBack, comeBack, setSplit, upgradeSave } from '../game/engine';
import { Rng } from '../game/rng';
import { ACTION_LABEL, actionOptions } from '../game/actions';
import { resolvePending, titleAlbum, viewPending } from '../game/events';
import { POLICY_HINT, POLICY_LABEL, TOUR_TIERS, strugglers, tierById, tierLocked, visibleTiers } from '../game/tour';
import { bandName, bestVenue, stageName } from '../game/names';
import { sackCost, sackManager, managerCard } from '../game/managers';
import { ASK_HINT, ASK_LABEL, AUDIT_FEE, LAWYER_FEE, audit, buyOut, buyoutCost, declineOffer, haggle, labelById, readSmallPrint, royaltyPerCopy, signOffer, type Ask, type LabelTier } from '../game/labels';
import { SPLIT_LABEL, SPLIT_WORD, shares, writerShares } from '../game/split';
import { entourage, sackHanger } from '../game/entourage';
import { showBackdrop } from './backdrop';
import { bandWord } from '../game/pulse';
import { TOY_KIND, buyToy, sellToy, shopWindow, toyLine, toyLocked, toyUpkeep, type ToyKind } from '../game/toys';
import { STUDIOS } from '../game/studio';
import type { BandGender, Difficulty, Lineup, Lodging, ManagerKind, Split, TourPolicy } from '../game/types';
import { runningTime, sides } from '../game/catalogue';
import { LODGING, LODGING_ORDER, WHEELS, defaultLodging, lodgingCost, tourWheels, wheelsOf } from '../game/wheels';
import { clubIncome, clubMembers } from '../game/fanclub';
import { CERT_LABEL } from '../game/certs';
import { KIT_WORD, bandKit } from '../game/kit';
import type { ActionType, Background, Beat, DealTerms, EffectChip, GameState, Gender, IncomeKind, Scene, Genre, Musician, NewGameInput, PlayerInstrument, Role, Song } from '../game/types';

import { tip } from './glossary';
import { ladderDone, nextGoal } from '../game/goals';

const SAVE_KEY = 'glamstar.save.v1';
const DEBUG_KEY = 'glamstar.debug';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

let state: GameState | null = load();
let draft: NewGameInput & { firstName: string; lastName: string } = {
  name: '',
  firstName: '',
  lastName: '',
  gender: 'male',
  stageName: '',
  instrument: 'none',
  bandName: bandName(new Rng(Date.now() % 100000)),
  background: 'artschool',
  style: 'glam',
  bandGender: 'mixed',
  difficulty: 'normal',
  lineup: 'full',
};
let adRole: Role = 'guitar';
let newSound: Genre | null = null;
let restWho: string | null = null;
let chartTab: ChartId = 'london';
let chartAll = false;
let openAction: ActionType | null = null;
let panelTab: PanelTab = 'band';
let historyView: 'milestones' | 'all' = 'milestones';
/** Scene already played back, so re-renders don't replay it. */
let playedScene: number | null = null;
/** Scene folded down to one line so the choices sit near the top. */
let collapsedScene: number | null = null;
let armedFire: string | null = null;
let armedRetire = false;
let armedHanger: string | null = null;
let armedSell: string | null = null;
let armedComeback = false;
let armedDrop: string | null = null;
let renaming: string | null = null;
let armedBuyout = false;
let armedSack = false;
/** The outcome of the last thing done in the Label tab. */
let labelNote = '';
let armedAbandon = false;
let tourTier: string | null = null;
let tourWeeks = 1;
let tourPolicy: TourPolicy = 'steady';
let tourLodging: Lodging | null = null;
/** Development aid: shows true values and hidden changes. */
const PACE_KEY = 'glamstar.pace';
type Pace = 'relaxed' | 'brisk';
let pace: Pace = (() => { try { return localStorage.getItem(PACE_KEY) === 'brisk' ? 'brisk' : 'relaxed'; } catch { return 'relaxed' as Pace; } })();
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
  root.addEventListener('submit', (e) => {
    const form = e.target as HTMLFormElement;
    if (!form.classList.contains('rename')) return;
    e.preventDefault();
    form.querySelector<HTMLButtonElement>('button[type=submit]')?.click();
  });
  root.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.name === 'firstName') draft.firstName = t.value;
    if (t.name === 'lastName') draft.lastName = t.value;
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
  if (what !== 'retire') armedRetire = false;
  if (what !== 'comeBack') armedComeback = false;
  if (what !== 'dropSong') armedDrop = null;
  if (what !== 'sackHanger') armedHanger = null;
  if (what !== 'buyOut') armedBuyout = false;
  if (what !== 'sackManager') armedSack = false;
  if (what === 'tab') labelNote = '';
  if (what !== 'abandon') armedAbandon = false;
  try {
    switch (what) {
      case 'instrument': draft.instrument = arg as PlayerInstrument; break;
      case 'background': draft.background = arg as Background; break;
      case 'style': draft.style = arg as Genre; break;
      case 'gender': draft.gender = arg as Gender; break;
      case 'bandGender': draft.bandGender = arg as BandGender; break;
      case 'difficulty': draft.difficulty = arg as Difficulty; break;
      case 'lineup': draft.lineup = arg as Lineup; break;
      case 'genStage': draft.stageName = stageName(new Rng(Math.floor(Math.random() * 1e9)), draft.gender); break;
      case 'genBand': draft.bandName = bandName(new Rng(Math.floor(Math.random() * 1e9))); break;
      case 'start':
        if (!draft.firstName.trim() || !draft.lastName.trim()) { error = 'Enter your first and last name. Your stage name is optional.'; break; }
        draft.name = `${draft.firstName.trim()} ${draft.lastName.trim()}`;
        state = newGame(draft);
        break;
      case 'adRole': adRole = arg as Role; break;
      case 'newSound': newSound = arg as Genre; break;
      case 'restWho': restWho = arg!; break;
      case 'open':
        openAction = openAction === arg ? null : (arg as ActionType);
        // Hiring with a hole in the line-up: the ad is for the missing player by default.
        if (openAction === 'advertise' && state) { const gaps = missingRoles(state); if (gaps.length) adRole = gaps[0]; }
        tourTier = null;
        break;
      case 'fold': collapsedScene = state?.scene?.id ?? null; break;
      case 'unfold': collapsedScene = null; break;
      case 'tourTier': {
        tourTier = arg!;
        const t = tierById(arg!)!;
        tourWeeks = t.minWeeks;
        tourLodging = null;
        break;
      }
      case 'tourWeeks': tourWeeks = Number(arg); break;
      case 'tourPolicy': tourPolicy = arg as TourPolicy; break;
      case 'tourLodging': tourLodging = arg as Lodging; break;
      case 'startTour':
        state = act(state!, { type: 'tour', option: tourTier!, weeks: tourWeeks, policy: tourPolicy, lodging: tourLodging ?? defaultLodging(tourTier!) });
        openAction = null;
        tourTier = null;
        break;
      case 'tourNext': state = act(state!, { type: 'tour', option: `continue:${arg}` }); break;
      case 'tourFinish': state = finishTour(state!, arg as TourPolicy); break;
      case 'abandon':
        if (armedAbandon) { state = act(state!, { type: 'tour', option: 'abandon' }); armedAbandon = false; }
        else armedAbandon = true;
        break;
      case 'choose':
        state = act(state!, { type: arg as ActionType, option: arg2!, role: adRole, genre: newSound ?? undefined, memberId: restWho ?? undefined });
        openAction = null;
        break;
      case 'respond': state = resolvePending(state!, Number(arg)); break;
      case 'titleAlbum': {
        const input = document.getElementById('album-title') as HTMLInputElement | null;
        if (input && input.value.trim()) state = titleAlbum(state!, input.value);
        break;
      }
      case 'hire': state = hire(state!, arg!, arg2 || undefined); break;
      case 'renameOpen': renaming = arg!; break;
      case 'renameCancel': renaming = null; break;
      case 'renameSave': {
        const input = root.querySelector<HTMLInputElement>(`#rename-${arg}`);
        const real = root.querySelector<HTMLInputElement>(`#realname-${arg}`);
        state = rename(state!, arg!, input?.value ?? '', real?.value);
        renaming = null;
        break;
      }
      case 'dismiss': state = dismissCandidates(state!); break;
      case 'offerSign': state = signOffer(state!, arg!); labelNote = state.log.at(-1)?.text ?? ''; break;
      case 'offerHaggle': state = haggle(state!, arg!, (arg2 as Ask) || 'advance'); labelNote = state.log.at(-1)?.text ?? ''; break;
      case 'setSplit': state = setSplit(state!, arg as Split); break;
      case 'sackHanger':
        if (armedHanger === arg) { state = sackHanger(state!, arg!); armedHanger = null; }
        else armedHanger = arg!;
        break;
      case 'buyToy': state = buyToy(state!, arg!); labelNote = state.log.at(-1)?.text ?? ''; break;
      case 'sellToy':
        if (armedSell === arg) { state = sellToy(state!, arg!); armedSell = null; labelNote = state.log.at(-1)?.text ?? ''; }
        else armedSell = arg!;
        break;
      case 'offerRead': state = readSmallPrint(state!, arg!); labelNote = state.log.at(-1)?.text ?? ''; break;
      case 'offerDecline': state = declineOffer(state!, arg!); labelNote = state.log.at(-1)?.text ?? ''; break;
      case 'audit': state = audit(state!); labelNote = state.log.at(-1)?.text ?? ''; break;
      case 'sackManager':
        if (armedSack) { state = sackManager(state!); labelNote = state.log.at(-1)?.text ?? ''; armedSack = false; }
        else armedSack = true;
        break;
      case 'buyOut':
        if (armedBuyout) { state = buyOut(state!); labelNote = state.log.at(-1)?.text ?? ''; armedBuyout = false; }
        else armedBuyout = true;
        break;
      case 'retire':
        if (armedRetire) { state = retire(state!); armedRetire = false; }
        else armedRetire = true;
        break;
      case 'comeBack':
        if (armedComeback) { state = comeBack(state!); armedComeback = false; }
        else armedComeback = true;
        break;
      case 'renameRelease': {
        const r = state!.releases.find((x) => x.id === arg);
        const t = r ? window.prompt('Call it:', r.title) : null;
        if (t !== null && r && t.trim() && t.trim() !== r.title) state = renameRelease(state!, arg!, t);
        break;
      }
      case 'renameSong': {
        const t = window.prompt('Call it:', arg!);
        if (t !== null && t.trim() && t.trim() !== arg) state = renameSong(state!, arg!, t);
        break;
      }
      case 'dropSong':
        if (armedDrop === arg) { state = dropSong(state!, arg!); armedDrop = null; }
        else armedDrop = arg!;
        break;
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
      case 'exportSave': {
        const text = JSON.stringify(state);
        const blob = new Blob([text], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `glamstar-${state!.bandName.replace(/[^a-z0-9]+/gi, '_')}-week${state!.week}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        try { void navigator.clipboard?.writeText(text); } catch { /* fine */ }
        break;
      }
      case 'debug':
        debug = !debug;
        try { localStorage.setItem(DEBUG_KEY, debug ? '1' : '0'); } catch { /* fine */ }
        break;
      case 'pace':
        pace = pace === 'relaxed' ? 'brisk' : 'relaxed';
        try { localStorage.setItem(PACE_KEY, pace); } catch { /* fine */ }
        break;
    }
  } catch (err) {
    error = (err as Error).message;
  }
  save();
  render(root);
  if (what === 'start' || what === 'newGame') window.scrollTo(0, 0);
  if (what === 'open' || what === 'tourTier') bringIntoView(root.querySelector('.next .choices, .tour-setup'));
  if (what === 'fold') bringIntoView(root.querySelector('#zone'));
  if (what === 'tab' && el.closest('.offer-banner')) bringIntoView(root.querySelector('.panel'));
  // Keep the eyes on the action zone after a decision.
  if (what === 'choose' || what === 'respond' || what === 'hire' || what === 'dismiss' || what === 'startTour' || what === 'tourNext' || what === 'tourFinish' || (what === 'abandon' && !armedAbandon)) {
    const z = document.getElementById('zone');
    if (z && z.getBoundingClientRect().top < 0) z.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' });
  }
}

let timers: number[] = [];

function render(root: HTMLElement): void {
  for (const t of timers) window.clearTimeout(t);
  timers = [];
  root.innerHTML = state ? renderGame(state) : renderCreate();
  showBackdrop(state);
  playback(root);
}

/** Scroll something into view only if it is off screen. */
function bringIntoView(el: Element | null): void {
  if (!el) return;
  const r = el.getBoundingClientRect();
  if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: r.height > window.innerHeight ? 'start' : 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
}

/**
 * The header figures hold last week's values while the report plays, then count over
 * to the new ones when the result lands, so the eye goes to the numbers that moved.
 */
function tickStats(root: HTMLElement, z: HTMLElement): void {
  const sc = state?.scene;
  const at = Number(z.querySelector<HTMLElement>('.headline')?.dataset.d ?? z.querySelector<HTMLElement>('.fx')?.dataset.d ?? NaN);
  if (!sc?.start || !state || Number.isNaN(at)) return;
  const now = { money: state.money, fans: state.fans, buzz: state.buzz, tightness: state.tightness };
  const fmt = (key: string, v: number) => (key === 'money' ? `${v < 0 ? '-' : ''}£${Math.abs(Math.round(v))}` : String(Math.round(v)));
  for (const key of Object.keys(now) as (keyof typeof now)[]) {
    const el = root.querySelector<HTMLElement>(`[data-stat="${key}"]`);
    const from = sc.start[key];
    const to = now[key];
    if (!el || from === to) continue;
    el.textContent = fmt(key, from);
    timers.push(window.setTimeout(() => {
      el.classList.add(to > from ? 'tick-up' : 'tick-down');
      const t0 = performance.now();
      const step = (t: number) => {
        const p = Math.min(1, (t - t0) / 900);
        el.textContent = fmt(key, from + (to - from) * (1 - (1 - p) ** 3));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      timers.push(window.setTimeout(() => el.classList.remove('tick-up', 'tick-down'), 2200));
    }, at * 1000));
  }
}

/** Roles the band cannot gig without right now. */
function missingRoles(s: GameState): Role[] {
  const miss = missingForGig(s);
  const map: [string, Role][] = [['a drummer', 'drums'], ['a bassist', 'bass'], ['a guitarist', 'guitar']];
  return map.filter(([t]) => miss.includes(t)).map(([, r]) => r);
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
  tickStats(root, z);
  const id = state?.scene?.id ?? null;
  timers.push(window.setTimeout(() => {
    playedScene = id;
    z.classList.remove('playing');
    z.querySelector('.skip')?.remove();
    z.querySelector('.fold')?.removeAttribute('hidden');
    // A situation is waiting: bring it into view, but leave the report as it is.
    if (state?.pending) bringIntoView(root.querySelector('.event'));
  }, last + 300));
}

// ---------------------------------------------------------------- creation

function renderCreate(): string {
  const pressed = (b: boolean) => `aria-pressed="${b}"`;
  return `
    <h1 class="logo">GLAMSTAR <span class="version">v${__APP_VERSION__}</span></h1>
    <p class="pitch">A rock band management game</p>
    <p class="tagline">London, January 1982. You have a voice, three mates from the pub and a band name scribbled on a beer mat. Ten years to go from the back room of a pub to rock immortality: gig, write, record, tour, sign the right deal, keep the band together, and stay out of the tabloids. Mostly.</p>
    <div class="create">
      <div class="names">
        <div class="field">
          <label for="firstName">First name</label>
          <input class="text" id="firstName" name="firstName" value="${esc(draft.firstName)}" placeholder="e.g. ${draft.gender === 'female' ? 'Joanne' : draft.gender === 'male' ? 'John' : 'Sam'}" autocomplete="off" />
        </div>
        <div class="field">
          <label for="lastName">Last name</label>
          <input class="text" id="lastName" name="lastName" value="${esc(draft.lastName)}" placeholder="e.g. Whitaker" autocomplete="off" />
        </div>
        <div class="field wide">
          <label for="stageName">Known as</label>
          <div class="row">
            <input class="text" id="stageName" name="stageName" value="${esc(draft.stageName ?? '')}" placeholder="e.g. ${draft.gender === 'female' ? 'Roxy Vain' : draft.gender === 'male' ? 'Johnny Vain' : 'Dusty Vain'}" autocomplete="off" />
            <button class="btn ghost" data-do="genStage">Suggest</button>
          </div>
        </div>
      </div>
      <p class="hint names-hint">The crowd chants your stage name. Contracts, landlords and gossip columns use the real one.</p>
      <div class="field">
        <span class="label">You are</span>
        <div class="chips">
          ${(['male', 'female', 'nonbinary'] as Gender[]).map((g) => `<button class="chip" data-do="gender" data-arg="${g}" ${pressed(draft.gender === g)}>${g === 'male' ? 'A man' : g === 'female' ? 'A woman' : 'Non-binary'}</button>`).join('')}
        </div>
      </div>
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
          ${(Object.keys(BACKGROUNDS) as Background[]).map((b) => `<button class="option" data-do="background" data-arg="${b}" ${pressed(draft.background === b)}><strong>${draft.gender === 'female' ? BACKGROUNDS[b].label.replace('Choirboy', 'Choirgirl') : draft.gender === 'nonbinary' ? BACKGROUNDS[b].label.replace('Choirboy', 'Choir kid') : BACKGROUNDS[b].label}</strong><span>${BACKGROUNDS[b].text}</span></button>`).join('')}
        </div>
      </div>
      <div class="field">
        <span class="label">Your sound</span>
        <div class="chips">
          ${GENRES.map((g) => `<button class="chip" data-do="style" data-arg="${g}" ${pressed(draft.style === g)}>${GENRE_LABEL[g]}</button>`).join('')}
        </div>
        <p class="hint">Your mates mostly share your taste. Mostly.</p>
      </div>
      <div class="field">
        <span class="label">The band</span>
        <div class="chips">
          ${(['full', 'trio', 'duo', 'solo'] as Lineup[]).map((l) => `<button class="chip" data-do="lineup" data-arg="${l}" ${pressed(draft.lineup === l)}>${l === 'full' ? 'You and three mates' : l === 'trio' ? 'You and two mates' : l === 'duo' ? 'You and one mate' : 'Just you'}</button>`).join('')}
        </div>
        <div class="chips">
          ${(['mixed', 'male', 'female'] as BandGender[]).map((g) => `<button class="chip" data-do="bandGender" data-arg="${g}" ${pressed(draft.bandGender === g)}>${g === 'mixed' ? 'Whoever turns up' : g === 'male' ? 'All men' : 'All women'}</button>`).join('')}
        </div>
        <p class="hint">${draft.lineup === 'solo' ? 'A singer with a notebook. You cannot gig until you have found a guitarist, a bassist and a drummer.' : draft.lineup === 'full' ? 'Guitar, bass and drums from the pub. Up to six in the van, keyboards welcome.' : 'The rest you find through adverts. Up to six in the van.'} ${draft.bandGender === 'mixed' ? 'Adverts bring whoever answers.' : draft.bandGender === 'male' ? 'Adverts bring men.' : 'Adverts bring women.'}</p>
      </div>
      <div class="field">
        <span class="label">How hard</span>
        <div class="chips">
          ${(['easy', 'normal', 'hard'] as Difficulty[]).map((d) => `<button class="chip" data-do="difficulty" data-arg="${d}" ${pressed(draft.difficulty === d)}>${d === 'easy' ? 'Trust fund' : d === 'normal' ? 'The dole' : 'Skint and talentless'}</button>`).join('')}
        </div>
        <p class="hint">${draft.difficulty === 'easy' ? 'Three times the money, a better band with more room to grow, you a notch sharper, and thirty friends who turn up to everything.' : draft.difficulty === 'hard' ? 'Half the money, no van, a weaker band with less in it, and you a notch duller.' : 'Two hundred quid, a rusty van, three uneven mates. The way it was.'}</p>
      </div>
      ${error ? `<p class="hint" role="alert" style="color:var(--bad)">${esc(error)}</p>` : ''}
      <button class="btn big" data-do="start">Form the band</button>
    </div>`;
}

// ---------------------------------------------------------------- game

function renderGame(s: GameState): string {
  const chem = chemistry(s);
  const pos = playerPosition(s.world, 'london');
  // The chart that matters most right now: the biggest one you are on, else London.
  const chartStat = (['world', 'us', 'uk', 'albums'] as const).map((c) => ({ c, p: playerPosition(s.world, c) })).find((x) => x.p !== null);
  const chartLabel = chartStat ? (chartStat.c === 'world' ? 'World chart' : chartStat.c === 'us' ? 'US chart' : chartStat.c === 'uk' ? 'UK chart' : 'Albums chart') : 'London chart';
  const chartPos = chartStat ? chartStat.p : pos;
  return `
    <header class="top">
      <div>
        <h1 class="bandname">${esc(s.bandName)}</h1>
        <p class="when">${dateLabel(s.week)}. <a href="#" data-do="newGame">New game</a> <span class="version">v${__APP_VERSION__}</span> <a href="#" data-do="pace" title="How fast the week's report is read out. Any click shows it all at once.">${pace === 'relaxed' ? 'Pace: relaxed' : 'Pace: brisk'}</a> <a href="#" data-do="debug" class="debug-toggle" title="Development aid: shows true values and hidden changes. * marks values you would not know yet.">${debug ? 'Debug on' : 'Debug off'}</a>${debug ? ' <a href="#" data-do="exportSave" title="Copy the whole save to the clipboard, or download it, to send for analysis.">Export save</a>' : ''}</p>
      </div>
      <dl class="stats">
        <div><dt>${tip('Money', 'money')}</dt><dd class="${s.money < 0 ? 'neg' : ''}" data-stat="money">${s.money < 0 ? '-' : ''}£${Math.abs(s.money)}</dd></div>
        <div><dt>${tip('Fans', 'fans')}</dt><dd data-stat="fans">${s.fans}</dd></div>
        <div><dt>${tip('Buzz', 'buzz')}</dt><dd data-stat="buzz">${s.buzz}</dd></div>
        <div title="Style ${chem.style}, relationships ${chem.affinity}, mood ${chem.mood}${chem.knownEgoPenalty ? `, egos -${chem.knownEgoPenalty}` : ''}"><dt>${tip('Chemistry', 'chemistry')}</dt><dd>${chem.total}</dd></div>
        <div><dt>${tip('Tightness', 'tightness')}</dt><dd data-stat="tightness">${s.tightness}</dd></div>
        <div title="${chartStat ? 'Your best record on the biggest chart it is on. London gigs chart until then.' : ''}"><dt>${chartStat ? chartLabel : tip('London chart', 'londonchart')}</dt><dd>${chartPos ? `#${chartPos}` : '-'}</dd></div>
      </dl>
      ${bandPulse(s)}
    </header>
    <div class="layout">
      ${zone(s)}
      <aside class="panel">
        <div class="tabs" role="tablist">
          ${(['band', 'label', 'charts', 'records', 'history'] as PanelTab[]).map((t) => `<button role="tab" class="tab" data-do="tab" data-arg="${t}" aria-selected="${panelTab === t}">${PANEL_LABEL[t]}${(t === 'band' && s.candidates.length) || (t === 'label' && s.offers.length) ? ` <span class="dot" aria-label="${t === 'band' ? 'auditions waiting' : 'offers waiting'}"></span>` : ''}</button>`).join('')}
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
      ${flags.length ? `<button class="flags" data-do="tab" data-arg="band" title="Open the band tab">${flags.map((f) => `<span class="flag">${esc(f)}</span>`).join('')}</button>` : ''}
      <p class="band-word">${esc(bandWord(s))}</p>
    </div>`;
}

type PanelTab = 'band' | 'label' | 'charts' | 'records' | 'history';
const PANEL_LABEL: Record<PanelTab, string> = { band: 'The band', label: 'Business', charts: 'Charts', records: 'Songs & records', history: 'History' };

function panelBody(s: GameState): string {
  switch (panelTab) {
    case 'band':
      return `
        ${s.candidates.length ? `<h3 class="sub">Auditions: ${ROLE_LABEL[s.candidateRole!].toLowerCase()} <button class="btn ghost small" data-do="dismiss">Send them home</button></h3><div class="cards">${s.candidates.map((c) => card(s, c, true)).join('')}</div><h3 class="sub">Your band</h3>` : ''}
        <div class="cards">${s.members.map((m) => card(s, m)).join('')}</div>
        ${chemPanel(s)}`;
    case 'charts':
      return chartsSection(s);
    case 'label':
      return labelSection(s);
    case 'records':
      return recordsSection(s) || '<p class="hint">No songs yet. Write some.</p>';
    case 'history': {
      const views = `<div class="chips">${(['milestones', 'all'] as const).map((v) => `<button class="chip" data-do="historyView" data-arg="${v}" aria-pressed="${historyView === v}">${v === 'milestones' ? 'Milestones' : 'Everything'}</button>`).join('')}</div>`;
      return views + (historyView === 'milestones' ? lineupBlock(s) + toursBlock(s) + awardsBlock(s) + letterbox(s) + milestoneList(s) : logList(s, () => true));
    }
  }
}

const getOn = (v: number) => (v >= 40 ? 'close mates' : v >= 10 ? 'get on' : v > -10 ? 'no strong feelings' : v > -40 ? 'tense' : "can't stand each other");
const taste = (v: number) => (v >= 80 ? 'same taste' : v >= 50 ? 'tastes fit' : 'tastes clash');

/** FIFA-style team chemistry: the band as a web of links, green, amber or red. */
function chemPanel(s: GameState): string {
  if (s.members.length < 2) return '';
  const chem = chemistry(s);
  const { links, members } = chemistryLinks(s);
  const byId = new Map(s.members.map((m) => [m.id, m]));
  const n = s.members.length;
  const W = 420, H = 320, cx = W / 2, cy = H / 2 - 6, r = Math.min(W, H) / 2 - 52;
  const pos = new Map(s.members.map((m, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [m.id, { x: cx + r * 1.25 * Math.cos(a), y: cy + r * Math.sin(a) }];
  }));
  const name = (id: string) => { const m = byId.get(id)!; return m.isPlayer ? 'You' : first(m); };
  const why = (l: (typeof links)[number]) => `${taste(l.style)}, ${getOn(l.affinity)}${l.clash ? ', ego clash' : ''}`;
  const lines = links.map((l) => {
    const p = pos.get(l.a)!, q = pos.get(l.b)!;
    return `<line class="cl ${l.tone}" x1="${p.x.toFixed(1)}" y1="${p.y.toFixed(1)}" x2="${q.x.toFixed(1)}" y2="${q.y.toFixed(1)}"><title>${esc(`${name(l.a)} & ${name(l.b)}: ${l.score} (${why(l)})`)}</title></line>`;
  }).join('');
  const nodes = members.map((cm) => {
    const p = pos.get(cm.id)!;
    const m = byId.get(cm.id)!;
    const tone = cm.dots >= 2 ? 'good' : cm.dots === 1 ? 'ok' : 'bad';
    const dots = [0, 1, 2].map((i) => `<circle cx="${(p.x - 12 + i * 12).toFixed(1)}" cy="${(p.y + 50).toFixed(1)}" r="4" class="cd ${i < cm.dots ? tone : 'off'}"/>`).join('');
    return `<g><title>${esc(`${name(cm.id)}: chemistry ${cm.score}, mood ${m.mood}`)}</title><circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="20" class="cn ${tone}"/><text x="${p.x.toFixed(1)}" y="${(p.y + 5).toFixed(1)}" class="cs">${cm.score}</text><text x="${p.x.toFixed(1)}" y="${(p.y + 38).toFixed(1)}" class="ct">${esc(name(cm.id))}</text>${dots}</g>`;
  }).join('');
  const rows = [...links].sort((x, y) => x.score - y.score).map((l) =>
    `<li class="${l.tone}"><span class="lk">${esc(name(l.a))} & ${esc(name(l.b))}</span><b>${l.score}</b><span class="why">${esc(why(l))}</span></li>`).join('');
  const part = (label: string, v: number, k: string) => `<div><span>${tip(label, k)}</span><b>${v}</b></div>`;
  return `
    <h3 class="sub chem-title">Chemistry</h3>
    <div class="chem">
      <svg viewBox="0 0 ${W} ${H}" class="chemweb" role="img" aria-label="Band chemistry links">${lines}${nodes}</svg>
      <div class="chemside">
        <div class="chemtotal"><span>Band chemistry</span><b>${chem.total}</b></div>
        <div class="chemparts">${part('Taste', chem.style, 'chemistry')}${part('Relationships', chem.affinity, 'chemistry')}${part('Mood', chem.mood, 'chemistry')}${chem.knownEgoPenalty ? `<div class="bad"><span>Egos</span><b>-${chem.knownEgoPenalty}</b></div>` : ''}</div>
        <ul class="chemlinks">${rows}</ul>
        <p class="hint">Green links lift the whole band, red ones drag it down. Parties, time together and shared success mend links; feuds and big egos break them.</p>
      </div>
    </div>`;
}

const money = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;
const TIER_SHOWN: Record<LabelTier, string> = { indie: 'Independent', shark: 'Independent', major: 'Major label' };

function termsList(t: DealTerms, read: boolean): string {
  const p = t.smallPrint;
  const traps = [p.deductions > 0 && `${Math.round(p.deductions * 100)}% of royalties go on "deductions"`, p.tourRecoup && 'tour profits go to the label until you recoup', p.ownsName && 'the label owns the band name', p.promoRecoup && 'promotion and videos are charged to you'].filter(Boolean) as string[];
  return `
    <dl class="deal">
      <div><dt>Advance</dt><dd>${money(t.advance)}</dd></div>
      <div><dt>Royalty</dt><dd>${Math.round(t.rate * 100)}%${read ? ` <small>(${money(royaltyPerCopy(t, 'album') * 100)} per 100 albums)</small>` : ''}</dd></div>
      <div><dt>Albums owed</dt><dd>${t.albums}</dd></div>
      <div><dt>Recording budget</dt><dd>${money(t.budget)} per album</dd></div>
    </dl>
    <p class="smallprint">${read ? (traps.length ? `<strong>Small print:</strong> ${esc(traps.join('; '))}.` : '<strong>Small print:</strong> nothing nasty. Rare.') : '<strong>Small print:</strong> unread. Everyone signs without reading. Everyone regrets it.'}</p>`;
}

/** Record deals: offers on the table, or the contract you are stuck with. */
/** A manager's face, in five flavours: the coat, the tie, the carrier bag, the big coat, the beret. */
function portrait(kind: ManagerKind): string {
  const base = (extra: string, hair: string) => `<svg class="portrait" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="pg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff3d8b"/><stop offset="1" stop-color="#8fe3f0"/></linearGradient></defs><rect width="64" height="64" rx="12" fill="rgba(255,255,255,0.06)"/><circle cx="32" cy="26" r="11" fill="#e9d7f2"/>${hair}<path d="M12 60c2-14 10-20 20-20s18 6 20 20z" fill="url(#pg)"/>${extra}</svg>`;
  switch (kind) {
    case 'hustler': return base('<path d="M12 60c2-14 10-20 20-20s18 6 20 20z" fill="#c98a3c" opacity="0.85"/><rect x="26" y="40" width="12" height="20" fill="#e9d7f2"/><rect x="40" y="30" width="4" height="12" rx="1" fill="#222"/>', '<path d="M20 24c0-9 24-9 24 0c0-3-2-6-12-6s-12 3-12 6z" fill="#5a3b2e"/>');
    case 'suit': return base('<path d="M12 60c2-14 10-20 20-20s18 6 20 20z" fill="#2b2f4a"/><path d="M30 40h4l-2 16z" fill="#ff3d8b"/><rect x="14" y="52" width="14" height="9" rx="1" fill="#3a2a1a"/>', '<path d="M22 22c2-8 18-8 20 0c-3-2-5-3-10-3s-7 1-10 3z" fill="#444"/><rect x="21" y="23" width="22" height="2" fill="#222" opacity="0.6"/>');
    case 'nanny': return base('<path d="M12 60c2-14 10-20 20-20s18 6 20 20z" fill="#5a7d6b"/><rect x="42" y="46" width="10" height="12" rx="2" fill="#f5efe6"/><rect x="45" y="44" width="4" height="3" fill="#333"/>', '<path d="M19 26c0-12 26-12 26 0c0 4-3 6-4 4c-2-6-16-6-18 0c-1 2-4 0-4-4z" fill="#a0522d"/>');
    case 'godfather': return base('<path d="M8 62c2-18 12-24 24-24s22 6 24 24z" fill="#1a1a1a"/><path d="M26 38h12v6l-6 4l-6-4z" fill="#f5efe6"/>', '<path d="M22 20c2-6 18-6 20 0c0 2-20 2-20 0z" fill="#111"/><rect x="21" y="22" width="22" height="4" rx="1" fill="#111"/>');
    default: return base('<path d="M12 60c2-14 10-20 20-20s18 6 20 20z" fill="#3a1f4a"/><rect x="22" y="44" width="20" height="3" fill="#ffb36b"/>', '<ellipse cx="30" cy="16" rx="14" ry="5" fill="#8b1e5c"/><path d="M19 22c0-10 26-10 26 0z" fill="#8b1e5c"/>');
  }
}

function managerBlock(s: GameState): string {
  const m = s.manager;
  if (!m) return `<h3 class="sub">Manager</h3><p class="hint">No manager. You book your own gigs and haggle with labels yourselves. Managers find you once you have a following.</p>`;
  const cost = sackCost(s);
  return `<h3 class="sub">Manager</h3>
    <article class="deal-card">
      <div class="mgr-head">${portrait(m.kind ?? 'hustler')}<div><h3>${esc(m.name)}</h3>
      <p class="hint">${esc(managerCard(m).kind)} ${esc(managerCard(m).past)}</p></div></div>
      <div class="mgr-stats">${([['Clout', m.clout, managerCard(m).clout], ['Care', m.care ?? 30, managerCard(m).care], ['Nous', m.nous ?? 40, managerCard(m).nous]] as [string, number, string][]).map(([k, v, w]) => `<div class="mgr-stat"><span class="lbl">${k} <strong>${v}</strong></span><div class="bar"><i style="width:${v}%"></i></div><small class="lbl">${esc(w)}</small></div>`).join('')}</div>
      <dl class="deal">
        <div><dt>Commission</dt><dd>${Math.round(m.cut * 100)}% of everything</dd></div>
        <div><dt>Taken so far</dt><dd>${money(m.taken)}</dd></div>
        <div><dt>Contract</dt><dd>${m.read ? 'Read by a solicitor' : 'Nobody read it'}</dd></div>
      </dl>
      <p class="hint">What they do, unasked: specials in the gig menu, the telly, a word about the weak link, the label leaned on, stories kept out of the papers, the dangerous one sent home. Clout: +${Math.round(m.clout / 1.5)}% on gig money, labels listen. Nous: ${Math.round((m.nous ?? 40) / 4)}% off studio bills.${m.kind === 'godfather' ? ' Leaving costs three times the usual.' : ''}${m.kind === 'visionary' ? ' Spends on the concept now and then.' : ''}</p>
      <div class="card-foot"><button class="btn ghost" data-do="sackManager" ${s.money < cost ? 'disabled' : ''}>${armedSack ? `Really pay ${money(cost)} to sack them?` : `Sack: ${money(cost)} pay-off`}</button></div>
    </article>`;
}

const MOOD_WORD = (g: number) => (g >= 75 ? 'They love you' : g >= 50 ? 'Warm' : g >= 30 ? 'Cooling' : 'Frosty: one more flop and you are out');

/** The good life: what a rock star buys, and what it costs to keep. */
function goodLifeBlock(s: GameState): string {
  const list = shopWindow(s);
  if (!list.length) return '';
  const kinds = (['home', 'car', 'bling', 'folly', 'company'] as ToyKind[]).filter((k) => list.some((t) => t.kind === k));
  const own = new Set((s.toys ?? []).map((t) => t.id));
  const groups = kinds.map((k) => `<p class="lbl toy-kind">${TOY_KIND[k]}</p><div class="choices">${list.filter((t) => t.kind === k).map((t) => {
    const has = own.has(t.id);
    const why = has ? null : toyLocked(s, t);
    const back = Math.round(t.price * t.resale);
    const btn = has
      ? `<button class="choice owned" data-do="sellToy" data-arg="${t.id}"><span class="choice-head"><strong>${esc(t.name)}</strong><span class="cost free">${t.weekly ? `${money(t.weekly)} / wk` : 'yours'}</span></span><span class="choice-hint">${esc(t.word)} ${armedSell === t.id ? `Really ${t.kind === 'company' ? 'end it' : `sell for ${money(back)}`}?` : t.resale ? `Tap to sell: ${money(back)}.` : 'Tap to end it.'}</span></button>`
      : `<button class="choice" data-do="buyToy" data-arg="${t.id}" ${why ? 'disabled' : ''}><span class="choice-head"><strong>${esc(t.name)}</strong><span class="cost">${t.price ? money(t.price) : 'no fee'}${t.weekly ? ` + ${money(t.weekly)} / wk` : ''}</span></span><span class="choice-hint">${esc(why ?? t.word)}</span></button>`;
    return btn;
  }).join('')}</div>`).join('');
  return `<h3 class="sub">The good life</h3>
    <p class="hint">What the money is for. Everything here goes on your card, costs something every week, and makes the others wonder why it is not theirs. Homes rest you; the big ones rest the band.</p>
    ${groups}`;
}

/** Where the money goes: the weekly bill, line by line, so the player sees what fame costs. */
function moneyBlock(s: GameState): string {
  const base = 10 + s.members.length * 6;
  const all: [string, number, string][] = [
    ['Rent and food', base + (s.flags.rentUp ?? 0), s.flags.rentUp ? 'The landlord put it up, or the entourage did.' : 'A rehearsal room above a kebab shop.'],
    ['Wages, crew and flats', Math.round(s.fans * 0.02), 'Grows with the fan base. Fame has staff.'],
    ['Habits', viceBill(s), 'What the band puts up its nose and down its neck.'],
    ['Living like a star', splurge(s), 'Two per cent of everything over £20,000, every week.'],
    ['The good life', toyUpkeep(s), toyLine(s) || 'Nothing yet.'],
  ];
  const rows = all.filter((r) => r[1] > 0);
  const total = upkeep(s);
  const debt = s.contract ? s.contract.unrecouped : 0;
  const points = s.flags.producerPoints ?? 0;
  return `<h3 class="sub">Where the money goes</h3>
    <article class="deal-card">
      <dl class="deal">
        ${rows.map(([k, v, why]) => `<div title="${esc(why)}"><dt>${esc(k)}</dt><dd>${money(v)} / week</dd></div>`).join('')}
        <div title="${esc(WHEELS[wheelsOf(s)].word)}"><dt>Wheels</dt><dd>${esc(WHEELS[wheelsOf(s)].name)}</dd></div>
        ${s.studio ? `<div title="${esc(STUDIOS[s.studio].word)}"><dt>Studio</dt><dd>${esc(STUDIOS[s.studio].name)}, +${STUDIOS[s.studio].quality} on records, £${STUDIOS[s.studio].rent.toLocaleString('en-GB')}/wk hire when idle</dd></div>` : ''}
        <div title="Average of everyone's instruments. Better gear from the Rehearse menu, or when someone asks."><dt>The band's kit</dt><dd>${bandKit(s)}, ${esc(KIT_WORD(bandKit(s)))}</dd></div>
        <div title="PA, amps and lights of your own. Big venues supply their own; pubs do not."><dt>Backline</dt><dd>${['Borrowed', 'A PA and a stack', 'Decent backline', 'A proper rig', 'A lorry of lights', 'Stadium rig'][Math.min(5, s.gear ?? 0)]}</dd></div>
        ${s.flags.fanClub !== undefined ? `<div title="${s.flags.fanClubInHouse ? 'Run from your own office: every penny is yours.' : 'Run from a spare room for a 30% cut.'}"><dt>Fan club</dt><dd>${clubMembers(s).toLocaleString('en-GB')} members, ${money(Math.round(clubIncome(s) * (s.flags.fanClubInHouse ? 1 : 0.7)))} / week</dd></div>` : ''}
        ${s.flags.shark ? `<div title="Half of everything above £50 goes to Tony's collector every week, and the rest grows 3% a week. His lads call round after twelve weeks."><dt>Owed to Big Tony</dt><dd class="neg">${money(s.flags.shark)}</dd></div>` : ''}
        ${s.flags.patron !== undefined ? `<div title="An envelope every Friday, for as long as you are interesting."><dt>The admirer's allowance</dt><dd>${money(Math.round(60 + s.fans * 0.02))} / week</dd></div>` : ''}
        <div><dt>Every week, all in</dt><dd class="${total > 500 ? 'neg' : ''}">${money(total)}</dd></div>
        ${s.manager ? `<div><dt>Manager's cut</dt><dd>${Math.round(s.manager.cut * 100)}% of all income</dd></div>` : ''}
        ${debt ? `<div><dt>Owed to the label</dt><dd class="neg">${money(debt)}</dd></div>` : ''}
        ${points ? `<div><dt>Producer points</dt><dd>${points}% off every royalty</dd></div>` : ''}
        <div><dt>Tax</dt><dd>40% of the year's gain over £5,000, every April</dd></div>
      </dl>
      <p class="hint">Videos, producers and the label's studio bills go on the tab, not the weekly bill. Eccentric purchases go wherever the drummer parks them.</p>
    </article>`;
}

function labelSection(s: GameState): string {
  return labelDeals(s) + managerBlock(s) + splitBlock(s) + crewBlock(s) + goodLifeBlock(s) + moneyBlock(s) + incomeBlock(s);
}

/** Crew, hangers-on and the payroll. */
function crewBlock(s: GameState): string {
  const list = entourage(s);
  if (!list.length) return '';
  const rows = list.map((h) => `<tr><td><strong>${esc(h.name)}</strong><br><small class="lbl">${esc(h.role)}</small></td><td class="wrap">${esc(h.effect)}${h.leaving && h.sackable ? `<br><small class="lbl">If they go: ${esc(h.leaving)}</small>` : ''}</td><td>${h.weekly ? money(h.weekly) + ' / wk' : ''}</td><td>${h.sackable ? `<button class="btn ghost small" data-do="sackHanger" data-arg="${h.id}">${armedHanger === h.id ? 'Really?' : 'Let go'}</button>` : ''}</td></tr>`);
  return `<h3 class="sub">Around the band</h3>
    <div class="chart-wrap"><table class="chart ledger crew"><thead><tr><th>Who</th><th>What they do</th><th>Cost</th><th></th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}

/** The band deal: who gets what on paper. */
function splitBlock(s: GameState): string {
  const split = s.split ?? 'equal';
  const rec = shares(s, 'albums');
  const gig = shares(s, 'gigs');
  const w = writerShares(s);
  const pct = (v: number | undefined) => `${Math.round((v ?? 0) * 100)}%`;
  const rows = s.members.map((m) => `<tr><td><strong>${esc(m.isPlayer ? 'You' : first(m))}</strong></td><td>${pct(gig[m.id])}</td><td>${pct(rec[m.id])}</td><td>${pct(w[m.id])}</td><td>£${Math.round(m.earned ?? 0).toLocaleString('en-GB')}</td></tr>`);
  const old = [...(s.alumni ?? [])].filter((a) => (a.earned ?? 0) > 0).reverse().slice(0, 4).map((a) => `<tr class="out"><td>${esc(a.name)}</td><td></td><td></td><td></td><td>£${Math.round(a.earned ?? 0).toLocaleString('en-GB')}</td></tr>`);
  return `<h3 class="sub">The band deal</h3>
    <div class="chips">${(['equal', 'writers', 'leader'] as Split[]).map((x) => `<button class="chip" data-do="setSplit" data-arg="${x}" aria-pressed="${split === x}" title="${esc(SPLIT_WORD[x])}">${SPLIT_LABEL[x]}</button>`).join('')}</div>
    <p class="hint">${esc(SPLIT_WORD[split])} Changing it costs you with whoever loses by it.</p>
    <div class="chart-wrap"><table class="chart ledger"><thead><tr><th>Who</th><th>Gigs</th><th>Records</th><th>Wrote</th><th>Earned</th></tr></thead><tbody>${rows.join('')}${old.join('')}</tbody></table></div>
    <p class="hint">Paper shares of one shared bank account: what each would walk away with. Former members take their share with them.</p>`;
}

/** Where the money came from, year by year. */
function incomeBlock(s: GameState): string {
  const years = Object.keys(s.ledger ?? {}).sort();
  if (!years.length) return '';
  const cols: [IncomeKind, string][] = [['gigs', 'Gigs'], ['tours', 'Tours'], ['merch', 'Merch'], ['fanclub', 'Fan club'], ['singles', 'Singles'], ['eps', 'EPs'], ['albums', 'Albums'], ['royalties', 'Royalties'], ['advances', 'Advances'], ['other', 'Other']];
  const used = cols.filter(([k]) => years.some((y) => (s.ledger[y][k] ?? 0) > 0));
  const sum = (y: string) => used.reduce((a, [k]) => a + (s.ledger[y][k] ?? 0), 0);
  const tot = (k: IncomeKind) => years.reduce((a, y) => a + (s.ledger[y][k] ?? 0), 0);
  const k = (n: number) => (n >= 1000000 ? `£${(n / 1000000).toFixed(1)}m` : n >= 10000 ? `£${Math.round(n / 1000)}k` : n > 0 ? `£${n.toLocaleString('en-GB')}` : '');
  const units: [IncomeKind, string][] = [['u_single', 'Singles'], ['u_ep', 'EPs'], ['u_album', 'Albums']];
  const anyUnits = units.some(([u]) => tot(u) > 0);
  const n = (v: number) => (v > 0 ? v.toLocaleString('en-GB') : '');
  return `<h3 class="sub">Where the money came from</h3>
    <div class="chart-wrap">
      <table class="chart ledger">
        <thead><tr><th>Year</th>${used.map(([, l]) => `<th>${l}</th>`).join('')}<th>Total</th></tr></thead>
        <tbody>
          ${years.map((y) => `<tr><td>${y}</td>${used.map(([c]) => `<td>${k(s.ledger[y][c] ?? 0)}</td>`).join('')}<td><strong>${k(sum(y))}</strong></td></tr>`).join('')}
          ${years.length > 1 ? `<tr class="me"><td>All</td>${used.map(([c]) => `<td>${k(tot(c))}</td>`).join('')}<td><strong>${k(years.reduce((a, y) => a + sum(y), 0))}</strong></td></tr>` : ''}
        </tbody>
      </table>
    </div>
    ${anyUnits ? `<h3 class="sub">Copies sold</h3>
    <div class="chart-wrap">
      <table class="chart ledger">
        <thead><tr><th>Year</th>${units.map(([, l]) => `<th>${l}</th>`).join('')}</tr></thead>
        <tbody>
          ${years.map((y) => `<tr><td>${y}</td>${units.map(([u]) => `<td>${n(s.ledger[y][u] ?? 0)}</td>`).join('')}</tr>`).join('')}
          ${years.length > 1 ? `<tr class="me"><td>All</td>${units.map(([u]) => `<td>${n(tot(u))}</td>`).join('')}</tr>` : ''}
        </tbody>
      </table>
    </div>` : ''}
    <p class="hint">Gross, before the manager's cut and the label's tab. Label records count the copies the label shifted; the money from those arrives as royalties, if it ever does.</p>`;
}

function labelDeals(s: GameState): string {
  const note = labelNote ? `<p class="label-note">${emph(labelNote)}</p>` : '';
  if (s.contract) {
    const c = s.contract;
    const l = labelById(c.label);
    const cost = buyoutCost(s);
    const nextStatement = 13 - ((s.week - c.signed) % 13);
    return `${note}
      <article class="deal-card signed">
        <span class="deal-tier">${TIER_SHOWN[l.tier]}</span>
        <h3>${esc(l.name)}</h3>
        <p class="hint">${esc(l.word)}</p>
        ${termsList(c.terms, true)}
        <dl class="deal">
          <div><dt>Albums delivered</dt><dd>${c.albumsDelivered} of ${c.terms.albums}</dd></div>
          <div title="Advance, recording budgets, videos and promo on the label's tab. Paid back only out of royalties, never out of your bank."><dt>Unrecouped on the tab</dt><dd class="${c.unrecouped > 0 ? 'neg' : ''}">${money(c.unrecouped)}</dd></div>
          <div><dt>Next royalty statement</dt><dd>${nextStatement} week${nextStatement === 1 ? '' : 's'}</dd></div>
          <div><dt>The label's mood</dt><dd class="${c.goodwill < 30 ? 'neg' : ''}">${MOOD_WORD(c.goodwill)}</dd></div>
        </dl>
        <p class="hint">Royalties pay off the advance and every recording bill first. Only after that do you see a cheque. The tab is not a debt you can be chased for: it only decides whether the cheque is £0. Tour and gig money is yours, unless the small print says otherwise.</p>
        <div class="card-foot">
          <button class="btn ghost" data-do="buyOut" ${s.money < cost ? 'disabled' : ''}>${armedBuyout ? `Really pay ${money(cost)} to leave?` : `Buy yourself out: ${money(cost)}`}</button>
          ${c.statements ? `<button class="btn ghost" data-do="audit" ${s.money < AUDIT_FEE ? 'disabled' : ''} title="Accountants go through the label's books. Crooks pay up. Every label hates it.">Audit the label: ${money(AUDIT_FEE)}</button>` : ''}
        </div>
      </article>${s.offers.length ? `<h3 class="sub">Somebody wants to poach you</h3>${offerCards(s)}` : ''}`;
  }
  if (!s.offers.length) {
    return `${note}<p class="hint">No label wants you yet. They watch fans, buzz and the charts. The small independents start sniffing at a few hundred fans and some buzz; the majors only call when the whole town is talking. The first offers tend to come from the people you should trust least.</p>`;
  }
  return `${note}${offerCards(s)}`;
}

function offerCards(s: GameState): string {
  return s.offers.map((o) => {
    const l = labelById(o.label);
    const left = o.expires - s.week;
    return `
      <article class="deal-card">
        <span class="deal-tier">${TIER_SHOWN[l.tier]}</span>
        <h3>${esc(l.name)}</h3>
        <p class="hint">Word on the street: ${esc(l.word)}</p>
        ${termsList(o.terms, o.read)}
        ${o.buyout ? `<p class="smallprint"><strong>Buyout:</strong> they pay your current label ${money(o.buyout)}, and it goes on your new tab.</p>` : ''}
        <p class="hint">Offer open for ${left} more week${left === 1 ? '' : 's'}.</p>
        <div class="card-foot">
          <button class="btn" data-do="offerSign" data-arg="${o.id}">Sign</button>
          ${o.haggled >= 2 ? '<button class="btn ghost" disabled>Final offer</button>' : (['advance', 'rate', 'albums', 'budget'] as Ask[]).map((a) => `<button class="btn ghost" data-do="offerHaggle" data-arg="${o.id}" data-arg2="${a}" title="${esc(ASK_HINT[a])}" ${a === 'albums' && o.terms.albums <= 1 ? 'disabled' : ''}>${ASK_LABEL[a]}</button>`).join('')}
          ${o.read ? '' : `<button class="btn ghost" data-do="offerRead" data-arg="${o.id}" ${s.money < LAWYER_FEE ? 'disabled' : ''}>Lawyer reads it: ${money(LAWYER_FEE)}</button>`}
          <button class="btn ghost" data-do="offerDecline" data-arg="${o.id}">Turn down</button>
        </div>
      </article>`;
  }).join('');
}

const KIND_LABEL: Record<string, string> = {
  tour: 'On tour', gig: 'Live tonight', rehearse: 'Rehearsal', write: 'Songwriting', release: 'In the studio', party: 'Night out',
  rest: 'Time off', advertise: 'Auditions', event: 'Situation', start: 'Previously',
};

/** The action zone: last week played back line by line, its effects, then what to do next. */
function zone(s: GameState): string {
  const sc = s.scene;
  const playing = !!sc && sc.id !== playedScene && !reducedMotion();
  // Paced like reading: longer lines stay on their own longer. Gigs and trips linger a little more.
  const mood = sc?.vibe === 'gig' || sc?.vibe === 'wasted' ? 1.15 : sc?.vibe === 'trip' ? 1.25 : 1;
  const speed = pace === 'relaxed' ? 1 : 0.45;
  const readTime = (text: string) => Math.min(6.5, Math.max(2, text.length / 18)) * mood * speed;
  const main = sc ? sc.beats.filter((b) => !b.late) : [];
  const late = sc ? sc.beats.filter((b) => b.late) : [];
  let t = 0.3;
  const delay = (b: Beat) => { const d = t; t += readTime(b.text); return d; };
  const beatLi = (b: Beat) => `<li class="beat ${b.tone}" data-d="${delay(b).toFixed(2)}">${b.time ? `<span class="t">${esc(b.time)}</span>` : '<span class="t"></span>'}<span class="txt">${emph(b.text)}</span></li>`;
  const mainHtml = main.map(beatLi).join('');
  const fxDelay = t + 1.2 * speed;
  t = fxDelay + 3.2 * speed;
  const lateHtml = late.length ? `<div class="later" data-d="${t.toFixed(2)}"><h3>Later that week</h3><ul>${late.map((b) => `<li class="${b.tone}">${esc(b.text)}</li>`).join('')}</ul></div>` : '';
  if (late.length) t += Math.max(2.5, late.reduce((a, b) => a + readTime(b.text) * 0.75, 0));
  const nextDelay = t;
  const collapsed = !!sc && !playing && collapsedScene === sc.id;
  if (collapsed && sc) {
    const band = sc.effects.filter((e) => e.who === null);
    return `
    <section id="zone" class="zone vibe-${sc.vibe}" aria-live="polite">
      <div class="screen folded">
        <div class="screen-head">
          <div><span class="kicker">${KIND_LABEL[sc.kind]}</span><h2>${esc(sc.title)}</h2></div>
          <button class="btn ghost small" data-do="unfold" aria-expanded="false">Show report</button>
        </div>
        ${band.length ? `<div class="fx fx-mini">${effectChips(band)}</div>` : ''}
      </div>
      <div class="next">${nextBlock(s)}</div>
    </section>`;
  }
  return `
    <section id="zone" class="zone vibe-${sc?.vibe ?? 'quiet'} ${playing ? 'playing' : ''}" aria-live="polite">
      <div class="screen">
        <div class="screen-head">
          <div><span class="kicker">${KIND_LABEL[sc?.kind ?? 'start']}</span><h2>${esc(sc?.title ?? s.bandName)}</h2></div>
          ${playing ? '<button class="btn ghost small skip" data-do="skip">Skip</button>' : ''}
          ${sc ? `<button class="btn ghost small fold" data-do="fold" aria-expanded="true" ${playing ? 'hidden' : ''}>Hide report</button>` : ''}
        </div>
        <ol class="beats">${mainHtml}</ol>
        ${sc ? headlineRow(sc, fxDelay) : ''}
        ${sc && (sc.effects.length || (debug && sc.hidden)) ? `<div class="fx" data-d="${(fxDelay + 0.6).toFixed(2)}">${effectChips(sc.effects)}${debug && sc.hidden ? `<p class="hidden-fx">${esc(sc.hidden)}</p>` : ''}</div>` : ''}
        ${lateHtml}
      </div>
      <div class="next" data-d="${nextDelay.toFixed(2)}">${nextBlock(s)}</div>
    </section>`;
}

/** Big headline: verdict, key figures and the band's money, fans and buzz. */
function headlineRow(sc: Scene, at: number): string {
  const tiles: string[] = [];
  if (sc.verdict) tiles.push(`<div class="hl verdict ${sc.verdict.tone}"><span>Verdict</span><b>${esc(sc.verdict.text)}</b></div>`);
  for (const st of sc.stats ?? []) tiles.push(`<div class="hl${/^\+[1-9]/.test(st.value) ? ' good' : /^-[1-9]/.test(st.value) ? ' bad' : ''}"><span>${esc(st.label)}</span><b>${esc(st.value)}</b>${st.sub ? `<small>${esc(st.sub)}</small>` : ''}</div>`);
  for (const e of sc.effects.filter((x) => x.who === null && ['money', 'fans', 'buzz'].includes(x.stat))) {
    const val = e.stat === 'money' ? `${e.delta > 0 ? '+' : '-'}£${Math.abs(e.delta).toLocaleString('en-GB')}` : `${e.delta > 0 ? '+' : ''}${e.delta.toLocaleString('en-GB')}`;
    tiles.push(`<div class="hl ${e.delta > 0 ? 'good' : 'bad'}"><span>${e.stat === 'money' ? 'Money' : e.stat === 'fans' ? 'Fans' : 'Buzz'}</span><b>${val}</b></div>`);
  }
  // Revealed after the last line of commentary: the final score.
  return tiles.length ? `<div class="headline" data-d="${at.toFixed(2)}">${tiles.join('')}</div>` : '';
}

/** Make the facts in a line of commentary stand out: money, numbers, chart places and song titles. */
function emph(text: string): string {
  return text
    .split(/(£-?[\d,]+|#\d+|"[^"]{1,60}"|\b\d[\d,]*\b)/)
    .map((part, i) => (i % 2 === 0 ? esc(part) : part.startsWith('"') ? `<em class="song">${esc(part)}</em>` : `<b class="num">${esc(part)}</b>`))
    .join('');
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
    return `<div class="over"><h2>${s.over.died ? (s.over.won ? 'Gone, and immortal' : 'Gone too soon') : s.over.won ? (s.over.reason.includes('walked away') ? 'Rock gods. Retired.' : 'You made it. Sort of.') : 'The end of the road'}</h2><p>${esc(s.over.reason)}</p><button class="btn" data-do="newGame">Start again</button>${canComeBack(s) ? '' : `<button class="btn ghost" data-do="comeBack">${armedComeback ? 'Really? Two years on, one more album.' : 'The comeback'}</button>`}</div>`;
  }
  const ev = eventCard(s);
  if (ev) return ev;
  if (s.tour) return tourPanel(s);
  const missing = missingForGig(s);
  const subs: Record<ActionType, string> = {
    gig: missing.length ? `Need ${missing.join(' and ')}` : bestVenue(s.fans).name.split(',')[0],
    rehearse: `Tightness ${s.tightness}`,
    write: s.songs.length ? `${s.songs.length} original${s.songs.length === 1 ? '' : 's'}${unreleasedCount(s) < 8 ? `, ${8 - unreleasedCount(s)} more for an album` : `, ${unreleasedCount(s)} unreleased`}` : 'Covers only',
    release: `${s.releases.length ? `${s.releases.length} out, ` : ''}${unreleasedCount(s)} unreleased song${unreleasedCount(s) === 1 ? '' : 's'}`,
    party: 'Morale up, livers down',
    rest: 'Recharge, dry out',
    advertise: missing.length ? `Find ${missing.join(' and ')}` : 'Replace or add a player',
    tour: tourSub(s),
  };
  const types: ActionType[] = ['gig', 'tour', 'rehearse', 'write', 'release', 'party', 'rest', 'advertise'];
  const tourShut = TOUR_TIERS.every((t) => tierLocked(s, t));
  const open = openAction;
  const opts = open ? actionOptions(s, open) : [];
  const gaps = missingRoles(s);
  const roleSelect =
    open === 'advertise'
      ? `<div class="role-pick"><span>Looking for</span><div class="chips">${(['guitar', 'bass', 'drums', 'keys'] as Role[]).map((r) => `<button class="chip ${gaps.includes(r) ? 'gap' : ''}" data-do="adRole" data-arg="${r}" aria-pressed="${r === adRole}">${ROLE_LABEL[r]}${gaps.includes(r) ? ' (missing)' : ''}</button>`).join('')}</div></div>`
      : open === 'rest' && s.members.some((m) => !m.isPlayer && m.habit >= 25)
        ? `<div class="role-pick"><span>Who goes, if one goes</span><div class="chips">${s.members.filter((m) => !m.isPlayer && m.outWeeks === 0).map((m) => `<button class="chip" data-do="restWho" data-arg="${m.id}" aria-pressed="${m.id === restWho}">${esc(first(m))} (habit ${m.habit})</button>`).join('')}</div></div>`
      : open === 'write'
        ? `<div class="role-pick"><span>New sound, if you change direction</span><div class="chips">${GENRES.filter((g) => g !== s.members[0].style).map((g) => `<button class="chip" data-do="newSound" data-arg="${g}" aria-pressed="${g === newSound}">${GENRE_LABEL[g]}</button>`).join('')}</div></div>`
        : '';
  return `
    ${offersBanner(s)}
    ${hopefuls(s)}
    <h3 class="what-now">${s.candidates.length ? 'Or get on with the week' : 'What now?'}</h3>
    ${error ? `<p class="hint" role="alert" style="color:var(--bad)">${esc(error)}</p>` : ''}
    <div class="tiles">
      ${types.map((t) => `<button class="tile ${t === 'tour' && tourShut ? 'shut' : ''}" data-do="open" data-arg="${t}" aria-expanded="${open === t}"><strong>${ACTION_LABEL[t]}</strong><span>${esc(subs[t])}</span></button>`).join('')}
    </div>
    ${open === 'tour' ? tourSetup(s, opts) : open ? `<div class="choices">${roleSelect}${opts.map((o) => choiceBtn('choose', open, o.id, o.label, o.cost, o.hint, o.locked, o.special)).join('')}</div>` : ''}
    ${goalLine(s)}`;
}

/** A record deal on the table is the biggest thing that can happen to a small band: say so, loudly. */
function offersBanner(s: GameState): string {
  if (!s.offers.length || s.over) return '';
  const lines = s.offers.map((o) => {
    const l = labelById(o.label);
    const left = o.expires - s.week;
    return `<strong>${esc(l.name)}</strong> want to sign ${esc(s.bandName)}: £${o.terms.advance.toLocaleString('en-GB')} advance${o.buyout ? ', buyout included' : ''}. ${left <= 1 ? 'Last week to answer.' : `${left} weeks to answer.`}`;
  });
  return `<aside class="offer-banner" role="status">
    <span class="goal-step">Record deal on the table</span>
    ${lines.map((x) => `<p>${x}</p>`).join('')}
    <button class="btn" data-do="tab" data-arg="label">Read the offer${s.offers.length > 1 ? 's' : ''}</button>
  </aside>`;
}

/** The next rung on the road to rock immortality. */
function goalLine(s: GameState): string {
  const g = nextGoal(s);
  if (ladderDone(s) && !s.over) {
    return `<p class="goal-line done"><span class="goal-step">Road to rock immortality</span><strong>Every rung climbed. ${esc(g.text)}</strong><span class="goal-actions"><button class="btn ${armedRetire ? '' : 'ghost'}" data-do="retire" ${s.tour || s.pending ? 'disabled' : ''}>${armedRetire ? 'Really retire? A farewell show and the end.' : 'Retire at the top'}</button></span></p>`;
  }
  return `<p class="goal-line"><span class="goal-step">Road to rock immortality</span><strong>Next: ${esc(g.text)}</strong></p>`;
}

function tourSub(s: GameState): string {
  const open = visibleTiers(s).filter((t) => !tierLocked(s, t));
  if (open.length) return open[open.length - 1].name.replace(/,.*$/, '');
  return `Need ${TOUR_TIERS[0].fans} fans`;
}

/** Pick a tour: tier, then length and how wild, then go. */
function tourSetup(s: GameState, opts: ReturnType<typeof actionOptions>): string {
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
    const lodge = tourLodging ?? defaultLodging(t.id);
    const ride = tourWheels(s, t.id);
    const weekly = t.weeklyCost + (ride.hired ? 0 : WHEELS[ride.wheels].weekly) + lodgingCost(s.members.length, t.weeklyCost, lodge);
    detail = `
      <div class="tour-setup">
        <span class="label">How long?</span>
        <div class="chips">${weeks.map((w) => `<button class="chip" data-do="tourWeeks" data-arg="${w}" aria-pressed="${tourWeeks === w}">${w} wk, ${w * t.gigsPerWeek} gigs</button>`).join('')}</div>
        <span class="label">On the road</span>
        <div class="chips">${(['wild', 'steady', 'clean'] as TourPolicy[]).map((p) => `<button class="chip" data-do="tourPolicy" data-arg="${p}" aria-pressed="${tourPolicy === p}" title="${esc(POLICY_HINT[p])}">${POLICY_LABEL[p]}</button>`).join('')}</div>
        <span class="label">Where you sleep</span>
        <div class="chips">${LODGING_ORDER.map((l) => `<button class="chip" data-do="tourLodging" data-arg="${l}" aria-pressed="${lodge === l}" title="${esc(LODGING[l].word)}">${LODGING[l].name}${LODGING[l].nightly ? ` £${lodgingCost(s.members.length, t.weeklyCost, l).toLocaleString('en-GB')}/wk` : ''}</button>`).join('')}</div>
        <p class="hint">${esc(POLICY_HINT[tourPolicy])} ${esc(LODGING[lodge].word)} ${ride.hired ? 'The promoter supplies a tour bus.' : `Travelling in ${esc(WHEELS[ride.wheels].name.toLowerCase())}${WHEELS[ride.wheels].weekly ? ` (£${WHEELS[ride.wheels].weekly.toLocaleString('en-GB')}/wk to run)` : ''}.`} Road costs about £${(weekly * tourWeeks).toLocaleString('en-GB')} in total. Nothing else happens until you come home or give up.</p>
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
      <p class="hint">Next: ${next.map((x) => `${esc(x.city)}${x.country !== 'England' ? ` (${esc(x.country)})` : ''}`).join(' -> ')}. ${esc(tourWheels(s, tour.tier).hired ? 'A hired tour bus' : WHEELS[tourWheels(s, tour.tier).wheels].name)}, ${esc(LODGING[tour.lodging ?? 'bnb'].name.toLowerCase())}.</p>
      ${hurting.length ? `<p class="hint warn">Struggling: ${hurting.map((m) => `${esc(m.isPlayer ? 'you' : first(m))} (${m.energy < 25 ? 'exhausted' : m.habit >= 60 ? 'using heavily' : 'miserable'})`).join(', ')}.</p>` : ''}
      <div class="choices">
        ${(['wild', 'steady', 'clean'] as TourPolicy[]).map((p) => `<button class="choice ${tour.policy === p ? 'selected' : ''}" data-do="tourNext" data-arg="${p}">
          <span class="choice-head"><strong>Next week: ${esc(POLICY_LABEL[p].toLowerCase())}</strong>${tour.policy === p ? '<span class="cost free">current</span>' : ''}</span>
          <span class="choice-hint">${esc(POLICY_HINT[p])}</span>
        </button>`).join('')}
        <button class="choice" data-do="tourFinish" data-arg="${tour.policy}">
          <span class="choice-head"><strong>Play the rest of the tour: ${esc(POLICY_LABEL[tour.policy].toLowerCase())}</strong><span class="cost free">${tour.weeks - tour.week} wk</span></span>
          <span class="choice-hint">Week after week with the same policy. Stops if something needs a decision.</span>
        </button>
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

/** What it takes to get into a sales chart, against what your latest record is doing. */
function chartNeed(s: GameState): string {
  const album = chartTab === 'albums';
  const r = reach(s);
  const need = entryUnits(s.world, chartTab, chartTab === 'europe' ? r.europe : chartTab === 'world' ? r.world : chartTab === 'us' ? r.us : 1);
  const latest = [...s.releases].reverse().find((x) => (album ? x.kind === 'album' : x.kind === 'single' || x.kind === 'ep'));
  const kind = album ? 'an album' : 'a single';
  if (!latest) return `Only records chart here. Release ${kind} that sells${need ? `: the bottom of the chart is selling about ${need.toLocaleString('en-GB')} copies a week` : ''}.`;
  const age = s.week - latest.week;
  const abroad = chartTab === 'europe' || chartTab === 'world' || chartTab === 'us';
  return `"${esc(latest.title)}" sold ${latest.lastWeek.toLocaleString('en-GB')} copies last week${age > 12 ? ' and is fading: records sell for a few months, then it takes a new one' : ''}. ${need ? `The bottom of this chart is selling about ${need.toLocaleString('en-GB')}.` : ''}${chartTab === 'us' ? ' America only hears you through a major label, a North American tour and big videos.' : abroad ? ' Abroad, only a label with distribution, touring the region and big videos carry your records.' : ' A label with promotion multiplies sales.'}`;
}

function chartsSection(s: GameState): string {
  const tabs = (Object.keys(CHART_NAME) as ChartId[])
    .map((id) => `<button class="chip" data-do="chart" data-arg="${id}" aria-pressed="${id === chartTab}">${id === 'london' ? 'London' : id === 'uk' ? 'UK singles' : id === 'albums' ? 'UK albums' : id === 'us' ? 'US singles' : id === 'europe' ? 'Euro singles' : 'World singles'}</button>`)
    .join('');
  const rows = s.world.charts[chartTab];
  const mine = rows.find((r) => r.isPlayer);
  const shown = chartAll ? rows : rows.filter((r) => r.pos <= 10 || r.isPlayer);
  const move = (r: (typeof rows)[number]) =>
    r.last === null ? '<span class="mv new">New</span>' : r.last === r.pos ? '<span class="mv">=</span>' : r.last > r.pos ? `<span class="mv up">+${r.last - r.pos}</span>` : `<span class="mv down">-${r.pos - r.last}</span>`;
  const note =
    chartTab === 'london'
      ? mine ? `You're at #${mine.pos}.` : 'Ranked by fans and buzz on the gig circuit. Keep gigging to break in.'
      : mine ? `Your record is at #${mine.pos}.` : chartNeed(s);
  const hot = hotGenres(s.week).slice(0, 2).map((g) => GENRE_LABEL[g].toLowerCase()).join(' and ');
  return `
    <section class="charts">
      <div class="chips">${tabs}</div>
      <p class="hint">${CHART_NAME[chartTab]}, ${dateLabel(s.week)}. ${note} Selling right now: ${hot}.</p>
      <div class="chart-wrap">
        <table class="chart">
          <thead><tr><th>#</th><th>Move</th><th>Artist</th>${chartTab === 'london' ? '' : `<th>${chartTab === 'albums' ? 'Album' : 'Single'}</th><th>From</th>`}<th>Label</th><th>Wks</th></tr></thead>
          <tbody>${shown
            .map(
              (r) => `<tr class="${r.isPlayer ? 'me' : ''}"><td class="pos">${r.pos}</td><td>${move(r)}</td><td>${esc(r.artist)}</td>${chartTab === 'london' ? '' : `<td>${esc(r.title ?? '')}</td><td>${r.origin ?? ''}</td>`}<td class="lbl">${esc(r.label ?? '')}</td><td>${r.weeks}</td></tr>`,
            )
            .join('')}</tbody>
        </table>
      </div>
      <button class="btn ghost small" data-do="chartAll">${chartAll ? 'Show top 10' : `Show all ${rows.length}`}</button>
    </section>`;
}

function choiceBtn(what: string, arg: string, arg2: string, label: string, cost: number, hint: string, locked?: string, special?: boolean): string {
  return `<button class="choice ${special ? 'special' : ''}" data-do="${what}" data-arg="${arg}" data-arg2="${arg2}" ${locked ? 'disabled' : ''}>
    <span class="choice-head"><strong>${esc(label)}</strong><span class="cost ${cost ? '' : 'free'}">${special ? 'This week only' : cost ? `£${cost}` : 'Free'}</span></span>
    <span class="choice-hint">${esc(locked ?? hint)}</span>
  </button>`;
}

const unreleasedCount = (s: GameState) => s.songs.filter((x) => !x.released).length;

function eventCard(s: GameState): string {
  const v = viewPending(s);
  if (!v) return '';
  return `
    <div class="event" role="alertdialog" aria-labelledby="event-title">
      <span class="kicker">Something's come up</span>
      <h3 id="event-title">${esc(v.title)}</h3>
      <p>${esc(v.text)}</p>
      <div class="choices">${v.options.map((o, i) => choiceBtn('respond', String(i), '', o.label, o.cost, o.hint, o.locked)).join('')}</div>
      ${s.pending?.def === 'album_title' ? `<form class="rename title-form"><input id="album-title" type="text" maxlength="60" placeholder="Or call it..." aria-label="Album title" autocomplete="off"><button class="btn" type="submit" data-do="titleAlbum">Call it that</button></form>` : ''}
    </div>`;
}

function recordsSection(s: GameState): string {
  if (!s.releases.length && !s.songs.length) return '';
  const kind = { demo: 'Demo', single: 'Single', ep: 'EP', album: 'Album' } as const;
  const songs = [...s.songs].sort((a, b) => b.quality - a.quality);
  const peak = (r: (typeof s.releases)[number], c: string) => (r.peaks?.[c] ? `#${r.peaks[c]}` : '');
  const rows = [...s.releases].reverse().map((r) => `<tr>
      <td><strong>"${esc(r.title)}"</strong>${s.over ? '' : ` <button class="btn ghost tiny" data-do="renameRelease" data-arg="${r.id}" >Rename</button>`}${r.cert ? `<br><small class="cert ${r.cert}">${CERT_LABEL[r.cert]}</small>` : ''}${r.outside ? '<br><small class="lbl">outside song</small>' : ''}</td>
      <td>${r.comp === 'hits' ? 'Compilation' : r.comp === 'live' ? 'Live' : r.comp === 'bootleg' ? 'Bootleg' : kind[r.kind]}</td>
      <td>${dateLabel(r.week)}</td>
      <td class="lbl">${esc(r.comp === 'bootleg' ? 'Bootleg' : r.label ? labelById(r.label).name : r.kind === 'demo' ? 'Merch table' : 'Kebab Shop Records')}</td>
      <td>${r.quality}</td>
      <td>${r.sold.toLocaleString('en-GB')}${r.lastWeek ? `<br><small class="lbl">+${r.lastWeek.toLocaleString('en-GB')}/wk</small>` : ''}</td>
      <td>${r.kind === 'album' ? peak(r, 'albums') : peak(r, 'uk')}</td><td>${peak(r, 'us')}</td><td>${peak(r, 'europe')}</td><td>${peak(r, 'world')}</td>
    </tr>`);
  const albums = [...s.releases].reverse().filter((r) => r.kind === 'album');
  const hue = (t: string) => { let h = 0; for (const c of t) h = (h * 17 + c.charCodeAt(0)) % 360; return h; };
  const track = (x: Song, n: number) => `<tr><td class="pos">${n}</td><td><strong>${esc(x.title)}</strong>${x.lifted || (s.releases.some((r) => r.kind === 'single' && r.title === x.title)) ? '<small class="lbl"> single</small>' : ''}${x.quality >= 92 ? '<small class="cert platinum"> the one</small>' : ''}</td><td class="lbl">${runningTime(x)}</td><td>${x.quality}</td></tr>`;
  const sleeves = albums.map((r) => {
    const { a, b } = sides(s, r.id);
    const all = [...a, ...b];
    const quarters = r.double && all.length >= 12 ? [0, 1, 2, 3].map((i) => all.slice(Math.round((i * all.length) / 4), Math.round(((i + 1) * all.length) / 4))) : null;
    const lbl = r.comp === 'bootleg' ? 'Bootleg' : r.label ? labelById(r.label).name : 'Kebab Shop Records';
    const side = (name: string, list: Song[], from: number) => (list.length ? `<p class="side">${name}</p><table class="chart ledger tracks"><tbody>${list.map((x, i) => track(x, from + i + 1)).join('')}</tbody></table>` : '');
    return `<article class="album">
      <div class="sleeve" style="--h:${hue(r.title)}"><span class="lp">LP</span><strong>${esc(r.title)}</strong><em>${esc(s.bandName)}</em></div>
      <div class="album-in">
        <h4>${esc(r.title)}${r.double ? ' <small class="lbl">double album</small>' : r.tracks && r.tracks > 8 ? ` <small class="lbl">${r.tracks} tracks</small>` : ''}</h4>
        <p class="lbl">${esc(lbl)}<br>${dateLabel(r.week)}${r.cert ? ` <span class="cert ${r.cert}">${CERT_LABEL[r.cert]}</span>` : ''}<br>${r.sold.toLocaleString('en-GB')} sold${r.peaks?.albums ? `, albums chart #${r.peaks.albums}` : ''}</p>
        ${quarters ? quarters.map((q, i) => side(`Side ${'ABCD'[i]}`, q, quarters.slice(0, i).reduce((n, x) => n + x.length, 0))).join('') : a.length ? side('Side A', a, 0) + side('Side B', b, a.length) : '<p class="hint">The tape box says nothing about what is on it.</p>'}
      </div>
    </article>`;
  });
  return `
    <section class="records">
      ${albums.length ? `<h3 class="sub">Albums</h3><div class="albums">${sleeves.join('')}</div>` : ''}
      ${s.releases.length ? `<h3 class="sub">Discography</h3>
      <div class="chart-wrap"><table class="chart ledger disco">
        <thead><tr><th>Title</th><th>Format</th><th>Released</th><th>Label</th><th>Rating</th><th>Sold</th><th>UK</th><th>US</th><th>Euro</th><th>World</th></tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table></div>
      <p class="hint">UK peak is the singles chart for singles and EPs, the albums chart for albums.</p>` : ''}
      ${songs.length ? `<h3 class="sub">Songs</h3>
      <div class="chart-wrap"><table class="chart ledger songs">
        <thead><tr><th>Title</th><th>Rating</th><th>Type</th><th>Writer</th><th>Status</th></tr></thead>
        <tbody>${songs.map((x) => { const w = s.members.find((m) => m.id === x.writer); return `<tr class="${x.released ? 'out' : ''}"><td><strong>"${esc(x.title)}"</strong>${s.over ? '' : ` <button class="btn ghost tiny" data-do="renameSong" data-arg="${esc(x.title)}">Rename</button>${!x.released && !x.lifted ? ` <button class="btn ghost tiny" data-do="dropSong" data-arg="${esc(x.title)}">${armedDrop === x.title ? 'Really bin it?' : 'Bin'}</button>` : ''}`}</td><td>${x.quality}</td><td>${GENRE_LABEL[x.genre]} ${x.kind === 'ballad' ? 'ballad' : x.kind === 'trend' ? 'chart chaser' : x.kind === 'cover' ? 'cover' : x.kind === 'hired' ? 'song, outside writer' : x.kind === 'solo' ? 'solo song' : 'song'}</td><td class="lbl">${x.kind === 'cover' ? 'Somebody else' : x.kind === 'hired' ? 'Hired pen' : w ? esc(w.isPlayer ? 'You' : first(w)) : 'An old member'}</td><td class="lbl">${x.released ? (x.album ? 'On the album' : 'Released') : x.lifted ? 'Single' : 'Unreleased'}${x.outside ? ', publishing outside' : ''}</td></tr>`; }).join('')}</tbody>
      </table></div>
      <p class="hint">Sound right now: ${GENRE_LABEL[s.members[0].style]}. Change direction from the Write menu.</p>` : '<p class="hint">No songs yet. Write some.</p>'}
    </section>`;
}

/** The post, newest first. */
function letterbox(s: GameState): string {
  const letters = [...(s.letters ?? [])].reverse().slice(0, 12);
  if (!letters.length) return '';
  return `<h3 class="sub">The letterbox</h3>
    <div class="letters">${letters.map((l) => `<article class="letter"><p class="letter-from"><span class="lbl">${dateLabel(l.week)}</span> ${esc(l.from)}</p><p>${esc(l.text)}</p></article>`).join('')}</div>`;
}

function lineupBlock(s: GameState): string {
  const cur = s.members.map((m) => `<tr><td><strong>${esc(m.name)}</strong>${m.name !== m.realName ? `<br><small class="lbl">${esc(m.realName)}</small>` : ''}</td><td>${ROLE_LABEL[m.role]}</td><td>${dateLabel(m.joined ?? 0)}</td><td class="lbl">now</td></tr>`);
  const old = [...(s.alumni ?? [])].reverse().map((a) => `<tr class="out"><td><strong>${esc(a.name)}</strong>${a.name !== a.realName ? `<br><small class="lbl">${esc(a.realName)}</small>` : ''}</td><td>${ROLE_LABEL[a.role]}</td><td>${dateLabel(a.joined)}</td><td class="lbl">${dateLabel(a.left)}, ${a.how === 'fired' ? 'fired' : a.how === 'quit' ? 'quit' : a.how === 'died' ? 'died' : 'poached'}</td></tr>`);
  const lost = (s.memorials ?? []).map((r) => `<p class="lbl">In memoriam ${esc(r.name)}, ${ROLE_LABEL[r.role].toLowerCase()}, ${dateLabel(r.week)}, aged ${r.age}.</p>`).join('');
  return `<h3 class="sub">Line-up</h3>
    <div class="chart-wrap"><table class="chart ledger lineup"><thead><tr><th>Name</th><th>Role</th><th>Joined</th><th>Left</th></tr></thead><tbody>${cur.join('')}${old.join('')}</tbody></table></div>${lost}`;
}

function toursBlock(s: GameState): string {
  if (!s.tours?.length) return '';
  const rows = [...s.tours].reverse().map((t) => `<tr class="${t.abandoned ? 'out' : ''}"><td><strong>${esc(t.name)}</strong>${t.abandoned ? '<br><small class="lbl">abandoned</small>' : ''}</td><td>${dateLabel(t.start)}</td><td>${t.weeks}</td><td>${t.gigs}</td><td>${t.people.toLocaleString('en-GB')}</td><td>${t.fans >= 0 ? '+' : ''}${t.fans.toLocaleString('en-GB')}</td><td class="${t.net < 0 ? 'neg' : ''}">${t.net < 0 ? '-' : ''}£${Math.abs(t.net).toLocaleString('en-GB')}</td><td>${t.legends || ''}</td></tr>`);
  return `<h3 class="sub">Tours</h3>
    <div class="chart-wrap"><table class="chart ledger"><thead><tr><th>Tour</th><th>Start</th><th>Wks</th><th>Gigs</th><th>People</th><th>Fans</th><th>Net</th><th>Legendary</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}

function awardsBlock(s: GameState): string {
  if (!s.awards?.length) return '';
  return `<h3 class="sub">Awards</h3>
    <ul class="awards">${[...s.awards].reverse().map((a) => `<li><strong>${a.year}</strong> ${esc(a.title)} <span class="lbl">${esc(a.from)}</span></li>`).join('')}</ul>`;
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
  } else if (!s.over) {
    const nameBtn = renaming === m.id
      ? `<form class="rename rename-two"><label class="lbl">Real name<input id="realname-${m.id}" type="text" maxlength="40" value="${esc(m.realName)}" aria-label="Real name" autocomplete="off"></label><label class="lbl">Known as<input id="rename-${m.id}" type="text" maxlength="40" value="${esc(m.name === m.realName ? '' : m.name)}" placeholder="Same as real name" aria-label="Known as" autocomplete="off"></label><span class="rename-btns"><button class="btn" type="submit" data-do="renameSave" data-arg="${m.id}">Save</button><button class="btn ghost" type="button" data-do="renameCancel">Cancel</button></span>${error ? `<p class="hint" role="alert" style="color:var(--bad)">${esc(error)}</p>` : ''}</form>`
      : `<button class="btn ghost" data-do="renameOpen" data-arg="${m.id}">Rename</button>`;
    foot = `${nameBtn}${m.isPlayer ? '' : `<button class="btn ghost" data-do="fire" data-arg="${m.id}">${armedFire === m.id ? `Really fire ${esc(first(m))}?` : 'Fire'}</button>`}`;
  }

  return `
    <article class="card ${tier} ${out ? 'out' : ''}">
      <div class="card-in">
        <div class="card-head">
          <div class="ovr" title="${fuzzy ? 'Your best guess. Play together more to know for sure.' : 'Overall rating'}">${fuzzy ? '<span class="approx">~</span>' : ''}${ovr}</div>
          <div class="who"><span class="role-badge role-${m.isPlayer ? 'vocals' : m.role}">${roleText}</span><strong>${esc(m.name)}${m.isPlayer ? ' (you)' : ''}</strong>${m.realName !== m.name && !m.name.includes('"') ? `<span class="real">${esc(m.realName)}</span>` : ''}<span>${m.age}, ${esc(m.from)}, ${GENRE_LABEL[m.style].toLowerCase()}</span></div>
        </div>
        <dl class="attrs">
          <div><dt>${tip('Skill', 'skill')}</dt><dd>${stat(m.skill)}</dd></div>
          <div><dt>${tip('Stage', 'stage')}</dt><dd>${stat(m.stage)}</dd></div>
          <div><dt>${tip('Image', 'image')}</dt><dd>${stat(m.image)}</dd></div>
          <div><dt>${tip('Write', 'write')}</dt><dd>${stat(m.writing)}</dd></div>
          <div title="Instruments and amps. ${esc(KIT_WORD(m.kit ?? 30))}. Junk caps what a player can do; past pro level it is for the player, not the room."><dt>Kit</dt><dd>${m.kit ?? 30}</dd></div>
        </dl>
        <dl class="traits">${traits}</dl>
        ${candidate ? '' : `<div class="meters">${meter('Energy', m.energy)}${meter('Mood', m.mood)}${meter('Habit', m.habit, 'habit')}</div>`}
        ${out ? `<p class="status">Out for ${m.outWeeks} more week${m.outWeeks === 1 ? '' : 's'}</p>` : ''}
        ${candidate ? '' : relLine(s, m)}
        ${m.isPlayer && toyLine(s) ? `<p class="owns"><span class="lbl">Owns</span> ${esc(toyLine(s))}</p>` : ''}
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
