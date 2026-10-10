// Prints how the London chart and the big charts evolve, to sanity-check the world sim.
import { act, canAct, newGame } from '../src/game/engine';
let s = newGame({ name: 'X', instrument: 'none', bandName: 'Us', background: 'factory', style: 'glam', seed: Number(process.argv[2] ?? 7) });
for (let i = 0; i < 80 && !s.over; i++) {
  const avgE = s.members.reduce((a, m) => a + m.energy, 0) / s.members.length;
  s = act(s, avgE < 40 ? { type: 'rest' } : s.songs.length < 3 ? { type: 'write' } : i % 4 === 3 || canAct(s, { type: 'gig' }) ? { type: 'rehearse' } : { type: 'gig' });
  if (i % 10 === 0) {
    const l = s.world.charts.london;
    const me = l.find((e) => e.isPlayer);
    console.log(`wk ${s.week} fans ${s.fans} buzz ${s.buzz} London #40 fans~${s.world.rivals.map(r=>r.fans).sort((a,b)=>b-a)[39]} #1 ${l[0].artist} me ${me ? '#' + me.pos : '-'} rivals ${s.world.rivals.length}`);
    console.log('   UK:', s.world.charts.uk.slice(0, 3).map((e) => `${e.artist} "${e.title}" (${e.origin}) w${e.weeks}`).join(' | '));
    console.log('   World:', s.world.charts.world.slice(0, 3).map((e) => `${e.artist} (${e.origin}) w${e.weeks}`).join(' | '), 'len', s.world.charts.world.length);
  }
}
console.log(s.log.filter(l=>/chart|signed|split|Underground/.test(l.text)).map(l=>l.week+': '+l.text).join('\n'));
