// Death. Rare, and the one thing in this game that cannot be bought back. A member who dies sells
// records like never before, and is remembered in the circles for decades; the player who dies
// seals whatever they had already become.
import { Rng, clamp } from './rng';
import { addBuzz, adjust, first, log, milestone, removeMember } from './helpers';
import { studioOf } from './studio';
import { ladderDone } from './goals';
import type { GameState, Memorial, Musician } from './types';
import type { EventDef } from './events';

export type Cause = Memorial['cause'];

/** Nothing happens in the first half year; after that, the lifestyle sets the odds. */
export function deathOdds(s: GameState, m: Musician): number {
  if (s.week < 26) return 0;
  let p = 0.00003;
  if (m.habit >= 70) p += 0.002 * ((m.habit - 70) / 30) ** 2;
  if (s.tour) {
    p += 0.00012;
    if (s.wheels === 'jet') p += 0.0001;
    if (s.tour.lodging === 'suites' && m.habit >= 50) p += 0.0003;
  }
  if (m.age >= 40) p += 0.0001 * (m.age - 39);
  return p;
}

function pickCause(s: GameState, m: Musician, rng: Rng): Cause {
  if (m.habit >= 70 && rng.chance(0.75)) return 'misadventure';
  if (s.tour && rng.chance(0.7)) return s.wheels === 'jet' && rng.chance(0.4) ? 'plane' : 'road';
  if (studioOf(s) && s.studio === 'riviera' && rng.chance(0.4)) return 'pool';
  if (m.age >= 38 && rng.chance(0.5)) return 'heart';
  return rng.pick(['fall', 'misadventure', 'heart', 'road'] as Cause[]);
}

const CAUSE_THEM: Record<Cause, (m: Musician) => string> = {
  misadventure: (m) => `${first(m)} was found in a hotel room in the morning. The coroner will say misadventure. Everyone else will say what they already knew.`,
  road: (m) => `The car ${first(m)} was in left the road at four in the morning. The driver walked away. ${first(m)} did not.`,
  plane: (m) => `The small plane ${first(m)} took ahead of the bus went down in a field in fog. The bus arrived to the news.`,
  pool: (m) => `${first(m)} was found in the pool at the villa at dawn, the terrace lights still on, a bottle on the steps.`,
  heart: (m) => `${first(m)}'s heart stopped in the dressing room before the encore. Thirty years of living in a decade.`,
  fall: (m) => `${first(m)} went over a hotel balcony at three in the morning. Nobody saw it, and everybody has a version.`,
};
const CAUSE_YOU: Record<Cause, string> = {
  misadventure: 'You were found in a hotel room in the morning. The coroner said misadventure. The fans said what they already knew.',
  road: 'The car left the road at four in the morning. The driver walked away. You did not.',
  plane: 'The small plane you took ahead of the bus went down in a field in fog. The bus arrived to the news.',
  pool: 'You were found in the pool at the villa at dawn, the terrace lights still on, a bottle on the steps.',
  heart: 'Your heart stopped in the dressing room before the encore. Thirty years of living in a decade.',
  fall: 'You went over a hotel balcony at three in the morning. Nobody saw it, and everybody has a version.',
};

/** One death, member or player. Exported so tests and the debug panel can call it straight. */
export function die(s: GameState, rng: Rng, id: string, cause?: Cause): void {
  const m = s.members.find((x) => x.id === id);
  if (!m) throw new Error('Nobody by that name.');
  const how = cause ?? pickCause(s, m, rng);
  if (m.isPlayer) {
    const god = s.fans >= 30000 || ladderDone(s);
    const cult = s.fans >= 1500;
    const after = god
      ? `Rock godhood, sealed at ${m.age}. The records never go out of print, the T-shirt outlives everyone who wore it, and every year the candles go down outside the house you never lived in.`
      : cult
        ? `A cult, sealed at ${m.age}. The bootlegs trade for silly money, the fanzine runs a special every year, and a band you have never heard of covers your best song and gets it wrong.`
        : `Aged ${m.age}. Not famous, not forgotten: in the circles they still talk about it. A plaque by the toilets at the Rat Pit, a candle in the window of the music shop, and a tape somebody swears is the best thing you ever did.`;
    s.over = { won: god, died: true, reason: `${CAUSE_YOU[how]} ${after}` };
    s.pending = null;
    s.tour = null;
    milestone(s, 'career', `${m.name} died, aged ${m.age}.`);
    log(s, s.over.reason, god ? 'good' : 'bad');
    return;
  }
  removeMember(s, m.id, 'died');
  (s.memorials ??= []).push({ name: m.name, role: m.role, week: s.week, cause: how, age: m.age });
  const gain = Math.round(s.fans * 0.12 + 500);
  s.fans += gain;
  addBuzz(s, 30);
  for (const o of s.members) { adjust(o, 'mood', -30); adjust(o, 'energy', -20); }
  s.flags.mourning = s.week;
  s.flags.wake = s.week;
  milestone(s, 'drama', `${m.name} died, aged ${m.age}.`);
  log(s, `${CAUSE_THEM[how](m)} ${m.name}, ${m.age}. The phone has not stopped. The records are selling like they never did while ${first(m)} was alive to see it.`, 'bad');
  if (!s.pending) s.pending = { def: 'the_wake', params: { name: m.name, first: first(m) }, week: s.week };
}

