// Deps: session players who cover for a member who is away. Call the same one often enough and they
// start to feel like one of the band.
import { Rng, clamp } from './rng';
import { log } from './helpers';
import type { GameState, Role, Sub } from './types';

const SUB_NAMES = ['Gaz', 'Mel', 'Dougie', 'Tash', 'Winston', 'Shona', 'Ravi', 'Bev', 'Lenny', 'Jacqui', 'Errol', 'Siobhan'];
const SUB_LAST = ['from the Rat Pit house band', 'who plays on everybody\'s records', 'from the pit of a West End show', 'who used to be in a band you supported', 'from the music shop', 'who answered the advert last year'];

/** Members who are away but whose chair a dep can fill (never the singer). */
export function covered(s: GameState): Role[] {
  const here = s.members.filter((m) => m.outWeeks === 0);
  const has = (r: string) => here.some((m) => m.role === r || m.doubles === r);
  const out = s.members.filter((m) => m.outWeeks > 0 && !m.isPlayer);
  const roles: Role[] = [];
  for (const m of out) {
    if (m.role === 'vocals') continue;
    if (m.role === 'guitar' && (has('guitar') || has('keys'))) continue;
    if (m.role !== 'guitar' && has(m.role)) continue;
    if (!roles.includes(m.role)) roles.push(m.role);
  }
  return roles;
}

/** Can the band afford to call deps at all? Pub bands make do; from 150 fans there is a phone number. */
export const canDep = (s: GameState) => s.fans >= 150;

export function depFee(s: GameState): number {
  return Math.round(clamp(40 + s.fans * 0.01, 40, 2000) / 10) * 10;
}

/** The dep for a role: the same one each time, if they are free. */
export function subFor(s: GameState, role: Role, rng: Rng): Sub {
  s.subs ??= {};
  const have = s.subs[role];
  if (have) return have;
  const sub: Sub = { name: `${rng.pick(SUB_NAMES)} ${rng.pick(SUB_LAST)}`, role, times: 0, skill: rng.int(48, 62) };
  s.subs[role] = sub;
  return sub;
}

/** Call the deps for a show. Returns their fee, already taken, and the skill they bring. */
export function callDeps(s: GameState, rng: Rng, roles: Role[]): { fee: number; skill: number; names: string[] } {
  let fee = 0;
  let skill = 0;
  const names: string[] = [];
  for (const r of roles) {
    const sub = subFor(s, r, rng);
    sub.times++;
    sub.skill = clamp(sub.skill + (sub.times % 3 === 0 ? 1 : 0), 1, 85);
    fee += depFee(s);
    skill += sub.skill;
    names.push(sub.name.split(' ')[0]);
  }
  s.money -= fee;
  if (roles.length) log(s, `${names.join(' and ')} depped on ${roles.join(' and ')}. £${fee.toLocaleString('en-GB')} in cash at the end of the night.`, 'neutral');
  return { fee, skill, names };
}

/** A dep who has covered often enough to count. */
export function closeSub(s: GameState): Sub | null {
  const subs = Object.values(s.subs ?? {});
  return subs.find((x) => x.times >= 4 && !x.offered) ?? null;
}
