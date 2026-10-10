// One-off gig offers that turn up early in a career: weddings, school discos, working men's clubs.
// Each is a trade: money against credibility, fans against livers. They change every week.
import { Rng, clamp } from './rng';
import { available } from './chemistry';
import { addBuzz, adjust, first, log } from './helpers';
import type { GameState } from './types';

export interface Offer {
  id: string;
  label: string;
  hint: string;
  /** Where it happens, for the commentary: "a wedding reception in Bexleyheath". */
  venue: string;
  capacity: number;
  crowd: [number, number];
  fee: number;
  fanMult: number;
  energyMult: number;
  buzzBonus: number;
  /** Is it on the table for this band at all? */
  fits: (s: GameState) => boolean;
  /** What happens after the last song. */
  after: (s: GameState, rng: Rng, perf: number, crowd: number) => void;
}

const purists = (s: GameState) => available(s).filter((m) => !m.isPlayer && (m.style === 'metal' || m.style === 'punk'));

export const OFFERS: Offer[] = [
  {
    id: 'wedding', label: 'Wedding reception', venue: 'a wedding reception in a Bexleyheath function room',
    hint: 'Good money, covers only, nobody there will ever buy your record. The purists will die inside.',
    capacity: 120, crowd: [80, 120], fee: 120, fanMult: 0.05, energyMult: 0.9, buzzBonus: 0, fits: () => true,
    after: (s) => {
      for (const m of purists(s)) adjust(m, 'mood', -6);
      log(s, 'You played the slow one three times for the bride\'s mum. The groom\'s uncle sang the last chorus.', 'neutral');
    },
  },
  {
    id: 'birthday', label: "Cousin Sharon's 21st", venue: "a cousin's 21st in a pub function room",
    hint: 'Family do. Free bar, small fee, a lot of aunties.',
    capacity: 70, crowd: [45, 70], fee: 60, fanMult: 0.2, energyMult: 0.8, buzzBonus: 0, fits: () => true,
    after: (s, rng) => {
      for (const m of available(s)) adjust(m, 'habit', (m.hidden.vice / 100) * rng.int(1, 4));
      log(s, 'The free bar ran dry at ten. An aunt asked if you did any proper songs.', 'neutral');
    },
  },
  {
    id: 'school', label: 'School disco', venue: 'a school disco in Ilford',
    hint: 'Tiny fee, loud teenagers, the kind of fans who write your name on their pencil cases.',
    capacity: 220, crowd: [130, 220], fee: 30, fanMult: 0.8, energyMult: 0.9, buzzBonus: 1, fits: (s) => s.fans < 600,
    after: (s) => {
      for (const m of available(s)) adjust(m, 'mood', 3);
      log(s, 'A deputy head pulled the plug at nine forty-five sharp. Three hundred autographs on rulers.', 'good');
    },
  },
  {
    id: 'wmc', label: "Working men's club", venue: "a working men's club in Dagenham",
    hint: 'Decent money and a tough room. Win them over or get booed off before the bingo.',
    capacity: 150, crowd: [70, 140], fee: 90, fanMult: 0.25, energyMult: 1, buzzBonus: 0, fits: () => true,
    after: (s, rng, perf) => {
      if (perf + rng.int(-10, 10) < 55) {
        for (const m of available(s)) adjust(m, 'mood', -8);
        log(s, 'Booed off before the bingo. The concert secretary paid you in coins, slowly.', 'bad');
      } else {
        for (const m of available(s)) { adjust(m, 'mood', 5); adjust(m, 'habit', 1); }
        log(s, 'The hard men at the bar bought you pints. High praise in Dagenham.', 'good');
      }
    },
  },
  {
    id: 'freshers', label: "Polytechnic freshers' ball", venue: "a polytechnic freshers' ball",
    hint: 'A big, drunk, open-minded crowd. Buzz and fans, and a very long night.',
    capacity: 500, crowd: [260, 480], fee: 80, fanMult: 0.6, energyMult: 1.4, buzzBonus: 2, fits: (s) => s.fans >= 40 && s.week % 52 >= 34 && s.week % 52 <= 44,
    after: (s, rng) => {
      for (const m of available(s)) adjust(m, 'habit', (m.hidden.vice / 100) * rng.int(2, 7));
      log(s, 'The after-party was in a hall of residence. Nobody is sure whose.', 'neutral');
    },
  },
  {
    id: 'instore', label: 'In-store at a Soho record shop', venue: 'a Soho record shop, between the racks',
    hint: 'No pay, a few dozen people, perfect for shifting demo tapes.',
    capacity: 40, crowd: [18, 40], fee: 0, fanMult: 0.7, energyMult: 0.5, buzzBonus: 1, fits: (s) => s.releases.length > 0,
    after: (s, _rng, _perf, crowd) => {
      const tapes = Math.round(crowd * 0.5);
      const demo = s.releases.find((r) => r.kind === 'demo');
      if (demo) demo.sold += tapes;
      s.money += Math.round(tapes * 1.5);
      log(s, `Sold ${tapes} tapes off the counter. The shop owner wants a signed one for the wall.`, 'good');
    },
  },
  {
    id: 'camp', label: 'Weekend at a holiday camp', venue: 'a holiday camp ballroom in Clacton',
    hint: 'Two nights, good money, sunburnt holidaymakers. Knackering.',
    capacity: 300, crowd: [140, 300], fee: 200, fanMult: 0.2, energyMult: 1.7, buzzBonus: 0, fits: () => true,
    after: (s) => {
      for (const m of available(s)) adjust(m, 'mood', 4);
      log(s, 'Between sets you judged a knobbly knees contest. Nobody will ever know.', 'neutral');
    },
  },
  {
    id: 'rotary', label: 'Rotary Club dinner dance', venue: 'a Rotary Club dinner dance',
    hint: 'Respectable people, a respectable fee. Things could get unrespectable.',
    capacity: 90, crowd: [60, 90], fee: 110, fanMult: 0, energyMult: 0.8, buzzBonus: 0, fits: () => true,
    after: (s, rng) => {
      if (rng.chance(0.3)) {
        addBuzz(s, 5);
        log(s, 'A councillor danced on a table to your encore. It made the local paper.', 'good');
      } else log(s, 'Polite applause, a cheese board, and a cheque.', 'neutral');
    },
  },
  {
    id: 'police', label: 'Police social club', venue: 'a police social club',
    hint: 'Good money. Some of the band would rather not be in a room full of coppers.',
    capacity: 100, crowd: [60, 100], fee: 100, fanMult: 0.05, energyMult: 0.8, buzzBonus: 0, fits: () => true,
    after: (s) => {
      const nervous = available(s).filter((m) => !m.isPlayer && m.hidden.vice >= 65);
      for (const m of nervous) adjust(m, 'mood', -6);
      log(s, nervous.length ? `${first(nervous[0])} spent the whole gig facing the drum riser.` : 'The sergeant requested a ballad. You obliged.', 'neutral');
    },
  },
  {
    id: 'youthclub', label: 'Youth club', venue: 'a youth club in Peckham',
    hint: 'Pocket money fee, young crowd, real fans in the making.',
    capacity: 120, crowd: [50, 120], fee: 15, fanMult: 0.9, energyMult: 0.8, buzzBonus: 0, fits: (s) => s.fans < 600,
    after: (s) => log(s, 'A kid asked how to start a band. You told them not to. They will anyway.', 'good'),
  },
  {
    id: 'wake', label: 'A wake in Lewisham', venue: 'a wake in a Lewisham pub. The deceased loved rock and roll',
    hint: 'Strange, sad, decent money. Could be the best gig you ever play.',
    capacity: 70, crowd: [40, 70], fee: 70, fanMult: 0.15, energyMult: 0.7, buzzBonus: 0, fits: () => true,
    after: (s, rng) => {
      const moved = rng.chance(0.6);
      for (const m of available(s)) adjust(m, 'mood', moved ? 5 : -3);
      log(s, moved ? 'The widow danced to the last song. Nobody in the band will talk about it, and nobody will forget it.' : 'A grandson asked you to turn it down. At a wake. Fair enough.', moved ? 'good' : 'neutral');
    },
  },
];

/** This week's offers: stable within a week, different every week, rarer as the band grows. */
export function weeklyOffers(s: GameState): Offer[] {
  if (s.fans >= 1500) return [];
  let seed = s.week * 7919;
  for (const c of s.bandName) seed = (seed * 31 + c.charCodeAt(0)) | 0;
  const rng = new Rng(seed);
  const pool = rng.shuffle(OFFERS.filter((o) => o.fits(s)));
  const n = s.fans < 400 ? (rng.chance(0.7) ? 2 : 1) : rng.chance(0.5) ? 1 : 0;
  return pool.slice(0, clamp(n, 0, pool.length));
}
