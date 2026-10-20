// The big nights a famous band can still play one at a time: an arena, a stadium, a festival field in
// August, and once or twice a career a beach with half a million people on it.
import { Rng, clamp } from './rng';
import { available } from './chemistry';
import { addBuzz, adjust, log, milestone } from './helpers';
import type { GameState } from './types';

export interface BigShow {
  id: string;
  label: string;
  venue: string;
  hint: string;
  capacity: number;
  /** Fans needed before the promoter rings. */
  minFans: number;
  fee: number;
  /** Share of the door you keep. */
  door: number;
  /** Staging: what it costs you to put the show on. */
  cost: number;
  fanMult: number;
  energyMult: number;
  buzzBonus: number;
  /** Merch per head relative to a club night: mud and sand are bad for wallets. */
  merchMult?: number;
  /** Festival: summer only, once a year. Beach: once in a long while. */
  season?: 'summer';
  /** Weeks before the same show comes round again. */
  every: number;
  crowd: (s: GameState, rng: Rng) => number;
  after?: (s: GameState, rng: Rng, perf: number, crowd: number) => void;
}

export const SUMMER: [number, number] = [24, 35];
export const inSummer = (s: GameState) => s.week % 52 >= SUMMER[0] && s.week % 52 <= SUMMER[1];

const fill = (lo: number, hi: number) => (_s: GameState, rng: Rng) => rng.int(lo, hi);
const weather = (s: GameState, rng: Rng, perf: number): void => {
  if (rng.chance(0.3)) {
    for (const m of available(s)) adjust(m, 'mood', -4);
    log(s, 'It rained from the second song. The field became a bog, the bog became a crowd-surfing event, and the drummer\'s monitors filled up. The photos are magnificent.', 'neutral');
  } else if (perf >= 70) {
    for (const m of available(s)) adjust(m, 'mood', 6);
    log(s, 'Sun down behind the stage, ninety thousand lighters, the slow one at exactly the right moment. Even the sound man cried.', 'good');
  }
};

