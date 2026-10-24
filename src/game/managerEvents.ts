// What the manager brings to the table without being asked: a slot on the telly, a word about the
// weak link and a player who could replace them.
import { clamp } from './rng';
import { generateMusician, overall } from './characters';
import { available } from './chemistry';
import { addBuzz, adjust, first, log, milestone } from './helpers';
import type { EventDef } from './events';

const mgr = (s: { manager: { name: string } | null }) => s.manager?.name.split(' ')[0] ?? 'The manager';

export const MANAGER_EVENTS: EventDef[] = [
  {
    id: 'manager_tv',
    weight: 0,
    when: (s) => (s.manager && s.flags.mgrTv === s.week ? {} : null),
    title: (s) => `${mgr(s)} has got the band on the telly`,
    text: (s) => `${mgr(s)} rang: three minutes on a Saturday-morning pop show, between a cartoon and a cookery slot, this week. Mime to the single, be nice to the presenter, do not swear. "Everyone's mum will be watching. Everyone's mum buys records."`,
    options: (s) => {
      const m = s.manager!;
      return [
        {
          label: 'Do it. Smile. Mime',
          hint: `Fans and buzz, image up, a letter from a vicar. Odds of it going well ${Math.round((0.5 + m.clout / 200) * 100)}%.`,
          resolve: (st, rng) => {
            const ok = rng.chance(0.5 + m.clout / 200);
            if (ok) {
              const gain = Math.round(300 + st.fans * 0.05 + m.clout * 15);
              st.fans += gain; addBuzz(st, 8 + Math.round(m.clout / 10));
              for (const x of available(st)) adjust(x, 'image', 2);
              log(st, `Three minutes of television. The drummer waved at his mum. ${gain.toLocaleString('en-GB')} new fans and a letter from a vicar.`, 'good');
            } else {
              addBuzz(st, 3);
              for (const x of available(st)) adjust(x, 'mood', -4);
              log(st, `The backing tape started in the wrong place and the singer mimed the second verse to the first. The presenter said "lovely" in a voice. ${mgr(st)} says it does not matter. ${mgr(st)} is lying.`, 'bad');
            }
          },
        },
        {
          label: 'Only if we play live',
          hint: 'The producers hate it. If the band is tight, it is a legend; if not, it is a clip they show for years.',
          resolve: (st, rng) => {
            const good = st.tightness >= 60 && rng.chance(0.7);
            if (good) { const gain = Math.round(600 + st.fans * 0.08); st.fans += gain; addBuzz(st, 16); for (const x of available(st)) { adjust(x, 'mood', 8); adjust(x, 'image', 2); } log(st, `Live, loud, three minutes, a snapped string and a grin. The switchboard lit up. ${gain.toLocaleString('en-GB')} fans by Monday and a producer who will never book you again.`, 'good'); }
            else { addBuzz(st, 2); for (const x of available(st)) adjust(x, 'mood', -6); log(st, 'Live, out of tune, and the sound man had never seen a guitar. The clip is in a drawer at the television company marked "Christmas".', 'bad'); }
          },
        },
        { label: 'No. We are not a pop group', hint: `Dignity. ${mgr(s)} sulks. The purists in the band approve.`, resolve: (st) => { for (const x of available(st)) if (x.style === 'punk' || x.style === 'metal') adjust(x, 'mood', 5); log(st, `${mgr(st)} put the phone down very gently, which is worse than slamming it.`, 'neutral'); } },
      ];
    },
  },
  {
    id: 'manager_tip',
    weight: 0,
    when: (s) => (s.manager && s.flags.mgrTip === s.week && s.members.some((m) => m.id === s.pending?.params.m) ? { m: s.pending!.params.m, rival: s.pending!.params.rival } : null),
    title: (s, p) => `${mgr(s)} wants a word about ${first(s.members.find((m) => m.id === p.m)!)}`,
    text: (s, p) => {
      const w = s.members.find((m) => m.id === p.m)!;
      return `${mgr(s)}, quietly, in the car park: "${first(w)} is the weak link. Everyone knows it. I know a ${w.role === 'drums' ? 'drummer' : `${w.role} player`} who just left ${p.rival}, better than ${first(w)} on a bad night, and I can have them in the rehearsal room on Tuesday. Say the word. Or do not, and I never said this."`;
    },
    options: (s, p) => {
      const w = s.members.find((m) => m.id === p.m)!;
      return [
        {
          label: 'Bring them in. Audition on Tuesday',
          hint: `A candidate appears. ${first(w)} will know what it means.`,
          resolve: (st, rng) => {
            const boost = Math.round(clamp(5 * Math.log10(Math.max(1, st.fans) / 100), 0, 22)) + 8 + Math.round((st.manager?.clout ?? 30) / 10);
            let c = generateMusician(rng, `m${st.nextId++}`, w.role, 'good', st.members[0].style, st.members.flatMap((m) => [m.name, m.realName]), boost, st.bandGender && st.bandGender !== 'mixed' ? st.bandGender : undefined, st.fans);
            for (let i = 0; i < 6 && overall(c) < overall(w) + 6; i++) c = generateMusician(rng, `m${st.nextId++}`, w.role, 'good', st.members[0].style, st.members.flatMap((m) => [m.name, m.realName]), boost + 2, st.bandGender && st.bandGender !== 'mixed' ? st.bandGender : undefined, st.fans);
            c.seen = 45;
            st.candidates = [c];
            st.candidateRole = w.role;
            const x = st.members.find((m) => m.id === w.id);
            if (x) { adjust(x, 'mood', -8); x.hidden.loyalty = clamp(x.hidden.loyalty - 5, 1, 99); }
            log(st, `${c.name} is coming on Tuesday. ${first(w)} found out from the roadie and has not said anything, loudly.`, 'neutral');
          },
        },
        {
          label: `${first(w)} stays. Loyalty counts`,
          hint: `${first(w)} never hears about it. ${mgr(s)} shrugs.`,
          resolve: (st) => {
            const x = st.members.find((m) => m.id === w.id);
            if (x) { x.hidden.loyalty = clamp(x.hidden.loyalty + 6, 1, 99); }
            log(st, `You said no. ${mgr(st)} said "your funeral" and booked a rehearsal room anyway, for something else, apparently.`, 'neutral');
          },
        },
        {
          label: 'Tell the band what was said',
          hint: 'Honesty. The band closes ranks; the manager is a little less trusted, and so is the weak link.',
          resolve: (st) => {
            for (const x of available(st)) { adjust(x, 'mood', 3); if (x.id === w.id) adjust(x, 'mood', -6); }
            milestone(st, 'drama', `${st.manager?.name} tried to replace ${w.name} behind the band's back.`);
            log(st, `You told the band in the van. Silence, then the drummer laughed, then everyone did, then ${first(w)} did not. ${mgr(st)} will be careful in car parks from now on.`, 'neutral');
          },
        },
      ];
    },
  },
];
