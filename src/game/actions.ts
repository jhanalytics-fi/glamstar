// The weekly actions and the choices inside each one.
import { Rng, clamp } from './rng';
import { mourningBoost } from './death';
import { GENRES, GENRE_LABEL, HIDDEN_TRAITS, ROLE_LABEL, generateMusician, getToKnow, overall, reveal, type Tier } from './characters';
import { addAffinity, available, chemistry, forEachPair, getAffinity, missingForGig, performance } from './chemistry';
import { PRESS, PRESS_BAD, PRESS_GOOD, VENUES, songTitle } from './names';
import { addBuzz, adjust, beat, earn, first, grow, headline, log, merchTake, milestone, player, prospects, revealLog, signed, subj, verdict as setVerdict, wobble } from './helpers';
import { hotGenres, trend } from './world';
import { weeklyOffers } from './offers';
import { POLICY_HINT, POLICY_LABEL, abandonTour, playTourWeek, startTour, tierById, tierLocked, visibleTiers } from './tour';
import { advertCommentary, gigCommentary, partyCommentary, rehearsalCommentary, releaseCommentary, restCommentary, writingCommentary } from './commentary';
import type { TourPolicy } from './types';
import { labelById, labelRelease, labelSales, tagRelease } from './labels';
import { commission, feeBoost, nousSaving } from './managers';
import { bigShowLocked, bigShowsFor } from './bigShows';
import { bestHome, homeRest, owned, toySpec } from './toys';
import { takeProducer } from './moneyEvents';
import { WHEELS, wheelsOf } from './wheels';
import { KIT_WORD, bandKit, kitGain, wearKit } from './kit';
import { callDeps, canDep, covered } from './subs';
import { STUDIOS, studioOf } from './studio';
import { applyLegend, gigFate, masterpieceOdds, masterpiecePress, strikeMasterpiece } from './fate';
import type { Action, ActionType, GameState, Genre, IncomeKind, Musician, Release, ReleaseKind, Role, Song, SongKind } from './types';

export interface ActionOption {
  id: string;
  label: string;
  /** Money it costs up front. */
  cost: number;
  hint: string;
  /** Why it can't be picked right now. */
  locked?: string;
}

export const ACTION_LABEL: Record<ActionType, string> = {
  gig: 'Play a gig',
  rehearse: 'Rehearse',
  write: 'Write songs',
  release: 'Release a record',
  party: 'Party',
  rest: 'Rest',
  advertise: 'Find a musician',
  tour: 'Go on tour',
};

// ---------------------------------------------------------------- option lists

interface GigSpec {
  venue: string;
  capacity: number;
  fee: number;
  /** Share of the door you keep. */
  door: number;
  cost: number;
  fanMult: number;
  energyMult: number;
  buzzBonus: number;
  crowd: (s: GameState, rng: Rng) => number;
  /** One-off bookings have their own aftermath. */
  after?: (s: GameState, rng: Rng, perf: number, crowd: number) => void;
  /** A crowd that is not yours: the floor under the novelty factor, so a festival field still makes fans. */
  fresh?: number;
  /** Merch per head, relative: nobody carries money on a beach. */
  merchMult?: number;
}

/** Album tracks that could still be lifted as singles: from the latest album, under a year old, best first. */
function liftOption(s: GameState, cost: number): ActionOption[] {
  const songs = liftable(s);
  if (!songs.length) return [];
  const n = s.songs.filter((x) => x.album === songs[0].album && x.lifted).length;
  return [{ id: 'lift', label: `Lift "${songs[0].title}" from the album as a single`, cost, hint: `${n ? `Single ${n + 1} from the album. ` : ''}No new songs needed: the album track, a B-side and a sleeve.` }];
}

/** Appeal multiplier for the (n+1)th single lifted from one album: the first two sell, the rest are for the fans. */
export const liftFatigue = (n: number) => Math.pow(0.72, Math.max(0, n - 1));

export function liftable(s: GameState): Song[] {
  const album = [...s.releases].reverse().find((r) => r.kind === 'album' && s.week - r.week <= 52);
  if (!album) return [];
  return s.songs.filter((x) => x.album === album.id && !x.lifted).sort((x, y) => y.quality - x.quality);
}

/** Rock-star spending: options that only appear once the bank balance earns them. */
function luxury(s: GameState, opts: { id: string; label: string; cost: number; unlock: number; hint: string }[]): ActionOption[] {
  // Each one shows up as a tease at half its threshold, and opens once the bank balance earns it.
  return opts
    .filter((o) => s.money >= o.unlock / 2)
    .map((o) => ({ id: o.id, label: o.label, cost: o.cost, hint: o.hint, locked: s.money < o.unlock ? `Needs £${o.unlock.toLocaleString('en-GB')} in the bank. Rock stars only.` : undefined }));
}

function supportAct(s: GameState): { name: string; fans: number } | null {
  const top = s.world.charts.london.filter((e) => !e.isPlayer && e.pos <= 10);
  if (!top.length) return null;
  const e = top[s.week % top.length];
  const r = s.world.rivals.find((x) => x.id === e.id);
  return r ? { name: r.name, fans: r.fans } : null;
}

function baseCrowd(s: GameState, rng: Rng): number {
  return Math.round(s.fans * 0.5 + 12 + s.buzz * 0.8 + rng.int(-8, 10));
}

function gigSpecs(s: GameState): Record<string, GigSpec> {
  const specs: Record<string, GigSpec> = {
    ...Object.fromEntries(
      weeklyOffers(s).map((o) => [
        `offer_${o.id}`,
        {
          venue: o.venue, capacity: o.capacity, fee: o.fee, door: 0, cost: 0, fanMult: o.fanMult, energyMult: o.energyMult, buzzBonus: o.buzzBonus,
          crowd: (_st: GameState, rng: Rng) => rng.int(o.crowd[0], o.crowd[1]),
          after: o.after,
        } satisfies GigSpec,
      ]),
    ),
    openmic: famous(s) ? {
      venue: 'a secret gig at The Crown & Gutter',
      capacity: 80, fee: 0, door: 0, cost: 0, fanMult: 0.2, energyMult: 0.6, buzzBonus: 12,
      crowd: () => 80,
    } : {
      venue: 'open mic night at The Crown & Gutter',
      capacity: 45, fee: 0, door: 0, cost: 0, fanMult: 0.6, energyMult: 0.6, buzzBonus: 0,
      crowd: (st, rng) => Math.round(18 + st.fans * 0.2 + rng.int(-5, 8)),
    },
  };
  VENUES.forEach((v, i) => {
    specs[`venue${i}`] = {
      venue: v.name, capacity: v.capacity, fee: v.fee, door: 0.6, cost: 0, fanMult: 1, energyMult: 1, buzzBonus: i * 0.5,
      crowd: baseCrowd,
    };
  });
  const sup = supportAct(s);
  if (sup) {
    specs.support = {
      venue: `support slot for ${sup.name}`, capacity: 600, fee: 15, door: 0, cost: 0, fanMult: 1.3, energyMult: 0.9, buzzBonus: 1,
      crowd: (st, rng) => Math.round(sup.fans * 0.35 + st.fans * 0.3 + rng.int(-10, 10)),
    };
  }
  for (const b of bigShowsFor(s)) {
    specs[`big_${b.id}`] = {
      venue: b.venue, capacity: b.capacity, fee: b.fee, door: b.door, cost: 0, fanMult: b.fanMult, energyMult: b.energyMult, buzzBonus: b.buzzBonus,
      crowd: b.crowd, fresh: 0.5, merchMult: b.merchMult,
      after: (st, rng, perf, crowd) => { st.flags[`big_${b.id}`] = st.week; b.after?.(st, rng, perf, crowd); },
    };
  }
  specs.paytoplay = {
    venue: 'The Velvet Cellar, Soho (pay to play)', capacity: 300, fee: 0, door: 0, cost: 60, fanMult: 1, energyMult: 1, buzzBonus: 4,
    crowd: (st, rng) => baseCrowd(st, rng) + 35,
  };
  return specs;
}

/** The weakest player present, by what you can see of them. */
function lessonTarget(s: GameState): Musician | null {
  const here = available(s);
  return here.length ? [...here].sort((a, b) => overall(a) - overall(b))[0] : null;
}

/**
 * Where songs come from. A rested, happy band in the zone writes better; so, for a while, does a
 * band running on chemicals. Past that it is just noise and missed sessions.
 */
export function inspiration(s: GameState): { bonus: number; text: string; label: string } {
  const here = available(s);
  if (!here.length) return { bonus: 0, text: '', label: '' };
  const avg = (k: 'mood' | 'energy' | 'habit') => here.reduce((a, m) => a + m[k], 0) / here.length;
  const mood = avg('mood'), energy = avg('energy'), habit = avg('habit');
  let bonus = ((mood - 55) / 45) * 5 + ((energy - 55) / 45) * 3;
  let text = '';
  if (habit >= 35 && habit < 65) { bonus += 4; text = 'The band is writing on something stronger than tea. The ideas come fast and strange.'; }
  else if (habit >= 65) { bonus -= 7; text = 'Half the band is too far gone to finish a verse. The tape is mostly giggling.'; }
  if (mood >= 70 && energy >= 70 && habit < 35) text = 'Rested, happy and sharp: the band is in the zone.';
  else if (mood < 35 || energy < 30) text = text || 'Tired and miserable. The songs come out that way too.';
  const label = bonus >= 5 ? 'Inspired' : bonus >= 1 ? 'In decent shape' : bonus > -3 ? 'Flat' : 'Running on fumes';
  return { bonus: Math.round(bonus), text, label };
}

