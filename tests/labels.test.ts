import { describe, expect, it } from 'vitest';
import { act, newGame } from '../src/game/engine';
import { actionOptions } from '../src/game/actions';
import { Rng } from '../src/game/rng';
import { LABELS, buyOut, buyoutCost, declineOffer, haggle, interested, labelById, labelWeek, makeTerms, readSmallPrint, royaltyPerCopy, seizeTourProfit, signOffer } from '../src/game/labels';
import type { GameState, Offer } from '../src/game/types';

const fresh = (seed = 3): GameState => {
  const s = newGame({ name: 'X', instrument: 'none', bandName: 'B', background: 'artschool', style: 'glam', seed });
  return { ...s, fans: 1500, buzz: 60, money: 500, week: 60, flags: { ...s.flags, labelCalling: 50 } };
};
const withOffer = (s: GameState, labelId: string, seed = 1): GameState => {
  const o: Offer = { id: 'o1', label: labelId, week: s.week, expires: s.week + 6, terms: makeTerms(s, labelById(labelId), new Rng(seed)), read: false, haggled: 0 };
  return { ...s, offers: [o] };
};

describe('record labels', () => {
  it('nobody calls a band with no following; sharks call first, majors last', () => {
    const s = newGame({ name: 'X', instrument: 'none', bandName: 'B', background: 'artschool', style: 'glam', seed: 1 });
    expect(LABELS.some((l) => interested(s, l))).toBe(false);
    const small = { ...s, fans: 200, releases: [{ id: 'd', kind: 'demo' as const, title: 'T', quality: 40, appeal: 1, week: 0, sold: 0, lastWeek: 0 }] };
    expect(LABELS.filter((l) => interested(small, l)).every((l) => l.tier === 'shark')).toBe(true);
    expect(LABELS.some((l) => l.tier === 'major' && interested(fresh(), l))).toBe(true);
  });

  it('offers arrive over time once labels are interested, and expire', () => {
    let s = structuredClone(fresh());
    const rng = new Rng(5);
    for (let i = 0; i < 40 && !s.offers.length; i++) { s.week++; labelWeek(s, rng); }
    expect(s.offers.length).toBeGreaterThan(0);
    s = structuredClone(s);
    s.week = s.offers[0].expires;
    labelWeek(s, rng);
    expect(s.offers.every((o) => o.expires > s.week)).toBe(true);
  });

  it('a shark offers more cash up front but worse small print than an honest indie', () => {
    let sharkWorse = 0;
    for (let i = 1; i <= 30; i++) {
      const s = fresh();
      const shark = makeTerms(s, labelById('goldtooth'), new Rng(i));
      const indie = makeTerms(s, labelById('badpenny'), new Rng(i));
      if (royaltyPerCopy(shark, 'album') < royaltyPerCopy(indie, 'album') && shark.albums > indie.albums) sharkWorse++;
    }
    expect(sharkWorse).toBe(30);
  });

  it('signing pays the advance as a debt, and the lawyer reveals the small print for a fee', () => {
    let s = withOffer(fresh(), 'goldtooth');
    s = readSmallPrint(s, 'o1');
    expect(s.money).toBe(400);
    expect(s.offers[0].read).toBe(true);
    const adv = s.offers[0].terms.advance;
    s = signOffer(s, 'o1');
    expect(s.money).toBe(400 + adv);
    expect(s.contract!.unrecouped).toBe(adv);
    expect(s.offers).toHaveLength(0);
  });

  it('turning down or pushing too hard can lose the offer', () => {
    expect(declineOffer(withOffer(fresh(), 'imperial'), 'o1').offers).toHaveLength(0);
    let lost = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const s = { ...withOffer(fresh(), 'colossus'), rng: seed };
      if (!haggle(s, 'o1').offers.length) lost++;
    }
    expect(lost).toBeGreaterThan(0);
    expect(lost).toBeLessThan(40);
  });

  it('a label album runs up the tab, sells harder, and royalties pay the debt before you', () => {
    let s = signOffer(withOffer(fresh(), 'imperial'), 'o1');
    s.songs = Array.from({ length: 8 }, (_, i) => ({ title: `S${i}`, quality: 60, writer: 'p', kind: 'standard' as const, genre: 'glam' as const, released: false }));
    const owedBefore = s.contract!.unrecouped;
    const cashBefore = s.money;
    s = act(s, { type: 'release', option: 'album' });
    expect(s.contract!.albumsDelivered).toBe(1);
    expect(s.contract!.unrecouped).toBeGreaterThan(owedBefore);
    const album = s.releases.find((r) => r.kind === 'album')!;
    expect(album.label).toBe('imperial');
    expect(album.royalty).toBeGreaterThan(0);
    // Album sales do not pay the band directly.
    expect(s.money).toBeLessThanOrEqual(cashBefore);
  });

  it('self-financed records are off the table once signed', () => {
    const s = signOffer(withOffer(fresh(), 'badpenny'), 'o1');
    const labels = actionOptions(s, 'release').map((o) => o.label);
    expect(labels.some((l) => /Self-financed/.test(l))).toBe(false);
    expect(labels.some((l) => /Bad Penny/.test(l))).toBe(true);
  });

  it('tour-recoupment clauses take the profit, and buying out costs more with a crook', () => {
    const s = signOffer(withOffer(fresh(), 'goldtooth'), 'o1');
    s.contract!.terms.smallPrint.tourRecoup = true;
    const before = s.money;
    expect(seizeTourProfit(s, 300)).toBe(300);
    expect(s.money).toBe(before - 300);
    const honest = signOffer(withOffer(fresh(), 'badpenny'), 'o1');
    honest.contract!.unrecouped = s.contract!.unrecouped = 5000;
    s.contract!.terms.smallPrint.ownsName = false;
    expect(buyoutCost(s)).toBeGreaterThan(buyoutCost(honest));
    honest.money = 99999;
    const out = buyOut(honest);
    expect(out.contract).toBeNull();
    expect(out.money).toBe(99999 - buyoutCost(honest));
  });

  it('crooked labels under-report royalties on the statement', () => {
    const run = (labelId: string) => {
      const s = structuredClone(signOffer(withOffer(fresh(), labelId), 'o1'));
      s.contract!.unrecouped = 0;
      s.contract!.owed = 1000;
      s.week = s.contract!.signed + 13;
      const before = s.money;
      labelWeek(s, new Rng(1));
      return s.money - before;
    };
    expect(run('badpenny')).toBe(1000);
    expect(run('goldtooth')).toBeLessThan(800);
  });

  it('a flop album gets an impatient major to drop you, and the debt goes with them', () => {
    const s = structuredClone(signOffer(withOffer(fresh(), 'colossus'), 'o1'));
    s.releases.push({ id: 'a', kind: 'album', title: 'Flop', quality: 30, appeal: 1, week: s.week, sold: 900, lastWeek: 0, label: 'colossus', royalty: 0.3 });
    s.contract!.albumsDelivered = 1;
    s.contract!.reviewWeek = s.week + 1;
    s.week += 1;
    labelWeek(s, new Rng(2));
    expect(s.contract).toBeNull();
    expect(s.milestones.some((m) => /Dropped by Colossus/.test(m.text))).toBe(true);
  });
});
