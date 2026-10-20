// Plays 300 seeded games with a simple bot and prints outcome stats. Run with `npm run sim`.
import { act, canAct, hire, newGame } from '../src/game/engine';
import { actionOptions } from '../src/game/actions';
import { resolvePending, viewPending } from '../src/game/events';
import { missingForGig } from '../src/game/chemistry';
import { overall } from '../src/game/characters';
import { signOffer } from '../src/game/labels';
import { TOUR_TIERS } from '../src/game/tour';
import type { Action, GameState, Role } from '../src/game/types';

const labelsSeen = new Set<string>();
const checkpoints = [26, 52, 104, 208, 312, 416];
const moneyAt: Record<number, number[]> = {};
const fansAt: Record<number, number[]> = {};
const brokeWeeks: number[] = [];
const flow: Record<string, number> = {};
const fanFlow: Record<string, number> = {};
const peaks = { uk: 0, uk10: 0, europe: 0, world: 0, world10: 0 };
const lastLogs: string[][] = [];
const brokeSigned: number[] = [];
const signings: number[] = [];
const deaths: number[] = [];
const results: { won: boolean; reason: string; week: number; fans: number; charted: boolean; releases: number; events: number; tours: number; label: number | undefined; maxTier: string }[] = [];

const RUNS = Number(process.env.RUNS ?? 300);
function track(st: GameState, a: Action): GameState {
  const before = st.money;
  const fb = st.fans;
  const after = act(st, a);
  const k = a.type === 'tour' ? 'tour' : a.type;
  flow[k] = (flow[k] ?? 0) + (after.money - before);
  fanFlow[k] = (fanFlow[k] ?? 0) + (after.fans - fb);
  return after;
}
for (let seed = 1; seed <= RUNS; seed++) {
  let s: GameState = newGame({ name: 'X', instrument: 'none', bandName: 'B', background: (['choirboy', 'artschool', 'factory', 'posh'] as const)[seed % 4], style: 'glam', seed });
  let events = 0;
  let tours = 0;
  let lastTourEnd = -99;
  let maxTier = '-';
  let signed = 0;
  while (!s.over) {
    while (s.pending) {
      events++;
      const v = viewPending(s)!;
      const free = v.options.map((o, i) => ({ o, i })).filter((x) => !x.o.locked);
      // Skint bands pick the cheapest way out; otherwise a mix of everything.
      const pickI = s.money < 300 ? [...free].sort((x, y) => x.o.cost - y.o.cost)[0].i : free[(seed + events) % free.length].i;
      s = resolvePending(s, pickI);
    }
    if (s.over) break;
    if (checkpoints.includes(s.week)) { (moneyAt[s.week] ??= []).push(s.money); (fansAt[s.week] ??= []).push(s.fans); }
    if (!s.contract && s.offers.length) { const best = [...s.offers].sort((a, b) => b.terms.advance - a.terms.advance)[0]; s = signOffer(s, best.id); signed++; labelsSeen.add(best.label); }
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
      s = track(s, { type: 'tour', option: worn ? 'abandon' : 'continue:steady' });
      continue;
    }
    // A sensible manager books a tier the band can fill and afford.
    const tiers = actionOptions(s, 'tour').filter((o) => { if (o.locked) return false; const t = TOUR_TIERS.find((x) => x.id === o.id); return !t || process.env.RECKLESS === '1' || (s.fans >= t.fans * 1.4 && s.money >= t.weeklyCost); });
    // Tour every few months once promoters will have you: rest up first, then go.
    const due = s.week - lastTourEnd >= 10;
    if (tiers.length && due && !roleMiss && s.members.some((m) => m.energy < 60)) {
      s = track(s, { type: 'rest', option: 'sleep' });
      continue;
    }
    if (tiers.length && due && !roleMiss) {
      s = track(s, { type: 'tour', option: tiers[tiers.length - 1].id });
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
    s = track(s, a);
  }
  signings.push(signed);
  const pk = s.world.peaks; if (pk.uk !== undefined) peaks.uk++; if ((pk.uk ?? 99) <= 10) peaks.uk10++; if (pk.europe !== undefined) peaks.europe++; if (pk.world !== undefined) peaks.world++; if ((pk.world ?? 99) <= 10) peaks.world10++;
  if (!s.over!.won && /landlord/.test(s.over!.reason)) { lastLogs.push([`week ${s.week} fans ${s.fans} contract ${s.contract?.label ?? '-'} manager ${s.manager?.name ?? '-'}`, ...s.log.slice(-14).map((l) => l.text.slice(0, 130))]); brokeWeeks.push(s.week); brokeSigned.push(s.contract ? 1 : 0); }
  results.push({ won: s.over!.won, reason: s.over!.reason.split(':')[0].slice(0, 40), week: s.week, fans: s.fans, charted: s.world.peaks.uk !== undefined, releases: s.releases.length, events, tours, label: s.flags.labelCalling, maxTier });
  deaths.push((s.memorials ?? []).length + (s.over!.died ? 1 : 0));
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
console.log('signings per game', avg(signings), 'labels used', [...labelsSeen].join(', '));

const med = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : 0);
console.log('median money at', Object.fromEntries(checkpoints.map((w) => [w, med(moneyAt[w] ?? [])])));
console.log('median fans at', Object.fromEntries(checkpoints.map((w) => [w, med(fansAt[w] ?? [])])));
console.log('broke weeks', brokeWeeks.sort((a, b) => a - b).join(','), 'signed when broke', brokeSigned.reduce((a, b) => a + b, 0));
console.log('money flow by action (incl. that week\'s upkeep and events)', Object.fromEntries(Object.entries(flow).map(([k, v]) => [k, Math.round(v / RUNS)])));
console.log('deaths per game', avg(deaths), 'games with a death', deaths.filter((d) => d > 0).length, 'of', RUNS);
for (const l of lastLogs.slice(0, 9)) console.log('---\n' + l.join('\n'));
console.log('chart peaks reached (games)', peaks, 'of', RUNS);
console.log('fan flow by action (incl. that week\'s record sales and events)', Object.fromEntries(Object.entries(fanFlow).map(([k, v]) => [k, Math.round(v / RUNS)])));
