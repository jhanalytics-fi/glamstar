import { Rng, clamp } from './rng';
import { HIDDEN_TRAITS, ROLE_LABEL, createPlayer, generateMusician, generateStartingBand, reveal, type Tier } from './characters';
import { addAffinity, available, chemistry, forEachPair, getAffinity, missingForGig, performance } from './chemistry';
import { PRESS, bandName as genBandName, bestVenue, songTitle } from './names';
import type { Action, GameState, HiddenTrait, LogEntry, Musician, NewGameInput, Role } from './types';

export const START_YEAR = 1982;
export const DEADLINE_WEEK = 104; // end of 1983 for the prototype
export const WIN_FANS = 1000;
export const WIN_BUZZ = 55;
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
  const mates = generateStartingBand(rng, input.style, id, player.name);
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
  };
  forEachPair(s.members, (a, b) => addAffinity(s, a.id, b.id, rng.int(5, 35)));
  log(s, `London, ${dateLabel(0)}. ${s.bandName} is you and three mates from the pub. ${mates.map((m) => `${m.name} (${ROLE_LABEL[m.role].toLowerCase()})`).join(', ')}.`, 'neutral');
  log(s, 'You have a rehearsal room above a kebab shop, a handful of covers and no original songs.', 'neutral');
  s.rng = rng.state;
  return s;
}

function log(s: GameState, text: string, tone: LogEntry['tone'] = 'neutral'): void {
  s.log.push({ week: s.week, text, tone });
  if (s.log.length > 150) s.log.splice(0, s.log.length - 150);
}

