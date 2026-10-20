// Managers: the person who answers the phone, books the gigs and takes twenty per cent of everything.
// A good one pays for themselves. A bad one owns your songs "throughout the universe".
import { Rng, clamp } from './rng';
import { addBuzz, adjust, earn, log, milestone, mutate } from './helpers';
import type { GameState, Manager, ManagerKind } from './types';

const NAMES = [
  'Clive Sparrowhawk', 'Maurice "Mo" Lightfoot', 'Vera Pendleton-Shaw', 'Terry Glass', 'Dougie Fairbrass', 'Sandra "Sandy" Kettle',
  'Rupert Haverstock-Bligh', 'Lenny Marchetti', 'Bev Okonkwo', 'Gordon Wishart', 'Fat Steve Palmer', 'Noreen Castellane',
];

export interface ManagerKindSpec {
  name: string;
  word: string;
  /** Visible on the card: what they are for, and what they are not. */
  gift: string;
  trouble: string;
  care: [number, number];
  nous: [number, number];
  clout: number;
  honesty: [number, number];
  cut: number[];
}

export const MANAGER_KINDS: Record<ManagerKind, ManagerKindSpec> = {
  hustler: { name: 'The hustler', word: 'Sheepskin coat, car phone, three deals on the go and a cheque that will clear on Thursday.', gift: 'Gigs out of nowhere, fees squeezed, a face at every door.', trouble: 'Expenses. Paperwork that is mostly beer mats.', care: [10, 40], nous: [25, 60], clout: 5, honesty: [10, 70], cut: [0.2, 0.2, 0.25] },
  suit: { name: 'The accountant', word: 'A briefcase, a calculator, a tie at the Rat Pit. Reads every page and sends a memo about it.', gift: 'Cheaper records, small print caught, money that stays in the account.', trouble: 'Thinks a riot is a liability. Has never been to a gig for fun.', care: [20, 50], nous: [60, 95], clout: -10, honesty: [50, 95], cut: [0.15, 0.15, 0.2] },
  nanny: { name: 'The minder', word: "Used to tour-manage somebody enormous. Carries aspirin, passports, a spare bass string and everyone's mother's number.", gift: 'Habits kept down, rows headed off, the drummer found and put on the bus.', trouble: 'Not much use in a label office. Will send you to bed.', care: [65, 95], nous: [20, 50], clout: -5, honesty: [40, 90], cut: [0.15, 0.2, 0.2] },
  godfather: { name: 'The heavy', word: 'Big coat, bigger car, a handshake you remember. Promoters pay on the night and do not argue.', gift: 'Fees nobody else gets, debts that vanish, labels that listen very carefully.', trouble: 'Hard to leave. Expenses with no receipts. Friends you did not ask for.', care: [20, 60], nous: [30, 70], clout: 25, honesty: [5, 40], cut: [0.25, 0.25, 0.3] },
  visionary: { name: 'The visionary', word: "Wants to make you into something. Has a concept, a photographer, and opinions about your drummer's hair.", gift: 'Press, television, image, a story the papers can print.', trouble: 'Spends your money on the concept. Bored by the actual music.', care: [20, 50], nous: [20, 55], clout: 15, honesty: [20, 80], cut: [0.2, 0.25, 0.25] },
};
const PAST = ['a band you supported once', 'a singer who is now in panto', 'two acts who had a hit each', 'a comedian and a snooker player', 'someone enormous, for a year, until the lawsuit', 'a boy band nobody admits to', 'a string of pub bands and one near miss', 'a folk duo and a wrestler'];

/** A new manager. Smoothness is no guide to honesty. */
export function newManager(s: GameState, rng: Rng): Manager {
  const kind = rng.pick(['hustler', 'suit', 'nanny', 'godfather', 'visionary'] as ManagerKind[]);
  const k = MANAGER_KINDS[kind];
  const honesty = rng.int(k.honesty[0], k.honesty[1]);
  const clout = clamp(Math.round(rng.int(10, 60) + s.fans / 150 + s.buzz / 4 + k.clout), 5, 95);
  return {
    name: rng.pick(NAMES),
    kind,
    care: rng.int(k.care[0], k.care[1]),
    nous: rng.int(k.nous[0], k.nous[1]),
    past: rng.pick(PAST),
    honesty,
    clout,
    cut: rng.pick(k.cut),
    signed: s.week,
    read: false,
    taken: 0,
  };
}

