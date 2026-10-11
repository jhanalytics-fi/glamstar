// Romance, flings and scandal. Implied and off-screen: the scene cuts away, the consequences stay.
// Everyone involved is an adult. See docs/design.md, "Sex, romance and scandal".
import { clamp } from './rng';
import { addAffinity, getAffinity } from './chemistry';
import { addBuzz, adjust, first, log, player, removeMember, revealLog } from './helpers';
import type { EventDef } from './events';
import type { GameState, Musician } from './types';

const mem = (s: GameState, id: string | number) => s.members.find((m) => m.id === id);
const mates = (s: GameState) => s.members.filter((m) => !m.isPlayer && m.outWeeks === 0);
const since = (s: GameState, flag: string, weeks: number) => s.flags[flag] === undefined || s.week - s.flags[flag] >= weeks;
const everyone = (s: GameState, k: 'mood' | 'energy' | 'habit', d: number) => { for (const m of s.members) adjust(m, k, d); };

/** The band's current couple, if there is one and both are still in the band. */
export function couple(s: GameState): [Musician, Musician] | null {
  const key = Object.keys(s.flags).find((k) => k.startsWith('romance:'));
  if (!key) return null;
  const [a, b] = key.slice(8).split('|').map((id) => mem(s, id));
  return a && b ? [a, b] : null;
}
const romanceKey = (a: Musician, b: Musician) => `romance:${[a.id, b.id].sort().join('|')}`;
/** Exes: whatever they were, they are now this far apart. */
const sour = (s: GameState, a: Musician, b: Musician, to: number) => addAffinity(s, a.id, b.id, to - getAffinity(s, a.id, b.id));
const clearRomance = (s: GameState) => { for (const k of Object.keys(s.flags)) if (k.startsWith('romance:')) delete s.flags[k]; };
const imageHit = (s: GameState, d: number) => adjust(player(s), 'image', d);

const PICKUPS = [
  'a lighting tech from the venue next door',
  'someone who claims to manage a band you have never heard of',
  'a photography student with a borrowed camera',
  'the support act\'s merch seller',
  'a bored bank clerk on a night out',
  'someone who quoted your lyrics back to you, slightly wrong',
];