/** The weekly roll. */
export function deathWeek(s: GameState, rng: Rng): void {
  if (s.over) return;
  for (const m of [...s.members]) {
    if (m.outWeeks > 0 && m.soloOut) continue;
    if (rng.chance(deathOdds(s, m))) { die(s, rng, m.id); return; }
  }
}

/** Records sell hard for a few months after a death. */
export function mourningBoost(s: GameState): number {
  const w = s.flags.mourning;
  if (w === undefined) return 1;
  const age = s.week - w;
  if (age > 20) return 1;
  return 1 + 2.5 * Math.exp(-age / 5);
}

/** Every year on the day, somebody lights a candle. The small bands are remembered longest, in proportion. */
export function remembranceWeek(s: GameState): void {
  for (const r of s.memorials ?? []) {
    const years = (s.week - r.week) / 52;
    if (years < 1 || !Number.isInteger(years)) continue;
    const gain = Math.max(30, Math.round(s.fans * 0.006));
    s.fans += gain;
    addBuzz(s, 3);
    log(s, `${years} year${years === 1 ? '' : 's'} today. ${r.name}'s photo is in the fanzines again, there are flowers outside the Rat Pit, and a pub band in Leeds plays the whole first album in the right order.`, 'neutral');
  }
}

export const DEATH_EVENTS: EventDef[] = [
  {
    id: 'the_wake',
    weight: 0,
    when: (s) => {
      const r = (s.memorials ?? [])[(s.memorials ?? []).length - 1];
      return r && s.flags.wake !== undefined && s.flags.wakeDone === undefined ? { name: r.name, first: r.name.split(' ')[0] } : null;
    },
    title: (_s, p) => `Burying ${p.first}`,
    text: (_s, p) => `The funeral is Thursday. The label wants a statement, the promoter wants to know about Saturday, the papers want a photograph of you crying, and ${p.first}'s mother wants to know why nobody rang her. The band is in the kitchen, not talking.`,
    options: (_s, p) => [
      {
        label: 'Bury them properly. A month off',
        hint: 'Nobody plays for three weeks. The band comes back closer; the fans wait.',
        resolve: (st) => {
          st.flags.wakeDone = 1;
          for (const m of st.members) { m.outWeeks = Math.max(m.outWeeks, 3); adjust(m, 'mood', 12); m.hidden.loyalty = clamp(m.hidden.loyalty + 6, 1, 99); }
          log(st, `You carried the coffin. Three weeks of nothing: the phone off, the kettle on, the songs ${p.first} wrote played once, quietly, and put away. The band is still a band.`, 'neutral');
        },
      },
      {
        label: 'Play the funeral, then a tribute show',
        hint: 'A sold-out night for the family. The band grieves on stage, which is where it grieves best.',
        resolve: (st) => {
          st.flags.wakeDone = 1;
          const take = Math.round(clamp(st.fans * 1.2, 300, 200000));
          st.money += take;
          st.fans += Math.round(st.fans * 0.03);
          addBuzz(st, 10);
          for (const m of st.members) adjust(m, 'mood', 6);
          log(st, `You played at the graveside, badly, and at the tribute show, better than you ever have. £${take.toLocaleString('en-GB')} to ${p.first}'s family. The encore was ${p.first}'s song, with the lights down and nobody in the chair.`, 'good');
        },
      },
      {
        label: 'The tour goes on. They would have wanted it',
        hint: 'No dates lost. The band will not forgive it quickly, and the papers will say so.',
        resolve: (st) => {
          st.flags.wakeDone = 1;
          for (const m of st.members) { adjust(m, 'mood', -10); m.hidden.loyalty = clamp(m.hidden.loyalty - 8, 1, 99); }
          addBuzz(st, 5);
          log(st, `The statement said ${p.first} would have wanted the show to go on. ${p.first} would have wanted a lot of things. Saturday went ahead with a dep who had learned the parts from the records.`, 'bad');
        },
      },
    ],
  },
];
