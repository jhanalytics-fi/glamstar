// Random situations. Choice events stop the week until the player picks a response; news events just happen.
import { Rng, clamp } from './rng';
import { addAffinity, available, forEachPair, getAffinity, performance } from './chemistry';
import { PRESS, songTitle } from './names';
import { addBuzz, adjust, beat, first, grow, log, logEffects, milestone, mutate, openScene, player, removeMember, revealLog, setVibe, snapshot, subj } from './helpers';
import { pickRivalName } from './world';
import { managerWord, newManager } from './managers';
import type { GameState, HiddenTrait, Musician } from './types';
import { TOUR_EVENTS } from './tourEvents';
import { ROMANCE_EVENTS } from './romanceEvents';
import { LABEL_EVENTS } from './labelEvents';
import { MONEY_EVENTS } from './moneyEvents';
import { CALAMITY_EVENTS } from './calamityEvents';
import { STARDOM_EVENTS } from './stardomEvents';
import { CATALOGUE_EVENTS } from './catalogueEvents';
import { RUIN_EVENTS } from './ruinEvents';
import { FANCLUB_EVENTS } from './fanclubEvents';
import { KIT_EVENTS } from './kitEvents';
import { WHEELS, nextWheels, setWheels, wheelsOf } from './wheels';

type Params = Record<string, string | number>;

export interface EventOption {
  label: string;
  hint: string;
  cost?: number;
  locked?: string;
  resolve: (s: GameState, rng: Rng, p: Params) => void;
}

export interface EventDef {
  id: string;
  weight: number;
  /** 'home' events never happen on tour, 'tour' events only on tour. Default: both. */
  where?: 'home' | 'tour';
  /** Big enough to interrupt a tour that is being played through in one go. */
  big?: boolean;
  when: (s: GameState, rng: Rng) => Params | null;
  title: (s: GameState, p: Params) => string;
  text: (s: GameState, p: Params) => string;
  options: (s: GameState, p: Params) => EventOption[];
}

const mem = (s: GameState, id: string | number) => s.members.find((m) => m.id === id)!;
const mates = (s: GameState) => s.members.filter((m) => !m.isPlayer && m.outWeeks === 0);
const nm = (s: GameState, id: string | number) => first(mem(s, id));
const pron = (m: Musician) => (m.isPlayer ? 'you' : first(m));

function worstPair(s: GameState): [Musician, Musician] | null {
  let worst: [Musician, Musician] | null = null;
  let low = Infinity;
  forEachPair(mates(s), (a, b) => {
    const v = getAffinity(s, a.id, b.id);
    if (v < low) { low = v; worst = [a, b]; }
  });
  return worst;
}

type Stat = Parameters<typeof adjust>[1];
const year = (s: GameState) => 1982 + Math.floor(s.week / 52);
const isPurist = (m: Musician) => m.style === 'metal' || m.style === 'punk';
const purists = (s: GameState) => s.members.filter(isPurist);
const everyone = (s: GameState, k: Stat, d: number) => { for (const m of s.members) adjust(m, k, d); };
const tighten = (s: GameState, d: number) => { s.tightness = clamp(s.tightness + d, 0, 100); };
const addGear = (s: GameState, d: number) => { s.gear = clamp(s.gear + d, 0, 5); };
const trait = (m: Musician, t: HiddenTrait, d: number) => { m.hidden[t] = clamp(m.hidden[t] + d, 1, 99); };
/** True if the flag was never set, or was set at least `weeks` weeks ago. */
const since = (s: GameState, flag: string, weeks: number) => s.flags[flag] === undefined || s.week - s.flags[flag] >= weeks;
const bestUnreleased = (s: GameState) => [...s.songs].filter((x) => !x.released).sort((a, b) => b.quality - a.quality)[0];
const song = (s: GameState, title: string | number) => s.songs.find((x) => x.title === title);
const loudest = (s: GameState) => [...mates(s)].sort((a, b) => b.hidden.ego - a.hidden.ego)[0];

/** Bigger wheels for a bigger band: offered when the money and the fan base say so. */
const WHEELS_EVENT: EventDef = {
  id: 'wheels_upgrade',
  weight: 3,
  where: 'home',
  when: (s) => {
    const w = nextWheels(s);
    return w && s.fans >= WHEELS[w].fans && s.money >= WHEELS[w].price * 1.3 && since(s, 'wheelsOffer', 20) ? { w } : null;
  },
  title: (_s, p) => (p.w === 'jet' ? 'A jet, going cheap' : p.w === 'coach' ? 'A tour bus with your name on it' : 'A splitter van, one careful owner'),
  text: (s, p) => {
    const spec = WHEELS[p.w as keyof typeof WHEELS];
    return `${p.w === 'jet' ? 'A broker with a tan has a second-hand executive jet, ex-oil company, "barely used".' : p.w === 'coach' ? 'A coach firm in Luton is selling a proper tour bus: bunks, a lounge, a driver who comes with it.' : 'A band that split last month is selling their splitter van: bunks in the back, a fridge, a stereo.'} ${spec.word} £${spec.price.toLocaleString('en-GB')}, and ${spec.weekly ? `about £${spec.weekly.toLocaleString('en-GB')} a week to run on tour` : 'cheap to run'}. Right now ${s.bandName} travels in ${WHEELS[wheelsOf(s)].name.toLowerCase()}.`;
  },
  options: (_s, p) => {
    const w = p.w as 'splitter' | 'coach' | 'jet';
    return [
      {
        label: `Buy it: £${WHEELS[w].price.toLocaleString('en-GB')}`,
        hint: w === 'jet' ? 'Nobody arrives tired again. Nobody arrives rich either.' : w === 'coach' ? 'Sleep on the move, arrive human. The running costs are real.' : 'Bunks and a fridge. The band arrives with its spine intact.',
        cost: WHEELS[w].price,
        resolve: (st) => {
          st.flags.wheelsOffer = st.week;
          setWheels(st, w);
          for (const m of st.members) { adjust(m, 'mood', 8); adjust(m, 'image', w === 'jet' ? 3 : 1); }
          addBuzz(st, w === 'jet' ? 12 : w === 'coach' ? 5 : 2);
          milestone(st, 'career', `Bought ${WHEELS[w].name.toLowerCase()}.`);
          log(st, w === 'jet' ? `${st.bandName} now owns a jet. ${PRESS} ran a photo of the band on the steps, waving, like a government. The fuel bill arrived the same afternoon.` : w === 'coach' ? 'The tour bus arrived outside the rehearsal room and blocked the street. The driver is called Trevor. Trevor has rules.' : 'The splitter van has a name painted on the side that is not yours. Nobody has the heart to change it.', 'good');
        },
      },
      { label: 'Not yet', hint: 'The money stays in the bank.', resolve: (st) => { st.flags.wheelsOffer = st.week; log(st, 'You let it go. The band carries on as it is, and complains about it.', 'neutral'); } },
    ];
  },
};

