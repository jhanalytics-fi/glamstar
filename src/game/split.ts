// The band deal. The bank is one pot, but everyone knows what their share would be, and everyone counts.
import { Rng } from './rng';
import { adjust, log } from './helpers';
import type { GameState, IncomeKind, Split } from './types';

export const SPLIT_LABEL: Record<Split, string> = { equal: 'Equal shares', writers: 'Writers keep the publishing', leader: "The leader's band" };
export const SPLIT_WORD: Record<Split, string> = {
  equal: 'Everything split evenly, songs included. Calm, until the one who writes everything does the maths.',
  writers: 'Gig money split evenly; record money and royalties go half evenly, half by who wrote the songs. Fair, says the writer.',
  leader: 'You take 40% of everything, the rest share the rest. Your name, your band, their faces.',
};

const PUBLISHING = new Set<IncomeKind>(['singles', 'eps', 'albums', 'royalties']);

/** Share of the band's released songs each member wrote. */
export function writerShares(s: GameState): Record<string, number> {
  const out: Record<string, number> = {};
  const songs = s.songs.filter((x) => !x.outside);
  for (const x of songs) out[x.writer] = (out[x.writer] ?? 0) + 1;
  const total = Object.values(out).reduce((a, b) => a + b, 0);
  if (!total) return {};
  for (const k of Object.keys(out)) out[k] /= total;
  return out;
}

/** What fraction of a pound of this kind each current member is owed on paper. */
export function shares(s: GameState, kind: IncomeKind): Record<string, number> {
  const ms = s.members;
  const n = ms.length;
  const out: Record<string, number> = {};
  if (!n) return out;
  const split = s.split ?? 'equal';
  if (split === 'leader') {
    const me = ms.find((m) => m.isPlayer);
    const rest = ms.filter((m) => !m.isPlayer);
    for (const m of ms) out[m.id] = n === 1 ? 1 : m.isPlayer ? 0.4 : 0.6 / rest.length;
    if (me && !rest.length) out[me.id] = 1;
    return out;
  }
  if (split === 'writers' && PUBLISHING.has(kind)) {
    const w = writerShares(s);
    const credited = Object.keys(w).filter((id) => ms.some((m) => m.id === id));
    const creditedTotal = credited.reduce((a, id) => a + w[id], 0) || 1;
    for (const m of ms) out[m.id] = 0.5 / n + 0.5 * ((w[m.id] ?? 0) / creditedTotal);
    return out;
  }
  for (const m of ms) out[m.id] = 1 / n;
  return out;
}

/** Book a pound of income to everyone's paper share. */
export function shareOut(s: GameState, kind: IncomeKind, amount: number): void {
  if (amount <= 0 || kind.startsWith('u_')) return;
  const sh = shares(s, kind);
  for (const m of s.members) m.earned = Math.round(((m.earned ?? 0) + amount * (sh[m.id] ?? 0)) * 100) / 100;
}

/** Once a week: the deal is felt. Whoever is short on paper sulks; whoever writes everything for nothing sulks too. */
export function splitWeek(s: GameState, rng: Rng): void {
  const ms = s.members.filter((m) => !m.isPlayer);
  if (!ms.length || !rng.chance(0.3)) return;
  const split = s.split ?? 'equal';
  const total = s.members.reduce((a, m) => a + (m.earned ?? 0), 0);
  if (total < 2000) return;
  const avg = total / s.members.length;
  const w = writerShares(s);
  if (split === 'equal') {
    const hog = s.members.find((m) => (w[m.id] ?? 0) >= 0.6 && m.hidden.ego >= 55 && !m.isPlayer);
    if (hog) { adjust(hog, 'mood', -2); if (rng.chance(0.15)) log(s, `${hog.name.split(' ')[0]} has worked out what the songs would be worth on paper and would like a word about the deal.`, 'neutral'); }
  } else {
    for (const m of ms) {
      if ((m.earned ?? 0) < avg * 0.6) { adjust(m, 'mood', -2); m.hidden.loyalty = Math.max(1, m.hidden.loyalty - (rng.chance(0.3) ? 1 : 0)); }
    }
    if (rng.chance(0.1)) { const short = ms.filter((m) => (m.earned ?? 0) < avg * 0.6); if (short.length) log(s, `${short.map((m) => m.name.split(' ')[0]).join(' and ')} did the sums on the band deal again. Quietly, in the van.`, 'neutral'); }
  }
}
