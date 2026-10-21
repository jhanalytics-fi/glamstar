// Somebody, somewhere, playing better than your lot. The better your lot, the rarer it is.
import { clamp } from './rng';
import { generateMusician, overall, ROLE_LABEL } from './characters';
import { addAffinity } from './chemistry';
import { addBuzz, adjust, first, log } from './helpers';
import type { EventDef } from './events';
import type { GameState, Role } from './types';

const since = (s: GameState, flag: string, weeks: number) => s.flags[flag] === undefined || s.week - s.flags[flag] >= weeks;
const ROLES: Role[] = ['guitar', 'bass', 'drums', 'keys'];

export const SPOTTED_EVENTS: EventDef[] = [
  {
    id: 'spotted',
    weight: 3,
    where: 'home',
    when: (s, rng) => {
      if (s.candidates.length || s.members.length >= 6 && !s.members.some((m) => !m.isPlayer) || !since(s, 'spotted', 16)) return null;
      const role = rng.pick(ROLES);
      const current = s.members.find((m) => m.role === role && !m.isPlayer);
      const bar = current ? overall(current) + 6 : 40;
      // Word of mouth scales with fame; so does the bar. Six tries, then nobody worth the trouble this time.
      const boost = Math.round(clamp(5 * Math.log10(Math.max(1, s.fans) / 100), 0, 22)) + 10;
      for (let i = 0; i < 6; i++) {
        const c = generateMusician(rng, 'probe', role, 'good', s.members[0].style, s.members.flatMap((m) => [m.name, m.realName]), boost, s.bandGender && s.bandGender !== 'mixed' ? s.bandGender : undefined, s.fans);
        if (overall(c) >= bar) return { role, seed: rng.int(1, 1e9), where: rng.pick(['a jam night in Camden', 'the support band at your own gig', 'a wedding you were playing', 'a session you were not supposed to hear', 'a busking pitch at Tottenham Court Road', 'the house band at a hotel bar in Soho', 'a rival band whose singer has just quit']) };
      }
      return null;
    },
    title: (_s, p) => `You saw ${ROLE_LABEL[p.role as Role].toLowerCase() === 'keys' ? 'a keyboard player' : `a ${ROLE_LABEL[p.role as Role].toLowerCase()} player`} who made the room go quiet`,
    text: (s, p) => {
      const role = p.role as Role;
      const current = s.members.find((m) => m.role === role && !m.isPlayer);
      return `At ${p.where}, somebody played ${role === 'keys' ? 'keyboards' : role} the way you have only heard on records. Everyone in the band noticed. ${current ? `${first(current)} noticed most of all and has gone very quiet.` : 'The chair is empty, and they know it.'}`;
    },
    options: (s, p) => {
      const role = p.role as Role;
      const current = s.members.find((m) => m.role === role && !m.isPlayer);
      return [
        {
          label: 'Get their number. Audition them',
          hint: `They come to the rehearsal room next week. ${current ? `${first(current)} will know what it means.` : 'Free chair.'}`,
          resolve: (st, rng) => {
            st.flags.spotted = st.week;
            const boost = Math.round(clamp(5 * Math.log10(Math.max(1, st.fans) / 100), 0, 22)) + 10;
            const bar = current ? overall(current) + 6 : 40;
            let c = generateMusician(rng, `m${st.nextId++}`, role, 'good', st.members[0].style, st.members.flatMap((m) => [m.name, m.realName]), boost, st.bandGender && st.bandGender !== 'mixed' ? st.bandGender : undefined, st.fans);
            for (let i = 0; i < 8 && overall(c) < bar; i++) c = generateMusician(rng, `m${st.nextId++}`, role, 'good', st.members[0].style, st.members.flatMap((m) => [m.name, m.realName]), boost + 2, st.bandGender && st.bandGender !== 'mixed' ? st.bandGender : undefined, st.fans);
            c.seen = 50;
            st.candidates = [c];
            st.candidateRole = role;
            if (current) { adjust(current, 'mood', -8); }
            log(st, `${c.name} is coming to the rehearsal room on Tuesday. ${current ? `${first(current)} has offered to "sit in", which is not how auditions work.` : 'Bring tea.'}`, 'neutral');
          },
        },
        {
          label: 'Buy them a drink and leave it',
          hint: 'A compliment, a card, nothing more. The band breathes out.',
          resolve: (st, rng) => {
            st.flags.spotted = st.week;
            addBuzz(st, 1);
            // If it gets back to the band that you turned down someone better, that counts for something.
            if (current && rng.chance(0.6)) {
              const x = st.members.find((m) => m.id === current.id)!;
              adjust(x, 'mood', 6); x.hidden.loyalty = clamp(x.hidden.loyalty + 4, 1, 99); addAffinity(st, x.id, 'p', 5);
              log(st, `You bought them a drink and said so. By Thursday ${first(x)} had heard, from three people, that you had been offered a better ${role === 'keys' ? 'keyboard player' : `${role} player`} and said no. ${first(x)} has not mentioned it. ${first(x)} has been early to every rehearsal since.`, 'good');
            } else {
              log(st, `You bought them a drink and said so. They said they had all your records. ${current ? `${first(current)} bought the next round, quickly.` : 'A card went in a pocket and stayed there.'}`, 'neutral');
            }
          },
        },
      ];
    },
  },
];
