import { act, canAct, hire, newGame } from '../src/game/engine';
import { missingForGig } from '../src/game/chemistry';
import { overall } from '../src/game/characters';
import type { GameState, Action, Role } from '../src/game/types';
const res: any[] = [];
for (let seed = 1; seed <= 300; seed++) {
  let s: GameState = newGame({ name: 'X', instrument: 'none', bandName: 'B', background: (['choirboy','artschool','factory','posh'] as const)[seed%4], style: 'glam', seed });
  let maxFans = 0;
  while (!s.over) {
    const miss = missingForGig(s);
    if (s.candidates.length && s.candidateRole) {
      const best = [...s.candidates].sort((a,b)=>overall(b)-overall(a))[0];
      const cur = s.members.find(m=>m.role===s.candidateRole && !m.isPlayer);
      if (!cur || overall(best) > overall(cur)+5) s = hire(s, best.id, cur?.id);
      s = { ...s, candidates: [], candidateRole: null };
    }
    const avgE = s.members.reduce((a,m)=>a+m.energy,0)/s.members.length;
    const avgM = s.members.reduce((a,m)=>a+m.mood,0)/s.members.length;
    let a: Action;
    const roleMiss: Role | null = miss.includes('a drummer')?'drums':miss.includes('a bassist')?'bass':miss.includes('a guitarist')?'guitar':null;
    if (roleMiss && s.members.every(m=>m.outWeeks===0)) a = { type: 'advertise', role: roleMiss };
    else if (avgE < 40) a = { type: 'rest' };
    else if (avgM < 40 && s.money > 40) a = { type: 'party' };
    else if (s.songs.length < 2 || (s.songs.length < 8 && s.week % 3 === 0)) a = { type: 'write' };
    else if (s.tightness < 40) a = { type: 'rehearse' };
    else if (!canAct(s,{type:'gig'})) a = { type: 'gig' };
    else a = { type: 'rehearse' };
    if (canAct(s, a)) a = { type: 'rest' };
    s = act(s, a);
    maxFans = Math.max(maxFans, s.fans);
  }
  res.push({ won: s.over!.won, reason: s.over!.reason.slice(0,30), week: s.week, fans: s.fans, buzz: s.buzz, money: s.money, members: s.members.length, maxFans, chem: chem2(s), perf: perf2(s), habit: Math.round(s.members.reduce((a,m)=>a+m.habit,0)/s.members.length), mood: Math.round(s.members.reduce((a,m)=>a+m.mood,0)/s.members.length), aff: Math.round(Object.values(s.affinity).reduce((a,b)=>a+b,0)/Object.values(s.affinity).length), tight: s.tightness, songs: s.songs.length });
}
const won = res.filter(r=>r.won);
console.log('win rate', won.length/res.length, 'avg win week', won.reduce((a,r)=>a+r.week,0)/(won.length||1));
const byReason: Record<string,number> = {}; for (const r of res) byReason[r.reason]=(byReason[r.reason]??0)+1; console.log(byReason);
const lost = res.filter(r=>!r.won); console.log('lost avg fans', lost.reduce((a,r)=>a+r.fans,0)/(lost.length||1), 'buzz', lost.reduce((a,r)=>a+r.buzz,0)/(lost.length||1), 'money', lost.reduce((a,r)=>a+r.money,0)/(lost.length||1));
console.log(lost.slice(0,4)); console.log(won.slice(0,2));
import { chemistry as chem2, performance as perf2 } from '../src/game/chemistry';
