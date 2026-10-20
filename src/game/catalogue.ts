// The back catalogue has a life of its own. Labels lift singles without asking, put out compilations
// when the band goes quiet, and bootleggers press whatever they taped from the mixing desk.
import { Rng, clamp } from './rng';
import { liftable, OUTSIDE_CUT, liftFatigue } from './actions';
import { addBuzz, adjust, log, milestone } from './helpers';
import { labelById, royaltyPerCopy } from './labels';
import type { GameState, Release, ReleaseKind } from './types';

const since = (s: GameState, flag: string, weeks: number) => s.flags[flag] === undefined || s.week - s.flags[flag] >= weeks;

/** Press a record out of what already exists: no studio, no new songs, just a sleeve and a title. */
export function pressRecord(s: GameState, kind: ReleaseKind, title: string, quality: number, appeal: number, opts: { comp?: Release['comp']; label?: string; royalty?: number; outside?: boolean } = {}): Release {
  const rec: Release = { id: `rel${s.nextId++}`, kind, title, quality: clamp(Math.round(quality), 1, 99), appeal, week: s.week, sold: 0, lastWeek: 0 };
  if (opts.comp) rec.comp = opts.comp;
  if (opts.label) { rec.label = opts.label; rec.royalty = opts.royalty ?? 0; }
  if (opts.outside) rec.outside = true;
  s.releases.push(rec);
  return rec;
}

/** Average quality of the band's best released songs, for a record cut from the catalogue. */
export function catalogueQuality(s: GameState, n = 8): number {
  const q = s.songs.filter((x) => x.released).map((x) => x.quality).sort((a, b) => b - a).slice(0, n);
  return q.length ? q.reduce((a, b) => a + b, 0) / q.length : 0;
}

/** Labels that have put out an album by the band, past and present. */
export function labelsWithAlbums(s: GameState): string[] {
  return [...new Set(s.releases.filter((r) => r.kind === 'album' && r.label && !r.comp).map((r) => r.label!))];
}

export const LABEL_LIFT_GAP = 12;

/** Once a week: a label with an album to work may lift a single off it without asking. */
export function catalogueWeek(s: GameState, rng: Rng): void {
  const c = s.contract;
  if (!c || !since(s, 'labelLift', LABEL_LIFT_GAP)) return;
  const l = labelById(c.label);
  const songs = liftable(s);
  if (!songs.length) return;
  const album = s.releases.find((r) => r.id === songs[0].album);
  if (!album || s.week - album.week < 6) return;
  // A label that likes you works the album: singles out in series without a week of yours spent.
  const n = s.songs.filter((x) => x.album === album.id && x.lifted).length;
  const odds = (l.tier === 'shark' ? 0.12 : c.goodwill < 45 ? 0.06 : c.goodwill >= 60 ? 0.14 : 0.05) * (n >= 3 ? 0.5 : 1);
  if (!rng.chance(odds)) return;
  const song = songs[0];
  song.lifted = true;
  s.flags.labelLift = s.week;
  s.flags.labelLifts = (s.flags.labelLifts ?? 0) + 1;
  const rec = pressRecord(s, 'single', song.title, song.quality + s.tightness * 0.1 + rng.int(-4, 4), album.appeal * 0.95 * liftFatigue(n), { label: c.label, royalty: royaltyPerCopy(c.terms, 'single', s.flags.producerPoints ?? 0) * (song.outside ? OUTSIDE_CUT : 1), outside: song.outside });
  addBuzz(s, 4);
  if (c.goodwill < 60) for (const m of s.members) adjust(m, 'mood', -3);
  milestone(s, 'release', `${l.name} lifted "${rec.title}" as a single without asking.`);
  log(s, `${l.name} have put out "${rec.title}" as a single. Nobody asked the band. The sleeve has a photo from ${rng.pick(['two haircuts ago', 'the wrong gig', 'a session the drummer missed', 'the school play, apparently'])}.`, 'neutral');
}
