import { Rng, clamp } from './rng';
import { HIDDEN_TRAITS, ROLE_LABEL, createPlayer, introduce, generateStartingBand, getToKnow, rollPotential } from './characters';
import { addAffinity, available, forEachPair } from './chemistry';
import { bandName as genBandName } from './names';
import { advanceWorld, ageCharts, createWorld, heatCurve, labelFor, type ChartId } from './world';
import { awardsNight } from './awards';
import { ladderDone } from './goals';
import { fanClubWeek } from './fanclub';
import { splitWeek, shares } from './split';
import { studioRent } from './studio';
import { deathWeek, remembranceWeek } from './death';
import { toyUpkeep, toyWeek } from './toys';
import { fashionDrift, flopWatch } from './hardPart';
import { postWeek } from './letters';
import { certify } from './certs';
import { ACTION_LABEL, actionOptions, optionLocked, perform, sellRecords } from './actions';
import { rollEvents } from './events';
import { tierById } from './tour';
import { addBuzz, adjust, beat, earn, first, grow, log, logEffects, milestone, mutate, openScene, player, removeMember, revealLog, snapshot } from './helpers';
import { labelById, labelWeek } from './labels';
import { managerKnock, managerWeek } from './managers';
import { catalogueWeek } from './catalogue';
import { ruinWeek } from './ruinEvents';
import { SPLIT_LABEL } from './split';
import type { Action, GameState, LogEntry, Musician, NewGameInput, Split, TourPolicy } from './types';

export { first } from './helpers';

export const START_YEAR = 1982;
export const DEADLINE_WEEK = 520; // end of 1991, when the decade and the game end
/** Fans and buzz at which record labels start calling. A milestone, not the end. */
export const LABEL_FANS = 1000;
export const LABEL_BUZZ = 55;
export const MAX_MEMBERS = 6;
export const BROKE_LIMIT = -250;
/** Under this much money you are skint; this many skint weeks in a row and you are evicted. */
export const SKINT = 50;
export const SKINT_WEEKS = 16;
/** How far into the red the bank lets you go. A famous band gets a bigger overdraft. */
export const overdraft = (s: GameState) => BROKE_LIMIT - Math.round(s.fans * 0.1);

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function dateLabel(week: number): string {
  const year = START_YEAR + Math.floor(week / 52);
  const month = MONTHS[Math.floor(((week % 52) * 12) / 52)];
  return `${month} ${year}`;
}