/** A big band does not play the back room of a pub, or drink cans in the rehearsal room. Mostly. */
export const famous = (s: GameState) => s.fans >= 20000;
export const loaded = (s: GameState) => s.money >= 100000;

export function actionOptions(s: GameState, type: ActionType): ActionOption[] {
  const opts = rawOptions(s, type);
  for (const o of opts) if (!o.locked && o.cost > 0 && s.money < o.cost) o.locked = `Costs £${o.cost}. You have £${s.money}.`;
  return opts;
}

function rawOptions(s: GameState, type: ActionType): ActionOption[] {
  const unreleased = s.songs.filter((x) => !x.released).length;
  if (s.tour && type !== 'tour') return [];
  switch (type) {
    case 'tour': {
      if (s.tour) {
        return [
          ...(['wild', 'steady', 'clean'] as const).map((p) => ({ id: `continue:${p}`, label: `Next week: ${POLICY_LABEL[p].toLowerCase()}`, cost: 0, hint: POLICY_HINT[p] })),
          { id: 'abandon', label: 'Abandon the tour', cost: 0, hint: 'Go home now. Cancellation fees, angry promoters, lost fans.' },
        ];
      }
      const miss = missingForGig(s);
      return visibleTiers(s).map((t) => ({
        id: t.id,
        label: t.name,
        cost: 0,
        hint: `${t.minWeeks}-${t.maxWeeks} weeks, ${t.gigsPerWeek} gigs a week, ${t.capacity[0].toLocaleString('en-GB')}-${t.capacity[1].toLocaleString('en-GB')} capacity. Road costs about £${t.weeklyCost.toLocaleString('en-GB')} a week.`,
        locked: miss.length ? `You need ${miss.join(' and ')} to tour.` : tierLocked(s, t) ?? (s.money < t.weeklyCost ? `You need £${t.weeklyCost.toLocaleString('en-GB')} to get on the road. You have £${s.money}.` : undefined),
      }));
    }
    case 'gig': {
      const big = famous(s);
      const opts: ActionOption[] = big
        ? [{ id: 'openmic', label: 'Secret gig at the Crown & Gutter, under a false name', cost: 0, hint: 'For old times\' sake. Forty people, a leaked rumour, the papers go mad.' }]
        : [
          { id: 'openmic', label: 'Open mic night', cost: 0, hint: 'No pay. Small crowd, low pressure, easy on the legs.' },
          ...weeklyOffers(s).map((o) => ({ id: `offer_${o.id}`, label: `This week only: ${o.label}`, cost: 0, hint: `£${o.fee}. ${o.hint}` })),
        ];
      VENUES.forEach((v, i) => {
        if (big && i < VENUES.length - 2) return;
        if (s.fans >= v.minFans) {
          opts.push({ id: `venue${i}`, label: `Headline ${v.name}`, cost: 0, hint: `Up to ${v.capacity} people. £${v.fee} plus a cut of the door.` });
        } else if (i > 0 && s.fans >= VENUES[i - 1].minFans) {
          opts.push({ id: `venue${i}`, label: `Headline ${v.name}`, cost: 0, hint: `Up to ${v.capacity} people.`, locked: `The promoter wants ${v.minFans} fans. You have ${s.fans}.` });
        }
      });
      const sup = big ? null : supportAct(s);
      if (sup) {
        opts.push({
          id: 'support', label: `Support ${sup.name}`, cost: 0, hint: 'Their crowd, not yours. £15 fee and a chance to steal some fans.',
          locked: s.fans < 40 ? 'Their manager has never heard of you. Get 40 fans first.' : undefined,
        });
      }
      if (!big) opts.push({ id: 'paytoplay', label: 'Pay to play at The Velvet Cellar', cost: 60, hint: 'You keep nothing. A proper Soho stage looks good.' });
      for (const b of bigShowsFor(s)) {
        const why = bigShowLocked(s, b);
        opts.push({ id: `big_${b.id}`, label: b.label, cost: b.cost, hint: `${b.hint}${b.fee ? ` £${b.fee.toLocaleString('en-GB')}${b.door ? ' plus a cut of the door' : ''}.` : ''}`, locked: why ?? undefined });
      }
      const miss = missingForGig(s);
      if (miss.length) for (const o of opts) o.locked = `You need ${miss.join(' and ')} to gig.`;
      return opts;
    }
    case 'rehearse':
      return [
        { id: 'regular', label: 'Usual rehearsal', cost: 0, hint: 'Steady progress. Egos may collide.' },
        { id: 'bootcamp', label: 'Boot camp week, no booze', cost: 0, hint: 'Much tighter and drier. Morale suffers.' },
        { id: 'coach', label: 'Hire a session pro to coach you', cost: 60, hint: 'Everyone plays better. Some will resent being taught.' },
        { id: 'stageshow', label: 'Work on the stage show', cost: 35, hint: 'Moves, poses and a smoke machine. Stage presence up, past the natural ceiling too, slowly.' },
        { id: 'lessons', label: `Private lessons for ${lessonTarget(s) ? (lessonTarget(s)!.isPlayer ? 'yourself' : first(lessonTarget(s)!)) : 'the weakest player'}`, cost: 40, hint: 'Your weakest link gets a teacher. Proud players may take it badly.' },
        { id: 'shop', label: shopLabel(s), cost: shopCost(s), hint: `Everyone's kit is ${KIT_WORD(bandKit(s))} (${bandKit(s)}). A day in the music shops: better instruments for the whole band, and a morale boost.` },
      ];
    case 'write': {
      const hot = hotGenres(s.week)[0];
      const insp = inspiration(s);
      const mood = insp.label ? ` Band: ${insp.label.toLowerCase()} (${insp.bonus >= 0 ? '+' : ''}${insp.bonus}).` : '';
      return [
        { id: 'jam', label: 'Jam it out together', cost: 0, hint: `Best writers lead. Good for the band, may produce nothing.${mood}` },
        { id: 'solo', label: 'Write it yourself', cost: 0, hint: 'Alone in the flat, door shut. Your song, your way; the others may sulk. The one comes most often this way.' },
        { id: 'trend', label: `Chase the trend: ${GENRE_LABEL[hot].toLowerCase()}`, cost: 0, hint: 'Sells better right now. Purists in the band will hate it.' },
        { id: 'ballad', label: 'Write a power ballad', cost: 0, hint: 'Hit or embarrassment. Lighters up, credibility down.' },
        { id: 'cover', label: 'Work up a cover of an old hit', cost: 0, hint: 'A sure thing, if a borrowed one. The publishing goes to whoever wrote it.' },
        ...(s.contract ? [{ id: 'publisher', label: `Listen to the tapes ${labelById(s.contract.label).name}'s publishers keep sending`, cost: 0, hint: 'A song by a proper songwriter, free, and not yours. The label is thrilled; your writers are not.' }] : []),
        ...(s.fans >= 2000 || s.money >= hiredFee(s) * 2 ? [{ id: 'hired', label: 'Bring in a hit songwriter', cost: hiredFee(s), hint: `A week with someone who has written for everybody. Big song, big ego bruise, publishing split.` }] : []),
        ...(s.money >= retreatCost(s) ? [{ id: 'retreat', label: 'Rent a house in the country', cost: retreatCost(s), hint: 'Two or three songs, a rested band, and a farmer who wants a word about the noise.' }] : []),
        ...(s.studio ? [{ id: 'studioWeek', label: `A week in ${STUDIOS[s.studio].name.toLowerCase()}`, cost: 0, hint: `Your own desk, your own hours. Songs come out ${STUDIOS[s.studio].writing} better, and the tape is rolling when the good take happens.` }] : []),
        {
          id: 'direction',
          label: 'Change direction',
          cost: 0,
          hint: `Pick the new sound above. Some fans walk, the press talks, the purists in the band sulk. A week spent arguing, not writing. Selling right now: ${hotGenres(s.week).slice(0, 2).map((g) => GENRE_LABEL[g].toLowerCase()).join(' and ')}.`,
          locked: s.flags.direction !== undefined && s.week - s.flags.direction < 26 ? 'You changed direction less than six months ago. Let it settle.' : undefined,
        },
      ];
    }
    case 'release': {
      const need = (n: number) => (unreleased < n ? `Needs ${n} unreleased songs. You have ${unreleased}.` : undefined);
      if (s.contract) {
        const l = labelById(s.contract.label);
        const t = s.contract.terms;
        const bill = (share: number) => `£${Math.round(t.budget * share).toLocaleString('en-GB')} on the label's tab`;
        return [
          { id: 'demo', label: 'Demo tape on a four-track', cost: 30, hint: 'For the merch table. The label does not care.', locked: s.songs.length < 3 ? `Needs 3 songs. You have ${s.songs.length}.` : undefined },
          { id: 'single', label: `Single on ${l.name}`, cost: 0, hint: `Proper studio, proper promotion. ${bill(0.15)}.`, locked: need(2) },
          { id: 'ep', label: `EP on ${l.name}`, cost: 0, hint: `Four songs, label muscle. ${bill(0.35)}.`, locked: need(4) },
          { id: 'album', label: `Album on ${l.name}`, cost: 0, hint: `${s.contract.albumsDelivered + 1} of ${t.albums} owed. ${bill(1)}. They will judge it on sales.${producerNote(s)}`, locked: need(8) },
          ...liftOption(s, 0),
        ];
      }
      return [
        { id: 'demo', label: 'Demo tape on a four-track', cost: 30, hint: 'Sell tapes at gigs, send one to the radio.', locked: s.songs.length < 3 ? `Needs 3 songs. You have ${s.songs.length}.` : undefined },
        { id: 'single', label: 'Self-financed 7" single', cost: selfCost(s, 300), hint: `A real record in real shops. Can chart if enough people buy it.${studioNote(s)}`, locked: need(2) },
        { id: 'ep', label: 'Self-financed 12" EP', cost: selfCost(s, 650), hint: `Four songs. Sells slower, earns more per copy.${studioNote(s)}`, locked: need(4) },
        { id: 'album', label: 'Self-financed album', cost: selfCost(s, 1500), hint: `Eight songs. Huge risk without a label behind you.${producerNote(s)}${studioNote(s)}`, locked: need(8) },
        ...liftOption(s, 150),
      ];
    }
    case 'party':
      return [
        ...(loaded(s) ? [] : [
          { id: 'cans', label: 'Cans in the rehearsal room', cost: 5, hint: 'Cheap, cheerful, nobody gets hurt. Probably.' },
          { id: 'squat', label: 'Party at the squat', cost: 15, hint: 'Good for morale, bad for livers.' },
        ]),
        { id: 'soho', label: 'Night out in the Soho clubs', cost: 40, hint: 'Be seen with the right people. Easy to lose the plot.' },
        { id: 'throw', label: 'Throw your own party', cost: 90, hint: 'Everyone will talk about it. Neighbours may call the police.' },
        ...luxury(s, [
          { id: 'penthouse', label: 'Hire a Mayfair penthouse for the weekend', cost: 1500, unlock: 4000, hint: 'Models, a DJ, a chef and a very long guest list. The press will be there.' },
          { id: 'yacht', label: 'Charter a yacht on the Riviera', cost: 6000, unlock: 20000, hint: 'A week of champagne at sea. Legendary, expensive, and someone always falls in.' },
        ]),
      ];
    case 'rest':
      return [
        { id: 'sleep', label: 'Sleep it off', cost: 0, hint: 'Energy back, a little drier.' },
        { id: 'seaside', label: 'Day trip to Brighton', cost: 25, hint: 'Chips, sea air and band bonding.' },
        { id: 'dry', label: 'Lock the drinks cupboard', cost: 0, hint: 'Habits drop fast. Withdrawal is grim.' },
        { id: 'mum', label: famous(s) ? "Everyone goes home to their mum's, in a limo" : "Everyone goes home to their mum's", cost: 0, hint: famous(s) ? 'Sunday roast, clean laundry, the neighbours at the window. Mum still gives you a fiver.' : 'Full recovery and a fiver each. The scene forgets you a bit.' },
        ...(s.members.some((m) => m.habit >= 25) ? [{ id: 'clinic', label: 'A fortnight in a drying-out clinic', cost: clinicFee(s), hint: 'Doctors, locked doors, group sessions. Habits cut hard, moods take a knock.' }] : []),
        ...(s.members.some((m) => m.habit >= 25 && !m.isPlayer) ? [{ id: 'clinicOne', label: 'Send one member to the clinic', cost: Math.round(clinicFee(s) / 3), hint: `Pick who above. Two weeks away, habit cut hard; the band carries on${canDep(s) ? ' with a dep' : ', without gigs'}.` }] : []),
        { id: 'yogi', label: 'A weekend with a yogi in Totnes', cost: 120, hint: 'Breathing, lentils, a man called Ravi. Calmer heads, smaller egos.' },
        ...luxury(s, [
          { id: 'shrink', label: 'A Harley Street psychiatrist for everyone', cost: 900, unlock: 3000, hint: 'Six sessions each. Moods mended, egos examined, secrets out.' },
          { id: 'spa', label: 'A week at a country spa hotel', cost: 600, unlock: 2000, hint: 'Massages, mud and no minibar. Energy, mood and a clear head.' },
          { id: 'sanatorium', label: 'A month at a Swiss sanatorium', cost: sanatoriumFee(s), unlock: sanatoriumFee(s) * 2, hint: 'Clean mountain air, a famous doctor, no visitors. Habits gone, and a body that can take more next time.' },
          { id: 'bahamas', label: 'Fly the band to the Bahamas', cost: 3000, unlock: 10000, hint: 'Two weeks of sun, sea and nothing. The band comes back new. Costs a fortune.' },
          { id: 'retreat', label: 'Rent a villa in Ibiza for the writing', cost: 9000, unlock: 40000, hint: 'Sun, a pool and a grand piano. The band comes back rested, closer and with songs.' },
        ]),
      ];
    case 'advertise':
      return [
        { id: 'newsagent', label: "Card in the newsagent's window", cost: 0, hint: 'Two hopefuls, mostly hopeless.' },
        { id: 'classified', label: `Classified ad in ${PRESS}`, cost: 12, hint: 'Three hopefuls. Your current player may see it.' },
        { id: 'bar', label: 'Ask around at the Rat Pit bar', cost: 10, hint: 'Two players, better odds, a sore head.' },
        {
          id: 'poach', label: 'Poach from a rival band', cost: 50, hint: 'One good player, guaranteed. Loyalty not included.',
          locked: s.fans < 150 ? `Nobody leaves a band for one with ${s.fans} fans. Get 150.` : undefined,
        },
      ];
  }
}

