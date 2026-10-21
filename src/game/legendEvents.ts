// The stories every rock biography has: the hitch-hike to a gig abroad, being enormous in a country
// that is not yours, the famous friend who should not have been driving, the band that falls apart after
// the funeral, and the day a bigger band says you were the reason.
import { clamp } from './rng';
import { addAffinity, available } from './chemistry';
import { addBuzz, adjust, first, log, milestone, player, removeMember } from './helpers';
import { pickRivalName } from './world';
import { die } from './death';
import type { EventDef } from './events';
import type { GameState } from './types';

const mates = (s: GameState) => s.members.filter((m) => !m.isPlayer && m.outWeeks === 0);
const since = (s: GameState, flag: string, weeks: number) => s.flags[flag] === undefined || s.week - s.flags[flag] >= weeks;

export const LEGEND_EVENTS: EventDef[] = [
  {
    // Three days on the road with a bass in a bin bag, for one gig in a city that has never heard of you.
    id: 'hitch_abroad',
    weight: 2,
    where: 'home',
    when: (s, rng) => (s.fans >= 60 && s.fans < 1500 && s.money < 400 && since(s, 'hitchAbroad', 60) ? { city: rng.pick(['Stockholm', 'Hamburg', 'Amsterdam', 'Copenhagen', 'Gothenburg', 'Berlin']) } : null),
    title: (_s, p) => `A gig in ${p.city}, if you can get there`,
    text: (_s, p) => `A letter from a squat in ${p.city}: a promoter who saw the band on a bad night wants you for a festival in a car park. No fee, floor space, "beer provided". The ferry is £12 each. After that it is thumbs, lorries and luck.`,
    options: (_s, p) => [
      {
        label: 'Hitch it. Guitars in bin bags',
        hint: 'Three days each way. Energy gone, a story for life, and a city that remembers you.',
        resolve: (st, rng) => {
          st.flags.hitchAbroad = st.week;
          st.money -= 12 * st.members.length;
          for (const m of available(st)) { adjust(m, 'energy', -30); adjust(m, 'mood', rng.int(-4, 10)); }
          for (const a of available(st)) for (const b of available(st)) if (a.id < b.id) addAffinity(st, a.id, b.id, 6);
          const stranded = rng.chance(0.25);
          const gain = rng.int(40, 140);
          st.fans += gain;
          addBuzz(st, 6);
          if (stranded) { const slow = rng.pick(mates(st)); if (slow) { slow.outWeeks = Math.max(slow.outWeeks, 1); log(st, `${first(slow)} got into the wrong lorry outside Hamburg and arrived a week after everyone else, from the other direction.`, 'neutral'); } }
          milestone(st, 'career', `Hitch-hiked to ${p.city} for one gig.`);
          log(st, `Three days of lorries, a bass in a bin bag, a night in a bus shelter outside ${p.city}. The car park was full. ${gain} people in a city you had never seen now own a badge. ${rng.pick(['A girl in a leather jacket drew the band on a wall. It is still there.', 'A boy with a tape recorder stood at the front. He is in a band now.', 'The promoter paid in beer and a photograph. The photograph is on the sleeve of the first album.'])}`, 'good');
        },
      },
      { label: 'Write back: "next time, with a van"', hint: 'Sensible. The bin bags stay in the kitchen.', resolve: (st) => { st.flags.hitchAbroad = st.week; log(st, 'You wrote back. The promoter booked somebody else, who went on to sell four million records in that country. Probably not related.', 'neutral'); } },
    ],
  },
  {
    // Enormous somewhere that is not home: the letters, the imports, the airport full of fans.
    id: 'big_abroad',
    weight: 3,
    where: 'home',
    when: (s, rng) => (s.fans >= 1500 && s.fans < 60000 && s.releases.some((r) => r.kind !== 'demo') && s.flags.bigAbroad === undefined ? { where: rng.pick(['Japan', 'Finland', 'Italy', 'Brazil', 'Greece', 'Argentina']) } : null),
    title: (_s, p) => `You are enormous in ${p.where}`,
    text: (s, p) => `A sack of letters from ${p.where}, in a language nobody in the band reads, with photographs of bedrooms wallpapered in ${s.bandName}. An import shop there has sold more of your record than the whole of the north of England. A magazine wants a cover. Nobody can explain it, least of all ${p.where}.`,
    options: (_s, p) => [
      {
        label: 'Fly out and find out',
        hint: 'Two weeks there: a riot at the airport, a cover, fans for life. The home crowd notices the gap.',
        cost: 90,
        resolve: (st, rng) => {
          st.flags.bigAbroad = st.week;
          const gain = Math.round(st.fans * 0.35 + 500);
          st.fans += gain;
          st.flags.reachBonus = Math.round(((st.flags.reachBonus ?? 0) + 0.4) * 100) / 100;
          addBuzz(st, 14);
          for (const m of available(st)) { adjust(m, 'mood', 12); adjust(m, 'energy', -25); adjust(m, 'image', 2); }
          for (const m of available(st)) m.outWeeks = Math.max(m.outWeeks, 1);
          milestone(st, 'career', `Enormous in ${p.where}: ${gain.toLocaleString('en-GB')} fans nobody knew about.`);
          log(st, `${p.where}. Fans at the airport with banners, a television crew at the hotel, a cover shot in a car park, a crowd that sang the B-sides. ${rng.pick(['The drummer was proposed to twice.', 'The bass player bought a kimono and will not take it off.', 'The singer was given a ceremonial sword and a cat.'])} ${gain.toLocaleString('en-GB')} fans who were there all along.`, 'good');
        },
      },
      { label: 'Send a signed photo and a thank-you', hint: 'Cheap, polite, and a market left to the import shop.', resolve: (st, rng) => { st.flags.bigAbroad = st.week; st.fans += rng.int(100, 400); addBuzz(st, 3); log(st, `You signed two hundred photographs at the kitchen table. ${p.where} wrote back. ${p.where} always writes back.`, 'neutral'); } },
    ],
  },
  {
    // A famous friend, a fast car, an off-licence run. Everybody knows this one.
    id: 'famous_friend_drives',
    weight: 2,
    big: true,
    when: (s, rng) => {
      const m = rng.pick(mates(s).filter((x) => x.habit >= 20));
      return m && s.fans >= 15000 && since(s, 'famousFriend', 80) && (s.tour || s.flags.lastBigParty === s.week - 1 || s.flags.lastBigParty === s.week) ? { m: m.id, star: pickRivalName(s.world, rng) } : null;
    },
    title: (s, p) => `${p.star}'s singer wants to drive ${first(s.members.find((m) => m.id === p.m)!)} to the off-licence`,
    text: (s, p) => `Three in the morning, the party is out of everything, and the singer from ${p.star} has a car outside with the keys in it and a glass in his hand. "Two minutes. I drive this road every night." ${first(s.members.find((m) => m.id === p.m)!)} is already putting on a jacket.`,
    options: (s, p) => {
      const who = s.members.find((m) => m.id === p.m)!;
      return [
        {
          label: 'Let them go. It is two minutes',
          hint: 'Most nights nothing happens. Most nights.',
          resolve: (st, rng) => {
            st.flags.famousFriend = st.week;
            const x = st.members.find((m) => m.id === p.m);
            if (!x) return;
            const r = rng.next();
            if (r < 0.1) {
              die(st, rng, x.id, 'road');
              st.flags.famousCrash = st.week;
              log(st, `The singer from ${p.star} walked away from the car. He is charged in the morning, famous for it by the weekend, and will pay for the rest of his life in every interview. It does not help.`, 'bad');
            } else if (r < 0.4) {
              x.outWeeks = Math.max(x.outWeeks, 4); adjust(x, 'mood', -15);
              st.money += 20000; addBuzz(st, 8);
              log(st, `The car met a wall at sixty. ${first(x)} broke an arm and a collarbone; the singer from ${p.star} broke a headline. His label sent £20,000 and a lawyer with it. Four weeks in plaster.`, 'bad');
            } else {
              adjust(x, 'habit', 4);
              log(st, `They came back with four bottles and a story about a policeman who wanted an autograph. ${first(x)} tells it for a year. The car is not mentioned.`, 'neutral');
            }
          },
        },
        {
          label: `Take the keys. ${first(who)} stays`,
          hint: 'A famous friend sulks. A bass player lives.',
          resolve: (st) => {
            st.flags.famousFriend = st.week;
            const x = st.members.find((m) => m.id === p.m);
            if (x) { adjust(x, 'mood', -4); x.hidden.loyalty = clamp(x.hidden.loyalty + 4, 1, 99); }
            log(st, `You took the keys and threw them in the pool. The singer from ${p.star} called you a word and fell asleep on the stairs. ${first(who)} was annoyed until about 1991.`, 'good');
          },
        },
        {
          label: 'Go with them, and drive yourself',
          hint: 'You have had less. Not nothing.',
          resolve: (st, rng) => {
            st.flags.famousFriend = st.week;
            const me = player(st);
            if (rng.chance(0.12)) { st.money -= 800; adjust(me, 'mood', -10); addBuzz(st, 4); log(st, `You clipped a parked car on the way back. The police were polite until they saw who was in the passenger seat. £800, a caution, and a photograph in Monday's paper of the three of you on the kerb.`, 'bad'); }
            else log(st, 'You drove, slowly, with the famous passenger singing out of the window. Nothing happened. That is the whole story, and it is a better one than the other.', 'neutral');
          },
        },
      ];
    },
  },
  {
    // The replacement is not them. The singer has gone quiet. Three months after the funeral the band is a ghost of one.
    id: 'falling_apart',
    weight: 6,
    where: 'home',
    when: (s) => {
      const r = (s.memorials ?? [])[(s.memorials ?? []).length - 1];
      const leaver = [...mates(s)].sort((a, b) => a.hidden.loyalty - b.hidden.loyalty)[0];
      return r && s.week - r.week >= 8 && s.week - r.week <= 30 && !s.flags[`apart_${r.week}`] && leaver ? { lost: r.name, m: leaver.id, w: r.week } : null;
    },
    title: (s, p) => `${first(s.members.find((m) => m.id === p.m)!)} does not want to do this any more`,
    text: (s, p) => {
      const who = s.members.find((m) => m.id === p.m)!;
      const newbie = s.members.find((m) => m.joined !== undefined && m.joined > Number(p.w) && !m.isPlayer);
      return `Three months since ${p.lost}. ${newbie ? `${first(newbie)} plays the parts and it is not the same, and everybody is too polite to say so. ` : ''}${first(who)} has stopped coming to the pub after rehearsal. Tonight ${first(who)} said it: "It was ${String(p.lost).split(' ')[0]}'s band too. Without that it is just a job. I do not want the job."`;
    },
    options: (s, p) => {
      const who = s.members.find((m) => m.id === p.m)!;
      return [
        {
          label: 'Let them go. You cannot argue with grief',
          hint: `${first(who)} leaves with your blessing. The band gets smaller and, oddly, closer.`,
          resolve: (st) => {
            st.flags[`apart_${p.w}`] = 1;
            removeMember(st, who.id, 'quit');
            for (const m of st.members) { adjust(m, 'mood', -6); m.hidden.loyalty = clamp(m.hidden.loyalty + 4, 1, 99); }
            log(st, `${who.name} left with a handshake and ${String(p.lost).split(' ')[0]}'s old jacket. The ones who stayed stayed harder.`, 'neutral');
          },
        },
        {
          label: 'One record for them. Then decide',
          hint: 'A promise: the next album is a tribute. It had better be.',
          resolve: (st) => {
            st.flags[`apart_${p.w}`] = 1;
            st.flags.oneMoreAlbum = st.week;
            adjust(who, 'mood', 8); who.hidden.loyalty = clamp(who.hidden.loyalty + 10, 1, 99);
            for (const m of st.members) adjust(m, 'mood', 4);
            log(st, `${first(who)} agreed to one more record, for ${String(p.lost).split(' ')[0]}. The sleeve is already decided: a photograph from the van, the one where everyone is laughing.`, 'good');
          },
        },
        {
          label: 'Rename the band and start again',
          hint: 'A new name, a clean sheet, half the fans. The press calls it brave, then calls it a mistake.',
          resolve: (st, rng) => {
            st.flags[`apart_${p.w}`] = 1;
            st.flags.renamedAfterLoss = st.week;
            st.fans = Math.round(st.fans * 0.5);
            addBuzz(st, 10);
            for (const m of st.members) { adjust(m, 'mood', 10); m.hidden.loyalty = clamp(m.hidden.loyalty + 8, 1, 99); }
            log(st, `A new name, chosen at ${rng.pick(['the funeral tea', 'a service station', 'four in the morning'])}. Half the fans came with it. The other half are waiting to see. Change it on the band card when you are ready.`, 'neutral');
          },
        },
      ];
    },
  },
  {
    // The biggest band in the world says it was you. Nobody bought the records, and now everybody does.
    id: 'torchbearers',
    weight: 2,
    when: (s, rng) => (s.week >= 200 && s.fans >= 8000 && s.releases.filter((r) => r.kind === 'album').length >= 2 && s.flags.torch === undefined ? { band: pickRivalName(s.world, rng), city: rng.pick(['Los Angeles', 'Seattle', 'Tokyo', 'Gothenburg', 'Dublin']) } : null),
    title: (_s, p) => `${p.band} say it was you`,
    text: (s, p) => `${p.band}, from ${p.city}, are the biggest band in the world this year. In every interview they say the same thing: the record that started it was ${s.bandName}'s first album, bought from an import bin for a dollar. Their singer wears your T-shirt on television. The import bins are empty by Friday.`,
    options: (_s, p) => [
      {
        label: 'Take the credit. Reissue everything',
        hint: 'The old records sell like new ones for a season. The press rewrites the story with you in it.',
        resolve: (st) => {
          st.flags.torch = st.week;
          st.flags.mourning = st.week; // the same catalogue surge, for a happier reason
          const gain = Math.round(st.fans * 0.3 + 2000);
          st.fans += gain;
          addBuzz(st, 20);
          for (const m of st.members) { adjust(m, 'mood', 12); adjust(m, 'image', 3); }
          milestone(st, 'career', `${p.band} named ${st.bandName} as the reason. The catalogue sold again.`);
          log(st, `The reissues shipped with a sticker: "The band ${p.band} stole everything from." ${gain.toLocaleString('en-GB')} new fans, most of them younger than the first album. A magazine called it the most influential record nobody bought.`, 'good');
        },
      },
      {
        label: 'Join them on stage in their encore',
        hint: 'One night, their crowd, your song. Bigger than any reissue, if the band can still play it.',
        resolve: (st) => {
          st.flags.torch = st.week;
          const good = st.tightness >= 50;
          const gain = Math.round(st.fans * (good ? 0.5 : 0.15) + 3000);
          st.fans += gain; addBuzz(st, good ? 28 : 10);
          for (const m of available(st)) { adjust(m, 'mood', good ? 15 : -4); adjust(m, 'energy', -15); }
          milestone(st, 'career', `Played the encore with ${p.band} in front of ${good ? 'sixty' : 'sixty bemused'} thousand.`);
          log(st, good ? `Sixty thousand people, their stage, your song, and the singer from ${p.band} on his knees in front of you for the solo. ${gain.toLocaleString('en-GB')} fans by morning.` : `Sixty thousand people, their stage, your song, and the band a beat behind for all of it. The singer from ${p.band} was gracious. The crowd was polite. ${gain.toLocaleString('en-GB')} fans, out of kindness.`, good ? 'good' : 'neutral');
        },
      },
      { label: '"Never heard of them"', hint: 'Dignity, of a sort. The import bins empty anyway.', resolve: (st) => { st.flags.torch = st.week; st.fans += Math.round(st.fans * 0.08); addBuzz(st, 6); log(st, `You said you had never heard of them. They printed it on a T-shirt. The records sold anyway, slower, to people who liked the T-shirt.`, 'neutral'); } },
    ],
  },
];