export function newGame(input: NewGameInput): GameState {
  const seed = input.seed ?? Math.floor(Math.random() * 2 ** 31);
  const rng = new Rng(seed);
  let nextId = 1;
  const id = () => `m${nextId++}`;
  const player = createPlayer(rng, input);
  const LINEUP = { solo: 0, duo: 1, trio: 2, full: 3 } as const;
  const bandGender = input.bandGender ?? 'mixed';
  const mates = generateStartingBand(rng, input.style, id, player.realName, LINEUP[input.lineup ?? 'full'], bandGender === 'mixed' ? undefined : bandGender, input.difficulty ?? 'normal');
  const s: GameState = {
    version: 1,
    rng: 0,
    week: 0,
    bandName: input.bandName.trim() || genBandName(rng),
    money: Math.round((input.background === 'posh' ? 450 : 200) * (input.difficulty === 'easy' ? 3 : input.difficulty === 'hard' ? 0.5 : 1)),
    fans: 0,
    buzz: 0,
    tightness: 15,
    songs: [],
    members: [player, ...mates],
    affinity: {},
    candidates: [],
    candidateRole: null,
    lastGigWeek: null,
    log: [],
    over: null,
    nextId,
    world: undefined as never,
    gear: 0,
    flags: {},
    releases: [],
    ledger: {},
    tours: [],
    alumni: [],
    awards: [],
    wheels: input.difficulty === 'hard' ? 'bus' : 'van',
    bandGender,
    difficulty: input.difficulty ?? 'normal',
    pending: null,
    scene: null,
    tour: null,
    milestones: [],
    offers: [],
    contract: null,
    manager: null,
  };
  s.world = createWorld(rng, s.bandName);
  // Let the charts run for a few months before you arrive, so they have history.
  for (let i = 0; i < 20; i++) advanceWorld(s.world, rng, 0, { bandName: s.bandName, fans: 0, buzz: 0 });
  ageCharts(s.world, rng);
  forEachPair(s.members, (a, b) => addAffinity(s, a.id, b.id, rng.int(5, 35)));
  openScene(s, 'start', `London, ${dateLabel(0)}`, 'quiet');
  const who = mates.length === 0 ? 'you, a notebook and nobody else yet' : mates.length === 1 ? 'you and one mate from the pub' : mates.length === 2 ? 'you and two mates from the pub' : 'you and three mates from the pub';
  log(s, `London, ${dateLabel(0)}. ${s.bandName} is ${who}${mates.length ? `. ${mates.map((m) => `${m.name} (${ROLE_LABEL[m.role].toLowerCase()})`).join(', ')}` : ''}.`, 'neutral');
  log(s, 'You have a rehearsal room above a kebab shop, a handful of covers and no original songs.', 'neutral');
  // Core fans: family, flatmates and whoever owes you a favour. They never leave.
  const core = rng.int(8, 14) + (input.difficulty === 'easy' ? 20 : 0) - (input.difficulty === 'hard' ? 4 : 0);
  s.fans = core;
  s.flags.coreFans = core;
  const mum = mates.length ? rng.pick(mates) : null;
  log(s, `Your fan base: your mum, ${mum ? `${first(mum)}'s sister, ` : ''}two flatmates and a bloke from the pub who calls you "the lads". ${core} people, all of them on the guest list.`, 'neutral');
  milestone(s, 'career', `${s.bandName} formed in London: ${[player, ...mates].map((m) => m.name).join(', ')}.`);
  const intros: string[] = [];
  for (const m of mates) {
    intros.push(introduce(m, intros));
    beat(s, ROLE_LABEL[m.role], intros[intros.length - 1]);
  }
  if (!mates.length) beat(s, undefined, 'No band yet. A singer with a notebook and a rehearsal room is not a band. Find a musician.');
  beat(s, undefined, mates.length ? 'First week. What does the band do?' : 'First week. What do you do?');
  s.scene!.recording = false;
  s.rng = rng.state;
  return s;
}

/** Brings saves from older versions up to date. */
export function upgradeSave(s: GameState): GameState {
  if (!s.world) {
    const rng = new Rng(s.rng);
    s.world = createWorld(rng, s.bandName);
    advanceWorld(s.world, rng, s.week, { bandName: s.bandName, fans: s.fans, buzz: s.buzz });
    s.rng = rng.state;
  }
  s.gear ??= 0;
  s.flags ??= {};
  s.releases ??= [];
  s.pending ??= null;
  s.ledger ??= {};
  s.tours ??= [];
  s.alumni ??= [];
  s.awards ??= [];
  for (const m of s.members) m.joined ??= Math.max(0, s.week - m.weeksInBand);
  for (const m of s.members) m.kit ??= Math.round(25 + (s.gear ?? 0) * 8 + Math.min(30, Math.log10(Math.max(1, s.fans) / 100) * 10));
  // Old saves: a band that has toured the world has long since had a bus of its own.
  s.wheels ??= s.flags.toured_world || s.flags.toured_northamerica ? 'coach' : s.flags.noVan ? 'bus' : 'van';
  if (s.tour) s.tour.lodging ??= 'bnb';
  s.world.charts.us ??= [];
  for (const [i, star] of s.world.stars.entries()) star.label ??= labelFor(new Rng(i + 7), star.origin);
  s.scene ??= null;
  s.tour ??= null;
  s.milestones ??= [];
  s.offers ??= [];
  s.contract ??= null;
  if (s.contract) { s.contract.goodwill ??= 60; s.contract.shaved ??= 0; s.contract.statements ??= 0; }
  if (s.manager && !s.manager.kind) { s.manager.kind = s.manager.honesty < 30 ? 'hustler' : 'suit'; s.manager.care = 30; s.manager.nous = s.manager.honesty < 30 ? 35 : 60; }
  if (s.manager === undefined) {
    // Managers used to be flags: 1 = read contract, 2 and 5 = the sheepskin-coat type.
    const f = s.flags.manager;
    s.manager = f === 1 || f === 2 || f === 5
      ? { name: 'Clive Sparrowhawk', honesty: f === 1 ? 65 : 20, clout: 35, cut: 0.2, signed: s.flags.managerWeek ?? s.week, read: f !== 2, taken: 0 }
      : null;
  }
  // Older saves: albums did not record their tracks. Give each album its eight best unassigned released songs.
  if (s.songs.some((x) => x.released && !x.album)) {
    for (const album of [...(s.releases ?? [])].filter((r) => r.kind === 'album').reverse()) {
      for (const x of s.songs.filter((y) => y.released && !y.album).sort((p, q) => q.quality - p.quality).slice(0, 8)) x.album = album.id;
    }
  }
  for (const song of s.songs) {
    song.kind ??= 'standard';
    song.genre ??= s.members[0].style;
    song.released ??= false;
  }
  for (const st of s.world.stars) {
    st.age ??= 6;
    st.album ??= `${st.name} Live`;
    st.albumAge ??= 30;
  }
  s.world.charts.albums ??= [];
  const rng = new Rng(s.rng);
  for (const m of [...s.members, ...s.candidates]) {
    m.seen ??= 100;
    m.fog ??= 0;
    if (m.hidden.potential === undefined) {
      m.hidden.potential = rollPotential(rng, Math.max(m.skill, m.stage, m.writing), m.age);
      m.known.potential = 0;
    }
  }
  s.rng = rng.state;
  return s;
}

export function canAct(s: GameState, a: Action): string | null {
  if (s.over) return 'The game is over.';
  if (s.pending) return 'Deal with the situation first.';
  if (s.tour && a.type !== 'tour') return 'You are on tour. Play on or abandon it.';
  return optionLocked(s, a);
}

export function act(state: GameState, a: Action): GameState {
  const why = canAct(state, a);
  if (why) throw new Error(why);
  return mutate(state, (s, rng) => {
    const label = actionOptions(s, a.type).find((o) => o.id === a.option)?.label ?? ACTION_LABEL[a.type];
    const title = s.tour && a.type === 'tour' ? `${s.tour.name}, week ${s.tour.week + 1} of ${s.tour.weeks}` : a.type === 'tour' ? `${label}, week 1 of ${a.weeks ?? tierById(a.option)?.minWeeks ?? 1}` : label;
    openScene(s, a.type, title, a.type === 'gig' || a.type === 'tour' ? 'gig' : 'normal');
    const before = snapshot(s);
    perform(s, rng, a);
    for (const m of available(s)) getToKnow(m, KNOW_BY_ACTION[a.type]);
    logEffects(s, before);
    if (a.type !== 'rehearse') s.tightness = clamp(s.tightness - 1, 0, 100);
    s.scene!.late = true;
    endOfWeek(s, rng);
    s.scene!.recording = false;
  });
}

/**
 * Play the rest of the tour in one go, week after week with the same policy. Stops early when a
 * situation needs a decision (the player answers it and can press again), or when the band is
 * wrecked enough that the tour would be abandoned by hand. Leaves a summary scene instead of the
 * last week's report.
 */
export function finishTour(state: GameState, policy: TourPolicy): GameState {
  if (!state.tour) throw new Error('Not on tour.');
  let s = state;
  const tourName = state.tour.name;
  const from = s.tour!.week + 1;
  const lines: { text: string; tone: LogEntry['tone'] }[] = [];
  let weeks = 0;
  while (s.tour && !s.pending && !s.over && weeks < 30) {
    s = act({ ...s, flags: { ...s.flags, autoTour: 1 } }, { type: 'tour', option: `continue:${policy}` });
    weeks++;
    for (const l of s.log.slice(-40)) if (l.week === s.week - 1 && /^(Tour week|Tour over|Tour abandoned|Disaster|Legend)/.test(l.text) && !lines.some((x) => x.text === l.text)) lines.push({ text: l.text, tone: l.tone });
    for (const l of s.log.slice(-40)) if (l.week === s.week - 1 && /the night they still talk about|cancelled\./.test(l.text) && !lines.some((x) => x.text === l.text)) lines.push({ text: l.text, tone: l.tone });
  }
  if (!weeks) return s;
  return mutate(s, (st) => {
    delete st.flags.autoTour;
    const abandoned = lines.some((l) => l.text.startsWith('Tour abandoned'));
    const title = st.tour ? `${tourName}: weeks ${from} to ${from + weeks - 1}` : abandoned ? `Tour abandoned: ${tourName}` : `Tour over: ${tourName}`;
    openScene(st, 'tour', title, 'gig');
    for (const l of lines) beat(st, undefined, l.text, l.tone === 'good' ? 'good' : l.tone === 'bad' ? 'bad' : 'neutral');
    if (st.pending) beat(st, undefined, 'The tour stops here for a decision.', 'neutral');
    else if (st.tour) beat(st, undefined, `${st.tour.weeks - st.tour.week} week${st.tour.weeks - st.tour.week === 1 ? '' : 's'} to go.`, 'neutral');
    st.scene!.recording = false;
  });
}

/** How much a week of each activity teaches you about your bandmates. */
const KNOW_BY_ACTION: Record<Action['type'], number> = { rehearse: 18, gig: 14, release: 12, party: 12, write: 10, rest: 4, advertise: 3, tour: 20 };

// ---------------------------------------------------------------- free actions

export function hire(state: GameState, candidateId: string, replaceId?: string): GameState {
  if (state.pending) throw new Error('Deal with the situation first.');
  return mutate(state, (s, rng) => {
    const c = s.candidates.find((x) => x.id === candidateId);
    if (!c) throw new Error('No such candidate.');
    if (replaceId) removeMember(s, replaceId, 'fired');
    if (s.members.length >= MAX_MEMBERS) throw new Error('The van only fits six.');
    s.candidates = s.candidates.filter((x) => x.id !== candidateId);
    for (const m of s.members) addAffinity(s, m.id, c.id, rng.int(-10, 20));
    c.joined = s.week;
    s.members.push(c);
    log(s, `${c.name} joins ${s.bandName} on ${ROLE_LABEL[c.role].toLowerCase()}.`, 'good');
    milestone(s, 'lineup', `${c.name} joined on ${ROLE_LABEL[c.role].toLowerCase()}.`);
  });
}

/** Close the auditions: whoever is left goes home. */
export function dismissCandidates(state: GameState): GameState {
  if (state.pending) throw new Error('Deal with the situation first.');
  return mutate(state, (s) => {
    if (!s.candidates.length) return;
    const n = s.candidates.length;
    s.candidates = [];
    s.candidateRole = null;
    log(s, n === 1 ? 'You thanked the last hopeful and sent them home.' : `You sent the other ${n} hopefuls home.`, 'neutral');
  });
}

/** Give a band member a new known-as name: a nickname in quotes, a stage name, or just their real name. */
export function rename(state: GameState, memberId: string, name: string, realName?: string): GameState {
  const tidy = (x: string) => x.replace(/\s+/g, ' ').trim().slice(0, 40);
  const clean = tidy(name);
  const real = realName === undefined ? undefined : tidy(realName);
  if (!clean && !real) throw new Error('A name needs letters in it.');
  return mutate(state, (s) => {
    const m = s.members.find((x) => x.id === memberId);
    if (!m) throw new Error('No such member.');
    const was = m.name;
    // Known as: blank means "just use the real name".
    if (real !== undefined && real) m.realName = real;
    m.name = clean || m.realName;
    if (m.name !== was) log(s, `${was} is now known as ${m.name}.${m.name.includes('"') ? '' : ' The old nickname is retired.'}`, 'neutral');
    else if (real) log(s, `${m.name}'s passport now says ${m.realName}. The band pretends it always did.`, 'neutral');
  });
}

/** The epitaph: what the band was, in numbers and in one line. */
export function careerSummary(s: GameState): string {
  const years = Math.max(1, Math.round((s.week / 52) * 10) / 10);
  const ones = s.releases.filter((r) => r.peaks?.uk === 1 || r.peaks?.albums === 1).length;
  const worldOnes = s.releases.filter((r) => r.peaks?.world === 1).length;
  const sold = s.releases.reduce((a, r) => a + r.sold, 0);
  const gigs = (s.tours ?? []).reduce((a, t) => a + t.gigs, 0);
  const bits = [
    `${years} years`,
    `${s.fans.toLocaleString('en-GB')} fans`,
    `${s.releases.filter((r) => r.kind !== 'demo').length} records and ${sold.toLocaleString('en-GB')} copies`,
    ones ? `${ones} UK number one${ones === 1 ? '' : 's'}` : null,
    worldOnes ? `${worldOnes} world number one${worldOnes === 1 ? '' : 's'}` : null,
    gigs ? `${gigs} tour dates` : null,
    (s.awards ?? []).length ? `${s.awards.length} award${s.awards.length === 1 ? '' : 's'}` : null,
    (s.alumni ?? []).length ? `${s.alumni.length} former member${s.alumni.length === 1 ? '' : 's'}` : null,
    (s.memorials ?? []).length ? `${s.memorials!.length} lost on the way` : null,
    s.flags.reunions ? `${s.flags.reunions} comeback${s.flags.reunions === 1 ? '' : 's'}` : null,
    `£${Math.max(0, s.money).toLocaleString('en-GB')} in the bank`,
  ].filter(Boolean);
  return bits.join(', ') + '.';
}

/** Bow out at the top. Only once every rung of the ladder is climbed. */
export function retire(state: GameState): GameState {
  if (state.over) throw new Error('The game is over.');
  if (state.pending) throw new Error('Deal with the situation first.');
  if (state.tour) throw new Error('Finish the tour first.');
  if (!ladderDone(state)) throw new Error('There is still a rung to climb.');
  if (state.flags.reunionWeek !== undefined && !state.releases.some((r) => r.kind === 'album' && r.week >= state.flags.reunionWeek)) throw new Error('One more album first. You promised.');
  return mutate(state, (s) => {
    milestone(s, 'career', `${s.bandName} retired at the top.`);
    s.over = { won: true, reason: `${s.bandName} walked away at the top. A farewell show, a long speech, a longer party, and then the phone stopped ringing on purpose. ${careerSummary(s)} Legends.` };
    s.pending = null;
    log(s, s.over.reason, 'good');
  });
}

/** Two years later, the phone rings. One more album. Everybody does it. */
export function canComeBack(s: GameState): string | null {
  if (!s.over || !s.over.won || !s.over.reason.includes('walked away')) return 'Only a band that walked away can walk back.';
  if (s.week + 52 >= DEADLINE_WEEK) return 'The decade is over. The reunion will have to wait for another game.';
  return null;
}

export function comeBack(state: GameState): GameState {
  const why = canComeBack(state);
  if (why) throw new Error(why);
  return mutate(state, (s, rng) => {
    const gap = Math.min(104, DEADLINE_WEEK - 52 - s.week);
    s.over = null;
    s.week += gap;
    s.flags.reunions = (s.flags.reunions ?? 0) + 1;
    s.flags.reunionWeek = s.week;
    s.flags.oneMoreAlbum = s.week;
    const kept = s.fans;
    s.fans = Math.round(s.fans * 0.55);
    s.buzz = 70;
    s.money = Math.round(s.money * 0.7);
    s.tightness = 35;
    s.tour = null;
    s.pending = null;
    s.offers = [];
    // Who comes back: anyone whose loyalty survived two years of not being asked.
    const gone = s.members.filter((m) => !m.isPlayer && m.hidden.loyalty < 40 && rng.chance(0.6));
    for (const m of gone) { removeMember(s, m.id, 'quit'); log(s, `${m.name} said no. "I have a garden centre now." ${first(m)} meant it.`, 'bad'); }
    for (const m of s.members) {
      m.age += Math.round(gap / 52);
      m.energy = 100; m.habit = Math.round(m.habit * 0.3); m.mood = 75;
      m.hidden.stamina = clamp(m.hidden.stamina - 3, 1, 99);
      adjust(m, 'skill', -2);
    }
    for (const a of s.members) for (const b of s.members) if (a.id < b.id) addAffinity(s, a.id, b.id, 10);
    s.scene = null;
    milestone(s, 'career', `${s.bandName} came back after ${Math.round(gap / 52)} years. One more album, they said.`);
    log(s, `${Math.round(gap / 52)} years of golf, gardening and solo records nobody bought. Then the phone rang, and it was each other. ${s.bandName} are back: ${s.fans.toLocaleString('en-GB')} of the ${kept.toLocaleString('en-GB')} still care, the rest are waiting to be reminded. One more album. That is what everyone says.`, 'good');
    s.pending = { def: 'the_comeback', params: { years: Math.round(gap / 52), gone: gone.length }, week: s.week };
  });
}

/** Call a record something else. Yours to name; the sleeves are already printed, but nobody reads sleeves. */
export function renameRelease(state: GameState, id: string, title: string): GameState {
  const clean = title.replace(/\s+/g, ' ').trim().slice(0, 60);
  if (!clean) throw new Error('A title needs letters in it.');
  return mutate(state, (s) => {
    const r = s.releases.find((x) => x.id === id);
    if (!r) throw new Error('No such record.');
    const was = r.title;
    r.title = clean;
    log(s, `"${was}" is now called "${clean}". The sleeves are reprinted; the first pressing is worth something to collectors already.`, 'neutral');
  });
}

export function renameSong(state: GameState, oldTitle: string, title: string): GameState {
  const clean = title.replace(/\s+/g, ' ').trim().slice(0, 60);
  if (!clean) throw new Error('A title needs letters in it.');
  if (state.songs.some((x) => x.title === clean)) throw new Error('There is already a song called that.');
  return mutate(state, (s) => {
    const x = s.songs.find((y) => y.title === oldTitle);
    if (!x) throw new Error('No such song.');
    x.title = clean;
    for (const r of s.releases) if (r.title === oldTitle && r.kind !== 'album') r.title = clean;
    log(s, `"${oldTitle}" is now "${clean}". It was always "${clean}", the band says.`, 'neutral');
  });
}

/** Bin a song that never came out. The writer may mind. */
export function dropSong(state: GameState, title: string): GameState {
  const x = state.songs.find((y) => y.title === title);
  if (!x) throw new Error('No such song.');
  if (x.released || x.lifted) throw new Error('It is out. You cannot unrelease a record.');
  if (state.pending) throw new Error('Deal with the situation first.');
  return mutate(state, (s, rng) => {
    s.songs = s.songs.filter((y) => y.title !== title);
    const w = s.members.find((m) => m.id === x.writer);
    if (w && !w.isPlayer && w.hidden.ego >= 55 && x.kind !== 'cover' && x.kind !== 'hired') {
      adjust(w, 'mood', -4);
      log(s, `"${title}" went in the bin. ${first(w)} took it ${rng.chance(0.5) ? 'personally, and said so' : 'quietly, which is worse'}.`, 'neutral');
    } else {
      log(s, `"${title}" went in the bin. ${rng.pick(['Nobody will miss it.', 'The chorus will turn up in something else.', 'The drummer kept the tape, for some reason.'])}`, 'neutral');
    }
  });
}

/** Change the band deal. Whoever loses by it remembers. */
export function setSplit(state: GameState, split: Split): GameState {
  if (state.pending) throw new Error('Deal with the situation first.');
  if ((state.split ?? 'equal') === split) return state;
  return mutate(state, (s) => {
    const before = shares(s, 'albums');
    s.split = split;
    const after = shares(s, 'albums');
    const me = player(s);
    for (const m of s.members) {
      if (m.isPlayer) continue;
      const d = (after[m.id] ?? 0) - (before[m.id] ?? 0);
      if (d < -0.02) { adjust(m, 'mood', -10); addAffinity(s, m.id, me.id, -8); m.hidden.loyalty = clamp(m.hidden.loyalty - 4, 1, 99); }
      else if (d > 0.02) { adjust(m, 'mood', 8); addAffinity(s, m.id, me.id, 5); }
    }
    milestone(s, 'drama', `The band deal changed: ${SPLIT_LABEL[split].toLowerCase()}.`);
    log(s, `New band deal: ${SPLIT_LABEL[split].toLowerCase()}. ${split === 'leader' ? 'A lawyer drew it up. The band signed it in the order they were asked.' : split === 'writers' ? 'The writers nodded. The rhythm section looked at the floor.' : 'Everybody gets the same. The one who writes everything smiled with their teeth.'}`, 'neutral');
  });
}

export function fire(state: GameState, memberId: string): GameState {
  if (state.pending) throw new Error('Deal with the situation first.');
  return mutate(state, (s) => removeMember(s, memberId, 'fired'));
}

// ---------------------------------------------------------------- week end

/**
 * How far the band's records travel. A major's international arm carries them; an indie barely gets past
 * Dover; touring a region builds an audience that buys there.
 */
export function reach(s: GameState): { us: number; europe: number; world: number } {
  const tier = s.contract ? labelById(s.contract.label).tier : null;
  const dist = tier === 'major' ? 1 : tier === 'indie' ? 0.35 : tier === 'shark' ? 0.25 : 0.1;
  const toured = (r: string) => Math.min(1, (s.flags[`toured_${r}`] ?? 0) / 2);
  return {
    us: Math.min(1, dist * 0.4 + toured('northamerica') * 0.4 + toured('world') * 0.1 + Math.min(0.3, (s.flags.bigVideos ?? 0) * 0.15)),
    europe: Math.min(1, dist * 0.6 + toured('europe') * 0.25 + toured('ukeurope') * 0.25),
    world: Math.min(1, dist * 0.5 + toured('northamerica') * 0.3 + toured('world') * 0.2 + toured('japan') * 0.15 + Math.min(0.3, (s.flags.bigVideos ?? 0) * 0.15)),
  };
}

/** Weekly cost of keeping the band alive. Fame brings wages, crew, flats and hangers-on. */
export function upkeep(s: GameState): number {
  return 10 + s.members.length * 6 + (s.flags.rentUp ?? 0) + Math.round(s.fans * 0.02) + viceBill(s) + splurge(s) + toyUpkeep(s);
}

/** Habits cost money, and famous habits cost more. */
export function viceBill(s: GameState): number {
  return Math.round(s.members.reduce((a, m) => a + Math.max(0, m.habit - 30), 0) * 0.5 * (1 + s.fans / 20000));
}

/** Money burns a hole: rock stars spend 2% of everything over £20,000 every week. */
export function splurge(s: GameState): number {
  return Math.max(0, Math.round((s.money - 20000) * 0.02));
}

/** Tax: every April the Revenue takes 40% of what the band made over the year, above a £5,000 allowance. */
export const TAX_RATE = 0.4;
export const TAX_ALLOWANCE = 5000;
function taxYear(s: GameState): void {
  // The tax year ends in the first week of April: week 13 of each year.
  if (s.week % 52 !== 13) return;
  const base = s.flags.taxBase ?? 0;
  const gain = s.money - base - TAX_ALLOWANCE;
  if (gain > 0) {
    const bill = Math.round(gain * TAX_RATE);
    const paid = Math.min(bill, Math.max(0, s.money));
    s.money -= paid;
    log(s, `The tax year is over. The Revenue wants £${bill.toLocaleString('en-GB')}, 40% of what you made above the allowance.${paid < bill ? ' Your accountant found a loophole for the rest. Do not ask.' : ''}`, 'bad');
    if (bill >= 10000 && s.flags.taxman === undefined) { s.flags.taxman = s.week; milestone(s, 'career', `First big tax bill: £${bill.toLocaleString('en-GB')}.`); }
  }
  s.flags.taxBase = s.money;
}

/** Weeks without a gig, tour or release before casual fans start drifting away. */
export const FAN_FADE_AFTER = 6;

/** Out of sight, out of mind: an idle band loses casual fans, never the core ones. */
function fadeFans(s: GameState): void {
  // People grow up, move on, get mortgages: half a per cent of casual fans drift off every week regardless.
  const casualNow = s.fans - (s.flags.coreFans ?? 0);
  // A fan club keeps a few more of them writing in.
  // A huge fan base churns slower in proportion: the world is a bigger pool and it forgets more slowly.
  if (casualNow > 200) s.fans -= Math.round(casualNow * (s.flags.fanClub !== undefined ? 0.004 : 0.005) / (1 + casualNow / 800000));
  if (s.tour) return;
  const lastRelease = s.releases.reduce((a, r) => Math.max(a, r.week), -99);
  const lastSeen = Math.max(s.lastGigWeek ?? -99, lastRelease, s.flags.lastTourWeek ?? -99, 0);
  const idle = s.week - lastSeen;
  if (idle < FAN_FADE_AFTER) return;
  const core = s.flags.coreFans ?? 0;
  const casual = s.fans - core;
  if (casual <= 0) return;
  const loss = Math.max(1, Math.round(casual * 0.02));
  s.fans -= Math.min(loss, casual);
  if (idle === FAN_FADE_AFTER || idle % 8 === 0) log(s, `${idle} weeks without a gig or a record. Casual fans are finding other bands.`, 'bad');
}

function endOfWeek(s: GameState, rng: Rng): void {
  const lifestyle = upkeep(s) - (10 + s.members.length * 6 + (s.flags.rentUp ?? 0));
  const cost = upkeep(s);
  s.money -= cost;
  if (s.money < 0) {
    for (const m of s.members) adjust(m, 'mood', -4);
    log(s, `Rent and food cost £${cost}. You are £${-s.money} in the red.`, 'bad');
  } else if (lifestyle >= 100 && s.week % 13 === 0) {
    const bits = [splurge(s) >= 200 && 'a Rolls-Royce nobody can drive', viceBill(s) >= 100 && 'a dealer on a retainer', 'wages, crew and a flat each'].filter(Boolean);
    log(s, `Fame is expensive: ${bits.join(', ')}. £${cost.toLocaleString('en-GB')} a week now.`, 'neutral');
  }
  taxYear(s);
  s.buzz = clamp(s.buzz - Math.ceil(s.buzz * 0.06), 0, 100);
  fadeFans(s);
  if (s.flags.homeHeat) s.flags.homeHeat = Math.round(s.flags.homeHeat * 0.85 * 100) / 100;
  labelWeek(s, rng);
  catalogueWeek(s, rng);
  fanClubWeek(s);
  { const rent = studioRent(s); if (rent) { s.money += rent; earn(s, 'other', rent); if (s.week % 13 === 0) log(s, `Studio hire this quarter: other bands paid £${(rent * 13).toLocaleString('en-GB')} to record where you record.`, 'good'); } }
  splitWeek(s, rng);
  const ruin = ruinWeek(s, rng);
  if (ruin) { s.flags.ruined = 1; s.flags.ruinReason = 1; }
  managerWeek(s, rng);
  remembranceWeek(s);
  postWeek(s, rng);
  flopWatch(s);
  fashionDrift(s);
  toyWeek(s, rng);
  deathWeek(s, rng);
  if (s.money < SKINT) {
    // Skint: everyone picks up shifts somewhere.
    // Enough to keep a roof overhead, not enough to get anywhere.
    s.money += 10 + s.members.length * 6;
    for (const m of s.members) {
      adjust(m, 'energy', -6);
      adjust(m, 'mood', -2);
    }
    log(s, 'Skint again. Everyone pulled shifts at the warehouse and the chip shop.', 'neutral');
  }
  // Shifts keep you alive, not housed: months on end without real money and the landlord loses patience.
  if (s.money < SKINT) s.flags.skintWeeks = (s.flags.skintWeeks ?? 0) + 1;
  else if (s.money >= 100) s.flags.skintWeeks = 0;
  const sk = s.flags.skintWeeks ?? 0;
  if (sk === 6) log(s, 'Six weeks of back rent. The landlord has started leaving notes. Mum has lent you twenty quid and a look.', 'bad');
  if (sk === 12) log(s, `The landlord's final warning: four weeks to find the rent or you are out. Get some proper money in.`, 'bad');

  for (const m of [...s.members]) {
    m.weeksInBand++;
    getToKnow(m, 2);
    if (m.outWeeks > 0) m.outWeeks--;
    if (m.outWeeks === 0 && m.soloOut) soloReturn(s, m, rng);
    adjust(m, 'energy', 8);
    m.mood = clamp(Math.round(m.mood + (55 - m.mood) * 0.15), 0, 100);
    if (m.habit > 30) adjust(m, 'habit', 1);
    ageAndBurnout(s, m, rng);

    if (m.isPlayer) {
      if (m.habit >= 40) revealLog(s, m, 'vice', 1);
      if (m.habit >= 70) revealLog(s, m, 'vice', 2);
    } else if ([4, 10, 18, 30].includes(m.weeksInBand)) {
      const unknown = HIDDEN_TRAITS.filter((t) => m.known[t] === 0);
      const rough = HIDDEN_TRAITS.filter((t) => m.known[t] === 1);
      if (unknown.length) revealLog(s, m, rng.pick(unknown), 1);
      else if (rough.length && m.weeksInBand >= 10) revealLog(s, m, rng.pick(rough), 2);
    }

    if (m.habit >= 85 && m.outWeeks === 0 && rng.chance(0.3)) {
      m.outWeeks = 3;
      m.habit = 45;
      s.money -= 60;
      log(s, `${m.isPlayer ? 'You collapsed' : `${first(m)} collapsed`} backstage. Three weeks in the clinic.`, 'bad');
      milestone(s, 'drama', `${m.isPlayer ? 'You' : m.name} spent three weeks in the clinic.`);
      revealLog(s, m, 'vice', 2);
    }

    if (!m.isPlayer && m.mood < 20 && rng.chance((100 - m.hidden.loyalty) / 150)) {
      removeMember(s, m.id, 'quit');
      log(s, `${m.name} quit. Left a note on the drum stool: "Good luck. You'll need it."`, 'bad');
    }
  }

  { const r = reach(s); s.flags.reachBonus = Math.round((r.us + r.europe + r.world) * 100) / 100; }
  const records = sellRecords(s, rng, heatCurve);
  certify(s);
  const sold = records.reduce((a, r) => a + r.units, 0);
  if (sold > 0) log(s, `Record sales this week: ${sold} copies.`, 'good');

  managerKnock(s, rng);
  rollEvents(s, rng);

  for (const n of advanceWorld(s.world, rng, s.week, { bandName: s.bandName, fans: s.fans, buzz: s.buzz, records, reach: reach(s), label: s.contract ? labelById(s.contract.label).name : 'Unsigned' })) {
    log(s, n.text, n.tone);
    if (n.milestone) milestone(s, 'chart', n.text);
  }
  // Each record remembers its best position on each chart.
  for (const c of Object.keys(s.world.charts) as ChartId[]) {
    for (const e of s.world.charts[c]) {
      if (!e.isPlayer || !e.id.startsWith('player-')) continue;
      const r = s.releases.find((x) => x.id === e.id.slice(7));
      if (!r) continue;
      const peaks = (r.peaks ??= {});
      peaks[c] = Math.min(peaks[c] ?? 99, e.pos);
    }
  }

  s.week++;
  awardsNight(s, rng);
  checkOver(s);
}

/** New Year birthdays, decline after thirty, and talent quietly burned away by habits. */
function ageAndBurnout(s: GameState, m: Musician, rng: Rng): void {
  if (s.week % 52 === 51) {
    m.age++;
    if (m.age >= 31) {
      const loss = Math.min(4, m.age - 30);
      m.hidden.potential = clamp(m.hidden.potential - rng.int(1, loss + 1), 1, 99);
      m.hidden.stamina = clamp(m.hidden.stamina - rng.int(1, loss + 1), 1, 99);
      adjust(m, 'skill', -rng.int(0, Math.ceil(loss / 2)));
    }
  }
  if (m.habit >= 70 && rng.chance(0.08)) m.hidden.potential = clamp(m.hidden.potential - 1, 1, 99);
  // Living beyond your ceiling doesn't last.
  if (m.skill > m.hidden.potential && rng.chance(0.1)) adjust(m, 'skill', -1);
}

function checkOver(s: GameState): void {
  if (s.over) return;
  // Milestones: the story goes on.
  if (!s.flags.labelCalling && s.fans >= LABEL_FANS && s.buzz >= LABEL_BUZZ) {
    s.flags.labelCalling = s.week;
    milestone(s, 'career', 'The record labels started calling.');
    log(s, `Milestone: an A&R man from Blackhat Records wants to "do lunch". The labels have noticed ${s.bandName}.`, 'good');
  }
  if (!s.flags.chartedNational && s.world.peaks.uk !== undefined) {
    s.flags.chartedNational = s.week;
    milestone(s, 'career', 'First record in the National Top 40.');
    log(s, `Milestone: a record in the National Top 40 with no label behind it. Every A&R man in London wants to buy you lunch.`, 'good');
  }
  if (s.flags.ruined) {
    s.over = { won: false, reason: s.flags.ruinReason === 1 ? 'Big Tony stopped sending lads and sent a lorry. Everything went, including the name. The band is over.' : 'The landlord changed the locks and the van got repossessed. The band is over.' };
  } else if ((s.money < overdraft(s) || (s.flags.skintWeeks ?? 0) >= SKINT_WEEKS) && !s.tour) {
    // One last bad idea before the locks change, once every couple of years.
    if (!s.pending && (s.flags.lastChance === undefined || s.week - s.flags.lastChance >= 104)) {
      s.flags.lastChance = s.week;
      s.flags.lastChanceOpen = 1;
      s.flags.skintWeeks = 0;
      s.pending = { def: 'last_chance', params: {}, week: s.week };
      log(s, 'The landlord is on the stairs. One more bad idea, or it is over.', 'bad');
    } else if (!s.pending) {
      s.over = { won: false, reason: 'The landlord changed the locks and the van got repossessed. The band is over.' };
    }
  } else if (s.members.filter((m) => !m.isPlayer).length === 0 && s.candidates.length === 0 && s.flags.aloneSince !== undefined && s.week - s.flags.aloneSince > 12) {
    s.over = { won: false, reason: 'Three months with no band. You sell your stage clothes at Camden market. It is over.' };
  } else if (s.week >= DEADLINE_WEEK) {
    const best = s.world.peaks.world ?? s.world.peaks.uk;
    const big = s.fans >= 30000 ? 'Legends.' : s.fans >= 8000 ? 'A proper rock band.' : s.fans >= 1500 ? 'A cult band with a loyal following.' : 'A local band that nearly made it.';
    s.over = {
      won: s.fans >= 5000,
      reason: `The eighties are over. ${s.bandName}: ${big} ${careerSummary(s)}${best ? ` Best chart position #${best}.` : ''}`,
    };
  }
  if (s.members.filter((m) => !m.isPlayer).length === 0) s.flags.aloneSince ??= s.week;
  else delete s.flags.aloneSince;
  if (s.over) {
    s.pending = null;
    s.tour = null;
    log(s, s.over.reason, s.over.won ? 'good' : 'bad');
  }
}

/** Back from making a solo record: better at the job, and a little less sure whose job it is. */
export function soloReturn(s: GameState, m: Musician, rng: Rng): void {
  delete m.soloOut;
  const hit = rng.chance(clamp(0.25 + m.writing / 200 + s.fans / 2000000, 0.2, 0.7));
  grow(m, 'skill', 2, rng);
  grow(m, 'writing', 2, rng);
  if (hit) {
    adjust(m, 'image', 4); adjust(m, 'mood', 6);
    m.hidden.loyalty = clamp(m.hidden.loyalty - 10, 1, 99);
    addBuzz(s, 6);
    log(s, `${first(m)} is back. The solo record went in at number twelve, the reviews used the word "liberated", and ${first(m)} has a new way of standing in photographs.`, 'neutral');
  } else {
    adjust(m, 'mood', -4);
    m.hidden.loyalty = clamp(m.hidden.loyalty + 6, 1, 99);
    log(s, `${first(m)} is back. The solo record sold to relatives. ${first(m)} is quieter, better, and has not mentioned it once.`, 'neutral');
  }
  milestone(s, 'lineup', `${m.name} came back from a solo record${hit ? ' that charted' : ' that did not'}.`);
}
