import { describe, expect, it } from 'vitest';
import { partyCommentary } from '../src/game/commentary';
import { act, newGame } from '../src/game/engine';
import { advertCommentary, crowdBand, gigCommentary, rehearsalCommentary, releaseCommentary, restCommentary, TRIP_LINES } from '../src/game/commentary';
import { openScene } from '../src/game/helpers';
import { Rng } from '../src/game/rng';
import type { Action, ActionType, Beat, GameState, NewGameInput, Role } from '../src/game/types';

const input: NewGameInput = { name: 'Jussi', instrument: 'guitar', bandName: 'Velvet Daggers', background: 'artschool', style: 'glam', seed: 1 };
const SEEDS = Array.from({ length: 50 }, (_, i) => i + 1);

const A = (type: ActionType, option: string, extra: Partial<Action> = {}): Action => ({ type, option, ...extra });

/** A fresh, solvent game with a few songs, so every option can be played. */
function fresh(seed: number, extra: Partial<GameState> = {}): GameState {
  const s = { ...newGame({ ...input, seed }), money: 5000, ...extra };
  s.songs = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => ({ title: `Song ${i}`, quality: 50, writer: 'p', kind: 'standard' as const, genre: 'glam' as const, released: false }));
  return s;
}

/** The week's commentary: beats that came from the action, not the history log or the effects. */
function commentary(s: GameState): Beat[] {
  const logged = new Set(s.log.map((l) => l.text));
  return s.scene!.beats.filter((b) => !b.late && !logged.has(b.text));
}

