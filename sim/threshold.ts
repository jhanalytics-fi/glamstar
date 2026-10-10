// Prints the score needed for #40 and #10 on each record chart over time.
import { Rng } from '../src/game/rng';
import { advanceWorld, createWorld } from '../src/game/world';
const rng = new Rng(5);
const w = createWorld(rng, 'X');
for (let week = 0; week < 100; week++) {
  // probe: a player record with a known unit count, find its position
  const res: string[] = [];
  for (const units of [100, 200, 400, 800]) {
    const ww = structuredClone(w);
    advanceWorld(ww, new Rng(week + units), week, { bandName: 'X', fans: 0, buzz: 0, records: [{ id: 'a', title: 't', units }] });
    const e = ww.charts.uk.find((x) => x.isPlayer);
    res.push(`${units}->${e ? '#' + e.pos : '-'}`);
  }
  advanceWorld(w, rng, week, { bandName: 'X', fans: 0, buzz: 0 });
  if (week % 20 === 0) console.log(week, res.join(' '));
}
