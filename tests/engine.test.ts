import { describe, expect, it } from 'vitest';
import { act, canAct, dismissCandidates, fire, first, hire, newGame } from '../src/game/engine';
import { actionOptions } from '../src/game/actions';
import { EVENT_IDS, forceEvent, resolvePending, viewPending } from '../src/game/events';
import { chemistry, missingForGig, performance } from '../src/game/chemistry';
import { Rng } from '../src/game/rng';
import { nextGoal } from '../src/game/goals';
import { startTour } from '../src/game/tour';
import { TOUR_EVENT_IDS } from '../src/game/tourEvents';
import { START_TOTAL_HEADROOM, START_TOTAL_OVR, headroom, overall, reveal, rollPotential, seenRange, traitDisplay } from '../src/game/characters';
import { bandName, isBlocked } from '../src/game/names';
import type { Action, ActionType, GameState, NewGameInput } from '../src/game/types';

const input: NewGameInput = { name: 'Jussi', instrument: 'guitar', bandName: 'Velvet Daggers', background: 'artschool', style: 'glam', seed: 42 };

const A = (type: ActionType, option: string, extra: Partial<Action> = {}): Action => ({ type, option, ...extra });
const REST = A('rest', 'sleep');

/** Clears any pending situation by picking the first affordable response. */
function settle(s: GameState): GameState {
  while (s.pending) {
    const v = viewPending(s)!;
    const i = v.options.findIndex((o) => !o.locked);
    s = resolvePending(s, i);
  }
  return s;
}

function step(s: GameState, a: Action): GameState {
  return settle(act(settle(s), a));
}

describe('new game', () => {
  it('starts in London 1982 with the player plus guitar, bass and drums', () => {
    const s = newGame(input);
    expect(s.week).toBe(0);
    expect(s.members.map((m) => m.role)).toEqual(['vocals', 'guitar', 'bass', 'drums']);
    expect(s.members[0].isPlayer).toBe(true);
    expect(s.members[0].doubles).toBe('guitar');
    expect(missingForGig(s)).toEqual([]);
  });

  it('is deterministic for a given seed', () => {
    expect(newGame(input)).toEqual(newGame(input));
  });

  it("hides bandmates' traits at the start", () => {
    const s = newGame(input);
    for (const m of s.members.slice(1)) expect(Object.values(m.known).every((k) => k === 0)).toBe(true);
  });

  it('starting mates are uneven', () => {
    const s = newGame(input);
    const skills = s.members.slice(1).map((m) => m.skill).sort((a, b) => a - b);
    expect(skills[2] - skills[0]).toBeGreaterThan(5);
  });
});