export const careOf = (s: GameState) => s.manager?.care ?? 0;
export const nousOf = (s: GameState) => s.manager?.nous ?? 0;
/** The accountant's share off a studio bill. */
export const nousSaving = (s: GameState) => 1 - nousOf(s) / 400;

const WORD = (v: number, low: string, mid: string, high: string) => (v >= 60 ? high : v >= 35 ? mid : low);
/** The card: three lines a promoter could tell you in a pub. */
export function managerCard(m: Manager): { kind: string; clout: string; care: string; nous: string; past: string } {
  const k = MANAGER_KINDS[m.kind ?? 'hustler'];
  return {
    kind: `${k.name}. ${k.word}`,
    clout: WORD(m.clout, 'Knows the landlord of the Crown & Gutter', 'Knows a few promoters', 'Knows everybody worth knowing'),
    care: WORD(m.care ?? 30, 'Would not notice if the drummer was on fire', 'Rings the hotel if nobody turns up', "Finds the drummer, puts the drummer to bed, hides the drummer's keys"),
    nous: WORD(m.nous ?? 40, 'Signs things on bonnets', 'Reads the big print', 'Reads page nine and rings the lawyer'),
    past: `Managed ${m.past ?? 'nobody you have heard of'}.`,
  };
}

/** What the scene says about a manager: true-ish, never exact. */
export function managerWord(m: Manager): string {
  const c = m.clout >= 60 ? 'knows everybody worth knowing' : m.clout >= 35 ? 'knows a few promoters' : 'knows the landlord of the Crown & Gutter';
  return `${m.name} ${c}.`;
}

/** The manager's cut of money coming in. Returns what was taken. */
export function commission(s: GameState, amount: number): number {
  const m = s.manager;
  if (!m || amount <= 0) return 0;
  // Crooks round their share up. Generously.
  const skim = m.honesty < 30 ? 1.25 : 1;
  const take = Math.round(amount * m.cut * skim);
  s.money -= take;
  m.taken += take;
  return take;
}

/** Gig fees a manager can squeeze out of promoters. */
export const feeBoost = (s: GameState) => 1 + (s.manager ? s.manager.clout / 150 : 0);

/** How much louder the labels hear you with a manager making calls. */
export const managerHeat = (s: GameState) => (s.manager ? s.manager.clout * 8 : 0);

/** Odds bonus when haggling with a label. */
export const managerHaggle = (s: GameState) => (s.manager ? s.manager.clout / 400 + (s.manager.nous ?? 0) / 500 : 0);

/** Sacking a manager: notice money, more if the contract was never read. */
export function sackCost(s: GameState): number {
  const m = s.manager;
  if (!m) return 0;
  return Math.round((150 + m.clout * 3 + (m.read ? 0 : 250)) * (m.kind === 'godfather' ? 3 : 1));
}

export function sackManager(state: GameState): GameState {
  return mutate(state, (s) => {
    const m = s.manager;
    if (!m) throw new Error('You do not have a manager.');
    const cost = sackCost(s);
    if (s.money < cost) throw new Error(`Paying ${m.name} off costs £${cost}. You do not have it.`);
    s.money -= cost;
    s.manager = null;
    s.flags.manager = 4;
    milestone(s, 'career', `Sacked ${m.name} as manager.`);
    log(s, `${m.name} has been paid off with £${cost}. ${m.honesty < 30 ? 'They took the filing cabinet, the car and, it turns out, the petty cash.' : 'A handshake, a bottle of whisky, no hard feelings. Mostly.'} In total they took £${m.taken.toLocaleString('en-GB')} in commission.`, 'neutral');
  });
}

