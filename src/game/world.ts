// The music world outside your band: rival London bands, established acts, genre trends and the charts.
import { Rng, clamp } from './rng';
import { bandName, songTitle, stageName } from './names';
import type { Genre } from './types';

export type StarGenre = Genre | 'pop';
export type Origin = 'UK' | 'US' | 'SWE' | 'GER' | 'ITA' | 'NED' | 'FIN' | 'FRA';
export type ChartId = 'london' | 'uk' | 'europe' | 'world';

/** A band on the London circuit, competing with you for the same crowds. */
export interface Rival {
  id: string;
  name: string;
  genre: Genre;
  fans: number;
  buzz: number;
  momentum: number;
}

/** An established act with records out. */
export interface Star {
  id: string;
  name: string;
  genre: StarGenre;
  origin: Origin;
  fame: number;
  single: string;
  /** Weeks since the current single came out. */
  age: number;
  heat: number;
}

export interface ChartEntry {
  id: string;
  artist: string;
  title: string | null;
  origin: Origin | null;
  pos: number;
  last: number | null;
  weeks: number;
  isPlayer: boolean;
}

export interface World {
  rivals: Rival[];
  stars: Star[];
  charts: Record<ChartId, ChartEntry[]>;
  /** Player's best position on each chart so far. */
  peaks: Partial<Record<ChartId, number>>;
  nextId: number;
}

export const CHART_NAME: Record<ChartId, string> = {
  london: 'London Underground 40',
  uk: 'National Top 40',
  europe: 'Euro Top 40',
  world: 'World Top 40',
};

export const CHART_SIZE = 40;
const RIVAL_COUNT = 70;

// Popularity of each sound by year, 1982-1991. Glam peaks with the video age; the end is coming.
const TRENDS: Record<StarGenre, number[]> = {
  //        82    83    84    85    86    87    88    89    90    91
  metal:    [0.55, 0.6, 0.65, 0.65, 0.7, 0.7, 0.75, 0.75, 0.75, 0.7],
  hardrock: [0.6, 0.6, 0.6, 0.6, 0.65, 0.7, 0.75, 0.8, 0.8, 0.7],
  glam:     [0.45, 0.55, 0.7, 0.85, 0.95, 1.0, 0.95, 0.85, 0.7, 0.45],
  punk:     [0.4, 0.3, 0.25, 0.2, 0.2, 0.2, 0.25, 0.3, 0.4, 0.7],
  newwave:  [1.0, 0.95, 0.85, 0.75, 0.65, 0.55, 0.5, 0.45, 0.4, 0.35],
  pop:      [0.9, 0.9, 0.95, 0.95, 0.95, 0.95, 0.95, 0.9, 0.9, 0.9],
};

/** A single climbs for a few weeks, peaks, then slides. */
export function heatCurve(age: number): number {
  return age < 4 ? 0.45 + age * 0.18 : 0.99 * 0.86 ** (age - 4);
}

export function trend(genre: StarGenre, week: number): number {
  const t = TRENDS[genre];
  const y = clamp(week / 52, 0, t.length - 1);
  const i = Math.floor(y);
  const f = y - i;
  return t[i] + (t[Math.min(i + 1, t.length - 1)] - t[i]) * f;
}

const ORIGIN_WEIGHT: Record<Exclude<ChartId, 'london'>, (o: Origin) => number> = {
  uk: (o) => (o === 'UK' ? 1 : o === 'US' ? 0.75 : 0.4),
  europe: (o) => (o === 'UK' || o === 'US' ? 0.8 : 1),
  world: (o) => (o === 'US' ? 1 : o === 'UK' ? 0.7 : 0.3),
};

const PLAYABLE: Genre[] = ['metal', 'hardrock', 'glam', 'punk', 'newwave'];
const STAR_GENRES: StarGenre[] = ['pop', 'pop', 'pop', 'newwave', 'newwave', 'hardrock', 'metal', 'glam', 'punk'];
const EURO: Origin[] = ['SWE', 'GER', 'ITA', 'NED', 'FIN', 'FRA'];

function newRival(rng: Rng, id: string, taken: Set<string>, fans?: number): Rival {
  let name = bandName(rng);
  for (let i = 0; i < 10 && taken.has(name); i++) name = bandName(rng);
  taken.add(name);
  return {
    id,
    name,
    genre: rng.pick(PLAYABLE),
    fans: fans ?? Math.round(25 * Math.exp(rng.next() * 4)),
    buzz: rng.int(0, 40),
    momentum: (rng.next() - 0.5) * 0.08,
  };
}

