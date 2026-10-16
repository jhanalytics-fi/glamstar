// When life throws a spanner in big enough to need a decision.
import { clamp } from './rng';
import { available } from './chemistry';
import { addBuzz, adjust, first, log, milestone, player } from './helpers';
import { tierById } from './tour';
import type { EventDef } from './events';
import type { GameState } from './types';

const since = (s: GameState, flag: string, weeks: number) => s.flags[flag] === undefined || s.week - s.flags[flag] >= weeks;
const everyone = (s: GameState, k: 'mood' | 'energy', d: number) => { for (const m of s.members) adjust(m, k, d); };

export const CALAMITY_EVENTS: EventDef[] = [
  {
    id: 'venue_burned',
    weight: 1,
    where: 'home',
    when: (s) => (s.lastGigWeek !== null && s.fans >= 100 && since(s, 'venueBurned', 104) ? {} : null),
    title: () => 'The Rat Pit has burned down',
    text: () => 'The Rat Pit, Islington, went up in the night. Nobody hurt, everything gone: the stage, the PA, the signed photo of you by the toilets. The owner is in bits. The scene wants a benefit.',
    options: () => [
      {
        label: 'Headline the benefit, free',
        hint: 'No fee, a long night, the whole scene owes you one.',
        resolve: (st) => {
          st.flags.venueBurned = st.week;
          addBuzz(st, 10); st.fans += Math.round(40 + st.fans * 0.03); everyone(st, 'energy', -12); everyone(st, 'mood', 6);
          milestone(st, 'career', 'Headlined the benefit for the Rat Pit.');
          log(st, 'Four bands, one borrowed PA, a bucket at the door. You went on last and the room sang the choruses for you.', 'good');
        },
      },
      {
        label: 'Send a cheque and a signed guitar',
        hint: 'Money talks. Quietly.',
        cost: 150,
        resolve: (st) => { st.flags.venueBurned = st.week; addBuzz(st, 3); log(st, 'The guitar raised more than the cheque. The owner cried on the phone.', 'neutral'); },
      },
      {
        label: 'Not your problem',
        hint: 'The scene remembers who turned up.',
        resolve: (st) => { st.flags.venueBurned = st.week; addBuzz(st, -5); adjust(player(st), 'mood', -3); log(st, 'You stayed home. The benefit was packed. Someone dedicated a song to "the bands who could not be bothered".', 'bad'); },
      },
    ],
  },
  {
    id: 'bus_crash',
    weight: 2,
    where: 'tour',
    when: (s) => (s.tour && s.tour.week >= 1 && since(s, 'busCrash', 150) ? {} : null),
    title: () => 'The bus is in a ditch',
    text: (s) => `Three in the morning on the road to ${s.tour!.route[Math.min(s.tour!.route.length - 1, (s.tour!.week + 1) * s.tour!.gigsPerWeek)]?.city ?? 'the next town'}, the driver fell asleep and the bus went through a fence into a field. Everyone walked away. The bus did not. The gear is scattered across half an acre of cabbages.`,
    options: (s) => {
      const t = tierById(s.tour!.tier)!;
      const hire = Math.round(t.weeklyCost * 0.5);
      return [
        {
          label: `Hire a new bus and carry on`,
          hint: `£${hire.toLocaleString('en-GB')}, and nobody sleeps for a week.`,
          locked: s.money < hire ? `Costs £${hire.toLocaleString('en-GB')}. You have £${s.money.toLocaleString('en-GB')}.` : undefined,
          resolve: (st) => { st.flags.busCrash = st.week; st.money -= hire; everyone(st, 'energy', -20); everyone(st, 'mood', -8); addBuzz(st, 4); log(st, 'A new bus by lunchtime, the gear bent back into shape, the show that night played on adrenaline and bruises. The papers loved it.', 'neutral'); },
        },
        {
          label: 'Call off the tour and go home',
          hint: 'Safe, sad, and the promoters will sue.',
          resolve: (st) => {
            st.flags.busCrash = st.week;
            everyone(st, 'energy', 10);
            // The tour ends next time the week plays out: flag it so abandon rules apply.
            st.flags.forceAbandon = 1;
            log(st, 'Home on the train with the drums in the guard\'s van. The rest of the tour is cancelled.', 'bad');
          },
        },
        {
          label: 'Fly the band, truck the gear',
          hint: 'Expensive but fresh. The crew hate you.',
          locked: s.money < hire * 2 ? `Costs £${(hire * 2).toLocaleString('en-GB')}. You have £${s.money.toLocaleString('en-GB')}.` : undefined,
          resolve: (st) => { st.flags.busCrash = st.week; st.money -= hire * 2; everyone(st, 'mood', 4); log(st, 'The band flew. The crew drove through the night in a hired lorry and arrived looking like ghosts. The show went on.', 'neutral'); },
        },
      ];
    },
  },
  {
    id: 'crowd_riot',
    weight: 2,
    where: 'tour',
    when: (s) => (s.tour && s.fans >= 3000 && since(s, 'riot', 100) ? { city: s.tour!.route[Math.min(s.tour!.route.length - 1, s.tour!.week * s.tour!.gigsPerWeek)].city } : null),
    title: (_s, p) => `Riot in ${p.city}`,
    text: (_s, p) => `Too many tickets sold, not enough door. The crowd outside in ${p.city} pushed, the crowd inside pushed back, and by the second song the barriers were down and the police were in. Seventeen hurt, none badly. The council wants someone to blame.`,
    options: () => [
      {
        label: 'Take the blame, pay the damages',
        hint: 'Expensive. Decent. Forgotten by spring.',
        cost: 2000,
        resolve: (st, _r, p) => { st.flags.riot = st.week; addBuzz(st, 6); log(st, `You paid for the barriers, the windows and the policeman's hat. ${p.city} will have you back.`, 'neutral'); },
      },
      {
        label: 'Blame the promoter',
        hint: 'True, mostly. He will remember.',
        resolve: (st, _r, p) => { st.flags.riot = st.week; addBuzz(st, 8); st.flags[`banned_${p.city}`] = 1; st.flags.promoterBan = (st.flags.promoterBan ?? 0) + 1; log(st, `The promoter took the blame and the bill, and has told every promoter he knows. ${p.city} is off the map for a while.`, 'bad'); },
      },
      {
        label: 'Play it up: "the most dangerous band in Britain"',
        hint: 'The tabloids bite. So does the council.',
        resolve: (st) => { st.flags.riot = st.week; addBuzz(st, 16); for (const m of available(st)) adjust(m, 'image', 2); st.flags.promoterBan = (st.flags.promoterBan ?? 0) + 2; adjust(player(st), 'mood', 5); log(st, '"RIOT ROCKERS" on page one. Record sales up, three halls cancelled, your mum not speaking to you.', 'neutral'); },
      },
    ],
  },
  {
    id: 'member_arrested_abroad',
    weight: 2,
    where: 'tour',
    when: (s, rng) => {
      const t = tierById(s.tour?.tier ?? '');
      if (!s.tour || !t || t.region === 'uk' || t.region === 'southeast' || !since(s, 'arrestedAbroad', 80)) return null;
      const c = available(s).filter((m) => !m.isPlayer && m.hidden.vice >= 50);
      return c.length ? { m: rng.pick(c).id, city: s.tour.route[Math.min(s.tour.route.length - 1, s.tour.week * s.tour.gigsPerWeek)].city } : null;
    },
    title: (s, p) => `${first(s.members.find((m) => m.id === p.m)!)} is in a cell in ${p.city}`,
    text: (s, p) => `${first(s.members.find((m) => m.id === p.m)!)} was stopped at the hotel with something in a sock. The police in ${p.city} do not find rock bands funny. The embassy has been told, and so, somehow, has a newspaper.`,
    options: (s, p) => {
      const m = s.members.find((x) => x.id === p.m)!;
      return [
        {
          label: 'Lawyer, bail, and out of the country tonight',
          hint: 'Costly. Quick.',
          cost: 1500,
          resolve: (st) => { st.flags.arrestedAbroad = st.week; const x = st.members.find((y) => y.id === m.id); if (x) { adjust(x, 'mood', -10); adjust(x, 'habit', -10); x.hidden.vice = clamp(x.hidden.vice + 3, 1, 99); } addBuzz(st, 5); log(st, `${first(m)} was back on the bus by midnight, pale and grateful. The lawyer sent a bill and a Christmas card.`, 'neutral'); },
        },
        {
          label: `Leave ${first(m)} to sort it out`,
          hint: 'A week in a cell. A lesson, or a grudge.',
          resolve: (st, rng) => {
            st.flags.arrestedAbroad = st.week;
            const x = st.members.find((y) => y.id === m.id);
            if (x) { x.outWeeks = Math.max(x.outWeeks, 1); adjust(x, 'habit', -25); if (rng.chance(0.5)) { adjust(x, 'mood', -20); x.hidden.loyalty = clamp(x.hidden.loyalty - 15, 1, 99); log(st, `${first(x)} did six days and came out clean, furious, and quieter with you than before.`, 'bad'); } else { adjust(x, 'mood', -8); log(st, `${first(x)} did six days, read a book for the first time since school, and came out clean and oddly calm.`, 'neutral'); } }
          },
        },
      ];
    },
  },
];
