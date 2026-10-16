import { describe, expect, it } from 'vitest';
import { act, newGame } from '../src/game/engine';
import { actionOptions } from '../src/game/actions';
import { Rng } from '../src/game/rng';
import { AUDIT_FEE, LABELS, audit, buyOut, buyoutCost, declineOffer, haggle, interested, labelById, labelWeek, makeTerms, readSmallPrint, royaltyPerCopy, seizeTourProfit, signOffer } from '../src/game/labels';
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

describe('poaching, audits and the A&R', () => {
  it('a rival label buying you out puts the buyout on your new tab', () => {
    let s = signOffer(withOffer(fresh(), 'badpenny'), 'o1');
    const cost = buyoutCost(s);
    const o: Offer = { id: 'o2', label: 'colossus', week: s.week, expires: s.week + 4, terms: makeTerms(s, labelById('colossus'), new Rng(3)), read: false, haggled: 0, buyout: cost };
    s = signOffer({ ...s, offers: [o] }, 'o2');
    expect(s.contract!.label).toBe('colossus');
    expect(s.contract!.unrecouped).toBe(o.terms.advance + cost);
  });

  it('an audit finds what a crook kept off the statements, and finds nothing at an honest label', () => {
    const crook = signOffer(withOffer(fresh(), 'goldtooth'), 'o1');
    crook.contract!.statements = 1; crook.contract!.shaved = 1000; crook.contract!.unrecouped = 0; crook.money = 1000;
    const a = audit(crook);
    expect(a.money).toBeGreaterThan(1000 - AUDIT_FEE + 500);
    expect(a.contract === null || a.contract.goodwill < crook.contract!.goodwill).toBe(true);
    const honest = signOffer(withOffer(fresh(), 'badpenny'), 'o1');
    honest.contract!.statements = 1; honest.money = 1000;
    const b = audit(honest);
    expect(b.money).toBe(1000 - AUDIT_FEE);
  });

  it('a flop with a label that has gone off you gets you dropped, even by a patient one', () => {
    const s = structuredClone(signOffer(withOffer(fresh(), 'badpenny'), 'o1'));
    s.contract!.goodwill = 35;
    s.releases.push({ id: 'a', kind: 'album', title: 'Flop', quality: 30, appeal: 1, week: s.week, sold: 100, lastWeek: 0, label: 'badpenny', royalty: 0.5 });
    s.contract!.albumsDelivered = 1; s.contract!.reviewWeek = s.week + 1; s.week += 1;
    labelWeek(s, new Rng(4));
    expect(s.contract).toBeNull();
  });

  it('doing what the A&R says makes the next record poppier', () => {
    const base = signOffer(withOffer(fresh(), 'imperial'), 'o1');
    base.songs = [1, 2].map((i) => ({ title: `S${i}`, quality: 60, writer: 'p', kind: 'standard' as const, genre: 'glam' as const, released: false }));
    const pushed = { ...structuredClone(base), flags: { ...base.flags, arPush: 1 } };
    const a = act(base, { type: 'release', option: 'single' }).releases.at(-1)!;
    const b = act(pushed, { type: 'release', option: 'single' }).releases.at(-1)!;
    expect(b.appeal).toBeCloseTo(a.appeal * 1.2, 5);
  });
});

describe('managers', () => {
  it('take their cut of gig money, but a well-connected one gets bigger fees', async () => {
    const { commission, feeBoost, sackManager, sackCost } = await import('../src/game/managers');
    const s = fresh();
    s.manager = { name: 'Vera', honesty: 80, clout: 60, cut: 0.2, signed: 0, read: true, taken: 0 };
    expect(feeBoost(s)).toBeCloseTo(1.4);
    const before = s.money;
    expect(commission(s, 100)).toBe(20);
    expect(s.money).toBe(before - 20);
    s.money = 5000;
    const out = sackManager(s);
    expect(out.manager).toBeNull();
    expect(out.money).toBe(5000 - sackCost(s));
  });

  it('a crooked manager rounds their share up', async () => {
    const { commission } = await import('../src/game/managers');
    const s = fresh();
    s.manager = { name: 'Lenny', honesty: 10, clout: 30, cut: 0.2, signed: 0, read: false, taken: 0 };
    expect(commission(s, 100)).toBe(25);
  });
});

describe('videos and producers', () => {
  it('a big video goes on the label tab, lifts the record and carries it to America', async () => {
    const { reach } = await import('../src/game/engine');
    const { forceEvent, resolvePending, viewPending } = await import('../src/game/events');
    let s = signOffer(withOffer(fresh(), 'badpenny'), 'o1');
    s = { ...s, week: 100, releases: [{ id: 'sg', kind: 'single', title: 'Hit', quality: 60, appeal: 1, week: 100, sold: 0, lastWeek: 0, label: 'badpenny', royalty: 0.2 }] };
    const owed = s.contract!.unrecouped;
    const ev = forceEvent(s, 'video_shoot');
    const i = viewPending(ev)!.options.findIndex((o) => /full treatment/.test(o.label));
    const after = resolvePending(ev, i);
    expect(after.contract!.unrecouped).toBe(owed + 8000);
    expect(after.releases[0].appeal).toBeCloseTo(1.25);
    expect(reach(after).world).toBeGreaterThan(reach(s).world);
  });

  it('the legend producer makes the album better and takes points off royalties', async () => {
    const { forceEvent, resolvePending, viewPending } = await import('../src/game/events');
    let s = signOffer(withOffer(fresh(), 'imperial'), 'o1');
    s.songs = Array.from({ length: 8 }, (_, i) => ({ title: `S${i}`, quality: 60, writer: 'p', kind: 'standard' as const, genre: 'glam' as const, released: false }));
    const plain = act(structuredClone(s), { type: 'release', option: 'album' }).releases.at(-1)!;
    const ev = forceEvent(s, 'album_producer');
    s = resolvePending(ev, viewPending(ev)!.options.findIndex((o) => /legend/.test(o.label)));
    expect(s.flags.producerPoints).toBe(2);
    const produced = act(s, { type: 'release', option: 'album' }).releases.at(-1)!;
    expect(produced.quality).toBeGreaterThan(plain.quality + 5);
    expect(produced.royalty!).toBeLessThan(plain.royalty!);
  });
});
