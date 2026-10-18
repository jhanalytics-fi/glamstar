// Once a year, in the dead week before Christmas, the trade and the readers hand out their gongs.
// Nobody takes them seriously. Everybody keeps them.
import { Rng } from './rng';
import { addBuzz, adjust, log, milestone } from './helpers';
import { PRESS } from './names';
import type { GameState } from './types';

export const AWARDS_WEEK = 50;
const POLL = `${PRESS} Readers' Poll`;
const TRADE = 'The Phonographic Trade Awards';

/** Awards the band is in the running for this year, given the year it has had. */
export function contenders(s: GameState): { title: string; from: string; odds: number }[] {
  const y0 = s.week - (s.week % 52);
  const year = 1982 + Math.floor(s.week / 52);
  const out: { title: string; from: string; odds: number }[] = [];
  const thisYear = s.releases.filter((r) => r.week >= y0 && r.kind !== 'demo' && !r.comp);
  const bestSingle = thisYear.filter((r) => r.kind === 'single').sort((a, b) => (a.peaks?.uk ?? 99) - (b.peaks?.uk ?? 99))[0];
  const bestAlbum = thisYear.filter((r) => r.kind === 'album').sort((a, b) => (a.peaks?.albums ?? 99) - (b.peaks?.albums ?? 99))[0];
  const firstYear = s.releases.some((r) => r.week >= y0 && r.kind !== 'demo') && !s.releases.some((r) => r.week < y0 && r.kind !== 'demo');
  if (firstYear && s.fans >= 1500) out.push({ title: 'Best New Band', from: POLL, odds: Math.min(0.7, 0.25 + s.fans / 20000) });
  if (bestSingle && (bestSingle.peaks?.uk ?? 99) <= 10) out.push({ title: `Single of the Year, "${bestSingle.title}"`, from: POLL, odds: bestSingle.peaks!.uk === 1 ? 0.6 : 0.3 });
  if (bestAlbum && (bestAlbum.peaks?.albums ?? 99) <= 10) out.push({ title: `Album of the Year, "${bestAlbum.title}"`, from: TRADE, odds: bestAlbum.peaks!.albums === 1 ? 0.55 : 0.25 });
  const legends = (s.flags.legendaryGigs ?? 0) - (s.flags.legendsAtYearStart ?? 0);
  if (legends > 0 || (s.tours ?? []).some((t) => t.start >= y0 && t.people >= 50000)) out.push({ title: 'Best Live Act', from: POLL, odds: 0.3 + legends * 0.15 });
  const look = s.members.reduce((a, m) => a + m.image, 0) / Math.max(1, s.members.length);
  if (s.fans >= 5000 && look >= 70) out.push({ title: 'Best Dressed Band', from: POLL, odds: 0.35 });
  if (s.fans >= 5000 && look <= 40) out.push({ title: 'Worst Dressed Band', from: POLL, odds: 0.4 });
  if (s.fans >= 20000 && thisYear.some((r) => r.sold >= 100000)) out.push({ title: `Export Achievement ${year}`, from: TRADE, odds: 0.3 });
  const fling = s.flags.polaroids !== undefined && s.flags.polaroids >= y0;
  if (fling || (s.flags.hotelRaid !== undefined && s.flags.hotelRaid >= y0)) out.push({ title: 'Scandal of the Year', from: POLL, odds: 0.5 });
  return out;
}

export function awardsNight(s: GameState, rng: Rng): void {
  if (s.week % 52 !== AWARDS_WEEK || s.over) return;
  const year = 1982 + Math.floor(s.week / 52);
  const won: string[] = [];
  const lost: string[] = [];
  for (const c of contenders(s)) {
    if (rng.chance(c.odds)) {
      won.push(c.title);
      (s.awards ??= []).push({ year, title: c.title, from: c.from });
    } else lost.push(c.title);
  }
  s.flags.legendsAtYearStart = s.flags.legendaryGigs ?? 0;
  if (!won.length && !lost.length) return;
  if (won.length) {
    addBuzz(s, 4 + won.length * 4);
    for (const m of s.members) { adjust(m, 'mood', 6); adjust(m, 'image', 1); }
    const bad = won.some((w) => w.startsWith('Worst') || w.startsWith('Scandal'));
    milestone(s, 'career', `Won ${won.join(', ')} (${year}).`);
    log(s, `Awards night. ${s.bandName} won ${won.join(' and ')}. ${bad ? 'The speech was not broadcast. The after-party was.' : rng.pick(['The drummer thanked his mum, twice.', 'The trophy was left in a taxi by midnight.', 'The speech was eleven seconds long and mostly swearing.'])}`, 'good');
  } else {
    for (const m of s.members) adjust(m, 'mood', -3);
    log(s, `Awards night. Nominated for ${lost.join(' and ')}, won nothing. The free bar was the consolation prize.`, 'neutral');
  }
}
