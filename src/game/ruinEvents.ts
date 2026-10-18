// Rock bottom. When the landlord is at the door there is always one more bad idea, and every one of them
// has a price that is not money. Everyone involved is an adult; the bedroom door stays shut.
import { clamp } from './rng';
import { available, addAffinity } from './chemistry';
import { addBuzz, adjust, earn, first, log, milestone, player } from './helpers';
import { LABELS, makeTerms } from './labels';
import { PRESS } from './names';
import type { EventDef } from './events';
import type { GameState } from './types';

/** How much Big Tony puts on the table: enough to clear the overdraft and eat for a bit. */
export function sharkLoan(s: GameState): number {
  return Math.round(Math.max(600, -s.money + 400 + s.fans * 0.1) / 50) * 50;
}
export const SHARK_VIG = 1.5;
export const SHARK_RATE = 1.03;
export const SHARK_PATIENCE = 12;
export const PATRON_WEEKS = 20;

export const RUIN_EVENTS: EventDef[] = [
  {
    id: 'last_chance',
    weight: 0,
    big: true,
    when: (s) => (s.flags.lastChanceOpen === 1 ? {} : null),
    title: () => 'The end of the road?',
    text: (s) => `The landlord is on the stairs with a locksmith, the bank has sent a letter in red and the van has a man from the finance company sitting in it. ${s.money < 0 ? `You are £${(-s.money).toLocaleString('en-GB')} in the red.` : 'There is nothing in the account.'} One more bad idea might get you through the month. Pick one.`,
    options: (s) => {
      const loan = sharkLoan(s);
      const sellable = s.gear > 0 || !s.flags.noVan;
      const shark = LABELS.filter((l) => l.tier === 'shark').find((l) => s.flags[`passed_${l.id}`] === undefined || s.week - s.flags[`passed_${l.id}`] >= 26);
      const canSign = !s.contract && !!shark;
      const sellValue = Math.max(350 + s.gear * 250 + (s.flags.noVan ? 0 : 250), -s.money + 200);
      return [
        {
          label: `Borrow £${loan.toLocaleString('en-GB')} from Big Tony`,
          hint: `No forms, no questions. £${Math.round(loan * SHARK_VIG).toLocaleString('en-GB')} owed, 3% a week on top, collected from everything that comes in. Tony's lads call round if it drags on.`,
          resolve: (st) => {
            st.flags.lastChanceOpen = 0;
            st.money += loan;
            earn(st, 'other', loan);
            st.flags.shark = Math.round(loan * SHARK_VIG);
            st.flags.sharkSince = st.week;
            milestone(st, 'drama', `Borrowed £${loan.toLocaleString('en-GB')} from a man called Big Tony.`);
            log(st, `Big Tony counted it out on the bonnet of a Jaguar. "Pay me when you're famous," he said, and laughed, and did not mean it. The landlord got his rent and a signed photo.`, 'neutral');
          },
        },
        {
          label: 'Move in with the admirer',
          hint: `There is someone with a house in Belgravia who has been at every gig. Rent gone, a weekly allowance, your dignity on a tab. The band will have opinions.`,
          resolve: (st, rng) => {
            st.flags.lastChanceOpen = 0;
            const who = rng.pick(['a Chelsea heiress with a Bentley and a lot of free afternoons', 'a shipping widow with a flat in Belgravia and a very understanding butler', 'a property developer with a hot tub, a wine cellar and a spouse in Marbella', 'a West End producer who calls everyone "darling" and means it']);
            st.money = Math.max(st.money, 0) + 300;
            earn(st, 'other', 300);
            st.flags.patron = st.week;
            st.flags.fling = st.week;
            const me = player(st);
            adjust(me, 'image', 3); adjust(me, 'mood', -4); adjust(me, 'habit', 4);
            for (const m of available(st)) if (!m.isPlayer) { addAffinity(st, m.id, me.id, -8); adjust(m, 'mood', -3); }
            addBuzz(st, 4);
            milestone(st, 'drama', `Moved in with ${who.split(' with ')[0]} to keep the band alive.`);
            log(st, `You moved in with ${who}. The overdraft vanished, the rent is "taken care of" and there is an allowance every Friday in an envelope. The band calls you "Lady Chatterley". ${PRESS} has not noticed yet.`, 'neutral');
          },
        },
        {
          label: 'Sell the van and the gear',
          hint: sellable ? `About £${sellValue.toLocaleString('en-GB')} from a man in Walthamstow. Borrowed amps and the bus from now on.` : 'Already sold. There is nothing left.',
          locked: sellable ? undefined : 'There is nothing left to sell.',
          resolve: (st) => {
            st.flags.lastChanceOpen = 0;
            st.money += sellValue;
            earn(st, 'other', sellValue);
            st.gear = 0; st.flags.noVan = 1;
            st.tightness = clamp(st.tightness - 5, 0, 100);
            for (const m of available(st)) adjust(m, 'mood', -6);
            log(st, `A man in Walthamstow gave you £${sellValue.toLocaleString('en-GB')} for the lot and did not look at any of it. The drummer kept his sticks. Everything else goes on the night bus now.`, 'bad');
          },
        },
        {
          label: canSign ? `Sign with ${shark!.name} tonight. Read nothing` : 'Sign with anyone',
          hint: canSign ? 'The advance clears the debt by Friday. The contract clears everything else by Christmas.' : s.contract ? 'You are already signed. That is the problem.' : 'Even the sharks have stopped calling.',
          locked: canSign ? undefined : s.contract ? 'Already signed.' : 'Nobody is offering.',
          resolve: (st, rng) => {
            st.flags.lastChanceOpen = 0;
            const l = shark!;
            const terms = makeTerms(st, l, rng);
            terms.smallPrint = { deductions: 0.45, tourRecoup: true, ownsName: true, promoRecoup: true };
            terms.rate = 0.08;
            terms.albums = 6;
            st.contract = { label: l.id, signed: st.week, terms, unrecouped: terms.advance, albumsDelivered: 0, owed: 0, reviewWeek: null, flops: 0, goodwill: 50, shaved: 0, statements: 0 };
            st.money += terms.advance;
            earn(st, 'advances', terms.advance);
            st.offers = [];
            addBuzz(st, 6);
            milestone(st, 'career', `Signed to ${l.name} at midnight, unread, to keep the lights on.`);
            log(st, `${l.name} sent a car. The contract was signed on the back seat by the light of a cigarette lighter. £${terms.advance.toLocaleString('en-GB')} in cash. Six albums, eight per cent, they own the name, and the small print says the small print is binding.`, 'neutral');
          },
        },
        {
          label: 'Play every dive in London, six nights a week, for a month',
          hint: 'Cash in hand, the band on its knees, and nothing written for a month.',
          resolve: (st, rng) => {
            st.flags.lastChanceOpen = 0;
            const take = Math.max(Math.min(2500, Math.round(4 * (90 + st.fans * 0.12))), -st.money + 250);
            st.money += take;
            earn(st, 'gigs', take);
            for (const m of available(st)) { adjust(m, 'energy', -40); adjust(m, 'mood', -10); adjust(m, 'habit', Math.round(m.hidden.vice / 15)); }
            st.tightness = clamp(st.tightness + 5, 0, 100);
            st.fans += Math.round(20 + st.fans * 0.02);
            st.lastGigWeek = st.week;
            const w = rng.pick(available(st));
            log(st, `Twenty-four nights in a row: pubs, basements, a wedding, a bar mitzvah, a strip club in Soho where ${first(w)} ${w.isPlayer ? 'were' : 'was'} the only one watching the band. £${take.toLocaleString('en-GB')} in a shoebox. Nobody has slept.`, 'neutral');
          },
        },
      ];
    },
  },
  {
    id: 'shark_heavies',
    weight: 0,
    big: true,
    when: (s) => (s.flags.heaviesOpen === 1 ? {} : null),
    title: () => "Big Tony's lads",
    text: (s) => `Two men in sheepskin coats are in the rehearsal room, sitting on the bass amp. They do not want tea. Tony is "disappointed". £${(s.flags.shark ?? 0).toLocaleString('en-GB')} is still owed and the lads have a list of things that could happen, in order.`,
    options: (s) => {
      const debt = s.flags.shark ?? 0;
      return [
        {
          label: `Pay the lot: £${debt.toLocaleString('en-GB')}`,
          hint: 'The clean way out.',
          locked: s.money < debt ? `You have £${s.money.toLocaleString('en-GB')}.` : undefined,
          resolve: (st) => {
            st.flags.heaviesOpen = 0;
            st.money -= debt; st.flags.shark = 0;
            milestone(st, 'drama', 'Paid Big Tony off in full.');
            log(st, 'Counted out on the bass amp. The lads shook everyone\'s hand, politely, and took the biscuits.', 'good');
          },
        },
        {
          label: 'Hand over the gear and the van',
          hint: s.gear > 0 || !s.flags.noVan ? 'Knocks a chunk off. The band plays borrowed amps.' : 'They have already had it.',
          locked: s.gear > 0 || !s.flags.noVan ? undefined : 'Nothing left to hand over.',
          resolve: (st) => {
            st.flags.heaviesOpen = 0;
            const worth = 400 + st.gear * 300 + (st.flags.noVan ? 0 : 300);
            st.gear = 0; st.flags.noVan = 1;
            st.flags.shark = Math.max(0, (st.flags.shark ?? 0) - worth);
            st.flags.sharkSince = st.week;
            st.tightness = clamp(st.tightness - 5, 0, 100);
            log(st, `The lads loaded the van with the gear and drove the van away. £${worth.toLocaleString('en-GB')} off the slate, Tony says. ${st.flags.shark ? `£${st.flags.shark.toLocaleString('en-GB')} to go.` : 'Square.'}`, 'bad');
          },
        },
        {
          label: 'Take the beating and buy a month',
          hint: 'Two weeks in bed, a scar the fans love, and Tony waits.',
          resolve: (st) => {
            st.flags.heaviesOpen = 0;
            const me = player(st);
            me.outWeeks = Math.max(me.outWeeks, 2);
            adjust(me, 'mood', -20); adjust(me, 'image', 3);
            st.flags.sharkSince = st.week;
            addBuzz(st, 6);
            for (const m of available(st)) if (!m.isPlayer) addAffinity(st, m.id, me.id, 5);
            milestone(st, 'drama', "Took a beating from Big Tony's lads so the band could carry on.");
            log(st, `They were professional about it. Two weeks in bed, a cracked rib, and ${PRESS} ran a photo of the stitches under "ROCK AND BRAWL". The band brought grapes and did not say much.`, 'bad');
          },
        },
        {
          label: 'Do a job for Tony instead',
          hint: 'A package, a van, a man in Dover. Half the debt gone if it goes right.',
          resolve: (st, rng) => {
            st.flags.heaviesOpen = 0;
            const mates = available(st).filter((m) => !m.isPlayer);
            const x = mates.length ? rng.pick(mates) : player(st);
            if (rng.chance(0.55)) {
              st.flags.shark = Math.round((st.flags.shark ?? 0) / 2);
              st.flags.sharkSince = st.week;
              adjust(x, 'habit', 6); adjust(x, 'mood', -6);
              log(st, `${first(x)} drove a package to Dover and asked no questions, which Tony respected. Half the slate wiped. ${first(x)} has not slept properly since.`, 'neutral');
            } else {
              x.outWeeks = Math.max(x.outWeeks, 2);
              adjust(x, 'mood', -25);
              st.flags.sharkSince = st.week;
              addBuzz(st, 5);
              milestone(st, 'drama', `${first(x)} was arrested in Dover with a package belonging to Big Tony.`);
              log(st, `${first(x)} was stopped at Dover with the package. Two weeks on remand, a suspended sentence and a photo in ${PRESS}. Tony says the debt stands and "no hard feelings". There are hard feelings.`, 'bad');
            }
          },
        },
      ];
    },
  },
];

