// The weekly actions and the choices inside each one.
import { Rng, clamp } from './rng';
import { GENRE_LABEL, HIDDEN_TRAITS, ROLE_LABEL, generateMusician, getToKnow, overall, reveal, type Tier } from './characters';
import { addAffinity, available, chemistry, forEachPair, getAffinity, missingForGig, performance } from './chemistry';
import { PRESS, PRESS_BAD, PRESS_GOOD, VENUES, songTitle } from './names';
import { addBuzz, adjust, first, grow, headline, log, milestone, player, prospects, revealLog, signed, subj, verdict as setVerdict } from './helpers';
import { hotGenres, trend } from './world';
import { weeklyOffers } from './offers';
import { POLICY_HINT, POLICY_LABEL, abandonTour, playTourWeek, startTour, tierById, tierLocked, visibleTiers } from './tour';
import { advertCommentary, gigCommentary, partyCommentary, rehearsalCommentary, releaseCommentary, restCommentary, writingCommentary } from './commentary';
import type { TourPolicy } from './types';
import type { Action, ActionType, GameState, Genre, Musician, ReleaseKind, Role, Song, SongKind } from './types';

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
    openmic: {
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
      const opts: ActionOption[] = [
        { id: 'openmic', label: 'Open mic night', cost: 0, hint: 'No pay. Small crowd, low pressure, easy on the legs.' },
        ...weeklyOffers(s).map((o) => ({ id: `offer_${o.id}`, label: `This week only: ${o.label}`, cost: 0, hint: `£${o.fee}. ${o.hint}` })),
      ];
      VENUES.forEach((v, i) => {
        if (s.fans >= v.minFans) {
          opts.push({ id: `venue${i}`, label: `Headline ${v.name}`, cost: 0, hint: `Up to ${v.capacity} people. £${v.fee} plus a cut of the door.` });
        } else if (i > 0 && s.fans >= VENUES[i - 1].minFans) {
          opts.push({ id: `venue${i}`, label: `Headline ${v.name}`, cost: 0, hint: `Up to ${v.capacity} people.`, locked: `The promoter wants ${v.minFans} fans. You have ${s.fans}.` });
        }
      });
      const sup = supportAct(s);
      if (sup) {
        opts.push({
          id: 'support', label: `Support ${sup.name}`, cost: 0, hint: 'Their crowd, not yours. £15 fee and a chance to steal some fans.',
          locked: s.fans < 40 ? 'Their manager has never heard of you. Get 40 fans first.' : undefined,
        });
      }
      opts.push({ id: 'paytoplay', label: 'Pay to play at The Velvet Cellar', cost: 60, hint: 'You keep nothing. A proper Soho stage looks good.' });
      const miss = missingForGig(s);
      if (miss.length) for (const o of opts) o.locked = `You need ${miss.join(' and ')} to gig.`;
      return opts;
    }
    case 'rehearse':
      return [
        { id: 'regular', label: 'Usual rehearsal', cost: 0, hint: 'Steady progress. Egos may collide.' },
        { id: 'bootcamp', label: 'Boot camp week, no booze', cost: 0, hint: 'Much tighter and drier. Morale suffers.' },
        { id: 'coach', label: 'Hire a session pro to coach you', cost: 60, hint: 'Everyone plays better. Some will resent being taught.' },
        { id: 'stageshow', label: 'Work on the stage show', cost: 35, hint: 'Moves, poses and a smoke machine. Stage presence up.' },
        { id: 'lessons', label: `Private lessons for ${lessonTarget(s) ? (lessonTarget(s)!.isPlayer ? 'yourself' : first(lessonTarget(s)!)) : 'the weakest player'}`, cost: 40, hint: 'Your weakest link gets a teacher. Proud players may take it badly.' },
      ];
    case 'write': {
      const hot = hotGenres(s.week)[0];
      return [
        { id: 'jam', label: 'Jam it out together', cost: 0, hint: 'Best writers lead. Good for the band, may produce nothing.' },
        { id: 'solo', label: 'Write it yourself', cost: 0, hint: 'Your song, your way. The others may sulk.' },
        { id: 'trend', label: `Chase the trend: ${GENRE_LABEL[hot].toLowerCase()}`, cost: 0, hint: 'Sells better right now. Purists in the band will hate it.' },
        { id: 'ballad', label: 'Write a power ballad', cost: 0, hint: 'Hit or embarrassment. Lighters up, credibility down.' },
      ];
    }
    case 'release': {
      const need = (n: number) => (unreleased < n ? `Needs ${n} unreleased songs. You have ${unreleased}.` : undefined);
      return [
        { id: 'demo', label: 'Demo tape on a four-track', cost: 30, hint: 'Sell tapes at gigs, send one to the radio.', locked: s.songs.length < 3 ? `Needs 3 songs. You have ${s.songs.length}.` : undefined },
        { id: 'single', label: 'Self-financed 7" single', cost: 300, hint: 'A real record in real shops. Can chart if enough people buy it.', locked: need(2) },
        { id: 'ep', label: 'Self-financed 12" EP', cost: 650, hint: 'Four songs. Sells slower, earns more per copy.', locked: need(4) },
        { id: 'album', label: 'Self-financed album', cost: 1500, hint: 'Eight songs. Huge risk without a label behind you.', locked: need(8) },
      ];
    }
    case 'party':
      return [
        { id: 'cans', label: 'Cans in the rehearsal room', cost: 5, hint: 'Cheap, cheerful, nobody gets hurt. Probably.' },
        { id: 'squat', label: 'Party at the squat', cost: 15, hint: 'Good for morale, bad for livers.' },
        { id: 'soho', label: 'Night out in the Soho clubs', cost: 40, hint: 'Be seen with the right people. Easy to lose the plot.' },
        { id: 'throw', label: 'Throw your own party', cost: 90, hint: 'Everyone will talk about it. Neighbours may call the police.' },
      ];
    case 'rest':
      return [
        { id: 'sleep', label: 'Sleep it off', cost: 0, hint: 'Energy back, a little drier.' },
        { id: 'seaside', label: 'Day trip to Brighton', cost: 25, hint: 'Chips, sea air and band bonding.' },
        { id: 'dry', label: 'Lock the drinks cupboard', cost: 0, hint: 'Habits drop fast. Withdrawal is grim.' },
        { id: 'mum', label: "Everyone goes home to their mum's", cost: 0, hint: 'Full recovery and a fiver each. The scene forgets you a bit.' },
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
    case 'write': return write(s, rng, a.option);
    case 'release': return release(s, rng, a.option as ReleaseKind);
    case 'party': return party(s, rng, a.option);
    case 'rest': return rest(s, rng, a.option);
    case 'advertise': return advertise(s, rng, a.role ?? 'guitar', a.option);
    case 'tour':
      if (a.option === 'abandon') return abandonTour(s);
      if (a.option.startsWith('continue')) {
        s.tour!.policy = (a.option.split(':')[1] as TourPolicy | undefined) ?? s.tour!.policy;
        return playTourWeek(s, rng);
      }
      return startTour(s, rng, a.option, a.weeks ?? tierById(a.option)!.minWeeks, a.policy ?? 'steady');
  }
}

