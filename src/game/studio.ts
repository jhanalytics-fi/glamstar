// A studio of your own: a room with an eight-track, then a house in the country with a desk in the
// barn, then a villa above the sea with a control room where the dining room was.
import type { GameState } from './types';

export type StudioId = 'eighttrack' | 'country' | 'riviera';

export interface StudioSpec {
  name: string;
  word: string;
  price: number;
  fans: number;
  /** Quality added to every record made there. */
  quality: number;
  /** Share of the recording bill saved (label tab or your own pocket). */
  saving: number;
  /** Rent from other bands in a week it stands idle. */
  rent: number;
  /** Extra song quality for a writing week spent there. */
  writing: number;
}

export const STUDIOS: Record<StudioId, StudioSpec> = {
  eighttrack: { name: 'A room with an eight-track', word: 'The rehearsal room soundproofed with egg boxes, an eight-track in the corner and a kettle.', price: 4000, fans: 500, quality: 2, saving: 0.25, rent: 60, writing: 3 },
  country: { name: 'A residential studio in the country', word: 'A farmhouse with a desk in the barn, bedrooms for six, a cook, and a lane the lorries cannot get down.', price: 60000, fans: 8000, quality: 5, saving: 0.6, rent: 900, writing: 6 },
  riviera: { name: 'A villa studio on the Riviera', word: 'A villa above the sea, a control room where the dining room was, a terrace to write on and a boat.', price: 600000, fans: 40000, quality: 8, saving: 0.85, rent: 5000, writing: 10 },
};
export const STUDIO_ORDER: StudioId[] = ['eighttrack', 'country', 'riviera'];

export const studioOf = (s: GameState): StudioSpec | null => (s.studio ? STUDIOS[s.studio] : null);

/** The best studio a band of this standing could buy right now, if it is a step up. */
export function nextStudio(s: GameState): StudioId | null {
  const own = s.studio ? STUDIO_ORDER.indexOf(s.studio) : -1;
  const fit = STUDIO_ORDER.filter((id, i) => i > own && s.fans >= STUDIOS[id].fans && s.money >= STUDIOS[id].price * 1.3);
  return fit.length ? fit[fit.length - 1] : null;
}

/** Rent in a week the band did not record: only once it has a studio worth hiring. */
export function studioRent(s: GameState): number {
  const st = studioOf(s);
  if (!st || s.flags.studioUsed === s.week) return 0;
  return st.rent;
}
