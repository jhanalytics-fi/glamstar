// The band, in a sentence or three: what they are still talking about, how the room feels, and who
// has gone quiet. Worked out from the numbers every week, with no dice, so it reads the same twice.
import { chemistry, getAffinity } from './chemistry';
import { first } from './helpers';
import type { GameState, Musician } from './types';

const pick = (s: GameState, lines: string[], salt = 0) => lines[(s.week + salt) % lines.length];
const who = (m: Musician) => (m.isPlayer ? 'You' : first(m));

/** What happened lately that the band would still be talking about. */
function talkingAbout(s: GameState): string | null {
  const recent = [...(s.milestones ?? [])].reverse().filter((m) => s.week - m.week <= 6);
  for (const m of recent) {
    const t = m.text;
    let hit: RegExpMatchArray | null;
    if ((hit = t.match(/^(.*): the night they still talk about/))) return pick(s, [`The band is still talking about the night at ${hit[1]}.`, `Nobody has stopped talking about ${hit[1]}.`, `${hit[1]} comes up every ten minutes.`]);
    if ((hit = t.match(/^Wrote "(.*)" \(\d+\)\. The one\./))) return pick(s, [`Everyone is walking around humming "${hit[1]}".`, `"${hit[1]}" has not been played less than ten times a day since it was written.`]);
    if ((hit = t.match(/^(.*) died, aged/))) return pick(s, [`Nobody has said much since ${hit[1].split(' ')[0]}.`, `${hit[1].split(' ')[0]}'s chair is still where it was. Nobody sits in it.`]);
    if ((hit = t.match(/^(.*) joined/))) return pick(s, [`${hit[1].split(' ')[0]} is still learning the in-jokes.`, `${hit[1].split(' ')[0]} is new and sits at the end of the table.`]);
    if ((hit = t.match(/^(.*) (was fired|quit the band|left for another band)\./))) return pick(s, [`${hit[1].split(' ')[0]}'s name still comes up, carefully.`, `The band is one fewer and the van is strangely roomy.`]);
    if (/number one|Number one|#1/i.test(t)) return pick(s, ['The band has heard itself on the radio in a taxi and is not over it.', 'Number one. The band keeps saying it out loud to check.']);
    if (/^Released "(.*)"/.test(t)) return pick(s, ['The new record is out and everyone is pretending not to check the shops.', 'The band is reading its own reviews and claiming not to.']);
    if (/Headlined|Sold out|people on a beach|free concert/.test(t)) return pick(s, [`The band is still coming down from the big one.`, 'Nobody has quite landed since the big show.']);
    if (/came back after/.test(t)) return 'The band is back and slightly amazed about it.';
    if (/award|Award|of the Year/.test(t)) return pick(s, ['There is an award on the van dashboard.', 'The award has been to the pub three times already.']);
    if (/arrested|raid|riot|scandal|Scandal/i.test(t)) return pick(s, ['The band is not discussing last week, loudly.', 'There is a story nobody tells in front of the manager.']);
  }
  if (s.tour) return pick(s, [`Week ${s.tour.week} on the road.`, 'Hotel, van, stage, hotel. The days have stopped having names.']);
  return null;
}

/** How the room feels. */
function roomFeel(s: GameState): string {
  const here = s.members.filter((m) => m.outWeeks === 0);
  if (!here.length) return 'Nobody is around.';
  const avg = (f: (m: Musician) => number) => here.reduce((a, m) => a + f(m), 0) / here.length;
  const mood = avg((m) => m.mood);
  const energy = avg((m) => m.energy);
  const chem = chemistry(s).total;
  if (energy < 30) return pick(s, ['Everyone is knackered.', 'The band is running on tea and spite.', 'Nobody has slept properly in a fortnight.'], 1);
  if (mood >= 75) return pick(s, ['Spirits are high.', 'Good mood all round; the jokes are landing.', 'The rehearsal room is loud and happy.'], 2);
  if (mood >= 55) return pick(s, ['Decent mood overall.', 'A steady week, nobody sulking much.', 'The mood is fine, which in a band is good.'], 3);
  if (mood >= 35) return pick(s, [chem < 45 ? 'The van is quiet in the bad way.' : 'A flat week; nobody says much.', 'Moods are low and the tea is weak.'], 4);
  return pick(s, ['Grim. Doors are being closed harder than they need to be.', 'The mood is on the floor with the cables.'], 5);
}

/** Who stands out, for better or worse. */
function someone(s: GameState): string | null {
  const here = s.members.filter((m) => m.outWeeks === 0);
  const away = s.members.find((m) => m.outWeeks > 0);
  const lines: string[] = [];
  const low = [...here].filter((m) => !m.isPlayer).sort((a, b) => a.mood - b.mood)[0];
  if (low && low.mood < 40) lines.push(pick(s, [`${first(low)} has been quiet lately.`, `${first(low)} is not saying what is wrong.`, `${first(low)} keeps leaving early.`], 6));
  const high = [...here].sort((a, b) => b.habit - a.habit)[0];
  if (high && high.habit >= 60) lines.push(pick(s, [`${who(high)} ${high.isPlayer ? 'are' : 'is'} rarely seen before noon.`, `${who(high)} ${high.isPlayer ? 'have' : 'has'} a new friend nobody likes.`], 7));
  let worst: [Musician, Musician, number] | null = null;
  for (const a of here) for (const b of here) if (a.id < b.id) { const v = getAffinity(s, a.id, b.id); if (!worst || v < worst[2]) worst = [a, b, v]; }
  if (worst && worst[2] <= -25) lines.push(pick(s, [`${who(worst[0])} and ${first(worst[1])} are not speaking.`, `${who(worst[0])} and ${first(worst[1])} travel in different cars.`], 8));
  let best: [Musician, Musician, number] | null = null;
  for (const a of here) for (const b of here) if (a.id < b.id) { const v = getAffinity(s, a.id, b.id); if (!best || v > best[2]) best = [a, b, v]; }
  if (!lines.length && best && best[2] >= 70) lines.push(pick(s, [`${who(best[0])} and ${first(best[1])} finish each other's riffs.`, `${who(best[0])} and ${first(best[1])} have a private language now.`], 9));
  if (away) lines.push(`${who(away)} ${away.isPlayer ? 'are' : 'is'} away for ${away.outWeeks} more week${away.outWeeks === 1 ? '' : 's'}.`);
  return lines.length ? lines.slice(0, 2).join(' ') : null;
}

/** The whole picture, one to three sentences. */
export function bandWord(s: GameState): string {
  return [talkingAbout(s), roomFeel(s), someone(s)].filter(Boolean).join(' ');
}