describe('action choices', () => {
  const types: ActionType[] = ['gig', 'rehearse', 'write', 'release', 'party', 'rest', 'advertise'];

  it('every action offers between two and six choices', () => {
    const s = newGame(input);
    for (const t of types) {
      const n = actionOptions(s, t).length;
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(t === 'gig' ? 8 : 6);
    }
  });

  it('a new band can only play small gigs', () => {
    const s = newGame(input);
    const gigs = actionOptions(s, 'gig');
    expect(gigs.find((o) => o.id === 'openmic')!.locked).toBeUndefined();
    expect(gigs.find((o) => o.id === 'venue0')!.locked).toBeUndefined();
    expect(gigs.find((o) => o.id === 'venue1')!.locked).toMatch(/fans/);
    expect(gigs.some((o) => o.id === 'venue4')).toBe(false);
  });

  it('unaffordable choices are locked with the reason', () => {
    const s = { ...newGame(input), money: 10 };
    const throwParty = actionOptions(s, 'party').find((o) => o.id === 'throw')!;
    expect(throwParty.locked).toMatch(/£90/);
    expect(() => act(s, A('party', 'throw'))).toThrow();
  });

  it('every unlocked choice of every action can be played', () => {
    for (let seed = 1; seed <= 5; seed++) {
      let s = { ...newGame({ ...input, seed }), money: 5000, fans: 300 };
      s = step(s, A('write', 'jam'));
      s = step(s, A('write', 'jam'));
      s = step(s, A('write', 'jam'));
      for (const t of types) {
        for (const o of actionOptions(s, t)) {
          if (o.locked) continue;
          const next = act(settle(s), A(t, o.id, { role: 'keys' }));
          expect(next.week).toBe(s.week + 1);
        }
      }
    }
  });

  it('rehearsing raises tightness and advances the week', () => {
    const s0 = newGame(input);
    const s1 = act(s0, A('rehearse', 'regular'));
    expect(s1.week).toBe(1);
    expect(s1.tightness).toBeGreaterThan(s0.tightness);
  });

  it('boot camp tightens more than a usual rehearsal', () => {
    const s0 = newGame(input);
    expect(act(s0, A('rehearse', 'bootcamp')).tightness).toBeGreaterThan(act(s0, A('rehearse', 'regular')).tightness);
  });

  it('does not mutate the previous state', () => {
    const s0 = newGame(input);
    const copy = structuredClone(s0);
    act(s0, A('gig', 'venue0'));
    expect(s0).toEqual(copy);
  });

  it('gigging costs energy', () => {
    const s0 = newGame(input);
    const s1 = act(s0, A('gig', 'venue0'));
    expect(s1.lastGigWeek).toBe(0);
    expect(s1.members.reduce((a, m) => a + m.energy, 0)).toBeLessThan(s0.members.reduce((a, m) => a + m.energy, 0));
  });

  it('one-off gig offers turn up early, change weekly and pay their fee', () => {
    const seen = new Set<string>();
    let played = false;
    for (let week = 0; week < 20; week++) {
      const s = { ...newGame(input), week };
      const offers = actionOptions(s, 'gig').filter((o) => o.id.startsWith('offer_'));
      for (const o of offers) seen.add(o.id);
      if (!played && offers.length) {
        const after = act(s, A('gig', offers[0].id));
        expect(after.lastGigWeek).toBe(week);
        played = true;
      }
    }
    expect(played).toBe(true);
    expect(seen.size).toBeGreaterThan(4);
    const famous = { ...newGame(input), fans: 5000 };
    expect(actionOptions(famous, 'gig').some((o) => o.id.startsWith('offer_'))).toBe(false);
  });

  it('pay to play costs £60 and pays nothing at the door', () => {
    const s0 = newGame(input);
    const s1 = act(s0, A('gig', 'paytoplay'));
    expect(s1.log.some((l) => l.text.includes('pay to play'))).toBe(true);
    expect(s1.money).toBeLessThan(s0.money - 60 + 1);
  });

  it('writing sometimes produces nothing, but usually songs', () => {
    let songs = 0;
    for (let seed = 1; seed <= 30; seed++) songs += act(newGame({ ...input, seed }), A('write', 'jam')).songs.length;
    expect(songs).toBeGreaterThan(20);
  });

  it('a trend song is written in the hottest genre', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const s = act(newGame({ ...input, seed }), A('write', 'trend'));
      for (const song of s.songs) expect(song.genre).toBe('newwave');
    }
  });

  it('the newsagent card brings two candidates, a poach brings one', () => {
    const s1 = act(newGame(input), A('advertise', 'newsagent', { role: 'keys' }));
    expect(s1.candidates).toHaveLength(2);
    const rich = { ...newGame(input), fans: 200, money: 500 };
    const s2 = act(rich, A('advertise', 'poach', { role: 'guitar' }));
    expect(s2.candidates).toHaveLength(1);
    expect(s2.candidates[0].known.loyalty).toBe(1);
  });

  it('can hire a candidate as a replacement', () => {
    const s1 = settle(act(newGame(input), A('advertise', 'classified', { role: 'drums' })));
    const oldDrummer = s1.members.find((m) => m.role === 'drums')!;
    const s2 = hire(s1, s1.candidates[0].id, oldDrummer.id);
    expect(s2.members.find((m) => m.role === 'drums')!.id).toBe(s1.candidates[0].id);
    expect(s2.members).toHaveLength(4);
  });

  it('auditions can be closed without hiring anyone', () => {
    const s1 = settle(act(newGame(input), A('advertise', 'classified', { role: 'keys' })));
    const s2 = dismissCandidates(s1);
    expect(s2.candidates).toHaveLength(0);
    expect(s2.candidateRole).toBeNull();
    expect(s2.members).toHaveLength(s1.members.length);
  });

  it('a band without a drummer cannot gig', () => {
    const s0 = newGame(input);
    const s1 = fire(s0, s0.members.find((m) => m.role === 'drums')!.id);
    expect(canAct(s1, A('gig', 'venue0'))).toMatch(/drummer/);
  });

  it('cannot fire the player', () => {
    expect(() => fire(newGame(input), 'p')).toThrow();
  });
});

