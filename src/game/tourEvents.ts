// Situations that only happen on the road.
import { clamp } from './rng';
import { addAffinity, available } from './chemistry';
import { addBuzz, adjust, beat, first, log, milestone, player, revealLog, setVibe } from './helpers';
import { tierById } from './tour';
import { ROAD_ROMANCE } from './romanceEvents';
import type { EventDef } from './events';
import type { GameState, Musician } from './types';

const mem = (s: GameState, id: string | number) => s.members.find((m) => m.id === id)!;
const mates = (s: GameState) => s.members.filter((m) => !m.isPlayer && m.outWeeks === 0);
const tier = (s: GameState) => tierById(s.tour!.tier)!;
const nextStop = (s: GameState) => s.tour!.route[Math.min(s.tour!.route.length - 1, s.tour!.week * s.tour!.gigsPerWeek)];
const flying = (s: GameState) => ['america', 'stadiums'].includes(s.tour!.tier);
const abroad = (s: GameState) => ['europe', 'arenas', 'japan', 'australasia', 'america', 'stadiums'].includes(s.tour!.tier);
/** Scales money in tour events with the size of the tour. */
const scale = (s: GameState) => Math.max(1, Math.round(tier(s).weeklyCost / 400));
const who = (m: Musician) => (m.isPlayer ? 'You' : first(m));