function newStar(rng: Rng, id: string, taken: Set<string>, origin: Origin, fame: number, genre?: StarGenre, name?: string): Star {
  let n = name ?? (rng.chance(0.3) ? stageName(rng) : bandName(rng));
  for (let i = 0; i < 10 && taken.has(n); i++) n = rng.chance(0.3) ? stageName(rng) : bandName(rng);
  taken.add(n);
  const age = rng.int(0, 14);
  return { id, name: n, genre: genre ?? rng.pick(STAR_GENRES), origin, fame, single: songTitle(rng), age, heat: heatCurve(age) };
}

export function createWorld(rng: Rng, playerBand: string): World {
  const taken = new Set([playerBand]);
  let nextId = 1;
  const id = (p: string) => `${p}${nextId++}`;
  const rivals = Array.from({ length: RIVAL_COUNT }, () => newRival(rng, id('r'), taken));
  const stars: Star[] = [];
  for (let i = 0; i < 34; i++) stars.push(newStar(rng, id('s'), taken, 'UK', rng.int(25, 95)));
  for (let i = 0; i < 34; i++) stars.push(newStar(rng, id('s'), taken, 'US', rng.int(30, 98)));
  for (let i = 0; i < 26; i++) stars.push(newStar(rng, id('s'), taken, rng.pick(EURO), rng.int(20, 85)));
  const w: World = { rivals, stars, charts: { london: [], uk: [], europe: [], world: [] }, peaks: {}, nextId };
  return w;
}

export interface PlayerChartInput {
  bandName: string;
  fans: number;
  buzz: number;
  /** Your records in the shops and this week's sales. */
  records?: { id: string; title: string; units: number }[];
}

export interface ChartNews {
  text: string;
  tone: 'good' | 'bad' | 'neutral';
  /** Worth keeping in the career highlights. */
  milestone?: boolean;
}

