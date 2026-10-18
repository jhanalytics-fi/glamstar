// The Army: a fan club with a PO box, a newsletter and a mail-order catalogue. Fans pay to be fans.
import { earn, log } from './helpers';
import type { GameState } from './types';

export const CLUB_SHARE = 0.08;
export const CLUB_PER_WEEK = 0.15;

export function clubMembers(s: GameState): number {
  return s.flags.fanClub === undefined ? 0 : Math.round(s.fans * CLUB_SHARE * (s.flags.fanClubInHouse ? 1.25 : 1));
}

/** Subscriptions and the mail-order catalogue, per week. */
export function clubIncome(s: GameState): number {
  return Math.round(clubMembers(s) * CLUB_PER_WEEK);
}

export function fanClubWeek(s: GameState): void {
  const take = clubIncome(s);
  if (take <= 0) return;
  // Someone has to lick the stamps: whoever runs it keeps a cut until you bring it in-house.
  const cut = s.flags.fanClubInHouse ? 1 : 0.7;
  const net = Math.round(take * cut);
  s.money += net;
  earn(s, 'fanclub', net);
  if (s.week % 13 === 0) log(s, `Fan club quarter: ${clubMembers(s).toLocaleString('en-GB')} members, £${(net * 13).toLocaleString('en-GB')} in subscriptions and mail-order shirts.`, 'good');
}
