// Instruments. A beginner with a plywood guitar through a practice amp sounds like one, whatever the
// fingers can do; past a certain point a better guitar is for the player, not the room.
import { Rng, clamp } from './rng';
import type { GameState, Musician } from './types';

const available = (s: GameState) => s.members.filter((m) => m.outWeeks === 0);

/** How a musician's kit scales what they can do. Steep at the bottom, flat at the top. */
export function kitFactor(kit: number): number {
  return 0.78 + 0.22 * Math.sqrt(clamp(kit, 1, 100) / 100);
}

export function bandKit(s: GameState): number {
  const here = available(s);
  return here.length ? Math.round(here.reduce((a, m) => a + (m.kit ?? 30), 0) / here.length) : 30;
}

/** Backline (amps, PA, lights) still counts, but a proper venue supplies its own. */
export function backlineBonus(s: GameState, capacity?: number): number {
  const own = s.gear ?? 0;
  return (capacity && capacity >= 1500 ? Math.max(own, 3) : own) * 3;
}

/** Spending on an instrument: the first £500 does most of the work. */
export function kitGain(kit: number, spend: number): number {
  const room = 100 - kit;
  return Math.round(room * (1 - Math.exp(-spend / 500)) * 0.9);
}

/** A sensible kit level for a newcomer of this standing. */
export function startingKit(rng: Rng, tier: 'weak' | 'average' | 'good', fans = 0): number {
  const base = tier === 'good' ? 45 : tier === 'average' ? 32 : 20;
  return clamp(Math.round(rng.around(base, 10) + Math.min(25, Math.log10(Math.max(1, fans) / 100) * 10)), 5, 95);
}

/** The road wears gear out: strings, skins, valves, a dropped guitar. */
export function wearKit(s: GameState, rng: Rng, chance: number): Musician | null {
  const here = available(s).filter((m) => (m.kit ?? 30) > 5);
  if (!here.length || !rng.chance(chance)) return null;
  const m = rng.pick(here);
  m.kit = clamp((m.kit ?? 30) - rng.int(1, 3), 1, 100);
  return m;
}

export const KIT_WORD = (k: number) => (k < 20 ? 'junk' : k < 35 ? 'beginner stuff' : k < 50 ? 'decent' : k < 65 ? 'proper' : k < 80 ? 'pro' : k < 92 ? 'vintage and boutique' : 'museum grade');

/** Fictional instruments to want, by role. */
export const WISHLIST: Record<string, string[]> = {
  guitar: ['a 1962 Harlow Comet', 'a Vulcan Firebrand through a Stack 100', 'a sunburst Kestrel Deluxe', 'a Tungsten Flying Blade', 'a white Monarch Custom like the one on the poster'],
  bass: ['a Harlow Precision Thunder', 'a fretless Osprey', 'a Vulcan Mammoth and a fridge-sized cabinet', 'a 1966 Kestrel Jazzman'],
  drums: ['a double-kick Valhalla Thunderwood kit', 'a set of Zenith cymbals', 'a Rotary 24-inch kick', 'a chrome Meridian kit with a gong'],
  keys: ['a Polyvox Prophecy synthesiser', 'a second-hand Mellowtone', 'a Harlow electric piano', 'a Fairweather sampler the size of a wardrobe'],
  vocals: ['a wireless Sennstar microphone', 'a vocal effects rack with a harmoniser', 'a gold-plated Sennstar SM', 'a proper monitor rig'],
};
