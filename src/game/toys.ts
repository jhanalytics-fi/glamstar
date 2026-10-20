// The good life: what a rock star buys with the money, and what it does to them. Houses around the
// world, cars, gold, a boat, a racehorse, and the people who come with the lifestyle. Everything is
// listed on your card, everything costs something every week, and most of it can be sold back when
// the landlord is on the stairs.
import { adjust, log, milestone, mutate, player } from './helpers';
import type { GameState, Toy } from './types';

export type ToyKind = 'home' | 'car' | 'bling' | 'folly' | 'company';

export interface ToySpec {
  id: string;
  kind: ToyKind;
  name: string;
  word: string;
  price: number;
  /** Fans before the estate agent rings. */
  fans: number;
  weekly: number;
  /** Image for the player on the day, once. */
  image: number;
  /** Mood for the player on the day. */
  mood: number;
  /** A home: extra energy every rest week. */
  rest?: number;
  /** A home: the band can rest there too. */
  band?: boolean;
  /** Resale, as a share of price. */
  resale: number;
  /** Something that can go wrong, and what it costs. */
  trouble?: { odds: number; text: string; cost: number; mood: number };
}

export const TOYS: ToySpec[] = [
  // homes
  { id: 'flat', kind: 'home', name: 'A flat in Chelsea', word: 'Two bedrooms, a balcony, a doorman who pretends not to know you.', price: 90000, fans: 8000, weekly: 150, image: 2, mood: 10, rest: 6, resale: 0.9 },
  { id: 'mews', kind: 'home', name: 'A mews house in Kensington', word: 'A garage for the car, a studio in the attic, neighbours who write to the council.', price: 380000, fans: 40000, weekly: 500, image: 3, mood: 12, rest: 8, resale: 0.9, trouble: { odds: 0.004, text: 'Burgled while you were on tour. The gold discs went, the awards went, the neighbour saw nothing.', cost: 15000, mood: -8 } },
  { id: 'manor', kind: 'home', name: 'A manor in the Cotswolds', word: 'Forty rooms, a lake, a ghost, a village that has opinions. The band can stay for months.', price: 1500000, fans: 150000, weekly: 2500, image: 4, mood: 15, rest: 12, band: true, resale: 0.85, trouble: { odds: 0.003, text: 'The roof came in over the east wing. The surveyor mentioned it. Nobody read the survey.', cost: 60000, mood: -5 } },
  { id: 'ibiza', kind: 'home', name: 'A villa in Ibiza', word: 'White walls, a pool, a view, a town below that does not sleep. Nor will you.', price: 900000, fans: 100000, weekly: 1800, image: 5, mood: 18, rest: 8, band: true, resale: 0.8, trouble: { odds: 0.006, text: 'A party at the villa got into the papers, the pool got into the living room, and a Spanish magistrate got into the band.', cost: 25000, mood: -4 } },
  { id: 'newyork', kind: 'home', name: 'A loft in New York', word: 'A whole floor downtown, a freight lift, a painter upstairs, sirens all night.', price: 1200000, fans: 200000, weekly: 2200, image: 6, mood: 14, rest: 6, resale: 0.9 },
  { id: 'ranch', kind: 'home', name: 'A ranch in Montana', word: 'Three thousand acres, horses, a sky, no phone. The one place nobody can find you.', price: 2500000, fans: 400000, weekly: 3000, image: 3, mood: 20, rest: 16, band: true, resale: 0.8 },
  { id: 'castle', kind: 'home', name: 'A castle in the Highlands', word: 'Turrets, a loch, a piper, a moat the drummer fell in. Cold from September to June.', price: 4000000, fans: 700000, weekly: 6000, image: 8, mood: 16, rest: 10, band: true, resale: 0.7, trouble: { odds: 0.004, text: 'The piper left, the boiler died and the loch came up to the door. The estate manager has written a letter in four parts.', cost: 90000, mood: -6 } },
  // cars
  { id: 'jag', kind: 'car', name: 'A second-hand Jaguar', word: 'Racing green, walnut dash, starts in the dry.', price: 9000, fans: 1500, weekly: 60, image: 3, mood: 8, resale: 0.6, trouble: { odds: 0.01, text: 'The Jaguar gave up on the North Circular. The AA man asked for an autograph and £400.', cost: 400, mood: -3 } },
  { id: 'porsche', kind: 'car', name: 'A Porsche', word: 'Red, loud, and wherever you parked it, that is where the photographers are.', price: 45000, fans: 15000, weekly: 150, image: 5, mood: 10, resale: 0.6, trouble: { odds: 0.008, text: 'The Porsche met a lamppost on the King\'s Road at three in the morning. You were not driving, officially.', cost: 12000, mood: -6 } },
  { id: 'rolls', kind: 'car', name: 'A Rolls-Royce with a driver', word: 'Silver, silent, a driver called Reg who has seen worse and says so.', price: 120000, fans: 60000, weekly: 500, image: 6, mood: 8, resale: 0.6 },
  { id: 'lambo', kind: 'car', name: 'A Lamborghini', word: 'Yellow, Italian, impossible to see out of. The fastest way from a hotel to a hedge.', price: 160000, fans: 120000, weekly: 400, image: 8, mood: 12, resale: 0.5, trouble: { odds: 0.012, text: 'The Lamborghini is in a field in Berkshire, upside down. You walked away. The field did not.', cost: 60000, mood: -8 } },
  // bling
  { id: 'watch', kind: 'bling', name: 'A gold watch', word: 'Swiss, heavy, worth a terraced house. Tells the time, which you ignore.', price: 15000, fans: 10000, weekly: 0, image: 3, mood: 6, resale: 0.7 },
  { id: 'tooth', kind: 'bling', name: 'A diamond tooth', word: 'Front, left. Catches the stage lights and the dentist\'s eye.', price: 8000, fans: 20000, weekly: 0, image: 4, mood: 5, resale: 0.3 },
  { id: 'guitar', kind: 'bling', name: 'A dead legend\'s guitar', word: 'Bought at auction for more than the house. Never played in public, in case.', price: 250000, fans: 150000, weekly: 0, image: 5, mood: 10, resale: 1.1 },
  // follies
  { id: 'boat', kind: 'folly', name: 'A yacht on the Riviera', word: 'Sixty feet, a crew of four, a bar, and a captain who has stopped asking where to.', price: 700000, fans: 120000, weekly: 3000, image: 6, mood: 14, resale: 0.6, trouble: { odds: 0.005, text: 'The yacht hit a harbour wall at Antibes with the band aboard and the captain below. The harbour master has photographs.', cost: 80000, mood: -5 } },
  { id: 'horse', kind: 'folly', name: 'A racehorse', word: 'Called Feedback. Trained in Newmarket, eats like the drummer, has never finished better than fourth.', price: 60000, fans: 50000, weekly: 400, image: 2, mood: 8, resale: 0.4, trouble: { odds: 0.01, text: 'Feedback went lame at Kempton. The vet, the trainer and the bookie sent bills in that order.', cost: 6000, mood: -3 } },
  { id: 'vineyard', kind: 'folly', name: 'A vineyard in Provence', word: 'Twelve hectares, a farmhouse, a label with your face on it. The wine is terrible.', price: 1100000, fans: 300000, weekly: 2000, image: 3, mood: 12, rest: 8, band: true, resale: 0.75 },
  { id: 'island', kind: 'folly', name: 'A small island', word: 'Off the coast of somewhere warm. A house, a jetty, a generator, a tortoise that came with it.', price: 3500000, fans: 800000, weekly: 4000, image: 8, mood: 20, rest: 18, band: true, resale: 0.7 },
  // company
  { id: 'model', kind: 'company', name: 'A model on your arm', word: 'From the magazines, on your arm at every opening, in every photograph, and in the papers when it ends.', price: 0, fans: 30000, weekly: 1200, image: 8, mood: 10, resale: 0, trouble: { odds: 0.01, text: 'The model sold the story to a Sunday paper. Four pages, a photograph of the bathroom, and a word for you that rhymes with nothing.', cost: 0, mood: -12 } },
  { id: 'astrologer', kind: 'company', name: 'A personal astrologer', word: 'Reads your chart every morning and tells you not to fly on Tuesdays. The band has started doing it too.', price: 0, fans: 40000, weekly: 300, image: 1, mood: 6, resale: 0 },
  { id: 'guru', kind: 'company', name: 'A guru', word: 'Robes, a smile, a retreat in Wales, a view on the drummer. Asks for nothing, receives a great deal.', price: 0, fans: 60000, weekly: 800, image: 2, mood: 10, resale: 0 },
];

