// Managers: the person who answers the phone, books the gigs and takes twenty per cent of everything.
// A good one pays for themselves. A bad one owns your songs "throughout the universe".
import { Rng, clamp } from './rng';
import { addBuzz, adjust, log, milestone, mutate } from './helpers';
import type { GameState, Manager } from './types';

const NAMES = [
  'Clive Sparrowhawk', 'Maurice "Mo" Lightfoot', 'Vera Pendleton-Shaw', 'Terry Glass', 'Dougie Fairbrass', 'Sandra "Sandy" Kettle',
  'Rupert Haverstock-Bligh', 'Lenny Marchetti', 'Bev Okonkwo', 'Gordon Wishart', 'Fat Steve Palmer', 'Noreen Castellane',
];

/** A new manager. Smoothness is no guide to honesty. */
export function newManager(s: GameState, rng: Rng): Manager {
  const honesty = rng.int(10, 95);
  const clout = clamp(Math.round(rng.int(10, 60) + s.fans / 150 + s.buzz / 4), 5, 95);
  return {
    name: rng.pick(NAMES),
    honesty,
    clout,
    cut: [0.15, 0.2, 0.2, 0.25][rng.int(0, 3)],
    signed: s.week,
    read: false,
    taken: 0,
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
export const managerHaggle = (s: GameState) => (s.manager ? s.manager.clout / 400 : 0);

/** Sacking a manager: notice money, more if the contract was never read. */
export function sackCost(s: GameState): number {
  const m = s.manager;
  if (!m) return 0;
  return Math.round(150 + m.clout * 3 + (m.read ? 0 : 250));
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
  if (m.honesty < 30 && rng.chance(0.04) && s.money > 100) {
    const gone = Math.min(s.money - 50, rng.int(40, 120));
    s.money -= gone;
    m.taken += gone;
    for (const x of s.members) adjust(x, 'mood', -2);
    log(s, `£${gone} went from the band account as "management expenses". The receipt is for a dinner in Mayfair you were not at.`, 'bad');
  }
}