export function optionLocked(s: GameState, a: Action): string | null {
  const o = actionOptions(s, a.type).find((x) => x.id === a.option);
  if (!o) return 'That option is not available.';
  return o.locked ?? null;
}

// ---------------------------------------------------------------- performing

export function perform(s: GameState, rng: Rng, a: Action): void {
  const opt = actionOptions(s, a.type).find((x) => x.id === a.option)!;
  s.money -= opt.cost;
  if (available(s).length === 0 && ['write', 'rehearse', 'release', 'party'].includes(a.type)) {
    log(s, 'Everyone is in hospital, in the clinic or missing. The week goes nowhere.', 'bad');
    return;
  }
  switch (a.type) {
    case 'gig': return gig(s, rng, gigSpecs(s)[a.option]);
    case 'rehearse': return rehearse(s, rng, a.option);
    case 'write': return write(s, rng, a.option, a.genre);
    case 'release': return a.option === 'lift' ? release(s, rng, 'single', true) : release(s, rng, a.option as ReleaseKind);
    case 'party': return party(s, rng, a.option);
    case 'rest': return rest(s, rng, a.option, a.memberId);
    case 'advertise': return advertise(s, rng, a.role ?? 'guitar', a.option);
    case 'tour':
      if (a.option === 'abandon') return abandonTour(s);
      if (a.option.startsWith('continue')) {
        s.tour!.policy = (a.option.split(':')[1] as TourPolicy | undefined) ?? s.tour!.policy;
        return playTourWeek(s, rng);
      }
      return startTour(s, rng, a.option, a.weeks ?? tierById(a.option)!.minWeeks, a.policy ?? 'steady', a.lodging);
  }
}