/** Weekly management: a good manager makes things happen, a crook makes money disappear. */
export function managerWeek(s: GameState, rng: Rng): void {
  const m = s.manager;
  if (!m) return;
  if (rng.chance(m.clout / 900)) {
    addBuzz(s, 2);
    log(s, `${m.name} got the band a mention on a breakfast radio show. You were described as "lively".`, 'good');
  }
  const care = m.care ?? 30;
  if (care >= 50) {
    // The minder: habits kept in check, and the one who is a danger to themselves sent home for a week.
    for (const x of s.members) if (x.habit > 20 && rng.chance(care / 150)) adjust(x, 'habit', -1);
    const danger = s.members.find((x) => x.habit >= 75 && x.outWeeks === 0 && !x.isPlayer);
    if (danger && !s.tour && rng.chance(care / 250)) {
      danger.outWeeks = 1; adjust(danger, 'habit', -12); adjust(danger, 'mood', -3);
      log(s, `${m.name} drove ${danger.name} to their mother's with a bag and no phone. One week. "You can hate me on Monday."`, 'neutral');
    }
    if (rng.chance(care / 400)) {
      const low = [...s.members].sort((a, b) => a.mood - b.mood)[0];
      if (low && low.mood < 45) { adjust(low, 'mood', 6); log(s, `${m.name} took ${low.isPlayer ? 'you' : low.name} for a fry-up and a talk. Nothing was decided. It helped.`, 'good'); }
    }
  }
  if (m.kind === 'visionary' && rng.chance(0.03) && s.money > 400) {
    const gone = Math.round(Math.min(s.money * 0.08, 150 + s.fans * 0.02));
    s.money -= gone; m.taken += gone;
    for (const x of s.members) adjust(x, 'image', 1);
    log(s, `£${gone.toLocaleString('en-GB')} on a photographer, a stylist and a concept involving a swan. The pictures are good. The swan was not consulted.`, 'neutral');
  }
  if (m.honesty < 30 && rng.chance(0.04) && s.money > 100) {
    const gone = Math.min(s.money - 50, rng.int(40, 120));
    s.money -= gone;
    m.taken += gone;
    for (const x of s.members) adjust(x, 'mood', -2);
    log(s, `£${gone} went from the band account as "management expenses". The receipt is for a dinner in Mayfair you were not at.`, 'bad');
  }
}

// ---------------------------------------------------------------- jobs for the manager

export type ManagerJob = 'tv' | 'private' | 'label' | 'press';
export const JOB_LABEL: Record<ManagerJob, string> = { tv: 'Get us on the telly', private: 'Book a private party', label: 'Lean on the label', press: 'Kill a story' };
export const JOB_WEEKS: Record<ManagerJob, number> = { tv: 8, private: 6, label: 13, press: 20 };

export function jobHint(s: GameState, job: ManagerJob): string {
  const m = s.manager!;
  switch (job) {
    case 'tv': return `A slot on a pop show, if ${m.name} knows the producer. Buzz, fans, and the band in make-up. Odds ${Math.round(jobOdds(s, job) * 100)}%.`;
    case 'private': return `A rich kid's twenty-first, a corporate do, a wedding: about £${privateFee(s).toLocaleString('en-GB')} for one night nobody will admit to. Energy -8.`;
    case 'label': return s.contract ? `A shouting match in the A&R office: a chunk off the tab and a warmer label, or a colder one. Odds ${Math.round(jobOdds(s, job) * 100)}%.` : 'Needs a label to lean on.';
    case 'press': return `Next scandal, the paper runs a different story. Buys silence once, for a while. Odds ${Math.round(jobOdds(s, job) * 100)}%.`;
  }
}

export function jobOdds(s: GameState, job: ManagerJob): number {
  const c = s.manager?.clout ?? 0;
  return clamp(job === 'tv' ? 0.2 + c / 120 : job === 'label' ? 0.35 + c / 150 : job === 'press' ? 0.3 + c / 130 : 1, 0.05, 0.95);
}

export const privateFee = (s: GameState) => Math.round(((150 + s.fans * 0.25) * (0.6 + (s.manager?.clout ?? 30) / 100)) / 10) * 10;

export function jobLocked(s: GameState, job: ManagerJob): string | null {
  if (!s.manager) return 'No manager.';
  if (s.tour) return 'On tour.';
  const last = s.flags[`job_${job}`];
  if (last !== undefined && s.week - last < JOB_WEEKS[job]) return `${s.manager.name} is still working on the last one. ${JOB_WEEKS[job] - (s.week - last)} weeks.`;
  if (job === 'label' && !s.contract) return 'Needs a label to lean on.';
  if (job === 'press' && s.flags.pressFavour) return 'A favour is already owed.';
  return null;
}