describe('records', () => {
  function withSongs(n: number, q = 60): GameState {
    const s = { ...newGame(input), money: 3000 };
    s.songs = Array.from({ length: n }, (_, i) => ({ title: `Song ${i}`, quality: q, writer: 'p', kind: 'standard' as const, genre: 'glam' as const, released: false }));
    return s;
  }

  it('a single needs two unreleased songs and marks them released', () => {
    expect(actionOptions(withSongs(1), 'release').find((o) => o.id === 'single')!.locked).toMatch(/2 unreleased/);
    const s = act(withSongs(3), A('release', 'single'));
    expect(s.releases).toHaveLength(1);
    expect(s.songs.filter((x) => x.released)).toHaveLength(2);
  });

  it('a demo tape sells at gigs', () => {
    let s = settle(act(withSongs(3), A('release', 'demo')));
    s = act({ ...s, fans: 200 }, A('gig', 'venue1'));
    expect(s.releases[0].sold).toBeGreaterThan(0);
  });

  it('a well-loved single can enter the National Top 40, a milestone that does not end the game', () => {
    let s = { ...withSongs(4, 80), fans: 1200, buzz: 50 };
    s = settle(act(s, A('release', 'single')));
    for (let i = 0; i < 4 && !s.over; i++) s = step(s, REST);
    expect(s.world.peaks.uk).toBeDefined();
    expect(s.flags.chartedNational).toBeDefined();
    expect(s.over).toBeNull();
  });

  it('a band with no fans does not chart', () => {
    let s = settle(act(withSongs(4, 60), A('release', 'single')));
    for (let i = 0; i < 4; i++) s = step(s, REST);
    expect(s.world.peaks.uk).toBeUndefined();
  });
});

describe('choice events', () => {
  function richState(seed: number): GameState {
    const s = { ...newGame({ ...input, seed }), money: 2000, fans: 300, buzz: 40, lastGigWeek: 48, week: 49, gear: 2 };
    s.songs = [1, 2, 3].map((i) => ({ title: `S${i}`, quality: 50, writer: 'p', kind: 'standard' as const, genre: 'glam' as const, released: false }));
    s.releases = [{ id: 'd', kind: 'demo', title: 'S1', quality: 40, appeal: 1, week: 0, sold: 0, lastWeek: 0 }];
    s.flags = { lastBigParty: 49, noVan: 0 };
    for (const m of s.members) {
      m.habit = 65; m.energy = 30; m.hidden.vice = 80; m.hidden.ego = 75; m.writing = 50; m.weeksInBand = 6; m.skill = 60;
    }
    return s;
  }

  /** Per-event setup for situations that need a later year, a season or a follow-up flag. */
  const later = (s: GameState, week: number) => { s.week = week; s.lastGigWeek = week - 1; s.flags.lastBigParty = week; };
  const SETUP: Record<string, (s: GameState) => void> = {
    transit: (s) => { s.flags.noVan = 1; },
    guru: (s) => later(s, 153),
    makeover: (s) => later(s, 153),
    benefit: (s) => later(s, 153),
    video: (s) => later(s, 153),
    xmas_single: (s) => later(s, 95),
    manager_clause: (s) => { s.flags.manager = 2; s.flags.managerWeek = 40; },
  };

  it('every event can fire and every response resolves cleanly', () => {
    for (const id of EVENT_IDS) {
      let tried = false;
      for (let seed = 1; seed <= 10 && !tried; seed++) {
        const s = richState(seed);
        SETUP[id]?.(s);
        if (TOUR_EVENT_IDS.includes(id)) { startTour(s, new Rng(seed), 'america', 6, 'steady'); s.tour!.week = 2; s.members.forEach((m, i) => { if (i === 1) m.mood = 20; m.outWeeks = 0; }); }
        let forced: GameState;
        try { forced = forceEvent(s, id); } catch { continue; }
        tried = true;
        const view = viewPending(forced)!;
        expect(view.options.length).toBeGreaterThanOrEqual(2);
        expect(view.options.length).toBeLessThanOrEqual(5);
        view.options.forEach((o, i) => {
          if (o.locked) return;
          const after = resolvePending(forced, i);
          expect(after.pending).toBeNull();
          expect(after.week).toBe(forced.week);
        });
      }
      expect(tried, `event ${id} never became eligible`).toBe(true);
    }
  });

  it('stolen gear pays out only on a proper policy', () => {
    for (const [insured, label] of [[2, /insurance/], [1, /Del/]] as const) {
      const s = richState(1);
      s.flags.insured = insured;
      const forced = forceEvent(s, 'kit_stolen');
      const i = viewPending(forced)!.options.findIndex((o) => label.test(o.label));
      expect(i).toBeGreaterThanOrEqual(0);
      const after = resolvePending(forced, i);
      expect(after.flags.insured).toBe(0);
      if (insured === 2) expect(after.gear).toBe(s.gear);
      else expect(after.gear).toBe(s.gear - 1);
    }
  });

  it('has a wide, uniquely named set of situations', () => {
    expect(EVENT_IDS.length).toBeGreaterThanOrEqual(45);
    expect(new Set(EVENT_IDS).size).toBe(EVENT_IDS.length);
  });

  it('a pending situation blocks the week until answered', () => {
    const s = forceEvent(richState(1), 'gear');
    expect(canAct(s, REST)).toMatch(/situation/);
    expect(() => act(s, REST)).toThrow();
    expect(canAct(resolvePending(s, 2), REST)).toBeNull();
  });

  it('events come up regularly over a season', () => {
    let s = newGame(input);
    let count = 0;
    for (let i = 0; i < 40 && !s.over; i++) {
      s = act(settle(s), REST);
      if (s.pending) count++;
    }
    expect(count).toBeGreaterThan(5);
  });
});