export const ROMANCE_EVENTS: EventDef[] = [
  {
    id: 'after_show',
    weight: 4,
    when: (s, rng) => (s.lastGigWeek === s.week && since(s, 'afterShow', 3) ? { who: rng.pick(PICKUPS) } : null),
    title: () => 'After the show',
    text: (_s, p) => `The lights are up, the floor is sticky and the bar has another hour in it. ${String(p.who).charAt(0).toUpperCase()}${String(p.who).slice(1)} has been looking your way since the encore.`,
    options: (_s, p) => [
      {
        label: 'Home, alone, with a kebab',
        hint: 'Sensible. Rock historians will skip this chapter.',
        resolve: (st) => {
          st.flags.afterShow = st.week;
          adjust(player(st), 'energy', 8);
          log(st, 'Home by one, kebab by quarter past. The band call you "Mum" for a week.', 'neutral');
        },
      },
      {
        label: 'Everyone to the after-party',
        hint: 'Good for spirits. Bad for Thursday.',
        resolve: (st, rng) => {
          st.flags.afterShow = st.week;
          everyone(st, 'mood', 6); everyone(st, 'energy', -10); everyone(st, 'habit', 3);
          for (const [a, b] of [[0, 1], [1, 2], [2, 3]]) if (st.members[a] && st.members[b]) addAffinity(st, st.members[a].id, st.members[b].id, 4);
          log(st, rng.chance(0.5) ? 'A flat in Camden, a bath full of ice and a sofa that has seen things. Nobody remembers leaving.' : 'Somebody\'s mate\'s squat until sunrise. The band came home a little closer and a lot more tired.', 'neutral');
        },
      },
      {
        label: `Leave with ${p.who}`,
        hint: 'The night cuts to black. The morning does not.',
        resolve: (st, rng) => {
          st.flags.afterShow = st.week;
          st.flags.fling = st.week;
          const me = player(st);
          adjust(me, 'mood', 12); adjust(me, 'energy', -14);
          const r = rng.next();
          if (r < 0.2) { addBuzz(st, 3); log(st, 'You were seen leaving together. By Tuesday half of Soho had a version of the story, and none of them match.', 'neutral'); }
          else if (r < 0.35) { adjust(me, 'mood', -10); log(st, 'You woke up in Croydon with one shoe and a phone number written on a beer mat in eyeliner. The number is for a minicab firm.', 'bad'); }
          else log(st, 'A taxi, a closing door, and a band meeting you were very late for. The grin did the explaining.', 'good');
        },
      },
    ],
  },
  {
    id: 'band_romance',
    weight: 2,
    when: (s) => {
      if (couple(s) || !since(s, 'romanceOver', 52)) return null;
      const ms = s.members.filter((m) => m.outWeeks === 0);
      let best: [Musician, Musician] | null = null;
      let top = 34;
      for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) {
        const v = getAffinity(s, ms[i].id, ms[j].id);
        if (v > top) { top = v; best = [ms[i], ms[j]]; }
      }
      return best ? { a: best[0].id, b: best[1].id } : null;
    },
    title: (s, p) => {
      const a = mem(s, p.a)!; const b = mem(s, p.b)!;
      return a.isPlayer || b.isPlayer ? `You and ${first(a.isPlayer ? b : a)}` : `${first(a)} and ${first(b)}`;
    },
    text: (s, p) => {
      const a = mem(s, p.a)!; const b = mem(s, p.b)!;
      const pair = a.isPlayer || b.isPlayer ? `you and ${first(a.isPlayer ? b : a)}` : `${first(a)} and ${first(b)}`;
      return `Separate rooms were booked. One of them was not slept in. It is official: ${pair} are an item, and the rest of the band found out from the van's steamed-up windows.`;
    },
    options: (s, p) => {
      const a = mem(s, p.a)!; const b = mem(s, p.b)!;
      return [
        {
          label: 'Bless it',
          hint: 'Love in the band. What could go wrong?',
          resolve: (st) => {
            const x = mem(st, a.id)!; const y = mem(st, b.id)!;
            st.flags[romanceKey(x, y)] = st.week;
            addAffinity(st, x.id, y.id, 30);
            adjust(x, 'mood', 10); adjust(y, 'mood', 10);
            for (const m of st.members) if (m !== x && m !== y) { adjust(m, 'mood', -3); addAffinity(st, m.id, x.id, -4); addAffinity(st, m.id, y.id, -4); }
            log(st, 'The couple now share a seat in the van, a toothbrush and opinions on the setlist. The others share a look.', 'neutral');
          },
        },
        {
          label: 'Band rule: no dating in the band',
          hint: 'Sensible, unpopular, probably ignored.',
          resolve: (st) => {
            const x = mem(st, a.id)!; const y = mem(st, b.id)!;
            adjust(x, 'mood', -10); adjust(y, 'mood', -10);
            for (const m of st.members) if (!m.isPlayer && m !== x && m !== y) adjust(m, 'mood', 3);
            log(st, 'The rule is written on the rehearsal-room door. Someone has added "lol" in lipstick.', 'neutral');
          },
        },
        {
          label: 'Pretend not to notice',
          hint: 'It will come out anyway. Things do.',
          resolve: (st, rng) => {
            const x = mem(st, a.id)!; const y = mem(st, b.id)!;
            if (rng.chance(0.6)) { st.flags[romanceKey(x, y)] = st.week; addAffinity(st, x.id, y.id, 20); }
            log(st, 'Nobody says a word. Everybody knows. Rehearsals have a new, careful silence.', 'neutral');
          },
        },
      ];
    },
  },
  {
    id: 'band_breakup',
    weight: 3,
    when: (s, rng) => {
      const c = couple(s);
      if (!c) return null;
      const key = romanceKey(c[0], c[1]);
      return s.week - s.flags[key] >= 8 && rng.chance(0.5) ? { a: c[0].id, b: c[1].id } : null;
    },
    title: () => 'It is over',
    text: (s, p) => {
      const a = mem(s, p.a)!; const b = mem(s, p.b)!;
      const pair = a.isPlayer || b.isPlayer ? `You and ${first(a.isPlayer ? b : a)}` : `${first(a)} and ${first(b)}`;
      return `${pair} have split up, loudly, in the middle of a soundcheck. A tambourine was thrown. It was not a musical choice.`;
    },
    options: (s, p) => {
      const a = mem(s, p.a)!; const b = mem(s, p.b)!;
      const mate = [a, b].filter((m) => !m.isPlayer).sort((x, y) => x.hidden.loyalty - y.hidden.loyalty)[0];
      const opts: EventOption[] = [
        {
          label: 'Keep calm and keep both',
          hint: 'Professionals. Allegedly.',
          resolve: (st) => {
            const x = mem(st, a.id)!; const y = mem(st, b.id)!;
            clearRomance(st); st.flags.romanceOver = st.week;
            sour(st, x, y, -90);
            adjust(x, 'mood', -15); adjust(y, 'mood', -15);
            log(st, 'They stand at opposite ends of the stage now. The bass player has taken to wearing a cycle helmet between songs.', 'bad');
          },
        },
        {
          label: 'Write the break-up album',
          hint: 'Pain is a muse. Also a lawsuit.',
          resolve: (st) => {
            const x = mem(st, a.id)!; const y = mem(st, b.id)!;
            clearRomance(st); st.flags.romanceOver = st.week;
            sour(st, x, y, -70);
            adjust(x, 'mood', -10); adjust(y, 'mood', -10);
            adjust(x, 'writing', 2); adjust(y, 'writing', 2);
            addBuzz(st, 2);
            log(st, 'Every new song is about the other one. They are, annoyingly, the best songs you have.', 'neutral');
          },
        },
      ];
      if (mate) {
        opts.push({
          label: `Ask ${first(mate)} to leave`,
          hint: 'Clean break. Somebody always pays for one.',
          resolve: (st) => {
            clearRomance(st); st.flags.romanceOver = st.week;
            const x = mem(st, mate.id);
            if (x) { log(st, `${first(x)} left after the break-up. Took the van keys, gave them back, took the good amp.`, 'bad'); removeMember(st, x.id, 'quit'); }
            everyone(st, 'mood', -4);
          },
        });
      }
      return opts;
    },
  },
  {
    id: 'kiss_and_tell',
    weight: 3,
    when: (s, rng) => {
      if (s.fans < 250 || !since(s, 'kissTell', 30)) return null;
      const recentFling = s.flags.fling !== undefined && s.week - s.flags.fling <= 12;
      if (!recentFling && !rng.chance(0.25)) return null;
      return { paper: rng.pick(['The Daily Grunt', 'The Sunday Squeal', 'Weekend Tattler']), source: rng.pick(PICKUPS) };
    },
    title: () => 'Kiss and tell',
    text: (s, p) => `${p.paper} has a story from ${p.source}: "MY WILD NIGHT WITH ${s.bandName.toUpperCase()} STAR". Most of it is invented. The bits that are not are worse.`,
    options: () => [
      {
        label: 'Deny everything',
        hint: 'Classic. Rarely works.',
        resolve: (st, rng) => {
          st.flags.kissTell = st.week;
          addBuzz(st, 3);
          if (rng.chance(0.5)) { imageHit(st, -2); log(st, 'The denial ran on page 7, next to a photo that rather undermined it.', 'bad'); }
          else log(st, 'The denial worked, mostly because a cabinet minister did something worse the same week.', 'good');
        },
      },
      {
        label: 'Pay to make it go away',
        hint: 'A man in Wardour Street knows a man at the paper.',
        cost: 200,
        resolve: (st) => {
          st.flags.kissTell = st.week;
          log(st, 'The story was spiked. The invoice said "consultancy". Nobody asks what was consulted.', 'neutral');
        },
      },
      {
        label: 'Lean into it',
        hint: 'Any publicity. Probably.',
        resolve: (st, rng) => {
          st.flags.kissTell = st.week;
          addBuzz(st, 8);
          st.fans += Math.round(20 + st.fans * 0.03);
          if (rng.chance(0.4)) { imageHit(st, -3); everyone(st, 'mood', -3); log(st, 'You gave a quote, a wink and a photo op. Your mum rang. The band are pretending not to know you.', 'bad'); }
          else { imageHit(st, 2); log(st, '"No regrets," you told the paper. The posters sold out by Friday.', 'good'); }
        },
      },
    ],
  },
  {
    id: 'partner_ultimatum',
    weight: 2,
    when: (s, rng) => {
      const c = mates(s).filter((m) => !couple(s)?.includes(m));
      if (!c.length || !since(s, 'ultimatum', 40) || s.week < 20) return null;
      return { m: rng.pick(c).id };
    },
    title: (s, p) => `${first(mem(s, p.m)!)}'s other half`,
    text: (s, p) => `${first(mem(s, p.m)!)}'s partner has had enough of late nights, ringing ears and the van parked across their drive. The words "it's me or the band" have been used.`,
    options: (s, p) => {
      const m = mem(s, p.m)!;
      return [
        {
          label: `Give ${first(m)} a week off`,
          hint: 'Flowers, a curry, a promise nobody believes.',
          resolve: (st) => {
            st.flags.ultimatum = st.week;
            const x = mem(st, m.id)!;
            x.outWeeks = Math.max(x.outWeeks, 1);
            adjust(x, 'mood', 8); adjust(x, 'energy', 15);
            log(st, `${first(x)} took a week off for "the relationship". It bought another six months.`, 'neutral');
          },
        },
        {
          label: 'Invite the partner to a gig',
          hint: 'Win them over. Or give them a front-row seat to the problem.',
          resolve: (st, rng) => {
            st.flags.ultimatum = st.week;
            const x = mem(st, m.id)!;
            if (rng.chance(0.55)) { adjust(x, 'mood', 10); log(st, 'The partner came, saw, and bought a T-shirt. Peace in our time.', 'good'); }
            else { adjust(x, 'mood', -10); log(st, 'The partner came, saw the after-party, and left before the encore. The atmosphere at home is described as "arctic".', 'bad'); }
          },
        },
        {
          label: `Tell ${first(m)} to choose`,
          hint: 'Loyalty, tested in public.',
          resolve: (st) => {
            st.flags.ultimatum = st.week;
            const x = mem(st, m.id)!;
            revealLog(st, x, 'loyalty', 1);
            if (x.hidden.loyalty >= 50) { adjust(x, 'mood', -6); x.hidden.loyalty = clamp(x.hidden.loyalty + 5, 1, 99); log(st, `${first(x)} chose the band. The partner chose the spare room.`, 'neutral'); }
            else { log(st, `${first(x)} chose love, a semi in Bromley and a steady job. The farewell card was signed by the partner.`, 'bad'); removeMember(st, x.id, 'quit'); }
          },
        },
      ];
    },
  },
  {
    id: 'double_booked',
    weight: 2,
    when: (s) => (s.flags.fling !== undefined && s.week - s.flags.fling <= 10 && since(s, 'doubleBooked', 40) && s.lastGigWeek !== null ? {} : null),
    title: () => 'Double booked',
    text: () => 'Two people you have been "seeing" have turned up to the same gig. They have found each other at the bar. They are comparing notes, and the notes are about you.',
    options: () => [
      {
        label: 'Hide in the dressing room until they leave',
        hint: 'Coward. Alive, though.',
        resolve: (st) => { st.flags.doubleBooked = st.week; adjust(player(st), 'mood', -6); log(st, 'You spent two hours in a broom cupboard with the drummer. You now know more about the drummer than you wanted.', 'neutral'); },
      },
      {
        label: 'Dedicate a song to both of them',
        hint: 'Bold. Possibly fatal.',
        resolve: (st, rng) => {
          st.flags.doubleBooked = st.week; addBuzz(st, 3);
          if (rng.chance(0.5)) log(st, 'They left together, arm in arm, laughing at you. Honestly, good for them.', 'neutral');
          else { adjust(player(st), 'mood', -8); log(st, 'A pint arrived on stage at speed. Then a second pint. The crowd thought it was part of the act.', 'bad'); }
        },
      },
    ],
  },
];