/** Once a week: Tony collects, the admirer pays, and patience runs out. Returns a game-over reason, or null. */
export function ruinWeek(s: GameState, rng: { chance: (p: number) => boolean }): string | null {
  if (s.flags.patron !== undefined) {
    const weeks = s.week - s.flags.patron;
    if (weeks >= PATRON_WEEKS || (weeks >= 8 && rng.chance(0.08))) {
      delete s.flags.patron;
      adjust(player(s), 'mood', 6);
      log(s, 'The admirer has found a poet. Your bags were on the pavement in Belgravia by nine, with a cheque and a note: "Darling, it was never about the music." The band threw a party.', 'neutral');
      s.money += 200;
      earn(s, 'other', 200);
    } else {
      const stipend = Math.round(60 + s.fans * 0.02);
      s.money += stipend;
      earn(s, 'other', stipend);
      adjust(player(s), 'mood', -1);
    }
  }
  const debt = s.flags.shark ?? 0;
  if (debt > 0) {
    const take = Math.min(debt, Math.max(0, Math.round((s.money - 50) * 0.5)));
    if (take > 0) { s.money -= take; }
    const rest = Math.max(0, Math.round((debt - take) * SHARK_RATE));
    s.flags.shark = rest;
    if (take > 0) log(s, `Big Tony's collector took £${take.toLocaleString('en-GB')}. ${rest ? `£${rest.toLocaleString('en-GB')} to go, and growing.` : 'Square, and he said so twice.'}`, rest ? 'neutral' : 'good');
    if (rest === 0) { delete s.flags.sharkSince; milestone(s, 'drama', 'Paid Big Tony off.'); }
    else if (s.week - (s.flags.sharkSince ?? s.week) >= SHARK_PATIENCE && !s.pending && !s.tour) {
      if (s.flags.heaviesCount && s.flags.heaviesCount >= 2) return 'Big Tony stopped sending lads and sent a lorry. Everything went, including the name. The band is over.';
      s.flags.heaviesCount = (s.flags.heaviesCount ?? 0) + 1;
      s.flags.heaviesOpen = 1;
      s.pending = { def: 'shark_heavies', params: {}, week: s.week };
    }
  }
  return null;
}