/** Advance the outside world by one week and recompute every chart. Returns news worth logging. */
export function advanceWorld(w: World, rng: Rng, week: number, player: PlayerChartInput): ChartNews[] {
  const news: ChartNews[] = [];
  const taken = new Set([player.bandName, ...w.rivals.map((r) => r.name), ...w.stars.map((s) => s.name)]);

  // London circuit
  for (const r of w.rivals) {
    r.momentum = clamp(r.momentum + (rng.next() - 0.5) * 0.03, -0.08, 0.1);
    const t = trend(r.genre, week);
    // Growth slows near the top: London only has so many gig-goers.
    const ceiling = 1 - r.fans / 4000;
    r.fans = Math.max(0, Math.round(r.fans * (1 + (r.momentum > 0 ? r.momentum * ceiling : r.momentum) + (t - 0.65) * 0.03) + rng.int(-3, 3)));
    r.buzz = clamp(Math.round(r.buzz * 0.9 + rng.int(0, 6)), 0, 100);
  }
  const charted = new Set(w.charts.london.filter((e) => e.pos <= 20).map((e) => e.id));
  const signed = w.rivals.filter((r) => r.fans >= 1500 && rng.chance(0.08));
  for (const r of signed) {
    const single = songTitle(rng);
    w.stars.push({ id: r.id, name: r.name, genre: r.genre, origin: 'UK', fame: rng.int(25, 38), single, age: 0, heat: heatCurve(0) });
    news.push({ text: `${r.name} got signed. Their first single, "${single}", is out now.`, tone: 'neutral' });
  }
  const split = w.rivals.filter((r) => r.fans < 15 || rng.chance(0.004));
  for (const r of split) {
    if (charted.has(r.id)) news.push({ text: `${r.name} split up. Musical differences, apparently.`, tone: 'neutral' });
  }
  w.rivals = w.rivals.filter((r) => !signed.includes(r) && !split.includes(r));
  // New bands form and out-of-towners move to London.
  while (w.rivals.length < RIVAL_COUNT) w.rivals.push(newRival(rng, `r${w.nextId++}`, taken, Math.round(20 * Math.exp(rng.next() * 3.5))));

  // Established acts
  for (const s of w.stars) {
    s.age++;
    s.heat = heatCurve(s.age) * (0.95 + rng.next() * 0.1);
    if (s.heat < 0.2 && rng.chance(0.12)) {
      s.single = songTitle(rng);
      s.age = 0;
      s.heat = heatCurve(0);
    }
    s.fame = clamp(s.fame + (rng.next() - 0.52) * 2, 5, 99);
  }
  w.stars = w.stars.filter((s) => s.fame > 8);
  while (w.stars.length < 94) {
    const o = rng.pick<Origin>(['UK', 'US', 'US', ...EURO]);
    w.stars.push(newStar(rng, `s${w.nextId++}`, taken, o, rng.int(20, 45)));
  }

  // Charts
  const playerScore = player.fans * (1 + player.buzz / 100);
  const london = w.rivals.map((r) => ({ id: r.id, artist: r.name, title: null, origin: null, score: r.fans * (1 + r.buzz / 100), isPlayer: false }));
  london.push({ id: 'player', artist: player.bandName, title: null, origin: null, score: playerScore, isPlayer: true });
  setChart(w, 'london', london);

  for (const c of ['uk', 'europe', 'world'] as const) {
    const rows = w.stars
      .filter((s) => s.heat > 0.05)
      .map((s) => ({
        id: s.id,
        artist: s.name,
        title: s.single,
        origin: s.origin,
        score: s.fame * s.heat * trend(s.genre, week) * ORIGIN_WEIGHT[c](s.origin) * (0.92 + rng.next() * 0.16),
        isPlayer: false,
      }));
    for (const r of player.records ?? []) {
      rows.push({ id: `player-${r.id}`, artist: player.bandName, title: r.title, origin: 'UK', score: (r.units / 27) * ORIGIN_WEIGHT[c]('UK') * (0.92 + rng.next() * 0.16), isPlayer: true });
    }
    setChart(w, c, rows);
  }

  // Player chart news
  const me = w.charts.london.find((e) => e.isPlayer);
  if (me) {
    const prevPeak = w.peaks.london;
    if (prevPeak === undefined) news.push({ text: `${player.bandName} entered the ${CHART_NAME.london} at #${me.pos}!`, tone: 'good', milestone: true });
    else if (me.pos < prevPeak && (me.pos <= 10 || me.pos === 1)) {
      news.push({ text: me.pos === 1 ? `Number one on the ${CHART_NAME.london}. London is yours.` : `New peak: #${me.pos} on the ${CHART_NAME.london}.`, tone: 'good', milestone: me.pos === 1 || me.pos === 10 });
    }
    w.peaks.london = Math.min(prevPeak ?? Infinity, me.pos);
  }
  for (const c of ['uk', 'europe', 'world'] as const) {
    const mine = w.charts[c].filter((e) => e.isPlayer).sort((a, b) => a.pos - b.pos)[0];
    if (!mine) continue;
    const prevPeak = w.peaks[c];
    if (prevPeak === undefined) news.push({ text: `"${mine.title}" entered the ${CHART_NAME[c]} at #${mine.pos}!`, tone: 'good', milestone: true });
    else if (mine.pos < prevPeak && mine.pos <= 10) news.push({ text: `"${mine.title}" climbed to #${mine.pos} on the ${CHART_NAME[c]}.`, tone: 'good', milestone: true });
    w.peaks[c] = Math.min(prevPeak ?? Infinity, mine.pos);
  }
  return news;
}

function setChart(w: World, id: ChartId, rows: { id: string; artist: string; title: string | null; origin: Origin | null; score: number; isPlayer: boolean }[]): void {
  const prev = new Map(w.charts[id].map((e) => [e.id + (e.title ?? ''), e]));
  w.charts[id] = rows
    .sort((a, b) => b.score - a.score)
    .slice(0, CHART_SIZE)
    .filter((r) => r.score > 0)
    .map((r, i) => {
      const before = prev.get(r.id + (r.title ?? ''));
      return { id: r.id, artist: r.artist, title: r.title, origin: r.origin, pos: i + 1, last: before?.pos ?? null, weeks: (before?.weeks ?? 0) + 1, isPlayer: r.isPlayer };
    });
}

export function playerPosition(w: World, id: ChartId): number | null {
  return w.charts[id].find((e) => e.isPlayer)?.pos ?? null;
}

/** What's selling right now, strongest first, for flavour text. */
export function hotGenres(week: number): Genre[] {
  return [...PLAYABLE].sort((a, b) => trend(b, week) - trend(a, week));
}

export function pickRivalName(w: World, rng: Rng): string {
  return w.rivals.length ? rng.pick(w.rivals).name : bandName(rng);
}