const BASE_EVENTS: EventDef[] = [
  {
    id: 'fight',
    weight: 3,
    when: (s, rng) => {
      const w = worstPair(s);
      if (!w) return null;
      // Mates who get on do not come to blows. The worse the pair, the likelier the punch.
      const bad = getAffinity(s, w[0].id, w[1].id);
      const clash = w[0].hidden.ego >= 70 && w[1].hidden.ego >= 70;
      const odds = bad < -20 ? 0.9 : bad < 10 ? 0.5 : bad < 35 ? (clash ? 0.35 : 0.15) : clash ? 0.08 : 0.02;
      if (!rng.chance(odds)) return null;
      return { a: w[0].id, b: w[1].id, about: rng.pick(['the setlist', 'the last can of lager', 'a girlfriend', 'the front seat of the van', 'who owes who a fiver']) };
    },
    title: (s, p) => `${nm(s, p.a)} and ${nm(s, p.b)} are at it again`,
    text: (_s, p) => `A fistfight in the rehearsal room over ${p.about}. A cymbal stand is bent. Everyone is looking at you.`,
    options: (s, p) => {
      const a = mem(s, p.a);
      const b = mem(s, p.b);
      const side = (x: Musician, y: Musician): EventOption => ({
        label: `Take ${first(x)}'s side`,
        hint: `${first(x)} will remember it. So will ${first(y)}.`,
        resolve: (st) => {
          addAffinity(st, x.id, 'p', 10);
          addAffinity(st, y.id, 'p', -15);
          adjust(mem(st, y.id), 'mood', -10);
          log(st, `You backed ${first(x)}. ${first(y)} sulked for the rest of the week.`, 'bad');
        },
      });
      return [
        side(a, b),
        side(b, a),
        {
          label: 'Drag them both to the pub to sort it out',
          hint: 'A few rounds. Works more often than it should.',
          cost: 10,
          resolve: (st, rng) => {
            const egos = a.hidden.ego >= 70 && b.hidden.ego >= 70;
            if (!egos || rng.chance(0.4)) {
              addAffinity(st, a.id, b.id, 18);
              log(st, `Three pints later ${first(a)} and ${first(b)} were singing together. Sorted.`, 'good');
            } else {
              addAffinity(st, a.id, b.id, -5);
              log(st, `Round two happened in the pub car park.`, 'bad');
              revealLog(st, mem(st, a.id), 'ego', 1);
              revealLog(st, mem(st, b.id), 'ego', 1);
            }
            for (const m of [mem(st, a.id), mem(st, b.id)]) adjust(m, 'habit', 2);
          },
        },
        {
          label: 'Stay out of it',
          hint: 'Not your fight. It may get worse.',
          resolve: (st) => {
            addAffinity(st, a.id, b.id, -10);
            const egoist = a.hidden.ego > b.hidden.ego ? a : b;
            log(st, `You let them get on with it. ${first(egoist)} clearly thinks they won.`, 'neutral');
            revealLog(st, mem(st, egoist.id), 'ego', 1);
          },
        },
      ];
    },
  },
  {
    id: 'rent',
    weight: 2,
    when: (s) => (s.week > 6 && !s.flags.rentUp ? {} : null),
    title: () => 'The landlord wants more',
    text: () => 'Mr Demetriou from the kebab shop says the noise is putting customers off. He wants £60, or the rent goes up for good.',
    options: () => [
      { label: 'Pay the £60', hint: 'Problem solved, for now.', cost: 60, resolve: (st) => log(st, 'You paid. Mr Demetriou threw in a free kebab.', 'neutral') },
      {
        label: 'Argue your case',
        hint: 'Your charm against his ledger.',
        resolve: (st, rng) => {
          const me = player(st);
          if (rng.chance(0.25 + me.stage / 200)) log(st, 'You talked him round. He wants a signed photo for the shop wall.', 'good');
          else {
            st.flags.rentUp = 6;
            log(st, 'He was not impressed. Rent is up £6 a week, permanently.', 'bad');
          }
        },
      },
      {
        label: "Move rehearsals to someone's garage",
        hint: 'Cold and cramped. The band will grumble.',
        resolve: (st) => {
          for (const m of st.members) adjust(m, 'mood', -5);
          st.tightness = clamp(st.tightness - 5, 0, 100);
          log(st, 'Rehearsals moved to a freezing garage in Walthamstow.', 'bad');
        },
      },
    ],
  },
  {
    id: 'arrest',
    weight: 2,
    when: (s, rng) => {
      const c = mates(s).filter((m) => m.hidden.vice + m.hidden.ego >= 110);
      if (!c.length || (s.lastGigWeek === null && !s.flags.lastBigParty)) return null;
      return { m: rng.pick(c).id };
    },
    title: (s, p) => `${nm(s, p.m)} has been arrested`,
    text: (s, p) => `${nm(s, p.m)} threw a punch outside the pub and spent the night in a cell at Holborn. The desk sergeant says bail is £80.`,
    options: (s, p) => {
      const m = mem(s, p.m);
      return [
        {
          label: 'Pay the bail',
          hint: 'Loyalty is earned.',
          cost: 80,
          resolve: (st) => {
            const x = mem(st, m.id);
            adjust(x, 'mood', 8);
            addAffinity(st, x.id, 'p', 12);
            x.hidden.loyalty = clamp(x.hidden.loyalty + 8, 1, 99);
            log(st, `You bailed ${first(x)} out. ${first(x)} owes you one.`, 'good');
          },
        },
        {
          label: 'Leave them there overnight',
          hint: 'A lesson, or a grudge.',
          resolve: (st) => {
            const x = mem(st, m.id);
            adjust(x, 'mood', -12);
            addAffinity(st, x.id, 'p', -12);
            log(st, `${first(x)} got out the next morning and did not say thank you.`, 'bad');
          },
        },
        {
          label: `Ring ${first(m)}'s mum`,
          hint: 'Humiliating, but effective.',
          resolve: (st) => {
            const x = mem(st, m.id);
            adjust(x, 'mood', -6);
            adjust(x, 'image', -2);
            adjust(x, 'habit', -6);
            log(st, `${first(x)}'s mum came down from ${x.from} in her dressing gown. Everybody heard about it.`, 'neutral');
          },
        },
        {
          label: `Tip off ${PRESS}`,
          hint: 'Publicity at a friend’s expense.',
          resolve: (st) => {
            const x = mem(st, m.id);
            addBuzz(st, 8);
            adjust(x, 'mood', -10);
            addAffinity(st, x.id, 'p', -20);
            log(st, `"Rock thug in pub punch-up" made page 3 of ${PRESS}. ${first(x)} knows who told them.`, 'neutral');
          },
        },
      ];
    },
  },
  {
    id: 'interview',
    weight: 2,
    when: (s, rng) => {
      if (s.buzz < 15) return null;
      const talker = [...mates(s)].sort((a, b) => b.stage + b.hidden.ego - (a.stage + a.hidden.ego))[0];
      return { rival: pickRivalName(s.world, rng), t: talker?.id ?? '' };
    },
    title: () => `${PRESS} wants an interview`,
    text: () => 'A journalist with a tape recorder and a hangover is waiting in the pub. Twenty minutes, then the photographer.',
    options: (s, p) => {
      const opts: EventOption[] = [
        { label: 'Play it straight', hint: 'Honest and a bit dull.', resolve: (st) => { addBuzz(st, 3); log(st, 'A polite interview. "Promising," says the headline.', 'neutral'); } },
        {
          label: 'Tell outrageous lies',
          hint: 'Great copy, if nobody checks.',
          resolve: (st, rng) => {
            if (rng.chance(0.7)) { addBuzz(st, 9); log(st, 'You told them the drummer was raised by wolves. They printed it.', 'good'); }
            else { addBuzz(st, -4); log(st, 'They checked. "Fantasists" is the headline.', 'bad'); }
          },
        },
        {
          label: `Slag off ${p.rival}`,
          hint: 'Everyone loves a feud. They will hear about it.',
          resolve: (st) => {
            addBuzz(st, 10);
            st.flags.feud = st.week;
            log(st, `You called ${p.rival} "a tribute act to themselves". The letters page went wild.`, 'good');
          },
        },
      ];
      if (p.t) {
        const t = mem(s, p.t);
        opts.push({
          label: `Let ${first(t)} do the talking`,
          hint: 'Could be brilliant. Could be a disaster.',
          resolve: (st, rng) => {
            const x = mem(st, t.id);
            const gain = rng.int(-4, 12);
            addBuzz(st, gain);
            adjust(x, 'mood', 10);
            if (x.hidden.ego >= 70) { addAffinity(st, x.id, 'p', -6); revealLog(st, x, 'ego', 1); }
            log(st, gain > 4 ? `${first(x)} was a natural. The photographer loved them.` : `${first(x)} talked about their star sign for twenty minutes.`, gain > 4 ? 'good' : 'bad');
          },
        });
      }
      opts.push({ label: 'Decline', hint: 'Mystery is a strategy too.', resolve: (st) => { addBuzz(st, -1); log(st, 'You turned the interview down. Mysterious, or rude.', 'neutral'); } });
      return opts;
    },
  },
  {
    id: 'dealer',
    weight: 2,
    when: (s) => {
      const tired = s.members.reduce((a, m) => a + m.energy, 0) / s.members.length;
      return tired < 55 ? {} : null;
    },
    title: () => 'A man called Sniffy',
    text: () => 'Backstage, a bloke in a leather coat offers "a little something to keep you going". The band looks knackered.',
    options: () => [
      {
        label: 'Buy for the whole band',
        hint: 'Energy now, a habit later.',
        cost: 30,
        resolve: (st) => {
          for (const m of available(st)) {
            adjust(m, 'energy', 30);
            adjust(m, 'habit', (m.hidden.vice / 100) * 15 + 3);
          }
          const w = [...available(st)].sort((a, b) => b.hidden.vice - a.hidden.vice)[0];
          setVibe(st, 'trip');
          beat(st, '23:10', 'The room tilts. The bass amp is talking to you. It has opinions.');
          revealLog(st, w, 'vice', 1);
          log(st, 'The band was buzzing all week. Nobody slept. Sniffy has your phone number now.', 'neutral');
        },
      },
      {
        label: 'Just for you',
        hint: 'Nobody needs to know.',
        cost: 10,
        resolve: (st) => {
          const me = player(st);
          adjust(me, 'energy', 35);
          adjust(me, 'habit', 12);
          setVibe(st, 'trip');
          beat(st, '02:30', 'The street lights are humming your chorus. In harmony.');
          log(st, 'You felt like a god for six hours, and like death for two days.', 'neutral');
        },
      },
      {
        label: 'Tell him to get lost',
        hint: 'Clean, and a bit square.',
        resolve: (st) => {
          for (const m of mates(st)) if (m.hidden.vice >= 70) adjust(m, 'mood', -5);
          log(st, 'Sniffy left. Somebody in the band went after him.', 'neutral');
        },
      },
    ],
  },
  {
    id: 'yoko',
    weight: 1,
    when: (s, rng) => {
      const c = mates(s);
      return c.length >= 2 ? { m: rng.pick(c).id, partner: rng.pick(['Tina', 'Lorraine', 'Gaz', 'Michelle', 'Stu', 'Debs']) } : null;
    },
    title: (s, p) => `${nm(s, p.m)}'s other half wants in`,
    text: (s, p) => `${p.partner}, ${nm(s, p.m)}'s other half, wants to sing backing vocals. ${p.partner} cannot sing.`,
    options: (s, p) => {
      const m = mem(s, p.m);
      return [
        {
          label: 'Let them sing at the next gig',
          hint: `${first(m)} will be thrilled. The rest of the band will not.`,
          resolve: (st) => {
            adjust(mem(st, m.id), 'mood', 10);
            for (const o of st.members) if (o.id !== m.id && !o.isPlayer) { adjust(o, 'mood', -6); addAffinity(st, o.id, m.id, -8); }
            st.tightness = clamp(st.tightness - 4, 0, 100);
            log(st, `${p.partner} sang. Loudly. The band is not speaking to ${first(m)}.`, 'bad');
          },
        },
        {
          label: 'Put them on the merch stall',
          hint: 'Diplomacy, and someone to mind the cash box.',
          resolve: (st) => {
            adjust(mem(st, m.id), 'mood', 3);
            st.money += 20;
            log(st, `${p.partner} runs the merch stall now. Sales are up, oddly.`, 'good');
          },
        },
        {
          label: 'Absolutely not',
          hint: 'The band comes first.',
          resolve: (st) => {
            adjust(mem(st, m.id), 'mood', -12);
            addAffinity(st, m.id, 'p', -10);
            log(st, `${first(m)} called you a dictator. ${p.partner} called you worse.`, 'bad');
          },
        },
      ];
    },
  },
  {
    id: 'control',
    weight: 2,
    when: (s) => {
      const c = mates(s).filter((m) => m.hidden.ego >= 68 && m.writing >= 40 && m.weeksInBand >= 4);
      return c.length ? { m: c[0].id } : null;
    },
    title: (s, p) => `${nm(s, p.m)} wants more say`,
    text: (s, p) => `${nm(s, p.m)} says the set is "your songs and nothing else" and wants more of their material in it. Or else.`,
    options: (s, p) => {
      const m = mem(s, p.m);
      return [
        {
          label: 'Share the songwriting credits',
          hint: `${first(m)} will be happy. You will be poorer, in spirit.`,
          resolve: (st) => {
            const x = mem(st, m.id);
            adjust(x, 'mood', 15);
            addAffinity(st, x.id, 'p', 12);
            adjust(player(st), 'mood', -5);
            revealLog(st, x, 'ego', 2);
            log(st, `Credits are now "${first(player(st))} / ${first(x)}". ${first(x)} bought a round.`, 'good');
          },
        },
        {
          label: 'One of their songs goes in the set',
          hint: 'A compromise, and maybe a decent song.',
          resolve: (st, rng) => {
            const x = mem(st, m.id);
            adjust(x, 'mood', 6);
            const q = clamp(Math.round(x.writing * 0.8 + rng.int(-10, 12)), 1, 99);
            const t = songTitle(rng);
            st.songs.push({ title: t, quality: q, writer: x.id, kind: 'standard', genre: x.style, released: false });
            log(st, `"${t}" (${q}), by ${first(x)}, is in the set.`, q >= 50 ? 'good' : 'neutral');
          },
        },
        {
          label: 'Refuse',
          hint: 'Your band, your rules. They might walk.',
          resolve: (st, rng) => {
            const x = mem(st, m.id);
            adjust(x, 'mood', -15);
            addAffinity(st, x.id, 'p', -15);
            if (x.hidden.loyalty < 35 && rng.chance(0.4)) {
              removeMember(st, x.id, 'quit');
              log(st, `${x.name} walked out and took their songs with them.`, 'bad');
            } else {
              log(st, `${first(x)} backed down. For now.`, 'neutral');
              revealLog(st, x, 'loyalty', 1);
            }
          },
        },
        {
          label: 'Fire them on the spot',
          hint: 'Nobody threatens you.',
          resolve: (st) => removeMember(st, m.id, 'fired'),
        },
      ];
    },
  },
  {
    id: 'van',
    weight: 1,
    when: (s) => (wheelsOf(s) === 'van' && s.lastGigWeek !== null && since(s, 'vanDied', 45) ? {} : null),
    title: () => 'The van died on the A406',
    text: () => 'Steam, a bang, and a smell of burning clutch. A garage will fix it. Or you could not.',
    options: (s) => {
      const fixer = [...mates(s)].sort((a, b) => b.hidden.reliability - a.hidden.reliability)[0];
      const opts: EventOption[] = [
        { label: 'Take it to a garage', hint: 'Done properly.', cost: 90, resolve: (st) => { st.flags.vanDied = st.week; log(st, 'The van is fixed. The mechanic found a shoe in the engine.', 'neutral'); } },
      ];
      if (fixer) {
        opts.push({
          label: `Let ${first(fixer)} have a go`,
          hint: 'A spanner and some optimism.',
          resolve: (st, rng) => {
            st.flags.vanDied = st.week;
            if (rng.chance(0.55)) log(st, `${first(fixer)} fixed it with a coat hanger. Legend.`, 'good');
            else { st.money -= 40; for (const m of st.members) adjust(m, 'mood', -4); log(st, `${first(fixer)} made it worse. The garage charged £40 anyway.`, 'bad'); }
          },
        });
      }
      opts.push({
        label: 'Sell it for scrap',
        hint: 'Get £150 now. Gigs on the night bus wear everyone out.',
        resolve: (st) => { st.flags.vanDied = st.week; st.money += 150; setWheels(st, 'bus'); log(st, 'The van went for £150. The band now travels by night bus with a bass amp.', 'neutral'); },
      });
      return opts;
    },
  },
  {
    id: 'transit',
    weight: 3,
    when: (s) => (wheelsOf(s) === 'bus' ? {} : null),
    title: () => 'An old van for sale',
    text: () => 'A mate of a mate is selling a van. Rust holds it together. £120.',
    options: () => [
      { label: 'Buy it', hint: 'Wheels again.', cost: 120, resolve: (st) => { setWheels(st, 'van'); log(st, 'The band has a van again. It smells of sheep.', 'good'); } },
      { label: 'Keep taking the bus', hint: 'Save the money.', resolve: (st) => log(st, 'Another winter of night buses.', 'neutral') },
    ],
  },
  {
    id: 'gear',
    weight: 2,
    when: (s, rng) => (s.gear < 4 && s.money >= 100 ? { item: rng.pick(['a second-hand 100-watt stack', 'a drum kit with only one cracked cymbal', 'a proper PA from a band that split up', 'a cherry-red guitar with a whammy bar']) } : null),
    title: () => 'A gear bargain',
    text: (_s, p) => `Someone is selling ${p.item} for £150. Better gear, better sound.`,
    options: () => [
      { label: 'Buy it', hint: 'The band sounds bigger.', cost: 150, resolve: (st) => { st.gear++; log(st, 'New gear. The band sounds twice as expensive.', 'good'); } },
      {
        label: 'Haggle',
        hint: 'Could get it cheaper. Could lose it.',
        resolve: (st, rng) => {
          if (rng.chance(0.5)) { st.money -= 100; st.gear++; log(st, 'Got it for £100 and a pint. Bargain.', 'good'); }
          else log(st, 'The seller got offended and sold it to someone else.', 'bad');
        },
      },
      { label: 'Pass', hint: 'Keep the money.', resolve: (st) => log(st, 'You passed on the gear.', 'neutral') },
    ],
  },
  {
    id: 'roadie',
    weight: 2,
    when: (s, rng) => (s.fans >= 60 && !s.flags.roadie ? { name: rng.pick(['Big Keith', 'Mad Terry', 'Little Phil', 'Sandra', 'Animal Al']) } : null),
    title: (_s, p) => `${p.name} wants to be your roadie`,
    text: (_s, p) => `${p.name}, a fan who has been to every gig, offers to hump the gear for free. Beer money only.`,
    options: (_s, p) => [
      { label: 'Welcome aboard', hint: 'Gigs get easier on everyone.', resolve: (st) => { st.flags.roadie = 1; log(st, `${p.name} is now your roadie. The gear has never been so well looked after.`, 'good'); } },
      { label: 'Thanks, but no', hint: 'You do your own lifting.', resolve: (st) => log(st, `${p.name} was heartbroken but still comes to every gig.`, 'neutral') },
    ],
  },
  {
    id: 'battle',
    weight: 2,
    when: (s, rng) => (s.fans >= 20 && s.fans <= 600 ? { rival: pickRivalName(s.world, rng) } : null),
    title: () => 'Battle of the Bands at the Rat Pit',
    text: (_s, p) => `Six bands, one night, £100 prize. ${p.rival} are the favourites.`,
    options: (_s, p) => [
      {
        label: 'Enter',
        hint: 'Glory or humiliation, in public.',
        cost: 10,
        resolve: (st, rng) => {
          const perf = performance(st);
          if (perf + rng.int(-15, 15) >= 55) {
            st.money += 100; st.fans += 40; addBuzz(st, 8);
            for (const m of st.members) adjust(m, 'mood', 10);
            log(st, `You won the Battle of the Bands! ${p.rival} demanded a recount.`, 'good');
          } else {
            st.fans += 10;
            for (const m of st.members) adjust(m, 'mood', -6);
            log(st, `${p.rival} won. You came fourth, behind a man with a keytar.`, 'bad');
          }
          for (const m of available(st)) adjust(m, 'energy', -10);
        },
      },
      { label: 'Give it a miss', hint: 'Competitions are for school bands.', resolve: (st) => log(st, 'You skipped the Battle of the Bands.', 'neutral') },
    ],
  },
  {
    id: 'raid',
    weight: 6,
    when: (s) => (s.flags.lastBigParty !== undefined && s.week - s.flags.lastBigParty <= 1 && !s.flags.raided ? {} : null),
    title: () => 'Police at the door',
    text: () => 'Your party is still going when two constables knock. There is a lot in the house that should not be.',
    options: () => [
      {
        label: 'Flush everything',
        hint: 'Expensive, and the party is over.',
        resolve: (st) => {
          st.flags.raided = st.week; st.money -= 20;
          for (const m of st.members) { adjust(m, 'mood', -6); adjust(m, 'habit', -4); }
          log(st, 'The toilet has never seen so much money go down it. The police found nothing.', 'neutral');
        },
      },
      {
        label: 'Talk your way out',
        hint: 'Your charm against the law.',
        resolve: (st, rng) => {
          st.flags.raided = st.week;
          const me = player(st);
          if (rng.chance(0.2 + (me.stage + me.image) / 300)) { addBuzz(st, 3); log(st, 'The sergeant left with an autograph for his daughter.', 'good'); }
          else { st.money -= 100; addBuzz(st, 6); log(st, 'Fined £100 for "a breach of the peace". At least it made the papers.', 'bad'); }
        },
      },
      {
        label: 'Leg it out the back',
        hint: 'Legendary if it works.',
        resolve: (st, rng) => {
          st.flags.raided = st.week;
          addBuzz(st, 5);
          const slow = [...available(st)].sort((a, b) => a.hidden.stamina - b.hidden.stamina)[0];
          if (rng.chance(0.5) && slow) {
            slow.outWeeks = Math.max(slow.outWeeks, 1); st.money -= 50;
            log(st, `${subj(slow, 'got', 'got')} caught on the garden fence. A night in the cells and a £50 fine.`, 'bad');
            revealLog(st, slow, 'stamina', 1);
          } else log(st, 'Everyone got away over the back wall. The story improves every time it is told.', 'good');
        },
      },
    ],
  },
  {
    id: 'tv',
    weight: 2,
    when: (s) => (s.buzz >= 30 && !s.flags.tvDone ? {} : null),
    title: () => 'Saturday morning telly',
    text: () => 'Wakey Wakey Saturday wants you to mime a song between a puppet badger and a magician. Millions of kids, and their older siblings.',
    options: (s) => {
      const purists = s.members.filter((m) => m.style === 'metal' || m.style === 'punk');
      return [
        {
          label: 'Do it, full glam',
          hint: 'Huge exposure. The purists will cringe.',
          resolve: (st) => {
            st.flags.tvDone = 1; st.fans += 90; addBuzz(st, 10);
            for (const m of purists) adjust(mem(st, m.id) ?? m, 'mood', -10);
            log(st, 'You mimed next to a puppet badger. The phone has not stopped ringing.', 'good');
          },
        },
        {
          label: 'Do it, then wreck the set',
          hint: 'Instant legend. Also a bill.',
          resolve: (st) => {
            st.flags.tvDone = 1; st.fans += 50; addBuzz(st, 18); st.money -= 60;
            for (const m of st.members) adjust(m, 'mood', 8);
            log(st, 'You kicked over the badger. Banned for life, front page on Monday, £60 for the puppet.', 'good');
          },
        },
        {
          label: 'Turn it down',
          hint: 'Credibility intact.',
          resolve: (st) => {
            st.flags.tvDone = 1;
            for (const m of purists) adjust(m, 'mood', 5);
            log(st, 'You turned down kids’ TV. The purists in the band are proud.', 'neutral');
          },
        },
      ];
    },
  },
  {
    id: 'health',
    weight: 3,
    when: (s) => {
      const c = s.members.filter((m) => m.habit >= 60 && m.outWeeks === 0);
      return c.length ? { m: c[0].id } : null;
    },
    title: (s, p) => (mem(s, p.m).isPlayer ? 'You collapsed at rehearsal' : `${nm(s, p.m)} collapsed at rehearsal`),
    text: (s, p) => `${mem(s, p.m).isPlayer ? 'You' : nm(s, p.m)} went grey and hit the floor halfway through the first song. Back on their feet now, sort of.`,
    options: (s, p) => {
      const m = mem(s, p.m);
      return [
        {
          label: 'Doctor and a dry fortnight',
          hint: 'Two weeks out. The sensible thing.',
          cost: 40,
          resolve: (st) => {
            const x = mem(st, m.id);
            x.outWeeks = 2; adjust(x, 'habit', -30); adjust(x, 'mood', -5);
            log(st, `${subj(x, 'are', 'is')} off for two weeks on doctor's orders.`, 'neutral');
          },
        },
        {
          label: 'Black coffee and carry on',
          hint: 'Show must go on. Might end badly.',
          resolve: (st, rng) => {
            const x = mem(st, m.id);
            adjust(x, 'habit', 3);
            if (rng.chance(0.35)) {
              x.outWeeks = 3; st.money -= 60; x.habit = 45;
              log(st, `${subj(x, 'collapsed', 'collapsed')} again two days later. Three weeks in the clinic.`, 'bad');
              revealLog(st, x, 'vice', 2);
            } else log(st, `${subj(x, 'seem', 'seems')} fine. For now.`, 'neutral');
          },
        },
        {
          label: 'Whole band cuts down together',
          hint: 'Solidarity. Everyone suffers a bit.',
          resolve: (st) => {
            for (const o of st.members) { adjust(o, 'habit', -8); adjust(o, 'mood', -5); addAffinity(st, o.id, m.id, 5); }
            log(st, `The band went on the wagon together for ${pron(mem(st, m.id))}'s sake.`, 'good');
          },
        },
      ];
    },
  },
  {
    id: 'radio',
    weight: 3,
    when: (s) => (s.releases.some((r) => r.kind === 'demo') && s.buzz >= 10 && !s.flags.radioDone ? {} : null),
    title: () => 'Kenny Vole wants a session',
    text: () => 'Late-night DJ Kenny Vole heard your demo tape. He offers a live session on his show, or he could just play the tape.',
    options: () => [
      {
        label: 'Play live on air',
        hint: 'High risk, high reward.',
        resolve: (st, rng) => {
          st.flags.radioDone = 1;
          if (performance(st) + rng.int(-12, 12) >= 50) { addBuzz(st, 12); st.fans += 50; log(st, 'The session was a triumph. Kenny played it again the next night.', 'good'); }
          else { addBuzz(st, 3); log(st, 'The session went out live. So did the bass amp, halfway through.', 'bad'); }
        },
      },
      { label: 'Let him play the tape', hint: 'Safe and modest.', resolve: (st) => { st.flags.radioDone = 1; addBuzz(st, 5); st.fans += 20; log(st, 'Kenny played the demo twice in one night.', 'good'); } },
      {
        label: 'Bribe him with a bottle of whisky',
        hint: 'Play it every night for a week.',
        cost: 15,
        resolve: (st) => { st.flags.radioDone = 1; addBuzz(st, 8); st.fans += 35; log(st, 'The tape got played every night. Kenny sounded happier every night.', 'good'); },
      },
    ],
  },
  {
    id: 'poach',
    weight: 2,
    when: (s, rng) => {
      const c = mates(s).filter((m) => m.skill >= 50).sort((a, b) => a.hidden.loyalty - b.hidden.loyalty)[0];
      return c && s.fans >= 40 ? { m: c.id, rival: pickRivalName(s.world, rng) } : null;
    },
    title: (s, p) => `${p.rival} want ${nm(s, p.m)}`,
    text: (s, p) => `${p.rival} have offered ${nm(s, p.m)} a place. They have a manager and a proper van.`,
    options: (s, p) => {
      const m = mem(s, p.m);
      return [
        {
          label: 'Offer a bigger cut',
          hint: 'Money talks.',
          cost: 40,
          resolve: (st) => {
            const x = mem(st, m.id);
            x.hidden.loyalty = clamp(x.hidden.loyalty + 15, 1, 99); adjust(x, 'mood', 5);
            log(st, `${first(x)} took the money and stayed.`, 'good');
          },
        },
        {
          label: 'Promise them the next A-side',
          hint: 'Flattery. The other writers will mind.',
          resolve: (st) => {
            const x = mem(st, m.id);
            x.hidden.loyalty = clamp(x.hidden.loyalty + 8, 1, 99); adjust(x, 'mood', 10);
            for (const o of mates(st)) if (o.id !== x.id && o.writing >= 40) addAffinity(st, o.id, 'p', -5);
            log(st, `${first(x)} is staying, and expects that A-side.`, 'neutral');
          },
        },
        {
          label: 'Call their bluff',
          hint: 'Depends how loyal they really are.',
          resolve: (st) => {
            const x = mem(st, m.id);
            if (x.hidden.loyalty >= 35) { adjust(x, 'mood', 4); log(st, `${first(x)} told ${p.rival} where to go.`, 'good'); revealLog(st, x, 'loyalty', 1); }
            else { removeMember(st, x.id, 'poached'); log(st, `${x.name} has joined ${p.rival}. Good luck finding a replacement.`, 'bad'); }
          },
        },
        {
          label: 'Let them go',
          hint: 'Nobody is bigger than the band.',
          resolve: (st) => { removeMember(st, m.id, 'poached'); log(st, `${m.name} left for ${p.rival} with your blessing.`, 'neutral'); },
        },
      ];
    },
  },
  {
    id: 'christmas',
    weight: 20,
    when: (s) => (s.week % 52 === 49 && s.flags.xmas !== Math.floor(s.week / 52) ? {} : null),
    title: () => 'Christmas',
    text: () => "Mum wants everyone home for Christmas. The Crown & Gutter wants a Christmas Eve gig and offers £80 and a turkey.",
    options: () => [
      {
        label: 'Go home for Christmas',
        hint: 'Rest and family. The scene goes quiet.',
        resolve: (st) => {
          st.flags.xmas = Math.floor(st.week / 52);
          for (const m of st.members) { adjust(m, 'energy', 40); adjust(m, 'mood', 12); adjust(m, 'habit', -6); }
          addBuzz(st, -4);
          log(st, 'Christmas at home. Socks, sprouts and the Queen’s speech.', 'good');
        },
      },
      {
        label: 'Play the Christmas Eve gig',
        hint: 'Pays £80 and wins fans. Homesick band.',
        resolve: (st) => {
          st.flags.xmas = Math.floor(st.week / 52);
          st.money += 80; st.fans += 20; addBuzz(st, 3);
          for (const m of st.members) { adjust(m, 'mood', -6); adjust(m, 'habit', 4); }
          log(st, 'You played the same Christmas song four times. The turkey was dry.', 'neutral');
        },
      },
    ],
  },

  // ================================================================ the band
  {
    id: 'straight_job',
    weight: 2,
    when: (s, rng) => {
      const c = mates(s).filter((m) => m.weeksInBand >= 4 && !s.flags[`straight_${m.id}`]);
      if (s.week < 8 || !c.length) return null;
      const m = [...c].sort((a, b) => a.hidden.loyalty - b.hidden.loyalty)[0];
      return {
        m: m.id,
        what: rng.pick([
          'a place at a polytechnic to read quantity surveying',
          'a trainee manager job at a carpet warehouse in Purley',
          'an apprenticeship with an uncle who fits double glazing',
          'a clerk job at the council, with luncheon vouchers',
        ]),
      };
    },
    title: (s, p) => `${nm(s, p.m)} has been offered a real life`,
    text: (s, p) => `${nm(s, p.m)} has been offered ${p.what}. Their mum has already told the neighbours. They want to know if the band is "actually going anywhere".`,
    options: (s, p) => {
      const m = mem(s, p.m);
      const flag = (st: GameState) => { st.flags[`straight_${m.id}`] = st.week; };
      return [
        {
          label: 'Talk them round',
          hint: 'Your powers of persuasion against a pension scheme.',
          resolve: (st, rng) => {
            flag(st);
            const x = mem(st, m.id);
            if (rng.chance(0.3 + x.hidden.loyalty / 150 + player(st).stage / 300)) {
              trait(x, 'loyalty', 6); adjust(x, 'mood', 6);
              log(st, `You described the Odeum sold out and a gold disc on the wall. ${first(x)} turned the job down.`, 'good');
            } else {
              removeMember(st, x.id, 'quit');
              log(st, `${x.name} took the job. They still come to gigs, in a tie.`, 'bad');
            }
          },
        },
        {
          label: 'Offer a bigger cut',
          hint: 'Money keeps them. The others will notice.',
          cost: 60,
          resolve: (st) => {
            flag(st);
            const x = mem(st, m.id);
            trait(x, 'loyalty', 12); adjust(x, 'mood', 6);
            for (const o of mates(st)) if (o.id !== x.id) adjust(o, 'mood', -3);
            log(st, `${first(x)} stays, on a bigger cut. The rest of the band did the maths out loud.`, 'neutral');
          },
        },
        {
          label: 'Suggest they do both',
          hint: 'Days at the job, nights in the band. Something will give.',
          resolve: (st) => {
            flag(st);
            const x = mem(st, m.id);
            adjust(x, 'energy', -15); adjust(x, 'mood', 4); trait(x, 'reliability', -6);
            log(st, `${first(x)} took the job and kept the band. They now fall asleep in the van in a cardigan.`, 'neutral');
          },
        },
        {
          label: 'Wish them luck',
          hint: 'A clean break. They might leave something behind.',
          resolve: (st) => {
            flag(st);
            const x = mem(st, m.id);
            removeMember(st, x.id, 'quit');
            addGear(st, 1);
            log(st, `${x.name} left on good terms and gave the band their amp. "I won't be needing it in surveying."`, 'neutral');
          },
        },
      ];
    },
  },
  {
    id: 'ill_parent',
    weight: 1,
    when: (s, rng) => {
      const c = mates(s).filter((m) => !s.flags[`ill_${m.id}`]);
      if (s.week < 10 || !c.length) return null;
      return { m: rng.pick(c).id, who: rng.pick(['mum', 'dad']) };
    },
    title: (s, p) => `${nm(s, p.m)}'s ${p.who} is in hospital`,
    text: (s, p) => `${nm(s, p.m)}'s ${p.who} has been taken into hospital back in ${mem(s, p.m).from}. ${nm(s, p.m)} has gone very quiet and keeps looking at the payphone.`,
    options: (s, p) => {
      const m = mem(s, p.m);
      const flag = (st: GameState) => { st.flags[`ill_${m.id}`] = st.week; };
      return [
        {
          label: 'Send them home, with a whip-round',
          hint: 'Two weeks without them. They will not forget it.',
          cost: 30,
          resolve: (st) => {
            flag(st);
            const x = mem(st, m.id);
            x.outWeeks = Math.max(x.outWeeks, 2); trait(x, 'loyalty', 12); adjust(x, 'mood', 5);
            addAffinity(st, x.id, 'p', 12);
            log(st, `${first(x)} got the train to ${x.from} with the whip-round in an envelope. They rang on Sunday: the ${p.who} is on the mend.`, 'good');
          },
        },
        {
          label: 'Give them the week off',
          hint: 'Kind, and the band loses a week together.',
          resolve: (st) => {
            flag(st);
            const x = mem(st, m.id);
            x.outWeeks = Math.max(x.outWeeks, 1); trait(x, 'loyalty', 6);
            addAffinity(st, x.id, 'p', 6);
            tighten(st, -3);
            log(st, `${first(x)} went home for a week and came back looking ten years older but relieved.`, 'neutral');
          },
        },
        {
          label: 'Ask them to play this week first',
          hint: 'The band stays sharp. It will cost you with them.',
          resolve: (st) => {
            flag(st);
            const x = mem(st, m.id);
            adjust(x, 'mood', -10); trait(x, 'loyalty', -6);
            addAffinity(st, x.id, 'p', -10);
            tighten(st, 2);
            log(st, `${first(x)} played, eyes on the door all night, then caught the first train in the morning. Nobody mentioned it again.`, 'bad');
          },
        },
      ];
    },
  },
  {
    id: 'ex_returns',
    weight: 2,
    when: (s, rng) => {
      const c = mates(s);
      if (!c.length || s.lastGigWeek === null) return null;
      return { m: rng.pick(c).id, ex: rng.pick(['Jackie', 'Dean', 'Lorna', 'Big Col', 'Paula', 'Vince']) };
    },
    title: (s, p) => `${nm(s, p.m)}'s ex is at the bar`,
    text: (s, p) => `${p.ex}, who left ${nm(s, p.m)} for a man with a hot tub in Chigwell, is at the front of tonight's crowd. Waving.`,
    options: (s, p) => {
      const m = mem(s, p.m);
      return [
        {
          label: 'Let them backstage',
          hint: 'Could be a reunion. Could be a war.',
          resolve: (st, rng) => {
            const x = mem(st, m.id);
            if (rng.chance(0.5)) { adjust(x, 'mood', 12); log(st, `${first(x)} and ${p.ex} talked till closing. ${first(x)} has been humming ever since.`, 'good'); }
            else { adjust(x, 'mood', -12); adjust(x, 'energy', -10); log(st, `${p.ex} and ${first(x)} reopened every old wound in the corridor. The promoter asked you to keep it down.`, 'bad'); }
          },
        },
        {
          label: 'Get the bouncer to show them out',
          hint: `${first(m)} may be secretly grateful. Or not.`,
          resolve: (st) => {
            const x = mem(st, m.id);
            adjust(x, 'mood', -4);
            addAffinity(st, x.id, 'p', x.hidden.loyalty >= 50 ? 6 : -6);
            log(st, `${p.ex} was escorted to the night bus. ${first(x)} watched from the stage door and said nothing.`, 'neutral');
          },
        },
        {
          label: 'Buy them a drink and listen',
          hint: 'You will learn things about your bandmate.',
          cost: 10,
          resolve: (st) => {
            const x = mem(st, m.id);
            addAffinity(st, x.id, 'p', -4);
            adjust(player(st), 'mood', -3);
            revealLog(st, x, 'reliability', 1);
            revealLog(st, x, 'loyalty', 1);
            log(st, `${p.ex} talked for two hours. You now know far too much about ${first(x)}, and ${first(x)} knows you know.`, 'neutral');
          },
        },
      ];
    },
  },
  {
    id: 'guru',
    weight: 1,
    when: (s, rng) => {
      const c = mates(s);
      if (year(s) < 1983 || s.flags.guru || !c.length) return null;
      return {
        m: rng.pick(c).id,
        guru: rng.pick(['a swami from Swindon called Baba Derek', 'a macrobiotic nutritionist with a ponytail', 'a crystal healer who used to sell photocopiers']),
      };
    },
    title: (s, p) => `${nm(s, p.m)} has found enlightenment`,
    text: (s, p) => `${nm(s, p.m)} has started following ${p.guru}. They eat brown rice, chant before soundchecks, and called your bass amp "spiritually loud".`,
    options: (s, p) => {
      const m = mem(s, p.m);
      return [
        {
          label: 'The whole band tries it',
          hint: 'Cleaner living. Grumpier band.',
          cost: 20,
          resolve: (st) => {
            st.flags.guru = st.week;
            for (const x of st.members) { adjust(x, 'habit', -8); adjust(x, 'energy', 5); adjust(x, 'mood', -6); }
            adjust(mem(st, m.id), 'mood', 12);
            log(st, 'A week of lentils and chanting. Nobody has been sick, and nobody has been happy.', 'neutral');
          },
        },
        {
          label: 'Live and let live',
          hint: `Good for ${first(m)}. The incense will annoy the others.`,
          resolve: (st) => {
            st.flags.guru = st.week;
            const x = mem(st, m.id);
            adjust(x, 'habit', -6); adjust(x, 'mood', 6);
            for (const o of mates(st)) if (o.id !== x.id) adjust(o, 'mood', -3);
            log(st, `${first(x)} glows with inner peace. The van smells of sandalwood and lentils.`, 'neutral');
          },
        },
        {
          label: 'Take the mickey',
          hint: 'The others will laugh. One of them will not.',
          resolve: (st) => {
            st.flags.guru = st.week;
            const x = mem(st, m.id);
            adjust(x, 'mood', -10);
            addAffinity(st, x.id, 'p', -8);
            for (const o of mates(st)) if (o.id !== x.id) adjust(o, 'mood', 4);
            log(st, `You did twenty minutes as Baba Derek at soundcheck. ${first(x)} meditated through it, furiously.`, 'bad');
          },
        },
      ];
    },
  },
  {
    id: 'band_name',
    weight: 1,
    when: (s, rng) => {
      const c = mates(s).filter((m) => m.hidden.ego >= 60 && m.weeksInBand >= 6);
      if (s.week < 20 || s.flags.renameAsked || !c.length) return null;
      return { m: c[0].id, name: rng.pick(['Krystal Kathedral', 'Thee Velvet Mausoleum', 'Kaptain Leatherhead', 'Neon Sphinx', 'Wyld Kount']) };
    },
    title: (s, p) => `${nm(s, p.m)} wants a new band name`,
    text: (s, p) => `${nm(s, p.m)} says ${s.bandName} "sounds like a building society" and wants to be called ${p.name}. They have already drawn the logo on their jacket.`,
    options: (s, p) => {
      const m = mem(s, p.m);
      return [
        {
          label: 'Keep the name',
          hint: 'The fans know it. The ego in question will sulk.',
          resolve: (st) => {
            st.flags.renameAsked = st.week;
            const x = mem(st, m.id);
            adjust(x, 'mood', -8); addAffinity(st, x.id, 'p', -6);
            log(st, `${first(x)} is still wearing the ${p.name} jacket. Pointedly.`, 'bad');
          },
        },
        {
          label: 'Add an umlaut, as a compromise',
          hint: 'Looks dangerous on posters. Confuses the record shops.',
          resolve: (st) => {
            st.flags.renameAsked = st.week; st.flags.umlaut = 1;
            addBuzz(st, 3); st.fans = Math.max(0, st.fans - 5);
            adjust(mem(st, m.id), 'mood', 4);
            log(st, `The posters now have two dots over a vowel. Nobody knows how to pronounce it, which ${PRESS} called "very heavy".`, 'neutral');
          },
        },
        {
          label: 'Pay for a proper logo instead',
          hint: 'Same name, sharper look. Everybody wins, except the bank balance.',
          cost: 40,
          resolve: (st) => {
            st.flags.renameAsked = st.week;
            adjust(mem(st, m.id), 'mood', 6);
            everyone(st, 'image', 1);
            log(st, 'An art student did the logo in chrome with lightning bolts. It looks like it could kill a man.', 'good');
          },
        },
      ];
    },
  },
  {
    id: 'ritual',
    weight: 1,
    when: (s, rng) => {
      const c = mates(s);
      if (s.lastGigWeek === null || s.flags.ritual || !c.length) return null;
      return {
        m: rng.pick(c).id,
        what: rng.pick([
          'everyone touching a rubber chicken called Gerald',
          'a pickled egg each, eaten in total silence',
          'chanting the band name backwards in the gents',
          'a lap of the venue car park, anticlockwise',
        ]),
      };
    },
    title: (s, p) => `${nm(s, p.m)}'s pre-gig ritual`,
    text: (s, p) => `${nm(s, p.m)} now insists on ${p.what} before every show. Last time you skipped it, a string broke. ${nm(s, p.m)} has not let that go.`,
    options: (s, p) => {
      const m = mem(s, p.m);
      return [
        {
          label: 'Humour them',
          hint: 'Ridiculous, but the band walks on together.',
          resolve: (st) => {
            st.flags.ritual = 1;
            tighten(st, 3); adjust(mem(st, m.id), 'mood', 5);
            log(st, 'The ritual is now law. The band walks on stage oddly calm and smelling faintly of vinegar.', 'good');
          },
        },
        {
          label: 'Make it the band’s trademark',
          hint: 'The fans will copy it. The purists will die inside.',
          resolve: (st) => {
            st.flags.ritual = 2;
            addBuzz(st, 3); st.fans += 10;
            for (const x of purists(st)) adjust(x, 'mood', -4);
            log(st, 'Half the front row now does it too. A fanzine called it "pagan". Sales of pickled eggs are up.', 'good');
          },
        },
        {
          label: 'Ban it',
          hint: 'Rock and roll is not a church. They will be rattled.',
          resolve: (st) => {
            st.flags.ritual = 3;
            const x = mem(st, m.id);
            adjust(x, 'mood', -10); adjust(x, 'stage', -1); addAffinity(st, x.id, 'p', -5);
            log(st, `No more rituals. ${first(x)} played the next gig like someone waiting for a piano to fall on them.`, 'bad');
          },
        },
      ];
    },
  },
  {
    id: 'shoplift',
    weight: 1,
    when: (s, rng) => {
      const c = mates(s).filter((m) => m.hidden.vice >= 60);
      if (!c.length || !since(s, 'shoplift', 30)) return null;
      return { m: rng.pick(c).id, item: rng.pick(['a can of hairspray and a Scotch egg', 'three packets of guitar strings', 'eyeliner and a pork pie', 'a giant tin of travel sweets']) };
    },
    title: (s, p) => `${nm(s, p.m)} has been nicked for shoplifting`,
    text: (s, p) => `A store detective caught ${nm(s, p.m)} walking out with ${p.item} up their jumper. The manager will drop it for a £50 "donation" to the staff Christmas fund.`,
    options: (s, p) => {
      const m = mem(s, p.m);
      return [
        {
          label: 'Pay the donation',
          hint: 'Quiet and quick.',
          cost: 50,
          resolve: (st) => {
            st.flags.shoplift = st.week;
            const x = mem(st, m.id);
            addAffinity(st, x.id, 'p', 6); adjust(x, 'mood', 2);
            log(st, `You paid. The manager wished ${first(x)} a merry Christmas in a voice like a door slamming.`, 'neutral');
          },
        },
        {
          label: 'Let them face the magistrate',
          hint: 'A week of court and shame. A small story.',
          resolve: (st) => {
            st.flags.shoplift = st.week;
            const x = mem(st, m.id);
            x.outWeeks = Math.max(x.outWeeks, 1); adjust(x, 'mood', -8); adjust(x, 'image', -2);
            addBuzz(st, 2);
            revealLog(st, x, 'vice', 1);
            log(st, `${first(x)} was fined and bound over. The local paper printed their real name and their mum's street.`, 'bad');
          },
        },
        {
          label: 'Call it performance art in the press',
          hint: 'Either genius or a second offence of bad taste.',
          resolve: (st, rng) => {
            st.flags.shoplift = st.week;
            const x = mem(st, m.id);
            if (rng.chance(0.5)) { addBuzz(st, 7); adjust(x, 'image', 2); log(st, `${PRESS} ran "Shoplifting as anti-consumerist statement". ${first(x)} is now an artist.`, 'good'); }
            else { addBuzz(st, -3); adjust(x, 'image', -2); log(st, `${PRESS} ran "Band defends pork pie theft". It did not read as art.`, 'bad'); }
          },
        },
      ];
    },
  },
  {
    id: 'hair_disaster',
    weight: 1,
    when: (s, rng) => {
      if (!since(s, 'hair', 40)) return null;
      return {
        m: rng.pick(s.members).id,
        result: rng.pick(['bright orange', 'a perm like a startled poodle', 'a mullet the stylist called "architectural"', 'a sort of swamp green']),
      };
    },
    title: (s, p) => (mem(s, p.m).isPlayer ? 'Your hair' : `${nm(s, p.m)}'s hair`),
    text: (s, p) => `The night before the photo session, a hairdresser in Dalston has left ${mem(s, p.m).isPlayer ? 'you' : nm(s, p.m)} with ${p.result}. The rest of the band cannot look at it without crying.`,
    options: (s, p) => {
      const m = mem(s, p.m);
      return [
        {
          label: 'Shave it all off',
          hint: 'Bold. Might be a look.',
          resolve: (st, rng) => {
            st.flags.hair = st.week;
            const x = mem(st, m.id);
            adjust(x, 'mood', -5);
            if (rng.chance(0.5)) { adjust(x, 'image', 3); log(st, 'Bald and furious is a look, it turns out. The photographer loved it.', 'good'); }
            else { adjust(x, 'image', -3); log(st, 'Bald and furious, mostly furious. The photos look like a police line-up.', 'bad'); }
          },
        },
        {
          label: 'A hat for six weeks',
          hint: 'Safe, sad and sweaty.',
          resolve: (st) => {
            st.flags.hair = st.week;
            const x = mem(st, m.id);
            adjust(x, 'mood', -6); adjust(x, 'image', -1);
            log(st, 'One hat, worn indoors, on stage, in bed. Nobody is fooled.', 'neutral');
          },
        },
        {
          label: 'Own it',
          hint: 'Confidence is ninety per cent of a hairstyle.',
          resolve: (st, rng) => {
            st.flags.hair = st.week;
            const x = mem(st, m.id);
            if (rng.chance(0.6)) { adjust(x, 'image', 3); addBuzz(st, 3); log(st, `${PRESS} called it "the haircut of the year". Two fans copied it already.`, 'good'); }
            else { adjust(x, 'image', -2); addBuzz(st, 1); log(st, 'The photos came out. A dog barked at the poster.', 'bad'); }
          },
        },
        {
          label: 'Get it fixed in a proper salon',
          hint: 'Mayfair prices. Back to normal.',
          cost: 45,
          resolve: (st) => {
            st.flags.hair = st.week;
            const x = mem(st, m.id);
            adjust(x, 'image', 1); adjust(x, 'mood', 4);
            log(st, 'A man called Laurent fixed it with a sigh and a bill.', 'neutral');
          },
        },
      ];
    },
  },
  {
    id: 'makeover',
    weight: 2,
    when: (s, rng) => (year(s) >= 1984 && s.fans >= 100 && !s.flags.makeover ? { who: rng.pick(['Tamsin from a King\'s Road boutique', 'a stylist called Jules who "did a pop video once"', 'Marco, image consultant, ex-hairdresser, ex-con']) } : null),
    title: () => 'Time for a new look?',
    text: (_s, p) => `${p.who} says the band looks "like a darts team". The future is perms, spandex, leopard print and eyeliner. Lots of eyeliner.`,
    options: () => [
      {
        label: 'Full makeover',
        hint: 'Everyone looks like a star. The purists will want to die.',
        cost: 150,
        resolve: (st) => {
          st.flags.makeover = 1;
          everyone(st, 'image', 5);
          for (const x of st.members) adjust(x, 'mood', isPurist(x) ? -10 : 6);
          st.fans += 30;
          log(st, 'Perms, spandex, a leopard-print everything. You look like a burst sofa in the best possible way.', 'good');
        },
      },
      {
        label: 'Just the eyeliner',
        hint: 'A toe in the water.',
        cost: 30,
        resolve: (st) => {
          st.flags.makeover = 2;
          everyone(st, 'image', 2);
          for (const x of purists(st)) adjust(x, 'mood', -3);
          log(st, 'A bit of eyeliner all round. Even the purists admit it hides the hangovers.', 'neutral');
        },
      },
      {
        label: 'No chance',
        hint: 'Credibility over cheekbones.',
        resolve: (st) => {
          st.flags.makeover = 3;
          for (const x of purists(st)) adjust(x, 'mood', 5);
          addBuzz(st, -2);
          log(st, 'You sent the stylist away. Denim and sweat it is.', 'neutral');
        },
      },
    ],
  },
  {
    id: 'brawl',
    weight: 2,
    when: (s, rng) => (s.lastGigWeek !== null && s.fans >= 40 && mates(s).length ? { rival: pickRivalName(s.world, rng) } : null),
    title: (_s, p) => `Trouble with ${p.rival}`,
    text: (_s, p) => `${p.rival} have turned up at your gig, drunk, and their singer has just called your guitarist's mum a word that rhymes with "trollop".`,
    options: (_s, p) => [
      {
        label: 'Wade in',
        hint: 'Legends are born in pub car parks. So are black eyes.',
        resolve: (st, rng) => {
          st.flags.feud = st.week;
          addBuzz(st, 6);
          for (const x of mates(st)) adjust(x, 'energy', -10);
          forEachPair(mates(st), (a, b) => addAffinity(st, a.id, b.id, 4));
          const soft = [...mates(st)].sort((a, b) => a.hidden.stamina - b.hidden.stamina)[0];
          if (soft && rng.chance(0.4)) {
            soft.outWeeks = Math.max(soft.outWeeks, 1);
            log(st, `A glorious punch-up. ${first(soft)} ended it in casualty with a cracked rib.`, 'bad');
          } else log(st, `You chased ${p.rival} down Camden High Street. ${PRESS} has a photo.`, 'good');
        },
      },
      {
        label: 'Get your lot out of there',
        hint: 'Sensible. The hotheads will call you soft.',
        resolve: (st) => {
          for (const x of mates(st)) if (x.hidden.ego >= 60) adjust(x, 'mood', -6);
          addBuzz(st, -1);
          log(st, `You marched the band to the van. ${p.rival} are telling everyone you ran.`, 'neutral');
        },
      },
      {
        label: 'Buy them a round',
        hint: 'Peace in our time. The press likes a feud more.',
        cost: 25,
        resolve: (st) => {
          delete st.flags.feud;
          everyone(st, 'mood', 3); everyone(st, 'habit', 2);
          addBuzz(st, -2);
          log(st, `By last orders you and ${p.rival} were swapping phone numbers and grudges.`, 'neutral');
        },
      },
    ],
  },
  {
    id: 'setlist_theft',
    weight: 1,
    when: (s, rng) => (s.fans >= 60 && since(s, 'setlistTheft', 40) ? { rival: pickRivalName(s.world, rng) } : null),
    title: (_s, p) => `${p.rival} stole your closer`,
    text: (_s, p) => `${p.rival} are ending their set with your encore trick: the fire extinguisher, the slow-motion jump and the "goodnight, London". Same week, same street.`,
    options: (_s, p) => [
      {
        label: 'Write a better closer',
        hint: 'Hard work, and the band gets sharper.',
        resolve: (st) => {
          st.flags.setlistTheft = st.week;
          everyone(st, 'energy', -10); tighten(st, 4);
          log(st, 'A week of rehearsing a new ending. It involves a confetti cannon and a key change.', 'good');
        },
      },
      {
        label: `Complain to ${PRESS}`,
        hint: 'The letters page loves a squabble.',
        resolve: (st) => {
          st.flags.setlistTheft = st.week; st.flags.feud = st.week;
          addBuzz(st, 4);
          log(st, `"${p.rival} are thieves," you wrote. They wrote back. Then you wrote back. ${PRESS} is thrilled.`, 'good');
        },
      },
      {
        label: 'Nick their setlist back',
        hint: 'Pinch their best bit. Could backfire.',
        resolve: (st, rng) => {
          st.flags.setlistTheft = st.week; st.flags.feud = st.week;
          if (rng.chance(0.5)) { addBuzz(st, 5); st.fans += 15; log(st, `You stole their encore and did it better. ${p.rival} are livid.`, 'good'); }
          else { addBuzz(st, -3); log(st, 'Their encore was rubbish on you too. The crowd noticed.', 'bad'); }
        },
      },
    ],
  },

  // ================================================================ life on the road
  {
    id: 'euro_gig',
    weight: 2,
    when: (s, rng) => (s.fans >= 120 && since(s, 'euroGig', 26) ? { town: rng.pick(['Hamburg', 'Rotterdam', 'Eindhoven', 'Bremen', 'Utrecht']), club: rng.pick(['Club Kaput', 'the Zollhaus', 'De Lekke Band', 'the Kesselraum']) } : null),
    title: (_s, p) => `A gig in ${p.town}`,
    text: (_s, p) => `${p.club} in ${p.town} wants you for a Saturday. They pay in cash, feed you, and the crowd "goes absolutely crazy for English bands". Ferry tickets are on you.`,
    options: (_s, p) => [
      {
        label: 'Book the ferry',
        hint: 'Good money, hard miles.',
        cost: 80,
        resolve: (st, rng) => {
          st.flags.euroGig = st.week;
          st.money += 260; st.fans += 40; tighten(st, 5);
          for (const x of st.members) { adjust(x, 'energy', -20); adjust(x, 'habit', 4); }
          if (rng.chance(0.25)) { st.money -= 60; log(st, `${p.town} went wild. Customs at Harwich went wilder and kept £60 of the takings.`, 'neutral'); }
          else log(st, `${p.town} went wild. They threw bratwurst. It was a compliment.`, 'good');
        },
      },
      {
        label: 'Go, and stay for the weekend',
        hint: 'A legend of a weekend. Nobody comes back the same.',
        cost: 120,
        resolve: (st) => {
          st.flags.euroGig = st.week;
          st.money += 260; st.fans += 50; addBuzz(st, 3);
          for (const x of st.members) { adjust(x, 'energy', -25); adjust(x, 'habit', 10); adjust(x, 'mood', 10); }
          setVibe(st, 'trip');
          beat(st, '04:10', `A club under a railway arch in ${p.town}. The strobe is in no hurry and neither are you.`);
          log(st, 'Three days, one gig, no sleep. The van came home smelling of schnapps and regret.', 'neutral');
        },
      },
      {
        label: 'Decline',
        hint: 'Saves the ferry fare. Everyone wanted to go.',
        resolve: (st) => {
          st.flags.euroGig = st.week;
          everyone(st, 'mood', -3);
          log(st, `You turned ${p.town} down. The band spent Saturday in the Crown & Gutter, sulking.`, 'neutral');
        },
      },
    ],
  },
  {
    id: 'support_tour',
    weight: 2,
    when: (s, rng) => (s.fans >= 150 && s.buzz >= 25 && !s.flags.supportTour ? { act: rng.pick(['Sabre Royale', 'Hellcat Mary', 'The Velvet Juggernaut', 'Bastion']) } : null),
    title: (_s, p) => `Support slot with ${p.act}`,
    text: (_s, p) => `${p.act} are touring the country and need a support band. Their manager says the slot is yours for a £300 "buy-on". Or you can have the bottom of the bill for nothing and be treated accordingly.`,
    options: (_s, p) => [
      {
        label: 'Pay the buy-on',
        hint: 'Proper slot, proper crowds, a punishing month.',
        cost: 300,
        resolve: (st) => {
          st.flags.supportTour = st.week;
          st.fans += 180; addBuzz(st, 8); tighten(st, 6);
          for (const x of st.members) { adjust(x, 'energy', -25); adjust(x, 'habit', 5); }
          log(st, `Eighteen nights with ${p.act}. Half their crowd went home with your badge on.`, 'good');
        },
      },
      {
        label: 'Take the free slot',
        hint: 'On stage before the doors open. Character-building.',
        resolve: (st) => {
          st.flags.supportTour = st.week;
          st.fans += 70; tighten(st, 4);
          for (const x of st.members) { adjust(x, 'energy', -20); adjust(x, 'mood', -8); }
          log(st, `No soundcheck, no rider, no dressing room. ${p.act}'s roadies used your van as a toilet. Still: new fans.`, 'neutral');
        },
      },
      {
        label: 'Turn it down',
        hint: 'You headline or nothing. Bold for a band your size.',
        resolve: (st) => {
          st.flags.supportTour = st.week;
          addBuzz(st, -2); adjust(player(st), 'mood', 3);
          log(st, `You told ${p.act}'s manager you only headline. He laughed for a long time.`, 'neutral');
        },
      },
    ],
  },
  {
    id: 'last_orders',
    weight: 2,
    when: (s, rng) => {
      const c = mates(s).filter((m) => m.habit >= 30 || m.hidden.vice >= 60);
      if (s.flags.noVan || s.lastGigWeek === null || !c.length) return null;
      return { m: rng.pick(c).id, town: rng.pick(['Kettering', 'Stoke', 'Basingstoke', 'Peterborough']) };
    },
    title: () => '"I\'m fine to drive"',
    text: (s, p) => `After a gig in ${p.town}, ${nm(s, p.m)} jangles the van keys and says they have "only had six". It is ninety miles back to London. ${nm(s, p.m)} is not fine.`,
    options: (s, p) => {
      const m = mem(s, p.m);
      return [
        {
          label: 'Take the keys. Sleep in the van',
          hint: 'Cold, cramped and alive.',
          resolve: (st) => {
            for (const x of st.members) { adjust(x, 'energy', -12); adjust(x, 'mood', -4); }
            addAffinity(st, m.id, 'p', -3);
            log(st, 'Four people, one sleeping bag, frost on the inside of the windscreen. Everyone made it home on Sunday.', 'neutral');
          },
        },
        {
          label: 'B&B for everyone',
          hint: 'Proper beds and a fry-up.',
          cost: 60,
          resolve: (st) => {
            everyone(st, 'energy', 5); everyone(st, 'mood', 4);
            log(st, 'A B&B run by a woman called Mrs Tench who hates musicians and does a magnificent fried slice.', 'good');
          },
        },
        {
          label: 'You drive, on orange squash',
          hint: 'You stay sober all night. Thankless, but the band owes you.',
          resolve: (st) => {
            const me = player(st);
            adjust(me, 'energy', -15); adjust(me, 'mood', -3); adjust(me, 'habit', -2);
            for (const x of mates(st)) addAffinity(st, x.id, 'p', 3);
            log(st, `You drove home at fifty on the M1 while ${first(mem(st, m.id))} sang every song you hate.`, 'neutral');
          },
        },
      ];
    },
  },
  {
    id: 'squat',
    weight: 1,
    when: (s) => (s.week >= 6 && !s.flags.squat ? {} : null),
    title: () => 'Bailiffs at the squat',
    text: () => 'The rehearsal room is in a squatted warehouse in Hackney. The bailiffs arrive Thursday with a van, three Alsatians and a court order.',
    options: () => [
      {
        label: 'Barricade the doors',
        hint: 'A siege, a story, maybe a night in the cells.',
        resolve: (st, rng) => {
          st.flags.squat = st.week;
          addBuzz(st, 6); st.fans += 10;
          everyone(st, 'energy', -10);
          const slow = [...mates(st)].sort((a, b) => a.hidden.stamina - b.hidden.stamina)[0];
          if (slow && rng.chance(0.4)) {
            slow.outWeeks = Math.max(slow.outWeeks, 1);
            log(st, `The siege lasted nine hours. ${first(slow)} was carried out still holding a bass and spent a night at Stoke Newington nick.`, 'bad');
          } else log(st, 'You held out for a day with a sofa and some feedback. The local news filmed it.', 'good');
        },
      },
      {
        label: 'Go quietly',
        hint: 'No drama. No rehearsal room either for a while.',
        resolve: (st) => {
          st.flags.squat = st.week;
          everyone(st, 'mood', -6); tighten(st, -4);
          log(st, 'You loaded out in the rain. The bailiffs took the kettle.', 'neutral');
        },
      },
      {
        label: 'Farewell gig on the roof',
        hint: 'Free, loud, possibly the best gig you ever play. The bailiffs may keep the PA.',
        resolve: (st, rng) => {
          st.flags.squat = st.week;
          st.fans += 25; addBuzz(st, 4); everyone(st, 'energy', -10);
          if (st.gear > 0 && rng.chance(0.3)) { addGear(st, -1); log(st, 'A roof gig over Hackney at sunset. The bailiffs kept the PA as "costs".', 'neutral'); }
          else log(st, 'A roof gig over Hackney at sunset. Two hundred people in the street. The police waited politely till the encore.', 'good');
        },
      },
    ],
  },
  {
    id: 'noise',
    weight: 1,
    when: (s) => (s.week >= 4 && since(s, 'noise', 40) ? {} : null),
    title: () => 'Environmental health',
    text: () => 'A man from the council with a clipboard and a decibel meter says the rehearsals are registering "comparable to a jet engine" next door. Next door is a retired couple and a parrot.',
    options: () => [
      {
        label: 'Egg boxes on every wall',
        hint: 'Cheap soundproofing. Everyone is happier.',
        cost: 25,
        resolve: (st) => { st.flags.noise = st.week; everyone(st, 'mood', 2); log(st, 'The room is now lined with eight hundred egg boxes. The parrot has calmed down.', 'neutral'); },
      },
      {
        label: 'Rehearse with the amps on two',
        hint: 'Quiet rehearsals, better songs, a looser band.',
        resolve: (st, rng) => {
          st.flags.noise = st.week;
          tighten(st, -3);
          grow(player(st), 'writing', 3, rng);
          log(st, 'A week of whispering rock. You wrote something gentle and then hated yourself.', 'neutral');
        },
      },
      {
        label: 'Ignore him',
        hint: 'Rock and roll does not do clipboards.',
        resolve: (st, rng) => {
          st.flags.noise = st.week;
          if (rng.chance(0.5)) { st.money -= 100; everyone(st, 'mood', -4); log(st, 'The council fined you £100. The parrot testified, in a sense.', 'bad'); }
          else { addBuzz(st, 2); log(st, 'The neighbours got up a petition. The local paper ran "Rock Hell Next Door", with your band name spelt right.', 'good'); }
        },
      },
      {
        label: 'Invite him to a gig',
        hint: 'Win him over, or confirm his worst fears.',
        resolve: (st, rng) => {
          st.flags.noise = st.week;
          if (rng.chance(0.35)) { st.fans += 1; addBuzz(st, 1); log(st, 'He came, he headbanged, he dropped the complaint. You have one fan with a clipboard.', 'good'); }
          else { st.money -= 50; log(st, 'He came, he measured, he fined you £50 on the spot.', 'bad'); }
        },
      },
    ],
  },
  {
    id: 'benefit',
    weight: 2,
    when: (s, rng) => {
      const y = year(s);
      if (y < 1984 || s.fans < 60 || s.flags[`benefit${y}`]) return null;
      return { cause: y <= 1985 ? 'striking pit villages up north' : rng.pick(['a night shelter in King\'s Cross', 'a hospice in Hackney', 'a community centre about to lose its roof']) };
    },
    title: () => 'A benefit gig',
    text: (_s, p) => `There is a benefit gig at the town hall for ${p.cause}. No fee, no rider, a good crowd and a lot of collection buckets.`,
    options: () => [
      {
        label: 'Play for free',
        hint: 'Good for the soul and the reputation. Knackering.',
        resolve: (st) => {
          st.flags[`benefit${year(st)}`] = 1;
          st.fans += 35; addBuzz(st, 5);
          for (const x of st.members) { adjust(x, 'energy', -12); adjust(x, 'mood', x.style === 'punk' ? 10 : 5); }
          log(st, 'You played a blinder for a hall full of people who needed it. The buckets were heavy.', 'good');
        },
      },
      {
        label: 'Play, but keep the bar cut',
        hint: 'Money in your pocket. People will talk.',
        resolve: (st) => {
          st.flags[`benefit${year(st)}`] = 1;
          st.money += 40; st.fans += 20; addBuzz(st, -4);
          log(st, `You took the bar cut. ${PRESS} found out. "Charity begins at the till," said the headline.`, 'bad');
        },
      },
      {
        label: 'Send a signed poster for the raffle',
        hint: 'Easy. The politically minded will be disappointed.',
        resolve: (st) => {
          st.flags[`benefit${year(st)}`] = 1;
          for (const x of mates(st)) if (x.style === 'punk' || x.hidden.loyalty >= 60) adjust(x, 'mood', -6);
          addBuzz(st, -1);
          log(st, 'Your poster raised £4. It was won by the caretaker.', 'neutral');
        },
      },
    ],
  },
  {
    id: 'insurance',
    weight: 1,
    when: (s) => (s.gear >= 1 && !s.flags.insured && !s.flags.insuranceOffered ? {} : null),
    title: () => 'The man from Allsafe Mutual',
    text: () => 'A man in a mustard suit has cornered you at the bar with a brochure. "Musicians are robbed every day," he says. "Every single day."',
    options: () => [
      {
        label: 'Buy the policy',
        hint: 'Proper cover for the gear.',
        cost: 60,
        resolve: (st) => { st.flags.insuranceOffered = 1; st.flags.insured = 2; adjust(player(st), 'mood', 3); log(st, 'The gear is insured. The man in the mustard suit shook your hand for too long.', 'neutral'); },
      },
      {
        label: 'Buy a cheaper policy off his mate',
        hint: 'A quarter of the price. Hmm.',
        cost: 15,
        resolve: (st) => { st.flags.insuranceOffered = 1; st.flags.insured = 1; adjust(player(st), 'mood', 2); log(st, 'A man called Del sold you a policy on the back of a beer mat. It has a stamp on it, sort of.', 'neutral'); },
      },
      {
        label: 'Show him the door',
        hint: 'Nobody robs a band. Probably.',
        resolve: (st) => { st.flags.insuranceOffered = 1; adjust(player(st), 'mood', 2); log(st, 'You told him musicians have nothing worth stealing. He looked at your guitar and said nothing.', 'neutral'); },
      },
    ],
  },
  {
    id: 'kit_stolen',
    weight: 2,
    when: (s) => (s.gear >= 1 && s.lastGigWeek !== null && !s.flags.noVan && since(s, 'kitStolen', 30) ? {} : null),
    title: () => 'The van has been done',
    text: () => 'Someone jemmied the back of the van outside the gig. The drum kit, two amps, somebody\'s favourite guitar and a tambourine are gone.',
    options: (s) => {
      const opts: EventOption[] = [];
      if (s.flags.insured === 2) {
        opts.push({
          label: 'Claim on the insurance',
          hint: 'This is what it was for.',
          resolve: (st) => { st.flags.kitStolen = st.week; st.flags.insured = 0; st.money += 30; log(st, 'Allsafe Mutual paid up, plus a bit. Then cancelled the policy.', 'good'); },
        });
      } else if (s.flags.insured === 1) {
        opts.push({
          label: 'Claim on Del’s policy',
          hint: 'Worth a try.',
          resolve: (st) => { st.flags.kitStolen = st.week; st.flags.insured = 0; addGear(st, -1); adjust(player(st), 'mood', -6); log(st, 'The number on Del’s policy is a phone box in Deptford.', 'bad'); },
        });
      }
      opts.push(
        { label: 'Buy replacements', hint: 'Back in business straight away.', cost: 120, resolve: (st) => { st.flags.kitStolen = st.week; everyone(st, 'mood', -2); log(st, 'Replacements bought. The new tambourine is not as good.', 'neutral'); } },
        { label: 'Borrow kit and make do', hint: 'Free. You will sound like it.', resolve: (st, rng) => { st.flags.kitStolen = st.week; addGear(st, -1); tighten(st, -2); for (const m of rng.shuffle(available(st)).slice(0, 2)) m.kit = clamp((m.kit ?? 30) - 15, 1, 100); log(st, 'Borrowed drums and an amp held together with tape. It sounds like a shed falling over.', 'bad'); } },
        {
          label: 'Search the Sunday market',
          hint: 'Stolen gear always turns up somewhere.',
          resolve: (st, rng) => {
            st.flags.kitStolen = st.week;
            everyone(st, 'energy', -5);
            if (rng.chance(0.35)) { st.money -= 20; log(st, 'Found your own kit on a stall in Brick Lane. Bought it back for £20. The stallholder was unrepentant.', 'good'); }
            else { addGear(st, -1); log(st, 'Six hours at the market. You found a lot of drum kits. None of them yours.', 'bad'); }
          },
        },
      );
      return opts;
    },
  },
  {
    id: 'entourage',
    weight: 1,
    when: (s) => ((s.buzz >= 35 || s.fans >= 300) && since(s, 'entourage', 30) ? {} : null),
    title: () => 'The hangers-on',
    text: () => 'Nobody knows where they came from: a bloke in a fur coat, two art students, someone called Spanner. They are in the van, the dressing room and, increasingly, the rider.',
    options: () => [
      {
        label: 'Let them stay',
        hint: 'You look like stars. They drink like stars, on your money.',
        resolve: (st) => {
          st.flags.entourage = st.week;
          addBuzz(st, 4); st.money -= 60;
          for (const x of st.members) { adjust(x, 'habit', 5); adjust(x, 'mood', 4); }
          log(st, 'The entourage is now part of the show. Spanner has started introducing the band.', 'neutral');
        },
      },
      {
        label: 'Clear them out',
        hint: 'Back to basics. The big egos liked the attention.',
        resolve: (st) => {
          st.flags.entourage = st.week;
          for (const x of st.members) { adjust(x, 'habit', -3); if (!x.isPlayer && x.hidden.ego >= 60) adjust(x, 'mood', -8); }
          log(st, 'You turfed them out. Spanner took a cymbal as a souvenir.', 'neutral');
        },
      },
      {
        label: 'Put them to work on merch',
        hint: 'Free labour. Watch the cash box.',
        resolve: (st, rng) => {
          st.flags.entourage = st.week;
          if (rng.chance(0.3)) { st.money -= 80; log(st, 'The merch stall did a roaring trade. Then the man in the fur coat left with the cash box.', 'bad'); }
          else { st.money += 40; st.fans += 10; log(st, 'The art students redesigned the T-shirts. They sold out.', 'good'); }
        },
      },
    ],
  },
  {
    id: 'promoter_stiff',
    weight: 2,
    when: (s, rng) => (s.lastGigWeek !== null && s.week - s.lastGigWeek <= 2 && s.fans >= 30 ? { who: rng.pick(['Lenny "Two Coats" Marsh', 'Big Ron Pilling', 'Desmond Fullalove']) } : null),
    title: (_s, p) => `${p.who} won't pay`,
    text: (_s, p) => `The promoter, ${p.who}, says the door "barely covered the electric" and offers you a voucher for his cousin's carpet shop.`,
    options: (s, p) => {
      const heavy = loudest(s);
      return [
        {
          label: 'Lean on him',
          hint: 'Get the band to stand very close to him.',
          resolve: (st, rng) => {
            if (rng.chance(0.5)) { st.money += 90; log(st, `${p.who} found £90 in a biscuit tin very quickly.`, 'good'); }
            else { addBuzz(st, -2); everyone(st, 'mood', -4); log(st, `${p.who} called his own heavies. You left without the money and with a ban.`, 'bad'); }
            if (heavy) revealLog(st, mem(st, heavy.id), 'ego', 1);
          },
        },
        {
          label: 'Take his PA amp as payment',
          hint: 'Fair is fair. He will not book you again.',
          resolve: (st) => {
            st.flags.promoterBan = st.week;
            addGear(st, 1); addBuzz(st, -1);
            log(st, `You loaded ${p.who}'s amp into the van while he shouted about the police. He did not call them.`, 'neutral');
          },
        },
        {
          label: 'Let it go',
          hint: 'Lose the fee, keep the contact.',
          resolve: (st) => {
            everyone(st, 'mood', -5); st.fans += 10;
            log(st, `${p.who} promised you a Saturday slot "next time". Surprisingly, he meant it.`, 'neutral');
          },
        },
      ];
    },
  },
  {
    id: 'superfan',
    weight: 1,
    when: (s, rng) => {
      const c = [...mates(s)].sort((a, b) => b.image - a.image)[0];
      if (s.fans < 150 || s.flags.superfan || !c) return null;
      return { m: c.id, fan: rng.pick(['Brenda from Crawley', 'Nigel, a trainee accountant', 'a woman who calls herself Lady Raven']) };
    },
    title: (_s, p) => `${p.fan} again`,
    text: (s, p) => `${p.fan} has been to forty gigs in a row, knows where ${nm(s, p.m)} lives, and has started signing letters "your future spouse". ${nm(s, p.m)} is starting to check behind the curtains.`,
    options: (s, p) => {
      const m = mem(s, p.m);
      return [
        {
          label: 'A kind but firm word',
          hint: 'Clear boundaries. A tiny bit of bad feeling.',
          resolve: (st) => {
            st.flags.superfan = 1;
            adjust(mem(st, m.id), 'mood', 5); st.fans = Math.max(0, st.fans - 2);
            log(st, `You had a gentle chat with ${p.fan} over a cup of tea. The letters stopped. Mostly.`, 'neutral');
          },
        },
        {
          label: 'Make them fan club secretary',
          hint: 'Channel the devotion. Possibly feed it.',
          resolve: (st, rng) => {
            st.flags.superfan = 2;
            st.fans += 25; addBuzz(st, 2);
            const x = mem(st, m.id);
            if (rng.chance(0.3)) { adjust(x, 'mood', -10); log(st, `${p.fan} runs the best fan club in London, and sends ${first(x)} a newsletter every day.`, 'bad'); }
            else { adjust(x, 'mood', -2); log(st, `${p.fan} has found a purpose. The newsletter is terrifyingly good.`, 'good'); }
          },
        },
        {
          label: 'Ring the police',
          hint: `${first(m)} feels safe. Word gets round that you are stuck-up.`,
          resolve: (st) => {
            st.flags.superfan = 3;
            adjust(mem(st, m.id), 'mood', 6); st.fans = Math.max(0, st.fans - 10); addBuzz(st, -1);
            log(st, `A constable had a word with ${p.fan}. The fan club calls you "the Thought Police" now.`, 'neutral');
          },
        },
      ];
    },
  },
  {
    id: 'fan_club',
    weight: 1,
    when: (s) => (s.fans >= 250 && !s.flags.fanClub ? {} : null),
    title: () => 'Civil war in the fan club',
    text: () => 'Your fan club has split. Tina, who started it with a typewriter, says the new glossy "Inner Circle" run by a man from Watford is just selling badges. He says she is "living in 1982".',
    options: () => [
      {
        label: 'Back Tina',
        hint: 'Loyalty to the old guard.',
        resolve: (st) => { st.flags.fanClub = 1; st.fans += 10; adjust(player(st), 'mood', 3); log(st, 'Tina is official. She cried and sent a fruit cake.', 'good'); },
      },
      {
        label: 'Back the glossy one',
        hint: 'There is money in badges. The old fans will mind.',
        resolve: (st) => { st.flags.fanClub = 2; st.money += 60; st.fans = Math.max(0, st.fans - 10); addBuzz(st, 2); log(st, 'The Inner Circle is official. Your share of the badge money arrived in a jiffy bag.', 'neutral'); },
      },
      {
        label: 'Peace summit in the pub',
        hint: 'You pay for the drinks. Diplomacy is thirsty work.',
        cost: 30,
        resolve: (st, rng) => {
          st.flags.fanClub = 3;
          if (rng.chance(0.6)) { st.fans += 20; log(st, 'Tina and the man from Watford now run one club together. They are, worryingly, engaged.', 'good'); }
          else { addBuzz(st, 3); log(st, `The summit ended with a pint thrown. ${PRESS} called it "the fan club wars".`, 'neutral'); }
        },
      },
    ],
  },

  // ================================================================ the record industry
  {
    id: 'manager_offer',
    weight: 3,
    when: (s, rng) => (s.fans >= 80 && s.buzz >= 15 && !s.manager && since(s, 'managerPitch', 20) ? { seed: rng.int(1, 1e9) } : null),
    title: (s, p) => `${newManager(s, new Rng(Number(p.seed))).name} wants to manage you`,
    text: (s, p) => {
      const m = newManager(s, new Rng(Number(p.seed)));
      return `${m.name} has a sheepskin coat, a car phone and a contract: ${Math.round(m.cut * 100)}% of everything you earn. Word is that ${managerWord(m).replace(`${m.name} `, '')} "Sign tonight and there is £250 in it for you. It's all standard, sweetheart. Nobody reads these."`;
    },
    options: (_s, p) => [
      {
        label: 'Sign on the spot',
        hint: 'Cash now, connections, and a contract nobody read.',
        resolve: (st) => {
          const m = newManager(st, new Rng(Number(p.seed)));
          st.manager = m; st.flags.managerPitch = st.week;
          st.money += 250; addBuzz(st, 5);
          milestone(st, 'career', `${m.name} became the band's manager.`);
          log(st, `You signed with ${m.name} on the bonnet of a car. "The next big thing," they said, and drove off fast.`, 'good');
        },
      },
      {
        label: 'Get a solicitor to read it first',
        hint: 'Smaller signing fee, fewer surprises.',
        cost: 60,
        resolve: (st) => {
          const m = { ...newManager(st, new Rng(Number(p.seed))), read: true };
          st.manager = m; st.flags.managerPitch = st.week;
          st.money += 100; addBuzz(st, 4);
          milestone(st, 'career', `${m.name} became the band's manager.`);
          log(st, m.honesty < 40
            ? `The solicitor found clause 14(b): ${m.name} would have owned half your songs, forever. Crossed out. You signed the rest.`
            : `The solicitor read all forty pages and found nothing worse than ${Math.round(m.cut * 100)}%. You signed.`, 'good');
        },
      },
      {
        label: 'Show them the door',
        hint: 'You manage yourselves. Harder, but yours.',
        resolve: (st) => {
          st.flags.managerPitch = st.week;
          adjust(player(st), 'mood', 4); addBuzz(st, -1);
          log(st, 'They left a card. It has three phone numbers on it, all crossed out.', 'neutral');
        },
      },
    ],
  },
  {
    id: 'manager_clause',
    weight: 8,
    when: (s) => (s.manager && !s.manager.read && s.manager.honesty < 40 && !s.flags.clauseDone && s.week - s.manager.signed >= 4 ? {} : null),
    title: () => 'Clause 14(b)',
    text: (s) => `A letter from ${s.manager!.name}'s lawyer. Page nine, small print: your manager owns half your songwriting "in perpetuity, throughout the universe", and would like their share of everything, backdated.`,
    options: () => [
      {
        label: 'Buy your way out',
        hint: 'Expensive freedom. The manager goes too.',
        cost: 250,
        resolve: (st) => { st.flags.clauseDone = 1; st.manager = null; st.flags.manager = 4; everyone(st, 'mood', 5); log(st, 'You bought the contract back. No manager, no clause. You are free, broke and wiser.', 'good'); },
      },
      {
        label: 'Take them to court',
        hint: 'Lawyers cost money. Winning costs more.',
        cost: 80,
        resolve: (st, rng) => {
          st.flags.clauseDone = 1;
          if (rng.chance(0.45)) { st.manager = null; st.flags.manager = 4; addBuzz(st, 5); log(st, `The judge called the contract "unconscionable" and ${PRESS} called it "a victory for rock". The manager is history.`, 'good'); }
          else { st.money -= 150; st.manager!.cut = 0.3; log(st, 'You lost. Costs awarded against you, the clause stands, and your manager now takes thirty per cent "to cover the legal unpleasantness".', 'bad'); }
        },
      },
      {
        label: 'Live with it',
        hint: 'They take their cut. You keep your evenings free of lawyers.',
        resolve: (st) => {
          st.flags.clauseDone = 1;
          const cut = clamp(Math.round(st.money * 0.2), 30, 200);
          st.money -= cut; st.manager!.taken += cut; st.manager!.cut = Math.max(st.manager!.cut, 0.25);
          adjust(player(st), 'mood', -10);
          log(st, `Your manager took £${cut} "on account" and now takes a quarter of everything. You will never see a statement that makes sense.`, 'bad');
        },
      },
    ],
  },
  {
    id: 'ar_scout',
    weight: 2,
    when: (s, rng) => (s.buzz >= 20 && s.lastGigWeek !== null && s.week - s.lastGigWeek <= 2 && since(s, 'arScout', 20)
      ? { label: rng.pick(['Monolith Phonographic', 'Plastic Lion Records', 'Gravel & Sons', 'Kingfisher Sound']) }
      : null),
    title: (_s, p) => `A&R from ${p.label}`,
    text: (_s, p) => `There is a man in a satin tour jacket at the back of the gig, from ${p.label}. He is not tapping his foot. He is writing something down.`,
    options: (s, p) => {
      const demo = s.releases.some((r) => r.kind === 'demo');
      return [
        {
          label: 'Buy him drinks all night',
          hint: 'Charm offensive. Your liver pays as well.',
          cost: 30,
          resolve: (st, rng) => {
            st.flags.arScout = st.week;
            adjust(player(st), 'habit', 3);
            if (rng.chance(0.6)) { addBuzz(st, 6); st.flags.arInterest = (st.flags.arInterest ?? 0) + 1; log(st, `By midnight he was calling you "my band". ${p.label} will be in touch, he says.`, 'good'); }
            else { addBuzz(st, 1); log(st, 'He drank everything and woke up with no memory of you at all.', 'bad'); }
          },
        },
        {
          label: 'Play it cool',
          hint: 'Mystique works. Or he walks.',
          resolve: (st, rng) => {
            st.flags.arScout = st.week;
            if (rng.chance(0.4)) { addBuzz(st, 8); st.flags.arInterest = (st.flags.arInterest ?? 0) + 1; log(st, 'You ignored him completely. He rang the venue twice the next day asking for you.', 'good'); }
            else { addBuzz(st, -1); log(st, `He left before the encore. ${p.label} signed a synth duo instead.`, 'bad'); }
          },
        },
        {
          label: demo ? 'Hand him the demo tape' : 'Hand him a live tape off the desk',
          hint: demo ? 'Let the music do the talking.' : 'Rough, but it is something.',
          resolve: (st) => {
            st.flags.arScout = st.week;
            addBuzz(st, demo ? 5 : 2); st.fans += demo ? 10 : 0;
            log(st, demo ? 'He played the tape in his car. Someone at the label played it in the office.' : 'He took the tape. It was mostly crowd noise and a man shouting for the one about the van.', demo ? 'good' : 'neutral');
          },
        },
      ];
    },
  },
  {
    id: 'jingle',
    weight: 2,
    when: (s, rng) => (s.fans >= 100 && !s.flags.jingle ? { product: rng.pick(['Krunchos cheese puffs', 'Blaze-O oven cleaner', 'Fizzbomb cola', 'Tressmax Mega-Hold mousse']) } : null),
    title: (_s, p) => `${p.product} want your song`,
    text: (_s, p) => `An ad agency wants your best riff for a ${p.product} commercial. £350. The lyrics would be changed to "${String(p.product).split(' ')[0]}, ${String(p.product).split(' ')[0]}, crunch-crunch-crunch".`,
    options: (_s, p) => [
      {
        label: 'Take the money',
        hint: 'Pay the rent, lose some cred. The purists will be appalled.',
        resolve: (st) => {
          st.flags.jingle = 1;
          st.money += 350; addBuzz(st, -6);
          for (const x of purists(st)) adjust(x, 'mood', -8);
          log(st, `Your riff now sells ${p.product} between the snooker. ${PRESS} ran a cartoon of you in a crisp packet.`, 'neutral');
        },
      },
      {
        label: 'Do it under a fake name',
        hint: 'Less money. Pray nobody recognises the riff.',
        resolve: (st, rng) => {
          st.flags.jingle = 2;
          st.money += 200;
          if (rng.chance(0.35)) { addBuzz(st, -8); log(st, `A ${PRESS} reader recognised the riff. "Sell-outs in disguise" ran on page two.`, 'bad'); }
          else log(st, 'You earned £200 as "The Crunch Collective". Nobody knows. Yet.', 'good');
        },
      },
      {
        label: 'Tell them where to stick it',
        hint: 'Integrity is free. Rent is not.',
        resolve: (st) => {
          st.flags.jingle = 3;
          addBuzz(st, 3);
          for (const x of purists(st)) adjust(x, 'mood', 4);
          log(st, `You told the agency what to do with their ${p.product}. You also told ${PRESS}.`, 'good');
        },
      },
    ],
  },
  {
    id: 'session_vox',
    weight: 1,
    when: (s) => (s.week >= 20 && bestUnreleased(s) && !s.flags.sessionVox ? { song: bestUnreleased(s).title } : null),
    title: () => 'Backing vocals for a carpet warehouse',
    text: (_s, p) => `A studio in Wardour Street needs voices for a radio jingle: "No deposit, no worries, Carpet King of Croydon". Payment: a free night of studio time to work on "${p.song}".`,
    options: (s, p) => {
      const voice = [...mates(s)].sort((a, b) => b.stage - a.stage)[0];
      const opts: EventOption[] = [
        {
          label: 'Sing about carpets',
          hint: 'A night in a real studio. The jingle will haunt you.',
          resolve: (st) => {
            st.flags.sessionVox = 1;
            const x = song(st, p.song); if (x) x.quality = clamp(x.quality + 5, 1, 99);
            everyone(st, 'mood', -3);
            log(st, `"${p.song}" sounds twice as good. You will be humming "no deposit, no worries" on your deathbed.`, 'good');
          },
        },
      ];
      if (voice) {
        opts.push({
          label: `Send ${first(voice)} alone`,
          hint: 'Less studio time. They will feel used.',
          resolve: (st) => {
            st.flags.sessionVox = 2;
            const x = song(st, p.song); if (x) x.quality = clamp(x.quality + 3, 1, 99);
            adjust(mem(st, voice.id), 'mood', -5); addAffinity(st, voice.id, 'p', -4);
            log(st, `${first(voice)} sang about carpets for six hours, then spent the free hour on "${p.song}".`, 'neutral');
          },
        });
      }
      opts.push({
        label: 'Ask for cash instead',
        hint: 'A little money, no studio.',
        resolve: (st) => { st.flags.sessionVox = 3; st.money += 60; log(st, 'The studio paid £60 for an afternoon of shag-pile harmonies.', 'neutral'); },
      });
      return opts;
    },
  },
  {
    id: 'bootleg',
    weight: 1,
    when: (s) => (s.fans >= 120 && s.lastGigWeek !== null && !s.flags.bootleg ? {} : null),
    title: () => 'A bootleg is doing the rounds',
    text: () => 'A cassette called "Live and Sweaty at the Rat Pit" is selling for £2 at record fairs. The sound is terrible. People are buying it anyway.',
    options: () => [
      {
        label: 'Hunt down the bootlegger',
        hint: 'Justice, and maybe his takings.',
        resolve: (st, rng) => {
          st.flags.bootleg = 1;
          adjust(player(st), 'energy', -10);
          if (rng.chance(0.5)) { st.money += 50; log(st, 'You found him at a fair in Kilburn and left with £50 and his remaining stock.', 'good'); }
          else { addBuzz(st, -2); log(st, 'You chased the wrong man through a record fair. It was filmed.', 'bad'); }
        },
      },
      {
        label: 'Embrace it',
        hint: 'Free publicity, no money.',
        resolve: (st) => { st.flags.bootleg = 2; st.fans += 40; addBuzz(st, 3); log(st, `You told ${PRESS} bootlegs are "the people's records". The people agreed.`, 'good'); },
      },
      {
        label: 'Release an official live tape',
        hint: 'Beat them at their own game.',
        cost: 40,
        resolve: (st) => {
          st.flags.bootleg = 3;
          const take = clamp(Math.round(st.fans * 0.4), 30, 200);
          st.money += take; addBuzz(st, 2);
          log(st, `"Official Bootleg" sold £${take} worth at gigs. It sounds slightly less terrible.`, 'good');
        },
      },
    ],
  },
  {
    id: 'plagiarism',
    weight: 1,
    when: (s, rng) => {
      if (s.songs.length < 2 || s.buzz < 20 || s.flags.plagiarism) return null;
      const top = [...s.songs].sort((a, b) => b.quality - a.quality)[0];
      return { song: top.title, who: rng.pick(['a cabaret organist from Margate', 'a retired folk singer called Pip', 'a jingle writer who once had a hit with a yoghurt advert']) };
    },
    title: (_s, p) => `"${p.song}" is stolen, says a solicitor`,
    text: (_s, p) => `A solicitor's letter: ${p.who} claims the chorus of "${p.song}" is lifted note for note from a song they wrote in 1971. They want £150 or they go to court.`,
    options: (s, p) => {
      const writer = s.members.find((m) => m.id === song(s, p.song)?.writer);
      return [
        { label: 'Settle', hint: 'Make it go away.', cost: 150, resolve: (st) => { st.flags.plagiarism = 1; adjust(player(st), 'mood', -3); log(st, 'You paid. The letter said "without admission of liability", which means you are guilty.', 'neutral'); } },
        {
          label: 'Fight it',
          hint: 'Win and look brilliant. Lose and pay twice.',
          resolve: (st, rng) => {
            st.flags.plagiarism = 2;
            if (rng.chance(0.5)) { addBuzz(st, 6); log(st, `The court played both tunes. They are nothing alike. ${PRESS} loved the drama.`, 'good'); }
            else { st.money -= 250; addBuzz(st, 2); log(st, 'The judge hummed both tunes. They were the same tune. £250 in costs.', 'bad'); }
          },
        },
        {
          label: 'Rewrite the chorus',
          hint: `The song gets worse. ${writer && !writer.isPlayer ? `${first(writer)} will be hurt.` : 'Your pride will be hurt.'}`,
          resolve: (st) => {
            st.flags.plagiarism = 3;
            const x = song(st, p.song); if (x) x.quality = clamp(x.quality - 6, 1, 99);
            const w = writer ? st.members.find((m) => m.id === writer.id) : undefined;
            adjust(w ?? player(st), 'mood', -6);
            log(st, `"${p.song}" has a new chorus. It is fine. It is just fine.`, 'neutral');
          },
        },
      ];
    },
  },
  {
    id: 'lost_master',
    weight: 1,
    when: (s) => (s.releases.length >= 1 && bestUnreleased(s) && since(s, 'lostMaster', 40) ? { song: bestUnreleased(s).title } : null),
    title: () => 'The studio has lost your tape',
    text: (_s, p) => `The studio has lost the multitrack of "${p.song}". The tape op thinks the cleaner "might have binned it". The cleaner thinks it was the tape op.`,
    options: (_s, p) => [
      {
        label: 'Search the skips',
        hint: 'A long night in the bins of Soho.',
        resolve: (st, rng) => {
          st.flags.lostMaster = st.week;
          everyone(st, 'energy', -12);
          const x = song(st, p.song);
          if (rng.chance(0.5)) { if (x) x.quality = clamp(x.quality + 2, 1, 99); log(st, 'Found it under a pizza box. It has a stain on it. It sounds better, somehow.', 'good'); }
          else { if (x) x.quality = clamp(x.quality - 5, 1, 99); log(st, `No tape. You will have to rebuild "${p.song}" from a cassette copy.`, 'bad'); }
        },
      },
      {
        label: 'Re-record it',
        hint: 'Costs money. The band gets tighter doing it again.',
        cost: 100,
        resolve: (st) => { st.flags.lostMaster = st.week; tighten(st, 4); everyone(st, 'mood', -2); log(st, `You recorded "${p.song}" again in a day. It is tighter and angrier.`, 'neutral'); },
      },
      {
        label: 'Threaten to sue the studio',
        hint: 'They might pay up. They might throw you out.',
        resolve: (st, rng) => {
          st.flags.lostMaster = st.week;
          if (rng.chance(0.4)) { st.money += 150; log(st, 'The studio settled for £150 to keep it quiet.', 'good'); }
          else { st.money -= 60; log(st, 'The studio counter-claimed for "damage to the toilets". You owe them £60.', 'bad'); }
        },
      },
    ],
  },
  {
    id: 'label_party',
    weight: 2,
    when: (s, rng) => (s.buzz >= 30 && since(s, 'labelParty', 26) ? { label: rng.pick(['Monolith Phonographic', 'Plastic Lion Records', 'Gravel & Sons', 'Kingfisher Sound']) } : null),
    title: (_s, p) => `${p.label} throws a party`,
    text: (_s, p) => `You are on the guest list at ${p.label}'s launch party in a Mayfair hotel. The marketing director is cutting lines on a gold disc in the gents and offering them round like dinner mints.`,
    options: (s) => [
      {
        label: 'Dive in',
        hint: 'Rub shoulders with the industry. Your noses will remember.',
        resolve: (st) => {
          st.flags.labelParty = st.week;
          for (const x of available(st)) { adjust(x, 'habit', (x.hidden.vice / 100) * 10 + 3); adjust(x, 'energy', 15); }
          addBuzz(st, 5);
          setVibe(st, 'trip');
          beat(st, '01:40', 'You are explaining the future of rock to a man who owns a racehorse. He agrees with every word. So do you.');
          const w = [...available(st)].sort((a, b) => b.hidden.vice - a.hidden.vice)[0];
          if (w) revealLog(st, w, 'vice', 1);
          log(st, 'You met everyone and remember none of it. Apparently you promised a double album.', 'neutral');
        },
      },
      {
        label: 'Stick to the free champagne',
        hint: 'A good night, mostly legal.',
        resolve: (st) => {
          st.flags.labelParty = st.week;
          everyone(st, 'habit', 3); everyone(st, 'mood', 6); addBuzz(st, 2);
          log(st, 'Forty glasses of champagne between you, and a vol-au-vent in a pocket for later.', 'good');
        },
      },
      {
        label: 'Network, stone cold sober',
        hint: 'The execs will remember you. You will be bored rigid.',
        resolve: (st) => {
          st.flags.labelParty = st.week;
          st.flags.arInterest = (st.flags.arInterest ?? 0) + 1;
          adjust(player(st), 'mood', -4);
          for (const x of mates(st)) if (x.hidden.vice >= 60) adjust(x, 'mood', -4);
          log(st, 'You talked distribution with a man in a cravat for an hour. He wrote your name in his leather organiser.', 'neutral');
        },
      },
      {
        label: 'Leave early',
        hint: 'A good night’s sleep. The industry notices who stays.',
        resolve: (st) => {
          st.flags.labelParty = st.week;
          everyone(st, 'energy', 10); addBuzz(st, -2);
          log(st, `You left at ten. ${s.bandName} were "the ones who went home", said the diary column.`, 'neutral');
        },
      },
    ],
  },
  {
    id: 'brown_scare',
    weight: 4,
    when: (s) => {
      const c = mates(s).filter((m) => m.habit >= 55 && m.hidden.vice >= 70 && !s.flags[`scare_${m.id}`]);
      return c.length ? { m: c[0].id } : null;
    },
    title: (s, p) => `${nm(s, p.m)} has found something worse`,
    text: (s, p) => `In the toilets after the gig, ${nm(s, p.m)} was nodding off over a square of tin foil. Someone from the support band "had some brown". ${nm(s, p.m)} swears it was only the once. Their eyes say otherwise.`,
    options: (s, p) => {
      const m = mem(s, p.m);
      const flag = (st: GameState) => { st.flags[`scare_${m.id}`] = st.week; };
      return [
        {
          label: 'The clinic, today',
          hint: 'Three weeks out. The right thing.',
          cost: 150,
          resolve: (st) => {
            flag(st);
            const x = mem(st, m.id);
            x.outWeeks = Math.max(x.outWeeks, 3); adjust(x, 'habit', -40); adjust(x, 'mood', -8); trait(x, 'vice', -10);
            addAffinity(st, x.id, 'p', 6);
            log(st, `${first(x)} went into a clinic in Surrey. Grey, shaky, furious, and alive.`, 'neutral');
          },
        },
        {
          label: 'A band intervention',
          hint: 'Everyone in one room, telling the truth. It will be ugly.',
          resolve: (st) => {
            flag(st);
            const x = mem(st, m.id);
            adjust(x, 'habit', -20); adjust(x, 'mood', -10);
            for (const o of st.members) if (o.id !== x.id) addAffinity(st, o.id, x.id, 5);
            tighten(st, -2);
            revealLog(st, x, 'vice', 2);
            log(st, `Five hours in the rehearsal room. ${first(x)} threw a chair, then cried, then flushed the rest.`, 'neutral');
          },
        },
        {
          label: 'Take them home to their family',
          hint: `Two weeks in ${m.from}. Gentle, and effective.`,
          resolve: (st) => {
            flag(st);
            const x = mem(st, m.id);
            x.outWeeks = Math.max(x.outWeeks, 2); adjust(x, 'habit', -25); adjust(x, 'mood', -4);
            log(st, `You drove ${first(x)} home to ${x.from}. Their family met you at the door and did not ask questions.`, 'neutral');
          },
        },
        {
          label: 'Look the other way',
          hint: 'Not your business. It might become everyone’s.',
          resolve: (st, rng) => {
            flag(st);
            const x = mem(st, m.id);
            adjust(x, 'habit', 12); trait(x, 'vice', 5);
            if (rng.chance(0.4)) { x.outWeeks = Math.max(x.outWeeks, 3); st.money -= 60; log(st, `${first(x)} was found blue in the van and rushed to A&E. They pulled through. Nobody looks at you the same way.`, 'bad'); }
            else log(st, `${first(x)} is "fine". ${first(x)} is very thin and very quiet.`, 'bad');
          },
        },
      ];
    },
  },

  // ================================================================ media and image
  {
    id: 'pirate_radio',
    weight: 2,
    when: (s, rng) => (s.fans >= 30 && !s.flags.pirate ? { station: rng.pick(['Radio Concrete', 'Tower Block FM', 'Radio Free Peckham', 'Radio Barge 247']) } : null),
    title: (_s, p) => `${p.station} wants you`,
    text: (_s, p) => `${p.station} broadcasts from a transmitter on top of a council tower block, staffed by two DJs and a man who watches for the authorities. They want you on air.`,
    options: (_s, p) => [
      {
        label: 'Play live on the roof',
        hint: 'A legendary broadcast, if the authorities stay away.',
        resolve: (st, rng) => {
          st.flags.pirate = 1;
          everyone(st, 'energy', -8);
          if (performance(st) + rng.int(-12, 12) >= 45) { addBuzz(st, 8); st.fans += 40; log(st, `You played eleven floors up in the wind. Half of south London heard it.`, 'good'); }
          else { addBuzz(st, 2); log(st, 'The wind took the vocals somewhere over Lewisham.', 'neutral'); }
          if (st.gear > 0 && rng.chance(0.25)) { addGear(st, -1); log(st, 'Then the authorities raided and confiscated an amp along with the transmitter.', 'bad'); }
        },
      },
      {
        label: 'Give them the tape',
        hint: 'Easy airplay.',
        resolve: (st) => { st.flags.pirate = 2; addBuzz(st, 3); st.fans += 15; log(st, `${p.station} played your tape between a reggae dub and an advert for a minicab firm.`, 'good'); },
      },
      {
        label: 'Pay for heavy rotation',
        hint: 'A bribe in a carrier bag.',
        cost: 25,
        resolve: (st) => { st.flags.pirate = 3; addBuzz(st, 4); st.fans += 30; log(st, `${p.station} played you every hour for a week. The DJ now calls you "the guv'nors".`, 'good'); },
      },
    ],
  },
  {
    id: 'fanzine',
    weight: 2,
    when: (s, rng) => (s.fans >= 20 && s.fans <= 1500 && since(s, 'fanzine', 20) ? { zine: rng.pick(['Spit & Polish', 'Leather Lungs', 'Feedback Loop', 'Gob Gazette']) } : null),
    title: (_s, p) => `${p.zine} wants an interview`,
    text: (_s, p) => `${p.zine} is a photocopied fanzine run by a bloke from the dole office with a typewriter and strong opinions. Print run: 300, if the library copier holds out.`,
    options: (s, p) => {
      const t = loudest(s);
      const opts: EventOption[] = [
        { label: 'A proper interview', hint: 'Small, loyal audience.', resolve: (st) => { st.flags.fanzine = st.week; st.fans += 15; addBuzz(st, 2); adjust(player(st), 'energy', -5); log(st, `Four pages in ${p.zine}, including your favourite cheese. The real fans appreciate it.`, 'good'); } },
        {
          label: 'Make it completely surreal',
          hint: 'Cult status or confusion.',
          resolve: (st, rng) => {
            st.flags.fanzine = st.week;
            if (rng.chance(0.6)) { addBuzz(st, 5); st.fans += 10; log(st, 'You answered every question as a medieval monk. It is being passed round art schools.', 'good'); }
            else { addBuzz(st, -1); adjust(player(st), 'mood', 4); log(st, 'Nobody understood a word. You had a lovely time.', 'neutral'); }
          },
        },
      ];
      if (t) {
        opts.push({
          label: `Let ${first(t)} do it`,
          hint: 'They will love it. What they say is another matter.',
          resolve: (st, rng) => {
            st.flags.fanzine = st.week;
            const x = mem(st, t.id);
            adjust(x, 'mood', 6); st.fans += 10;
            if (rng.chance(0.4)) { addAffinity(st, x.id, 'p', -6); log(st, `${first(x)} described the band as "me and some session players". The others have read it.`, 'bad'); }
            else log(st, `${first(x)} was charming and only slightly libellous.`, 'good');
          },
        });
      }
      opts.push({ label: 'No time for fanzines', hint: 'They will remember the snub.', resolve: (st) => { st.flags.fanzine = st.week; addBuzz(st, -1); st.fans = Math.max(0, st.fans - 3); log(st, `${p.zine} ran a blank page with your name on it. "Too big for us now."`, 'neutral'); } });
      return opts;
    },
  },
  {
    id: 'photoshoot',
    weight: 2,
    when: (s, rng) => (s.buzz >= 15 && since(s, 'photoshoot', 30)
      ? { what: rng.pick(['the smoke machine set the photographer\'s fringe alight', 'the hired python escaped into the studio ceiling', 'the tide came in during the cliff shoot in Dorset', 'the dry ice turned everybody faintly blue']) }
      : null),
    title: () => 'The photo shoot',
    text: (_s, p) => `${PRESS} sent a photographer for the band shoot, and ${p.what}. There are three usable frames, all of them chaos.`,
    options: () => [
      { label: 'Reshoot properly', hint: 'Money spent, good photos.', cost: 60, resolve: (st) => { st.flags.photoshoot = st.week; everyone(st, 'image', 2); log(st, 'The reshoot went fine. Moody, backlit, everybody looking slightly to the left.', 'good'); } },
      {
        label: 'Use the disaster shots',
        hint: 'Chaos sells. Sometimes.',
        resolve: (st, rng) => {
          st.flags.photoshoot = st.week;
          if (rng.chance(0.6)) { addBuzz(st, 7); log(st, 'The chaos photo ran across two pages. "The most dangerous band in London."', 'good'); }
          else { addBuzz(st, 1); everyone(st, 'image', -1); log(st, 'The photo ran small. Everyone looks like they have been in a fire, because they have.', 'bad'); }
        },
      },
      { label: 'Send in an old pub snapshot', hint: 'Free. Not flattering.', resolve: (st) => { st.flags.photoshoot = st.week; addBuzz(st, -2); adjust(player(st), 'image', -1); log(st, 'They used a pub snapshot. You have red eyes and a Scotch egg.', 'neutral'); } },
    ],
  },
  {
    id: 'talent_show',
    weight: 1,
    when: (s) => (s.fans <= 800 && s.buzz <= 60 && !s.flags.talentShow ? {} : null),
    title: () => 'Spotlight Search with Des Lyle',
    text: () => 'Prime-time talent show Spotlight Search wants a "proper rock group" between a ventriloquist and a family of clog dancers. Winner gets £250 and a variety tour of seaside piers.',
    options: () => [
      {
        label: 'Enter, play it straight',
        hint: 'Millions of viewers. Your credibility will not survive a win.',
        resolve: (st, rng) => {
          st.flags.talentShow = 1;
          if (performance(st) + rng.int(-15, 15) >= 55) { st.money += 250; st.fans += 150; addBuzz(st, -4); log(st, `You won. Des Lyle put his arm round you. Your mum has the tape. ${PRESS} has disowned you.`, 'good'); }
          else { st.fans += 40; addBuzz(st, -6); everyone(st, 'mood', -8); log(st, 'You lost to the ventriloquist. The dummy was nicer about it than you were.', 'bad'); }
        },
      },
      {
        label: 'Enter and take the mickey',
        hint: 'Instant notoriety. No pier tour for you.',
        resolve: (st) => { st.flags.talentShow = 2; addBuzz(st, 8); st.fans += 30; everyone(st, 'mood', 5); log(st, 'You played the theme tune at double speed and called Des Lyle "Grandad". Complaints to the channel: 412.', 'good'); },
      },
      {
        label: 'Decline',
        hint: 'Talent shows are for clog dancers.',
        resolve: (st) => { st.flags.talentShow = 3; for (const x of purists(st)) adjust(x, 'mood', 4); adjust(player(st), 'mood', 1); log(st, 'You turned Spotlight Search down. The clog dancers won.', 'neutral'); },
      },
    ],
  },
  {
    id: 'tabloid_sting',
    weight: 2,
    when: (s) => (s.buzz >= 40 && !s.flags.sting && mates(s).length ? {} : null),
    title: () => 'A Belgian record mogul',
    text: () => 'A man claiming to be a Belgian record mogul has invited you to his hotel suite. He has champagne, a suspicious plant pot and a lot of questions about drugs. His accent keeps slipping to Romford.',
    options: (s) => {
      const target = loudest(s);
      const opts: EventOption[] = [
        {
          label: 'Brag outrageously',
          hint: 'The Sunday Scorcher will love it. So will the kids.',
          resolve: (st) => {
            st.flags.sting = 1;
            addBuzz(st, 10); adjust(player(st), 'image', 2); st.fans += 20;
            log(st, '"ROCK BEAST\'S ORGY OF EXCESS" ran on Sunday. Most of it you made up. Your mum has rung twice.', 'good');
          },
        },
        { label: 'Smell a rat and leave', hint: 'Safe. A wasted evening.', resolve: (st) => { st.flags.sting = 2; adjust(player(st), 'mood', 3); log(st, 'You took the champagne and left. The plant pot was ticking.', 'neutral'); } },
      ];
      if (target) {
        opts.push({
          label: `Feed him a story about ${first(target)}`,
          hint: 'Good copy. Bad friendship.',
          resolve: (st) => {
            st.flags.sting = 3;
            const x = mem(st, target.id);
            addBuzz(st, 6); adjust(x, 'mood', -10); addAffinity(st, x.id, 'p', -12);
            log(st, `The Sunday Scorcher ran "${first(x)}'s Secret Shame". ${first(x)} knows exactly who the source was.`, 'bad');
          },
        });
      }
      opts.push({
        label: 'Sting the stinger',
        hint: 'Tape him taping you. Risky.',
        resolve: (st, rng) => {
          st.flags.sting = 4;
          if (rng.chance(0.45)) { addBuzz(st, 12); log(st, `${PRESS} printed your tape of the "mogul" asking for drugs in a Romford accent. You are folk heroes.`, 'good'); }
          else { st.money -= 100; addBuzz(st, 2); log(st, 'The paper threatened to sue. Your solicitor charged £100 to say "probably best not".', 'bad'); }
        },
      });
      return opts;
    },
  },
  {
    id: 'xmas_single',
    weight: 4,
    when: (s) => {
      const wk = s.week % 52;
      return wk >= 40 && wk <= 46 && s.fans >= 80 && !s.flags[`xmasSingle${year(s)}`] ? {} : null;
    },
    title: () => 'A Christmas single?',
    text: () => 'Everybody is doing a Christmas record. Sleigh bells, a pub choir, a key change. The money can be silly. So can the shame.',
    options: () => [
      {
        label: 'A novelty stomper',
        hint: 'Sleigh bells on a power chord. The purists will hate it.',
        cost: 40,
        resolve: (st, rng) => {
          st.flags[`xmasSingle${year(st)}`] = 1;
          const t = rng.pick(['Santa’s Got a Leather Jacket', 'Rudolph Rides Tonight', 'Mistletoe Mayhem']);
          st.songs.push({ title: t, quality: rng.int(30, 55), writer: 'p', kind: 'trend', genre: player(st).style, released: false });
          for (const x of st.members) adjust(x, 'mood', isPurist(x) ? -8 : 3);
          log(st, `"${t}" is ready, sleigh bells and all. It is awful. It might sell.`, 'neutral');
        },
      },
      {
        label: 'A sincere power ballad',
        hint: 'Snow, heartbreak and a choir. Depends on your songwriting.',
        cost: 40,
        resolve: (st, rng) => {
          st.flags[`xmasSingle${year(st)}`] = 2;
          const me = player(st);
          const t = rng.pick(['Snow on the Amplifier', 'Last Bus Home on Christmas Eve', 'Frozen Hearts of London']);
          const q = clamp(Math.round(me.writing * 0.9 + rng.int(-8, 10)), 1, 99);
          st.songs.push({ title: t, quality: q, writer: 'p', kind: 'ballad', genre: me.style, released: false });
          adjust(me, 'mood', 3);
          log(st, `"${t}" (${q}) is in the can. The choir was the pub darts team.`, q >= 50 ? 'good' : 'neutral');
        },
      },
      {
        label: 'Over our dead bodies',
        hint: 'Christmas is for wimps.',
        resolve: (st) => { st.flags[`xmasSingle${year(st)}`] = 3; for (const x of purists(st)) adjust(x, 'mood', 5); addBuzz(st, -1); log(st, 'No Christmas single. The band had a moment of pride and then a mince pie.', 'neutral'); },
      },
    ],
  },
];

