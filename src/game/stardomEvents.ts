// Life at the top: sex, drugs and rock'n'roll, the way it was, with the bedroom door shut and the
// consequences wide open. Choices here trade skill, nerve, image, mood, habits and loyalty, not pocket money.
// Everyone involved is an adult.
import { Rng, clamp } from './rng';
import { addAffinity, available, forEachPair } from './chemistry';
import { addBuzz, adjust, first, grow, log, milestone, player, revealLog } from './helpers';
import { PRESS } from './names';
import type { EventDef } from './events';
import type { GameState, Musician } from './types';

const since = (s: GameState, flag: string, weeks: number) => s.flags[flag] === undefined || s.week - s.flags[flag] >= weeks;
const mates = (s: GameState) => s.members.filter((m) => !m.isPlayer && m.outWeeks === 0);
const mem = (s: GameState, id: string | number) => s.members.find((m) => m.id === id)!;
const everyone = (s: GameState, k: 'mood' | 'energy' | 'habit' | 'image' | 'stage', d: number) => { for (const m of available(s)) adjust(m, k, d); };
const star = (s: GameState, rng: Rng) => { const big = s.world.stars.filter((x) => x.fame >= 70); return (big.length ? rng.pick(big) : rng.pick(s.world.stars)).name; };
const who = (m: Musician) => (m.isPlayer ? 'you' : first(m));
const Who = (m: Musician) => (m.isPlayer ? 'You' : first(m));

