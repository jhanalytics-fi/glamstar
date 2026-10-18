// How the band gets about, and where it sleeps on the road. Both say more about a band's station
// than the charts do, and both decide how much is left of everyone by Friday.
import type { GameState, Lodging, Wheels } from './types';

export interface WheelsSpec {
  name: string;
  word: string;
  /** Energy cost multiplier for a home gig. */
  gig: number;
  /** Energy cost multiplier per tour date. */
  tour: number;
  /** Running cost per tour week on top of the road budget. */
  weekly: number;
  /** What it costs to buy, and how big you have to be before anyone offers. */
  price: number;
  fans: number;
  rank: number;
}

export const WHEELS: Record<Wheels, WheelsSpec> = {
  bus: { name: 'The night bus', word: 'Amps on the night bus, drums in a minicab, the singer hitching with the setlist.', gig: 1.3, tour: 1.3, weekly: 0, price: 0, fans: 0, rank: 0 },
  van: { name: 'A rusty Transit', word: 'Smells of sheep, starts on the third go, sleeps four if nobody minds.', gig: 1, tour: 1, weekly: 0, price: 120, fans: 0, rank: 1 },
  splitter: { name: 'A splitter van with bunks', word: 'Six bunks, a fridge, a stereo and a curtain between the band and the gear.', gig: 0.9, tour: 0.88, weekly: 120, price: 3500, fans: 800, rank: 2 },
  coach: { name: 'A tour bus with a lounge', word: 'A driver called Trevor, twelve bunks, a lounge, a video and a toilet nobody may use for solids.', gig: 0.85, tour: 0.72, weekly: 2500, price: 30000, fans: 8000, rank: 3 },
  jet: { name: 'A private jet', word: 'Leather seats, a bar, a pilot who has seen everything and a fuel bill like a small war.', gig: 0.8, tour: 0.6, weekly: 45000, price: 900000, fans: 60000, rank: 4 },
};
export const WHEELS_ORDER: Wheels[] = ['bus', 'van', 'splitter', 'coach', 'jet'];

export interface LodgingSpec {
  name: string;
  word: string;
  /** Share of the tier's weekly road cost, plus a nightly rate per head. */
  cost: number;
  nightly: number;
  /** Energy and mood for everyone per tour week. */
  energy: number;
  mood: number;
  /** Habit multiplier: floors breed bad habits, so does a minibar. */
  habit: number;
}

export const LODGING: Record<Lodging, LodgingSpec> = {
  floors: { name: 'Floors and the van', word: 'Fans\' floors, the promoter\'s sofa, the van when it rains.', cost: 0, nightly: 0, energy: -6, mood: -3, habit: 1.15 },
  bnb: { name: 'Bed and breakfasts', word: 'Two to a room, a landlady with rules, a fried breakfast that is the day\'s only meal.', cost: 0.03, nightly: 6, energy: 0, mood: 0, habit: 1 },
  hotels: { name: 'Proper hotels', word: 'A room each, a bath, a bar downstairs that knows the band by name by Thursday.', cost: 0.12, nightly: 25, energy: 5, mood: 1, habit: 1 },
  suites: { name: 'Suites and room service', word: 'The top floor, a minibar the size of a fridge, and a bill the size of a single\'s budget.', cost: 0.35, nightly: 120, energy: 10, mood: 3, habit: 1.2 },
};
export const LODGING_ORDER: Lodging[] = ['floors', 'bnb', 'hotels', 'suites'];

/** Change wheels and keep the old flag in step for everything that still reads it. */
export function setWheels(s: GameState, w: Wheels): void {
  s.wheels = w;
  s.flags.noVan = w === 'bus' ? 1 : 0;
}

export function wheelsOf(s: GameState): Wheels {
  return s.wheels ?? (s.flags.noVan ? 'bus' : 'van');
}

/** What the band actually travels in on a given tour: arenas and above come with a hired bus if you have none. */
export function tourWheels(s: GameState, tierId: string): { wheels: Wheels; hired: boolean } {
  const own = wheelsOf(s);
  const bigTour = tierId === 'arenas' || tierId === 'japan' || tierId === 'america' || tierId === 'stadiums';
  if (bigTour && WHEELS[own].rank < WHEELS.coach.rank) return { wheels: 'coach', hired: true };
  return { wheels: own, hired: false };
}

/** The next set of wheels a band of this size could be offered, if any. */
export function nextWheels(s: GameState): Wheels | null {
  const own = WHEELS[wheelsOf(s)].rank;
  return WHEELS_ORDER.find((w) => WHEELS[w].rank === own + 1 && w !== 'van') ?? null;
}

/** The lodging a tour of this size defaults to. */
export function defaultLodging(tierId: string): Lodging {
  return tierId === 'pubs' || tierId === 'clubs' ? 'floors' : tierId === 'theatres' || tierId === 'europe' ? 'bnb' : 'hotels';
}

export function lodgingCost(members: number, weeklyCost: number, lodging: Lodging): number {
  const l = LODGING[lodging];
  return Math.round(weeklyCost * l.cost + members * 5 * l.nightly);
}