function gig(s: GameState, rng: Rng, g: GigSpec): void {
  const wasted = new Set<string>();
  for (const m of available(s)) {
    // Tolerance: a strong constitution carries a habit on stage; a weak one shows it by the second song.
    const p = ((m.habit / 100) * 0.45 + ((100 - m.hidden.reliability) / 100) * 0.15) * (1.4 - m.hidden.stamina / 125);
    if (rng.chance(p * 0.6)) wasted.add(m.id);
  }
  if (canDep(s)) callDeps(s, rng, covered(s));
  let perf = performance(s, wasted, g.capacity);
  const worn = wearKit(s, rng, 0.12);
  if (worn) log(s, `${first(worn)}'s ${worn.role === 'drums' ? 'snare skin split' : worn.role === 'vocals' ? 'microphone took a knock' : 'amp started crackling'} mid-set. Kit wears.`, 'neutral');
  const fate = gigFate(s, rng, perf, g.capacity);
  let crowdMult = 1;
  if (fate?.kind === 'disaster') { perf = Math.round(perf * fate.perfMult); crowdMult = fate.crowdMult; }
  // Play the same London rooms every week and people stop coming: they saw you last Friday.
  const local = g.capacity < 5000;
  const overexposed = local ? 1 / (1 + (s.flags.homeHeat ?? 0) * 0.15) : 1;
  const crowd = clamp(Math.round(g.crowd(s, rng) * overexposed * crowdMult), 6, g.capacity);
  if (local) s.flags.homeHeat = (s.flags.homeHeat ?? 0) + 1;
  if (overexposed < 0.6 && rng.chance(0.3)) log(s, 'Half the regulars stayed home. "We saw you last week," says the barman. "And the week before."', 'neutral');
  const wastedMembers = available(s).filter((m) => wasted.has(m.id));
  gigCommentary(s, rng, { venue: g.venue, crowd, capacity: g.capacity, perf, wasted: wastedMembers });
  if (fate?.kind === 'disaster') {
    beat(s, undefined, fate.text, 'bad');
    s.money -= fate.cost;
    addBuzz(s, fate.buzz);
    for (const m of available(s)) adjust(m, 'mood', -5);
    log(s, `Disaster at ${g.venue}: ${fate.text.split('.')[0]}.`, 'bad');
  }
  for (const m of wastedMembers) revealLog(s, m, m.habit >= 40 ? 'vice' : 'reliability', 1);
  // A manager with clout squeezes promoters, then takes their cut.
  const pay = Math.round((g.fee + Math.round(crowd * 2 * g.door)) * feeBoost(s));
  const fashion = 0.75 + trend(player(s).style, s.week) * 0.4;
  // Playing the same London rooms mostly reaches people who already know you.
  const novelty = clamp(1 - s.fans / (g.capacity * 8), g.fresh ?? 0.05, 1);
  const raw = ((crowd * (perf - 42)) / 90) * g.fanMult * (perf > 42 ? novelty : 1);
  const fanDelta = Math.max(Math.round(raw > 0 ? raw * fashion : raw), -Math.round(crowd * 0.1));
  s.money += pay;
  earn(s, 'gigs', pay);
  commission(s, pay);
  const merch = g.fee > 0 || crowd >= 40 ? Math.round(merchTake(s, crowd) * (g.merchMult ?? 1)) : 0;
  if (merch > 0) { s.money += merch; earn(s, 'merch', merch); }
  s.fans = Math.max(0, s.fans + fanDelta);
  addBuzz(s, Math.max(0, (perf - 45) / 5) + crowd / 60 + g.buzzBonus);
  if (s.lastGigWeek === null) milestone(s, 'career', `First gig: ${g.venue}, ${crowd} people.`);
  s.lastGigWeek = s.week;
  const legend = fate?.kind === 'legend';
  const verdict = legend ? 'Legendary.' : fate?.kind === 'disaster' ? 'Disaster.' : perf >= 75 ? 'Storming.' : perf >= 55 ? 'A solid night.' : perf >= 40 ? 'Ropey.' : 'A shambles.';
  setVerdict(s, legend ? 'Legendary' : fate?.kind === 'disaster' ? 'Disaster' : perf >= 75 ? 'Storming' : perf >= 55 ? 'Solid' : perf >= 40 ? 'Ropey' : 'Shambles', legend || perf >= 55 ? 'good' : perf >= 40 ? 'neutral' : 'bad');
  if (legend) applyLegend(s, rng, g.venue, crowd);
  headline(s, 'Crowd', `${crowd} / ${g.capacity}`);
  log(s, `Gig: ${g.venue}. ${crowd} people${pay ? `, £${pay}` : ''}${merch ? `, merch £${merch}` : ''}. ${verdict} Fans ${signed(fanDelta)}.`, perf >= 55 ? 'good' : 'bad');

  g.after?.(s, rng, perf, crowd);

  const demo = s.releases.find((r) => r.kind === 'demo');
  if (demo) {
    const tapes = Math.round(crowd * 0.12 * (perf >= 50 ? 1 : 0.5));
    if (tapes > 0) {
      demo.sold += tapes;
      s.money += Math.round(tapes * 1.5);
      earn(s, 'merch', tapes * 1.5);
      log(s, `Sold ${tapes} demo tapes at the merch table.`, 'good');
    }
  }

  const energyMult = g.energyMult * (s.flags.roadie ? 0.8 : 1) * WHEELS[wheelsOf(s)].gig;
  for (const m of available(s)) {
    adjust(m, 'energy', wobble(rng, -22 * (1.4 - m.hidden.stamina / 100) * energyMult));
    adjust(m, 'mood', wobble(rng, perf >= 50 ? 5 : perf < 40 ? -6 : 0));
    adjust(m, 'habit', wobble(rng, (m.hidden.vice / 50) * rng.int(0, 2)));
    grow(m, 'stage', 1, rng, 0.12);
    if (m.energy < 25) revealLog(s, m, 'stamina', 1);
  }
  if (g.door > 0 || g.buzzBonus > 0) {
    if (rng.chance(0.12 + s.buzz / 300)) {
      if (perf >= 60) {
        addBuzz(s, 6);
        log(s, `${PRESS} was there: "${rng.pick(PRESS_GOOD)}"`, 'good');
      } else {
        addBuzz(s, -3);
        log(s, `${PRESS} was there: "${rng.pick(PRESS_BAD)}"`, 'bad');
      }
    }
  }
}

/** A shopping trip sized to the band's standing: a few hundred quid at first, a small fortune later. */
export function shopCost(s: GameState): number {
  return Math.round(clamp(400 + s.fans * 0.15, 400, 40000) / 50) * 50;
}
export function shopLabel(s: GameState): string {
  const c = shopCost(s);
  return c < 1000 ? 'A day in the Denmark Street music shops' : c < 8000 ? 'A proper shopping trip: new gear all round' : 'Fly the band to the instrument fair in Frankfurt';
}

function shop(s: GameState, rng: Rng): void {
  const spend = shopCost(s) / Math.max(1, available(s).length);
  rehearsalCommentary(s, 'shop', rng);
  for (const m of available(s)) {
    const before = m.kit ?? 30;
    m.kit = clamp(before + kitGain(before, spend) + rng.int(-2, 2), 1, 100);
    adjust(m, 'mood', wobble(rng, 8));
    if (m.hidden.ego >= 65 && rng.chance(0.3)) { adjust(m, 'image', 1); log(s, `${first(m)} bought something in ${rng.pick(['sparkle finish', 'leopard print', 'mirror chrome', 'a colour not found in nature'])}. It will be on the posters.`, 'neutral'); }
  }
  const best = [...available(s)].sort((a, b) => (b.kit ?? 0) - (a.kit ?? 0))[0];
  log(s, `New gear all round: the band's kit is now ${KIT_WORD(bandKit(s))} (${bandKit(s)}). ${first(best)} has the nicest ${best.role === 'drums' ? 'kit' : best.role === 'vocals' ? 'microphone' : best.role === 'keys' ? 'keyboard' : best.role}, and will not stop saying so.`, 'good');
}

function rehearse(s: GameState, rng: Rng, option: string): void {
  if (option === 'shop') return shop(s, rng);
  const here = available(s);
  rehearsalCommentary(s, option, rng);
  let gain = 6 + Math.round(chemistry(s).total / 25);
  if (option === 'bootcamp') gain = Math.round(gain * 1.8);
  if (option === 'coach' || option === 'stageshow') gain = Math.round(gain * 0.6);
  if (option === 'lessons') gain = Math.round(gain * 0.4);
  for (const m of here) {
    if (!m.isPlayer && m.hidden.reliability < 40 && rng.chance(option === 'bootcamp' ? 0.25 : 0.45)) {
      log(s, `${first(m)} turned up two hours late, smelling of last night.`, 'bad');
      revealLog(s, m, 'reliability', 1);
      addAffinity(s, m.id, 'p', -3);
      gain = Math.floor(gain * 0.6);
    }
    grow(m, 'skill', 1, rng, 0.8);
    grow(m, 'stage', 1, rng, 0.2);
    adjust(m, 'energy', wobble(rng, option === 'bootcamp' ? -16 : -8));
    if (option === 'bootcamp') {
      adjust(m, 'habit', wobble(rng, -6));
      adjust(m, 'mood', wobble(rng, -8));
    }
    if (option === 'coach') {
      grow(m, 'skill', 3, rng);
      reveal(m, 'potential', 1);
      if (m.hidden.ego >= 70) {
        adjust(m, 'mood', wobble(rng, -6));
        log(s, `${subj(m, 'did not', 'did not')} enjoy being told how to play by a man in a cardigan.`, 'bad');
        revealLog(s, m, 'ego', 1);
      }
    }
    if (option === 'stageshow') {
      // Showmanship is learned, not born: past the natural ceiling it still climbs, slowly, up to twelve over.
      const got = grow(m, 'stage', 3, rng);
      const over = m.stage - m.hidden.potential;
      if (!got && over >= 0 && over < 12 && rng.chance(0.35 * (1 - over / 12))) adjust(m, 'stage', 1);
      adjust(m, 'image', 1);
    }
  }
  forEachPair(here, (a, b) => {
    const clash = a.hidden.ego >= 70 && b.hidden.ego >= 70;
    addAffinity(s, a.id, b.id, rng.int(-3, 6) - (clash ? 8 : 0) - (option === 'bootcamp' ? 2 : 0));
    if (clash && rng.chance(0.3)) {
      log(s, `${first(a)} and ${first(b)} argued for an hour about whose part is louder.`, 'bad');
      revealLog(s, a, 'ego', 1);
      revealLog(s, b, 'ego', 1);
    }
  });
  // Mentoring: the best player rubs off on the ones who are well behind.
  const mentor = [...here].sort((a, b) => b.skill - a.skill)[0];
  let mentored = false;
  for (const m of here) {
    if (m === mentor || mentor.skill - m.skill < 12) continue;
    if (grow(m, 'skill', 1, rng, 0.35) && !mentored) {
      mentored = true;
      if (mentor.hidden.ego >= 70) {
        addAffinity(s, m.id, mentor.id, -2);
        log(s, `${subj(m, 'picked', 'picked')} up a few tricks from ${mentor.isPlayer ? 'you' : first(mentor)}, who was very smug about it.`, 'neutral');
      } else {
        addAffinity(s, m.id, mentor.id, 3);
        log(s, `${subj(m, 'picked', 'picked')} up a few tricks from ${mentor.isPlayer ? 'you' : first(mentor)}.`, 'good');
      }
    }
  }
  // Playing together pulls tastes together, if they like you.
  const me = player(s);
  for (const m of here) {
    if (!m.isPlayer && m.style !== me.style && getAffinity(s, m.id, me.id) > 25 && rng.chance(0.06)) {
      m.style = me.style;
      log(s, `${first(m)} is coming round to ${GENRE_LABEL[me.style].toLowerCase()}.`, 'good');
    }
  }
  if (option === 'lessons') {
    const t = lessonTarget(s);
    if (t) {
      grow(t, 'skill', 4, rng);
      getToKnow(t, 30);
      if (t.hidden.ego >= 70 && !t.isPlayer) {
        adjust(t, 'mood', wobble(rng, -6));
        log(s, `${first(t)} took private lessons as an insult, then took them anyway.`, 'neutral');
        revealLog(s, t, 'ego', 1);
      } else {
        adjust(t, 'mood', wobble(rng, 4));
        log(s, `${subj(t, 'had', 'had')} a week of private lessons with an old jazz teacher in Archway.`, 'good');
      }
    }
  }
  if (option === 'coach') {
    log(s, `The session pro's verdict: ${here.map((m) => `${m.isPlayer ? 'you' : first(m)} ${m.isPlayer ? prospects(m).replace('has', 'have') : prospects(m)}`).join(', ')}.`, 'reveal');
  }
  const before = s.tightness;
  s.tightness = clamp(s.tightness + gain, 0, 100);
  const d = s.tightness - before;
  // The change is the news; the new level goes underneath, like the money tile.
  headline(s, 'Tightness', `${d >= 0 ? '+' : ''}${d}`, `now ${s.tightness}`);
  const what: Record<string, string> = {
    regular: 'Rehearsal',
    bootcamp: 'Boot camp week. Nobody drank, everybody suffered',
    coach: 'A session pro drilled the band all week',
    stageshow: 'A week of rehearsing poses, kicks and the smoke machine',
    lessons: 'A week of lessons and rehearsals',
  };
  log(s, `${what[option]}. Tightness ${s.tightness}.`, 'good');
}