/** Life on the road. How often depends on the tour policy you set. */
export const ROAD_ROMANCE: EventDef[] = [
  {
    id: 'road_fling',
    weight: 3,
    where: 'tour',
    when: (s, rng) => {
      if (!s.tour || !since(s, 'roadFling', 3)) return null;
      const odds = s.tour.policy === 'wild' ? 1 : s.tour.policy === 'steady' ? 0.5 : 0.15;
      const m = rng.pick(s.members.filter((x) => x.outWeeks === 0));
      return m && rng.chance(odds) ? { m: m.id, who: rng.pick(PICKUPS) } : null;
    },
    title: (s, p) => (mem(s, p.m)!.isPlayer ? 'A night off the leash' : `${first(mem(s, p.m)!)} goes missing`),
    text: (s, p) => {
      const m = mem(s, p.m)!;
      return m.isPlayer
        ? `Another town, another hotel bar, and ${p.who} who wants to hear all about the tour. Lobby call is at seven.`
        : `${first(m)} left the hotel bar with ${p.who} and has not been seen since. Lobby call is at seven.`;
    },
    options: (s, p) => {
      const m = mem(s, p.m)!;
      return [
        {
          label: 'Lobby call is sacred',
          hint: 'The tour manager in you wins.',
          resolve: (st) => { st.flags.roadFling = st.week; const x = mem(st, m.id)!; adjust(x, 'mood', -4); adjust(x, 'energy', 6); log(st, 'Everyone on the bus at seven, sober-ish and sulking. A dull, professional morning.', 'neutral'); },
        },
        {
          label: 'What happens on tour...',
          hint: '...ends up in the tour diary. Eventually.',
          resolve: (st, rng) => {
            st.flags.roadFling = st.week; st.flags.fling = st.week;
            const x = mem(st, m.id)!;
            adjust(x, 'mood', 10); adjust(x, 'energy', -12);
            if (rng.chance(0.3)) { adjust(x, 'mood', -6); st.tightness = clamp(st.tightness - 3, 0, 100); log(st, `${x.isPlayer ? 'You' : first(x)} turned up at the next venue with five minutes to spare and someone else's jacket. The soundcheck was skipped. The show was not great.`, 'bad'); }
            else log(st, `${x.isPlayer ? 'You' : first(x)} made the bus at 7:04, grinning, wearing yesterday's stage clothes. Nobody asked. Everybody knew.`, 'good');
          },
        },
      ];
    },
  },
];

type EventOption = ReturnType<EventDef['options']>[number];
