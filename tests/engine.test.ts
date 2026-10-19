import { describe, expect, it } from 'vitest';
import { act, canAct, dismissCandidates, fire, first, hire, newGame, rename, retire } from '../src/game/engine';
import { actionOptions, sellRecords } from '../src/game/actions';
import { EVENT_IDS, forceEvent, resolvePending, viewPending } from '../src/game/events';
import { chemistry, missingForGig, performance } from '../src/game/chemistry';
import { Rng } from '../src/game/rng';
import { nextGoal } from '../src/game/goals';
import { startTour } from '../src/game/tour';
import { catalogueWeek, pressRecord } from '../src/game/catalogue';
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
      expect(n).toBeLessThanOrEqual(t === 'gig' ? 8 : t === 'write' ? 10 : 6);
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

  it('a solo start, an all-women band and the difficulty levels all hold together', () => {
    const solo = newGame({ ...input, lineup: 'solo' });
    expect(solo.members).toHaveLength(1);
    expect(solo.log[0].text).toMatch(/nobody else yet/);
    expect(canAct(solo, A('gig', 'venue1'))).toBeTruthy();
    // A season of random play from a solo start must never throw.
    for (let seed = 1; seed <= 4; seed++) {
      let s = newGame({ ...input, seed, lineup: 'solo', difficulty: 'hard' });
      const r = new Rng(seed);
      for (let w = 0; w < 40 && !s.over; w++) {
        s = settle(s);
        if (s.over) break;
        const playable = types.flatMap((t) => actionOptions(s, t).filter((o) => !o.locked).map((o) => A(t, o.id, { role: r.pick(['guitar', 'bass', 'drums', 'keys'] as const) }))).filter((a) => !canAct(s, a));
        if (!playable.length) break;
        s = act(s, r.pick(playable));
        s = settle(s);
        if (s.candidates.length && !s.over && s.members.length < 6) s = hire(s, s.candidates[0].id);
      }
    }
    const women = newGame({ ...input, bandGender: 'female', seed: 3 });
    expect(women.members.slice(1).every((m) => m.gender === 'female')).toBe(true);
    const men = newGame({ ...input, bandGender: 'male', seed: 3 });
    expect(men.members.slice(1).every((m) => m.gender === 'male')).toBe(true);
    const easy = newGame({ ...input, difficulty: 'easy', seed: 5 });
    const hard = newGame({ ...input, difficulty: 'hard', seed: 5 });
    expect(easy.money).toBeGreaterThan(hard.money * 4);
    expect(easy.fans).toBeGreaterThan(hard.fans);
    expect(hard.wheels).toBe('bus');
    const ovr = (g: GameState) => g.members.slice(1).reduce((a, m) => a + overall(m), 0);
    expect(ovr(easy)).toBeGreaterThan(ovr(hard) + 15);
    expect(easy.members[0].skill).toBeGreaterThan(hard.members[0].skill);
    const duo = newGame({ ...input, lineup: 'duo', seed: 5 });
    expect(duo.members).toHaveLength(2);
    expect(duo.members[1].role).toBe('guitar');
  });

  it('rehearsing raises tightness and advances the week', () => {
    const s0 = newGame(input);
    const s1 = act(s0, A('rehearse', 'regular'));
    expect(s1.week).toBe(1);
    expect(s1.tightness).toBeGreaterThan(s0.tightness);
  });

  it('boot camp tightens more than a usual rehearsal', () => {
    let boot = 0; let reg = 0;
    for (let seed = 1; seed <= 6; seed++) { const s0 = newGame({ ...input, seed }); boot += act(s0, A('rehearse', 'bootcamp')).tightness; reg += act(s0, A('rehearse', 'regular')).tightness; }
    expect(boot).toBeGreaterThan(reg);
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

  it('covers, hired writers, publishers and the country house all produce songs, owned elsewhere where it matters', () => {
    const base = newGame(input);
    expect(actionOptions(base, 'write').map((o) => o.id)).toEqual(expect.arrayContaining(['cover']));
    expect(actionOptions(base, 'write').some((o) => o.id === 'hired' || o.id === 'retreat' || o.id === 'publisher')).toBe(false);
    const rich = { ...base, money: 50000, fans: 5000 };
    const ids = actionOptions(rich, 'write').map((o) => o.id);
    expect(ids).toEqual(expect.arrayContaining(['hired', 'retreat']));
    const hiredFee = actionOptions(rich, 'write').find((o) => o.id === 'hired')!.cost;
    expect(hiredFee).toBeGreaterThan(300);
    const c = act(base, A('write', 'cover'));
    expect(c.songs).toHaveLength(1);
    expect(c.songs[0].kind).toBe('cover');
    expect(c.songs[0].outside).toBe(true);
    const h = act(rich, A('write', 'hired'));
    expect(h.songs[0].kind).toBe('hired');
    expect(h.songs[0].quality).toBeGreaterThan(55);
    expect(h.money).toBeLessThanOrEqual(50000 - hiredFee);
    expect(h.money).toBeGreaterThan(50000 - hiredFee - 1500);
    const retreatCost = actionOptions(rich, 'write').find((o) => o.id === 'retreat')!.cost;
    const rr = act(rich, A('write', 'retreat'));
    expect(rr.money).toBeGreaterThan(50000 - retreatCost - 1500);
    expect(rr.money).toBeLessThanOrEqual(50000 - retreatCost);
    let wrote = 0;
    for (let seed = 1; seed <= 6; seed++) wrote += act({ ...newGame({ ...input, seed }), money: 50000, fans: 5000 }, A('write', 'retreat')).songs.length;
    expect(wrote).toBeGreaterThanOrEqual(12);
    const signed = { ...base };
    signed.contract = { label: 'imperial', signed: 10, terms: { advance: 3000, rate: 0.1, albums: 3, budget: 8000, smallPrint: { deductions: 0.2, tourRecoup: false, ownsName: false, promoRecoup: true } }, unrecouped: 3000, albumsDelivered: 0, owed: 0, reviewWeek: null, flops: 0, goodwill: 60, shaved: 0, statements: 0 };
    expect(actionOptions(signed, 'write').some((o) => o.id === 'publisher')).toBe(true);
    let got = 0;
    for (let seed = 1; seed <= 8; seed++) got += act({ ...signed, seed } as GameState, A('write', 'publisher')).songs.length;
    expect(got).toBeGreaterThanOrEqual(4);
  });

  it('former members are remembered', () => {
    const s = newGame(input);
    const gone = s.members[1];
    const r = fire(s, gone.id);
    expect(r.alumni).toHaveLength(1);
    expect(r.alumni[0]).toMatchObject({ name: gone.name, role: gone.role, how: 'fired', joined: 0 });
  });

  it('a member can be renamed, and no two members share a nickname', () => {
    const s = newGame(input);
    const r = rename(s, s.members[1].id, 'Dave "Hammer" Price');
    expect(r.members[1].name).toBe('Dave "Hammer" Price');
    expect(first(r.members[1])).toBe('Hammer');
    expect(r.log.at(-1)!.text).toMatch(/now known as Dave "Hammer" Price/);
    expect(() => rename(s, s.members[1].id, '   ')).toThrow();
    let dup = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const g = newGame({ ...input, seed });
      const nicks = g.members.map((m) => m.name.match(/"([^"]+)"/)?.[1]).filter(Boolean);
      if (new Set(nicks).size !== nicks.length) dup++;
    }
    expect(dup).toBe(0);
  });

  it('the clinic and the sanatorium cut habits, and the sanatorium builds tolerance', () => {
    const base = { ...newGame(input), money: 200000, fans: 5000 };
    base.members.forEach((m) => { m.habit = 70; m.hidden.stamina = 50; m.mood = 30; });
    const ids = actionOptions(base, 'rest').map((o) => o.id);
    expect(ids).toEqual(expect.arrayContaining(['clinic', 'sanatorium', 'yogi', 'shrink']));
    const c = act(base, A('rest', 'clinic'));
    expect(c.members.every((m) => m.habit <= 50)).toBe(true);
    const sa = act(base, A('rest', 'sanatorium'));
    expect(sa.members.every((m) => m.habit <= 5)).toBe(true);
    expect(sa.members.every((m) => m.hidden.stamina === 55)).toBe(true);
    const sh = act(base, A('rest', 'shrink'));
    expect(sh.members.every((m) => m.mood > 40)).toBe(true);
    const clean = newGame(input);
    clean.members.forEach((m) => { m.habit = 5; });
    expect(actionOptions(clean, 'rest').some((o) => o.id === 'clinic')).toBe(false);
  });

  it('changing direction changes the sound, costs fans and upsets the purists', () => {
    const s = { ...newGame(input), fans: 2000, buzz: 20 };
    s.flags = { ...s.flags, coreFans: 10 };
    s.members.forEach((m, i) => { if (i) { m.style = 'glam'; m.hidden.loyalty = 20; } });
    expect(actionOptions(s, 'write').some((o) => o.id === 'direction')).toBe(true);
    const r = act(s, { type: 'write', option: 'direction', genre: 'punk' });
    expect(r.members[0].style).toBe('punk');
    expect(r.fans).toBeLessThan(1850);
    expect(r.members.slice(1).every((m) => m.mood < s.members[1].mood)).toBe(true);
    expect(actionOptions(r, 'write').find((o) => o.id === 'direction')!.locked).toMatch(/six months/);
    const w = act(settle(r), A('write', 'jam'));
    expect(w.songs.every((x) => x.genre === 'punk')).toBe(true);
  });

  it('kit caps what a player can do, and the music shops raise it', async () => {
    const { kitFactor, kitGain } = await import('../src/game/kit');
    expect(kitFactor(100)).toBeCloseTo(1, 5);
    expect(kitFactor(16)).toBeLessThan(0.9);
    expect(kitFactor(100) - kitFactor(64)).toBeLessThan(kitFactor(36) - kitFactor(16));
    expect(kitGain(20, 500)).toBeGreaterThan(kitGain(70, 500));
    const s = newGame(input);
    expect(s.members.every((m) => (m.kit ?? 0) > 0)).toBe(true);
    const junk = structuredClone(s); junk.members.forEach((m) => { m.kit = 10; });
    const pro = structuredClone(s); pro.members.forEach((m) => { m.kit = 90; });
    expect(performance(pro)).toBeGreaterThan(performance(junk) + 5);
    // A proper venue supplies the backline; a pub does not.
    expect(performance({ ...junk, gear: 0 }, new Set(), 5000)).toBeGreaterThan(performance({ ...junk, gear: 0 }, new Set(), 100));
    const shopped = act({ ...junk, money: 2000 }, A('rehearse', 'shop'));
    expect(shopped.members.every((m) => (m.kit ?? 0) > 20)).toBe(true);
    expect(shopped.money).toBeLessThan(2000 - 200);
  });

  it('you can retire at the top, and only at the top', () => {
    const s = newGame(input);
    expect(() => retire(s)).toThrow(/rung/);
    const top = { ...s, fans: 120000, lastGigWeek: 5, songs: [1, 2, 3].map((i) => ({ title: `S${i}`, quality: 70, writer: 'p', kind: 'standard' as const, genre: 'glam' as const, released: true })) };
    top.releases = [{ id: 'a', kind: 'single', title: 'S1', quality: 70, appeal: 1, week: 1, sold: 900000, lastWeek: 0, peaks: { uk: 1, world: 1 } }];
    top.world = structuredClone(s.world);
    top.world.peaks = { london: 1, uk: 1, world: 1 };
    top.flags = { ...s.flags, toured_southeast: 1, toured_uk: 1, toured_europe: 1, toured_ukeurope: 1, toured_northamerica: 1, toured_world: 1, labelCalling: 1 };
    const r = retire(top);
    expect(r.over?.won).toBe(true);
    expect(r.over?.reason).toMatch(/walked away at the top/);
    expect(r.over?.reason).toMatch(/1 UK number one/);
    expect(r.milestones.at(-1)!.text).toMatch(/retired/);
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

  it('a single led by an outside song pays the band less per copy', () => {
    const own = withSongs(2, 60);
    const theirs = withSongs(2, 60);
    theirs.songs[0].outside = true;
    const a = settle({ ...act(own, A('release', 'single')), fans: 2000 });
    const b = settle({ ...act(theirs, A('release', 'single')), fans: 2000 });
    expect(b.releases[0].outside).toBe(true);
    expect(a.releases[0].outside).toBeUndefined();
    const ma = a.money; const mb = b.money;
    sellRecords(a, new Rng(1), () => 1); sellRecords(b, new Rng(1), () => 1);
    expect(a.money - ma).toBeGreaterThan(b.money - mb);
    expect(b.money - mb).toBeGreaterThan(0);
  });

  it('a label can lift a single without asking, and compilations do not count as delivering an album', () => {
    let lifted = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const s = withSongs(8, 60);
      s.contract = { label: 'goldtooth', signed: 10, terms: { advance: 3000, rate: 0.1, albums: 3, budget: 8000, smallPrint: { deductions: 0.2, tourRecoup: false, ownsName: false, promoRecoup: true } }, unrecouped: 3000, albumsDelivered: 0, owed: 0, reviewWeek: null, flops: 0, goodwill: 30, shaved: 0, statements: 0 };
      const a = act(s, A('release', 'album'));
      a.week += 10;
      catalogueWeek(a, new Rng(seed));
      if (a.releases.some((r) => r.kind === 'single')) { lifted++; expect(a.releases.find((r) => r.kind === 'single')!.label).toBe('goldtooth'); expect(a.songs.filter((x) => x.lifted)).toHaveLength(1); }
    }
    expect(lifted).toBeGreaterThan(0);
    expect(lifted).toBeLessThan(60);
    const s = withSongs(2);
    const rec = pressRecord(s, 'album', 'Hits', 60, 0.8, { comp: 'hits', label: 'imperial' });
    expect(rec.comp).toBe('hits');
    expect(s.releases).toContain(rec);
  });

  it('the ledger books gigs, merch and record sales by year', () => {
    let s = { ...withSongs(3), fans: 2000, buzz: 40 };
    s = settle(act(s, A('release', 'single')));
    s = settle(act(s, A('gig', 'venue1')));
    const y = s.ledger['1982'];
    expect(y.gigs).toBeGreaterThan(0);
    expect(y.merch).toBeGreaterThan(0);
    expect(y.singles).toBeGreaterThan(0);
    expect(y.u_single).toBeGreaterThan(0);
    expect(s.log.some((l) => /merch £\d+/.test(l.text))).toBe(true);
  });

  it('records remember their chart peaks, and the awards come round in December', async () => {
    const { contenders } = await import('../src/game/awards');
    let s = { ...withSongs(4, 85), fans: 60000, buzz: 60 };
    s = settle(act(s, A('release', 'single')));
    for (let i = 0; i < 3; i++) s = step(s, REST);
    expect(s.releases[0].peaks?.uk).toBeLessThanOrEqual(40);
    s.week = 49; s.releases[0].peaks = { uk: 1 }; s.flags.lastBigParty = 49; s.lastGigWeek = 48;
    const c = contenders(s);
    expect(c.some((x) => x.title.startsWith('Single of the Year'))).toBe(true);
    expect(c.some((x) => x.title === 'Best New Band')).toBe(true);
    let won = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const r = step({ ...s, world: structuredClone(s.world), rng: seed }, REST);
      expect(r.log.some((l) => /Awards night/.test(l.text))).toBe(true);
      if (r.awards.length) won++;
    }
    expect(won).toBeGreaterThan(0);
  });

  it('records get certified as they sell, and a fan club pays weekly', async () => {
    const { certFor } = await import('../src/game/certs');
    const s = withSongs(2);
    const r = { id: 'x', kind: 'single' as const, title: 'X', quality: 60, appeal: 1, week: 0, sold: 260000, lastWeek: 0 };
    expect(certFor(r)).toBe('silver');
    expect(certFor({ ...r, sold: 1200000 })).toBe('platinum');
    expect(certFor({ ...r, kind: 'album', sold: 120000 })).toBe('gold');
    s.releases = [r];
    const after = act(s, A('rest', 'sleep'));
    expect(after.releases[0].cert).toBe('silver');
    expect(after.log.some((l) => /certified Silver/.test(l.text))).toBe(true);
    let c = { ...newGame(input), fans: 10000, money: 1000 };
    c.flags = { ...c.flags, fanClub: 0 };
    const paid = act(c, A('rest', 'sleep'));
    expect(paid.ledger['1982'].fanclub).toBeGreaterThan(50);
    expect(paid.ledger['1982'].fanclub).toBeLessThan(200);
  });

  it('a demo tape sells at gigs', () => {
    let s = settle(act(withSongs(3), A('release', 'demo')));
    s = act({ ...s, fans: 200 }, A('gig', 'venue1'));
    expect(s.releases[0].sold).toBeGreaterThan(0);
  });

  it('a well-loved single can enter the National Top 40, a milestone that does not end the game', () => {
    let s = { ...withSongs(4, 80), fans: 60000, buzz: 60 };
    s = settle(act(s, A('release', 'single')));
    for (let i = 0; i < 6 && !s.over; i++) s = step(s, REST);
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

  const signed = (s: GameState) => {
    s.contract = { label: 'imperial', signed: 10, terms: { advance: 3000, rate: 0.1, albums: 3, budget: 8000, smallPrint: { deductions: 0.2, tourRecoup: false, ownsName: false, promoRecoup: true } }, unrecouped: 3000, albumsDelivered: 0, owed: 0, reviewWeek: null, flops: 0, goodwill: 60, shaved: 0, statements: 0 };
  };
  /** Per-event setup for situations that need a later year, a season or a follow-up flag. */
  const later = (s: GameState, week: number) => { s.week = week; s.lastGigWeek = week - 1; s.flags.lastBigParty = week; };
  const SETUP: Record<string, (s: GameState) => void> = {
    transit: (s) => { s.wheels = 'bus'; s.flags.noVan = 1; },
    wheels_upgrade: (s) => { s.fans = 1000; s.money = 10000; },
    guru: (s) => later(s, 153),
    makeover: (s) => later(s, 153),
    benefit: (s) => later(s, 153),
    video_shoot: (s) => { later(s, 153); s.releases.push({ id: 'sg', kind: 'single', title: 'Hit', quality: 60, appeal: 1, week: 153, sold: 0, lastWeek: 0 }); },
    album_producer: (s) => { s.songs = Array.from({ length: 8 }, (_, i) => ({ title: `A${i}`, quality: 50, writer: 'p', kind: 'standard' as const, genre: 'glam' as const, released: false })); },
    eccentric_purchase: (s) => { s.money = 20000; },
    court: (s) => { s.fans = 9000; },
    crowd_riot: (s) => { s.fans = 5000; },
    venue_burned: (s) => { s.fans = 200; },
    xmas_single: (s) => later(s, 95),
    manager_clause: (s) => { s.manager = { name: 'Clive', honesty: 20, clout: 30, cut: 0.2, signed: 40, read: false, taken: 0 }; },
    ar_single: (s) => { signed(s); },
    ar_image: (s) => { signed(s); },
    ar_session: (s) => { signed(s); s.members.forEach((m) => { m.skill = 50; }); },
    label_scandal: (s) => { signed(s); s.flags.kissTell = s.week; },
    after_show: (s) => { s.lastGigWeek = s.week; },
    band_romance: (s) => { const [a, b] = s.members; s.affinity[[a.id, b.id].sort().join('|')] = 80; },
    band_breakup: (s) => { const [, a, b] = s.members; s.flags[`romance:${[a.id, b.id].sort().join('|')}`] = s.week - 20; },
    double_booked: (s) => { s.flags.fling = s.week - 2; },
    kiss_and_tell: (s) => { s.flags.fling = s.week - 2; },
    road_fling: (s) => { s.flags.lastBigParty = s.week; },
    hotel_floor: (s) => { s.fans = 4000; },
    rock_doctor: (s) => { s.fans = 6000; },
    guitar_hero_jam: (s) => { s.fans = 9000; },
    intervention: (s) => { s.members[1].habit = 80; },
    hotel_raid: (s) => { s.fans = 4000; },
    polaroids: (s) => { s.fans = 12000; s.flags.fling = s.week - 2; },
    the_muse: (s) => { s.fans = 3000; },
    credit_fight: (s) => { s.releases.push({ id: 'hit', kind: 'single', title: 'S1', quality: 60, appeal: 1, week: s.week - 1, sold: 30000, lastWeek: 0 }); },
    stage_dive: (s) => { s.fans = 2000; s.lastGigWeek = s.week; },
    label_compilation: (s) => { s.fans = 4000; s.songs.forEach((x) => { x.released = true; }); s.releases.push({ id: 'alb', kind: 'album', title: 'S1', quality: 60, appeal: 1, week: 1, sold: 5000, lastWeek: 0, label: 'imperial', royalty: 0.3 }); s.week = 60; s.lastGigWeek = 59; s.flags.lastBigParty = 60; },
    bootleg_lp: (s) => { s.fans = 6000; s.lastGigWeek = s.week - 1; s.songs[0].released = true; },
    last_chance: (s) => { s.flags.lastChanceOpen = 1; s.money = -300; },
    fan_club_start: (s) => { s.fans = 1500; },
    endorsement: (s) => { s.fans = 20000; },
    fan_club_books: (s) => { s.fans = 4000; s.flags.fanClub = 0; s.week = 60; s.lastGigWeek = 59; s.flags.lastBigParty = 60; },
    shark_heavies: (s) => { s.flags.heaviesOpen = 1; s.flags.shark = 900; s.gear = 1; },
  };

  it('every event can fire and every response resolves cleanly', () => {
    for (const id of EVENT_IDS) {
      let tried = false;
      for (let seed = 1; seed <= 10 && !tried; seed++) {
        const s = richState(seed);
        SETUP[id]?.(s);
        if (TOUR_EVENT_IDS.includes(id) || ['bus_crash', 'crowd_riot', 'member_arrested_abroad', 'hotel_floor', 'hotel_raid'].includes(id)) { startTour(s, new Rng(seed), id === 'tour_japan_gifts' ? 'japan' : 'america', 6, 'steady'); s.tour!.week = 2; s.members.forEach((m, i) => { if (i === 1) m.mood = 20; m.outWeeks = 0; }); }
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
    for (const c of ['london', 'uk', 'albums', 'us', 'europe', 'world'] as const) {
      expect(s.world.charts[c]).toHaveLength(40);
      expect(s.world.charts[c].map((e) => e.pos)).toEqual(Array.from({ length: 40 }, (_, i) => i + 1));
    }
  });

  it('a selling album enters the album chart, not the singles chart', () => {
    let s = { ...newGame(input), money: 5000, fans: 20000, buzz: 60 };
    s.songs = Array.from({ length: 8 }, (_, i) => ({ title: `Album Song ${i}`, quality: 75, writer: 'p', kind: 'standard' as const, genre: 'glam' as const, released: false }));
    s = settle(act(s, A('release', 'album')));
    for (let i = 0; i < 3; i++) s = step(s, REST);
    expect(s.world.charts.albums.some((e) => e.isPlayer)).toBe(true);
    expect(s.world.charts.uk.some((e) => e.isPlayer && e.title === s.releases[0].title)).toBe(false);
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

  it('every record entry names a label, London names Unsigned, and America favours Americans', () => {
    const s = act({ ...newGame(input), fans: 900, buzz: 60 }, REST);
    for (const c of ['uk', 'albums', 'us', 'europe', 'world'] as const) for (const e of s.world.charts[c]) expect(e.label).toBeTruthy();
    expect(s.world.charts.london.find((e) => e.isPlayer)!.label).toBe('Unsigned');
    const us = s.world.charts.us.slice(0, 20).filter((e) => e.origin === 'US').length;
    const uk = s.world.charts.uk.slice(0, 20).filter((e) => e.origin === 'US').length;
    expect(us).toBeGreaterThan(uk);
  });

  it('a US hit needs reach: the same single charts at home but not in America without a label or a tour', () => {
    let s = { ...newGame(input), money: 5000, fans: 60000, buzz: 60 };
    s.songs = Array.from({ length: 4 }, (_, i) => ({ title: `Hit ${i}`, quality: 85, writer: 'p', kind: 'standard' as const, genre: 'glam' as const, released: false }));
    s = settle(act(s, A('release', 'single')));
    for (let i = 0; i < 4; i++) s = step(s, REST);
    expect(s.world.charts.uk.some((e) => e.isPlayer)).toBe(true);
    expect(s.world.charts.us.some((e) => e.isPlayer)).toBe(false);
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
    g.skill = 40; g.hidden.potential = 45; g.hidden.loyalty = 99;
    let after = g;
    for (let i = 0; i < 40; i++) {
      s = step(s, A('rehearse', i % 2 ? 'coach' : 'regular'));
      const m = s.members.find((x) => x.id === g.id);
      if (!m) break;
      after = m;
    }
    expect(after.skill).toBeLessThanOrEqual(45);
    expect(after.skill).toBeGreaterThanOrEqual(43);
  });

  it('a raw talent with headroom keeps improving', () => {
    let s = { ...newGame(input), money: 10000 };
    const g = s.members[1];
    g.skill = 40; g.hidden.potential = 85; g.hidden.loyalty = 99; g.hidden.ego = 20;
    let skill = g.skill;
    for (let i = 0; i < 40; i++) {
      s = step(s, A('rehearse', 'coach'));
      const m = s.members.find((x) => x.id === g.id);
      if (!m) break;
      skill = m.skill;
    }
    expect(skill).toBeGreaterThan(55);
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
      s = step({ ...s, money: 1000 }, REST); // habits cost money; keep the band solvent for the test
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

  it('better wheels and better beds keep the band fresher, and cost more', () => {
    const run = (wheels: GameState['wheels'], lodging: 'floors' | 'bnb' | 'hotels' | 'suites') => {
      let s = { ...ready(300), wheels };
      s.members.forEach((m) => { m.energy = 80; m.hidden.stamina = 50; });
      s = settle(act(s, A('tour', 'clubs', { weeks: 3, policy: 'steady', lodging })));
      return { energy: s.members.reduce((a, m) => a + m.energy, 0) / s.members.length, money: s.money, lodging: s.tour!.lodging };
    };
    const rough = run('bus', 'floors');
    const plain = run('van', 'bnb');
    const posh = run('coach', 'suites');
    expect(rough.lodging).toBe('floors');
    expect(plain.energy).toBeGreaterThan(rough.energy);
    expect(posh.energy).toBeGreaterThan(plain.energy);
    expect(posh.money).toBeLessThan(plain.money);
    expect(plain.money).toBeLessThan(rough.money + 1);
  });

  it('arena tours come with a hired bus, and the van only dies now and then', async () => {
    const { tourWheels, nextWheels } = await import('../src/game/wheels');
    const s = newGame(input);
    expect(tourWheels({ ...s, wheels: 'van' }, 'arenas')).toEqual({ wheels: 'coach', hired: true });
    expect(tourWheels({ ...s, wheels: 'jet' }, 'arenas')).toEqual({ wheels: 'jet', hired: false });
    expect(nextWheels({ ...s, wheels: 'bus' })).toBeNull();
    expect(nextWheels({ ...s, wheels: 'van' })).toBe('splitter');
    expect(nextWheels({ ...s, wheels: 'jet' })).toBeNull();
    const coach = { ...s, wheels: 'coach' as const, lastGigWeek: 1 };
    expect(() => forceEvent(coach, 'van')).toThrow();
    const van = { ...s, wheels: 'van' as const, lastGigWeek: 1, flags: { ...s.flags, vanDied: s.week - 10 } };
    expect(() => forceEvent(van, 'van')).toThrow();
  });

  it('a finished tour goes in the tour history, and Japan buys merch', () => {
    let s = ready(300);
    s = settle(act(s, A('tour', 'clubs', { weeks: 2, policy: 'steady' })));
    for (let i = 0; i < 3 && s.tour; i++) s = settle(act(s, A('tour', 'continue:steady')));
    expect(s.tour).toBeNull();
    expect(s.tours).toHaveLength(1);
    expect(s.tours[0]).toMatchObject({ tier: 'clubs', weeks: 2, abandoned: false });
    expect(s.tours[0].gigs).toBeGreaterThan(5);
    let j: GameState = { ...ready(20000, 100000), buzz: 60, wheels: 'coach' };
    j.world.peaks.uk = 5;
    expect(actionOptions(j, 'tour').find((o) => o.id === 'japan')!.locked).toBeUndefined();
    j = settle(act(j, A('tour', 'japan', { weeks: 2, policy: 'steady' })));
    expect(j.tour!.route.every((x) => x.country === 'Japan')).toBe(true);
    expect(j.ledger['1982'].merch).toBeGreaterThan(2000);
  });

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
    const played = act(ready(300), A('tour', 'clubs', { weeks: 3, policy: 'steady' }));
    const s = settle(played);
    expect(s.tour).not.toBeNull();
    expect(s.tour!.week).toBe(1);
    expect(s.tour!.gigsPlayed).toBeGreaterThanOrEqual(4);
    expect(s.tour!.route).toHaveLength(15);
    expect(canAct(s, REST)).toMatch(/on tour/);
    expect(played.scene!.beats.filter((b) => /people/.test(b.text)).length).toBeGreaterThanOrEqual(5);
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

describe('report headline', () => {
  it('rehearsal headline shows the tightness change, with the new level underneath', () => {
    const s0 = newGame({ name: 'X', instrument: 'none', bandName: 'B', background: 'artschool', style: 'glam', seed: 5 });
    const s1 = act(s0, { type: 'rehearse', option: 'regular' });
    const t = s1.scene?.stats?.find((x) => x.label === 'Tightness');
    // Change plus starting level gives the level shown underneath (events later in the week may move it again).
    expect(Number(t!.sub!.replace('now ', '')) - Number(t!.value)).toBe(s0.tightness);
  });
});

describe('chemistry links', () => {
  it('rates every pair, and a feud turns a link red', async () => {
    const { chemistryLinks, addAffinity } = await import('../src/game/chemistry');
    const s = newGame({ name: 'X', instrument: 'none', bandName: 'B', background: 'artschool', style: 'glam', seed: 9 });
    const { links, members } = chemistryLinks(s);
    expect(links).toHaveLength((s.members.length * (s.members.length - 1)) / 2);
    expect(members.every((m) => m.dots >= 0 && m.dots <= 3)).toBe(true);
    const [a, b] = s.members;
    addAffinity(s, a.id, b.id, -200);
    const l = chemistryLinks(s).links.find((x) => [x.a, x.b].includes(a.id) && [x.a, x.b].includes(b.id))!;
    expect(l.tone).toBe('bad');
  });
});

describe('chemistry fog', () => {
  it('ego penalty is shown only for egos you have a feel for', async () => {
    const { chemistry } = await import('../src/game/chemistry');
    const s = newGame({ name: 'X', instrument: 'none', bandName: 'B', background: 'artschool', style: 'glam', seed: 4 });
    const mates = s.members.filter((m) => !m.isPlayer);
    for (const m of s.members) m.hidden.ego = 10;
    for (const m of mates.slice(0, 2)) { m.hidden.ego = 90; m.known.ego = 0; }
    expect(chemistry(s).egoPenalty).toBeGreaterThan(0);
    expect(chemistry(s).knownEgoPenalty).toBe(0);
    for (const m of mates.slice(0, 2)) m.known.ego = 1;
    expect(chemistry(s).knownEgoPenalty).toBe(chemistry(s).egoPenalty);
  });
});

describe('fans', () => {
  it('start with a few core fans who never drift away', () => {
    let s = newGame({ name: 'X', instrument: 'none', bandName: 'B', background: 'artschool', style: 'glam', seed: 12 });
    const core = s.flags.coreFans;
    expect(core).toBeGreaterThanOrEqual(8);
    expect(s.fans).toBe(core);
    s = { ...s, fans: core + 200 };
    for (let i = 0; i < 30 && !s.over; i++) {
      while (s.pending) s = resolvePending(s, viewPending(s)!.options.findIndex((o) => !o.locked));
      s = act(s, { type: 'rest', option: 'sleep' });
    }
    expect(s.log.some((l) => /Casual fans are finding other bands/.test(l.text))).toBe(true);
    expect(s.fans).toBeGreaterThanOrEqual(core);
  });
});

describe('personal variance', () => {
  it('the same week out affects band members differently', () => {
    const s0 = newGame({ name: 'X', instrument: 'none', bandName: 'B', background: 'artschool', style: 'glam', seed: 21 });
    for (const m of s0.members) { m.energy = 20; m.mood = 40; }
    const s1 = act(s0, { type: 'rest', option: 'seaside' });
    const gains = s1.members.map((m) => m.energy);
    expect(new Set(gains).size).toBeGreaterThan(1);
  });
});

describe('scene start figures', () => {
  it('a week remembers the band figures it started from', () => {
    const s0 = newGame({ name: 'X', instrument: 'none', bandName: 'B', background: 'artschool', style: 'glam', seed: 2 });
    const s1 = act(s0, { type: 'rehearse', option: 'regular' });
    expect(s1.scene!.start).toEqual({ money: s0.money, fans: s0.fans, buzz: s0.buzz, tightness: s0.tightness });
  });
});

describe('band introductions', () => {
  it('the first week introduces each mate from their card, without hidden traits', async () => {
    const { introduce } = await import('../src/game/characters');
    const s = newGame({ name: 'X', instrument: 'none', bandName: 'B', background: 'artschool', style: 'glam', seed: 6 });
    const mates = s.members.filter((m) => !m.isPlayer);
    const lines: string[] = [];
    for (const m of mates) {
      const line = introduce(m, lines);
      lines.push(line);
      expect(line).toBe(introduce(m, lines.slice(0, -1)));
      expect(line).not.toMatch(/ego|loyal|reliab|vice|stamina|potential/i);
      expect(s.scene!.beats.some((b) => b.text === line)).toBe(true);
    }
  });
});

describe('romance and scandal', () => {
  const base = () => {
    const s = newGame({ name: 'X', instrument: 'none', bandName: 'B', background: 'artschool', style: 'glam', seed: 31 });
    return { ...s, week: 40, fans: 400, money: 1000 };
  };
  const pick = (s: GameState, re: RegExp) => viewPending(s)!.options.findIndex((o) => re.test(o.label));

  it('a blessed band romance makes a couple, and a break-up turns their link red', async () => {
    const { couple } = await import('../src/game/romanceEvents');
    const { chemistryLinks } = await import('../src/game/chemistry');
    const s0 = base();
    const [, a, b] = s0.members;
    s0.affinity[[a.id, b.id].sort().join('|')] = 90;
    let s = resolvePending(forceEvent(s0, 'band_romance'), 0);
    expect(couple(s)?.map((m) => m.id).sort()).toEqual([a.id, b.id].sort());
    s = { ...s, week: s.week + 10 };
    let forced: GameState | null = null;
    for (let i = 0; i < 20 && !forced; i++) { try { forced = forceEvent({ ...s, rng: s.rng + i }, 'band_breakup'); } catch { /* coin flip */ } }
    s = resolvePending(forced!, pick(forced!, /Keep calm/));
    expect(couple(s)).toBeNull();
    const link = chemistryLinks(s).links.find((l) => [l.a, l.b].sort().join() === [a.id, b.id].sort().join())!;
    expect(link.tone).toBe('bad');
  });

  it('after a fling the tabloids can come calling, and paying them off costs money', () => {
    const s0 = { ...base(), lastGigWeek: 40 };
    const s1 = resolvePending(forceEvent(s0, 'after_show'), 2);
    expect(s1.flags.fling).toBe(40);
    const story = forceEvent(s1, 'kiss_and_tell');
    const paid = resolvePending(story, pick(story, /Pay/));
    expect(paid.money).toBe(story.money - 200);
  });

  it('a wild tour policy brings more road flings than a clean one', async () => {
    const { ROAD_ROMANCE } = await import('../src/game/romanceEvents');
    const count = (policy: 'wild' | 'clean') => {
      let n = 0;
      for (let seed = 1; seed <= 200; seed++) {
        const s = base();
        startTour(s, new Rng(seed), 'clubs', 3, policy);
        if (ROAD_ROMANCE[0].when(s, new Rng(seed * 7))) n++;
      }
      return n;
    };
    expect(count('wild')).toBeGreaterThan(count('clean') * 3);
  });
});

describe('economy', () => {
  it('fame, habits and spare cash all cost money every week', async () => {
    const { upkeep, viceBill, splurge } = await import('../src/game/engine');
    const s = newGame({ name: 'X', instrument: 'none', bandName: 'B', background: 'artschool', style: 'glam', seed: 8 });
    for (const m of s.members) m.habit = 10;
    const base = upkeep(s);
    expect(upkeep({ ...s, fans: 100000 })).toBe(base + 2000);
    expect(splurge({ ...s, money: 70000 })).toBe(1000);
    for (const m of s.members) m.habit = 70;
    expect(viceBill(s)).toBe(Math.round(40 * s.members.length * 0.5));
  });

  it('the Revenue takes 40% of the year\'s gain above the allowance in April', () => {
    let s = newGame({ name: 'X', instrument: 'none', bandName: 'B', background: 'artschool', style: 'glam', seed: 8 });
    s = { ...s, week: 13, money: 15000, flags: { ...s.flags, taxBase: 0 } };
    s.members.forEach((m) => { m.habit = 0; });
    const after = act(s, { type: 'rest', option: 'sleep' });
    expect(after.log.some((l) => /The tax year is over/.test(l.text))).toBe(true);
    expect(after.money).toBeLessThan(15000 - 3000);
  });

  it('skint bands survive on shifts for a while, but months without real money get them evicted', () => {
    let s = newGame({ name: 'X', instrument: 'none', bandName: 'B', background: 'artschool', style: 'glam', seed: 8 });
    s = { ...s, money: 20 };
    s.members.forEach((m) => { m.habit = 0; });
    for (let i = 0; i < 15; i++) { s = { ...s, pending: null }; s = act(s, { type: 'rest', option: 'sleep' }); }
    expect(s.over).toBeNull();
    expect(s.log.some((l) => /final warning/.test(l.text))).toBe(true);
    for (let i = 0; i < 5 && s.pending?.def !== 'last_chance'; i++) s = act({ ...s, pending: null }, { type: 'rest', option: 'sleep' });
    expect(s.over).toBeNull();
    expect(s.pending?.def).toBe('last_chance');
    // Already used the last chance: next time the locks change.
    s = { ...s, flags: { ...s.flags, lastChanceOpen: 0 } };
    for (let i = 0; i < 4 && !s.over; i++) s = act({ ...s, pending: null, money: -5000 }, { type: 'rest', option: 'sleep' });
    expect(s.over?.won).toBe(false);
  });

  it('the last chance: every way out clears the overdraft, and each has a price', () => {
    const broke = () => {
      const s = newGame({ name: 'X', instrument: 'none', bandName: 'B', background: 'artschool', style: 'glam', seed: 8 });
      s.gear = 2;
      return act({ ...s, money: -700, fans: 1000 }, { type: 'rest', option: 'sleep' });
    };
    const s = broke();
    expect(s.over).toBeNull();
    expect(s.pending?.def).toBe('last_chance');
    const view = viewPending(s)!;
    expect(view.options.length).toBe(5);
    const labels = view.options.map((o) => o.label);
    view.options.forEach((o, i) => {
      if (o.locked) return;
      const after = resolvePending(s, i);
      expect(after.money, labels[i]).toBeGreaterThan(-350);
      const next = act(after, { type: 'rest', option: 'sleep' });
      expect(next.over, labels[i]).toBeNull();
    });
    const loan = resolvePending(s, 0);
    expect(loan.flags.shark).toBeGreaterThan(loan.money);
    const kept = resolvePending(s, 1);
    expect(kept.flags.patron).toBeDefined();
    const sold = resolvePending(s, 2);
    expect(sold.gear).toBe(0);
    expect(sold.flags.noVan).toBe(1);
    const signed = resolvePending(s, 3);
    expect(signed.contract?.terms.smallPrint.ownsName).toBe(true);
    const grind = resolvePending(s, 4);
    expect(grind.members.every((m) => m.energy < 75)).toBe(true);
  });

  it('Big Tony collects half of everything, then sends the lads, then a lorry', () => {
    let s = newGame({ name: 'X', instrument: 'none', bandName: 'B', background: 'artschool', style: 'glam', seed: 8 });
    s = act({ ...s, money: -700, fans: 1000, gear: 2 }, { type: 'rest', option: 'sleep' });
    s = resolvePending(s, 0);
    const debt0 = s.flags.shark;
    s = act({ ...s, money: 2000 }, { type: 'rest', option: 'sleep' });
    expect(s.money).toBeLessThan(1100);
    expect(s.flags.shark).toBeLessThan(debt0);
    expect(s.log.some((l) => /collector took/.test(l.text))).toBe(true);
    // Nothing coming in: after twelve weeks the lads call round.
    for (let i = 0; i < 13 && s.pending?.def !== 'shark_heavies'; i++) s = act({ ...s, pending: null, money: 120 }, { type: 'rest', option: 'sleep' });
    expect(s.pending?.def).toBe('shark_heavies');
    const v = viewPending(s)!;
    expect(v.options[0].locked).toBeTruthy();
    const beaten = resolvePending(s, 2);
    expect(beaten.members[0].outWeeks).toBe(2);
    let t = beaten;
    for (let i = 0; i < 13 && t.pending?.def !== 'shark_heavies'; i++) t = act({ ...t, pending: null, money: 120 }, { type: 'rest', option: 'sleep' });
    expect(t.pending?.def).toBe('shark_heavies');
    t = resolvePending(t, 2);
    for (let i = 0; i < 14 && !t.over; i++) t = act({ ...t, pending: null, money: 120 }, { type: 'rest', option: 'sleep' });
    expect(t.over?.reason).toMatch(/lorry/);
  });
});

describe('charts at the start', () => {
  it('entries have different histories, and the London chart moves from week to week', () => {
    const s0 = newGame({ name: 'X', instrument: 'none', bandName: 'B', background: 'artschool', style: 'glam', seed: 14 });
    for (const id of ['london', 'uk', 'albums'] as const) expect(new Set(s0.world.charts[id].map((e) => e.weeks)).size).toBeGreaterThan(3);
    let s = s0;
    for (let i = 0; i < 3; i++) s = act({ ...s, pending: null }, { type: 'rest', option: 'sleep' });
    const moved = s.world.charts.london.filter((e) => e.last !== null && e.last !== e.pos).length;
    expect(moved).toBeGreaterThan(5);
  });
});

describe('rock-star spending', () => {
  const rich = (money: number) => ({ ...newGame({ name: 'X', instrument: 'none', bandName: 'B', background: 'artschool', style: 'glam', seed: 17 }), money });
  it('luxury options unlock with the bank balance', () => {
    expect(actionOptions(rich(500), 'rest').some((o) => o.id === 'bahamas')).toBe(false);
    expect(actionOptions(rich(6000), 'rest').find((o) => o.id === 'bahamas')?.locked).toMatch(/Needs/);
    expect(actionOptions(rich(12000), 'rest').find((o) => o.id === 'bahamas')?.locked).toBeUndefined();
    expect(actionOptions(rich(25000), 'party').find((o) => o.id === 'yacht')?.locked).toBeUndefined();
  });
  it('the Bahamas costs a fortune and brings the band back new', () => {
    const s0 = rich(12000);
    for (const m of s0.members) { m.energy = 20; m.mood = 30; }
    const s1 = act(s0, { type: 'rest', option: 'bahamas' });
    expect(s1.money).toBeLessThan(12000 - 2900);
    expect(s1.members.every((m) => m.energy >= 90 && m.mood > 50)).toBe(true);
  });
  it('the Ibiza villa writes songs', () => {
    const s1 = act(rich(50000), { type: 'rest', option: 'retreat' });
    expect(s1.songs.length).toBe(2);
  });
});

describe('tour venues', () => {
  it('European clubs are named in the local language', () => {
    const s = { ...newGame({ name: 'X', instrument: 'none', bandName: 'B', background: 'artschool', style: 'glam', seed: 3 }), fans: 5000, buzz: 60, money: 30000, releases: [{ id: 'r', kind: 'single' as const, title: 'T', quality: 60, appeal: 1, week: 0, sold: 0, lastWeek: 0 }] };
    startTour(s, new Rng(9), 'europe', 6, 'steady');
    for (const stop of s.tour!.route) {
      const name = stop.venue.split(',')[0];
      if (stop.country === 'Italy') expect(name).not.toMatch(/Klubi|Klubben|Rockhaus|De Kelder|Le /);
      if (stop.country === 'France') expect(name).not.toMatch(/Klubi|Rockhaus|Teatro|Sala/);
      if (stop.country === 'Finland') expect(name).toMatch(/Klubi|Tavastia|Kellari|Rockkeidas|Tehdas/);
    }
  });
});

describe('lightning', () => {
  const base = () => newGame({ name: 'X', instrument: 'none', bandName: 'B', background: 'artschool', style: 'glam', seed: 5 });
  it('masterpieces are rare, better with a great writer, and make a milestone', async () => {
    const { masterpieceOdds } = await import('../src/game/fate');
    const s = base();
    const w = s.members[0];
    w.writing = 20; const low = masterpieceOdds(s, w);
    w.writing = 95; w.mood = 90; const high = masterpieceOdds(s, w);
    expect(low).toBeLessThan(0.03);
    expect(high).toBeGreaterThan(low);
    expect(high).toBeLessThanOrEqual(0.06);
    let hits = 0;
    for (let seed = 1; seed <= 150; seed++) {
      let g: GameState = { ...newGame({ name: 'X', instrument: 'none', bandName: 'B', background: 'artschool', style: 'glam', seed }), pending: null };
      g.members.forEach((m) => { m.writing = 90; m.mood = 90; });
      g = act(g, { type: 'write', option: 'jam' });
      if (g.flags.masterpieces) { hits++; expect(g.milestones.some((m) => /The one/.test(m.text))).toBe(true); expect(g.songs.some((x) => x.quality >= 92)).toBe(true); }
    }
    expect(hits).toBeGreaterThan(0);
    expect(hits).toBeLessThan(40);
  });

  it('a perfect night can become legendary, and some nights the club catches fire', async () => {
    const { gigFate } = await import('../src/game/fate');
    const s = base();
    let legends = 0, disasters = 0;
    for (let i = 1; i <= 400; i++) {
      const f = gigFate(s, new Rng(i), i % 2 ? 105 : 60, 150);
      if (f?.kind === 'legend') legends++;
      if (f?.kind === 'disaster') disasters++;
    }
    expect(legends).toBeGreaterThan(3);
    expect(legends).toBeLessThan(30);
    const jaded = { ...s, flags: { ...s.flags, legendaryGigs: 20 } };
    let later = 0;
    for (let i = 1; i <= 400; i++) if (gigFate(jaded, new Rng(i), 105, 150)?.kind === 'legend') later++;
    expect(later).toBeLessThan(legends);
    expect(disasters).toBeGreaterThan(3);
    expect(disasters).toBeLessThan(40);
  });
});

describe('singles from the album', () => {
  it('an album track can be lifted as a single, best first, each only once', () => {
    let s: GameState = { ...newGame({ name: 'X', instrument: 'none', bandName: 'B', background: 'artschool', style: 'glam', seed: 7 }), money: 5000, pending: null };
    s.songs = Array.from({ length: 8 }, (_, i) => ({ title: `T${i}`, quality: 50 + i * 5, writer: 'p', kind: 'standard' as const, genre: 'glam' as const, released: false }));
    s = act(s, { type: 'release', option: 'album' });
    expect(actionOptions({ ...s, pending: null }, 'release').some((o) => o.id === 'lift')).toBe(true);
    s = act({ ...s, pending: null }, { type: 'release', option: 'lift' });
    expect(s.releases.at(-1)!.kind).toBe('single');
    expect(s.releases.at(-1)!.title).toBe('T7');
    s = act({ ...s, pending: null }, { type: 'release', option: 'lift' });
    expect(s.releases.at(-1)!.title).toBe('T6');
    expect(s.songs.filter((x) => x.lifted).length).toBe(2);
  });
});

describe('finishing a tour in one go', () => {
  it('plays the remaining weeks, stops for a decision, and leaves a summary', async () => {
    const { finishTour } = await import('../src/game/engine');
    let s: GameState = { ...newGame({ name: 'X', instrument: 'none', bandName: 'B', background: 'artschool', style: 'glam', seed: 11 }), fans: 600, money: 5000, buzz: 30, pending: null, releases: [{ id: 'r', kind: 'single', title: 'T', quality: 60, appeal: 1, week: 0, sold: 0, lastWeek: 0 }] };
    s = act(s, { type: 'tour', option: 'clubs', weeks: 4, policy: 'steady' });
    while (s.pending) s = resolvePending(s, viewPending(s)!.options.findIndex((o) => !o.locked));
    const w0 = s.week;
    let guard = 0;
    const titles: string[] = [];
    while (s.tour && guard++ < 10) {
      s = finishTour(s, 'steady');
      titles.push(s.scene!.title);
      while (s.pending) s = resolvePending(s, viewPending(s)!.options.findIndex((o) => !o.locked));
    }
    expect(s.tour).toBeNull();
    expect(s.week).toBe(w0 + 3);
    expect(titles.some((t) => /weeks/.test(t))).toBe(true);
  });
});

describe('fame, inspiration and constitution', () => {
  const base = () => newGame({ name: 'X', instrument: 'none', bandName: 'B', background: 'artschool', style: 'glam', seed: 19 });
  it('a famous band is offered a secret pub gig instead of the open mic and the small rooms', () => {
    const small = actionOptions(base(), 'gig').map((o) => o.id);
    expect(small).toContain('paytoplay');
    const big = actionOptions({ ...base(), fans: 50000 }, 'gig');
    expect(big.find((o) => o.id === 'openmic')!.label).toMatch(/Secret gig/);
    expect(big.some((o) => o.id === 'paytoplay' || o.id === 'venue0')).toBe(false);
    expect(actionOptions({ ...base(), money: 200000 }, 'party').some((o) => o.id === 'cans')).toBe(false);
  });
  it('a rested, happy band is inspired; a wasted one is not', async () => {
    const { inspiration } = await import('../src/game/actions');
    const s = base();
    s.members.forEach((m) => { m.mood = 90; m.energy = 90; m.habit = 5; });
    expect(inspiration(s).bonus).toBeGreaterThanOrEqual(5);
    s.members.forEach((m) => { m.habit = 50; });
    const chem = inspiration(s).bonus;
    expect(chem).toBeGreaterThan(5);
    s.members.forEach((m) => { m.habit = 80; m.mood = 30; m.energy = 25; });
    expect(inspiration(s).bonus).toBeLessThan(0);
  });
  it('stamina decides how a habit shows on stage', async () => {
    const { performance } = await import('../src/game/chemistry');
    expect(performance).toBeDefined();
    const s = base();
    s.members.forEach((m) => { m.habit = 70; });
    const count = (stamina: number) => {
      let wasted = 0;
      for (let seed = 1; seed <= 60; seed++) {
        const g: GameState = { ...structuredClone(s), rng: seed, pending: null, fans: 200 };
        g.members.forEach((m) => { m.hidden.stamina = stamina; });
        const after = act(g, { type: 'gig', option: 'venue0' });
        wasted += after.scene!.beats.filter((b) => /out of it|wasted/i.test(b.text)).length;
      }
      return wasted;
    };
    expect(count(90)).toBeLessThan(count(15));
  });
});

describe('who answers the advert', () => {
  it('a famous band of good players hears from better musicians', () => {
    const avg = (fans: number, skill: number) => {
      let total = 0, n = 0;
      for (let seed = 1; seed <= 25; seed++) {
        const s: GameState = { ...newGame({ name: 'X', instrument: 'none', bandName: 'B', background: 'artschool', style: 'glam', seed }), fans, money: 5000, pending: null };
        s.members.forEach((m) => { m.skill = skill; m.stage = skill; m.writing = skill; });
        const after = act(s, { type: 'advertise', option: 'classified', role: 'guitar' });
        for (const c of after.candidates) { total += overall(c); n++; }
      }
      return total / n;
    };
    expect(avg(100000, 80)).toBeGreaterThan(avg(300, 45) + 12);
  });
});

describe('playing through and paying up', () => {
  it('a played-through tour is interrupted far less often than one played week by week', async () => {
    const { finishTour } = await import('../src/game/engine');
    let stops = 0, weeksPlayed = 0;
    for (let seed = 1; seed <= 12; seed++) {
      let s: GameState = { ...newGame({ name: 'X', instrument: 'none', bandName: 'B', background: 'artschool', style: 'glam', seed }), fans: 2000, money: 20000, buzz: 50, pending: null, releases: [{ id: 'r', kind: 'single', title: 'T', quality: 60, appeal: 1, week: 0, sold: 0, lastWeek: 0 }] };
      s = act(s, { type: 'tour', option: 'theatres', weeks: 6, policy: 'steady' });
      while (s.pending) s = resolvePending(s, viewPending(s)!.options.findIndex((o) => !o.locked));
      let guard = 0;
      while (s.tour && guard++ < 10) {
        const w = s.week;
        s = finishTour(s, 'steady');
        weeksPlayed += s.week - w;
        if (s.pending) stops++;
        while (s.pending) s = resolvePending(s, viewPending(s)!.options.findIndex((o) => !o.locked));
      }
    }
    expect(stops / weeksPlayed).toBeLessThan(0.3);
  });

  it('event prices scale with the bank balance', async () => {
    const { priceFactor } = await import('../src/game/events');
    const s = newGame({ name: 'X', instrument: 'none', bandName: 'B', background: 'artschool', style: 'glam', seed: 2 });
    expect(priceFactor({ ...s, money: 200 })).toBe(1);
    expect(priceFactor({ ...s, money: 200000 })).toBe(10);
    const rich = { ...s, money: 200000, lastGigWeek: s.week };
    const ev = forceEvent(rich, 'after_show');
    const poor = forceEvent({ ...s, money: 200, lastGigWeek: s.week }, 'after_show');
    const costly = (st: GameState) => viewPending(st)!.options.map((o) => o.cost);
    expect(Math.max(...costly(ev))).toBeGreaterThanOrEqual(Math.max(...costly(poor)));
  });
});