/** Things that only make sense at home: offers, landlords, the squat, the telly. */
const HOME_ONLY = new Set([
  'rent', 'transit', 'roadie', 'battle', 'raid', 'tv', 'christmas', 'squat', 'noise', 'benefit', 'euro_gig', 'support_tour',
  'talent_show', 'xmas_single', 'session_vox', 'pirate_radio', 'straight_job', 'van', 'gear', 'insurance', 'manager_offer',
]);

const EVENTS: EventDef[] = [
  ...BASE_EVENTS.map((e) => (HOME_ONLY.has(e.id) ? { ...e, where: 'home' as const } : e)),
  ...ROMANCE_EVENTS,
  ...LABEL_EVENTS,
  ...MONEY_EVENTS,
  ...CALAMITY_EVENTS,
  ...STARDOM_EVENTS,
  ...CATALOGUE_EVENTS,
  ...RUIN_EVENTS,
  ...FANCLUB_EVENTS,
  ...KIT_EVENTS,
  WHEELS_EVENT,
  ...TOUR_EVENTS,
];

// ---------------------------------------------------------------- news (no choice)

function news(s: GameState, rng: Rng): void {
  const ms = mates(s);
  const items: (() => boolean)[] = [
    () => {
      if (s.lastGigWeek === null || s.week - s.lastGigWeek > 1) return false;
      addBuzz(s, 5);
      log(s, `A ${PRESS} stringer mentioned you in the gig guide. Small print, but print.`, 'good');
      return true;
    },
    () => {
      const exposed = s.members.filter((m) => m.name !== m.realName && !m.name.includes('"'));
      if (s.buzz < 20 || !exposed.length) return false;
      const m = rng.pick(exposed);
      addBuzz(s, 3);
      adjust(m, 'mood', -8);
      adjust(m, 'image', -2);
      log(s, `${PRESS} gossip column: "${m.name} is really ${m.realName} from ${m.from}." ${m.isPlayer ? 'Your mum is delighted. You are not.' : `${first(m)} is mortified.`}`, 'bad');
      return true;
    },
    () => {
      s.money -= 40;
      log(s, 'Somebody nicked a guitar and two mic stands. £40 to replace them.', 'bad');
      return true;
    },
    () => {
      const flake = ms.find((m) => m.hidden.reliability < 40);
      if (!flake) return false;
      flake.outWeeks = 1;
      log(s, `${first(flake)} met someone at the bar and vanished. Back next week, probably.`, 'bad');
      revealLog(s, flake, 'reliability', 1);
      return true;
    },
    () => {
      if (s.fans < 100) return false;
      for (const m of s.members) adjust(m, 'mood', 5);
      log(s, 'A fan letter arrived. Misspelled the band name, but still.', 'good');
      return true;
    },
    () => {
      const rockers = s.members.filter((m) => m.style === 'metal' || m.style === 'hardrock');
      if (!rockers.length || s.week > 104) return false;
      for (const m of rockers) adjust(m, 'mood', -4);
      log(s, 'The charts are wall-to-wall synths and frilly shirts. The rockers in the band are depressed.', 'neutral');
      return true;
    },
    () => {
      if (s.buzz < 10) return false;
      addBuzz(s, 1);
      log(s, `A ${PRESS} letter-writer from Hull called you "the sound of a skip on fire". You have it framed.`, 'good');
      return true;
    },
    () => {
      if (wheelsOf(s) !== 'van') return false;
      s.money -= 15;
      log(s, 'The van got a parking ticket outside the rehearsal room. The warden was humming your chorus. £15.', 'bad');
      return true;
    },
    () => {
      if (s.fans < 40) return false;
      s.fans += 5; addBuzz(s, 1);
      log(s, `Someone has spray-painted ${s.bandName.toUpperCase()} on a railway bridge in Kentish Town. Spelt right, too.`, 'good');
      return true;
    },
    () => {
      for (const m of s.members) adjust(m, 'energy', 6);
      log(s, 'A power cut killed rehearsals for two days. Everyone slept. Nobody admits to enjoying it.', 'neutral');
      return true;
    },
    () => {
      if (s.fans < 60) return false;
      for (const m of s.members) adjust(m, 'mood', 3);
      log(s, `The chippy on the corner has named a pie after ${s.bandName}. It is mostly gravy.`, 'good');
      return true;
    },
    () => {
      if (!ms.length) return false;
      const m = rng.pick(ms);
      adjust(m, 'mood', 4); adjust(m, 'image', -1);
      log(s, `${first(m)}'s nan knitted the whole band jumpers with the logo on. ${first(m)} wore theirs on stage, and meant it.`, 'neutral');
      return true;
    },
    () => {
      s.money -= 20;
      log(s, 'The gas bill arrived. Somebody had been running the fan heater all week to dry their leathers. £20.', 'bad');
      return true;
    },
    () => {
      const m = rng.pick(s.members);
      s.money += 20;
      log(s, `${m.isPlayer ? 'You' : first(m)} found a £20 note in an old leather jacket. The band ate well that night.`, 'good');
      return true;
    },
    () => {
      const glam = s.members.filter((m) => m.style === 'glam');
      if (year(s) < 1985 || !glam.length) return false;
      for (const m of glam) adjust(m, 'mood', -4);
      log(s, 'The chemist on the high street has run out of extra-hold hairspray. Rumour says a band from Slough bought the lot.', 'neutral');
      return true;
    },
    () => {
      if (!s.releases.some((r) => r.kind !== 'demo')) return false;
      s.fans += 8;
      for (const m of s.members) adjust(m, 'mood', 3);
      log(s, 'Your record is on the jukebox at the Crown & Gutter, between a crooner and a disco medley. It gets played twice a night.', 'good');
      return true;
    },
    () => {
      s.money -= 30;
      log(s, 'A burst pipe flooded the rehearsal room. Two leads and a fuzz pedal drowned. £30.', 'bad');
      return true;
    },
    () => {
      if (!ms.length) return false;
      const m = rng.pick(ms);
      const g = grow(m, 'skill', 2, rng);
      if (!g) return false;
      log(s, `${first(m)} has been learning scales from a library book in the bath. It shows.`, 'good');
      return true;
    },
    () => {
      if (s.fans < 30) return false;
      const rival = pickRivalName(s.world, rng);
      s.fans += 15;
      log(s, `${rival} have split up over "musical differences" and a car. Some of their fans have drifted your way.`, 'good');
      return true;
    },
    () => {
      if (!ms.length) return false;
      for (const m of s.members) adjust(m, 'mood', -2);
      log(s, `${first(rng.pick(ms))} came back from the music shop with a keytar. The band held an emergency meeting.`, 'neutral');
      return true;
    },
    () => {
      const metal = s.members.filter((m) => m.style === 'metal' || m.style === 'hardrock');
      if (!metal.length) return false;
      addBuzz(s, 1);
      for (const m of metal) adjust(m, 'mood', 4);
      log(s, 'The evening news ran a report on "the menace of heavy rock". The metalheads in the band watched it twice.', 'neutral');
      return true;
    },
    () => {
      if (s.buzz < 25) return false;
      addBuzz(s, 3);
      log(s, `A Sunday paper asked "Is rock music rotting the nation?" and used your photo to illustrate it. Thank you very much.`, 'good');
      return true;
    },
    () => {
      if (!ms.length) return false;
      const m = rng.pick(ms);
      adjust(m, 'energy', -8); adjust(m, 'mood', -4);
      log(s, `The dole office called ${first(m)} in to discuss "career prospects". They said "rock star". The clerk wrote "unemployed".`, 'neutral');
      return true;
    },
    () => {
      const m = rng.pick(s.members);
      if (m.outWeeks > 0) return false;
      adjust(m, 'energy', -15);
      log(s, `${m.isPlayer ? 'You have' : `${first(m)} has`} a stinking cold and has been gargling whisky and honey. Mostly whisky.`, 'bad');
      return true;
    },
    () => {
      if (s.lastGigWeek === null) return false;
      for (const m of s.members) { adjust(m, 'habit', 2); adjust(m, 'mood', 3); }
      log(s, 'A brewery rep left a crate of free beer at the stage door. It did not see Tuesday.', 'neutral');
      return true;
    },
    () => {
      if (!ms.length || s.lastGigWeek === null) return false;
      const m = rng.pick(ms);
      adjust(m, 'image', -1); addBuzz(s, 1);
      log(s, `${first(m)}'s leather trousers split on stage during the big jump. The front row will never forget it.`, 'neutral');
      return true;
    },
    () => {
      if (s.fans < 200) return false;
      for (const m of s.members) adjust(m, 'mood', 5);
      log(s, `A fan has had the ${s.bandName} logo tattooed on their forearm. Spelt nearly right.`, 'good');
      return true;
    },
    () => {
      s.tightness = clamp(s.tightness + 2, 0, 100);
      log(s, 'A synth duo at number one told a magazine that "guitars are finished". The band rehearsed twice as loud out of spite.', 'good');
      return true;
    },
    () => {
      if (s.fans < 80) return false;
      addBuzz(s, 1);
      log(s, 'Your handwritten setlist sold for £3 at a record fair in Camden. The buyer asked for the coffee stain to be authenticated.', 'neutral');
      return true;
    },
    () => {
      if (wheelsOf(s) !== 'van') return false;
      for (const m of s.members) adjust(m, 'energy', -5);
      log(s, 'A cold snap froze the van solid. Everyone pushed it down the hill. It started at the bottom, next to the pub.', 'neutral');
      return true;
    },
    () => {
      if (!s.flags.feud) return false;
      addBuzz(s, 2);
      log(s, `The feud rumbles on in the ${PRESS} letters page. Somebody wrote in signed "a disgusted roadie".`, 'neutral');
      return true;
    },
    () => {
      if (!ms.length) return false;
      const m = rng.pick(ms);
      adjust(m, 'mood', 6); adjust(m, 'habit', 3);
      log(s, `${first(m)} won £40 on a horse called Feedback and spent £41 celebrating it.`, 'neutral');
      return true;
    },
    () => {
      if (!s.manager) return false;
      addBuzz(s, 2);
      log(s, 'Your manager got you a mention on a breakfast radio show. You were described as "lively".', 'good');
      return true;
    },
    () => {
      if (s.fans < 100) return false;
      s.money += 25;
      log(s, 'The T-shirts have been bootlegged at the market. You sold your own cheaper next door and made £25.', 'good');
      return true;
    },
  ];
  for (const e of rng.shuffle(items)) if (e()) return;
}