function newSong(s: GameState, rng: Rng, quality: number, writer: Musician, kind: SongKind, genre: Genre): Song {
  if (kind !== 'cover' && kind !== 'hired') grow(writer, 'writing', 1, rng, 0.5);
  const song: Song = { title: songTitle(rng), quality: clamp(Math.round(quality), 1, 99), writer: writer.id, kind, genre, released: false };
  s.songs.push(song);
  // The one can come anywhere. Alone in the flat with the door shut is where it comes most often.
  if (kind !== 'cover' && kind !== 'hired' && rng.chance(masterpieceOdds(s, writer) * (kind === 'solo' ? 1.6 : 1))) strikeMasterpiece(s, rng, song, writer);
  const kindText = kind === 'ballad' ? 'power ballad' : kind === 'trend' ? `${GENRE_LABEL[genre].toLowerCase()} song` : kind === 'cover' ? 'cover' : kind === 'hired' ? 'song' : 'song';
  const whose = kind === 'cover' ? 'somebody else\'s, once' : kind === 'hired' ? 'not yours, on paper' : `mostly ${writer.isPlayer ? 'yours' : `${first(writer)}'s`}`;
  log(s, `New ${kindText}: "${song.title}" (${song.quality}), ${whose}.`, song.quality >= 55 ? 'good' : 'neutral');
  headline(s, 'New song', `${song.quality}`);
  setVerdict(s, song.quality >= 92 ? 'The one' : song.quality >= 65 ? 'A belter' : song.quality >= 50 ? 'Keeper' : 'Filler', song.quality >= 50 ? 'good' : 'neutral');
  return song;
}

/** Your own studio takes most of the studio bill off a self-financed record. */
function selfCost(s: GameState, base: number): number {
  const st = studioOf(s);
  const own = st ? base * (1 - st.saving * 0.6) : base;
  // The accountant rings three studios and plays them off against each other.
  return Math.round((own * nousSaving(s)) / 10) * 10;
}
function studioNote(s: GameState): string {
  const st = studioOf(s);
  return st ? ` Recorded at ${st.name.toLowerCase()}: +${st.quality} quality.` : '';
}

/** Who is booked to produce the next album: the producer is chosen beforehand and waits for the session. */
function producerNote(s: GameState): string {
  const p = s.flags.nextProducer ?? 0;
  return p === 3 ? ' Producer booked: the legend (+12 quality, tighter band).' : p === 2 ? ' Producer booked: a name producer (+6 quality).' : p === 1 ? ' Producer booked: your mate with the eight-track (+1).' : ' No producer booked: the house engineer does it. A producer offer comes once eight songs are ready.';
}

/** A songwriter for hire costs what the band can be seen to pay. */
export function hiredFee(s: GameState): number {
  return Math.round(clamp(300 + s.fans * 0.12, 300, 25000) / 10) * 10;
}
/** A residential studio, a month in the country. */
export function retreatCost(s: GameState): number {
  return Math.round(clamp(1500 + s.fans * 0.25, 1500, 40000) / 50) * 50;
}

/** The band changes its sound: a new genre for every song from here on, and a price for it. */
function changeDirection(s: GameState, rng: Rng, genre: Genre): void {
  const me = player(s);
  const from = me.style;
  me.style = genre;
  s.flags.direction = s.week;
  s.flags.directions = (s.flags.directions ?? 0) + 1;
  const core = s.flags.coreFans ?? 0;
  const casual = Math.max(0, s.fans - core);
  const lost = Math.round(casual * (0.12 + Math.min(0.1, (s.flags.directions - 1) * 0.04)));
  s.fans -= lost;
  addBuzz(s, 8);
  for (const m of available(s)) {
    if (m.isPlayer) continue;
    if (m.style === genre) { adjust(m, 'mood', 10); addAffinity(s, m.id, me.id, 5); }
    else if (m.hidden.loyalty >= 60 && rng.chance(0.5)) { m.style = genre; adjust(m, 'mood', 3); }
    else { adjust(m, 'mood', -10); addAffinity(s, m.id, me.id, -6); if (m.hidden.ego >= 60) revealLog(s, m, 'ego', 1); }
  }
  s.tightness = clamp(s.tightness - 6, 0, 100);
  const sulk = available(s).filter((m) => !m.isPlayer && m.style !== genre);
  milestone(s, 'career', `${s.bandName} went ${GENRE_LABEL[genre].toLowerCase()}, leaving ${GENRE_LABEL[from].toLowerCase()} behind.`);
  log(s, `${s.bandName} is a ${GENRE_LABEL[genre].toLowerCase()} band now. ${PRESS}: "${rng.pick(['SELL-OUTS OR GENIUSES?', 'THE NEW SOUND OF ' + s.bandName.toUpperCase(), s.bandName.toUpperCase() + ' GO ' + GENRE_LABEL[genre].toUpperCase() + ', FANS GO HOME'])}". ${lost.toLocaleString('en-GB')} fans went with the old sound.${sulk.length ? ` ${sulk.map((m) => first(m)).join(' and ')} played the new songs with ${sulk.length === 1 ? 'a face' : 'faces'} like a wet weekend.` : ' The band was ready for it.'}`, 'neutral');
}