export const STARDOM_EVENTS: EventDef[] = [
  {
    id: 'hotel_floor',
    weight: 4,
    where: 'tour',
    when: (s) => (s.tour && s.fans >= 3000 && since(s, 'hotelFloor', 6) ? {} : null),
    title: () => 'The seventh floor',
    text: () => 'The hotel has given the band a whole floor and the floor has filled up: fans, friends of fans, a DJ nobody booked, two people from the label and a man selling something from a briefcase. It is two in the morning and the lift keeps arriving.',
    options: () => [
      {
        label: 'Open every door. This is what it was for',
        hint: 'Legendary night. Nobody sleeps, everybody talks.',
        resolve: (st, rng) => {
          st.flags.hotelFloor = st.week; st.flags.fling = st.week;
          everyone(st, 'mood', 14); everyone(st, 'energy', -18); everyone(st, 'habit', 6); everyone(st, 'image', 1);
          addBuzz(st, 8);
          const w = rng.pick(available(st));
          log(st, `The seventh floor became the stuff of tour legend. ${Who(w)} ${w.isPlayer ? 'were' : 'was'} last seen leading a conga through the kitchens. The hotel has written to the label.`, 'good');
        },
      },
      {
        label: 'Lock your door and write',
        hint: 'The song comes out of the noise through the wall.',
        resolve: (st, rng) => {
          st.flags.hotelFloor = st.week;
          const me = player(st);
          grow(me, 'writing', 3, rng); adjust(me, 'mood', -4); adjust(me, 'energy', 4);
          for (const m of mates(st)) { adjust(m, 'mood', 8); adjust(m, 'habit', 5); }
          log(st, 'You wrote a verse about the party you could hear through the wall. The band came back with stories. You came back with a bridge.', 'neutral');
        },
      },
      {
        label: 'Clear the floor. Lobby call is at seven',
        hint: 'The band hates you until the show, then thanks you.',
        resolve: (st) => {
          st.flags.hotelFloor = st.week;
          for (const m of mates(st)) { adjust(m, 'mood', -8); addAffinity(st, m.id, 'p', -3); }
          everyone(st, 'energy', 8);
          st.tightness = clamp(st.tightness + 3, 0, 100);
          log(st, 'You sent everyone home, including the DJ. The band called you "Dad" for a week. The next show was the tightest of the tour.', 'neutral');
        },
      },
    ],
  },
  {
    id: 'rock_doctor',
    weight: 3,
    when: (s, rng) => {
      const tired = available(s).filter((m) => m.energy < 40);
      return s.fans >= 5000 && tired.length && since(s, 'rockDoctor', 20) ? { m: rng.pick(tired).id } : null;
    },
    title: () => 'Dr Feelgood',
    text: (s, p) => `A man with a doctor's bag and a tan has attached himself to the band. "Vitamins," he says, "for the road." ${Who(mem(s, p.m))} ${mem(s, p.m).isPlayer ? 'have' : 'has'} not slept properly in a month and ${mem(s, p.m).isPlayer ? 'are' : 'is'} looking at the bag.`,
    options: (s, p) => {
      const m = mem(s, p.m);
      return [
        {
          label: 'Vitamins all round',
          hint: 'Everyone bounces for weeks. Then the bill comes, and it is not money.',
          resolve: (st) => {
            st.flags.rockDoctor = st.week; st.flags.doctor = 1;
            for (const x of available(st)) { x.energy = 100; adjust(x, 'mood', 10); adjust(x, 'habit', 14); x.hidden.stamina = clamp(x.hidden.stamina - 3, 1, 99); }
            log(st, 'The band has never felt better. The band has never looked worse. The doctor now travels with you and has his own room.', 'neutral');
          },
        },
        {
          label: `Just for ${who(m)}, just this once`,
          hint: 'One person patched up. Once is never once.',
          resolve: (st) => {
            st.flags.rockDoctor = st.week;
            const x = mem(st, m.id);
            x.energy = 100; adjust(x, 'habit', 18); adjust(x, 'mood', 6);
            revealLog(st, x, 'vice', 1);
            log(st, `${Who(x)} came back from the doctor's room like a new person. A slightly different person.`, 'neutral');
          },
        },
        {
          label: 'Throw the bag and the man off the bus',
          hint: 'The hard way. A few sulks, a clean band.',
          resolve: (st) => {
            st.flags.rockDoctor = st.week;
            for (const x of available(st)) { if (x.hidden.vice >= 60) adjust(x, 'mood', -8); else adjust(x, 'mood', 3); }
            adjust(player(st), 'image', 1);
            log(st, 'The doctor was put off at a service station with his bag and his tan. Two members of the band watched him go like a lost dog.', 'good');
          },
        },
      ];
    },
  },
  {
    id: 'guitar_hero_jam',
    weight: 2,
    when: (s, rng) => {
      const c = mates(s).filter((m) => m.role === 'guitar' || m.role === 'keys' || m.role === 'drums');
      return s.fans >= 8000 && c.length && since(s, 'heroJam', 60) ? { m: rng.pick(c).id, hero: star(s, rng) } : null;
    },
    title: (s, p) => `${p.hero} wants to jam with ${first(mem(s, p.m))}`,
    text: (s, p) => `${p.hero}, who ${first(mem(s, p.m))} has worshipped since school, has invited ${first(mem(s, p.m))} to a session. Just the two of them. For a week. In a studio in the country with no telephone.`,
    options: (s, p) => {
      const m = mem(s, p.m);
      return [
        {
          label: `Let ${first(m)} go`,
          hint: 'A week without them. They come back better, and bigger-headed.',
          resolve: (st, rng) => {
            st.flags.heroJam = st.week;
            const x = mem(st, m.id);
            x.outWeeks = Math.max(x.outWeeks, 1);
            grow(x, 'skill', 4, rng); adjust(x, 'mood', 15);
            x.hidden.ego = clamp(x.hidden.ego + 10, 1, 99);
            revealLog(st, x, 'ego', 1);
            addBuzz(st, 4);
            log(st, `${first(x)} came back from the country with a new tuning, a new coat and a story that begins "so me and ${p.hero}". Every rehearsal now has that story in it.`, 'good');
          },
        },
        {
          label: 'Not in the middle of this. The band comes first',
          hint: 'Loyalty, tested. Resentment, probable.',
          resolve: (st) => {
            st.flags.heroJam = st.week;
            const x = mem(st, m.id);
            adjust(x, 'mood', -18); addAffinity(st, x.id, 'p', -15);
            x.hidden.loyalty = clamp(x.hidden.loyalty - 8, 1, 99);
            revealLog(st, x, 'loyalty', 1);
            log(st, `${first(x)} said nothing. ${first(x)} has been saying nothing for a week now, loudly.`, 'bad');
          },
        },
        {
          label: 'Only if the whole band goes',
          hint: 'A cheek. Sometimes it works.',
          resolve: (st, rng) => {
            st.flags.heroJam = st.week;
            if (rng.chance(0.4)) {
              for (const x of available(st)) { grow(x, 'skill', 2, rng); adjust(x, 'mood', 8); }
              st.tightness = clamp(st.tightness + 5, 0, 100);
              log(st, `${p.hero} laughed and said bring them all. A week in the country, and the band came back playing like one animal.`, 'good');
            } else {
              const x = mem(st, m.id);
              adjust(x, 'mood', -10);
              log(st, `${p.hero}'s people said no, and then said nothing at all. ${first(x)} blames you.`, 'bad');
            }
          },
        },
      ];
    },
  },
  {
    id: 'intervention',
    weight: 5,
    when: (s, rng) => {
      const far = mates(s).filter((m) => m.habit >= 70);
      return far.length && since(s, 'intervention', 30) ? { m: rng.pick(far).id } : null;
    },
    title: (s, p) => `${first(mem(s, p.m))} is in trouble`,
    text: (s, p) => `${first(mem(s, p.m))} has stopped turning up on time, then stopped turning up, then turned up at four in the morning to tell you about a plan involving a boat. Everyone can see it. Nobody has said it.`,
    options: (s, p) => {
      const m = mem(s, p.m);
      return [
        {
          label: 'Sit them down. All of you',
          hint: 'The talk. It works more often than not. The rest of the time it ends badly.',
          resolve: (st, rng) => {
            st.flags.intervention = st.week;
            const x = mem(st, m.id);
            if (rng.chance(0.6)) {
              adjust(x, 'habit', -35); adjust(x, 'mood', -10);
              x.hidden.loyalty = clamp(x.hidden.loyalty + 10, 1, 99);
              forEachPair(st.members, (a, b) => addAffinity(st, a.id, b.id, 4));
              milestone(st, 'drama', `The band sat ${first(x)} down. ${first(x)} listened.`);
              log(st, `${first(x)} cried, then shouted, then cried again, then went home with the bass player and slept for two days. It is a start.`, 'good');
            } else {
              adjust(x, 'mood', -25); addAffinity(st, x.id, 'p', -20);
              log(st, `${first(x)} called you a hypocrite, which was fair, and walked out, which was not. Back three days later, pretending nothing happened.`, 'bad');
            }
          },
        },
        {
          label: 'A quiet month in a clinic in the country',
          hint: 'Out for three weeks, back clean. The papers may find out.',
          resolve: (st, rng) => {
            st.flags.intervention = st.week;
            const x = mem(st, m.id);
            x.outWeeks = Math.max(x.outWeeks, 3);
            x.habit = 5; adjust(x, 'mood', 5);
            x.hidden.loyalty = clamp(x.hidden.loyalty + 12, 1, 99);
            milestone(st, 'drama', `${first(x)} spent a month in a clinic.`);
            if (rng.chance(0.4)) { addBuzz(st, 5); log(st, `${PRESS} ran "${first(x).toUpperCase()}: MY HELL". ${first(x)} has not read it. The band has read it twice.`, 'neutral'); }
            else log(st, `${first(x)} went to the country "to rest". Came back clear-eyed, ten pounds heavier and very keen on fishing.`, 'good');
          },
        },
        {
          label: 'Cover for them. The show must go on',
          hint: 'Nothing changes except the odds.',
          resolve: (st) => {
            st.flags.intervention = st.week;
            const x = mem(st, m.id);
            adjust(x, 'habit', 8);
            st.tightness = clamp(st.tightness - 6, 0, 100);
            for (const y of mates(st)) if (y !== x) adjust(y, 'mood', -5);
            log(st, `The roadies learned ${first(x)}'s parts, just in case. Nobody says why. Everybody knows why.`, 'bad');
          },
        },
      ];
    },
  },
  {
    id: 'hotel_raid',
    weight: 2,
    where: 'tour',
    when: (s) => (s.tour && available(s).some((m) => m.habit >= 40) && since(s, 'hotelRaid', 60) ? {} : null),
    title: () => 'Police at the door',
    text: () => 'Four in the morning. A knock that is not room service. Two uniforms, one plain-clothes, and a tip-off from somebody. There is about thirty seconds before the door opens and a lot in the room that should not be.',
    options: (s) => {
      const worst = [...available(s)].sort((a, b) => b.habit - a.habit)[0];
      return [
        {
          label: 'Bathroom. Everything. Now',
          hint: 'A clean room, a sore band, a story for the bus.',
          resolve: (st) => {
            st.flags.hotelRaid = st.week;
            everyone(st, 'habit', -12); everyone(st, 'mood', -6);
            log(st, 'The plumbing of the hotel will never be the same. The police found a band in dressing gowns, playing cards. "Snap," said the drummer.', 'neutral');
          },
        },
        {
          label: 'Take the rap yourself',
          hint: 'A night in the cells and a front page. Your image loves it. Your mother does not.',
          resolve: (st) => {
            st.flags.hotelRaid = st.week;
            const me = player(st);
            adjust(me, 'image', 4); addBuzz(st, 10);
            me.outWeeks = Math.max(me.outWeeks, 1);
            for (const m of mates(st)) { addAffinity(st, m.id, 'p', 10); adjust(m, 'mood', 5); }
            milestone(st, 'drama', 'Spent a night in the cells so the band did not have to.');
            log(st, `"It's all mine, officer." It was not all yours. The band will never forget it, and ${PRESS} will never let you.`, 'good');
          },
        },
        {
          label: `Let ${first(worst)} explain`,
          hint: 'It was mostly theirs anyway. They will remember who said so.',
          resolve: (st) => {
            st.flags.hotelRaid = st.week;
            const x = mem(st, worst.id);
            x.outWeeks = Math.max(x.outWeeks, 1); adjust(x, 'mood', -20); addAffinity(st, x.id, 'p', -25);
            x.hidden.loyalty = clamp(x.hidden.loyalty - 10, 1, 99);
            addBuzz(st, 4);
            log(st, `${first(x)} went quietly, which was the last quiet thing about it. Bailed by lunchtime. Not speaking by teatime.`, 'bad');
          },
        },
      ];
    },
  },
  {
    id: 'polaroids',
    weight: 2,
    when: (s) => (s.fans >= 10000 && s.flags.fling !== undefined && s.week - s.flags.fling <= 20 && since(s, 'polaroids', 60) ? {} : null),
    title: () => 'The polaroids',
    text: () => 'Somebody has photographs. Not good ones, not clear ones, but ones with you in them and the lights on. They are being offered to a Sunday paper and, as a courtesy, to you first.',
    options: () => [
      {
        label: 'Let them print. Rock stars have nothing to hide',
        hint: 'Buzz up, dignity down, your face on every newsstand.',
        resolve: (st) => {
          st.flags.polaroids = st.week;
          addBuzz(st, 14); adjust(player(st), 'image', 3); adjust(player(st), 'mood', -4);
          st.fans += Math.round(200 + st.fans * 0.01);
          log(st, 'Page three, page five and a pull-out. Your mum bought four copies "for the family". Record shops reported a rush.', 'neutral');
        },
      },
      {
        label: 'Send the manager, or a lawyer, or somebody large',
        hint: 'The pictures vanish. So does some goodwill.',
        resolve: (st) => {
          st.flags.polaroids = st.week;
          if (st.manager) { log(st, `${st.manager.name} "had a word". The photographs were posted back in a plain envelope, with an apology and, oddly, a fruit basket.`, 'neutral'); }
          else { adjust(player(st), 'mood', -8); log(st, 'A man you did not know you knew went round. The photographs came back. You did not ask how.', 'neutral'); }
          addBuzz(st, -2);
        },
      },
      {
        label: 'Buy them and burn them, in front of the band',
        hint: 'Costs a bit. The band finds it hilarious, and trusts you more.',
        cost: 800,
        resolve: (st) => {
          st.flags.polaroids = st.week;
          for (const m of mates(st)) { addAffinity(st, m.id, 'p', 6); adjust(m, 'mood', 6); }
          log(st, 'A ceremonial burning in a hotel sink. The drummer kept one. You know which one.', 'good');
        },
      },
    ],
  },
  {
    id: 'the_muse',
    weight: 2,
    when: (s, rng) => {
      const c = mates(s).filter((m) => m.writing >= 40);
      return s.fans >= 2000 && c.length && since(s, 'muse', 50) ? { m: rng.pick(c).id } : null;
    },
    title: (s, p) => `${first(mem(s, p.m))} is in love`,
    text: (s, p) => `${first(mem(s, p.m))} has met someone, and the songs are pouring out: three this week, all brilliant, all about the same person. ${first(mem(s, p.m))} has also missed two rehearsals and a photo session, and is "not available Thursdays".`,
    options: (s, p) => {
      const m = mem(s, p.m);
      return [
        {
          label: 'Let it burn. Take the songs',
          hint: 'Great material, loose band.',
          resolve: (st, rng) => {
            st.flags.muse = st.week;
            const x = mem(st, m.id);
            grow(x, 'writing', 4, rng); adjust(x, 'mood', 15);
            st.tightness = clamp(st.tightness - 8, 0, 100);
            for (const y of mates(st)) if (y !== x) adjust(y, 'mood', -4);
            log(st, `${first(x)} wrote a song a day for a month and turned up to one rehearsal. The songs are the best you have. The rehearsal was not.`, 'neutral');
          },
        },
        {
          label: 'Band first. Thursdays included',
          hint: 'Tight band, a sulk, fewer songs.',
          resolve: (st) => {
            st.flags.muse = st.week;
            const x = mem(st, m.id);
            adjust(x, 'mood', -12); addAffinity(st, x.id, 'p', -6);
            st.tightness = clamp(st.tightness + 4, 0, 100);
            log(st, `${first(x)} chose the band, officially. The songs dried up for a bit. Thursdays are still a sore point.`, 'neutral');
          },
        },
        {
          label: 'Put the muse on the guest list, permanently',
          hint: 'Everybody wins, until they do not.',
          resolve: (st, rng) => {
            st.flags.muse = st.week;
            const x = mem(st, m.id);
            grow(x, 'writing', 2, rng); adjust(x, 'mood', 10); addAffinity(st, x.id, 'p', 8);
            if (rng.chance(0.3)) { for (const y of mates(st)) if (y !== x) addAffinity(st, y.id, x.id, -8); log(st, `The muse is at every rehearsal now, with opinions about the bass. The bass player has opinions about the muse.`, 'bad'); }
            else log(st, `The muse comes to everything, makes the tea and says nothing. The songs keep coming. Nobody minds.`, 'good');
          },
        },
      ];
    },
  },
  {
    id: 'credit_fight',
    weight: 3,
    when: (s) => {
      const hit = [...s.releases].reverse().find((r) => r.kind !== 'demo' && r.sold >= 20000 && s.week - r.week <= 10);
      if (!hit || !since(s, 'creditFight', 40)) return null;
      const song = s.songs.find((x) => x.title === hit.title);
      const writer = song ? s.members.find((m) => m.id === song.writer) : undefined;
      const other = mates(s).find((m) => m !== writer);
      return writer && other ? { title: hit.title, w: writer.id, o: other.id } : null;
    },
    title: (_s, p) => `Who wrote "${p.title}"?`,
    text: (s, p) => `"${p.title}" is a hit and the royalty forms have arrived. ${Who(mem(s, p.w))} wrote it, mostly. ${first(mem(s, p.o))} came up with the riff, or the middle eight, or "the whole feel of it", depending on who is telling the story and how late it is.`,
    options: (s, p) => {
      const w = mem(s, p.w); const o = mem(s, p.o);
      return [
        {
          label: 'Split it equally. Band credit, always',
          hint: 'Less money for the writer, a band that lasts.',
          resolve: (st) => {
            st.flags.creditFight = st.week; st.flags.bandCredit = 1;
            forEachPair(st.members, (a, b) => addAffinity(st, a.id, b.id, 6));
            const x = mem(st, w.id); if (!x.isPlayer) { adjust(x, 'mood', -6); x.hidden.ego >= 60 && revealLog(st, x, 'ego', 1); }
            log(st, `Everything is credited to ${st.bandName} from now on. ${Who(x)} ${x.isPlayer ? 'are' : 'is'} a little poorer and the band is a lot calmer.`, 'good');
          },
        },
        {
          label: `${Who(w)} wrote it. ${Who(w)} get${w.isPlayer ? '' : 's'} it`,
          hint: 'Fair, and remembered by everyone who did not write it.',
          resolve: (st) => {
            st.flags.creditFight = st.week;
            const x = mem(st, w.id); const y = mem(st, o.id);
            adjust(x, 'mood', 6); adjust(y, 'mood', -12); addAffinity(st, x.id, y.id, -15);
            y.hidden.loyalty = clamp(y.hidden.loyalty - 5, 1, 99);
            log(st, `The forms went in with one name on them. ${first(y)} has started a notebook of "ideas" and locks it.`, 'bad');
          },
        },
        {
          label: `Give ${first(o)} a quarter for the riff`,
          hint: 'The grown-up answer. Nobody is thrilled, nobody leaves.',
          resolve: (st) => {
            st.flags.creditFight = st.week;
            const y = mem(st, o.id);
            adjust(y, 'mood', 4); addAffinity(st, w.id, y.id, 3);
            log(st, `A quarter for the riff. ${first(y)} framed the form. The writer framed the cheque.`, 'neutral');
          },
        },
      ];
    },
  },
  {
    id: 'stage_dive',
    weight: 2,
    when: (s) => (s.lastGigWeek === s.week && s.fans >= 1500 && player(s).stage < 85 && since(s, 'stageDive', 40) ? {} : null),
    title: () => 'The edge of the stage',
    text: () => 'The crowd is a sea and the sea is calling. Halfway through the last song, the thought arrives: they will catch you. Probably.',
    options: () => [
      {
        label: 'Jump',
        hint: 'Stage presence up, or a week on crutches.',
        resolve: (st, rng) => {
          st.flags.stageDive = st.week;
          const me = player(st);
          if (rng.chance(0.75)) { grow(me, 'stage', 3, rng); adjust(me, 'mood', 10); addBuzz(st, 5); log(st, 'They caught you. They carried you to the bar and back. You sang the last chorus from the sound desk.', 'good'); }
          else { me.outWeeks = Math.max(me.outWeeks, 1); adjust(me, 'mood', -8); addBuzz(st, 3); log(st, 'They parted like the Red Sea. The floor did not. A week off and a story you will tell for the rest of your life.', 'bad'); }
        },
      },
      {
        label: 'Stay on the stage like a professional',
        hint: 'Nothing happens. That is the point.',
        resolve: (st) => { st.flags.stageDive = st.week; adjust(player(st), 'mood', -2); log(st, 'You looked at the crowd. The crowd looked at you. Somebody shouted "jump". You finished the song.', 'neutral'); },
      },
    ],
  },
];