// ---------------------------------------------------------------- engine hooks

/** Called at the end of each week. May set a pending choice and log some news. */
export function rollEvents(s: GameState, rng: Rng): void {
  if (rng.chance(0.18)) news(s, rng);
  if (s.pending || s.over) return;
  const fits = (e: EventDef) => (s.tour ? e.where !== 'home' : e.where !== 'tour');
  const forced = s.tour ? undefined : EVENTS.find((e) => e.id === 'christmas' && e.when(s, rng));
  // Playing a tour through in one go: only the big stuff interrupts, and not every week.
  const auto = !!s.tour && !!s.flags.autoTour;
  if (!forced && !rng.chance(auto ? 0.12 : s.tour ? 0.55 : 0.35)) return;
  const eligible: { def: EventDef; p: Params }[] = [];
  // On the road, road stories come first.
  const pool = forced ? [forced] : rng.shuffle(EVENTS.filter(fits).filter((e) => !auto || e.big)).sort((a, b) => (s.tour ? (b.where === 'tour' ? 1 : 0) - (a.where === 'tour' ? 1 : 0) : 0));
  for (const def of pool) {
    const p = def.when(s, rng);
    if (p) eligible.push({ def, p });
  }
  if (!eligible.length) return;
  const total = eligible.reduce((a, e) => a + e.def.weight, 0);
  let r = rng.next() * total;
  const pick = eligible.find((e) => (r -= e.def.weight) < 0) ?? eligible[0];
  s.pending = { def: pick.def.id, params: pick.p, week: s.week + 1 };
}