function write(s: GameState, rng: Rng, option: string, genre?: Genre): void {
  if (option === 'direction') {
    const g = genre && genre !== player(s).style ? genre : GENRES.filter((x) => x !== player(s).style).sort((a, b) => trend(b, s.week) - trend(a, s.week))[0];
    writingCommentary(s, rng, 'direction');
    changeDirection(s, rng, g);
    return;
  }
  const here = available(s);
  writingCommentary(s, rng, option);
  const me = player(s);
  const writers = [...here].sort((a, b) => b.writing - a.writing);
  const best = writers[0];
  const second = writers[1] ?? best;
  const chem = chemistry(s).total;
  const insp = inspiration(s);
  // Chemistry helps, but it is not the song: a band at each other's throats can still write the one.
  let base = best.writing * 0.45 + second.writing * 0.25 + 6 + chem * 0.14 + insp.bonus;
  if (insp.text) log(s, insp.text, insp.bonus > 0 ? 'good' : 'neutral');
  // Sparks: two good writers who cannot stand each other sometimes make something out of the fight.
  if (chem < 45 && best !== second && best.writing >= 55 && second.writing >= 50 && option !== 'solo' && rng.chance(0.3)) {
    base += rng.int(8, 16);
    log(s, `${first(best)} and ${first(second)} are not speaking, so they wrote at each other instead. It is better than anything they wrote as friends.`, 'good');
  }

  if (option === 'solo') {
    me.energy = clamp(me.energy - 10, 0, 100);
    if (rng.chance(clamp(0.3 - me.writing / 300, 0.05, 0.3))) {
      log(s, 'A week alone with a guitar and a notebook. Nothing worth keeping.', 'bad');
      return;
    }
    newSong(s, rng, me.writing * 0.75 + chem * 0.1 + rng.int(-12, 18), me, 'solo', me.style);
    for (const m of here) {
      if (!m.isPlayer && m.hidden.ego >= 65 && m.writing >= 40) {
        adjust(m, 'mood', wobble(rng, -5));
        addAffinity(s, m.id, me.id, -4);
        log(s, `${first(m)} asked why nobody wanted their ideas.`, 'bad');
        revealLog(s, m, 'ego', 1);
      }
    }
    return;
  }

  if (option === 'cover') {
    const old = rng.pick(s.world.stars.filter((x) => x.age > 100).concat(s.world.stars.slice(0, 3)));
    const song = newSong(s, rng, 48 + best.skill * 0.15 + s.tightness * 0.1 + rng.int(-6, 16), best, 'cover', me.style);
    song.outside = true;
    log(s, `"${song.title}" was a hit for ${old.name} before any of you could drive. Your version is louder. ${old.name}'s publisher gets a slice of every copy.`, 'neutral');
    for (const m of here) if (!m.isPlayer && m.writing >= 45 && m.hidden.ego >= 60) { adjust(m, 'mood', wobble(rng, -5)); log(s, `${first(m)} wanted to know why the band is playing other people's songs.`, 'bad'); }
    return;
  }
  if (option === 'publisher') {
    const l = labelById(s.contract!.label);
    const floor = l.tier === 'major' ? 68 : l.tier === 'indie' ? 52 : 58;
    if (rng.chance(0.25)) {
      log(s, `Six tapes from ${l.name}'s publishers. Five about a girl called Candy, one about a car. None of them any good.`, 'bad');
      return;
    }
    const song = newSong(s, rng, floor + rng.int(0, 20), best, 'hired', rng.chance(0.5) ? me.style : hotGenres(s.week)[0]);
    song.outside = true;
    s.contract!.goodwill = clamp(s.contract!.goodwill + 4, 0, 100);
    log(s, `A song from a writer with three number ones and a house in Surrey. ${l.name} are delighted. The publishing is not yours and never will be.`, 'good');
    for (const m of here) if (m.writing >= 45 && m.hidden.ego >= 55) { adjust(m, 'mood', wobble(rng, -6)); if (!m.isPlayer) addAffinity(s, m.id, me.id, -3); }
    if (best.hidden.ego >= 60) revealLog(s, best, 'ego', 1);
    return;
  }
  if (option === 'hired') {
    const fee = hiredFee(s);
    const pro = 70 + Math.min(18, Math.log10(Math.max(1, fee / 300)) * 9);
    const song = newSong(s, rng, pro * 0.65 + base * 0.35 + rng.int(-6, 10), best, 'hired', me.style);
    song.outside = true;
    grow(best, 'writing', 2, rng);
    log(s, `A week with a songwriter who has written for everybody and is not shy about saying so. £${fee.toLocaleString('en-GB')}, half the publishing, and "${song.title}". ${first(best)} ${best.isPlayer ? 'learned' : 'learned'} more than ${best.isPlayer ? 'you' : 'they'} will admit.`, 'good');
    for (const m of here) if (!m.isPlayer && m.writing >= 45 && m.hidden.ego >= 60) { adjust(m, 'mood', wobble(rng, -8)); addAffinity(s, m.id, me.id, -4); log(s, `${first(m)} sat in the corner saying "I could have written that". ${first(m)} could not have.`, 'bad'); revealLog(s, m, 'ego', 1); }
    return;
  }
  if (option === 'studioWeek') {
    const st = STUDIOS[s.studio!];
    s.flags.studioUsed = s.week;
    for (const m of here) { adjust(m, 'energy', wobble(rng, -4)); adjust(m, 'mood', wobble(rng, 4)); }
    const n = rng.chance(0.45) ? 2 : 1;
    for (let i = 0; i < n; i++) newSong(s, rng, base + st.writing + rng.int(-8, 12), i === 0 ? best : second, 'standard', me.style);
    s.tightness = clamp(s.tightness + 2, 0, 100);
    log(s, `A week at ${st.name.toLowerCase()}: nobody watching the clock, the tape rolling all day, and the good take caught the first time it happened.`, 'good');
    return;
  }
  if (option === 'retreat') {
    for (const m of here) { adjust(m, 'energy', wobble(rng, 12)); adjust(m, 'mood', wobble(rng, 8)); }
    forEachPair(here, (a, b) => addAffinity(s, a.id, b.id, 3));
    const n = rng.chance(0.5) ? 3 : 2;
    for (let i = 0; i < n; i++) newSong(s, rng, base + 6 + rng.int(-8, 14), i % 2 === 0 ? best : second, 'standard', me.style);
    s.tightness = clamp(s.tightness + 2, 0, 100);
    log(s, rng.pick(['A farmhouse in Wales, a mobile studio in the yard and no pub for nine miles. The songs came. So did the farmer, twice.', 'A month in a manor house with a ghost, a snooker table and a sixteen-track. Half the songs are about the ghost.', 'A cottage by the sea, rain every day, and the best fortnight of writing the band has had.']), 'good');
    return;
  }

  for (const m of here) adjust(m, 'energy', wobble(rng, -5));
  if (rng.chance(option === 'jam' ? 0.15 : 0.2)) {
    log(s, rng.pick(['Five days of jamming the same riff. Nothing usable.', 'The tape recorder ate the only good idea.', 'Everyone had a different song in mind. Nothing finished.']), 'bad');
    return;
  }

  if (option === 'jam') {
    const n = rng.chance(0.4) ? 2 : 1;
    for (let i = 0; i < n; i++) newSong(s, rng, base + rng.int(-10, 15), best, 'standard', me.style);
    forEachPair(here, (a, b) => addAffinity(s, a.id, b.id, 2));
    if (best !== second && best.hidden.ego >= 65 && second.hidden.ego >= 65 && second.writing >= 40) {
      addAffinity(s, best.id, second.id, -10);
      log(s, `${first(best)} and ${first(second)} both claim the chorus was their idea.`, 'bad');
      revealLog(s, best, 'ego', 1);
      revealLog(s, second, 'ego', 1);
    }
  } else if (option === 'trend') {
    const hot = hotGenres(s.week)[0];
    newSong(s, rng, base - 5 + rng.int(-10, 12), best, 'trend', hot);
    for (const m of here) {
      if (m.style !== hot && !m.isPlayer && rng.chance(0.6)) {
        adjust(m, 'mood', wobble(rng, -6));
        log(s, `${first(m)} called the new song "a sell-out" and played it with their eyes shut.`, 'bad');
      }
    }
  } else if (option === 'ballad') {
    newSong(s, rng, base + rng.int(-18, 25), best, 'ballad', me.style);
    for (const m of here) {
      if (!m.isPlayer && (m.style === 'metal' || m.style === 'punk')) {
        adjust(m, 'mood', wobble(rng, -5));
        log(s, `${first(m)} is not happy about the key change.`, 'bad');
      }
    }
  }
}

export const RELEASE_SONGS: Record<ReleaseKind, number> = { demo: 3, single: 2, ep: 4, album: 8 };
const RELEASE_LABEL: Record<ReleaseKind, string> = { demo: 'demo tape', single: '7" single', ep: '12" EP', album: 'album' };

function release(s: GameState, rng: Rng, kind: ReleaseKind, lift = false): void {
  releaseCommentary(s, kind, rng);
  const pool = lift ? liftable(s).slice(0, 1) : kind === 'demo' ? [...s.songs] : s.songs.filter((x) => !x.released);
  const songs = pool.sort((a, b) => b.quality - a.quality).slice(0, RELEASE_SONGS[kind]);
  if (!songs.length) throw new Error('Nothing to release.');
  const deal = labelRelease(s, kind);
  const prod = kind === 'album' ? takeProducer(s) : { quality: 0, tight: 0 };
  const own = kind === 'demo' ? null : studioOf(s);
  if (own) { s.flags.studioUsed = s.week; if (s.contract) s.contract.unrecouped -= Math.round(s.contract.terms.budget * (kind === 'single' ? 0.15 : kind === 'ep' ? 0.35 : 1) * own.saving * 0.6); }
  const studio = (kind === 'demo' ? -8 : kind === 'single' ? 0 : 3) + (deal?.studio ?? 0) + (own?.quality ?? 0);
  let appeal =
    songs.reduce((a, x) => a + (x.kind === 'ballad' ? 1.25 : 1) * (0.7 + trend(x.genre, s.week) * 0.5), 0) / songs.length;
  let polish = 0;
  if (kind !== 'demo') {
    // The A&R got their way: a poppier record, or a session player on it.
    if (s.flags.arPush) { appeal *= 1.2; delete s.flags.arPush; }
    if (s.flags.sessionPlayer) { polish = 4; delete s.flags.sessionPlayer; }
  }
  // Good instruments record better; the studio can only do so much with a cardboard snare.
  const kitEdge = kind === 'demo' ? 0 : clamp((bandKit(s) - 50) / 20, -2.5, 2);
  const quality = clamp(Math.round(songs.reduce((a, x) => a + x.quality, 0) / songs.length + s.tightness * 0.1 + studio + polish + prod.quality + kitEdge + rng.int(-4, 4)), 1, 99);
  const title = songs[0].title;
  if (kind === 'demo') {
    s.releases = s.releases.filter((r) => r.kind !== 'demo');
  } else if (lift) {
    for (const x of songs) x.lifted = true;
  } else {
    for (const x of songs) x.released = true;
  }
  // The fourth single off an album is a B-side with a budget: every lift after the second sells less.
  if (lift) { const n = s.songs.filter((x) => x.album === songs[0].album && x.lifted).length - songs.length; appeal *= liftFatigue(n); }
  const rec: Release = { id: `rel${s.nextId++}`, kind, title, quality, appeal, week: s.week, sold: 0, lastWeek: 0 };
  if (kind === 'album') for (const x of songs) x.album = rec.id;
  tagRelease(s, rec);
  if (songs[0].outside) { rec.outside = true; if (rec.royalty) rec.royalty *= OUTSIDE_CUT; }
  s.releases.push(rec);
  const labelName = rec.label ? labelById(rec.label).name : 'Kebab Shop Records';
  milestone(s, 'release', `Released "${title}", ${RELEASE_LABEL[kind]}${kind === 'demo' ? '' : ` on ${labelName}`}.`);
  if (kind !== 'demo') masterpiecePress(s, rng, songs);
  addBuzz(s, kind === 'demo' ? 3 : kind === 'single' ? 6 : 9);
  // Hearing yourself back on tape is humbling, and educational.
  if (!lift) {
    for (const m of available(s)) {
      adjust(m, 'energy', wobble(rng, -8));
      grow(m, 'skill', 1, rng, 0.35);
      grow(m, 'writing', 1, rng, 0.2);
    }
    s.tightness = clamp(s.tightness + 3 + prod.tight, 0, 100);
  }
  if (lift) log(s, `"${title}" is lifted from the album as a single, with a B-side nobody will play and a sleeve everyone will.`, 'good');
  else log(s, `${s.bandName} recorded a ${RELEASE_LABEL[kind]}: "${title}" (${quality}).${kind === 'demo' ? ' Tapes go on the merch table.' : rec.label ? ` Out now on ${labelName}, with posters on every bus shelter they could afford.` : ' Out now on your own label, Kebab Shop Records.'}`, 'good');
}