function revealLog(s: GameState, m: Musician, t: HiddenTrait, level: 1 | 2): void {
  if (reveal(m, t, level)) {
    const what = level === 2 ? 'now know exactly' : 'have a feel for';
    log(s, `You ${what} ${m.isPlayer ? 'your own' : `${first(m)}'s`} ${t}.`, 'reveal');
  }
}

export function first(m: Musician): string {
  return m.name.split(' ')[0];
}

function player(s: GameState): Musician {
  return s.members.find((m) => m.isPlayer)!;
}

function mutate(state: GameState, fn: (s: GameState, rng: Rng) => void): GameState {
  const s = structuredClone(state);
  const rng = new Rng(s.rng);
  fn(s, rng);
  s.rng = rng.state;
  return s;
}

// ---------------------------------------------------------------- actions

export function canAct(s: GameState, a: Action): string | null {
  if (s.over) return 'The game is over.';
  switch (a.type) {
    case 'gig': {
      const miss = missingForGig(s);
      return miss.length ? `You need ${miss.join(' and ')} to gig.` : null;
    }
    case 'party':
      return s.money < 15 ? 'You cannot afford a round, let alone a party.' : null;
    case 'advertise':
      return s.money < 12 ? 'An ad costs £12.' : null;
    default:
      return null;
  }
}

export function act(state: GameState, a: Action): GameState {
  const why = canAct(state, a);
  if (why) throw new Error(why);
  return mutate(state, (s, rng) => {
    switch (a.type) {
      case 'rehearse': rehearse(s, rng); break;
      case 'write': write(s, rng); break;
      case 'gig': gig(s, rng); break;
      case 'party': party(s, rng); break;
      case 'rest': rest(s); break;
      case 'advertise': advertise(s, rng, a.role); break;
    }
    if (a.type !== 'rehearse') s.tightness = clamp(s.tightness - 1, 0, 100);
    endOfWeek(s, rng);
  });
}

function rehearse(s: GameState, rng: Rng): void {
  const here = available(s);
  let gain = 6 + Math.round(chemistry(s).total / 25);
  for (const m of here) {
    if (!m.isPlayer && m.hidden.reliability < 40 && rng.chance(0.45)) {
      log(s, `${first(m)} turned up two hours late, smelling of last night.`, 'bad');
      revealLog(s, m, 'reliability', 1);
      addAffinity(s, m.id, 'p', -3);
      gain = Math.floor(gain / 2);
    }
    if (rng.chance((75 - m.skill) / 100)) m.skill = clamp(m.skill + 1, 1, 99);
    if (rng.chance(0.15)) m.stage = clamp(m.stage + 1, 1, 99);
    m.energy = clamp(m.energy - 8, 0, 100);
  }
  forEachPair(here, (a, b) => {
    const clash = a.hidden.ego >= 70 && b.hidden.ego >= 70;
    addAffinity(s, a.id, b.id, rng.int(-3, 6) - (clash ? 8 : 0));
    if (clash && rng.chance(0.3)) {
      log(s, `${first(a)} and ${first(b)} argued for an hour about whose part is louder.`, 'bad');
      revealLog(s, a, 'ego', 1);
      revealLog(s, b, 'ego', 1);
    }
  });
  s.tightness = clamp(s.tightness + gain, 0, 100);
  log(s, `Rehearsal. The band is getting tighter (${s.tightness}).`, 'good');
}

function write(s: GameState, rng: Rng): void {
  const here = available(s);
  const writers = [...here].sort((a, b) => b.writing - a.writing);
  const best = writers[0];
  const second = writers[1] ?? best;
  const n = rng.chance(0.4) ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const quality = clamp(Math.round(best.writing * 0.45 + second.writing * 0.25 + chemistry(s).total * 0.2 + rng.int(-10, 15)), 1, 99);
    const title = songTitle(rng);
    s.songs.push({ title, quality, writer: best.id });
    log(s, `New song: "${title}" (${quality}), mostly ${best.isPlayer ? 'yours' : `${first(best)}'s`}.`, quality >= 55 ? 'good' : 'neutral');
  }
  if (best !== second && best.hidden.ego >= 65 && second.hidden.ego >= 65 && second.writing >= 40) {
    addAffinity(s, best.id, second.id, -10);
    log(s, `${first(best)} and ${first(second)} both claim the chorus was their idea.`, 'bad');
    revealLog(s, best, 'ego', 1);
    revealLog(s, second, 'ego', 1);
  }
  for (const m of here) m.energy = clamp(m.energy - 5, 0, 100);
}

function gig(s: GameState, rng: Rng): void {
  const venue = bestVenue(s.fans);
  const wasted = new Set<string>();
  for (const m of available(s)) {
    const p = (m.habit / 100) * 0.45 + ((100 - m.hidden.reliability) / 100) * 0.15;
    if (rng.chance(p * 0.6)) {
      wasted.add(m.id);
      log(s, m.isPlayer ? 'You were too far gone to remember the second verse.' : `${first(m)} was too wasted to play straight.`, 'bad');
      revealLog(s, m, m.habit >= 40 ? 'vice' : 'reliability', 1);
    }
  }
  const perf = performance(s, wasted);
  const crowd = clamp(Math.round(s.fans * 0.5 + 12 + s.buzz * 0.8 + rng.int(-8, 10)), 6, venue.capacity);
  const pay = venue.fee + Math.round(crowd * 2 * 0.6);
  const fanDelta = Math.max(Math.round((crowd * (perf - 42)) / 90), -Math.round(crowd * 0.1));
  s.money += pay;
  s.fans = Math.max(0, s.fans + fanDelta);
  s.buzz = clamp(Math.round(s.buzz + Math.max(0, (perf - 45) / 5) + crowd / 60), 0, 100);
  s.lastGigWeek = s.week;
  const verdict = perf >= 75 ? 'Storming.' : perf >= 55 ? 'A solid night.' : perf >= 40 ? 'Ropey.' : 'A shambles.';
  log(s, `Gig at ${venue.name}: ${crowd} people, £${pay}. ${verdict} Fans ${fanDelta >= 0 ? '+' : ''}${fanDelta}.`, perf >= 55 ? 'good' : 'bad');

  for (const m of available(s)) {
    m.energy = clamp(Math.round(m.energy - 22 * (1.4 - m.hidden.stamina / 100)), 0, 100);
    m.mood = clamp(m.mood + (perf >= 50 ? 5 : perf < 40 ? -6 : 0), 0, 100);
    m.habit = clamp(m.habit + Math.round((m.hidden.vice / 50) * rng.int(0, 2)), 0, 100);
    if (m.energy < 25) revealLog(s, m, 'stamina', 1);
  }
  if (rng.chance(0.12 + s.buzz / 300)) {
    if (perf >= 60) {
      s.buzz = clamp(s.buzz + 6, 0, 100);
      log(s, `${PRESS} was there: "${rng.pick(['Ear-splitting and gorgeous', 'Leather, lipgloss and a lot of noise', 'The best thing in Camden on a Tuesday'])}."`, 'good');
    } else {
      s.buzz = clamp(s.buzz - 3, 0, 100);
      log(s, `${PRESS} was there: "${rng.pick(['Like a pub fight with amplifiers', 'Avoid', 'Hair: 9/10. Music: see me after class'])}."`, 'bad');
    }
  }
}

function party(s: GameState, rng: Rng): void {
  s.money -= 15;
  const here = available(s);
  for (const m of here) {
    m.mood = clamp(m.mood + 14, 0, 100);
    m.energy = clamp(m.energy - 12, 0, 100);
    m.habit = clamp(m.habit + Math.round((m.hidden.vice / 100) * rng.int(2, 8)), 0, 100);
  }
  forEachPair(here, (a, b) => addAffinity(s, a.id, b.id, rng.int(1, 6)));
  const wildest = [...here].sort((a, b) => b.hidden.vice - a.hidden.vice)[0];
  log(s, `Party at the squat. ${wildest.isPlayer ? 'You were' : `${first(wildest)} was`} still going at six in the morning.`, 'neutral');
  revealLog(s, wildest, 'vice', 1);
  if (rng.chance(0.2)) {
    s.buzz = clamp(s.buzz + 4, 0, 100);
    log(s, 'Word gets round. People are talking about the band, if not the music.', 'good');
  }
  const risky = here.find((m) => m.hidden.vice >= 75 && m.habit >= 40);
  if (risky && rng.chance(0.25)) {
    risky.outWeeks = Math.max(risky.outWeeks, 1);
    s.money -= 30;
    log(s, `${risky.isPlayer ? 'You ended' : `${first(risky)} ended`} the night in A&E. Out for a week.`, 'bad');
    revealLog(s, risky, 'vice', 2);
  }
}

function rest(s: GameState): void {
  for (const m of s.members) {
    m.energy = clamp(m.energy + (m.habit > 50 ? 20 : 35), 0, 100);
    m.mood = clamp(m.mood + 4, 0, 100);
    m.habit = clamp(m.habit - 8, 0, 100);
    if (m.habit >= 50) {
      m.mood = clamp(m.mood - 6, 0, 100);
      log(s, `${m.isPlayer ? 'You spent' : `${first(m)} spent`} the quiet week climbing the walls.`, 'bad');
    }
  }
  log(s, 'A quiet week. Sleep, toast and daytime telly.', 'neutral');
}

function advertise(s: GameState, rng: Rng, role: Role): void {
  s.money -= 12;
  const pGood = clamp(0.2 + s.fans / 2000 + s.buzz / 300, 0, 0.7);
  s.candidates = [0, 1, 2].map(() => {
    const r = rng.next();
    const tier: Tier = r < pGood ? 'good' : r < pGood + 0.45 ? 'average' : 'weak';
    const c = generateMusician(rng, `m${s.nextId++}`, role, tier, player(s).style, s.members.map((m) => m.name));
    const t = rng.pick(HIDDEN_TRAITS);
    reveal(c, t, 1);
    return c;
  });
  s.candidateRole = role;
  log(s, `Ad in ${PRESS}: "${ROLE_LABEL[role]} wanted. Image essential." Three hopefuls turned up to audition.`, 'neutral');
  const current = s.members.find((m) => m.role === role && !m.isPlayer);
  if (current) {
    current.mood = clamp(current.mood - 8, 0, 100);
    addAffinity(s, current.id, 'p', -8);
    log(s, `${first(current)} saw the ad. Awkward.`, 'bad');
  }
}

// ---------------------------------------------------------------- free actions

export function hire(state: GameState, candidateId: string, replaceId?: string): GameState {
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
  return mutate(state, (s) => removeMember(s, memberId, 'fired'));
}

function removeMember(s: GameState, id: string, how: 'fired' | 'quit' | 'poached'): void {
  const m = s.members.find((x) => x.id === id);
  if (!m || m.isPlayer) throw new Error('You cannot fire yourself. Yet.');
  s.members = s.members.filter((x) => x.id !== id);
  for (const o of s.members) {
    const liked = getAffinity(s, o.id, id);
    if (how === 'fired' && liked > 30 && !o.isPlayer) {
      o.mood = clamp(o.mood - 8, 0, 100);
      addAffinity(s, o.id, 'p', -10);
    }
  }
  for (const k of Object.keys(s.affinity)) if (k.split('|').includes(id)) delete s.affinity[k];
  if (how === 'fired') log(s, `You fired ${m.name}. ${rng0(m)}`, 'bad');
}

function rng0(m: Musician): string {
  return m.hidden.ego >= 70 ? 'Took the good amp on the way out.' : 'Took it better than expected.';
}

// ---------------------------------------------------------------- week end

function endOfWeek(s: GameState, rng: Rng): void {
  const cost = 10 + s.members.length * 6;
  s.money -= cost;
  if (s.money < 0) {
    for (const m of s.members) m.mood = clamp(m.mood - 4, 0, 100);
    log(s, `Rent and food cost £${cost}. You are £${-s.money} in the red.`, 'bad');
  }
  s.buzz = clamp(s.buzz - Math.ceil(s.buzz * 0.06), 0, 100);
  if (s.money < 50) {
    // Skint: everyone picks up shifts somewhere.
    s.money += 8 * s.members.length;
    for (const m of s.members) {
      m.energy = clamp(m.energy - 6, 0, 100);
      m.mood = clamp(m.mood - 2, 0, 100);
    }
    log(s, 'Skint again. Everyone pulled shifts at the warehouse and the chip shop.', 'neutral');
  }

  for (const m of [...s.members]) {
    m.weeksInBand++;
    if (m.outWeeks > 0) m.outWeeks--;
    m.energy = clamp(m.energy + 8, 0, 100);
    m.mood = clamp(Math.round(m.mood + (55 - m.mood) * 0.15), 0, 100);
    if (m.habit > 30) m.habit = clamp(m.habit + 1, 0, 100);

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

  if (rng.chance(0.3)) randomEvent(s, rng);

  s.week++;
  checkOver(s);
}

function checkOver(s: GameState): void {
  if (s.over) return;
  if (s.fans >= WIN_FANS && s.buzz >= WIN_BUZZ) {
    s.over = { won: true, reason: `An A&R man from Blackhat Records was at the Odeum. He wants to "do lunch". ${s.bandName} is about to get signed, and ripped off. To be continued.` };
  } else if (s.money < BROKE_LIMIT) {
    s.over = { won: false, reason: 'The landlord changed the locks and the van got repossessed. The band is over.' };
  } else if (s.week >= DEADLINE_WEEK) {
    s.over = { won: false, reason: 'Two years on the circuit and nobody signed you. Everyone has a day job now.' };
  }
  if (s.over) log(s, s.over.reason, s.over.won ? 'good' : 'bad');
}

function randomEvent(s: GameState, rng: Rng): void {
  const mates = s.members.filter((m) => !m.isPlayer && m.outWeeks === 0);
  const events: (() => boolean)[] = [
    () => {
      if (mates.length < 2) return false;
      let worst: [Musician, Musician] | null = null;
      let low = Infinity;
      forEachPair(s.members, (a, b) => {
        const v = getAffinity(s, a.id, b.id);
        if (v < low) { low = v; worst = [a, b]; }
      });
      if (!worst) return false;
      const [a, b] = worst as [Musician, Musician];
      addAffinity(s, a.id, b.id, -20);
      const subject = rng.pick(['the setlist', 'the last can of lager', 'a girlfriend', 'who gets the front seat of the van']);
      log(s, `${a.isPlayer ? 'You' : first(a)} and ${b.isPlayer ? 'you' : first(b)} had a fistfight over ${subject}.`, 'bad');
      const egoist = a.hidden.ego > b.hidden.ego ? a : b;
      revealLog(s, egoist, 'ego', 1);
      return true;
    },
    () => {
      const target = mates.filter((m) => m.skill >= 50).sort((a, b) => a.hidden.loyalty - b.hidden.loyalty)[0];
      if (!target || s.fans < 40) return false;
      const rival = genBandName(rng);
      if (target.hidden.loyalty < 35) {
        removeMember(s, target.id, 'poached');
        log(s, `${target.name} has left to join ${rival}. They have a manager and a proper van.`, 'bad');
      } else {
        target.mood = clamp(target.mood + 5, 0, 100);
        log(s, `${rival} tried to poach ${first(target)}. ${first(target)} told them where to go.`, 'good');
        revealLog(s, target, 'loyalty', 1);
      }
      return true;
    },
    () => {
      if (s.lastGigWeek === null || s.week - s.lastGigWeek > 1) return false;
      s.buzz = clamp(s.buzz + 5, 0, 100);
      log(s, `A ${PRESS} stringer mentioned you in the gig guide. Small print, but print.`, 'good');
      return true;
    },
    () => {
      s.money -= 40;
      log(s, 'Somebody nicked a guitar and two mic stands from the van. £40 to replace them.', 'bad');
      return true;
    },
    () => {
      const flake = mates.filter((m) => m.hidden.reliability < 40)[0];
      if (!flake) return false;
      flake.outWeeks = 1;
      log(s, `${first(flake)} met someone at the bar and vanished. Back next week, probably.`, 'bad');
      revealLog(s, flake, 'reliability', 1);
      return true;
    },
    () => {
      if (s.fans < 100) return false;
      for (const m of s.members) m.mood = clamp(m.mood + 5, 0, 100);
      log(s, 'First fan letter. Misspelled the band name, but still.', 'good');
      return true;
    },
    () => {
      const rockers = s.members.filter((m) => m.style === 'metal' || m.style === 'hardrock');
      if (!rockers.length) return false;
      for (const m of rockers) m.mood = clamp(m.mood - 4, 0, 100);
      log(s, 'The charts are wall-to-wall synths and frilly shirts. The rockers in the band are depressed.', 'neutral');
      return true;
    },
    () => {
      if (s.songs.length < 3 || s.buzz < 15) return false;
      s.buzz = clamp(s.buzz + 8, 0, 100);
      s.fans += 30;
      log(s, 'Late-night DJ Kenny Vole played your demo tape on the radio. Twice.', 'good');
      return true;
    },
  ];
  for (const e of rng.shuffle(events)) if (e()) return;
}
