// Records the band did not make: compilations from the label, bootlegs from the car boot.
import { clamp } from './rng';
import { available } from './chemistry';
import { addBuzz, adjust, first, log, milestone, player } from './helpers';
import { labelById, royaltyPerCopy } from './labels';
import { PRESS, VENUES } from './names';
import { catalogueQuality, labelsWithAlbums, pressRecord } from './catalogue';
import type { EventDef } from './events';
import type { GameState } from './types';

const since = (s: GameState, flag: string, weeks: number) => s.flags[flag] === undefined || s.week - s.flags[flag] >= weeks;
const year = (s: GameState) => 1982 + Math.floor(s.week / 52);

export const CATALOGUE_EVENTS: EventDef[] = [
  {
    id: 'label_compilation',
    weight: 4,
    where: 'home',
    when: (s, rng) => {
      if (s.fans < 3000 || !since(s, 'compilation', 104)) return null;
      // A year since the last studio album, or the Christmas run-up and a label that wants something in the shops.
      const last = [...s.releases].reverse().find((r) => r.kind === 'album' && !r.comp);
      const xmas = s.week % 52 >= 40 && s.week % 52 <= 46;
      if (!last || (s.week - last.week < 52 && !(xmas && s.week - last.week >= 10))) return null;
      const labels = labelsWithAlbums(s);
      if (!labels.length) return null;
      const label = s.contract && labels.includes(s.contract.label) ? s.contract.label : rng.pick(labels);
      const title = rng.pick([`The Best of ${s.bandName}`, `${s.bandName}: The Singles ${1982 + Math.floor(s.releases[0].week / 52)}-${year(s)}`, `${s.bandName}: Hits, Misses and B-sides`, `${s.bandName}: Greatest Hits`]);
      return { label, title, own: s.contract?.label === label ? 1 : 0 };
    },
    title: (_s, p) => `"${p.title}" is coming out`,
    text: (_s, p) => {
      const l = labelById(String(p.label));
      return p.own
        ? `${l.name} have noticed it has been a year since the last album and would like something in the shops for Christmas. "${p.title}": every single, two B-sides, a sleeve the art department had lying about. Nobody asked you. The contract says they do not have to.`
        : `${l.name}, who you no longer record for, still own the records you made for them and would like to sell them again. "${p.title}" is at the pressing plant. You get a copy and, per the small print, nothing else.`;
    },
    options: (s, p) => {
      const lid = String(p.label);
      const l = labelById(lid);
      const fresh = s.songs.filter((x) => !x.released).sort((a, b) => b.quality - a.quality)[0];
      const press = (st: GameState, bonus: number, appeal: number) => {
        const c = st.contract && st.contract.label === lid ? st.contract : null;
        const rec = pressRecord(st, 'album', String(p.title), catalogueQuality(st) + bonus, appeal, { comp: 'hits', label: lid, royalty: c ? royaltyPerCopy(c.terms, 'album', st.flags.producerPoints ?? 0) : 0 });
        milestone(st, 'release', `${l.name} put out "${p.title}", a compilation.`);
        return rec;
      };
      return [
        {
          label: p.own ? 'Let them. Royalties are royalties' : 'Let them. There is nothing to be done',
          hint: p.own ? 'A record in the shops, a few new fans, nothing new on it.' : 'They keep every penny. You keep your dignity, mostly.',
          resolve: (st) => {
            st.flags.compilation = st.week;
            press(st, 2, 0.8);
            addBuzz(st, 6);
            for (const m of st.members) adjust(m, 'mood', -2);
            log(st, p.own ? `"${p.title}" is out. ${PRESS} called it "a stopgap", which is what it is. The band found out from a poster.` : `"${p.title}" is in the shops with a sticker saying "INCLUDES THE HITS". ${l.name} are very pleased. You are not on the royalty statement.`, 'neutral');
          },
        },
        {
          label: fresh ? `Give them "${fresh.title}" so it is worth buying` : 'Give them a new song',
          hint: fresh ? 'One new track. Fans buy it twice. Sells properly.' : 'You have nothing unreleased.',
          locked: fresh ? undefined : 'No unreleased songs to give.',
          resolve: (st) => {
            st.flags.compilation = st.week;
            const song = st.songs.find((x) => x.title === fresh!.title && !x.released)!;
            song.released = true;
            const rec = press(st, 5, 1.1);
            if (!p.own) rec.royalty = 0.3;
            addBuzz(st, 10);
            const w = st.members.find((m) => m.id === song.writer);
            if (w) adjust(w, 'mood', 6);
            log(st, `"${p.title}" now has one new song on it, "${song.title}", and a sticker saying so. Every fan who has everything has to buy it again. ${p.own ? l.name : `${l.name}, grudgingly,`} paid for it.`, 'good');
          },
        },
        {
          label: 'Lawyers. Stop it',
          hint: p.own ? 'Half the time it works. The label remembers either way.' : 'An old contract, a long shot, a bill.',
          cost: 1000,
          resolve: (st, rng) => {
            st.flags.compilation = st.week;
            const c = st.contract && st.contract.label === lid ? st.contract : null;
            if (c) c.goodwill = clamp(c.goodwill - 15, 0, 100);
            if (rng.chance(p.own ? 0.5 : 0.3)) {
              adjust(player(st), 'mood', 4);
              log(st, `The lawyers found a comma in the contract that ${l.name} did not like. "${p.title}" is shelved. Somebody at the label has written your name on a list.`, 'good');
            } else {
              press(st, 0, 0.75);
              addBuzz(st, 4);
              log(st, `The lawyers read the contract, took the money and said "no". "${p.title}" came out on schedule with a worse sleeve, out of spite.`, 'bad');
            }
          },
        },
      ];
    },
  },
  {
    id: 'bootleg_lp',
    weight: 3,
    where: 'home',
    when: (s, rng) => {
      if (s.fans < 5000 || s.lastGigWeek === null || s.week - s.lastGigWeek > 8 || !since(s, 'bootlegLp', 60) || !s.songs.some((x) => x.released)) return null;
      const venue = rng.pick(VENUES.filter((v) => v.minFans <= s.fans).slice(-3)).name;
      return { venue, title: rng.pick([`Live at ${venue}`, `${s.bandName}: Bootleg ${year(s)}`, `Drunk at ${venue}`, `${s.bandName} Unplugged (By the Fire Brigade)`]) };
    },
    title: (_s, p) => `"${p.title}" is on every market stall`,
    text: (_s, p) => `Somebody taped the ${p.venue} show off the mixing desk and has pressed it up. "${p.title}": a plain sleeve, a photocopied insert, the bass too loud and the drummer counting in. It is selling faster than your last single.`,
    options: (s, p) => {
      const live = catalogueQuality(s) * 0.85 + available(s).reduce((a, m) => a + m.stage, 0) / Math.max(1, available(s).length) * 0.15;
      return [
        {
          label: 'Let it go. A bootleg is a compliment',
          hint: 'Not a penny, but the buzz is real.',
          resolve: (st) => {
            st.flags.bootlegLp = st.week;
            pressRecord(st, 'album', String(p.title), live, 0.5, { comp: 'bootleg' });
            addBuzz(st, 6); adjust(player(st), 'image', 1);
            log(st, `"${p.title}" sells by the boxful from the back of a van in Camden. The band has a copy each. ${first(available(st)[0])} listens to the bass with a look of pain.`, 'neutral');
          },
        },
        {
          label: 'Set the lawyers on the stalls',
          hint: 'Boxes seized, fans annoyed, bootleggers mildly inconvenienced.',
          cost: 500,
          resolve: (st, rng) => {
            st.flags.bootlegLp = st.week;
            if (rng.chance(0.6)) { addBuzz(st, -3); log(st, `Two hundred copies seized from a stall in Camden. The bootlegger pressed four hundred more in Hull. ${PRESS}: "${st.bandName} send lawyers after their own fans".`, 'bad'); }
            else { addBuzz(st, -1); log(st, 'The lawyers wrote some letters. The stalls moved to a different market. Everyone involved feels silly.', 'neutral'); }
          },
        },
        {
          label: 'Beat them to it: the official live album',
          hint: s.contract ? `${labelById(s.contract.label).name} will put it out. Proper mix, proper sleeve, proper royalties.` : '£2,000 for a mix and a pressing, on your own label.',
          locked: !s.contract && s.money < 2000 ? `Costs £2,000. You have £${s.money.toLocaleString('en-GB')}.` : undefined,
          resolve: (st, rng) => {
            st.flags.bootlegLp = st.week;
            const title = `${st.bandName} Live at ${p.venue}`;
            if (st.contract) {
              const c = st.contract;
              pressRecord(st, 'album', title, live + 8 + rng.int(-3, 3), 0.9, { comp: 'live', label: c.label, royalty: royaltyPerCopy(c.terms, 'album', st.flags.producerPoints ?? 0) });
              c.unrecouped += 3000;
            } else {
              st.money -= 2000;
              pressRecord(st, 'album', title, live + 6 + rng.int(-3, 3), 0.85, { comp: 'live' });
            }
            addBuzz(st, 9);
            for (const m of available(st)) adjust(m, 'mood', 5);
            milestone(st, 'release', `Released "${title}", the live album.`);
            log(st, `"${title}" is out within the month, mixed properly, the drummer's count-in left in "for authenticity". The bootleg sells for a fiver outside the shop that sells yours for six.`, 'good');
          },
        },
      ];
    },
  },
];