function gig(s: GameState, rng: Rng, g: GigSpec): void {
  const wasted = new Set<string>();
  for (const m of available(s)) {
    const p = (m.habit / 100) * 0.45 + ((100 - m.hidden.reliability) / 100) * 0.15;
    if (rng.chance(p * 0.6)) wasted.add(m.id);
  }
  const perf = performance(s, wasted);
  const crowd = clamp(g.crowd(s, rng), 6, g.capacity);
  const wastedMembers = available(s).filter((m) => wasted.has(m.id));
  gigCommentary(s, rng, { venue: g.venue, crowd, capacity: g.capacity, perf, wasted: wastedMembers });
  for (const m of wastedMembers) revealLog(s, m, m.habit >= 40 ? 'vice' : 'reliability', 1);
  const pay = g.fee + Math.round(crowd * 2 * g.door);
  const fashion = 0.75 + trend(player(s).style, s.week) * 0.4;
  // Playing the same London rooms mostly reaches people who already know you.
  const novelty = clamp(1 - s.fans / (g.capacity * 8), 0.05, 1);
  const raw = ((crowd * (perf - 42)) / 90) * g.fanMult * (perf > 42 ? novelty : 1);
  const fanDelta = Math.max(Math.round(raw > 0 ? raw * fashion : raw), -Math.round(crowd * 0.1));
  s.money += pay;
  s.fans = Math.max(0, s.fans + fanDelta);
  addBuzz(s, Math.max(0, (perf - 45) / 5) + crowd / 60 + g.buzzBonus);
  if (s.lastGigWeek === null) milestone(s, 'career', `First gig: ${g.venue}, ${crowd} people.`);
  s.lastGigWeek = s.week;
  const verdict = perf >= 75 ? 'Storming.' : perf >= 55 ? 'A solid night.' : perf >= 40 ? 'Ropey.' : 'A shambles.';
  setVerdict(s, perf >= 75 ? 'Storming' : perf >= 55 ? 'Solid' : perf >= 40 ? 'Ropey' : 'Shambles', perf >= 55 ? 'good' : perf >= 40 ? 'neutral' : 'bad');
  headline(s, 'Crowd', `${crowd} / ${g.capacity}`);
  log(s, `Gig: ${g.venue}. ${crowd} people${pay ? `, £${pay}` : ''}. ${verdict} Fans ${signed(fanDelta)}.`, perf >= 55 ? 'good' : 'bad');

  g.after?.(s, rng, perf, crowd);

  const demo = s.releases.find((r) => r.kind === 'demo');
  if (demo) {
    const tapes = Math.round(crowd * 0.12 * (perf >= 50 ? 1 : 0.5));
    if (tapes > 0) {
      demo.sold += tapes;
      s.money += Math.round(tapes * 1.5);
      log(s, `Sold ${tapes} demo tapes at the merch table.`, 'good');
    }
  }

  const energyMult = g.energyMult * (s.flags.roadie ? 0.8 : 1) * (s.flags.noVan ? 1.3 : 1);
  for (const m of available(s)) {
    adjust(m, 'energy', -22 * (1.4 - m.hidden.stamina / 100) * energyMult);
    adjust(m, 'mood', perf >= 50 ? 5 : perf < 40 ? -6 : 0);
    adjust(m, 'habit', (m.hidden.vice / 50) * rng.int(0, 2));
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

function rehearse(s: GameState, rng: Rng, option: string): void {
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
    adjust(m, 'energy', option === 'bootcamp' ? -16 : -8);
    if (option === 'bootcamp') {
      adjust(m, 'habit', -6);
      adjust(m, 'mood', -8);
    }
    if (option === 'coach') {
      grow(m, 'skill', 3, rng);
      reveal(m, 'potential', 1);
      if (m.hidden.ego >= 70) {
        adjust(m, 'mood', -6);
        log(s, `${subj(m, 'did not', 'did not')} enjoy being told how to play by a man in a cardigan.`, 'bad');
        revealLog(s, m, 'ego', 1);
      }
    }
    if (option === 'stageshow') {
      grow(m, 'stage', 3, rng);
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
        adjust(t, 'mood', -6);
        log(s, `${first(t)} took private lessons as an insult, then took them anyway.`, 'neutral');
        revealLog(s, t, 'ego', 1);
      } else {
        adjust(t, 'mood', 4);
        log(s, `${subj(t, 'had', 'had')} a week of private lessons with an old jazz teacher in Archway.`, 'good');
      }
    }
  }
  if (option === 'coach') {
    log(s, `The session pro's verdict: ${here.map((m) => `${m.isPlayer ? 'you' : first(m)} ${m.isPlayer ? prospects(m).replace('has', 'have') : prospects(m)}`).join(', ')}.`, 'reveal');
  }
  s.tightness = clamp(s.tightness + gain, 0, 100);
  headline(s, 'Tightness', String(s.tightness));
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
  grow(writer, 'writing', 1, rng, 0.5);
  const song: Song = { title: songTitle(rng), quality: clamp(Math.round(quality), 1, 99), writer: writer.id, kind, genre, released: false };
  s.songs.push(song);
  const kindText = kind === 'ballad' ? 'power ballad' : kind === 'trend' ? `${GENRE_LABEL[genre].toLowerCase()} song` : 'song';
  log(s, `New ${kindText}: "${song.title}" (${song.quality}), mostly ${writer.isPlayer ? 'yours' : `${first(writer)}'s`}.`, song.quality >= 55 ? 'good' : 'neutral');
  headline(s, 'New song', `${song.quality}`);
  setVerdict(s, song.quality >= 65 ? 'A belter' : song.quality >= 50 ? 'Keeper' : 'Filler', song.quality >= 50 ? 'good' : 'neutral');
  return song;
}

function write(s: GameState, rng: Rng, option: string): void {
  const here = available(s);
  writingCommentary(s, rng, option);
  const me = player(s);
  const writers = [...here].sort((a, b) => b.writing - a.writing);
  const best = writers[0];
  const second = writers[1] ?? best;
  const chem = chemistry(s).total;
  const base = best.writing * 0.45 + second.writing * 0.25 + chem * 0.2;

  if (option === 'solo') {
    me.energy = clamp(me.energy - 10, 0, 100);
    if (rng.chance(clamp(0.3 - me.writing / 300, 0.05, 0.3))) {
      log(s, 'A week alone with a guitar and a notebook. Nothing worth keeping.', 'bad');
      return;
    }
    newSong(s, rng, me.writing * 0.75 + chem * 0.1 + rng.int(-12, 18), me, 'solo', me.style);
    for (const m of here) {
      if (!m.isPlayer && m.hidden.ego >= 65 && m.writing >= 40) {
        adjust(m, 'mood', -5);
        addAffinity(s, m.id, me.id, -4);
        log(s, `${first(m)} asked why nobody wanted their ideas.`, 'bad');
        revealLog(s, m, 'ego', 1);
      }
    }
    return;
  }

  for (const m of here) adjust(m, 'energy', -5);
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
        adjust(m, 'mood', -6);
        log(s, `${first(m)} called the new song "a sell-out" and played it with their eyes shut.`, 'bad');
      }
    }
  } else if (option === 'ballad') {
    newSong(s, rng, base + rng.int(-18, 25), best, 'ballad', me.style);
    for (const m of here) {
      if (!m.isPlayer && (m.style === 'metal' || m.style === 'punk')) {
        adjust(m, 'mood', -5);
        log(s, `${first(m)} is not happy about the key change.`, 'bad');
      }
    }
  }
}