function party(s: GameState, rng: Rng, option: string): void {
  const here = available(s);
  const p = { cans: [7, 4, [0, 3]], squat: [14, 12, [2, 8]], soho: [16, 18, [4, 10]], throw: [20, 20, [5, 12]], penthouse: [28, 22, [6, 14]], yacht: [40, 15, [6, 16]] }[option] as [number, number, [number, number]];
  for (const m of here) {
    adjust(m, 'mood', wobble(rng, p[0]));
    adjust(m, 'energy', wobble(rng, -p[1] * (1.3 - m.hidden.stamina / 150)));
    adjust(m, 'habit', wobble(rng, (m.hidden.vice / 100) * rng.int(p[2][0], p[2][1])));
  }
  forEachPair(here, (a, b) => addAffinity(s, a.id, b.id, rng.int(1, option === 'cans' ? 3 : 6)));
  const wildest = [...here].sort((a, b) => b.hidden.vice - a.hidden.vice)[0];
  const text: Record<string, string> = {
    cans: 'Cans and a ghetto blaster in the rehearsal room.',
    squat: `Party at the squat. ${subj(wildest, 'were', 'was')} still going at six in the morning.`,
    soho: `A night in the Soho clubs. ${subj(wildest, 'were', 'was')} spotted dancing on a table at three a.m.`,
    throw: `${s.bandName} threw a party. Half of Camden came, the other half heard it.`,
    penthouse: `A Mayfair penthouse, a weekend, no rules. ${subj(wildest, 'were', 'was')} last seen in the lift with a bottle and a traffic cone.`,
    yacht: `A week on a yacht off Antibes. ${subj(wildest, 'were', 'was')} rescued from the sea twice, once on purpose.`,
  };
  partyCommentary(s, rng, option, wildest);
  log(s, text[option], 'neutral');
  if (option !== 'cans') revealLog(s, wildest, 'vice', 1);
  const buzzChance = { cans: 0.03, squat: 0.2, soho: 0.45, throw: 1, penthouse: 1, yacht: 1 }[option]!;
  if (option === 'penthouse' || option === 'yacht') {
    // Legendary excess: the tabloids love it, and so does everyone's image.
    addBuzz(s, option === 'yacht' ? 18 : 12);
    for (const m of here) adjust(m, 'image', option === 'yacht' ? 3 : 2);
    forEachPair(here, (a, b) => addAffinity(s, a.id, b.id, rng.int(4, 10)));
    s.flags.fling = s.week;
    log(s, option === 'yacht' ? 'The yacht made the Sunday papers: "ROCK BAND IN RIVIERA CHAMPAGNE SHAME". Record shops reported a rush.' : 'The penthouse party is the talk of London. Three gossip columns, one broken chandelier.', 'good');
  } else if (rng.chance(buzzChance)) {
    addBuzz(s, option === 'throw' ? 9 : option === 'soho' ? 6 : 4);
    log(s, option === 'soho' ? 'Someone from the music press saw you. People are talking.' : 'Word gets round. People are talking about the band, if not the music.', 'good');
  }
  if (option === 'throw') s.flags.lastBigParty = s.week;
  // Being seen in the right places sharpens the look.
  if (option === 'soho' || option === 'throw') for (const m of here) if (rng.chance(0.3)) adjust(m, 'image', 1);
  // You learn who people really are at four in the morning.
  if (option === 'squat') for (const m of here) if (rng.chance(0.2)) grow(m, 'stage', 1, rng, 0.5);
  const risky = here.find((m) => m.hidden.vice >= 75 && m.habit >= 40);
  const aeChance = { cans: 0.03, squat: 0.25, soho: 0.35, throw: 0.35 }[option]!;
  if (risky && rng.chance(aeChance)) {
    risky.outWeeks = Math.max(risky.outWeeks, 1);
    s.money -= 30;
    log(s, `${subj(risky, 'ended', 'ended')} the night in A&E. Out for a week.`, 'bad');
    revealLog(s, risky, 'vice', 2);
  }
}

/** What a clinic charges a band of this standing. */
export function clinicFee(s: GameState): number {
  return Math.round(clamp(400 + s.fans * 0.08, 400, 12000) / 50) * 50;
}
export function sanatoriumFee(s: GameState): number {
  return Math.round(clamp(4000 + s.fans * 0.4, 4000, 80000) / 100) * 100;
}

/** One member away for treatment while the rest keep working. */
function clinicOne(s: GameState, rng: Rng, memberId?: string): void {
  const pick = s.members.find((m) => m.id === memberId && !m.isPlayer && m.outWeeks === 0) ?? [...s.members].filter((m) => !m.isPlayer && m.outWeeks === 0).sort((a, b) => b.habit - a.habit)[0];
  if (!pick) throw new Error('Nobody to send.');
  pick.outWeeks = Math.max(pick.outWeeks, 2);
  adjust(pick, 'habit', wobble(rng, -45));
  adjust(pick, 'energy', 30);
  adjust(pick, 'mood', wobble(rng, -8));
  pick.hidden.loyalty = clamp(pick.hidden.loyalty + 3, 1, 99);
  for (const m of available(s)) if (m !== pick) adjust(m, 'mood', wobble(rng, 2));
  restCommentary(s, 'clinicOne', rng);
  log(s, `${first(pick)} has gone to a clinic in Surrey for a fortnight. The rest of the band ${canDep(s) ? 'rehearsed with a dep and carried on' : 'rehearsed without a rhythm section and waited'}.`, 'neutral');
}

function rest(s: GameState, rng: Rng, option: string, memberId?: string): void {
  if (option === 'clinicOne') return clinicOne(s, rng, memberId);
  restCommentary(s, option, rng);
  // A home of your own rests you better than a flat above a kebab shop; a big one rests the band.
  const home = homeRest(s);
  const bandHome = owned(s).some((t) => toySpec(t.id).band);
  if (home && option === 'sleep') log(s, `A week at ${bestHome(s)}. ${bandHome ? 'The band came too.' : 'Nobody else was invited.'}`, 'neutral');
  for (const m of s.members) {
    switch (option) {
      case 'sleep':
        adjust(m, 'energy', wobble(rng, m.habit > 50 ? 20 : 35) + (m.isPlayer || bandHome ? home : 0));
        adjust(m, 'mood', wobble(rng, 4));
        adjust(m, 'habit', wobble(rng, -8));
        break;
      case 'seaside':
        adjust(m, 'energy', wobble(rng, 30));
        adjust(m, 'mood', wobble(rng, 12));
        adjust(m, 'habit', wobble(rng, -6));
        break;
      case 'dry':
        adjust(m, 'energy', wobble(rng, 25));
        adjust(m, 'mood', wobble(rng, m.habit >= 40 ? -18 : -6));
        if (m.habit >= 40) revealLog(s, m, 'vice', 1);
        adjust(m, 'habit', wobble(rng, -18));
        break;
      case 'mum':
        adjust(m, 'energy', wobble(rng, 45));
        adjust(m, 'mood', wobble(rng, -3));
        adjust(m, 'habit', wobble(rng, -10));
        break;
      case 'spa':
        adjust(m, 'energy', wobble(rng, 50));
        adjust(m, 'mood', wobble(rng, 15));
        adjust(m, 'habit', wobble(rng, -15));
        break;
      case 'bahamas':
        m.energy = 100;
        adjust(m, 'mood', wobble(rng, 30));
        adjust(m, 'habit', wobble(rng, -12));
        adjust(m, 'image', 1);
        break;
      case 'retreat':
        m.energy = 100;
        adjust(m, 'mood', wobble(rng, 25));
        adjust(m, 'habit', wobble(rng, -8));
        grow(m, 'writing', 3, rng);
        break;
      case 'clinic':
        adjust(m, 'energy', wobble(rng, 30));
        adjust(m, 'mood', wobble(rng, m.habit >= 40 ? -10 : 2));
        if (m.habit >= 40) revealLog(s, m, 'vice', 1);
        adjust(m, 'habit', wobble(rng, -40));
        break;
      case 'sanatorium':
        m.energy = 100;
        m.habit = Math.min(m.habit, 5);
        adjust(m, 'mood', wobble(rng, 10));
        m.hidden.stamina = clamp(m.hidden.stamina + 5, 1, 99);
        m.hidden.vice = clamp(m.hidden.vice - 3, 1, 99);
        m.hidden.loyalty = clamp(m.hidden.loyalty + 3, 1, 99);
        revealLog(s, m, 'stamina', 1);
        break;
      case 'yogi':
        adjust(m, 'energy', wobble(rng, 15));
        adjust(m, 'mood', wobble(rng, 10));
        adjust(m, 'habit', wobble(rng, -5));
        if (m.hidden.ego >= 60) { m.hidden.ego = clamp(m.hidden.ego - 2, 1, 99); }
        break;
      case 'shrink':
        adjust(m, 'energy', wobble(rng, 10));
        adjust(m, 'mood', wobble(rng, m.mood < 40 ? 28 : 18));
        adjust(m, 'habit', wobble(rng, -4));
        if (m.hidden.ego >= 65) { m.hidden.ego = clamp(m.hidden.ego - 4, 1, 99); revealLog(s, m, 'ego', 2); }
        m.hidden.reliability = clamp(m.hidden.reliability + 2, 1, 99);
        revealLog(s, m, 'reliability', 1);
        break;
    }
    if (option === 'sleep' && m.habit >= 50) {
      adjust(m, 'mood', wobble(rng, -6));
      log(s, `${subj(m, 'spent', 'spent')} the quiet week climbing the walls.`, 'bad');
    }
  }
  if (option === 'seaside') forEachPair(s.members, (a, b) => addAffinity(s, a.id, b.id, rng.int(2, 6)));
  if (option === 'spa' || option === 'bahamas' || option === 'retreat') {
    forEachPair(s.members, (a, b) => addAffinity(s, a.id, b.id, rng.int(option === 'spa' ? 4 : 8, option === 'spa' ? 8 : 16)));
    s.tightness = clamp(s.tightness + (option === 'retreat' ? 6 : 2), 0, 100);
    if (option !== 'spa') addBuzz(s, 4);
  }
  if (option === 'retreat') {
    const best = [...s.members].sort((x, y) => y.writing - x.writing)[0];
    for (let i = 0; i < 2; i++) {
      newSong(s, rng, best.writing * 0.8 + 12 + rng.int(-6, 12), best, 'standard', player(s).style);
    }
  }
  if (option === 'sanatorium' && rng.chance(0.5)) { addBuzz(s, 5); for (const m of s.members) adjust(m, 'image', 1); log(s, `${PRESS} ran "${s.bandName.toUpperCase()}: OUR MONTH IN THE MOUNTAINS" with a photo of the drummer in a dressing gown. Record sales are up. So is sympathy.`, 'neutral'); }
  if (option === 'clinic' && s.members.some((m) => m.habit >= 20) && rng.chance(0.25)) { const x = [...s.members].sort((a, b) => b.habit - a.habit)[0]; adjust(x, 'habit', 15); log(s, `${first(x)} climbed out of a window on day nine and was found in a pub in Esher. Back for the last session, slightly ashamed.`, 'bad'); }
  if (option === 'mum') {
    s.money += 5 * s.members.length;
    earn(s, 'other', 5 * s.members.length);
    addBuzz(s, -4);
  }
  const text: Record<string, string> = {
    sleep: 'A quiet week. Sleep, toast and daytime telly.',
    seaside: 'Day trip to Brighton. Chips on the pier, a group photo, nobody fell in the sea.',
    dry: 'The drinks cupboard is padlocked. The band is sober, sweaty and short-tempered.',
    mum: "Everyone went home to their mum's. Clean laundry, Sunday roasts and a fiver each.",
    spa: 'A week at a spa hotel in the Cotswolds. Mud, massages and a padlocked minibar. Everyone came back glowing.',
    clinic: 'A fortnight in a clinic in Surrey: locked doors, group sessions, a doctor who has seen every band in the charts. Everyone came out clean, thin and furious.',
    sanatorium: 'A month in a sanatorium above Lake Geneva: mountain air, a famous doctor, no telephone and no visitors. The band came back clean, calm, and built to last a little longer next time.',
    yogi: 'A weekend in Totnes with a yogi called Ravi. Breathing, lentils, and a long talk about the ego that the drummer took personally.',
    shrink: 'Six sessions each with a Harley Street psychiatrist. Nobody will say what came up. Everybody is sleeping better.',
    bahamas: 'Two weeks in the Bahamas. Sun, sea and a band that remembered why it liked each other. The tan made the papers.',
    retreat: 'A villa in Ibiza with a pool and a grand piano. Songs got written. Some of them by the pool.',
  };
  log(s, text[option], option === 'dry' ? 'neutral' : 'good');
}