export const BIG_SHOWS: BigShow[] = [
  {
    id: 'arena', label: 'One night at the Empire Arena', venue: 'the Empire Arena, Wembley Park',
    hint: 'Twelve thousand under one roof. A big fee, a big crew bill, and the whole of London talking on Monday.',
    capacity: 12000, minFans: 20000, fee: 6000, door: 0.45, cost: 2500, fanMult: 1.2, energyMult: 1.2, buzzBonus: 6, every: 10,
    crowd: (s, rng) => Math.round(clamp(s.fans * 0.25, 3000, 12000) * (0.8 + rng.next() * 0.25)),
  },
  {
    id: 'stadium', label: 'A stadium show at Kingsmeadow', venue: 'Kingsmeadow Stadium',
    hint: 'Sixty thousand on a football pitch, fireworks, a stage the size of a street. The staging bill is a single\'s budget.',
    capacity: 60000, minFans: 150000, fee: 40000, door: 0.45, cost: 25000, fanMult: 1.3, energyMult: 1.4, buzzBonus: 10, every: 26,
    crowd: (s, rng) => Math.round(clamp(s.fans * 0.2, 20000, 60000) * (0.8 + rng.next() * 0.25)),
    after: (s, _rng, perf) => { if (perf >= 75) milestone(s, 'career', `Sold out Kingsmeadow Stadium.`); },
  },
  {
    id: 'mudfield_second', label: 'Mudfield Festival, the Other Stage', venue: 'the Other Stage at Mudfield Festival',
    hint: 'Teatime slot in a field in Somerset. Fifteen thousand people who did not come for you, and might leave as fans.',
    capacity: 20000, minFans: 4000, fee: 1500, door: 0, cost: 0, fanMult: 2.2, energyMult: 1.3, buzzBonus: 8, merchMult: 0.5, season: 'summer', every: 40,
    crowd: fill(9000, 20000), after: weather,
  },
  {
    id: 'mudfield', label: 'Headline Mudfield Festival', venue: 'the Pyramid at Mudfield Festival',
    hint: 'Saturday night, the big stage, ninety thousand in a field and the television cameras. The gig of a career, if the weather holds.',
    capacity: 100000, minFans: 60000, fee: 25000, door: 0, cost: 0, fanMult: 2.5, energyMult: 1.5, buzzBonus: 18, merchMult: 0.5, season: 'summer', every: 40,
    crowd: fill(70000, 100000),
    after: (s, rng, perf, crowd) => { weather(s, rng, perf); if (perf >= 70) milestone(s, 'career', `Headlined Mudfield Festival for ${crowd.toLocaleString('en-GB')} people.`); },
  },
  {
    id: 'ironmonument', label: 'Iron Monument, Castle Dunnington', venue: 'the Iron Monument festival at Castle Dunnington',
    hint: 'The heavy one. Seventy thousand in denim and leather, bottles of a colour you do not want to know, and a crowd that decides in the first thirty seconds.',
    capacity: 80000, minFans: 30000, fee: 15000, door: 0, cost: 0, fanMult: 2, energyMult: 1.5, buzzBonus: 14, merchMult: 0.6, season: 'summer', every: 40,
    crowd: fill(50000, 80000),
    after: (s, rng, perf) => {
      const metal = available(s).some((m) => m.style === 'metal' || m.style === 'punk');
      if (perf < 55 && !metal) { addBuzz(s, -4); for (const m of available(s)) adjust(m, 'mood', -6); log(s, 'They bottled the keyboard solo. They bottled the ballad. They bottled the drum riser, which was impressive. You left by helicopter.', 'bad'); }
      else { weather(s, rng, perf); if (metal) for (const m of available(s)) adjust(m, 'mood', 4); }
    },
  },
  {
    id: 'nordvik', label: 'Nordvik Festival, Denmark', venue: 'the Orange Stage at Nordvik Festival',
    hint: 'Sixty thousand Scandinavians in the midnight sun, a backstage that is a small town, and a fee in kroner.',
    capacity: 70000, minFans: 40000, fee: 18000, door: 0, cost: 0, fanMult: 2, energyMult: 1.6, buzzBonus: 12, merchMult: 0.5, season: 'summer', every: 40,
    crowd: fill(45000, 70000), after: weather,
  },
  {
    id: 'park', label: 'A free concert in the park', venue: 'a free concert in Regent\'s Park',
    hint: 'No ticket, no fee, a quarter of a million on the grass and the whole of the city on your side. You pay for the stage.',
    capacity: 300000, minFans: 300000, fee: 0, door: 0, cost: 60000, fanMult: 2.5, energyMult: 1.5, buzzBonus: 25, merchMult: 0.3, every: 104,
    crowd: fill(180000, 300000),
    after: (s, _rng, perf, crowd) => { if (perf >= 60) milestone(s, 'career', `A free concert in the park for ${crowd.toLocaleString('en-GB')} people.`); },
  },
  {
    id: 'beach', label: 'A free show on the beach in Rio', venue: 'the beach at Copaloma, Rio',
    hint: 'Half a million people on the sand, a stage on the water, fireworks over the bay. The staging costs a fortune and the night costs nothing else, ever.',
    capacity: 600000, minFans: 900000, fee: 0, door: 0, cost: 180000, fanMult: 2.5, energyMult: 1.8, buzzBonus: 35, merchMult: 0.12, every: 156,
    crowd: fill(350000, 600000),
    after: (s, _rng, perf, crowd) => {
      if (perf >= 60) { milestone(s, 'career', `${crowd.toLocaleString('en-GB')} people on a beach in Rio.`); for (const m of available(s)) adjust(m, 'image', 3); }
      log(s, 'The bay was full of boats. The sand was full of people. Somebody counted from a helicopter and gave up. The hotel bar closed at nine in the morning, out of glasses.', perf >= 60 ? 'good' : 'neutral');
    },
  },
];

/** Why a big show is not on this week, or null if it is. */
export function bigShowLocked(s: GameState, b: BigShow): string | null {
  if (s.fans < b.minFans) return `The promoter wants ${b.minFans.toLocaleString('en-GB')} fans. You have ${s.fans.toLocaleString('en-GB')}.`;
  if (b.season === 'summer' && !inSummer(s)) return 'Festival season is June to August.';
  const last = s.flags[`big_${b.id}`];
  if (last !== undefined && s.week - last < b.every) return b.season ? 'Played it this year. Next summer.' : `Too soon: ${b.every - (s.week - last)} weeks.`;
  if (s.money < b.cost) return `Staging costs £${b.cost.toLocaleString('en-GB')} up front.`;
  return null;
}

/** The big shows a band of this size is shown: open ones, and the next one up as a tease. */
export function bigShowsFor(s: GameState): BigShow[] {
  return BIG_SHOWS.filter((b) => s.fans >= b.minFans / 2);
}
