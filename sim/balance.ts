// Plays 300 seeded games with a simple bot and prints outcome stats. Run with `npm run sim`.
import { act, canAct, hire, newGame } from '../src/game/engine';
import { actionOptions } from '../src/game/actions';
import { resolvePending, viewPending } from '../src/game/events';
import { missingForGig } from '../src/game/chemistry';
import { overall } from '../src/game/characters';
import type { Action, GameState, Role } from '../src/game/types';

const results: { won: boolean; reason: string; week: number; fans: number; charted: boolean; releases: number; events: number }[] = [];

for (let seed = 1; seed <= 300; seed++) {
  let s: GameState = newGame({ name: 'X', instrument: 'none', bandName: 'B', background: (['choirboy', 'artschool', 'factory', 'posh'] as const)[seed % 4], style: 'glam', seed });
  let events = 0;
  while (!s.over) {
    while (s.pending) {
      events++;
      const v = viewPending(s)!;
      const free = v.options.map((o, i) => ({ o, i })).filter((x) => !x.o.locked);
      s = resolvePending(s, free[seed % free.length].i);
    }
    if (s.over) break;
    if (s.candidates.length && s.candidateRole) {
      const best = [...s.candidates].sort((a, b) => overall(b) - overall(a))[0];
      const cur = s.members.find((m) => m.role === s.candidateRole && !m.isPlayer);
      if (!cur || overall(best) > overall(cur) + 5) s = hire(s, best.id, cur?.id);
      s = { ...s, candidates: [], candidateRole: null };
    }
    const avgE = s.members.reduce((a, m) => a + m.energy, 0) / s.members.length;
    const avgM = s.members.reduce((a, m) => a + m.mood, 0) / s.members.length;
    const miss = missingForGig(s);
    const roleMiss: Role | null = miss.includes('a drummer') ? 'drums' : miss.includes('a bassist') ? 'bass' : miss.includes('a guitarist') ? 'guitar' : null;
    const bestGig = actionOptions(s, 'gig').filter((o) => !o.locked && o.id.startsWith('venue')).pop();
    const unreleased = s.songs.filter((x) => !x.released).length;
    let a: Action;
    if (roleMiss && s.members.every((m) => m.outWeeks === 0)) a = { type: 'advertise', option: 'classified', role: roleMiss };
    else if (avgE < 40) a = { type: 'rest', option: 'sleep' };
    else if (avgM < 40) a = { type: 'party', option: 'squat' };
    else if (s.songs.length < 3 || (unreleased < 2 && s.week % 3 === 0)) a = { type: 'write', option: 'jam' };
    else if (!s.releases.some((r) => r.kind === 'demo')) a = { type: 'release', option: 'demo' };
    else if (s.fans > 400 && unreleased >= 2 && s.money > 600 && !s.releases.some((r) => r.kind === 'single' && s.week - r.week < 12)) a = { type: 'release', option: 'single' };
    else if (s.tightness < 40) a = { type: 'rehearse', option: 'regular' };
    else if (bestGig) a = { type: 'gig', option: bestGig.id };
    else a = { type: 'rehearse', option: 'regular' };
    if (canAct(s, a)) a = { type: 'rest', option: 'sleep' };
    s = act(s, a);
  }
  results.push({ won: s.over!.won, reason: s.over!.reason.slice(0, 32), week: s.week, fans: s.fans, charted: s.world.peaks.uk !== undefined, releases: s.releases.length, events });
}

const won = results.filter((r) => r.won);
const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
console.log('win rate', won.length / results.length, 'avg win week', avg(won.map((r) => r.week)));
console.log('won by charting', won.filter((r) => r.charted).length, 'avg releases', avg(results.map((r) => r.releases)), 'events per game', avg(results.map((r) => r.events)));
const byReason: Record<string, number> = {};
for (const r of results) byReason[r.reason] = (byReason[r.reason] ?? 0) + 1;
console.log(byReason);