describe('chemistry', () => {
  it('big egos cost chemistry', () => {
    const s = newGame(input);
    const calm = structuredClone(s);
    for (const m of calm.members) m.hidden.ego = 20;
    const egos = structuredClone(s);
    for (const m of egos.members) m.hidden.ego = 90;
    expect(chemistry(egos).total).toBeLessThan(chemistry(calm).total);
    expect(performance(egos)).toBeLessThan(performance(calm));
  });

  it('a tight band of average players can beat a feuding band of virtuosos', () => {
    const base = newGame(input);
    const tight: GameState = structuredClone(base);
    tight.tightness = 80;
    for (const m of tight.members) { m.skill = 50; m.stage = 50; m.style = 'glam'; m.mood = 80; m.hidden.ego = 30; }
    for (const k of Object.keys(tight.affinity)) tight.affinity[k] = 70;
    const feud: GameState = structuredClone(base);
    feud.tightness = 10;
    const styles = ['metal', 'newwave', 'punk', 'glam'] as const;
    feud.members.forEach((m, i) => { m.skill = 75; m.stage = 70; m.style = styles[i]; m.mood = 25; m.hidden.ego = 90; });
    for (const k of Object.keys(feud.affinity)) feud.affinity[k] = -70;
    expect(performance(tight)).toBeGreaterThan(performance(feud));
  });
});

describe('real and stage names', () => {
  it('keeps the real name and shows the stage name', () => {
    const s = newGame({ ...input, name: 'John Whitaker', stageName: 'Johnny Vain' });
    expect(s.members[0].name).toBe('Johnny Vain');
    expect(s.members[0].realName).toBe('John Whitaker');
  });

  it('falls back to the real name when there is no stage name', () => {
    expect(newGame({ ...input, name: 'John Whitaker' }).members[0].name).toBe('John Whitaker');
  });

  it('gives some bandmates stage names over many games', () => {
    let staged = 0;
    for (let seed = 1; seed <= 20; seed++) staged += newGame({ ...input, seed }).members.filter((m) => !m.isPlayer && m.name !== m.realName).length;
    expect(staged).toBeGreaterThan(10);
  });

  it('uses the nickname as the short name', () => {
    const s = newGame(input);
    expect(first({ ...s.members[1], name: 'Dave "Razor" Price' })).toBe('Razor');
  });
});

describe('charts', () => {
  it('every chart has 40 ranked entries from the start', () => {
    const s = newGame(input);
    for (const c of ['london', 'uk', 'europe', 'world'] as const) {
      expect(s.world.charts[c]).toHaveLength(40);
      expect(s.world.charts[c].map((e) => e.pos)).toEqual(Array.from({ length: 40 }, (_, i) => i + 1));
    }
  });

  it('charts already have history when the game starts', () => {
    const s = newGame(input);
    for (const c of ['london', 'uk', 'world'] as const) {
      const weeks = new Set(s.world.charts[c].map((e) => e.weeks));
      expect(weeks.size).toBeGreaterThan(3);
      expect(s.world.charts[c].some((e) => e.last !== null)).toBe(true);
    }
  });

  it('a popular band enters the London chart', () => {
    let s = newGame(input);
    expect(s.world.charts.london.some((e) => e.isPlayer)).toBe(false);
    s = act({ ...s, fans: 900, buzz: 60 }, REST);
    expect(s.world.charts.london.find((e) => e.isPlayer)!.pos).toBeLessThanOrEqual(15);
    expect(s.log.some((l) => l.text.includes('entered the London Underground 40'))).toBe(true);
  });

  it('no record, no record charts', () => {
    const s = act({ ...newGame(input), fans: 5000, buzz: 100 }, REST);
    for (const c of ['uk', 'europe', 'world'] as const) expect(s.world.charts[c].some((e) => e.isPlayer)).toBe(false);
  });

  it('tracks weeks on chart and movement', () => {
    const s = step(step(newGame(input), REST), REST);
    expect(s.world.charts.world.some((e) => e.weeks >= 2 && e.last !== null)).toBe(true);
  });
});

