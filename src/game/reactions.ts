// How the band takes a new song. Not the same line every week: it depends on how good the song is,
// who wrote it, who hates ballads, and whether the cover turns out to be the one they all grew up on.
import { Rng } from './rng';
import { addAffinity, available } from './chemistry';
import { adjust, first, log, revealLog } from './helpers';
import type { GameState, Musician, Song } from './types';

const pickFor = (rng: Rng, lines: string[], m: Musician, song: Song) =>
  rng.pick(lines).replace(/\{m\}/g, first(m)).replace(/\{song\}/g, song.title);

const TREND_SOUR = [
  '{m} called the new song "a sell-out" and played it with their eyes shut.',
  '{m} played "{song}" standing as far from the synth as the lead allowed.',
  '{m} asked whether the band was going to wear the haircuts as well.',
  '{m} learned the part in ten minutes and spent the rest of the day on the stairs, smoking.',
  '{m} said "it is fine" in the voice that means it is not fine.',
  '{m} wrote "NOT ME" on the tape box, in biro, twice.',
];
const TREND_WON = [
  '{m}, who came in to hate it, caught themselves humming "{song}" at the bus stop.',
  '{m} said it was rubbish, then asked to play it again. Then again.',
  '{m} admitted, into a pint, that the chorus was "annoyingly good".',
];
const COVER_SOUR = [
  '{m} wanted to know why the band is playing other people\'s songs.',
  '{m} played "{song}" like it had insulted their mother.',
  '{m} suggested, quietly, that the band has its own songs. The band has.',
  '{m} did the solo note for note and looked bored doing it, which was the point.',
];
const COVER_LOVED = [
  'Everyone knew "{song}" from the first bar. It was the first record half the band ever bought, and for an hour the rehearsal room was a bedroom in 1975.',
  '"{song}" was the song the band used to close with before it had its own. Playing it again, properly, felt like going home.',
  'Nobody admitted it, but "{song}" is the one {m} learned the guitar on, and it showed. The version is yours now.',
  '"{song}" came out slower, louder and sadder than the original, and when it finished nobody said anything for a while.',
];
const BALLAD_SOUR = [
  '{m} is not happy about the key change.',
  '{m} played the slow one with the sound of a drummer waiting for a fast one.',
  '{m} asked if there was going to be a solo, or just "feelings".',
  '{m} said the band would be playing "{song}" at weddings for the rest of its life. {m} may be right.',
];
const BALLAD_WON = [
  '{m}, who hates ballads, asked for the lyric sheet and went quiet.',
  '{m} said nothing, which for {m} is a standing ovation.',
];
const SOLO_SOUR = [
  '{m} asked why nobody wanted their ideas.',
  '{m} listened to "{song}" once, said "nice", and went to the pub.',
  '{m} played the part exactly as written and not one note more.',
  '{m} wondered aloud whose name goes on the sleeve.',
];
const LOVED = [
  'The band played "{song}" through four times in a row and nobody wanted to stop.',
  '"{song}" was finished by teatime and the band spent the evening grinning at each other like idiots.',
  '{m} said "{song}" was the best thing the band had done, and {m} does not say that.',
  'By Friday "{song}" had a harmony, a tambourine and a bit where everyone shouts. Everyone shouts.',
  'The landlord came up to complain about "{song}" and stayed to hear it again.',
];
const FLAT = [
  'The band played "{song}" twice, agreed it was "all right", and went for chips.',
  '"{song}" has a verse. It will have a chorus one day.',
  '{m} wrote "filler?" on the tape box with a question mark, which was generous.',
];

