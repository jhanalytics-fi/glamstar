// Where the money goes: videos, producers, eccentric hobbies and the entourage. Mostly recoupable, mostly regrettable.
import { clamp } from './rng';
import { addBuzz, adjust, first, grow, log, milestone } from './helpers';
import { labelById } from './labels';
import { PRESS } from './names';
import type { EventDef } from './events';
import type { GameState } from './types';

const since = (s: GameState, flag: string, weeks: number) => s.flags[flag] === undefined || s.week - s.flags[flag] >= weeks;
const year = (s: GameState) => 1982 + Math.floor(s.week / 52);
const everyone = (s: GameState, k: 'mood' | 'energy' | 'habit' | 'image', d: number) => { for (const m of s.members) adjust(m, k, d); };
const mates = (s: GameState) => s.members.filter((m) => !m.isPlayer && m.outWeeks === 0);
const mem = (s: GameState, id: string | number) => s.members.find((m) => m.id === id)!;

/** Pay from the label's budget if signed (goes on the tab), otherwise from the band's pocket. */
function charge(s: GameState, amount: number): string {
  if (s.contract) {
    s.contract.unrecouped += amount;
    return `${labelById(s.contract.label).name} paid, and put it on your tab`;
  }
  s.money -= amount;
  return 'paid out of the band account';
}
const canPay = (s: GameState, amount: number) => (s.contract ? undefined : s.money < amount ? `Costs £${amount.toLocaleString('en-GB')}. You have £${s.money.toLocaleString('en-GB')}.` : undefined);

/** The last single or album out, within a couple of weeks. */
const freshRecord = (s: GameState) => [...s.releases].reverse().find((r) => r.kind !== 'demo' && s.week - r.week <= 2);