export const TOY_KIND: Record<ToyKind, string> = { home: 'Homes', car: 'Cars', bling: 'Gold', folly: 'Follies', company: 'Company' };

export const toySpec = (id: string): ToySpec => TOYS.find((t) => t.id === id)!;
export const owned = (s: GameState): Toy[] => s.toys ?? [];
export const owns = (s: GameState, id: string) => owned(s).some((t) => t.id === id);

/** What is in the shop window for a band of this size: owned things stay listed, unaffordable ones tease. */
export function shopWindow(s: GameState): ToySpec[] {
  return TOYS.filter((t) => s.fans >= t.fans / 2 || owns(s, t.id));
}

export function toyLocked(s: GameState, t: ToySpec): string | null {
  if (owns(s, t.id)) return null;
  if (s.fans < t.fans) return `Not yet. Rock stars with ${t.fans.toLocaleString('en-GB')} fans shop here.`;
  if (s.money < t.price) return `£${t.price.toLocaleString('en-GB')}. Not this week.`;
  return null;
}

/** The weekly bill for the lot. */
export function toyUpkeep(s: GameState): number {
  return owned(s).reduce((a, t) => a + toySpec(t.id).weekly, 0);
}

/** Extra energy on a rest week from the best home you own. */
export function homeRest(s: GameState): number {
  return Math.max(0, ...owned(s).map((t) => toySpec(t.id).rest ?? 0));
}