describe('potential and age', () => {
  it('skill never grows past potential', () => {
    let s = { ...newGame(input), money: 10000 };
    const g = s.members[1];
    g.skill = 40; g.hidden.potential = 45;
    for (let i = 0; i < 40; i++) s = step(s, A('rehearse', i % 2 ? 'coach' : 'regular'));
    const after = s.members.find((m) => m.id === g.id)!;
    expect(after.skill).toBeLessThanOrEqual(45);
    expect(after.skill).toBeGreaterThanOrEqual(43);
  });

  it('a raw talent with headroom keeps improving', () => {
    let s = { ...newGame(input), money: 10000 };
    const g = s.members[1];
    g.skill = 40; g.hidden.potential = 85;
    for (let i = 0; i < 40; i++) s = step(s, A('rehearse', 'coach'));
    expect(s.members.find((m) => m.id === g.id)!.skill).toBeGreaterThan(60);
  });

  it('younger musicians have more headroom on average', () => {
    const rng = new Rng(3);
    let young = 0, old = 0;
    for (let i = 0; i < 500; i++) {
      young += rollPotential(rng, 50, 18) - 50;
      old += rollPotential(rng, 50, 29) - 50;
    }
    expect(young).toBeGreaterThan(old * 2);
  });

  it('nobody starting at 20 becomes a legend', () => {
    const rng = new Rng(9);
    for (let i = 0; i < 1000; i++) expect(rollPotential(rng, 20, 18)).toBeLessThan(65);
  });

  it('the session pro reveals everyone\'s potential roughly', () => {
    const s = act({ ...newGame(input), money: 500 }, A('rehearse', 'coach'));
    for (const m of s.members.filter((x) => x.outWeeks === 0)) expect(m.known.potential).toBeGreaterThanOrEqual(1);
    expect(s.log.some((l) => l.text.startsWith("The session pro's verdict"))).toBe(true);
  });

  it('musicians age at New Year and decline after thirty', () => {
    let s = newGame(input);
    s = { ...s, week: 51 };
    const g = s.members[1];
    g.age = 34; g.hidden.potential = 70; g.hidden.stamina = 60;
    s = act(s, REST);
    const after = s.members.find((m) => m.id === g.id)!;
    expect(after.age).toBe(35);
    expect(after.hidden.potential).toBeLessThan(70);
    expect(after.hidden.stamina).toBeLessThan(60);
  });

  it('heavy habits eat potential', () => {
    let s = newGame(input);
    const g = s.members[1];
    g.hidden.potential = 80;
    for (let i = 0; i < 40; i++) {
      const m = s.members.find((x) => x.id === g.id);
      if (!m) break;
      m.habit = 90; m.outWeeks = 0;
      s = step(s, REST);
    }
    const after = s.members.find((m) => m.id === g.id);
    if (after) expect(after.hidden.potential).toBeLessThan(80);
  });
});