export const RELEASE_SONGS: Record<ReleaseKind, number> = { demo: 3, single: 2, ep: 4, album: 8 };
const RELEASE_LABEL: Record<ReleaseKind, string> = { demo: 'demo tape', single: '7" single', ep: '12" EP', album: 'album' };

function release(s: GameState, rng: Rng, kind: ReleaseKind): void {
  releaseCommentary(s, kind, rng);
  const pool = kind === 'demo' ? [...s.songs] : s.songs.filter((x) => !x.released);
  const songs = pool.sort((a, b) => b.quality - a.quality).slice(0, RELEASE_SONGS[kind]);
  const studio = kind === 'demo' ? -8 : kind === 'single' ? 0 : 3;
  const quality = clamp(Math.round(songs.reduce((a, x) => a + x.quality, 0) / songs.length + s.tightness * 0.1 + studio + rng.int(-4, 4)), 1, 99);
  const appeal =
    songs.reduce((a, x) => a + (x.kind === 'ballad' ? 1.25 : 1) * (0.7 + trend(x.genre, s.week) * 0.5), 0) / songs.length;
  const title = songs[0].title;
  if (kind === 'demo') {
    s.releases = s.releases.filter((r) => r.kind !== 'demo');
  } else {
    for (const x of songs) x.released = true;
  }
  s.releases.push({ id: `rel${s.nextId++}`, kind, title, quality, appeal, week: s.week, sold: 0, lastWeek: 0 });
  milestone(s, 'release', `Released "${title}", ${RELEASE_LABEL[kind]}${kind === 'demo' ? '' : ' on Kebab Shop Records'}.`);
  addBuzz(s, kind === 'demo' ? 3 : kind === 'single' ? 6 : 9);
  // Hearing yourself back on tape is humbling, and educational.
  for (const m of available(s)) {
    adjust(m, 'energy', -8);
    grow(m, 'skill', 1, rng, 0.35);
    grow(m, 'writing', 1, rng, 0.2);
  }
  s.tightness = clamp(s.tightness + 3, 0, 100);
  log(s, `${s.bandName} recorded a ${RELEASE_LABEL[kind]}: "${title}" (${quality}).${kind === 'demo' ? ' Tapes go on the merch table.' : ' Out now on your own label, Kebab Shop Records.'}`, 'good');
}

