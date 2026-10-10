// Running commentary for the action zone, like a match report: what happens, minute by minute.
import type { Rng } from './rng';
import { available, topSongs } from './chemistry';
import { beat, first, log, setVibe } from './helpers';
import type { GameState, Musician } from './types';

const who = (m: Musician) => (m.isPlayer ? 'You' : first(m));

export interface GigFacts {
  venue: string;
  crowd: number;
  capacity: number;
  perf: number;
  wasted: Musician[];
}

export function gigCommentary(s: GameState, rng: Rng, f: GigFacts): void {
  const here = available(s);
  const songs = topSongs(s);
  const song = (i: number) => (songs.length ? `"${songs[i % songs.length].title}"` : rng.pick(['a cover everyone half-knows', 'a borrowed riff in a new shirt', 'the only song you all agree on']));
  const full = f.crowd / f.capacity;

  beat(s, '20:30', `Doors open at ${f.venue}. ${full > 0.85 ? 'A queue round the corner.' : full > 0.4 ? 'A decent crowd drifts in.' : 'The barman outnumbers the audience for a while.'}`);
  beat(s, '21:10', `${s.bandName} walk on to ${f.crowd > 100 ? 'a roar' : f.crowd > 30 ? 'scattered cheers' : 'polite indifference'}. Opener: ${song(0)}.`);

  for (const m of f.wasted) {
    const time = rng.pick(['21:18', '21:26', '21:34']);
    beat(s, time, m.isPlayer ? 'The lyrics have left the building. You hum the second verse.' : `${first(m)} is swaying. Something is very wrong with the tempo.`, 'bad');
    log(s, m.isPlayer ? 'You were too far gone to remember the second verse.' : `${first(m)} was too wasted to play straight.`, 'bad');
  }

  const star = [...here].filter((m) => !f.wasted.includes(m)).sort((a, b) => b.stage + b.skill - (a.stage + a.skill))[0];
  if (star && f.perf >= 50) beat(s, '21:35', `${who(star)} ${star.isPlayer ? 'own' : 'owns'} the room on ${song(1)}. ${star.role === 'drums' ? 'The drum fill gets its own applause.' : star.role === 'guitar' ? 'The solo goes on a bit. Nobody minds.' : 'Even the bouncers are watching.'}`, 'good');

  const tired = here.find((m) => m.energy < 30);
  if (tired) beat(s, '21:50', `${who(tired)} ${tired.isPlayer ? 'are' : 'is'} running on fumes. The middle eight sags.`, 'bad');

  const middle =
    f.perf >= 75 ? 'The front row knows every word. Somebody is crowd-surfing on a table.'
    : f.perf >= 55 ? 'Heads nodding, a few people dancing, nobody leaves.'
    : f.perf >= 40 ? 'Half the room has drifted back to the bar.'
    : 'A pint glass sails past the mic stand.';
  beat(s, '22:00', middle, f.perf >= 55 ? 'good' : f.perf >= 40 ? 'neutral' : 'bad');

  if (rng.chance(0.25)) {
    beat(s, '22:10', rng.pick([
      'A fight breaks out by the cigarette machine. The band plays on.',
      'The power trips. Ten seconds of darkness, then a cheer.',
      'Someone in the crowd is wearing your band\'s name in felt-tip on a T-shirt.',
      'A string snaps. The spare guitar is out of tune. You carry on anyway.',
    ]));
  }

  if (f.perf >= 65) beat(s, '22:25', `They want more. Encore: ${song(2)}.`, 'good');
  else if (f.perf >= 45) beat(s, '22:25', 'A smattering of applause. No encore, but nobody asked for a refund.');
  else beat(s, '22:25', 'The landlord turns the lights on mid-song.', 'bad');

  if (f.wasted.length) setVibe(s, 'wasted');
}