/** The manager earns their cut: one job, no week spent. */
export function managerJob(state: GameState, job: ManagerJob): GameState {
  const why = jobLocked(state, job);
  if (why) throw new Error(why);
  return mutate(state, (s, rng) => {
    const m = s.manager!;
    s.flags[`job_${job}`] = s.week;
    const ok = rng.chance(jobOdds(s, job));
    switch (job) {
      case 'tv': {
        if (!ok) { log(s, `${m.name} rang the telly people. The telly people rang back to say no, politely, and then not at all.`, 'neutral'); return; }
        const gain = Math.round(200 + s.fans * 0.03 + m.clout * 10);
        addBuzz(s, 6 + Math.round(m.clout / 10));
        s.fans += gain;
        for (const x of s.members) adjust(x, 'image', 1);
        log(s, `${m.name} got the band three minutes on a Saturday-morning pop show, between a cartoon and a cookery slot. ${gain.toLocaleString('en-GB')} new fans and a letter from a vicar.`, 'good');
        return;
      }
      case 'private': {
        const fee = privateFee(s);
        s.money += fee;
        earn(s, 'gigs', fee);
        commission(s, fee);
        for (const x of s.members) { adjust(x, 'energy', -8); adjust(x, 'mood', rng.int(-4, 3)); }
        log(s, `${m.name} booked ${rng.pick(['a shipping heir\'s twenty-first in Surrey', 'a software company\'s Christmas do in July', 'a wedding in Hertfordshire where the bride cried through the encore', 'a nightclub opening in Marbella', 'a car launch in a hangar'])}. £${fee.toLocaleString('en-GB')} in an envelope, and nobody mentions it again.`, 'good');
        return;
      }
      case 'label': {
        const c = s.contract!;
        const l = labelName(c.label);
        if (!ok) { c.goodwill = clamp(c.goodwill - 8, 0, 100); log(s, `${m.name} went in shouting and came out quieter. ${l} are "disappointed in the tone". Nothing off the tab.`, 'bad'); return; }
        const off = Math.round(Math.min(c.unrecouped, 500 + c.unrecouped * (0.05 + m.clout / 500)));
        c.unrecouped -= off;
        c.goodwill = clamp(c.goodwill + 5, 0, 100);
        log(s, `${m.name} spent an afternoon in ${l}'s office with a calculator and a voice. £${off.toLocaleString('en-GB')} of "promotional expenses" vanished from the tab, and they sent flowers.`, 'good');
        return;
      }
      case 'press': {
        if (!ok) { log(s, `${m.name} took a tabloid editor to lunch. The editor ate, listened, and promised nothing.`, 'neutral'); return; }
        s.flags.pressFavour = 1;
        log(s, `${m.name} has a favour in the bank with a Sunday editor. The next thing that should not get out will not. Once.`, 'good');
        return;
      }
    }
  });
}

function labelName(id: string): string {
  return LABEL_NAMES[id] ?? id;
}
const LABEL_NAMES: Record<string, string> = { badpenny: 'Bad Penny Records', waxlyrical: 'Wax Lyrical', gutterpress: 'Gutterpress Recordings', goldtooth: 'Goldtooth Music', starlight: 'Starlight Entertainment Group', colossus: 'Colossus Phonographic', imperial: 'Imperial Gramophone', polyvox: 'Polyvox International' };

/** Managers come knocking when a band gets to a size: a following, a real following, and the big time. */
export const KNOCKS = [300, 3000, 30000];
export function managerKnock(s: GameState, rng: Rng): void {
  // Nobody manages a band that is broke or owes Big Tony.
  if (s.pending || s.over || s.tour || s.money < 0 || s.flags.shark) return;
  const n = KNOCKS.find((k) => s.fans >= k && s.flags[`managerKnock${k}`] === undefined);
  if (n === undefined) return;
  if (!(s.flags.managerPitch === undefined || s.week - s.flags.managerPitch >= 20)) return;
  for (let i = 0; i < 6; i++) {
    const seed = rng.int(1, 1e9);
    const m = newManager(s, new Rng(seed));
    if (s.manager && m.clout < s.manager.clout + 20) continue;
    s.flags[`managerKnock${n}`] = s.week;
    s.pending = { def: 'manager_offer', params: { seed }, week: s.week };
    return;
  }
  // Nobody bigger than the one you have: mark it done.
  s.flags[`managerKnock${n}`] = s.week;
}
