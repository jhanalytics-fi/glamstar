// Lightning, both ways. Now and then a song comes out of nowhere, a gig becomes the one people still
// talk about, or the night falls apart through no fault of your own.
import { Rng, clamp } from './rng';
import { chemistry } from './chemistry';
import { addBuzz, adjust, beat, first, log, milestone, player, setVibe } from './helpers';
import { PRESS } from './names';
import type { GameState, Musician, Song } from './types';

/** Odds that this week's writing produces a masterpiece. A few per cent at best; skill, mood and chemistry all help. */
export function masterpieceOdds(s: GameState, writer: Musician): number {
  const chem = chemistry(s).total;
  return clamp(0.004 + (writer.writing / 100) * 0.03 + (writer.mood / 100) * 0.01 + (chem / 100) * 0.01, 0.004, 0.06);
}

/** Turn a freshly written song into the one. */
export function strikeMasterpiece(s: GameState, rng: Rng, song: Song, writer: Musician): void {
  song.quality = rng.int(92, 99);
  song.kind = song.kind === 'trend' ? 'standard' : song.kind;
  s.flags.masterpieces = (s.flags.masterpieces ?? 0) + 1;
  for (const m of s.members) adjust(m, 'mood', 10);
  addBuzz(s, 3);
  const how = rng.pick([
    'came out in one go, verse to coda, in twenty minutes, and nobody dared speak until it was done',
    'arrived at four in the morning on the back of a chip-shop menu, and was still perfect by daylight',
    'started as a joke about the landlord and turned, somewhere around the second chorus, into the best thing any of you have ever done',
    'fell out of a wrong chord that nobody wanted to fix',
  ]);
  beat(s, undefined, `Then it happened. "${song.title}" ${how}. ${writer.isPlayer ? 'You' : first(writer)} played it back three times. The room went very quiet.`, 'reveal');
  log(s, `"${song.title}" is not a song. It is the song. Everyone in the room knows it.`, 'good');
  milestone(s, 'release', `Wrote "${song.title}" (${song.quality}). The one.`);
}

/** When a masterpiece comes out on a record, the press notices. */
export function masterpiecePress(s: GameState, rng: Rng, songs: Song[]): void {
  const gem = songs.find((x) => x.quality >= 92);
  if (!gem) return;
  addBuzz(s, 8);
  log(s, rng.pick([
    `${PRESS} gave "${gem.title}" a full page. "The song of the year, possibly the decade, from a band that cannot spell."`,
    `Three reviewers used the word "masterpiece" about "${gem.title}". One of them meant it as an insult.`,
    `"${gem.title}" was played on the radio at breakfast, lunch and the late show. A vicar complained. Sales doubled.`,
  ]), 'good');
}

export type GigFate = { kind: 'legend' } | { kind: 'disaster'; text: string; perfMult: number; crowdMult: number; cost: number; buzz: number } | null;

/** The night the band, or life, decides. */
export function gigFate(s: GameState, rng: Rng, perf: number, capacity: number): GigFate {
  // A legendary night is a once-or-twice-a-career thing, not a Tuesday. The more you have had, the rarer the next.
  const had = s.flags.legendaryGigs ?? 0;
  const rarity = 1 / (1 + had * 0.5);
  if (perf >= 100 && rng.chance(0.06 * rarity)) return { kind: 'legend' };
  if (perf >= 90 && rng.chance(0.015 * rarity)) return { kind: 'legend' };
  if (!rng.chance(0.035)) return null;
  const big = capacity >= 500;
  const d = rng.pick<Omit<Extract<GigFate, { kind: 'disaster' }>, 'kind'>>([
    { text: 'A fire in the kitchen halfway through the set. Everyone out, the fire brigade in, the encore played on the pavement to forty people and a dog.', perfMult: 0.5, crowdMult: 1, cost: 0, buzz: 4 },
    { text: 'Power cut. The whole street. You played two songs on acoustic guitars by the light of cigarette lighters, then went home.', perfMult: 0.45, crowdMult: 1, cost: 0, buzz: 1 },
    { text: 'The PA blew up on the first chorus with a bang and a smell of burning. The hire company wants paying for it.', perfMult: 0.4, crowdMult: 1, cost: big ? 400 : 120, buzz: -2 },
    { text: `${first(player(s))}'s voice went on the second song. Croaking, then nothing. The ${big ? 'crowd' : 'room'} was kind about it, which was worse.`, perfMult: 0.35, crowdMult: 1, cost: 0, buzz: -3 },
    { text: 'The promoter double-booked the room. A wedding reception had it first. You went on at half past midnight to the stragglers and the bride.', perfMult: 0.7, crowdMult: 0.3, cost: 0, buzz: -1 },
    { text: 'A fight broke out in front of the stage and took the front rows with it. The police cleared the room before the last song.', perfMult: 0.6, crowdMult: 0.8, cost: 0, buzz: 2 },
    { text: 'A burst pipe. Two inches of water on the dance floor and a bass amp humming like it had opinions. The gig was stopped for safety, eventually.', perfMult: 0.5, crowdMult: 0.7, cost: 60, buzz: 0 },
    { text: 'The van was broken into during the soundcheck. The gig went ahead on borrowed gear that nobody could tune.', perfMult: 0.55, crowdMult: 1, cost: big ? 300 : 90, buzz: 0 },
  ]);
  return { kind: 'disaster', ...d };
}

export function applyLegend(s: GameState, rng: Rng, venue: string, crowd: number): void {
  s.flags.legendaryGigs = (s.flags.legendaryGigs ?? 0) + 1;
  setVibe(s, 'gig');
  addBuzz(s, 15);
  for (const m of s.members) { adjust(m, 'mood', 12); adjust(m, 'image', 1); }
  s.fans += Math.min(5000, Math.round(crowd * 0.3));
  beat(s, undefined, rng.pick([
    'Something happened tonight that does not happen. The room and the band became one animal. Nobody can say when, only that it did.',
    'Three encores. The house lights came up and nobody left. The barman stopped serving to watch.',
    'Every song landed. Every note. People will claim they were here who were not.',
  ]), 'reveal');
  milestone(s, 'career', `${venue}: the night they still talk about. ${crowd} people, all of them witnesses.`);
  log(s, `${venue}. The gig. ${PRESS} will call it "legendary" for years and be right.`, 'good');
}

/** On the road: now and then a date simply does not happen. Returns a reason, or null. */
export function tourHiccup(rng: Rng, city: string): { text: string; refund: number } | null {
  if (!rng.chance(0.03)) return null;
  const text = rng.pick([
    `${city}: cancelled. The venue lost its licence on Tuesday.`,
    `${city}: cancelled. Snow on the pass, the bus never got there.`,
    `${city}: cancelled. The promoter has vanished with the float.`,
    `${city}: cancelled. A bomb scare cleared the hall before doors.`,
    `${city}: cancelled. The hall was double-booked with a darts final. The darts won.`,
    `${city}: cancelled. Fire officer counted the exits and shook his head.`,
  ]);
  return { text, refund: rng.chance(0.5) ? 0.5 : 0 };
}