/** The band's reaction to a freshly written song. */
export function reactToSong(s: GameState, rng: Rng, song: Song, how: 'jam' | 'solo' | 'trend' | 'ballad' | 'cover' | 'hired' | 'publisher' | 'other', writer: Musician): void {
  const here = available(s);
  const others = here.filter((m) => !m.isPlayer);
  const great = song.quality >= 72;
  const good = song.quality >= 58;
  const grumbler = (test: (m: Musician) => boolean) => others.filter(test);
  // Everyone loves a great song, whoever wrote it and whatever it is.
  if (great && song.quality < 92 && rng.chance(0.75)) {
    const m = rng.pick(others.length ? others : here);
    for (const x of here) adjust(x, 'mood', rng.int(2, 5));
    for (const a of here) for (const b of here) if (a.id < b.id) addAffinity(s, a.id, b.id, 2);
    log(s, pickFor(rng, LOVED, m, song), 'good');
    if (how === 'cover') return;
  }
  switch (how) {
    case 'trend': {
      const hot = song.genre;
      for (const m of grumbler((x) => x.style !== hot)) {
        if (good && rng.chance(0.5)) { adjust(m, 'mood', 2); log(s, pickFor(rng, TREND_WON, m, song), 'good'); }
        else if (rng.chance(0.6)) { adjust(m, 'mood', rng.int(-7, -3)); log(s, pickFor(rng, TREND_SOUR, m, song), 'bad'); }
      }
      return;
    }
    case 'cover': {
      if (rng.chance(great ? 0.6 : 0.3)) {
        const m = rng.pick(here);
        for (const x of here) adjust(x, 'mood', rng.int(3, 7));
        for (const a of here) for (const b of here) if (a.id < b.id) addAffinity(s, a.id, b.id, 3);
        log(s, pickFor(rng, COVER_LOVED, m, song), 'good');
        return;
      }
      for (const m of grumbler((x) => x.writing >= 45 && x.hidden.ego >= 60)) { adjust(m, 'mood', rng.int(-6, -3)); log(s, pickFor(rng, COVER_SOUR, m, song), 'bad'); }
      return;
    }
    case 'ballad': {
      for (const m of grumbler((x) => x.style === 'metal' || x.style === 'punk')) {
        if (great && rng.chance(0.6)) { adjust(m, 'mood', 2); log(s, pickFor(rng, BALLAD_WON, m, song), 'good'); }
        else { adjust(m, 'mood', rng.int(-6, -3)); log(s, pickFor(rng, BALLAD_SOUR, m, song), 'bad'); }
      }
      return;
    }
    case 'solo': {
      for (const m of grumbler((x) => x.hidden.ego >= 65 && x.writing >= 40)) {
        if (great && rng.chance(0.5)) continue;
        adjust(m, 'mood', rng.int(-6, -3)); addAffinity(s, m.id, writer.id, -4);
        log(s, pickFor(rng, SOLO_SOUR, m, song), 'bad');
        revealLog(s, m, 'ego', 1);
      }
      return;
    }
    default: {
      if (!good && rng.chance(0.4)) log(s, pickFor(rng, FLAT, rng.pick(here), song), 'neutral');
    }
  }
}

/** The one. How it arrived, by what it is, and what it did to the room. */
export function masterpieceScene(rng: Rng, song: Song, writer: Musician, band: Musician[]): { how: string; after: string } {
  const w = writer.isPlayer ? 'You' : first(writer);
  const other = band.filter((m) => m.id !== writer.id);
  const o = other.length ? first(rng.pick(other)) : 'the engineer';
  const HOW: Record<string, string[]> = {
    ballad: [
      'arrived on the piano at two in the morning, one finger at a time, and by the second chorus nobody in the room could look at anybody else',
      'was sung once, quietly, with the lights off, and then nobody could sing it again for crying',
      'started as a letter that was never going to be sent',
    ],
    solo: [
      'was written alone in the flat with the curtains shut and the phone off the hook, on a guitar with five strings',
      'came in the bath, was hummed into the answering machine, and was all there in the morning',
      'was finished on the top deck of the night bus and played to the band at ten the next morning, still in last night\'s clothes',
    ],
    cover: ['was somebody else\'s song until the band slowed it down, and now it is not'],
    trend: ['was supposed to be a cash-in, and turned, somewhere around the middle eight, into the real thing'],
    standard: [
      'came out in one go, verse to coda, in twenty minutes, and nobody dared speak until it was done',
      'arrived at four in the morning on the back of a chip-shop menu, and was still perfect by daylight',
      'started as a joke about the landlord and turned, somewhere around the second chorus, into the best thing any of you have ever done',
      'fell out of a wrong chord that nobody wanted to fix',
      'was three songs for a week, then one song for an afternoon, then the song',
    ],
  };
  const AFTER = [
    `${o} went outside and did not come back for an hour.`,
    `${o} cried, and then denied it, and then cried again.`,
    'The room went very quiet.',
    `${o} rang their mother to play it down the phone.`,
    'Somebody opened a bottle. Nobody drank from it. It did not seem right.',
    `${w} played it back three times, and the third time everyone sang.`,
    'The engineer asked for a copy, for himself. Engineers do not do that.',
    `${o} said "that is the one", and nobody argued, which has never happened before.`,
  ];
  const how = rng.pick(HOW[song.kind] ?? HOW.standard);
  return { how, after: rng.pick(AFTER) };
}
