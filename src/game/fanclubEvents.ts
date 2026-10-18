// Starting the fan club, and finding out who has been running it.
import { clamp } from './rng';
import { available } from './chemistry';
import { addBuzz, adjust, first, log, milestone } from './helpers';
import { PRESS } from './names';
import { clubIncome, clubMembers } from './fanclub';
import type { EventDef } from './events';
import type { GameState } from './types';

const since = (s: GameState, flag: string, weeks: number) => s.flags[flag] === undefined || s.week - s.flags[flag] >= weeks;

export const FANCLUB_EVENTS: EventDef[] = [
  {
    id: 'fan_club_start',
    weight: 5,
    where: 'home',
    when: (s, rng) => {
      if (s.flags.fanClub !== undefined || s.fans < 1200 || !since(s, 'fanClubPassed', 30)) return null;
      const mates = available(s).filter((m) => !m.isPlayer);
      return { who: mates.length ? first(rng.pick(mates)) : 'the drummer', name: rng.pick([`The ${s.bandName} Army`, `${s.bandName} Legion`, `Friends of ${s.bandName}`, `The ${s.bandName} Appreciation Society`]) };
    },
    title: (_s, p) => `Start ${p.name}?`,
    text: (s, p) => `Sacks of letters arrive every week and nobody answers them. ${p.who}'s sister has a typewriter, a spare room and an idea: a fan club. A PO box, a newsletter every quarter, a badge, a mail-order T-shirt, and £5 a year from every member. About ${Math.round(s.fans * 0.08).toLocaleString('en-GB')} fans would join tomorrow.`,
    options: (_s, p) => [
      {
        label: `Start ${p.name}. The sister runs it for a cut`,
        hint: 'A PO box and some stamps. Subscriptions every week, 30% to whoever licks the envelopes.',
        cost: 150,
        resolve: (st) => {
          st.flags.fanClub = st.week; st.flags.fanClubName = 1;
          st.flags.fanClubRunner = 1;
          addBuzz(st, 4);
          milestone(st, 'career', `Founded ${p.name}.`);
          log(st, `${p.name} is open for business: a PO box in Walthamstow, a badge, a newsletter called "${st.bandName} News" and ${clubMembers(st).toLocaleString('en-GB')} members by Friday. About £${clubIncome(st).toLocaleString('en-GB')} a week, before the sister's cut.`, 'good');
        },
      },
      {
        label: 'Not now. Fans should be free',
        hint: 'Nothing changes. The letters keep piling up.',
        resolve: (st) => { st.flags.fanClubPassed = st.week; log(st, 'No fan club. The sacks of letters go in the van, then behind the van, then to the tip.', 'neutral'); },
      },
    ],
  },
  {
    id: 'fan_club_books',
    weight: 3,
    where: 'home',
    when: (s) => (s.flags.fanClub !== undefined && !s.flags.fanClubInHouse && s.week - s.flags.fanClub >= 40 && since(s, 'fanClubBooks', 60) && s.fans >= 3000 ? {} : null),
    title: () => 'Where does the fan club money go?',
    text: (s) => `${clubMembers(s).toLocaleString('en-GB')} members, £5 each, a T-shirt catalogue, and somehow the fan club account shows £40 and a new car outside the sister's house. The newsletter is three months late. Members are writing to ${PRESS}.`,
    options: (s) => [
      {
        label: 'Bring it in-house: an office, a wage, a bookkeeper',
        hint: `£${Math.round(80 + s.fans * 0.01).toLocaleString('en-GB')} a week in wages, every penny of subscriptions yours, and more members.`,
        resolve: (st) => {
          st.flags.fanClubBooks = st.week; st.flags.fanClubInHouse = 1;
          st.flags.rentUp = (st.flags.rentUp ?? 0) + Math.round(80 + st.fans * 0.01);
          addBuzz(st, 3);
          log(st, 'The fan club moves into an office above a bookmaker\'s with two typists and a bookkeeper who alphabetises the fan mail. The sister kept the car.', 'good');
        },
      },
      {
        label: 'Have a quiet word and let it carry on',
        hint: 'Cheap. The newsletter stays late.',
        resolve: (st, rng) => {
          st.flags.fanClubBooks = st.week;
          if (rng.chance(0.5)) { addBuzz(st, -4); log(st, `A quiet word. The newsletter came out a week later with a photo of the car. ${PRESS} ran a letter headed "WHERE IS MY BADGE".`, 'bad'); }
          else log(st, 'A quiet word. Two newsletters arrived the same week, apologetic, with a free badge. The car stayed.', 'neutral');
        },
      },
      {
        label: 'Lawyers, and sack the sister',
        hint: 'Money back, maybe. A band member who will not speak to you, certainly.',
        cost: 400,
        resolve: (st, rng) => {
          st.flags.fanClubBooks = st.week; st.flags.fanClubInHouse = 1;
          st.flags.rentUp = (st.flags.rentUp ?? 0) + Math.round(80 + st.fans * 0.01);
          const found = Math.round(clubIncome(st) * 20 * rng.next());
          st.money += found;
          const mates = available(st).filter((m) => !m.isPlayer);
          const x = mates.length ? rng.pick(mates) : null;
          if (x) { adjust(x, 'mood', -15); x.hidden.loyalty = clamp(x.hidden.loyalty - 8, 1, 99); }
          log(st, `The lawyers recovered £${found.toLocaleString('en-GB')} and the fan club now has an office and a bookkeeper. ${x ? `${first(x)} has not spoken to you since; it was ${first(x)}'s sister.` : ''}`, 'neutral');
        },
      },
    ],
  },
];