describe('running commentary', () => {
  const weeks: [ActionType, string][] = [
    ['gig', 'venue0'], ['gig', 'openmic'], ['gig', 'paytoplay'],
    ['party', 'cans'], ['party', 'squat'], ['party', 'soho'], ['party', 'throw'],
    ['rehearse', 'regular'], ['rehearse', 'bootcamp'], ['rehearse', 'coach'], ['rehearse', 'stageshow'], ['rehearse', 'lessons'],
    ['write', 'jam'], ['write', 'solo'], ['write', 'trend'], ['write', 'ballad'],
    ['rest', 'sleep'], ['rest', 'seaside'], ['rest', 'dry'], ['rest', 'mum'],
    ['release', 'demo'], ['release', 'single'], ['release', 'ep'], ['release', 'album'],
  ];

  it('every kind of week gets at least two lines of commentary', () => {
    for (const [type, option] of weeks) {
      for (const seed of SEEDS.slice(0, 10)) {
        const s = act(fresh(seed), A(type, option));
        expect(commentary(s).length, `${type}/${option} seed ${seed}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('never uses em dashes or unicode arrows', () => {
    for (const [type, option] of weeks) {
      for (const seed of SEEDS.slice(0, 15)) {
        for (const t of commentary(act(fresh(seed), A(type, option))).map((b) => b.text)) {
          expect(t).not.toMatch(/[—→]/);
          expect(t).not.toMatch(/undefined|null|NaN|\$\{/);
        }
      }
    }
    for (const t of TRIP_LINES) expect(t).not.toMatch(/—/);
  });

  it('gigs rarely repeat themselves', () => {
    const texts = new Set<string>();
    for (const seed of SEEDS) for (const b of commentary(act(fresh(seed), A('gig', 'venue0')))) texts.add(b.text);
    expect(texts.size).toBeGreaterThan(60);
  });

  it('gig commentary is timed, in order', () => {
    for (const seed of SEEDS.slice(0, 20)) {
      const times = commentary(act(fresh(seed), A('gig', 'venue0'))).map((b) => b.time!).filter(Boolean);
      expect(times.length).toBeGreaterThanOrEqual(5);
      expect([...times].sort()).toEqual(times);
    }
  });

  it('a small crowd is never packed or sold out', () => {
    let small = 0;
    for (const seed of SEEDS) {
      for (const option of ['openmic', 'venue0']) {
        const s = act(fresh(seed), A('gig', option));
        const crowd = Number(s.log.find((l) => l.text.startsWith('Gig:'))!.text.match(/(\d+) people/)![1]);
        if (crowd >= 20) continue;
        small++;
        for (const t of commentary(s).map((b) => b.text)) expect(t).not.toMatch(/packed|sold out|sold-out|full house|a roar|rafters/i);
      }
    }
    expect(small).toBeGreaterThan(5);
  });

  it('crowd bands follow both headcount and capacity', () => {
    expect(crowdBand(6, 45)).toBe('empty');
    expect(crowdBand(18, 45)).toBe('small');
    expect(crowdBand(39, 40)).toBe('small');
    expect(crowdBand(60, 150)).toBe('decent');
    expect(crowdBand(130, 150)).toBe('packed');
    expect(crowdBand(80, 80)).toBe('soldout');
  });

  it('a big storming crowd gets big-crowd lines', () => {
    const texts = new Set<string>();
    for (const seed of SEEDS.slice(0, 30)) {
      const s = newGame({ ...input, seed });
      openScene(s, 'gig', 'Test', 'gig');
      gigCommentary(s, new Rng(seed), { venue: 'The Odeum, Kentish Town', crowd: 1400, capacity: 1400, perf: 90, wasted: [] });
      for (const b of s.scene!.beats) texts.add(b.text);
    }
    expect([...texts].some((t) => /sold out|full house|Full to the doors/i.test(t))).toBe(true);
    expect([...texts].some((t) => t.startsWith('A pint glass sails'))).toBe(false);
  });

  it('a wasted bandmate shows up by name in the gig, a wasted player as "you"', () => {
    const s = newGame(input);
    const [me, mate] = s.members;
    openScene(s, 'gig', 'Test', 'gig');
    gigCommentary(s, new Rng(5), { venue: 'The Crown & Gutter, Camden', crowd: 30, capacity: 80, perf: 45, wasted: [me, mate] });
    expect(s.scene!.vibe).toBe('wasted');
    const bad = s.scene!.beats.filter((b) => b.tone === 'bad' && b.time).map((b) => b.text);
    expect(bad.some((t) => /\bYou\b|\byou\b/.test(t))).toBe(true);
    const short = mate.name.match(/"([^"]+)"/)?.[1] ?? mate.name.split(' ')[0];
    expect(bad.some((t) => t.includes(short))).toBe(true);
  });

  it('a night in Soho trips, with varied surreal lines and a comedown', () => {
    const trips = new Set<string>();
    for (const seed of SEEDS) {
      const s = act(fresh(seed), A('party', 'soho'));
      expect(s.scene!.vibe).toBe('trip');
      const reveal = s.scene!.beats.filter((b) => b.tone === 'reveal' && TRIP_LINES.includes(b.text));
      expect(reveal.length).toBeGreaterThanOrEqual(1);
      for (const b of reveal) trips.add(b.text);
    }
    expect(TRIP_LINES.length).toBeGreaterThanOrEqual(40);
    expect(trips.size).toBeGreaterThan(25);
  });

  it('parties, rests and rehearsals vary across seeds', () => {
    for (const [type, option, min] of [['party', 'cans', 25], ['party', 'throw', 25], ['rest', 'dry', 10], ['rest', 'mum', 10], ['rehearse', 'regular', 12], ['write', 'ballad', 15]] as const) {
      const texts = new Set<string>();
      for (const seed of SEEDS) for (const b of commentary(act(fresh(seed), A(type, option)))) texts.add(b.text);
      expect(texts.size, `${type}/${option}`).toBeGreaterThan(min);
    }
  });

  it('rehearsal, rest and release commentary is deterministic without an rng', () => {
    const run = (fn: (s: GameState) => void) => {
      const s = newGame(input);
      openScene(s, 'rest', 'Test');
      fn(s);
      return s.scene!.beats.map((b) => b.text);
    };
    expect(run((s) => restCommentary(s, 'dry'))).toEqual(run((s) => restCommentary(s, 'dry')));
    expect(run((s) => rehearsalCommentary(s, 'coach'))).toEqual(run((s) => rehearsalCommentary(s, 'coach')));
    expect(run((s) => releaseCommentary(s, 'album'))).toEqual(run((s) => releaseCommentary(s, 'album')));
    expect(run((s) => releaseCommentary(s, 'album', new Rng(3))).length).toBeGreaterThanOrEqual(3);
  });

  it('rehearsal days come out in order', () => {
    const order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    for (const seed of SEEDS.slice(0, 20)) {
      const days = commentary(act(fresh(seed), A('rehearse', 'regular'))).map((b) => order.indexOf(b.time!)).filter((i) => i >= 0);
      expect([...days].sort((a, b) => a - b)).toEqual(days);
    }
  });
});

describe('audition commentary', () => {
  const roles: Role[] = ['guitar', 'bass', 'drums', 'keys'];

  it('every advert option plays out over the week', () => {
    const texts = new Set<string>();
    for (const option of ['newsagent', 'classified', 'bar', 'poach']) {
      for (const role of roles) {
        for (let seed = 1; seed <= 10; seed++) {
          const s = newGame({ ...input, seed });
          openScene(s, 'advertise', 'Find a musician');
          advertCommentary(s, new Rng(seed * 7), option, role);
          const beats = s.scene!.beats;
          expect(beats.length).toBeGreaterThanOrEqual(3);
          expect(beats[0].time).toBe('Monday');
          expect(beats.at(-1)!.time).toBe('Friday');
          const lines = beats.map((b) => b.text);
          expect(new Set(lines).size).toBe(lines.length);
          for (const t of lines) {
            expect(t).not.toMatch(/—|undefined/);
            texts.add(t);
          }
        }
      }
    }
    expect(texts.size).toBeGreaterThan(50);
  });

  it('auditions for a drummer feature drummers', () => {
    let drummers = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const s = newGame({ ...input, seed });
      openScene(s, 'advertise', 'Find a musician');
      advertCommentary(s, new Rng(seed), 'classified', 'drums');
      if (s.scene!.beats.some((b) => /\bdrummer\b/i.test(b.text) && b.time !== 'Monday')) drummers++;
    }
    expect(drummers).toBeGreaterThan(5);
  });
});

describe('placeholders', () => {
  it('no {mate}-style placeholder ever reaches the screen', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const s = newGame({ name: 'X', instrument: 'none', bandName: 'B', background: 'artschool', style: 'glam', seed });
      openScene(s, 'rest', 'x');
      restCommentary(s, 'yogi', new Rng(seed));
      restCommentary(s, 'shrink', new Rng(seed));
      restCommentary(s, 'clinic', new Rng(seed));
      restCommentary(s, 'sanatorium', new Rng(seed));
      rehearsalCommentary(s, 'shop', new Rng(seed));
      partyCommentary(s, new Rng(seed), 'penthouse', s.members[1]);
      partyCommentary(s, new Rng(seed), 'yacht', s.members[1]);
      for (const b of s.scene!.beats) expect(b.text, b.text).not.toMatch(/\{\w+\}/);
    }
  });
});

describe('song reactions', () => {
  it('the band reacts to covers and chart chasers in more than one way, and sometimes loves them', async () => {
    const { reactToSong } = await import('../src/game/reactions');
    const { newGame } = await import('../src/game/engine');
    const { Rng } = await import('../src/game/rng');
    const base = newGame({ name: 'Jussi', instrument: 'guitar', bandName: 'X', background: 'artschool', style: 'glam', seed: 5 });
    for (const m of base.members) { m.hidden.ego = 80; m.writing = 60; m.style = 'metal'; }
    const seen = new Set<string>();
    let loved = 0;
    for (let seed = 1; seed <= 40; seed++) {
      for (const how of ['cover', 'trend', 'ballad', 'solo'] as const) {
        const s = structuredClone(base);
        const rng = new Rng(seed);
        const song = { title: 'T', quality: 40 + (seed % 5) * 12, writer: 'p', kind: how === 'solo' ? 'solo' as const : how === 'cover' ? 'cover' as const : how === 'trend' ? 'trend' as const : 'ballad' as const, genre: 'newwave' as const, released: false };
        const n = s.log.length;
        reactToSong(s, rng, song, how, s.members[0]);
        for (const l of s.log.slice(n)) { seen.add(l.text.replace(/\w+ (called|played|asked|said|wrote|listened|learned|suggested|did|wondered|is|went)/, 'X $1')); if (l.tone === 'good') loved++; }
      }
    }
    expect(seen.size).toBeGreaterThan(15);
    expect(loved).toBeGreaterThan(10);
  });
});

describe('the band in a sentence', () => {
  it('mentions the legendary night, the mood and the quiet one', async () => {
    const { bandWord } = await import('../src/game/pulse');
    const { newGame } = await import('../src/game/engine');
    const s = newGame({ name: 'Jussi', instrument: 'guitar', bandName: 'X', background: 'artschool', style: 'glam', seed: 3 });
    s.week = 30;
    s.milestones.push({ week: 29, kind: 'career', text: 'The Rat Pit, Islington: the night they still talk about. 150 people, all of them witnesses.' });
    for (const m of s.members) m.mood = 80;
    s.members[2].mood = 20;
    const w = bandWord(s);
    expect(w).toMatch(/Rat Pit/);
    expect(w).toMatch(/Decent mood|steady week|mood is fine/);
    expect(w).toContain(s.members[2].name.split(' ')[0]);
    const words = new Set<string>();
    for (let wk = 30; wk < 40; wk++) words.add(bandWord({ ...s, week: wk }));
    expect(words.size).toBeGreaterThan(2);
  });
});

describe('the post', () => {
  it('letters arrive now and then, from more than one sender, with small effects', async () => {
    const { postWeek } = await import('../src/game/letters');
    const { newGame } = await import('../src/game/engine');
    const { Rng } = await import('../src/game/rng');
    const base = newGame({ name: 'Jussi', instrument: 'guitar', bandName: 'X', background: 'artschool', style: 'glam', seed: 8 });
    base.fans = 3000; base.money = 50; base.week = 80;
    base.alumni.push({ name: 'Dave Price', realName: 'Dave Price', role: 'bass', joined: 0, left: 40, how: 'quit' });
    const senders = new Set<string>();
    let got = 0;
    for (let seed = 1; seed <= 150; seed++) {
      const s = structuredClone(base);
      postWeek(s, new Rng(seed));
      if (s.letters?.length) { got++; senders.add(s.letters[0].from.split(',')[0]); expect(s.log.at(-1)!.text).toMatch(/^A letter from/); }
    }
    expect(got).toBeGreaterThan(10);
    expect(got).toBeLessThan(50);
    expect(senders.size).toBeGreaterThan(4);
  });
});
