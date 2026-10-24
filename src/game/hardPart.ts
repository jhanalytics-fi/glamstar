// The hard part: staying there. A flop that costs fans, a fashion that moves on, the one hit that
// everything after is measured against, and the taxman with a calculator and three years of receipts.
import { clamp } from './rng';
import { available } from './chemistry';
import { addBuzz, adjust, log, milestone } from './helpers';
import { trend } from './world';
import { PRESS } from './names';
import type { EventDef } from './events';
import type { GameState, Release } from './types';

/** The band's best-selling single so far, and whether it dwarfs everything else: a one-hit wonder in the making. */
export function theHit(s: GameState): { hit: Release; wonder: boolean } | null {
  const singles = s.releases.filter((r) => r.kind === 'single' && !r.comp);
  if (singles.length < 2) return null;
  const sorted = [...singles].sort((a, b) => b.sold - a.sold);
  const hit = sorted[0];
  const rest = sorted.slice(1).reduce((a, r) => Math.max(a, r.sold), 0);
  if (hit.sold < 20000) return null;
  return { hit, wonder: hit.sold >= rest * 4 && sorted.length >= 3 };
}

/** Sales multiplier for a record, judged against the band's own hit and its own flops. */
export function judgement(s: GameState, r: Release): number {
  let m = 1;
  const h = theHit(s);
  // Everything after the hit is "not as good as the hit": a weaker record sells worse than it would have, the hit itself keeps selling for years.
  if (h) {
    if (r.id === h.hit.id) m *= h.wonder ? 1.6 : 1.15;
    else if (h.wonder && r.week > h.hit.week && r.quality < h.hit.quality - 12) m *= 0.6;
  }
  // A flop on the record: the next release is bought with suspicion.
  if (s.flags.flop !== undefined && r.week >= s.flags.flop && s.week - s.flags.flop <= 26 && r.week !== s.flags.flop) m *= 0.8;
  return m;
}

/** Called once a week: a studio album that sold badly against the one before it is a flop, and flops cost fans. */
export function flopWatch(s: GameState): void {
  const albums = s.releases.filter((r) => r.kind === 'album' && !r.comp);
  if (albums.length < 2) return;
  const last = albums[albums.length - 1];
  const prev = albums[albums.length - 2];
  if (s.week - last.week !== 10 || s.flags[`judged_${last.id}`]) return;
  s.flags[`judged_${last.id}`] = 1;
  const prevAt10 = prev.sold;
  if (last.sold < prevAt10 * 0.45 && prev.sold >= 20000) {
    s.flags.flop = s.week;
    const lost = Math.round(s.fans * 0.08);
    s.fans -= lost;
    addBuzz(s, -8);
    for (const m of s.members) adjust(m, 'mood', -6);
    milestone(s, 'release', `"${last.title}" flopped: ${lost.toLocaleString('en-GB')} fans found other bands.`);
    log(s, `Ten weeks in, "${last.title}" has sold less than half what "${prev.title}" had. ${PRESS} asks, in a headline, whether the band has lost it. ${lost.toLocaleString('en-GB')} fans decided it has.`, 'bad');
  } else if (last.sold > prev.sold * 1.5 && s.flags.flop !== undefined) {
    delete s.flags.flop;
    log(s, `"${last.title}" has outsold the flop. The word "comeback" appears, prematurely, in print.`, 'good');
  }
}

/** The weekly drift when fashion has moved on: a big band in a dying style loses fans unless it is out there. */
export function fashionDrift(s: GameState): void {
  if (s.fans < 30000 || s.tour) return;
  const t = trend(s.members[0].style, s.week);
  if (t >= 0.5) return;
  const idle = s.week - Math.max(s.lastGigWeek ?? -99, s.releases.reduce((a, r) => Math.max(a, r.week), -99), s.flags.lastTourWeek ?? -99);
  if (idle < 3) return;
  const loss = Math.round(s.fans * (0.5 - t) * 0.012);
  s.fans -= loss;
  if (s.week % 13 === 0) log(s, `The sound the band made its name on is last year's. Fans are drifting to whatever is next: ${loss.toLocaleString('en-GB')} this week alone.`, 'bad');
}