function party(s: GameState, rng: Rng, option: string): void {
  const here = available(s);
  const p = { cans: [7, 4, [0, 3]], squat: [14, 12, [2, 8]], soho: [16, 18, [4, 10]], throw: [20, 20, [5, 12]] }[option] as [number, number, [number, number]];
  for (const m of here) {
    adjust(m, 'mood', p[0]);
    adjust(m, 'energy', -p[1]);
    adjust(m, 'habit', (m.hidden.vice / 100) * rng.int(p[2][0], p[2][1]));
  }
  forEachPair(here, (a, b) => addAffinity(s, a.id, b.id, rng.int(1, option === 'cans' ? 3 : 6)));
  const wildest = [...here].sort((a, b) => b.hidden.vice - a.hidden.vice)[0];
  const text: Record<string, string> = {
    cans: 'Cans and a ghetto blaster in the rehearsal room.',
    squat: `Party at the squat. ${subj(wildest, 'were', 'was')} still going at six in the morning.`,
    soho: `A night in the Soho clubs. ${subj(wildest, 'were', 'was')} spotted dancing on a table at three a.m.`,
    throw: `${s.bandName} threw a party. Half of Camden came, the other half heard it.`,
  };
  partyCommentary(s, rng, option, wildest);
  log(s, text[option], 'neutral');
  if (option !== 'cans') revealLog(s, wildest, 'vice', 1);
  const buzzChance = { cans: 0.03, squat: 0.2, soho: 0.45, throw: 1 }[option]!;
  if (rng.chance(buzzChance)) {
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

function rest(s: GameState, rng: Rng, option: string): void {
  restCommentary(s, option, rng);
  for (const m of s.members) {
    switch (option) {
      case 'sleep':
        adjust(m, 'energy', m.habit > 50 ? 20 : 35);
        adjust(m, 'mood', 4);
        adjust(m, 'habit', -8);
        break;
      case 'seaside':
        adjust(m, 'energy', 30);
        adjust(m, 'mood', 12);
        adjust(m, 'habit', -6);
        break;
      case 'dry':
        adjust(m, 'energy', 25);
        adjust(m, 'mood', m.habit >= 40 ? -18 : -6);
        if (m.habit >= 40) revealLog(s, m, 'vice', 1);
        adjust(m, 'habit', -18);
        break;
      case 'mum':
        adjust(m, 'energy', 45);
        adjust(m, 'mood', -3);
        adjust(m, 'habit', -10);
        break;
    }
    if (option === 'sleep' && m.habit >= 50) {
      adjust(m, 'mood', -6);
      log(s, `${subj(m, 'spent', 'spent')} the quiet week climbing the walls.`, 'bad');
    }
  }
  if (option === 'seaside') forEachPair(s.members, (a, b) => addAffinity(s, a.id, b.id, rng.int(2, 6)));
  if (option === 'mum') {
    s.money += 5 * s.members.length;
    addBuzz(s, -4);
  }
  const text: Record<string, string> = {
    sleep: 'A quiet week. Sleep, toast and daytime telly.',
    seaside: 'Day trip to Brighton. Chips on the pier, a group photo, nobody fell in the sea.',
    dry: 'The drinks cupboard is padlocked. The band is sober, sweaty and short-tempered.',
    mum: "Everyone went home to their mum's. Clean laundry, Sunday roasts and a fiver each.",
  };
  log(s, text[option], option === 'dry' ? 'neutral' : 'good');
}

const PLURAL: Record<Role, string> = { guitar: 'guitarists', bass: 'bassists', drums: 'drummers', keys: 'keyboard players', vocals: 'singers' };

function advertise(s: GameState, rng: Rng, role: Role, option: string): void {
  advertCommentary(s, rng, option, role);
  const style = player(s).style;
  const taken = s.members.flatMap((m) => [m.name, m.realName]);
  const base = clamp(0.2 + s.fans / 2000 + s.buzz / 300, 0, 0.7);
  const spec = {
    newsagent: { n: 2, pGood: base * 0.35, pAvg: 0.35 },
    classified: { n: 3, pGood: base, pAvg: 0.45 },
    bar: { n: 2, pGood: base + 0.15, pAvg: 0.5 },
    poach: { n: 1, pGood: 1, pAvg: 0 },
  }[option]!;
  s.candidates = Array.from({ length: spec.n }, () => {
    const r = rng.next();
    const tier: Tier = r < spec.pGood ? 'good' : r < spec.pGood + spec.pAvg ? 'average' : 'weak';
    const c = generateMusician(rng, `m${s.nextId++}`, role, tier, style, taken);
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
    adjust(me, 'energy', -6);
    adjust(me, 'habit', 2);
  }
  const current = s.members.find((m) => m.role === role && !m.isPlayer);
  if (current && (option === 'classified' || (option === 'newsagent' && rng.chance(0.3)))) {
    adjust(current, 'mood', -8);
    addAffinity(s, current.id, 'p', -8);
    log(s, `${first(current)} saw the ad. Awkward.`, 'bad');
  }
}

// ---------------------------------------------------------------- weekly record sales

const MARGIN: Record<ReleaseKind, number> = { demo: 0, single: 0.35, ep: 0.9, album: 1.8 };
const KIND_DEMAND: Record<ReleaseKind, number> = { demo: 0, single: 1, ep: 0.7, album: 0.6 };

/** Records in shops sell for a while after release. Returns this week's units for the charts. */
export function sellRecords(s: GameState, rng: Rng, heat: (age: number) => number): { id: string; title: string; units: number; kind: string }[] {
  const out: { id: string; title: string; units: number; kind: string }[] = [];
  for (const r of s.releases) {
    if (r.kind === 'demo') continue;
    const age = s.week - r.week;
    const demand = (s.fans * 0.25 + s.buzz + 10) * heat(age) * (r.quality / 55) * r.appeal * KIND_DEMAND[r.kind];
    const units = Math.max(0, Math.round(demand * (0.85 + rng.next() * 0.3)));
    r.lastWeek = units;
    r.sold += units;
    if (units > 0) {
      s.money += Math.round(units * MARGIN[r.kind]);
      // Records win new listeners, but each extra fan is harder to find than the last.
      s.fans += Math.round(units * 0.04 * (3000 / (3000 + s.fans)));
      out.push({ id: r.id, title: r.title, units, kind: r.kind });
    }
  }
  return out;
}
