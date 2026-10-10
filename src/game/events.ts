// Random situations. Choice events stop the week until the player picks a response; news events just happen.
import { Rng, clamp } from './rng';
import { addAffinity, available, forEachPair, getAffinity, performance } from './chemistry';
import { PRESS, songTitle } from './names';
import { addBuzz, adjust, first, log, logEffects, mutate, player, removeMember, revealLog, snapshot, subj } from './helpers';
import { pickRivalName } from './world';
import type { GameState, Musician } from './types';

type Params = Record<string, string | number>;

export interface EventOption {
  label: string;
  hint: string;
  cost?: number;
  locked?: string;
  resolve: (s: GameState, rng: Rng, p: Params) => void;
}

interface EventDef {
  id: string;
  weight: number;
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

const EVENTS: EventDef[] = [
  {
    id: 'fight',
    weight: 3,
    when: (s, rng) => {
      const w = worstPair(s);
      if (!w) return null;
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
    weight: 2,
    when: (s) => (!s.flags.noVan && s.lastGigWeek !== null ? {} : null),
    title: () => 'The van died on the A406',
    text: () => 'Steam, a bang, and a smell of burning clutch. A garage will fix it. Or you could not.',
    options: (s) => {
      const fixer = [...mates(s)].sort((a, b) => b.hidden.reliability - a.hidden.reliability)[0];
      const opts: EventOption[] = [
        { label: 'Take it to a garage', hint: 'Done properly.', cost: 90, resolve: (st) => log(st, 'The van is fixed. The mechanic found a shoe in the engine.', 'neutral') },
      ];
      if (fixer) {
        opts.push({
          label: `Let ${first(fixer)} have a go`,
          hint: 'A spanner and some optimism.',
          resolve: (st, rng) => {
            if (rng.chance(0.55)) log(st, `${first(fixer)} fixed it with a coat hanger. Legend.`, 'good');
            else { st.money -= 40; for (const m of st.members) adjust(m, 'mood', -4); log(st, `${first(fixer)} made it worse. The garage charged £40 anyway.`, 'bad'); }
          },
        });
      }
      opts.push({
        label: 'Sell it for scrap',
        hint: 'Get £150 now. Gigs on the night bus wear everyone out.',
        resolve: (st) => { st.money += 150; st.flags.noVan = 1; log(st, 'The van went for £150. The band now travels by night bus with a bass amp.', 'neutral'); },
      });
      return opts;
    },
  },
  {
    id: 'transit',
    weight: 3,
    when: (s) => (s.flags.noVan ? {} : null),
    title: () => 'An old van for sale',
    text: () => 'A mate of a mate is selling a van. Rust holds it together. £120.',
    options: () => [
      { label: 'Buy it', hint: 'Wheels again.', cost: 120, resolve: (st) => { st.flags.noVan = 0; log(st, 'The band has a van again. It smells of sheep.', 'good'); } },
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
  ];
  for (const e of rng.shuffle(items)) if (e()) return;
}

// ---------------------------------------------------------------- engine hooks

/** Called at the end of each week. May set a pending choice and log some news. */
export function rollEvents(s: GameState, rng: Rng): void {
  if (rng.chance(0.18)) news(s, rng);
  if (s.pending || s.over) return;
  const forced = EVENTS.find((e) => e.id === 'christmas' && e.when(s, rng));
  if (!forced && !rng.chance(0.35)) return;
  const eligible: { def: EventDef; p: Params }[] = [];
  for (const def of forced ? [forced] : rng.shuffle(EVENTS)) {
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

function optionsFor(s: GameState): EventOption[] {
  const p = s.pending!;
  return def(p.def).options(s, p.params).map((o) => ({
    ...o,
    locked: o.locked ?? (o.cost && s.money < o.cost ? `Costs £${o.cost}. You have £${s.money}.` : undefined),
  }));
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
    const before = snapshot(s);
    s.money -= opt.cost ?? 0;
    opt.resolve(s, rng, p.params);
    logEffects(s, before);
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