const PLURAL: Record<Role, string> = { guitar: 'guitarists', bass: 'bassists', drums: 'drummers', keys: 'keyboard players', vocals: 'singers' };

function advertise(s: GameState, rng: Rng, role: Role, option: string): void {
  advertCommentary(s, rng, option, role);
  const style = player(s).style;
  const taken = s.members.flatMap((m) => [m.name, m.realName]);
  const base = clamp(0.2 + s.fans / 2000 + s.buzz / 300, 0, 0.7);
  // Word gets round: a famous band, or a band of good players, hears from better musicians.
  const avgOvr = s.members.reduce((x, m) => x + overall(m), 0) / Math.max(1, s.members.length);
  const boost = Math.round(clamp(5 * Math.log10(Math.max(1, s.fans) / 100), 0, 20) + clamp((avgOvr - 55) / 3, 0, 8));
  const spec = {
    newsagent: { n: 2, pGood: base * 0.35, pAvg: 0.35 },
    classified: { n: 3, pGood: base, pAvg: 0.45 },
    bar: { n: 2, pGood: base + 0.15, pAvg: 0.5 },
    poach: { n: 1, pGood: 1, pAvg: 0 },
  }[option]!;
  s.candidates = Array.from({ length: spec.n }, () => {
    const r = rng.next();
    const tier: Tier = r < spec.pGood ? 'good' : r < spec.pGood + spec.pAvg ? 'average' : 'weak';
    const c = generateMusician(rng, `m${s.nextId++}`, role, tier, style, taken, boost, s.bandGender && s.bandGender !== 'mixed' ? s.bandGender : undefined);
    taken.push(c.name, c.realName);
    c.seen = option === 'poach' ? 60 : option === 'bar' ? 40 : 35;
    if (option === 'poach') {
      c.hidden.loyalty = rng.int(10, 40);
      c.hidden.ego = clamp(c.hidden.ego + 15, 1, 99);
      reveal(c, 'loyalty', 1);
    } else {
      reveal(c, rng.pick(HIDDEN_TRAITS), 1);
    }
    return c;
  });
  s.candidateRole = role;
  const r = ROLE_LABEL[role].toLowerCase();
  const text: Record<string, string> = {
    newsagent: `A card in the newsagent's window: "${ROLE_LABEL[role]} wanted for rock band. No time wasters." Two people rang.`,
    classified: `Ad in ${PRESS}: "${ROLE_LABEL[role]} wanted. Image essential." Three hopefuls turned up to audition.`,
    bar: `A week of buying rounds at the Rat Pit bar. Two ${PLURAL[role]} are interested.`,
    poach: `You took a ${r === 'drums' ? 'drummer' : `${r} player`} from a rival band out for a curry and an envelope of cash.`,
  };
  log(s, text[option], 'neutral');
  if (option === 'bar') {
    const me = player(s);
    adjust(me, 'energy', wobble(rng, -6));
    adjust(me, 'habit', wobble(rng, 2));
  }
  const current = s.members.find((m) => m.role === role && !m.isPlayer);
  if (current && (option === 'classified' || (option === 'newsagent' && rng.chance(0.3)))) {
    adjust(current, 'mood', wobble(rng, -8));
    addAffinity(s, current.id, 'p', -8);
    log(s, `${first(current)} saw the ad. Awkward.`, 'bad');
  }
}

// ---------------------------------------------------------------- weekly record sales

const MARGIN: Record<ReleaseKind, number> = { demo: 0, single: 0.35, ep: 0.9, album: 1.8 };
/** What is left of a copy's margin after an outside publisher takes theirs. */
export const OUTSIDE_CUT = 0.65;
const KIND_DEMAND: Record<ReleaseKind, number> = { demo: 0, single: 1, ep: 0.7, album: 0.6 };
const STREAM: Record<ReleaseKind, IncomeKind> = { demo: 'merch', single: 'singles', ep: 'eps', album: 'albums' };
const UNITS: Record<ReleaseKind, IncomeKind> = { demo: 'other', single: 'u_single', ep: 'u_ep', album: 'u_album' };

/** Records in shops sell for a while after release. Returns this week's units for the charts. */
export function sellRecords(s: GameState, rng: Rng, heat: (age: number) => number): { id: string; title: string; units: number; kind: string }[] {
  const out: { id: string; title: string; units: number; kind: string; label?: string }[] = [];
  for (const r of s.releases) {
    if (r.kind === 'demo') continue;
    const age = s.week - r.week;
    // Sales grow with the fan base, but a hit needs more than a loyal following and the market has a ceiling.
    const following = (s.fans * 0.25) / (1 + s.fans / 150000);
    const demand = (following + s.buzz + 10) * heat(age) * (r.quality / 55) * r.appeal * KIND_DEMAND[r.kind] * mourningBoost(s);
    const raw = Math.max(0, Math.round(demand * (0.85 + rng.next() * 0.3)));
    // Label records sell harder, but the money goes to the label's ledger first.
    const { units, cash } = r.comp === 'bootleg' ? { units: raw, cash: 0 } : labelSales(s, r, raw);
    r.lastWeek = units;
    r.sold += units;
    if (units > 0) {
      if (cash < 0) { const take = Math.round(units * MARGIN[r.kind] * (r.outside ? OUTSIDE_CUT : 1)); s.money += take; earn(s, STREAM[r.kind], take); }
      earn(s, UNITS[r.kind], units);
      // Records win new listeners, but each extra fan is harder to find than the last.
      // Records win new listeners at home and, as far as the band's reach goes, abroad.
      const abroad = r.label ? 1 + (s.flags.reachBonus ?? 0) * 0.4 : 1;
      s.fans += Math.round((units * 0.04 * abroad) / (1 + s.fans / 120000));
      out.push({ id: r.id, title: r.title, units, kind: r.kind, label: r.comp === 'bootleg' ? 'Bootleg' : r.label ? labelById(r.label).name : 'Kebab Shop Records' });
    }
  }
  return out;
}
