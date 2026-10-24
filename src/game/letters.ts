// The post. A fan with a bedroom wallpapered in you, your mother, the Revenue, the one who left. A
// letter a fortnight or so, each a small nudge and a large amount of atmosphere, kept in the letterbox.
import { Rng, clamp } from './rng';
import { available } from './chemistry';
import { adjust, first, log, player } from './helpers';
import { ABROAD } from './names';
import type { GameState, Letter, Musician } from './types';

interface Draft { from: string; text: string; mood?: number; fans?: number; money?: number; who?: Musician }

const pick = <T>(rng: Rng, xs: T[]) => xs[rng.int(0, xs.length - 1)];

function fanLetter(s: GameState, rng: Rng): Draft {
  const me = player(s);
  const fav = [...s.songs].filter((x) => x.released).sort((a, b) => b.quality - a.quality)[0]?.title ?? 'the slow one';
  const abroad = s.fans >= 20000 && rng.chance(0.4);
  const where = abroad ? pick(rng, [...ABROAD.nordic.towns, ...ABROAD.german.towns, ...ABROAD.world.towns]) : pick(rng, ['Grimsby', 'Swindon', 'Dundee', 'Luton', 'Wigan', 'Croydon', 'Bromley', 'Hull']);
  const names = rng.chance(0.5) ? ['Sharon', 'Tracey', 'Kirsty', 'Debbie', 'Lorraine', 'Yuki', 'Anja'] : ['Darren', 'Gary', 'Kev', 'Wayne', 'Lars', 'Kenji', 'Marco'];
  const n = pick(rng, names);
  const age = rng.int(19, 44);
  const texts = [
    `Dear ${first(me)}, I am ${age} and I have your poster above the bed and my ${rng.chance(0.5) ? 'husband' : 'girlfriend'} does not mind, much. "${fav}" got me through a bad winter. I am not going to say more than that. Thank you. ${n}, ${where}.`,
    `I saw you at ${pick(rng, ['the Rat Pit', 'the Odeum', 'a field', 'the Hammerton'])} and I have started a band. We are terrible. It is your fault and I have never been happier. ${n}, ${where}, aged ${age}.`,
    `My bedroom is wallpapered in ${s.bandName}. All four walls and part of the ceiling. My mum says it will come off with warm water. It will not. ${n}, ${where}.`,
    `I have every record including the one you do not talk about. I think it is the best one. Nobody agrees with me. Please come to ${where}; there is a hall and my uncle knows the man. ${n}.`,
    `I wrote to you two years ago and you did not write back. I am writing again because "${fav}" came on in the launderette and I had to sit down. ${n}, ${where}.`,
  ];
  return { from: `${n}, ${where}`, text: pick(rng, texts), mood: 3, fans: rng.int(2, 12) };
}

function mumLetter(s: GameState, rng: Rng): Draft {
  const me = player(s);
  const broke = s.money < 100;
  const habit = me.habit >= 50;
  const texts = broke
    ? [`Dear ${first(me)}, your father says nothing but I know he reads the paper for your name. There is twenty pounds in with this, do not tell him. Eat something hot. Mum.`, `${first(me)}, I have put ten pounds in. I know you said not to. I also know what a kebab costs. Love, Mum.`]
    : habit
      ? [`${first(me)}, I saw the photograph. You looked thin. Mrs Pike next door saw it too, and said nothing, which from Mrs Pike is a lot. Ring me. Mum.`, `Dear ${first(me)}, I am not going to say anything about the photograph except that your eyes looked wrong and I am your mother. Sunday lunch is at one if you want it. Mum.`]
      : s.fans >= 50000
        ? [`${first(me)}, the woman at the Co-op asked for your autograph, by which she meant mine. I gave it. Your father has stopped pretending the records are not his. Mum.`, `Dear ${first(me)}, your father has bought a video recorder to tape you off the telly. He cannot work it. Ring him and explain. Mum.`]
        : [`Dear ${first(me)}, nothing to report. Your room is as you left it, except tidy. Your father sends what he sends. Mum.`, `${first(me)}, are you eating? Are you sleeping? Are you wearing a coat? Ring your mother. Mum.`];
  return { from: 'Mum', text: pick(rng, texts), mood: broke ? 4 : habit ? -2 : 2, money: broke ? (rng.chance(0.5) ? 20 : 10) : 0 };
}

function revenueLetter(s: GameState, rng: Rng): Draft {
  const texts = [
    `Dear Sir or Madam, we note that no return has been received in respect of the band known as "${s.bandName}". A return is now due. Interest accrues daily. Yours faithfully, H.M. Inspector of Taxes.`,
    `Dear Sir or Madam, we refer to your "accountant", who does not appear on our records, and to the shoebox, which does. Please telephone the number below during office hours. H.M. Inspector of Taxes.`,
  ];
  return { from: 'H.M. Inspector of Taxes', text: pick(rng, texts), mood: -2 };
}