export const MONEY_EVENTS: EventDef[] = [
  {
    id: 'video_shoot',
    weight: 12,
    where: 'home',
    when: (s) => {
      const r = freshRecord(s);
      return r && year(s) >= 1983 && !s.flags[`video_${r.id}`] ? { rec: r.id, title: r.title } : null;
    },
    title: (_s, p) => `A video for "${p.title}"?`,
    text: (s, p) => `${s.contract ? `${labelById(s.contract.label).name} want` : 'The pluggers want'} a video for "${p.title}". The American cable channel plays anything with hair and a wind machine. Directors have been sending in treatments. One of them involves a horse.`,
    options: (s, p) => {
      const rec = s.releases.find((r) => r.id === p.rec);
      const big = s.contract && labelById(s.contract.label).tier === 'major' ? 25000 : 8000;
      return [
        {
          label: 'No video',
          hint: 'Radio will have to do.',
          resolve: (st) => { st.flags[`video_${p.rec}`] = 1; log(st, 'No video. The record will have to sell itself.', 'neutral'); },
        },
        {
          label: 'Cheap and cheerful: a warehouse and a smoke machine',
          hint: '£600. Performance clip, cold feet, a bit of buzz.',
          locked: canPay(s, 600),
          resolve: (st, rng) => {
            st.flags[`video_${p.rec}`] = 2;
            const how = charge(st, 600);
            addBuzz(st, 5); everyone(st, 'energy', -6);
            if (rec) rec.appeal *= 1.08;
            log(st, `A warehouse in Hackney, one smoke machine, forty takes. Looks a lot more expensive than it was (£600, ${how}).${rng.chance(0.3) ? ' A late-night show played it twice.' : ''}`, 'good');
          },
        },
        {
          label: `The full treatment: a director, a castle, the horse`,
          hint: `£${big.toLocaleString('en-GB')}${s.contract ? ', recoupable' : ''}. Cinema for the telly. America notices.`,
          locked: canPay(s, big),
          resolve: (st, rng) => {
            st.flags[`video_${p.rec}`] = 3;
            st.flags.bigVideos = (st.flags.bigVideos ?? 0) + 1;
            const how = charge(st, big);
            addBuzz(st, 14); everyone(st, 'image', 3); everyone(st, 'energy', -10);
            if (rec) rec.appeal *= 1.25;
            const twist = rng.pick(['The horse bolted during the chorus and is in the final cut.', 'The castle turned out to be in Wales and the rain is in every shot.', 'The director insisted on slow motion. All of it.', 'The woman in the ruined wedding dress is now the drummer\'s girlfriend.']);
            milestone(st, 'release', `Shot a big-budget video for "${p.title}".`);
            log(st, `Three days, a castle, a wind machine and a director who calls everything "a moment". £${big.toLocaleString('en-GB')}, ${how}. ${twist} The Americans want more.`, 'good');
          },
        },
      ];
    },
  },
  {
    id: 'album_producer',
    weight: 8,
    where: 'home',
    when: (s) => (s.songs.filter((x) => !x.released).length >= 8 && since(s, 'producerPick', 30) && !s.flags.nextProducer ? {} : null),
    title: () => 'Who produces the album?',
    text: (s) => `Eight songs ready and the studio booked. ${s.contract ? 'The label has' : 'You have'} a shortlist of producers. Each one costs more than the last, and each one has opinions.`,
    options: (s) => [
      {
        label: 'Your mate with the eight-track',
        hint: 'Free. Honest. A bit muddy.',
        resolve: (st) => { st.flags.producerPick = st.week; st.flags.nextProducer = 1; log(st, 'Your mate will produce it. He has a tea urn and a theory about reverb.', 'neutral'); },
      },
      {
        label: 'A name producer',
        hint: `£${(s.contract ? 6000 : 2500).toLocaleString('en-GB')}${s.contract ? ' on the tab' : ''}. Three weeks, a real desk, +6 quality.`,
        locked: canPay(s, s.contract ? 6000 : 2500),
        resolve: (st) => {
          st.flags.producerPick = st.week; st.flags.nextProducer = 2;
          const how = charge(st, st.contract ? 6000 : 2500);
          log(st, `A producer with gold discs in the toilet is booked. Fee ${how}. He wants the drums "bigger". He always wants the drums bigger.`, 'neutral');
        },
      },
      {
        label: 'The legend',
        hint: `£${(s.contract ? 20000 : 8000).toLocaleString('en-GB')}${s.contract ? ' on the tab' : ''} plus two points. Months in the studio, +12 quality, the band learns.`,
        locked: s.contract ? undefined : canPay(s, 8000),
        resolve: (st, rng) => {
          st.flags.producerPick = st.week; st.flags.nextProducer = 3;
          st.flags.producerPoints = (st.flags.producerPoints ?? 0) + 2;
          const how = charge(st, st.contract ? 20000 : 8000);
          for (const m of st.members) { grow(m, 'skill', 2, rng); adjust(m, 'energy', -15); }
          log(st, `The legend said yes. Fee ${how}, plus two points off every record forever. He sleeps in the studio and makes you play to a click. The band has never sounded so tight or so tired.`, 'good');
        },
      },
    ],
  },
  {
    id: 'eccentric_purchase',
    weight: 2,
    where: 'home',
    when: (s, rng) => {
      if (s.money < 15000 || !since(s, 'eccentric', 40) || !mates(s).length) return null;
      const m = rng.pick(mates(s));
      const what = rng.pick([
        ['a decommissioned army tank', 'It is parked outside the rehearsal room. The council has written.'],
        ['a Victorian church organ', 'It does not fit through any door the band owns.'],
        ['a racehorse called Feedback', 'It has never won. It eats like it has.'],
        ['the entire stock of a closing-down joke shop', 'Whoopee cushions for life.'],
        ['a lighthouse in Northumberland', '"For the songwriting." It has no electricity.'],
        ['a collection of Napoleonic uniforms', 'Worn on stage, once, to a mixed reception.'],
      ]);
      return { m: m.id, what: what[0], note: what[1] };
    },
    title: (s, p) => `${first(mem(s, p.m))} has bought ${p.what}`,
    text: (s, p) => `${first(mem(s, p.m))} has bought ${p.what}, with band money, "as an investment". ${p.note} The bill is £${Math.round(s.money * 0.25).toLocaleString('en-GB')}.`,
    options: (s, p) => {
      const bill = Math.round(s.money * 0.25);
      return [
        {
          label: 'Let it go. Rock stars collect things',
          hint: `£${bill.toLocaleString('en-GB')} gone. ${first(mem(s, p.m))} is thrilled.`,
          resolve: (st) => { st.flags.eccentric = st.week; st.money -= bill; const x = mem(st, p.m); adjust(x, 'mood', 12); addBuzz(st, 3); log(st, `${first(x)} keeps ${p.what}. ${PRESS} ran a photo. "Eccentric," said the caption. "Insane," said the accountant.`, 'neutral'); },
        },
        {
          label: 'Make them sell it back',
          hint: 'Half the money back, one sulking band member.',
          resolve: (st) => { st.flags.eccentric = st.week; st.money -= Math.round(bill / 2); const x = mem(st, p.m); adjust(x, 'mood', -14); log(st, `${String(p.what).charAt(0).toUpperCase()}${String(p.what).slice(1)} went back at half price. ${first(x)} has not spoken since.`, 'bad'); },
        },
        {
          label: 'Take it out of their share',
          hint: 'Fair, and remembered.',
          resolve: (st) => { st.flags.eccentric = st.week; const x = mem(st, p.m); adjust(x, 'mood', -8); x.hidden.loyalty = clamp(x.hidden.loyalty - 5, 1, 99); log(st, `${first(x)} keeps ${p.what} and pays for it out of their own cut. The band account is untouched. The atmosphere is not.`, 'neutral'); },
        },
      ];
    },
  },
  {
    id: 'court',
    weight: 2,
    where: 'home',
    when: (s) => (s.fans >= 8000 && since(s, 'court', 52) ? {} : null),
    title: () => 'The entourage',
    text: () => 'Somehow the band now travels with a hairdresser, two bodyguards, an astrologer, a man called Dax whose job nobody can name, and your cousin. They all get paid. By you.',
    options: () => [
      {
        label: 'Keep them. A star needs a court',
        hint: 'Weekly costs up, image up, everyone feels important.',
        resolve: (st) => { st.flags.court = st.week; st.flags.rentUp = (st.flags.rentUp ?? 0) + 150; everyone(st, 'image', 2); everyone(st, 'mood', 4); log(st, 'The court stays. Dax has been given a title: Vibe Co-ordinator. The weekly wage bill is now a thing of wonder.', 'neutral'); },
      },
      {
        label: 'Sack the lot except the bodyguards',
        hint: 'Cheaper. The astrologer predicts bad things.',
        resolve: (st) => { st.flags.court = st.week; st.flags.rentUp = Math.max(0, (st.flags.rentUp ?? 0) - 50); everyone(st, 'mood', -3); log(st, 'Everyone went except the bodyguards. The astrologer left a chart on the table. It did not look good for Thursday.', 'neutral'); },
      },
    ],
  },
];

/** The producer booked for the next album, consumed by release(). */
export function takeProducer(s: GameState): { quality: number; tight: number } {
  const p = s.flags.nextProducer ?? 0;
  delete s.flags.nextProducer;
  return p === 3 ? { quality: 12, tight: 6 } : p === 2 ? { quality: 6, tight: 3 } : p === 1 ? { quality: 1, tight: 1 } : { quality: 0, tight: 0 };
}

