import { clamp } from './rng';
import type { GameState, Genre, Musician } from './types';

const COMPAT: Record<Genre, Record<Genre, number>> = {
  metal:    { metal: 1,   hardrock: 0.8, glam: 0.45, punk: 0.55, newwave: 0.1 },
  hardrock: { metal: 0.8, hardrock: 1,   glam: 0.75, punk: 0.4,  newwave: 0.25 },
  glam:     { metal: 0.45, hardrock: 0.75, glam: 1,  punk: 0.3,  newwave: 0.55 },
  punk:     { metal: 0.55, hardrock: 0.4, glam: 0.3, punk: 1,    newwave: 0.7 },
  newwave:  { metal: 0.1, hardrock: 0.25, glam: 0.55, punk: 0.7, newwave: 1 },
};

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function getAffinity(s: GameState, a: string, b: string): number {
  return s.affinity[pairKey(a, b)] ?? 0;
}

export function addAffinity(s: GameState, a: string, b: string, delta: number): void {
  const k = pairKey(a, b);
  s.affinity[k] = clamp(Math.round((s.affinity[k] ?? 0) + delta), -100, 100);
}

function pairs<T>(xs: T[]): [T, T][] {
  const out: [T, T][] = [];
  for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) out.push([xs[i], xs[j]]);
  return out;
}

export function forEachPair(members: Musician[], fn: (a: Musician, b: Musician) => void): void {
  for (const [a, b] of pairs(members)) fn(a, b);
}

export interface ChemistryBreakdown {
  total: number;
  style: number;
  affinity: number;
  mood: number;
  egoPenalty: number;
}

export function chemistry(s: GameState): ChemistryBreakdown {
  const ms = s.members;
  if (ms.length < 2) return { total: 50, style: 50, affinity: 50, mood: 50, egoPenalty: 0 };
  const ps = pairs(ms);
  const style = (ps.reduce((acc, [a, b]) => acc + COMPAT[a.style][b.style], 0) / ps.length) * 100;
  const affinity = (ps.reduce((acc, [a, b]) => acc + getAffinity(s, a.id, b.id), 0) / ps.length + 100) / 2;
  const mood = ms.reduce((acc, m) => acc + m.mood, 0) / ms.length;
  const bigEgos = ms.filter((m) => m.hidden.ego >= 70).length;
  const egoPenalty = Math.max(0, bigEgos - 1) * 12;
  const total = clamp(Math.round(style * 0.3 + affinity * 0.4 + mood * 0.3 - egoPenalty), 0, 100);
  return { total, style: Math.round(style), affinity: Math.round(affinity), mood: Math.round(mood), egoPenalty };
}

/** Members who can actually play this week. */
export function available(s: GameState): Musician[] {
  return s.members.filter((m) => m.outWeeks === 0);
}

/** A gig needs a voice, a guitar (or keys), a bass and drums. */
export function missingForGig(s: GameState): string[] {
  const here = available(s);
  const has = (r: string) => here.some((m) => m.role === r || m.doubles === r);
  const missing: string[] = [];
  if (!has('vocals')) missing.push('a singer');
  if (!has('guitar') && !has('keys')) missing.push('a guitarist');
  if (!has('bass')) missing.push('a bassist');
  if (!has('drums')) missing.push('a drummer');
  return missing;
}

/** How good the band sounds tonight, roughly 0-120. */
export function performance(s: GameState, wasted: Set<string> = new Set()): number {
  const here = available(s);
  if (here.length === 0) return 0;
  const indiv =
    here.reduce((acc, m) => {
      let v = m.skill * 0.6 + m.stage * 0.4;
      if (m.energy < 30) v *= 0.75;
      if (wasted.has(m.id)) v *= 0.55;
      return acc + v;
    }, 0) / here.length;
  const songBonus = topSongs(s).length ? (avgQuality(s) - 40) * 0.15 : -6; // covers only
  const chem = chemistry(s).total;
  const factor = 0.6 + (chem / 100) * 0.7;
  return Math.max(0, Math.round((indiv + s.tightness * 0.2 + songBonus) * factor));
}

export function topSongs(s: GameState, n = 6) {
  return [...s.songs].sort((a, b) => b.quality - a.quality).slice(0, n);
}

export function avgQuality(s: GameState): number {
  const t = topSongs(s);
  return t.length ? t.reduce((a, x) => a + x.quality, 0) / t.length : 0;
}
