// Somebody always wants a new guitar.
import { clamp } from './rng';
import { addAffinity, available } from './chemistry';
import { addBuzz, adjust, first, log, milestone, revealLog } from './helpers';
import { KIT_WORD, WISHLIST, kitGain } from './kit';
import type { EventDef } from './events';
import type { GameState } from './types';

const since = (s: GameState, flag: string, weeks: number) => s.flags[flag] === undefined || s.week - s.flags[flag] >= weeks;
const mem = (s: GameState, id: string | number) => s.members.find((m) => m.id === id)!;

export const KIT_EVENTS: EventDef[] = [
  {
    id: 'kit_wish',
    weight: 4,
    where: 'home',
    when: (s, rng) => {
      const c = available(s).filter((m) => !m.isPlayer && (m.kit ?? 30) < 85);
      if (!c.length || !since(s, 'kitWish', 10)) return null;
      const m = rng.pick(c);
      const price = Math.round(clamp(120 + s.fans * 0.06 + (m.kit ?? 30) * 4, 120, 9000) / 10) * 10;
      return { m: m.id, what: rng.pick(WISHLIST[m.role] ?? WISHLIST.guitar), price };
    },
    title: (s, p) => `${first(mem(s, p.m))} wants ${p.what}`,
    text: (s, p) => {
      const m = mem(s, p.m);
      return `${first(m)} has seen ${p.what} in a shop window and has not talked about anything else for a week. £${Number(p.price).toLocaleString('en-GB')}. ${first(m)}'s current kit is ${KIT_WORD(m.kit ?? 30)} (${m.kit ?? 30}), and ${first(m)} would like the band to know that this is holding everyone back.`;
    },
    options: (s, p) => {
      const m = mem(s, p.m);
      const price = Number(p.price);
      return [
        {
          label: `Buy it from the band account: £${price.toLocaleString('en-GB')}`,
          hint: 'Better kit, a happy player, a loyal one.',
          cost: price,
          resolve: (st) => {
            st.flags.kitWish = st.week;
            const x = mem(st, m.id);
            x.kit = clamp((x.kit ?? 30) + kitGain(x.kit ?? 30, price * 1.6), 1, 100);
            adjust(x, 'mood', 12);
            x.hidden.loyalty = clamp(x.hidden.loyalty + 4, 1, 99);
            addAffinity(st, x.id, 'p', 6);
            log(st, `${first(x)} has ${p.what}. ${first(x)}'s kit is now ${KIT_WORD(x.kit)} (${x.kit}). ${first(x)} sleeps with it.`, 'good');
          },
        },
        {
          label: `Half each. ${first(m)} pays the rest`,
          hint: 'Fair. Slightly less thrilling.',
          cost: Math.round(price / 2),
          resolve: (st) => {
            st.flags.kitWish = st.week;
            const x = mem(st, m.id);
            x.kit = clamp((x.kit ?? 30) + kitGain(x.kit ?? 30, price * 1.6), 1, 100);
            adjust(x, 'mood', 6);
            log(st, `${first(x)} put the rest in from a shoebox. ${String(p.what).charAt(0).toUpperCase()}${String(p.what).slice(1)} is in the rehearsal room by Friday, with a label saying "${first(x).toUpperCase()}'S".`, 'good');
          },
        },
        {
          label: 'Save up. The band comes first',
          hint: 'Nothing changes, except the mood. Big egos may buy it anyway, with your money.',
          resolve: (st, rng) => {
            st.flags.kitWish = st.week;
            const x = mem(st, m.id);
            if (x.hidden.ego >= 70 && rng.chance(0.4)) {
              st.money -= price;
              x.kit = clamp((x.kit ?? 30) + kitGain(x.kit ?? 30, price * 1.6), 1, 100);
              adjust(x, 'mood', 8);
              for (const y of available(st)) if (y !== x) adjust(y, 'mood', -4);
              revealLog(st, x, 'ego', 2);
              addAffinity(st, x.id, 'p', -8);
              log(st, `${first(x)} bought it anyway, on the band account, and brought it to rehearsal with a look. £${price.toLocaleString('en-GB')} gone. The rest of the band noticed.`, 'bad');
            } else {
              adjust(x, 'mood', -6);
              addAffinity(st, x.id, 'p', -3);
              log(st, `${first(x)} said "fine" in the voice that means the opposite, and played the old one a little too loud all week.`, 'neutral');
            }
          },
        },
      ];
    },
  },
  {
    id: 'endorsement',
    weight: 3,
    where: 'home',
    when: (s, rng) => {
      const c = available(s).filter((m) => (m.kit ?? 30) < 90 && m.role !== 'vocals');
      return s.fans >= 15000 && c.length && since(s, 'endorsement', 52) ? { m: rng.pick(c).id, maker: rng.pick(['Harlow', 'Vulcan', 'Kestrel', 'Valhalla', 'Polyvox', 'Tungsten', 'Osprey']) } : null;
    },
    title: (s, p) => `${p.maker} want ${first(mem(s, p.m))} on a poster`,
    text: (s, p) => `${p.maker} would like ${first(mem(s, p.m))} to play their gear, exclusively, for free. All of it, as much as ${first(mem(s, p.m))} wants, plus a poster in every music shop in the country with ${first(mem(s, p.m))} pulling a face. The catch: nothing else on stage, ever, and a signing session at a trade fair in Frankfurt once a year.`,
    options: (s, p) => {
      const m = mem(s, p.m);
      return [
        {
          label: 'Sign. Free gear is free gear',
          hint: 'Top kit for nothing, a poster, and a yearly weekend in Frankfurt.',
          resolve: (st) => {
            st.flags.endorsement = st.week;
            const x = mem(st, m.id);
            x.kit = Math.max(x.kit ?? 30, 88);
            adjust(x, 'mood', 10); adjust(x, 'image', 2);
            addBuzz(st, 4);
            milestone(st, 'career', `${first(x)} signed an endorsement deal with ${p.maker}.`);
            log(st, `${first(x)} is a ${p.maker} artist. A lorry of gear arrived, then a photographer, then a poster of ${first(x)} looking surprised in a thousand shop windows.`, 'good');
          },
        },
        {
          label: `${first(m)} plays what ${first(m)} likes`,
          hint: 'No strings. No free gear either.',
          resolve: (st) => { st.flags.endorsement = st.week; const x = mem(st, m.id); adjust(x, 'mood', -3); log(st, `${first(x)} turned ${p.maker} down and kept the old one. ${p.maker} signed a man from a band with more hair.`, 'neutral'); },
        },
      ];
    },
  },
];
