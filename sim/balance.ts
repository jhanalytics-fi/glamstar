// Plays 300 seeded games with a simple bot and prints outcome stats. Run with `npm run sim`.
import { act, canAct, hire, newGame } from '../src/game/engine';
import { actionOptions } from '../src/game/actions';
import { resolvePending, viewPending } from '../src/game/events';
import { missingForGig } from '../src/game/chemistry';
import { overall } from '../src/game/characters';
import type { Action, GameState, Role } from '../src/game/types';

const results: { won: boolean; reason: string; week: number; fans: number; charted: boolean; releases: number; events: number; tours: number; label: number | undefined; maxTier: string }[] = [];

const RUNS = Number(process.env.RUNS ?? 300);
for (let seed = 1; seed <= RUNS; seed++) {
  let s: GameState = newGame({ name: 'X', instrument: 'none', bandName: 'B', background: (['choirboy', 'artschool', 'factory', 'posh'] as const)[seed % 4], style: 'glam', seed });
  let events = 0;
  let tours = 0;
  let lastTourEnd = -99;
  let maxTier = '-';
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
    if (s.tour) {
      if (s.tour.week + 1 >= s.tour.weeks) lastTourEnd = s.week + 1;
      const worn = s.members.filter((m) => m.energy < 15).length >= 2;
      s = act(s, { type: 'tour', option: worn ? 'abandon' : 'continue:steady' });
      continue;
    }
    const tiers = actionOptions(s, 'tour').filter((o) => !o.locked);
    // Tour every few months once promoters will have you: rest up first, then go.
    const due = s.week - lastTourEnd >= 10;
    if (tiers.length && due && !roleMiss && s.members.some((m) => m.energy < 60)) {
      s = act(s, { type: 'rest', option: 'sleep' });
      continue;
    }
    if (tiers.length && due && !roleMiss) {
      s = act(s, { type: 'tour', option: tiers[tiers.length - 1].id });
      tours++;
      lastTourEnd = s.week + 99; // set properly when the tour ends
      maxTier = tiers[tiers.length - 1].id;
      continue;
    }
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
  results.push({ won: s.over!.won, reason: s.over!.reason.split(':')[0].slice(0, 40), week: s.week, fans: s.fans, charted: s.world.peaks.uk !== undefined, releases: s.releases.length, events, tours, label: s.flags.labelCalling, maxTier });
}

const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
const won = results.filter((r) => r.won);
const tierCount: Record<string, number> = {}; for (const r of results) tierCount[r.maxTier] = (tierCount[r.maxTier] ?? 0) + 1;
console.log('highest tour tier reached', tierCount, 'avg tours', avg(results.map((r) => r.tours)), 'label calling week', avg(results.filter((r) => r.label !== undefined).map((r) => r.label!)), 'label rate', results.filter((r) => r.label !== undefined).length / results.length);
const fansSorted = results.map((r) => r.fans).sort((a, b) => a - b); console.log('end fans p10/p50/p90', fansSorted[Math.floor(RUNS * 0.1)], fansSorted[Math.floor(RUNS * 0.5)], fansSorted[Math.floor(RUNS * 0.9)]);
console.log('win rate', won.length / results.length, 'avg win week', avg(won.map((r) => r.week)));
console.log('won by charting', won.filter((r) => r.charted).length, 'avg releases', avg(results.map((r) => r.releases)), 'events per game', avg(results.map((r) => r.events)));
const byReason: Record<string, number> = {};
for (const r of results) byReason[r.reason] = (byReason[r.reason] ?? 0) + 1;
console.log(byReason);