export const TOUR_EVENTS: EventDef[] = [
  {
    // The first western rock band behind the wall. Or the second; the promoter is vague.
    id: 'tour_beijing',
    weight: 6,
    where: 'tour',
    big: true,
    when: (s) => (s.tour?.tier === 'australasia' && s.flags.beijing === undefined && s.fans >= 30000 ? {} : null),
    title: () => 'A date in Beijing',
    text: (s) => `The promoter, over a beer in Hong Kong: a hall in Beijing, eighteen thousand seats, a ministry that has said yes in writing and may say no in person. No western rock band has done it, or one has, he is vague. The fee is small, the flight is tomorrow, and ${s.bandName} would be, for one night, the loudest thing in China.`,
    options: () => [
      {
        label: 'Go. History, or a cell',
        hint: 'Buzz like nothing else, the papers everywhere, fans in a country of a billion. Odds the plug is pulled mid-set: real.',
        resolve: (st, rng) => {
          st.flags.beijing = st.week;
          const pulled = rng.chance(0.3);
          for (const m of available(st)) adjust(m, 'energy', -14);
          if (pulled) {
            addBuzz(st, 20); st.fans += Math.round(st.fans * 0.06 + 3000);
            for (const m of available(st)) adjust(m, 'mood', 4);
            milestone(st, 'career', 'Beijing: the plug pulled after six songs. Front page everywhere.');
            log(st, 'Six songs in, a man in a grey suit walked on stage and the power went. Eighteen thousand people sat in the dark and then, slowly, started clapping. The photograph of the band on a dark stage is on every front page in the world by Thursday. "We\'re huge in Beijing," says the drummer, and now you are.', 'good');
          } else {
            addBuzz(st, 30); st.fans += Math.round(st.fans * 0.12 + 8000);
            st.flags.reachBonus = Math.round(((st.flags.reachBonus ?? 0) + 0.5) * 100) / 100;
            for (const m of available(st)) { adjust(m, 'mood', 14); adjust(m, 'image', 3); }
            milestone(st, 'career', 'Beijing: eighteen thousand people, the first western rock show anyone can remember.');
            log(st, 'Eighteen thousand people who had never seen a rock band, sitting, then standing, then on the seats. The ministry man clapped. The encore was watched from the wings by half the Politburo\'s children. "We\'re huge in Beijing," says the drummer, every day, for the rest of his life.', 'good');
          }
        },
      },
      { label: 'No. The tour has dates and the band has limits', hint: 'The sensible answer. Somebody else does it next year and never shuts up about it.', resolve: (st) => { st.flags.beijing = st.week; for (const m of available(st)) adjust(m, 'mood', -3); log(st, 'You said no. A band from Birmingham said yes the following spring. They have a documentary.', 'neutral'); } },
    ],
  },
  {
    id: 'tour_japan_gifts',
    weight: 4,
    where: 'tour',
    when: (s) => (s.tour?.tier === 'japan' && s.flags.japanGifts === undefined ? {} : null),
    title: () => 'The hotel lobby is full of presents',
    text: () => 'Two hundred fans have been waiting in the hotel lobby since six in the morning, in silence, in a queue, with gifts: hand-knitted scarves, drawings of the band, a cake shaped like the drummer, and a box of Polaroids that the promoter takes away very quickly.',
    options: () => [
      {
        label: 'Sign everything, meet everyone',
        hint: 'Three hours. Fans for life.',
        resolve: (st) => {
          st.flags.japanGifts = st.week;
          for (const m of available(st)) { adjust(m, 'energy', -8); adjust(m, 'mood', 10); }
          addBuzz(st, 8); st.fans += Math.round(300 + st.fans * 0.02);
          log(st, 'Three hours of bowing, signing and photographs. Every fan said thank you twice. The promoter said the band would be welcome back any time, and meant it.', 'good');
        },
      },
      {
        label: 'Wave from the mezzanine and go to bed',
        hint: 'Rest, and a reputation for being cool. Or rude.',
        resolve: (st, rng) => {
          st.flags.japanGifts = st.week;
          for (const m of available(st)) adjust(m, 'energy', 4);
          if (rng.chance(0.5)) { addBuzz(st, 2); log(st, 'A wave, a bow, and bed. The fans decided it was mysterious. The gifts were sent up anyway.', 'neutral'); }
          else { addBuzz(st, -3); log(st, 'A wave and bed. A fan magazine ran "COLD" over a photo of the empty mezzanine. The promoter smiled a little less.', 'bad'); }
        },
      },
    ],
  },
  {
    id: 'tour_breakdown',
    weight: 3,
    where: 'tour',
    when: (s) => (s.tour ? { city: nextStop(s).city } : null),
    title: () => 'Broken down',
    text: (s, p) => `${flying(s) ? 'The tour bus' : 'The van'} dies on the way to ${p.city}. Steam, silence, and a long walk to a phone box.`,
    options: (s, p) => [
      {
        label: 'Pay a mechanic to get you there tonight',
        hint: 'Expensive, but the show goes on.',
        cost: 60 * scale(s),
        resolve: (st) => log(st, `A mechanic in a boiler suit got you to ${p.city} with ten minutes to spare.`, 'good'),
      },
      {
        label: 'Hitch with the gear',
        hint: 'Free and exhausting. Something may not arrive.',
        resolve: (st, rng) => {
          for (const m of available(st)) adjust(m, 'energy', -12);
          if (rng.chance(0.4)) { st.gear = Math.max(0, st.gear - 1); log(st, 'You made it. The bass amp did not.', 'bad'); }
          else log(st, 'Three lifts, one lorry, one vicar. Everyone and everything arrived.', 'good');
        },
      },
      {
        label: 'Cancel tonight and get it towed',
        hint: 'Rest, but the promoter and the fans will be cross.',
        resolve: (st) => {
          for (const m of available(st)) adjust(m, 'energy', 10);
          st.fans = Math.max(0, st.fans - 10 * scale(st));
          addBuzz(st, -3);
          st.money -= 20 * scale(st);
          log(st, `The ${p.city} show is off. The local paper calls you no-shows.`, 'bad');
        },
      },
    ],
  },
  {
    id: 'tour_customs',
    big: true,
    weight: 2,
    where: 'tour',
    when: (s) => (s.tour && abroad(s) ? { country: nextStop(s).country } : null),
    title: (_s, p) => `Customs, ${p.country}`,
    text: () => 'The border guards want everything out of the van. There is a dog. The dog looks very interested.',
    options: () => [
      {
        label: 'Open everything, smile a lot',
        hint: 'Hours lost. Depends what the band has been carrying.',
        resolve: (st, rng) => {
          for (const m of available(st)) adjust(m, 'energy', -6);
          const risky = available(st).find((m) => m.habit >= 55);
          if (risky && rng.chance(0.5)) {
            risky.outWeeks = Math.max(risky.outWeeks, 1);
            st.money -= 100 * scale(st);
            log(st, `The dog found ${risky.isPlayer ? 'your' : `${first(risky)}'s`} stash. A fine, a night in a cell and a missed show.`, 'bad');
            revealLog(st, risky, 'vice', 2);
          } else log(st, 'Six hours, one rubber glove, nothing found. Welcome to the continent.', 'neutral');
        },
      },
      {
        label: 'Make the band flush everything at the last services',
        hint: 'Clean through customs. The heavy users will be miserable.',
        resolve: (st) => {
          for (const m of st.members) { if (m.habit >= 40) adjust(m, 'mood', -8); adjust(m, 'habit', -6); }
          log(st, 'A lot of money went down a service station toilet. Customs waved you through.', 'neutral');
        },
      },
    ],
  },
  {
    id: 'tour_hotel',
    weight: 3,
    where: 'tour',
    when: (s, rng) => {
      const c = s.members.filter((m) => m.hidden.ego + m.hidden.vice >= 110 && m.outWeeks === 0);
      return s.tour && c.length ? { m: rng.pick(c).id } : null;
    },
    title: () => 'The hotel room',
    text: (s, p) => `The manager is at reception with a list. ${mem(s, p.m).isPlayer ? 'Your' : `${first(mem(s, p.m))}'s`} room no longer has a television. Or a window.`,
    options: (s, p) => [
      { label: 'Pay for the damage', hint: 'Expensive. Nobody talks about it again.', cost: 80 * scale(s), resolve: (st) => log(st, 'Paid in cash. The manager counted it twice.', 'neutral') },
      {
        label: 'Blame the support band',
        hint: 'Free. Friendships on the tour may suffer.',
        resolve: (st) => { addBuzz(st, 2); for (const m of st.members) adjust(m, 'mood', -2); log(st, 'The support band got the bill. The atmosphere on the bus is frosty.', 'neutral'); },
      },
      {
        label: 'Do a runner at dawn',
        hint: 'Free and legendary. Hotels talk to each other.',
        resolve: (st) => {
          addBuzz(st, 6);
          setVibe(st, 'trip');
          beat(st, '05:40', 'Down the fire escape with the flight cases. The night porter waves.');
          st.flags.hotelBan = st.week;
          adjust(mem(st, p.m), 'mood', 6);
          log(st, 'Legend status: banned from a hotel chain. The music press loves it.', 'good');
        },
      },
    ],
  },
  {
    id: 'tour_promoter',
    big: true,
    weight: 2,
    where: 'tour',
    when: (s) => (s.tour ? { city: nextStop(s).city } : null),
    title: (_s, p) => `No money in ${p.city}`,
    text: () => 'After the show the promoter has gone. So has the cash box.',
    options: (s) => [
      {
        label: 'Track him down',
        hint: 'A long night. Might get the money back, might get a black eye.',
        resolve: (st, rng) => {
          for (const m of available(st)) adjust(m, 'energy', -8);
          if (rng.chance(0.5)) { st.money += 40 * scale(st); log(st, 'Found him in a casino. Got most of it back.', 'good'); }
          else { adjust(player(st), 'mood', -8); log(st, 'Found his brother instead. Bigger than the promoter.', 'bad'); }
        },
      },
      {
        label: 'Write it off',
        hint: 'Free. It stings.',
        resolve: (st) => { st.money -= 30 * scale(s); for (const m of st.members) adjust(m, 'mood', -3); log(st, 'One gig for nothing. It happens. It happens a lot.', 'bad'); },
      },
    ],
  },
  {
    id: 'tour_support_band',
    weight: 2,
    where: 'tour',
    when: (s) => (s.tour && s.tour.tier !== 'pubs' ? {} : null),
    title: () => 'The support band is good. Too good.',
    text: () => 'Every night the support band gets a bigger cheer. Their singer has started doing your moves.',
    options: () => [
      {
        label: 'Kick them off the tour',
        hint: 'Your show again. Mean, and people will say so.',
        resolve: (st) => { addBuzz(st, -2); for (const m of st.members) adjust(m, 'mood', 4); log(st, 'The support band went home. You headline your own tour again.', 'neutral'); },
      },
      {
        label: 'Up your game',
        hint: 'Longer soundchecks. Everyone gets better, and more tired.',
        resolve: (st, rng) => {
          for (const m of available(st)) { adjust(m, 'energy', -8); if (rng.chance(0.5)) adjust(m, 'stage', 1); }
          st.tightness = clamp(st.tightness + 5, 0, 100);
          log(st, 'Rivalry is good for you. The set has never been sharper.', 'good');
        },
      },
      {
        label: 'Let them be',
        hint: 'Free. Some of your crowd will leave as theirs.',
        resolve: (st) => { st.fans = Math.max(0, st.fans - 15 * scale(st)); log(st, 'A few of your fans now wear their T-shirts.', 'bad'); },
      },
    ],
  },
  {
    id: 'tour_food',
    weight: 2,
    where: 'tour',
    when: (s, rng) => (s.tour ? { m: rng.pick(s.members).id, food: rng.pick(['a service station pie', 'a kebab of uncertain origin', 'hotel prawns', 'a gas station burrito', 'reheated chips']) } : null),
    title: () => 'Food poisoning',
    text: (s, p) => `${who(mem(s, p.m))} ate ${p.food}. ${mem(s, p.m).isPlayer ? 'You are' : 'They are'} green.`,
    options: (_s, p) => [
      {
        label: 'Play through it',
        hint: 'A bucket by the drum riser.',
        resolve: (st) => { const m = mem(st, p.m); adjust(m, 'energy', -20); adjust(m, 'mood', -5); addBuzz(st, 2); log(st, `${who(m)} played the whole set and was sick in the encore. The crowd thought it was part of the show.`, 'neutral'); },
      },
      {
        label: 'Rest them for a night',
        hint: 'The band plays one short, or cancels.',
        resolve: (st) => { const m = mem(st, p.m); adjust(m, 'energy', 10); m.outWeeks = Math.max(m.outWeeks, 1); log(st, `${who(m)} spent the night in bed with dry toast.`, 'neutral'); },
      },
    ],
  },
  {
    id: 'tour_signing',
    weight: 2,
    where: 'tour',
    when: (s) => (s.tour && s.releases.length ? { city: nextStop(s).city } : null),
    title: (_s, p) => `Record shop signing in ${p.city}`,
    text: () => 'A local record shop wants the band for an afternoon signing.',
    options: () => [
      {
        label: 'Do it',
        hint: 'Fans love it. Your afternoon nap does not.',
        resolve: (st) => { st.fans += 25 * Math.max(1, Math.round(st.fans / 2000)); for (const m of available(st)) adjust(m, 'energy', -5); log(st, 'A queue round the block. You signed a forehead.', 'good'); },
      },
      { label: 'Sleep instead', hint: 'Fresher for the show.', resolve: (st) => { for (const m of available(st)) adjust(m, 'energy', 6); log(st, 'The shop put a sign up: "Band too tired".', 'neutral'); } },
    ],
  },
  {
    id: 'tour_luggage',
    weight: 2,
    where: 'tour',
    when: (s, rng) => (s.tour && flying(s) ? { m: rng.pick(mates(s).length ? mates(s) : s.members).id } : null),
    title: () => 'Lost luggage',
    text: (s, p) => `The airline has lost ${mem(s, p.m).isPlayer ? 'your' : `${first(mem(s, p.m))}'s`} instrument. It may be in Reykjavik.`,
    options: (s, p) => [
      { label: 'Buy a new one in town', hint: 'Costs. Sounds different.', cost: 40 * scale(s), resolve: (st) => log(st, `A shiny new instrument. ${who(mem(st, p.m))} hates it already.`, 'neutral') },
      {
        label: 'Borrow from the support band',
        hint: 'Free. Their gear, their tuning, their smell.',
        resolve: (st) => { const m = mem(st, p.m); adjust(m, 'mood', -8); st.tightness = clamp(st.tightness - 3, 0, 100); log(st, 'It worked. Just about.', 'neutral'); },
      },
    ],
  },
  {
    id: 'tour_homesick',
    big: true,
    weight: 3,
    where: 'tour',
    when: (s) => {
      const c = mates(s).filter((m) => m.mood < 40);
      return s.tour && s.tour.week >= 2 && c.length ? { m: c[0].id } : null;
    },
    title: (s, p) => `${first(mem(s, p.m))} wants to go home`,
    text: (s, p) => `${first(mem(s, p.m))} rang home last night and has been staring out of the bus window ever since.`,
    options: (s, p) => [
      {
        label: 'Pay them a bonus to stay',
        hint: 'Money helps. A bit.',
        cost: 30 * scale(s),
        resolve: (st) => { const m = mem(st, p.m); adjust(m, 'mood', 12); log(st, `${first(m)} is staying. For the money, mostly.`, 'neutral'); },
      },
      {
        label: 'Talk them round over a drink',
        hint: 'Free. Bonding, with a hangover.',
        resolve: (st) => { const m = mem(st, p.m); adjust(m, 'mood', 8); adjust(m, 'habit', 3); addAffinity(st, m.id, 'p', 8); log(st, `A long night, a lot of talk. ${first(m)} is back on board.`, 'good'); },
      },
      {
        label: 'Let them fly home, hire a dep',
        hint: 'They recover. The stand-in costs and the band sounds different.',
        cost: 50 * scale(s),
        resolve: (st) => { const m = mem(st, p.m); m.outWeeks = Math.max(m.outWeeks, 2); adjust(m, 'mood', 15); adjust(m, 'energy', 30); st.tightness = clamp(st.tightness - 8, 0, 100); log(st, `${first(m)} went home. A session player learned the set in a day.`, 'neutral'); },
      },
    ],
  },
  {
    id: 'tour_extra_date',
    weight: 2,
    where: 'tour',
    when: (s) => (s.tour && s.buzz >= 30 ? { city: nextStop(s).city } : null),
    title: (_s, p) => `Extra date in ${p.city}?`,
    text: () => 'The first show sold out in an hour. The promoter wants a second night.',
    options: () => [
      {
        label: 'Add the date',
        hint: 'Good money and fans. The band is already shattered.',
        resolve: (st) => {
          const t = tier(st);
          st.money += t.fee; st.fans += Math.round(t.capacity[0] * 0.15);
          for (const m of available(st)) adjust(m, 'energy', -10);
          log(st, 'Second night, second sell-out.', 'good');
        },
      },
      { label: 'Keep the night off', hint: 'Sanity over money.', resolve: (st) => { for (const m of available(st)) adjust(m, 'energy', 5); log(st, 'A night off. Someone found a launderette.', 'neutral'); } },
    ],
  },
  {
    id: 'tour_driver',
    weight: 1,
    where: 'tour',
    when: (s) => (s.tour ? {} : null),
    title: () => 'The driver is drunk',
    text: () => 'Load-out is done, the next city is 300 miles away, and the driver can barely stand.',
    options: (s) => [
      { label: 'Hire a replacement driver tonight', hint: 'Costly, safe, on time.', cost: 30 * scale(s), resolve: (st) => log(st, 'A new driver by 2 a.m. The old one sleeps across the back seat.', 'neutral') },
      {
        label: 'The soberest band member drives',
        hint: 'Free. Whoever has had nothing at all takes the wheel.',
        resolve: (st) => {
          const sober = [...available(st)].sort((a, b) => a.habit - b.habit)[0];
          adjust(sober, 'energy', -20);
          addAffinity(st, sober.id, 'p', 5);
          log(st, `${who(sober)} drove through the night on coffee and nothing else.`, 'neutral');
        },
      },
      {
        label: 'Wait until morning and miss soundcheck',
        hint: 'Safe and slow. Tomorrow will be ropey.',
        resolve: (st) => { st.tightness = clamp(st.tightness - 4, 0, 100); log(st, 'You left at nine, arrived at six, played at eight. Tense.', 'neutral'); },
      },
    ],
  },
  {
    id: 'tour_vegas',
    weight: 1,
    where: 'tour',
    when: (s, rng) => (s.tour && s.tour.tier === 'america' && mates(s).length ? { m: rng.pick(mates(s)).id } : null),
    title: (s, p) => `${first(mem(s, p.m))} got married`,
    text: (s, p) => `Somewhere between the casino and the chapel, ${first(mem(s, p.m))} married someone called Krystal. Or possibly Kristoff.`,
    options: (s, p) => [
      { label: 'Pay for a quick annulment', hint: 'Costs. Quiet.', cost: 40 * scale(s), resolve: (st) => { adjust(mem(st, p.m), 'mood', -6); log(st, 'A lawyer in a white suit sorted it out by lunchtime.', 'neutral'); } },
      {
        label: 'Throw them a reception at the gig',
        hint: 'Free publicity. The new spouse is coming on tour.',
        resolve: (st) => { addBuzz(st, 6); adjust(mem(st, p.m), 'mood', 12); for (const o of mates(st)) if (o.id !== p.m) adjust(o, 'mood', -4); log(st, 'The crowd threw rice. The new spouse has opinions about the setlist.', 'good'); },
      },
    ],
  },
  {
    id: 'tour_radio',
    weight: 2,
    where: 'tour',
    when: (s) => (s.tour && s.tour.tier !== 'pubs' ? { city: nextStop(s).city } : null),
    title: (_s, p) => `Radio in ${p.city}`,
    text: () => 'The biggest local station wants the band live in the studio at 8 a.m.',
    options: () => [
      {
        label: 'Get up and do it',
        hint: 'Good for business. Brutal after a show.',
        resolve: (st) => { st.fans += Math.round(20 + st.fans * 0.01); addBuzz(st, 4); for (const m of available(st)) adjust(m, 'energy', -8); log(st, 'Live at 8 a.m., voice like gravel. The phones lit up.', 'good'); },
      },
      { label: 'Send a tape and sleep', hint: 'Free and fresh, less impact.', resolve: (st) => { addBuzz(st, 1); log(st, 'They played the tape. The DJ mispronounced the band name.', 'neutral'); } },
    ],
  },
  {
    id: 'tour_police',
    big: true,
    weight: 2,
    where: 'tour',
    when: (s) => (s.tour && s.members.some((m) => m.habit >= 45) ? { city: nextStop(s).city } : null),
    title: (_s, p) => `Police backstage in ${p.city}`,
    text: () => 'Two plain-clothes officers want a word in the dressing room. Someone has tipped them off.',
    options: () => [
      {
        label: 'Cooperate fully',
        hint: 'Whatever is there, they find.',
        resolve: (st, rng) => {
          const user = [...st.members].sort((a, b) => b.habit - a.habit)[0];
          if (rng.chance(user.habit / 100)) { st.money -= 150; addBuzz(st, 5); log(st, `They found ${user.isPlayer ? 'your' : `${first(user)}'s`} stash. Fined, cautioned, front page.`, 'bad'); revealLog(st, user, 'vice', 2); }
          else log(st, 'They found a sandwich and a broken tambourine. Apologies all round.', 'good');
        },
      },
      {
        label: 'Play for time while the roadie clears up',
        hint: 'Risky and stressful.',
        resolve: (st, rng) => {
          for (const m of st.members) adjust(m, 'mood', -4);
          if (rng.chance(0.6)) log(st, 'By the time they got in, the room smelled of air freshener and innocence.', 'good');
          else { st.money -= 250; addBuzz(st, 8); log(st, 'Caught mid-flush. Obstruction, fines, headlines.', 'bad'); }
        },
      },
    ],
  },
  {
    id: 'tour_riot',
    weight: 1,
    where: 'tour',
    when: (s) => (s.tour && s.tour.tier !== 'pubs' && s.buzz >= 35 ? { city: nextStop(s).city } : null),
    title: (_s, p) => `Trouble in ${p.city}`,
    text: () => 'Too many people, not enough doors. The crowd outside wants in.',
    options: () => [
      {
        label: 'Play a free set on the van roof',
        hint: 'Legend, or chaos.',
        resolve: (st, rng) => {
          addBuzz(st, 8);
          if (rng.chance(0.7)) { st.fans += Math.round(50 + st.fans * 0.02); log(st, 'Twenty minutes on the van roof. The police were not amused, the fans were.', 'good'); }
          else { st.money -= 200; log(st, 'The van roof caved in. Worth it, mostly.', 'bad'); }
        },
      },
      { label: 'Let the promoter and police handle it', hint: 'Safe and dull.', resolve: (st) => { addBuzz(st, 1); log(st, 'The police moved them on. The gig went ahead behind closed doors.', 'neutral'); } },
    ],
  },
];

TOUR_EVENTS.push(...ROAD_ROMANCE);
export const TOUR_EVENT_IDS = TOUR_EVENTS.map((e) => e.id);
