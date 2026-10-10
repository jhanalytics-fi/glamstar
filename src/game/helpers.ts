// Small shared helpers for the game logic modules.
import { Rng, clamp } from './rng';
import { reveal } from './characters';
import { addAffinity, getAffinity } from './chemistry';
import type { GameState, HiddenTrait, LogEntry, Musician } from './types';

export function log(s: GameState, text: string, tone: LogEntry['tone'] = 'neutral'): void {
  s.log.push({ week: s.week, text, tone });
  if (s.log.length > 200) s.log.splice(0, s.log.length - 200);
}

export function revealLog(s: GameState, m: Musician, t: HiddenTrait, level: 1 | 2): void {
  if (reveal(m, t, level)) {
    const what = level === 2 ? 'now know exactly' : 'have a feel for';
    log(s, `You ${what} ${m.isPlayer ? 'your own' : `${first(m)}'s`} ${t}.`, 'reveal');
  }
}

/** Short name for the log: the nickname if there is one, else the first word of the known-as name. */
export function first(m: Musician): string {
  const nick = m.name.match(/"([^"]+)"/);
  return nick ? nick[1] : m.name.split(' ')[0];
}

/** "You were" / "Razor was" style subject. */
export function subj(m: Musician, verbYou: string, verbThey: string): string {
  return m.isPlayer ? `You ${verbYou}` : `${first(m)} ${verbThey}`;
}

export function player(s: GameState): Musician {
  return s.members.find((m) => m.isPlayer)!;
}

export function mutate(state: GameState, fn: (s: GameState, rng: Rng) => void): GameState {
  const s = structuredClone(state);
  const rng = new Rng(s.rng);
  fn(s, rng);
  s.rng = rng.state;
  return s;
}

export function adjust(m: Musician, k: 'energy' | 'mood' | 'habit' | 'skill' | 'stage' | 'image' | 'writing', d: number): void {
  const lo = k === 'energy' || k === 'mood' || k === 'habit' ? 0 : 1;
  const hi = k === 'energy' || k === 'mood' || k === 'habit' ? 100 : 99;
  m[k] = clamp(Math.round(m[k] + d), lo, hi);
}

export function addBuzz(s: GameState, d: number): void {
  s.buzz = clamp(Math.round(s.buzz + d), 0, 100);
}

export function signed(n: number): string {
  return n >= 0 ? `+${n}` : String(n);
}

export function removeMember(s: GameState, id: string, how: 'fired' | 'quit' | 'poached'): void {
  const m = s.members.find((x) => x.id === id);
  if (!m || m.isPlayer) throw new Error('You cannot fire yourself. Yet.');
  s.members = s.members.filter((x) => x.id !== id);
  for (const o of s.members) {
    const liked = getAffinity(s, o.id, id);
    if (how === 'fired' && liked > 30 && !o.isPlayer) {
      adjust(o, 'mood', -8);
      addAffinity(s, o.id, 'p', -10);
    }
  }
  for (const k of Object.keys(s.affinity)) if (k.split('|').includes(id)) delete s.affinity[k];
  if (how === 'fired') log(s, `You fired ${m.name}. ${m.hidden.ego >= 70 ? 'Took the good amp on the way out.' : 'Took it better than expected.'}`, 'bad');
}
