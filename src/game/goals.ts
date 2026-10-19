// The long road to rock immortality, one rung at a time. The UI shows the next rung.
import type { GameState } from './types';

interface Rung {
  text: string;
  done: (s: GameState) => boolean;
}

const peak = (s: GameState, c: 'london' | 'uk' | 'europe' | 'world') => s.world.peaks[c] ?? 99;
const toured = (s: GameState, region: string) => (s.flags[`toured_${region}`] ?? 0) > 0;

export const LADDER: Rung[] = [
  { text: 'Write three songs of your own', done: (s) => s.songs.length >= 3 },
  { text: 'Play your first gig', done: (s) => s.lastGigWeek !== null },
  { text: 'Win 100 fans', done: (s) => s.fans >= 100 },
  { text: 'Get a tape out', done: (s) => s.releases.length > 0 },
  { text: 'Break into the London Underground 40', done: (s) => peak(s, 'london') <= 40 },
  { text: 'Tour the pubs and bars', done: (s) => toured(s, 'southeast') },
  { text: 'Put out a real record', done: (s) => s.releases.some((r) => r.kind !== 'demo') },
  { text: 'Get the record labels calling', done: (s) => s.flags.labelCalling !== undefined || s.flags.chartedNational !== undefined },
  { text: 'Top 10 in London', done: (s) => peak(s, 'london') <= 10 },
  { text: 'Tour the UK', done: (s) => toured(s, 'uk') },
  { text: 'A National Top 40 hit', done: (s) => peak(s, 'uk') <= 40 },
  { text: 'Number one in London', done: (s) => peak(s, 'london') === 1 },
  { text: 'Conquer Europe', done: (s) => toured(s, 'europe') },
  { text: 'A National Top 10 hit', done: (s) => peak(s, 'uk') <= 10 },
  { text: 'Play the arenas', done: (s) => toured(s, 'ukeurope') },
  { text: 'A National number one', done: (s) => peak(s, 'uk') === 1 },
  { text: 'Break America', done: (s) => toured(s, 'northamerica') },
  { text: 'A World Top 10 hit', done: (s) => peak(s, 'world') <= 10 },
  { text: 'Fill the stadiums of the world', done: (s) => toured(s, 'world') },
  { text: 'Number one in the world', done: (s) => peak(s, 'world') === 1 },
  { text: '100,000 fans', done: (s) => s.fans >= 100000 },
];

/** Every rung climbed: the band has nothing left to prove. */
export function ladderDone(s: GameState): boolean {
  return LADDER.every((r) => r.done(s));
}

/** The next unclaimed rung, how far up the ladder you are, and how many rungs there are. */
export function nextGoal(s: GameState): { text: string; step: number; total: number } {
  const i = LADDER.findIndex((r) => !r.done(s));
  if (i === -1) return { text: 'You are a rock god. Now try to survive it.', step: LADDER.length, total: LADDER.length };
  return { text: LADDER[i].text, step: i, total: LADDER.length };
}
