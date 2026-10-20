// The dep who has been there often enough to have a seat on the bus.
import { clamp } from './rng';
import { generateMusician, seenRange } from './characters';
import { addAffinity, available } from './chemistry';
import { adjust, first, log, milestone, removeMember } from './helpers';
import { closeSub } from './subs';
const MAX_MEMBERS = 6;

/** How the dep measures up against the member whose chair it is, as far as you can tell. */
export function depVersus(depName: string, depSkill: number, owner: Musician | undefined): string {
  const dep = depName.split(' ')[0];
  if (!owner) return `On the night ${dep} plays at about ${depSkill}. Nobody else in the band plays the part at all.`;
  const [lo, hi] = seenRange(owner, owner.skill);
  const you = lo === hi ? `${lo}` : `${lo} to ${hi}`;
  const verdict = depSkill > hi ? `${dep} is the better player, no question.` : depSkill >= lo ? 'Too close to call from the side of the stage.' : `${first(owner)} is the better player.`;
  return `On the night ${dep} plays at about ${depSkill}; ${first(owner)} at ${you}. ${verdict} ${dep} writes nothing you have heard and has no stage act to speak of; ${first(owner)} has ${owner.writing >= 45 ? 'songs' : 'no songs either'} and ${owner.stage >= 55 ? 'a show' : 'no show either'}.`;
}
import type { EventDef } from './events';
import type { Musician } from './types';

export const SUB_EVENTS: EventDef[] = [
  {
    id: 'dep_wants_in',
    weight: 5,
    where: 'home',
    when: (s) => {
      const sub = closeSub(s);
      return sub ? { role: sub.role, name: sub.name } : null;
    },
    title: (_s, p) => `${String(p.name).split(' ')[0]} wants in`,
    text: (s, p) => {
      const sub = s.subs?.[p.role as 'guitar'];
      const owner = s.members.find((m) => m.role === p.role && !m.isPlayer);
      return `${p.name} has depped on ${p.role} ${sub?.times ?? 4} times now, knows the set backwards and has started turning up to rehearsals nobody asked them to. ${owner ? `${first(owner)} has noticed.` : ''} They would like to know if there is a seat on the bus.${sub ? ` ${depVersus(sub.name, sub.skill, owner)}` : ''}`;
    },
    options: (s, p) => {
      const role = p.role as 'guitar' | 'bass' | 'drums' | 'keys';
      const owner = s.members.find((m) => m.role === role && !m.isPlayer);
      const room = s.members.length < MAX_MEMBERS;
      return [
        {
          label: room ? 'Make them a full member' : 'No room in the van',
          hint: room ? `A ${role} player who already knows the songs. ${owner ? `${first(owner)} will have to share.` : ''}` : 'Six is the limit. Sack someone first.',
          locked: room ? undefined : 'The van only fits six.',
          resolve: (st, rng) => {
            const sub = st.subs![role]!;
            sub.offered = true;
            const m = generateMusician(rng, `m${st.nextId++}`, role, 'average', st.members[0].style, st.members.flatMap((x) => [x.name, x.realName]), 0);
            m.name = sub.name.split(' ').slice(0, 1).concat(m.realName.split(' ').slice(1)).join(' ');
            m.realName = m.name;
            m.skill = clamp(sub.skill + 4, 1, 99);
            m.joined = st.week;
            m.seen = 60;
            st.members.push(m);
            for (const o of available(st)) if (o.id !== m.id) addAffinity(st, o.id, m.id, 15);
            if (owner) { const x = st.members.find((y) => y.id === owner.id); if (x) { adjust(x, 'mood', -6); addAffinity(st, x.id, m.id, -5); } }
            delete st.subs![role];
            milestone(st, 'lineup', `${m.name} joined, after ${sub.times} nights as a dep.`);
            log(st, `${m.name} is in. Already knows the set, already knows the jokes, already has a nickname nobody will explain.`, 'good');
          },
        },
        ...(owner && !owner.isPlayer ? [{
          label: `Swap them in for ${first(owner)}`,
          hint: `${first(owner)} goes, the dep takes the chair. The band will mind, more if they liked ${first(owner)}.`,
          resolve: (st: typeof s, rng: Parameters<typeof generateMusician>[0]) => {
            const sub = st.subs![role]!;
            sub.offered = true;
            const old = st.members.find((y) => y.id === owner.id)!;
            const liked = old.mood >= 60 ? 2 : 1;
            removeMember(st, old.id, 'fired');
            const m = generateMusician(rng, `m${st.nextId++}`, role, 'average', st.members[0].style, st.members.flatMap((x) => [x.name, x.realName]), 0);
            m.name = sub.name.split(' ').slice(0, 1).concat(m.realName.split(' ').slice(1)).join(' ');
            m.realName = m.name;
            m.skill = clamp(sub.skill + 4, 1, 99);
            m.joined = st.week;
            m.seen = 60;
            st.members.push(m);
            for (const o of available(st)) if (o.id !== m.id) { addAffinity(st, o.id, m.id, 8); adjust(o, 'mood', -4 * liked); }
            delete st.subs![role];
            milestone(st, 'lineup', `${m.name} replaced ${old.name}, after ${sub.times} nights as a dep.`);
            log(st, `${old.name} was told in the car park. ${m.name} was told in the pub. The set sounds the same on Friday, which is the point, and the problem.`, 'neutral');
          },
        }] : []),
        {
          label: 'Keep them on call',
          hint: 'The best dep in London stays a phone number.',
          resolve: (st) => { st.subs![role]!.offered = true; log(st, `${p.name} took it well, and will keep answering the phone. Probably.`, 'neutral'); },
        },
      ];
    },
  },
];
