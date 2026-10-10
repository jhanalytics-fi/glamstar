// Small shared helpers for the game logic modules.
import { Rng, clamp } from './rng';
import { reveal } from './characters';
import { addAffinity, getAffinity } from './chemistry';
import type { GameState, HiddenTrait, LogEntry, Musician } from './types';

export type Snapshot = ReturnType<typeof snapshot>;

export function log(s: GameState, text: string, tone: LogEntry['tone'] = 'neutral', hidden?: string): void {
  s.log.push(hidden ? { week: s.week, text, tone, hidden } : { week: s.week, text, tone });
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

/**
 * Improve a stat toward the musician's hidden potential. The closer to the ceiling,
 * the slower it goes; at the ceiling it stops.
 */
export function grow(m: Musician, k: 'skill' | 'stage' | 'writing', steps: number, rng: Rng, rate = 1): number {
  let gained = 0;
  for (let i = 0; i < steps; i++) {
    const gap = m.hidden.potential - m[k];
    if (gap <= 0) break;
    if (rng.chance(clamp(gap / 30, 0.05, 0.9) * rate)) {
      adjust(m, k, 1);
      gained++;
    }
  }
  return gained;
}

/** How a coach or a long spell together sums up someone's prospects. */
export function prospects(m: Musician): string {
  const gap = m.hidden.potential - Math.max(m.skill, m.stage);
  return gap >= 15 ? 'has a real future' : gap >= 6 ? 'can still get better' : 'has peaked';
}

// ---------------------------------------------------------------- effects

const VISIBLE = ['skill', 'stage', 'image', 'writing', 'energy', 'mood', 'habit'] as const;
const HIDDEN = ['potential', 'ego', 'reliability', 'vice', 'stamina', 'loyalty'] as const;

/** Everything a choice can change, captured before it happens. */
export function snapshot(s: GameState) {
  return {
    money: s.money,
    fans: s.fans,
    buzz: s.buzz,
    tightness: s.tightness,
    gear: s.gear,
    members: new Map(s.members.map((m) => [m.id, { ...pick(m, VISIBLE), ...m.hidden }])),
  };
}

function pick<T extends object, K extends keyof T>(o: T, keys: readonly K[]): Pick<T, K> {
  const r = {} as Pick<T, K>;
  for (const k of keys) r[k] = o[k];
  return r;
}

const fmt = (d: number) => (d > 0 ? `+${d}` : String(d));

/**
 * Logs one "Effects" line with every visible change since the snapshot, e.g.
 * "£-80, buzz +3. Steve mood +8; Lola skill +1." Hidden-trait changes go in a
 * separate part that only debug mode shows.
 */
export function logEffects(s: GameState, before: Snapshot, opts: { skipRoutine?: boolean } = {}): void {
  const band: string[] = [];
  if (s.money !== before.money) band.push(`money ${s.money > before.money ? '+' : '-'}£${Math.abs(s.money - before.money)}`);
  for (const k of ['fans', 'buzz', 'tightness', 'gear'] as const) if (s[k] !== before[k]) band.push(`${k} ${fmt(s[k] - before[k])}`);
  const people: string[] = [];
  const secret: string[] = [];
  for (const m of s.members) {
    const b = before.members.get(m.id);
    if (!b) continue;
    const who = m.isPlayer ? 'You' : first(m);
    const vis = VISIBLE.filter((k) => m[k] !== b[k] && !(opts.skipRoutine && (k === 'energy' || k === 'mood' || k === 'habit')))
      .map((k) => `${k} ${fmt(m[k] - b[k])}`);
    if (vis.length) people.push(`${who}: ${vis.join(', ')}`);
    const hid = HIDDEN.filter((k) => m.hidden[k] !== b[k]).map((k) => `${k} ${fmt(m.hidden[k] - b[k])}`);
    if (hid.length) secret.push(`${who}: ${hid.join(', ')}`);
  }
  for (const [id] of before.members) if (!s.members.some((m) => m.id === id)) people.push('one member gone');
  const text = [band.join(', '), people.join('; ')].filter(Boolean).join('. ');
  if (text || secret.length) log(s, text ? `Effects: ${text}.` : 'Effects: nothing you can see.', 'fx', secret.length ? `Hidden: ${secret.join('; ')}.` : undefined);
}