describe('fair starts and getting to know the band', () => {
  it('every starting trio is worth the same, whatever the seed', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const mates = newGame({ ...input, seed }).members.slice(1);
      const total = mates.reduce((a, m) => a + overall(m), 0);
      expect(Math.abs(total - START_TOTAL_OVR)).toBeLessThanOrEqual(1);
      const room = mates.reduce((a, m) => a + headroom(m), 0);
      expect(Math.abs(room - START_TOTAL_HEADROOM)).toBeLessThanOrEqual(1);
    }
  });

  it('starting bands still differ in shape', () => {
    const spreads = new Set<number>();
    for (let seed = 1; seed <= 20; seed++) {
      const ovrs = newGame({ ...input, seed }).members.slice(1).map(overall);
      spreads.add(Math.max(...ovrs) - Math.min(...ovrs));
    }
    expect(spreads.size).toBeGreaterThan(5);
  });

  it('you only see rough ranges for new bandmates, and the truth is inside them', () => {
    const s = newGame(input);
    for (const m of s.members.slice(1)) {
      const [lo, hi] = seenRange(m, m.skill);
      expect(hi - lo).toBeGreaterThan(10);
      expect(lo).toBeLessThanOrEqual(m.skill);
      expect(hi).toBeGreaterThanOrEqual(m.skill);
    }
    const [plo, phi] = seenRange(s.members[0], s.members[0].skill);
    expect(plo).toBe(phi);
  });

  it('ranges narrow as you rehearse and gig together', () => {
    let s = newGame(input);
    for (let i = 0; i < 6; i++) s = step(s, A(i % 2 ? 'gig' : 'rehearse', i % 2 ? 'venue0' : 'regular'));
    for (const m of s.members.filter((x) => !x.isPlayer && x.weeksInBand >= 6)) {
      const [lo, hi] = seenRange(m, m.skill);
      expect(hi - lo).toBeLessThanOrEqual(4);
    }
  });

  it('private lessons improve the weakest player', () => {
    const s0 = { ...newGame(input), money: 500 };
    const weakest = [...s0.members].sort((a, b) => overall(a) - overall(b))[0];
    weakest.hidden.potential = 90;
    const s1 = act(s0, A('rehearse', 'lessons'));
    expect(s1.members.find((m) => m.id === weakest.id)!.skill).toBeGreaterThan(weakest.skill);
  });

  it('a much better player mentors the others at rehearsal', () => {
    let saw = false;
    for (let seed = 1; seed <= 20 && !saw; seed++) {
      const s0 = newGame({ ...input, seed });
      s0.members[1].skill = 85;
      for (const m of s0.members.slice(2)) { m.skill = 30; m.hidden.potential = 80; }
      saw = act(s0, A('rehearse', 'regular')).log.some((l) => l.text.includes('picked up a few tricks'));
    }
    expect(saw).toBe(true);
  });

  it('every kind of week moves someone\'s stats sooner or later', () => {
    const tries: Action[] = [A('rehearse', 'regular'), A('gig', 'venue0'), A('write', 'jam'), A('party', 'soho'), A('release', 'demo')];
    for (const a of tries) {
      let moved = false;
      for (let seed = 1; seed <= 15 && !moved; seed++) {
        const s0 = { ...newGame({ ...input, seed }), money: 1000 };
        s0.songs = [1, 2, 3].map((i) => ({ title: `S${i}`, quality: 50, writer: 'p', kind: 'standard' as const, genre: 'glam' as const, released: false }));
        for (const m of s0.members) m.hidden.potential = 95;
        moved = act(s0, a).log.some((l) => l.tone === 'fx' && /(skill|stage|writing|image) [+-]/.test(l.text));
      }
      expect(moved, a.type).toBe(true);
    }
  });
});

describe('visible effects', () => {
  it('answering a situation logs its effects, hidden ones separately', () => {
    let s: GameState = { ...newGame(input), money: 500, lastGigWeek: 0 };
    const m = s.members[1];
    m.hidden.vice = 90; m.hidden.ego = 90;
    s = forceEvent(s, 'arrest');
    const who = first(s.members.find((x) => x.id === s.pending!.params.m)!);
    const after = resolvePending(s, 0);
    const fx = after.log.filter((l) => l.tone === 'fx').pop()!;
    expect(fx.text).toContain('money -£80');
    expect(fx.text).toContain(`${who}: mood +8`);
    expect(fx.hidden).toContain(`${who}: loyalty +8`);
  });

  it('a gig logs money, fans and energy changes', () => {
    const s = act(newGame(input), A('gig', 'venue0'));
    const fx = s.log.find((l) => l.tone === 'fx')!;
    expect(fx.text).toMatch(/money \+£\d+/);
    expect(fx.text).toMatch(/energy -\d+/);
  });

  it('potential is never shown as a number', () => {
    const s = newGame(input);
    const m = s.members[1];
    reveal(m, 'potential', 2);
    expect(m.known.potential).toBe(1);
    expect(['Big future', 'Can improve', 'Peaked']).toContain(traitDisplay(m, 'potential'));
  });
});