export function partyCommentary(s: GameState, rng: Rng, option: string, wildest: Musician): void {
  const trippy = option === 'soho' || option === 'throw' || (option === 'squat' && wildest.hidden.vice >= 70);
  if (trippy) setVibe(s, 'trip');
  const lines: Record<string, [string, string][]> = {
    cans: [['20:00', 'A crate of lager and the ghetto blaster on full.'], ['23:30', 'Someone puts the same tape on for the fourth time.']],
    squat: [['22:00', 'A squat in Hackney. Candles in bottles, a punk band in the kitchen.'], ['01:00', `${who(wildest)} ${wildest.isPlayer ? 'are' : 'is'} dancing on the sofa.`]],
    soho: [['22:30', 'Velvet rope, neon, a doorman who looks you up and down and nods.'], ['00:40', 'Someone famous-ish buys a round. Or you do. It gets blurry.']],
    throw: [['21:00', 'Your place, your party. Fifty people by ten, two hundred by midnight.'], ['00:15', 'The neighbours bang on the wall. The bass player bangs back.']],
  };
  for (const [t, text] of lines[option]) beat(s, t, text);
  if (trippy) {
    beat(s, '02:20', rng.pick([
      'The wallpaper is breathing. It is breathing in 4/4.',
      'The lava lamp is explaining your future. It looks bright. Then purple.',
      'You have a long, important conversation with a coat stand.',
      'Every face in the room is wearing your band\'s logo. None of them are.',
    ]), 'reveal');
    beat(s, '04:50', 'Somewhere a milk float. Somewhere a bird. Somewhere your shoes.');
  }
}

export function rehearsalCommentary(s: GameState, option: string): void {
  const opening: Record<string, string> = {
    regular: 'The band drags itself up the stairs above the kebab shop.',
    bootcamp: 'The drinks cupboard is padlocked. Rehearsal starts at nine sharp.',
    coach: 'A session pro in a cardigan arrives with a metronome and no sense of humour.',
    stageshow: 'A smoke machine, a mirror and a lot of hairspray.',
    lessons: 'The rest of the band jams while one of you goes off to see a teacher.',
  };
  beat(s, 'Monday', opening[option] ?? opening.regular);
  beat(s, 'Wednesday', option === 'stageshow' ? 'Synchronised guitar swings. Nobody gets hit. Nearly nobody.' : 'Running the set again. And again. The changes start to land.');
}

export function writingCommentary(s: GameState, rng: Rng, option: string): void {
  const opening: Record<string, string> = {
    jam: 'Everyone in the rehearsal room, a four-track and a lot of riffs.',
    solo: 'You, a notebook, an acoustic guitar and a cold flat.',
    trend: 'You listen to the charts all morning, taking notes and making faces.',
    ballad: 'The lights go down. Someone produces a lighter, for inspiration.',
  };
  beat(s, 'Monday', opening[option]);
  beat(s, 'Thursday', rng.pick(['A chorus arrives at 3 a.m. and nobody writes it down.', 'The tape recorder is full of half-ideas.', 'Someone hums something good in the toilet.']));
}

export function restCommentary(s: GameState, option: string): void {
  const lines: Record<string, string> = {
    sleep: 'Curtains shut, phone off the hook.',
    seaside: 'The 9:15 to Brighton, four of you and a bag of cans.',
    dry: 'Padlock on the cupboard. Tea, biscuits, and the shakes.',
    mum: 'Everyone goes home with a bag of washing.',
  };
  beat(s, 'Monday', lines[option]);
}

export function releaseCommentary(s: GameState, kind: string): void {
  const lines: Record<string, string> = {
    demo: 'A four-track in the rehearsal room and a box of blank tapes.',
    single: 'A day in a cheap studio in Willesden. The engineer smokes through every take.',
    ep: 'Three days in a proper studio. The producer keeps saying "one more".',
    album: 'Two weeks squeezed into one in a studio you cannot afford.',
  };
  beat(s, 'Monday', lines[kind]);
  beat(s, 'Friday', kind === 'demo' ? 'Tapes dubbed, labels written in biro.' : 'Test pressings arrive. You play them six times in a row.');
}
