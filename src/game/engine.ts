import { Rng, clamp } from './rng';
import { HIDDEN_TRAITS, ROLE_LABEL, createPlayer, generateStartingBand, getToKnow, rollPotential } from './characters';
import { addAffinity, available, forEachPair } from './chemistry';
import { bandName as genBandName } from './names';
import { advanceWorld, createWorld, heatCurve } from './world';
import { ACTION_LABEL, actionOptions, optionLocked, perform, sellRecords } from './actions';
import { rollEvents } from './events';
import { tierById } from './tour';
import { adjust, beat, first, log, logEffects, mutate, openScene, removeMember, revealLog, snapshot } from './helpers';
import type { Action, GameState, Musician, NewGameInput } from './types';

export { first } from './helpers';

export const START_YEAR = 1982;
export const DEADLINE_WEEK = 520; // end of 1991, when the decade and the game end
/** Fans and buzz at which record labels start calling. A milestone, not the end. */
export const LABEL_FANS = 1000;
export const LABEL_BUZZ = 55;
export const MAX_MEMBERS = 6;
export const BROKE_LIMIT = -250;

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
  const mates = generateStartingBand(rng, input.style, id, player.realName);
  const s: GameState = {
    version: 1,
    rng: 0,
    week: 0,
    bandName: input.bandName.trim() || genBandName(rng),
    money: input.background === 'posh' ? 450 : 200,
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
    pending: null,
    scene: null,
    tour: null,
  };
  s.world = createWorld(rng, s.bandName);
  advanceWorld(s.world, rng, 0, { bandName: s.bandName, fans: 0, buzz: 0 });
  forEachPair(s.members, (a, b) => addAffinity(s, a.id, b.id, rng.int(5, 35)));
  openScene(s, 'start', `London, ${dateLabel(0)}`, 'quiet');
  log(s, `London, ${dateLabel(0)}. ${s.bandName} is you and three mates from the pub. ${mates.map((m) => `${m.name} (${ROLE_LABEL[m.role].toLowerCase()})`).join(', ')}.`, 'neutral');
  log(s, 'You have a rehearsal room above a kebab shop, a handful of covers and no original songs.', 'neutral');
  beat(s, undefined, 'First week. What does the band do?');
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
  s.scene ??= null;
  s.tour ??= null;
  for (const song of s.songs) {
    song.kind ??= 'standard';
    song.genre ??= s.members[0].style;
    song.released ??= false;
  }
  for (const st of s.world.stars) st.age ??= 6;
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
    s.members.push(c);
    log(s, `${c.name} joins ${s.bandName} on ${ROLE_LABEL[c.role].toLowerCase()}.`, 'good');
  });
}

export function fire(state: GameState, memberId: string): GameState {
  if (state.pending) throw new Error('Deal with the situation first.');
  return mutate(state, (s) => removeMember(s, memberId, 'fired'));
}

// ---------------------------------------------------------------- week end

function endOfWeek(s: GameState, rng: Rng): void {
  const cost = 10 + s.members.length * 6 + (s.flags.rentUp ?? 0);
  s.money -= cost;
  if (s.money < 0) {
    for (const m of s.members) adjust(m, 'mood', -4);
    log(s, `Rent and food cost £${cost}. You are £${-s.money} in the red.`, 'bad');
  }
  s.buzz = clamp(s.buzz - Math.ceil(s.buzz * 0.06), 0, 100);
  if (s.money < 50) {
    // Skint: everyone picks up shifts somewhere.
    s.money += 8 * s.members.length;
    for (const m of s.members) {
      adjust(m, 'energy', -6);
      adjust(m, 'mood', -2);
    }
    log(s, 'Skint again. Everyone pulled shifts at the warehouse and the chip shop.', 'neutral');
  }

  for (const m of [...s.members]) {
    m.weeksInBand++;
    getToKnow(m, 2);
    if (m.outWeeks > 0) m.outWeeks--;
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
      revealLog(s, m, 'vice', 2);
    }

    if (!m.isPlayer && m.mood < 20 && rng.chance((100 - m.hidden.loyalty) / 150)) {
      removeMember(s, m.id, 'quit');
      log(s, `${m.name} quit. Left a note on the drum stool: "Good luck. You'll need it."`, 'bad');
    }
  }

  const records = sellRecords(s, rng, heatCurve);
  const sold = records.reduce((a, r) => a + r.units, 0);
  if (sold > 0) log(s, `Record sales this week: ${sold} copies.`, 'good');

  rollEvents(s, rng);

  for (const n of advanceWorld(s.world, rng, s.week, { bandName: s.bandName, fans: s.fans, buzz: s.buzz, records })) log(s, n.text, n.tone);

  s.week++;
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
    log(s, `Milestone: an A&R man from Blackhat Records wants to "do lunch". The labels have noticed ${s.bandName}.`, 'good');
  }
  if (!s.flags.chartedNational && s.world.peaks.uk !== undefined) {
    s.flags.chartedNational = s.week;
    log(s, `Milestone: a record in the National Top 40 with no label behind it. Every A&R man in London wants to buy you lunch.`, 'good');
  }
  if (s.money < BROKE_LIMIT && !s.tour) {
    s.over = { won: false, reason: 'The landlord changed the locks and the van got repossessed. The band is over.' };
  } else if (s.members.filter((m) => !m.isPlayer).length === 0 && s.candidates.length === 0 && s.flags.aloneSince !== undefined && s.week - s.flags.aloneSince > 12) {
    s.over = { won: false, reason: 'Three months with no band. You sell your stage clothes at Camden market. It is over.' };
  } else if (s.week >= DEADLINE_WEEK) {
    const best = s.world.peaks.world ?? s.world.peaks.uk;
    const big = s.fans >= 30000 ? 'Legends.' : s.fans >= 8000 ? 'A proper rock band.' : s.fans >= 1500 ? 'A cult band with a loyal following.' : 'A local band that nearly made it.';
    s.over = {
      won: s.fans >= 5000,
      reason: `The eighties are over. ${s.bandName}: ${s.fans.toLocaleString('en-GB')} fans${best ? `, best chart position #${best}` : ''}. ${big}`,
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