export const HARD_EVENTS: EventDef[] = [
  {
    // The papers have moved on. The band has to decide whether to.
    id: 'fashion_turns',
    weight: 5,
    where: 'home',
    when: (s) => (s.fans >= 30000 && trend(s.members[0].style, s.week) < 0.5 && s.flags.fashionTurned === undefined ? {} : null),
    title: () => 'The papers have moved on',
    text: (s) => `${PRESS} has a new cover star every week and none of them sound like ${s.bandName}. The kids at the front are a year older and the kids behind them want something else. The A&R man used the word "heritage". He meant it kindly.`,
    options: () => [
      {
        label: 'Change the sound. Follow the kids',
        hint: 'A new direction from the Write menu, tightness down, a fifth of the old fans gone. The rest come with you, maybe.',
        resolve: (st) => {
          st.flags.fashionTurned = st.week;
          st.flags.directionFree = 1;
          st.tightness = clamp(st.tightness - 20, 0, 100);
          const lost = Math.round(st.fans * 0.18);
          st.fans -= lost;
          addBuzz(st, 10);
          log(st, `The band announced "a new direction". ${lost.toLocaleString('en-GB')} fans announced theirs. Pick the new sound from the Write menu; the first record in it decides everything.`, 'neutral');
        },
      },
      {
        label: 'Double down. Louder, older, prouder',
        hint: 'The loyal stay loyal and the drift goes on. Cheaper every year, and the fans you keep never leave.',
        resolve: (st) => {
          st.flags.fashionTurned = st.week;
          st.flags.coreFans = Math.round(Math.max(st.flags.coreFans ?? 0, st.fans * 0.4));
          for (const m of available(st)) adjust(m, 'mood', 6);
          log(st, 'The band said, in print, that it would rather be out of fashion than in it. The hard core took that personally, in the good way.', 'neutral');
        },
      },
      {
        label: 'Take a year off and let them miss you',
        hint: 'Everyone out for six months. The drift stops, the band rests, the hunger comes back. Or it does not.',
        resolve: (st) => {
          st.flags.fashionTurned = st.week;
          for (const m of st.members) { m.outWeeks = Math.max(m.outWeeks, 26); adjust(m, 'habit', -10); }
          st.flags.coreFans = Math.round(Math.max(st.flags.coreFans ?? 0, st.fans * 0.3));
          log(st, 'A statement: "a well-earned break". Six months of gardening, golf, a solo record nobody will mention. Absence is a strategy. Occasionally it works.', 'neutral');
        },
      },
    ],
  },
  {
    // The one song. Every interview, every encore, every royalty cheque.
    id: 'one_hit_wonder',
    weight: 5,
    when: (s) => { const h = theHit(s); return h && h.wonder && s.flags.oneHit === undefined && s.week - h.hit.week >= 20 ? { title: h.hit.title } : null; },
    title: (_s, p) => `"${p.title}" is the only song anyone wants`,
    text: (s, p) => `Every interview ends with it. Every encore is it. The new single is "the follow-up to '${p.title}'" in every review, and sells like one. The band has forty songs and a public with room for one. ${s.bandName} is, in the trade's cruel phrase, a one-hit wonder, and the hit keeps paying.`,
    options: (_s, p) => [
      {
        label: 'Milk it. Play it twice a night, license it to everything',
        hint: 'The hit becomes an annuity: adverts, films, a karaoke machine. The rest of the catalogue is a rumour.',
        resolve: (st) => {
          st.flags.oneHit = 1;
          st.flags.hitMilked = st.week;
          const fee = Math.round(clamp(st.fans * 2, 5000, 400000));
          st.money += fee;
          for (const m of available(st)) adjust(m, 'mood', -4);
          log(st, `"${p.title}" is now a lager advert, a film trailer and a ringtone before ringtones. £${fee.toLocaleString('en-GB')} up front and a cheque every quarter. The band plays it twice a night and hates it slightly more each time.`, 'neutral');
        },
      },
      {
        label: 'Refuse to play it. Make them hear the new one',
        hint: 'Buzz up with the critics, fans down with everyone else. Brave, and the word for brave is often "former".',
        resolve: (st) => {
          st.flags.oneHit = 1;
          st.flags.hitRefused = st.week;
          const lost = Math.round(st.fans * 0.12);
          st.fans -= lost;
          addBuzz(st, 8);
          for (const m of available(st)) adjust(m, 'mood', 5);
          log(st, `"${p.title}" was dropped from the set. The first night, forty people walked out before the encore. The second night, ${PRESS} called it "the bravest set in London". ${lost.toLocaleString('en-GB')} fans wanted the song.`, 'neutral');
        },
      },
      {
        label: 'Write its sequel',
        hint: 'A song that sounds like it, on purpose. Sells on the name, and the critics never forgive it.',
        resolve: (st, rng) => {
          st.flags.oneHit = 1;
          const h = theHit(st);
          const q = clamp((h?.hit.quality ?? 70) - rng.int(6, 16), 30, 90);
          st.songs.push({ title: `${p.title} (Part Two)`, quality: q, writer: 'p', kind: 'trend', genre: st.members[0].style, released: false });
          log(st, `"${p.title} (Part Two)" exists now (${q}). It has the same chords in a different order. Release it before anyone thinks too hard.`, 'neutral');
        },
      },
    ],
  },
  {
    // Three years of receipts in a shoebox, and a man from the Revenue with a lot of time.
    id: 'taxman_calls',
    weight: 3,
    where: 'home',
    when: (s) => (s.fans >= 100000 && s.money >= 200000 && s.flags.taxAudit === undefined && s.week >= 150 ? {} : null),
    title: () => 'The Revenue would like a word',
    text: (s) => `A letter with a crest. The Revenue has looked at three years of ${s.bandName}'s affairs and found a shoebox where the accounts should be. They have a figure. It is a large figure, and it has interest on it.`,
    options: (s) => {
      const bill = Math.round(s.money * 0.22);
      const nous = s.manager?.nous ?? 0;
      return [
        {
          label: `Pay it: £${bill.toLocaleString('en-GB')}`,
          hint: 'Over and done. The accountant gets a very short memo.',
          resolve: (st) => { st.flags.taxAudit = st.week; st.money -= bill; for (const m of st.members) adjust(m, 'mood', -4); log(st, `£${bill.toLocaleString('en-GB')} to the Revenue, with a letter that did not say sorry. The band has an accountant now, a real one, with a tie.`, 'bad'); },
        },
        {
          label: 'Fight it with lawyers and a manager who reads page nine',
          hint: `Odds ${Math.round((0.3 + nous / 150) * 100)}% of halving it. Lose, and it is the bill plus the lawyers.`,
          cost: 400,
          resolve: (st, rng) => {
            st.flags.taxAudit = st.week;
            if (rng.chance(0.3 + nous / 150)) { st.money -= Math.round(bill / 2); log(st, `Six months of letters, a hearing in a room with no windows, and the figure halved: £${Math.round(bill / 2).toLocaleString('en-GB')}. ${st.manager ? `${st.manager.name} sent flowers to the inspector.` : 'The lawyer sent flowers to himself.'}`, 'good'); }
            else { st.money -= Math.round(bill * 1.15); for (const m of st.members) adjust(m, 'mood', -6); log(st, `The hearing went badly, then worse. £${Math.round(bill * 1.15).toLocaleString('en-GB')}, lawyers included. The inspector was polite throughout, which somehow made it worse.`, 'bad'); }
          },
        },
        {
          label: 'Tax exile: a year abroad, no gigs at home',
          hint: 'The bill waits; the band leaves. Six months with no home gigs or UK tours. The papers call you unpatriotic in a font the size of a bus.',
          resolve: (st) => {
            st.flags.taxAudit = st.week;
            st.flags.exileUntil = st.week + 26;
            st.fans -= Math.round(st.fans * 0.06);
            for (const m of st.members) { adjust(m, 'mood', 3); adjust(m, 'habit', 4); }
            log(st, 'The band is "resident abroad for tax purposes", which means a villa, a boat, a lot of waiting and no gigs at home until the spring. The papers have a photograph of the villa. The Revenue has the address.', 'neutral');
          },
        },
      ];
    },
  },
];