export function buyToy(state: GameState, id: string): GameState {
  const t = toySpec(id);
  if (!t) throw new Error('Nothing by that name.');
  if (state.pending) throw new Error('Deal with the situation first.');
  if (owns(state, id)) throw new Error('You already have one.');
  const why = toyLocked(state, t);
  if (why) throw new Error(why);
  return mutate(state, (s) => {
    s.money -= t.price;
    (s.toys ??= []).push({ id, week: s.week });
    const p = player(s);
    adjust(p, 'image', t.image);
    adjust(p, 'mood', t.mood);
    // The others notice. A house the band can use is a gift; a gold tooth is just you.
    for (const m of s.members) if (!m.isPlayer) adjust(m, 'mood', t.band ? 4 : t.kind === 'company' ? -2 : m.hidden.ego >= 60 ? -3 : 0);
    milestone(s, 'career', `${t.name}${t.price ? `, £${t.price.toLocaleString('en-GB')}` : ''}.`);
    log(s, `${t.name}. ${t.word}${t.weekly ? ` £${t.weekly.toLocaleString('en-GB')} a week to keep.` : ''}`, 'good');
  });
}

export function sellToy(state: GameState, id: string): GameState {
  const t = toySpec(id);
  if (!t || !owns(state, id)) throw new Error('You do not have one.');
  if (state.pending) throw new Error('Deal with the situation first.');
  return mutate(state, (s) => {
    const back = Math.round(t.price * t.resale);
    s.money += back;
    s.toys = owned(s).filter((x) => x.id !== id);
    adjust(player(s), 'mood', t.kind === 'company' ? -6 : -4);
    log(s, t.kind === 'company' ? `${t.name.replace('A ', 'The ')} has gone. It was in the papers before it was in the band.` : `${t.name.replace('A ', 'The ')} was sold for £${back.toLocaleString('en-GB')}. ${t.kind === 'car' ? 'The new owner asked if the dent was original.' : 'The photographs stay.'}`, 'neutral');
  });
}

/** Things go wrong with things: once a week, one roll across the lot. */
export function toyWeek(s: GameState, rng: { chance: (p: number) => boolean }): void {
  for (const t of owned(s)) {
    const spec = toySpec(t.id);
    if (!spec.trouble || !rng.chance(spec.trouble.odds)) continue;
    s.money -= spec.trouble.cost;
    adjust(player(s), 'mood', spec.trouble.mood);
    log(s, `${spec.trouble.text}${spec.trouble.cost ? ` £${spec.trouble.cost.toLocaleString('en-GB')}.` : ''}`, 'bad');
    if (spec.id === 'model') s.toys = owned(s).filter((x) => x.id !== 'model');
    return;
  }
}

/** One line for the card: what you own, in order of buying. */
export function toyLine(s: GameState): string {
  const list = owned(s).map((t) => toySpec(t.id).name.replace(/^An? /, '').replace(/^The /, ''));
  return list.length ? list.join(', ') : '';
}

/** The best place you own to sleep, for the log. */
export function bestHome(s: GameState): string {
  const best = [...owned(s)].map((t) => toySpec(t.id)).filter((t) => t.rest).sort((a, b) => (b.rest ?? 0) - (a.rest ?? 0))[0];
  return best ? best.name.replace(/^An? /, 'the ') : 'the flat';
}