function exLetter(s: GameState, rng: Rng): Draft | null {
  const ex = s.alumni.filter((a) => a.how !== 'died');
  if (!ex.length) return null;
  const a = pick(rng, ex);
  const fn = a.name.split(' ')[0];
  const texts = a.how === 'fired'
    ? [`I saw the review. "Tighter than ever." That is what people say when the drummer is a machine. I have a job and a van and I sleep at night. ${fn}.`, `No hard feelings. That is a lie, there are hard feelings, but there is also a baby now and she is called ${pick(rng, ['Ruby', 'Jade', 'Amber'])} and I thought you should know. ${fn}.`]
    : a.how === 'quit'
      ? [`I heard the new one in a shop. It is good. Better than when I was in it, which I am supposed to mind and do not. Tell the others. ${fn}.`, `I am teaching guitar in a school now. Twelve-year-olds. One of them plays our old riff better than I did. ${fn}.`]
      : [`The other band is fine. The money is fine. The songs are not yours, is the thing. Nobody tells you that. ${fn}.`, `We are supporting someone enormous in June. I will leave your names on the door. Do not come. Come. ${fn}.`];
  return { from: `${a.name}, formerly of the band`, text: pick(rng, texts), mood: a.how === 'fired' ? -2 : 2 };
}

function mournerLetter(s: GameState, rng: Rng): Draft | null {
  const r = s.memorials?.[s.memorials.length - 1];
  if (!r || s.week - r.week < 4) return null;
  const fn = r.name.split(' ')[0];
  return { from: `${fn}'s mother`, text: pick(rng, [`I have the photograph from the van on the mantelpiece, the one where you are all laughing. I play the records when the house is empty. Thank you for the flowers and for the tribute, which I could not watch and have watched eleven times. ${fn}'s mum.`, `Dear all, ${fn} would have hated the fuss and loved the fuss. Keep playing the song. I will know. ${fn}'s mum.`]), mood: 2 };
}

function kidLetter(s: GameState, rng: Rng): Draft {
  const city = pick(rng, [...ABROAD.american.towns, 'Dublin', 'Gothenburg', 'Osaka']);
  return { from: `A band in ${city}`, text: pick(rng, [`We are four kids in a garage in ${city} and we have learned your whole first album off a tape of a tape. We have one gig booked. We are opening with yours. Sorry. Thank you.`, `Dear ${s.bandName}, our singer has your haircut and our drummer has your drummer's. We will send a record when we have one. The ${pick(rng, ['Lost Weekend', 'Velvet Choir', 'Plastic Saints', 'Night Shift'])}, ${city}.`]), mood: 4, fans: rng.int(5, 30) };
}

function labelLetter(s: GameState, rng: Rng): Draft | null {
  if (!s.contract) return null;
  return { from: 'The label\'s lawyers', text: pick(rng, ['Dear Sirs, we write further to the matter of the "promotional expenses" and would remind you that under clause 14(b) the Company is entitled to recoup from royalties any sums it describes as promotional. We trust this clarifies. Yours etc.', 'Dear Sirs, the Company notes with interest the remarks attributed to your drummer in last week\'s press and reserves its position. Yours etc.']), mood: -2 };
}

function clubLetter(s: GameState, rng: Rng): Draft | null {
  if (s.flags.fanClub === undefined) return null;
  return { from: 'The fan club', text: pick(rng, [`Newsletter copy needed by Friday. Also: forty-one letters this week asking whether ${first(player(s))} is single. The answer we have been giving is "busy".`, 'Membership up. The badge supplier has gone bust. A woman in Wolverhampton has knitted the band, all of you, and would like to send it. We have said yes.']), mood: 2, fans: rng.int(5, 20) };
}

function flingLetter(s: GameState, rng: Rng): Draft | null {
  if (s.flags.fling === undefined || s.week - s.flags.fling > 30) return null;
  return { from: 'No name, a hotel address', text: pick(rng, ['You left a shirt. I am keeping it. Do not ring; I am not sure I want you to, which is not the same as no. The shirt smells of smoke and the van.', 'Two lines, because you said two lines was all you ever read: it was a good night. That is all.']), mood: 2 };
}

/** Once in a while the post brings something. */
export function postWeek(s: GameState, rng: Rng): void {
  if (s.tour || s.fans < 20 || !rng.chance(0.16)) return;
  const pool: (() => Draft | null)[] = [
    () => fanLetter(s, rng), () => fanLetter(s, rng), () => mumLetter(s, rng), () => exLetter(s, rng), () => mournerLetter(s, rng), () => kidLetter(s, rng), () => labelLetter(s, rng), () => clubLetter(s, rng), () => flingLetter(s, rng),
  ];
  if (s.money >= 20000) pool.push(() => revenueLetter(s, rng));
  let d: Draft | null = null;
  for (let i = 0; i < 3 && !d; i++) d = pick(rng, pool)();
  if (!d) return;
  const letter: Letter = { week: s.week, from: d.from, text: d.text };
  (s.letters ??= []).push(letter);
  if (s.letters.length > 60) s.letters.splice(0, s.letters.length - 60);
  if (d.mood) adjust(player(s), 'mood', d.mood);
  if (d.mood && d.mood > 0 && d.from.startsWith('A band')) for (const m of available(s)) adjust(m, 'mood', 1);
  if (d.fans) s.fans += d.fans;
  if (d.money) s.money += d.money;
  const sum = d.text.length > 150 ? d.text.slice(0, 147).replace(/\s+\S*$/, '') + '...' : d.text;
  log(s, `A letter from ${d.from}: "${sum}"`, 'neutral');
  s.fans = clamp(s.fans, 0, Number.MAX_SAFE_INTEGER);
}