describe('the action zone scene', () => {
  it('a gig plays out as timed commentary with effect chips', () => {
    const s = act(newGame(input), A('gig', 'venue0'));
    expect(s.scene!.kind).toBe('gig');
    expect(['gig', 'wasted']).toContain(s.scene!.vibe);
    const timed = s.scene!.beats.filter((b) => b.time);
    expect(timed.length).toBeGreaterThanOrEqual(4);
    expect(s.scene!.beats.some((b) => b.text.startsWith('Gig:'))).toBe(true);
    expect(s.scene!.effects.some((e) => e.who === null && e.stat === 'money' && e.delta > 0)).toBe(true);
    expect(s.scene!.effects.some((e) => e.stat === 'energy' && e.delta < 0)).toBe(true);
    expect(s.scene!.recording).toBe(false);
  });

  it('a night in Soho goes on a trip', () => {
    const s = act({ ...newGame(input), money: 500 }, A('party', 'soho'));
    expect(s.scene!.vibe).toBe('trip');
  });

  it('things that happen later in the week are marked late', () => {
    const s = act({ ...newGame(input), money: 10 }, REST);
    expect(s.scene!.beats.some((b) => b.late && b.text.startsWith('Skint again'))).toBe(true);
    expect(s.scene!.beats.some((b) => !b.late)).toBe(true);
  });

  it('answering a situation becomes its own scene', () => {
    const s0 = forceEvent({ ...newGame(input), money: 1000 }, 'gear');
    const s1 = resolvePending(s0, 0);
    expect(s1.scene!.kind).toBe('event');
    expect(s1.scene!.beats[0].text).toContain('You chose');
    expect(s1.scene!.effects.some((e) => e.stat === 'gear' && e.delta === 1)).toBe(true);
  });

  it('a new game opens with an intro scene', () => {
    const s = newGame(input);
    expect(s.scene!.kind).toBe('start');
    expect(s.scene!.beats.length).toBeGreaterThanOrEqual(3);
  });
});

describe('nobody available', () => {
  it('a week with the whole band out does not crash', () => {
    for (const a of [A('write', 'jam'), A('rehearse', 'regular'), A('party', 'cans'), A('release', 'demo')]) {
      const s0 = { ...newGame(input), money: 500 };
      s0.songs = [1, 2, 3].map((i) => ({ title: `S${i}`, quality: 50, writer: 'p', kind: 'standard' as const, genre: 'glam' as const, released: false }));
      for (const m of s0.members) m.outWeeks = 2;
      expect(() => act(s0, a)).not.toThrow();
    }
  });
});

describe('milestones and the road to immortality', () => {
  it('a new band starts with a formation milestone and the first rung', () => {
    const s = newGame(input);
    expect(s.milestones[0].text).toContain('formed in London');
    expect(nextGoal(s).step).toBe(0);
  });

  it('first gig, releases and line-up changes become milestones', () => {
    let s = { ...newGame(input), money: 1000 };
    s = act(s, A('gig', 'venue0'));
    expect(s.milestones.some((m) => m.text.startsWith('First gig'))).toBe(true);
    const s2 = { ...newGame(input), money: 1000 };
    s2.songs = [1, 2, 3].map((i) => ({ title: `S${i}`, quality: 50, writer: 'p', kind: 'standard' as const, genre: 'glam' as const, released: false }));
    expect(act(s2, A('release', 'demo')).milestones.some((m) => m.kind === 'release')).toBe(true);
    const s3 = fire(newGame(input), newGame(input).members[1].id);
    expect(s3.milestones.some((m) => m.kind === 'lineup')).toBe(true);
  });

  it('the goal moves up the ladder as you achieve things', () => {
    const s = newGame(input);
    s.songs = [1, 2, 3].map((i) => ({ title: `S${i}`, quality: 50, writer: 'p', kind: 'standard' as const, genre: 'glam' as const, released: false }));
    expect(nextGoal(s).text).toBe('Play your first gig');
  });
});

describe('names', () => {
  it('never generates blocklisted real band names', () => {
    const rng = new Rng(1);
    for (let i = 0; i < 2000; i++) expect(isBlocked(bandName(rng))).toBe(false);
  });
});

