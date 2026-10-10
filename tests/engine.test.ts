import { describe, expect, it } from 'vitest';
import { act, canAct, fire, first, hire, newGame } from '../src/game/engine';
import { chemistry, missingForGig, performance } from '../src/game/chemistry';
import { Rng } from '../src/game/rng';
import { bandName, isBlocked } from '../src/game/names';
import type { GameState, NewGameInput } from '../src/game/types';

const input: NewGameInput = { name: 'Jussi', instrument: 'guitar', bandName: 'Velvet Daggers', background: 'artschool', style: 'glam', seed: 42 };

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

  it('hides bandmates\' traits at the start', () => {
    const s = newGame(input);
    for (const m of s.members.slice(1)) expect(Object.values(m.known).every((k) => k === 0)).toBe(true);
  });

  it('starting mates are uneven: one good, one average, one weak on average', () => {
    const s = newGame(input);
    const skills = s.members.slice(1).map((m) => m.skill).sort((a, b) => a - b);
    expect(skills[2] - skills[0]).toBeGreaterThan(5);
  });
});

describe('actions', () => {
  it('rehearsing raises tightness and advances the week', () => {
    const s0 = newGame(input);
    const s1 = act(s0, { type: 'rehearse' });
    expect(s1.week).toBe(1);
    expect(s1.tightness).toBeGreaterThan(s0.tightness);
  });

  it('does not mutate the previous state', () => {
    const s0 = newGame(input);
    const copy = structuredClone(s0);
    act(s0, { type: 'gig' });
    expect(s0).toEqual(copy);
  });

  it('gigging earns money and costs energy', () => {
    const s0 = newGame(input);
    const s1 = act(s0, { type: 'gig' });
    expect(s1.lastGigWeek).toBe(0);
    const energyBefore = s0.members.reduce((a, m) => a + m.energy, 0);
    const energyAfter = s1.members.reduce((a, m) => a + m.energy, 0);
    expect(energyAfter).toBeLessThan(energyBefore);
  });

  it('writing adds songs', () => {
    const s1 = act(newGame(input), { type: 'write' });
    expect(s1.songs.length).toBeGreaterThan(0);
  });

  it('advertising produces three candidates of the role with one trait revealed each', () => {
    const s1 = act(newGame(input), { type: 'advertise', role: 'keys' });
    expect(s1.candidates).toHaveLength(3);
    for (const c of s1.candidates) {
      expect(c.role).toBe('keys');
      expect(Object.values(c.known).filter((k) => k > 0)).toHaveLength(1);
    }
  });

  it('can hire a candidate as a replacement', () => {
    const s1 = act(newGame(input), { type: 'advertise', role: 'drums' });
    const oldDrummer = s1.members.find((m) => m.role === 'drums')!;
    const s2 = hire(s1, s1.candidates[0].id, oldDrummer.id);
    expect(s2.members.find((m) => m.role === 'drums')!.id).toBe(s1.candidates[0].id);
    expect(s2.members).toHaveLength(4);
    expect(Object.keys(s2.affinity).some((k) => k.includes(oldDrummer.id))).toBe(false);
  });

  it('a band without a drummer cannot gig', () => {
    const s0 = newGame(input);
    const s1 = fire(s0, s0.members.find((m) => m.role === 'drums')!.id);
    expect(canAct(s1, { type: 'gig' })).toMatch(/drummer/);
    expect(() => act(s1, { type: 'gig' })).toThrow();
  });

  it('cannot fire the player', () => {
    expect(() => fire(newGame(input), 'p')).toThrow();
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
    const s = newGame({ ...input, name: 'John Whitaker' });
    expect(s.members[0].name).toBe('John Whitaker');
  });

  it('gives some bandmates stage names over many games', () => {
    let staged = 0;
    for (let seed = 1; seed <= 20; seed++) {
      staged += newGame({ ...input, seed }).members.filter((m) => !m.isPlayer && m.name !== m.realName).length;
    }
    expect(staged).toBeGreaterThan(10);
  });

  it('uses the nickname as the short name', () => {
    const s = newGame(input);
    const m = { ...s.members[1], name: 'Dave "Razor" Price' };
    expect(first(m)).toBe('Razor');
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

  it('a band with no fans is not on the London chart, a popular one is', () => {
    let s = newGame(input);
    expect(s.world.charts.london.some((e) => e.isPlayer)).toBe(false);
    s = { ...s, fans: 900, buzz: 60 };
    s = act(s, { type: 'rest' });
    expect(s.world.charts.london.find((e) => e.isPlayer)!.pos).toBeLessThanOrEqual(15);
    expect(s.log.some((l) => l.text.includes('entered the London Underground 40'))).toBe(true);
  });

  it('the player never appears on the record charts without a record', () => {
    let s = { ...newGame(input), fans: 5000, buzz: 100 };
    s = act(s, { type: 'rest' });
    for (const c of ['uk', 'europe', 'world'] as const) expect(s.world.charts[c].some((e) => e.isPlayer)).toBe(false);
  });

  it('tracks weeks on chart and movement', () => {
    let s = newGame(input);
    s = act(s, { type: 'rest' });
    s = act(s, { type: 'rest' });
    expect(s.world.charts.world.some((e) => e.weeks >= 2 && e.last !== null)).toBe(true);
  });
});

describe('names', () => {
  it('never generates blocklisted real band names', () => {
    const rng = new Rng(1);
    for (let i = 0; i < 2000; i++) expect(isBlocked(bandName(rng))).toBe(false);
  });
});

describe('a full run', () => {
  it('a simple strategy can play to the end without crashing', () => {
    for (let seed = 1; seed <= 30; seed++) {
      let s = newGame({ ...input, seed });
      let guard = 0;
      while (!s.over && guard++ < 200) {
        const tired = s.members.some((m) => m.energy < 35);
        const a = tired ? { type: 'rest' as const } : s.songs.length < 4 ? { type: 'write' as const } : canAct(s, { type: 'gig' }) ? { type: 'rehearse' as const } : { type: 'gig' as const };
        s = act(s, a);
      }
      expect(s.over).not.toBeNull();
    }
  });
});
