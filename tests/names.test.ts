import { describe, expect, it } from 'vitest';
import { Rng } from '../src/game/rng';
import {
  ALBUM_PATTERN_COUNT, BAND_PATTERN_COUNT, NAME_POOLS, PRESS_BAD, PRESS_GOOD, SONG_PATTERN_COUNT,
  albumTitle, bandName, isBlocked, isBlockedPerson, isBlockedTitle, normaliseName, personName, songTitle, stageName,
} from '../src/game/names';
import { BLURBS } from '../src/game/characters';

const DRAWS = 5000;
const draw = (f: (r: Rng) => string, seed = 7, n = DRAWS) => {
  const r = new Rng(seed);
  return Array.from({ length: n }, () => f(r));
};

describe('name generators', () => {
  it('are deterministic for a seed', () => {
    for (const f of [bandName, songTitle, albumTitle, stageName, (r: Rng) => personName(r)]) {
      expect(draw(f, 42, 50)).toEqual(draw(f, 42, 50));
    }
    expect(draw(bandName, 1, 50)).not.toEqual(draw(bandName, 2, 50));
  });

  it('never emit real band names', () => {
    for (const n of draw(bandName)) expect(isBlocked(n), n).toBe(false);
  });

  it('never emit real song or album titles', () => {
    for (const t of draw(songTitle)) expect(isBlockedTitle(t), t).toBe(false);
    for (const t of draw(albumTitle, 9, 2000)) expect(isBlockedTitle(t), t).toBe(false);
  });

  it('never emit real stage names', () => {
    for (const n of draw(stageName, 3, 2000)) expect(isBlockedPerson(n), n).toBe(false);
  });

  it('produce lots of variety', () => {
    expect(new Set(draw(bandName)).size).toBeGreaterThan(2000);
    expect(new Set(draw(songTitle)).size).toBeGreaterThan(2500);
    expect(new Set(draw(albumTitle, 5, 1000)).size).toBeGreaterThan(400);
    expect(new Set(draw(stageName, 5, 1000)).size).toBeGreaterThan(600);
  });

  it('have plenty of patterns', () => {
    expect(BAND_PATTERN_COUNT).toBeGreaterThanOrEqual(20);
    expect(SONG_PATTERN_COUNT).toBeGreaterThanOrEqual(30);
    expect(ALBUM_PATTERN_COUNT).toBeGreaterThanOrEqual(10);
  });

  it('keep generated text clean: no double quotes, em dashes or unicode arrows', () => {
    for (const s of [...draw(bandName, 11, 1000), ...draw(songTitle, 11, 1000), ...draw(albumTitle, 11, 1000)]) {
      expect(s).not.toMatch(/["\u2014\u2192]/);
      expect(s.trim()).toBe(s);
      expect(s).not.toMatch(/ {2}/);
    }
  });
});

describe('blocklists', () => {
  it('catch exact names, spelling games and near misses', () => {
    expect(isBlocked('Def Leppard')).toBe(true);
    expect(isBlocked('The Def Leppard')).toBe(true);
    expect(isBlocked('Def Leopard')).toBe(true);
    expect(isBlocked('Mötley Crüe')).toBe(true);
    expect(isBlocked('Motley Krue')).toBe(true);
    expect(isBlocked('Guns and Roses')).toBe(true);
    expect(isBlocked('Kröme Kittenz')).toBe(false);
    expect(isBlockedTitle("Livin' on a Pray")).toBe(true);
    expect(isBlockedTitle('Living on a Prayer')).toBe(true);
    expect(isBlockedTitle('Died in Your Arms')).toBe(true);
    expect(isBlockedTitle('TONIGHT TONIGHT TONIGHT')).toBe(true);
    expect(isBlockedTitle('Hairspray at Dawn')).toBe(false);
    expect(isBlockedPerson('Nikki Sixx')).toBe(true);
    expect(isBlockedPerson('Rikki Rocket')).toBe(true);
  });

  it('normalise case, punctuation and a leading The', () => {
    expect(normaliseName('The Rat-Pit & Co.')).toBe('rat pit and co');
  });
});

describe('pools', () => {
  const size = (k: string) => new Set(NAME_POOLS[k]).size;

  it('are big', () => {
    expect(size('FIRST')).toBeGreaterThanOrEqual(80);
    expect(size('LAST')).toBeGreaterThanOrEqual(80);
    expect(size('NICK')).toBeGreaterThanOrEqual(50);
    expect(size('TOWNS')).toBeGreaterThanOrEqual(50);
    expect(size('ADJ')).toBeGreaterThanOrEqual(80);
    expect(size('NOUN_PL')).toBeGreaterThanOrEqual(80);
    expect(size('NOUN')).toBeGreaterThanOrEqual(60);
    expect(size('GLAM_FIRST')).toBeGreaterThanOrEqual(60);
    expect(size('GLAM_LAST')).toBeGreaterThanOrEqual(60);
    expect(size('REAL_TITLES')).toBeGreaterThanOrEqual(300);
    expect(PRESS_GOOD.length).toBeGreaterThanOrEqual(40);
    expect(PRESS_BAD.length).toBeGreaterThanOrEqual(40);
    expect(new Set(BLURBS).size).toBeGreaterThanOrEqual(80);
  });

  it('have no em dashes, unicode arrows or stray double quotes', () => {
    const all = [...Object.values(NAME_POOLS).flat(), ...BLURBS];
    for (const s of all) expect(s, s).not.toMatch(/[\u2014\u2192"]/);
  });

  it('keep blurbs gender-neutral', () => {
    for (const b of BLURBS) expect(b, b).not.toMatch(/\b(he|she|his|her|him|hers|himself|herself)\b/i);
  });

  it('keep press quotes to short one-liners', () => {
    for (const q of [...PRESS_GOOD, ...PRESS_BAD]) {
      expect(q.length).toBeLessThan(110);
      expect(q).toMatch(/[.!?]$/);
    }
  });
});