describe('a full run', () => {
  it('a simple strategy, touring when it can, plays all the way to 1991', () => {
    for (let seed = 1; seed <= 5; seed++) {
      let s = newGame({ ...input, seed });
      let guard = 0;
      let toured = 0;
      while (!s.over && guard++ < 700) {
        s = settle(s);
        if (s.over) break;
        if (s.tour) { s = act(s, A('tour', 'continue:steady')); continue; }
        const tiers = actionOptions(s, 'tour').filter((o) => !o.locked);
        const fresh = s.members.every((m) => m.energy >= 70);
        if (tiers.length && fresh && s.week % 8 === 0) {
          s = act(s, A('tour', tiers[tiers.length - 1].id));
          toured++;
          continue;
        }
        const tired = s.members.some((m) => m.energy < 35);
        const gig = A('gig', 'venue0');
        const a = tired ? REST : s.songs.length < 4 ? A('write', 'jam') : canAct(s, gig) ? A('rehearse', 'regular') : gig;
        s = act(s, canAct(s, a) ? REST : a);
      }
      expect(s.over).not.toBeNull();
      if (s.week >= 520) expect(toured).toBeGreaterThan(0);
    }
  });
});

describe('touring', () => {
  const ready = (fans: number, money = 5000): GameState => {
    const s = { ...newGame(input), fans, money, buzz: 40 };
    s.releases = [{ id: 'r', kind: 'single', title: 'Hit', quality: 60, appeal: 1, week: 0, sold: 0, lastWeek: 0 }];
    return s;
  };

  it('a brand new band cannot tour yet, a pub band can', () => {
    expect(actionOptions(newGame(input), 'tour').every((o) => o.locked)).toBe(true);
    const pubs = actionOptions({ ...newGame(input), fans: 50 }, 'tour');
    expect(pubs.find((o) => o.id === 'pubs')!.locked).toBeUndefined();
    expect(pubs.find((o) => o.id === 'clubs')!.locked).toMatch(/fans/);
  });

  it('only shows the next rung of the ladder', () => {
    expect(actionOptions({ ...newGame(input), fans: 50 }, 'tour').map((o) => o.id)).toEqual(['pubs', 'clubs']);
  });

  it('a tour plays several gigs a week in real cities and locks other actions', () => {
    const s = act(ready(300), A('tour', 'clubs', { weeks: 3, policy: 'steady' }));
    expect(s.tour).not.toBeNull();
    expect(s.tour!.week).toBe(1);
    expect(s.tour!.gigsPlayed).toBe(5);
    expect(s.tour!.route).toHaveLength(15);
    expect(canAct(s, REST)).toMatch(/on tour/);
    expect(s.scene!.beats.filter((b) => /people/.test(b.text)).length).toBeGreaterThanOrEqual(5);
  });

  it('the tour ends by itself after the chosen weeks', () => {
    let s = settle(act(ready(300), A('tour', 'clubs', { weeks: 2, policy: 'steady' })));
    s = settle(act(s, A('tour', 'continue:steady')));
    expect(s.tour).toBeNull();
    expect(s.log.some((l) => l.text.startsWith('Tour over'))).toBe(true);
  });

  it('abandoning costs money and buzz and frees the band', () => {
    const s0 = settle(act(ready(300), A('tour', 'clubs', { weeks: 4, policy: 'steady' })));
    const s1 = act(s0, A('tour', 'abandon'));
    expect(s1.tour).toBeNull();
    expect(s1.flags.cancelledTour).toBeDefined();
    expect(s1.log.some((l) => l.text.startsWith('You pulled the plug'))).toBe(true);
  });

  it('a wild tour builds habits faster than a clean one', () => {
    let wild = 0;
    let clean = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const base = { ...ready(300), rng: seed };
      const w = act(base, A('tour', 'clubs', { weeks: 2, policy: 'wild' }));
      const c = act(base, A('tour', 'clubs', { weeks: 2, policy: 'clean' }));
      wild += w.members.reduce((a, m) => a + m.habit, 0);
      clean += c.members.reduce((a, m) => a + m.habit, 0);
    }
    expect(wild).toBeGreaterThan(clean);
  });

  it('touring wins fans and wears the band out', () => {
    const s0 = ready(1000);
    const s1 = act(s0, A('tour', 'theatres', { weeks: 3, policy: 'steady' }));
    expect(s1.tour!.people).toBeGreaterThan(1000);
    expect(s1.members.reduce((a, m) => a + m.energy, 0)).toBeLessThan(s0.members.reduce((a, m) => a + m.energy, 0));
  });

  it('only road situations happen on tour', () => {
    let s = act(ready(300), A('tour', 'clubs', { weeks: 4, policy: 'steady' }));
    for (let i = 0; i < 3 && s.tour; i++) {
      if (s.pending) expect(['rent', 'squat', 'tv', 'christmas', 'battle']).not.toContain(s.pending.def);
      s = act(settle(s), A('tour', 'continue:steady'));
    }
  });
});