export interface PendingView {
  title: string;
  text: string;
  options: { label: string; hint: string; cost: number; locked?: string }[];
}

function def(id: string): EventDef {
  const d = EVENTS.find((e) => e.id === id);
  if (!d) throw new Error(`Unknown event ${id}`);
  return d;
}

/** Prices follow the band's means: a lawyer, a bribe or a repair costs what you can be seen to afford. */
export function priceFactor(s: GameState): number {
  return clamp(Math.sqrt(Math.max(0, s.money) / 2000), 1, 25);
}
const scaled = (s: GameState, cost: number) => Math.round((cost * priceFactor(s)) / (cost >= 1000 ? 100 : 10)) * (cost >= 1000 ? 100 : 10);

function optionsFor(s: GameState): EventOption[] {
  const p = s.pending!;
  return def(p.def).options(s, p.params).map((o) => {
    const cost = o.cost ? scaled(s, o.cost) : o.cost;
    return {
      ...o,
      cost,
      locked: o.locked ?? (cost && s.money < cost ? `Costs £${cost.toLocaleString('en-GB')}. You have £${s.money.toLocaleString('en-GB')}.` : undefined),
    };
  });
}

export function viewPending(s: GameState): PendingView | null {
  if (!s.pending) return null;
  const d = def(s.pending.def);
  return {
    title: d.title(s, s.pending.params),
    text: d.text(s, s.pending.params),
    options: optionsFor(s).map((o) => ({ label: o.label, hint: o.hint, cost: o.cost ?? 0, locked: o.locked })),
  };
}

export function resolvePending(state: GameState, index: number): GameState {
  if (!state.pending) throw new Error('Nothing to respond to.');
  const o = optionsFor(state)[index];
  if (!o) throw new Error('No such option.');
  if (o.locked) throw new Error(o.locked);
  return mutate(state, (s, rng) => {
    const p = s.pending!;
    const opt = optionsFor(s)[index];
    const d = def(p.def);
    openScene(s, 'event', d.title(s, p.params), 'drama');
    beat(s, undefined, `You chose: ${opt.label}.`);
    const before = snapshot(s);
    s.money -= opt.cost ?? 0;
    opt.resolve(s, rng, p.params);
    logEffects(s, before);
    s.scene!.recording = false;
    s.pending = null;
  });
}

/** For tests: list every event id. */
export const EVENT_IDS = EVENTS.map((e) => e.id);

/** For tests: force an event to be pending if its conditions hold. */
export function forceEvent(state: GameState, id: string): GameState {
  return mutate(state, (s, rng) => {
    const p = def(id).when(s, rng);
    if (!p) throw new Error(`Event ${id} not eligible`);
    s.pending = { def: id, params: p, week: s.week };
  });
}
