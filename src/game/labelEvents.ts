// The label's people: A&R men with opinions, marketing with mood boards, head office with lawyers.
import { clamp } from './rng';
import { addAffinity } from './chemistry';
import { addBuzz, adjust, first, log, player, removeMember } from './helpers';
import { labelById } from './labels';
import type { EventDef } from './events';
import type { GameState } from './types';

const since = (s: GameState, flag: string, weeks: number) => s.flags[flag] === undefined || s.week - s.flags[flag] >= weeks;
const goodwill = (s: GameState, d: number) => { if (s.contract) s.contract.goodwill = clamp(s.contract.goodwill + d, 0, 100); };
const purists = (s: GameState) => s.members.filter((m) => m.style === 'metal' || m.style === 'punk');
const AR = ['Julian from A&R', 'Nigel from A&R', 'Pippa from A&R', 'Dez, the A&R man with the ponytail'];
const arName = (s: GameState) => AR[(s.contract?.signed ?? 0) % AR.length];
const labelName = (s: GameState) => (s.contract ? labelById(s.contract.label).name : 'The label');

export const LABEL_EVENTS: EventDef[] = [
  {
    id: 'ar_single',
    weight: 3,
    when: (s) => (s.contract && since(s, 'arSingle', 20) && s.songs.some((x) => !x.released) ? {} : null),
    title: (s) => `${arName(s)} has heard the single`,
    text: (s) => `${arName(s)} has heard the demos and has "notes". The single should be poppier, the chorus should come in after twenty seconds, and could the drums sound "more like that band on the telly"?`,
    options: () => [
      {
        label: 'Do as you are told',
        hint: 'The label works the next record harder. The purists in the band die a little.',
        resolve: (st) => {
          st.flags.arSingle = st.week; st.flags.arPush = 1;
          goodwill(st, 15);
          for (const m of purists(st)) adjust(m, 'mood', -8);
          log(st, 'Chorus moved, drums gated, guitar solo cut to four bars. It sounds like a hit. It sounds like someone else.', 'neutral');
        },
      },
      {
        label: 'Meet them halfway',
        hint: 'A remix for radio, the real version on the album.',
        resolve: (st) => {
          st.flags.arSingle = st.week;
          goodwill(st, 5);
          log(st, 'A "radio edit" was agreed. Everyone pretends to be happy, which in the music business counts as happy.', 'neutral');
        },
      },
      {
        label: 'Tell them where to stick it',
        hint: 'Integrity intact. Goodwill not.',
        resolve: (st) => {
          st.flags.arSingle = st.week;
          goodwill(st, -15);
          adjust(player(st), 'mood', 6);
          for (const m of purists(st)) adjust(m, 'mood', 6);
          log(st, `You told ${arName(st)} exactly what the chorus thought of him. The band bought you a pint. ${labelName(st)} did not.`, 'neutral');
        },
      },
    ],
  },
  {
    id: 'ar_image',
    weight: 2,
    when: (s) => (s.contract && since(s, 'arImage', 40) ? {} : null),
    title: () => 'A new look',
    text: (s) => `${labelName(s)}'s marketing department has a mood board. It has leather, lipstick, a lot of hairspray and one photo of a horse nobody can explain. The stylist is booked for Thursday. The bill is "on account".`,
    options: () => [
      {
        label: 'Full makeover',
        hint: 'Everyone looks the part. The bill goes on your tab.',
        resolve: (st) => {
          st.flags.arImage = st.week;
          goodwill(st, 10);
          if (st.contract) st.contract.unrecouped += 400;
          for (const m of st.members) adjust(m, 'image', 3);
          for (const m of purists(st)) adjust(m, 'mood', -6);
          log(st, 'Two days, nine cans of hairspray and one argument about a fringe. The photos are stunning. You owe the label another £400.', 'good');
        },
      },
      {
        label: 'Keep your own look',
        hint: 'You are a band, not a shampoo advert.',
        resolve: (st) => {
          st.flags.arImage = st.week;
          goodwill(st, -10);
          adjust(player(st), 'mood', 3);
          log(st, 'You cancelled the stylist. Marketing has started calling you "the difficult ones".', 'neutral');
        },
      },
    ],
  },
  {
    id: 'ar_session',
    weight: 2,
    when: (s) => {
      if (!s.contract || !since(s, 'arSession', 52)) return null;
      const weakest = [...s.members].filter((m) => !m.isPlayer && m.outWeeks === 0).sort((a, b) => a.skill - b.skill)[0];
      return weakest && weakest.skill < 70 ? { m: weakest.id } : null;
    },
    title: (s, p) => `They want a session player instead of ${first(s.members.find((m) => m.id === p.m)!)}`,
    text: (s, p) => `${arName(s)} says ${first(s.members.find((m) => m.id === p.m)!)} is "fine live, but not for the record". A session player is booked for the album. ${first(s.members.find((m) => m.id === p.m)!)} has not been told yet.`,
    options: (s, p) => {
      const m = s.members.find((x) => x.id === p.m)!;
      return [
        {
          label: 'Use the session player',
          hint: `Better records, a crushed ${first(m)}.`,
          resolve: (st) => {
            st.flags.arSession = st.week; st.flags.sessionPlayer = 1;
            goodwill(st, 10);
            const x = st.members.find((y) => y.id === m.id);
            if (x) { adjust(x, 'mood', -20); addAffinity(st, x.id, 'p', -20); }
            log(st, `A man in a cardigan played ${first(m)}'s parts in one take each. ${first(m)} found out from the sleeve notes.`, 'bad');
          },
        },
        {
          label: `Stand by ${first(m)}`,
          hint: 'Loyalty, at the label\'s expense.',
          resolve: (st) => {
            st.flags.arSession = st.week;
            goodwill(st, -15);
            const x = st.members.find((y) => y.id === m.id);
            if (x) { adjust(x, 'mood', 10); addAffinity(st, x.id, 'p', 15); x.hidden.loyalty = clamp(x.hidden.loyalty + 8, 1, 99); }
            log(st, `You told the label it is ${first(m)} on the record or nobody is. ${first(m)} heard about it and went very quiet.`, 'good');
          },
        },
        {
          label: `Fire ${first(m)}`,
          hint: 'What the label really wanted.',
          resolve: (st) => {
            st.flags.arSession = st.week;
            goodwill(st, 15);
            const x = st.members.find((y) => y.id === m.id);
            if (x) { log(st, `${first(x)} is out. The label sent flowers. To you.`, 'bad'); removeMember(st, x.id, 'fired'); }
          },
        },
      ];
    },
  },
  {
    id: 'label_scandal',
    weight: 6,
    when: (s) => (s.contract && s.flags.kissTell !== undefined && s.week - s.flags.kissTell <= 3 && since(s, 'labelScandal', 20) ? {} : null),
    title: (s) => `${labelName(s)} have seen the papers`,
    text: (s) => {
      const shark = s.contract && labelById(s.contract.label).tier === 'shark';
      return shark
        ? `${labelName(s)} rang about the tabloid story. They want more of it. "Can you get photographed falling out of somewhere? Thursday is good for us."`
        : `Head office at ${labelName(s)} rang about the tabloid story. Somebody's wife sits on the board of a children's charity. "We are a family company," says a man who has never met his family.`;
    },
    options: (s) => {
      const shark = s.contract && labelById(s.contract.label).tier === 'shark';
      return [
        {
          label: shark ? 'Give them a scandal' : 'Grovel',
          hint: shark ? 'Good for sales, bad for your liver.' : 'Apologise, keep your head down for a bit.',
          resolve: (st) => {
            st.flags.labelScandal = st.week;
            if (shark) { goodwill(st, 10); addBuzz(st, 4); for (const m of st.members) adjust(m, 'habit', 3); log(st, 'You fell out of a club at 2 a.m. on cue. The photographer was early. The label sent champagne.', 'neutral'); }
            else { goodwill(st, 5); adjust(player(st), 'mood', -6); log(st, 'A carefully worded statement about "a private matter". You read it out in a suit. The suit was the label\'s idea.', 'neutral'); }
          },
        },
        {
          label: 'Tell them it sells records',
          hint: 'True. Unhelpful.',
          resolve: (st) => {
            st.flags.labelScandal = st.week;
            goodwill(st, shark ? 5 : -12);
            addBuzz(st, 3);
            log(st, '"It sells records," you said. There was a long silence on the line, then the sound of a calculator.', 'neutral');
          },
        },
      ];
    },
  },
];
