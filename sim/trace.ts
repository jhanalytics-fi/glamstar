import { act, newGame } from '../src/game/engine';
import { performance, chemistry } from '../src/game/chemistry';
let s = newGame({ name: 'X', instrument: 'none', bandName: 'B', background: 'factory', style: 'glam', seed: Number(process.argv[2] ?? 3) });
for (let i=0;i<20 && !s.over;i++){
  const avgE = s.members.reduce((a,m)=>a+m.energy,0)/s.members.length;
  const a:any = avgE<40?{type:'rest'}: s.songs.length<2?{type:'write'}: {type:'gig'};
  const before = s.log.length;
  s = act(s,a);
  console.log(s.week, a.type, 'money',s.money,'fans',s.fans,'buzz',s.buzz,'perf',performance(s),'chem',chemistry(s).total, 'E', Math.round(avgE));
  for (const l of s.log.slice(before)) console.log('   ', l.text);
}
