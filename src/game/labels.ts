// Record labels, deals and contracts. Advances are loans, royalties are small, the small print is
// where the bodies are buried. Some labels are decent. Some are sharks in nice suits.
import { Rng, clamp } from './rng';
import { addBuzz, adjust, log, milestone, mutate } from './helpers';
import type { Contract, DealTerms, GameState, Offer, Release, ReleaseKind, SmallPrint } from './types';

export type LabelTier = 'indie' | 'shark' | 'major';

export interface Label {
  id: string;
  name: string;
  tier: LabelTier;
  /** 0-100. Decides the small print and how creative the accounting is. Never shown directly. */
  honesty: number;
  /** Sales multiplier from promotion and distribution. */
  promo: number;
  /** Flop albums tolerated before you are dropped. */
  patience: number;
  /** What the scene says about them. A rumour, not a guarantee. */
  word: string;
}

export const LABELS: Label[] = [
  { id: 'badpenny', name: 'Bad Penny Records', tier: 'indie', honesty: 88, promo: 1.3, patience: 3, word: 'Run from a Camden basement by an ex-punk. Small, skint, pays on time.' },
  { id: 'waxlyrical', name: 'Wax Lyrical', tier: 'indie', honesty: 72, promo: 1.45, patience: 2, word: 'Arty, well liked by the music press, slow with the cheques.' },
  { id: 'gutterpress', name: 'Gutterpress Recordings', tier: 'indie', honesty: 55, promo: 1.6, patience: 2, word: 'Gets records into shops. Nobody quite understands their accounts.' },
  { id: 'goldtooth', name: 'Goldtooth Music', tier: 'shark', honesty: 12, promo: 1.5, patience: 4, word: 'A Rolls-Royce outside, a cash box inside. Signs anyone with a pulse.' },
  { id: 'starlight', name: 'Starlight Entertainment Group', tier: 'shark', honesty: 22, promo: 1.35, patience: 4, word: 'A grand name, an office above a launderette in Hounslow.' },
  { id: 'colossus', name: 'Colossus Phonographic', tier: 'major', honesty: 48, promo: 3.0, patience: 1, word: 'The biggest machine in the business. One flop and you are a tax write-off.' },
  { id: 'imperial', name: 'Imperial Gramophone', tier: 'major', honesty: 62, promo: 2.6, patience: 2, word: 'Old money, old offices, surprisingly patient with new bands.' },
  { id: 'polyvox', name: 'Polyvox International', tier: 'major', honesty: 38, promo: 2.8, patience: 1, word: 'Huge in Europe. Bills you for every lunch, every video, every taxi.' },
];

export const labelById = (id: string): Label => LABELS.find((l) => l.id === id)!;

/** Retail price per copy, for royalty maths. */
const RETAIL: Record<ReleaseKind, number> = { demo: 0, single: 1.29, ep: 2.99, album: 4.99 };
/** Share of the album budget a release burns. */
const BUDGET_SHARE: Record<ReleaseKind, number> = { demo: 0, single: 0.15, ep: 0.35, album: 1 };
/** Album sales each kind of label quietly expects. */
const EXPECTS: Record<LabelTier, number> = { indie: 1500, shark: 800, major: 6000 };
export const LAWYER_FEE = 100;
const STATEMENT_WEEKS = 13;
const REVIEW_AFTER = 16;

/** How hot the band is to the people with chequebooks. */
export function heat(s: GameState): number {
  return s.fans + s.buzz * 20 + (s.flags.chartedNational !== undefined ? 1500 : 0) + (s.flags.arInterest ?? 0) * 200;
}

/** Which kinds of label will talk to you at all. */
export function interested(s: GameState, l: Label): boolean {
  if (l.tier === 'shark') return s.fans >= 150 && s.releases.length > 0;
  if (l.tier === 'indie') return (s.fans >= 300 && s.buzz >= 20) || (s.flags.arInterest ?? 0) >= 1;
  return s.flags.labelCalling !== undefined || s.flags.chartedNational !== undefined || (s.flags.arInterest ?? 0) >= 2;
}

function smallPrint(l: Label, rng: Rng): SmallPrint {
  const crook = (100 - l.honesty) / 100;
  return {
    deductions: Math.round(clamp(crook * 0.45 + rng.next() * 0.08 + (l.tier === 'major' ? 0.1 : 0), 0, 0.5) * 100) / 100,
    tourRecoup: l.honesty < 35 && rng.chance(0.8),
    ownsName: l.honesty < 30 && rng.chance(0.7),
    promoRecoup: l.honesty < 55 && rng.chance(l.tier === 'major' ? 0.9 : 0.4),
  };
}

export function makeTerms(s: GameState, l: Label, rng: Rng): DealTerms {
  const h = heat(s);
  const r = (lo: number, hi: number) => lo + rng.next() * (hi - lo);
  const round = (v: number, to: number) => Math.max(to, Math.round(v / to) * to);
  if (l.tier === 'indie') {
    return { advance: round(r(300, 900) + h * 0.3, 50), rate: Math.round(r(14, 18)) / 100, albums: 2, budget: round(r(1500, 2500) + h * 0.4, 100), smallPrint: smallPrint(l, rng) };
  }
  if (l.tier === 'shark') {
    // Flash money up front, everything else is a trap.
    return { advance: round(r(900, 2200) + h * 0.5, 100), rate: Math.round(r(11, 14)) / 100, albums: rng.int(5, 6), budget: round(r(1200, 1800), 100), smallPrint: smallPrint(l, rng) };
  }
  return { advance: round(r(3000, 6000) + h * 1.5, 250), rate: Math.round(r(8, 12)) / 100, albums: rng.int(3, 5), budget: round(r(7000, 12000) + h * 1.2, 500), smallPrint: smallPrint(l, rng) };
}

/** What the band actually gets per copy once the deductions have been taken. */
export const royaltyPerCopy = (t: DealTerms, kind: ReleaseKind) => Math.round(RETAIL[kind] * t.rate * (1 - t.smallPrint.deductions) * 1000) / 1000;

/** Cost of walking out of the contract before it ends. */
export function buyoutCost(s: GameState): number {
  const c = s.contract;
  if (!c) return 0;
  const l = labelById(c.label);
  const share = l.honesty >= 60 ? 0.3 : l.honesty >= 35 ? 0.6 : 1;
  return Math.round(1000 + c.unrecouped * share + (c.terms.smallPrint.ownsName ? 2000 : 0));
}

// ---------------------------------------------------------------- weekly business

/** New offers, expiring offers, royalty statements, the label's patience. Runs every week. */
export function labelWeek(s: GameState, rng: Rng): void {
  s.offers = s.offers.filter((o) => {
    if (s.week < o.expires) return true;
    log(s, `${labelById(o.label).name} withdrew their offer. They have found a band who answer letters.`, 'neutral');
    return false;
  });
  if (!s.contract && s.offers.length < 3) {
    for (const l of rng.shuffle([...LABELS])) {
      if (s.offers.some((o) => o.label === l.id) || !interested(s, l) || (s.flags[`passed_${l.id}`] !== undefined && s.week - s.flags[`passed_${l.id}`] < 26)) continue;
      if (!rng.chance(l.tier === 'shark' ? 0.06 : l.tier === 'indie' ? 0.07 : 0.08)) continue;
      const o: Offer = { id: `offer${s.nextId++}`, label: l.id, week: s.week, expires: s.week + 6, terms: makeTerms(s, l, rng), read: false, haggled: 0 };
      s.offers.push(o);
      log(s, `A letter from ${l.name}: they want to sign ${s.bandName}. £${o.terms.advance.toLocaleString('en-GB')} advance. Details in the Label tab.`, 'good');
      if (s.flags.firstOffer === undefined) { s.flags.firstOffer = s.week; milestone(s, 'career', `First record deal offer, from ${l.name}.`); }
      break;
    }
  }
  const c = s.contract;
  if (!c) return;
  const l = labelById(c.label);
  if ((s.week - c.signed) % STATEMENT_WEEKS === 0 && s.week > c.signed) statement(s, c, l);
  if (c.reviewWeek !== null && s.week >= c.reviewWeek) review(s, c, l);
  const lastAlbum = Math.max(c.signed, ...s.releases.filter((r) => r.label === c.label && r.kind === 'album').map((r) => r.week));
  if (s.week - lastAlbum === 52) {
    for (const m of s.members) adjust(m, 'mood', -4);
    log(s, `${l.name} rang. And rang again. Where is the album? The word "breach" was used.`, 'bad');
  }
  if (s.week - lastAlbum >= 104) drop(s, l, `${l.name} have dropped ${s.bandName} for failing to deliver an album. Two years of excuses, one paragraph of a letter.`);
}

function statement(s: GameState, c: Contract, l: Label): void {
  // Creative accounting: the less honest the label, the fewer records you apparently sold.
  const shave = l.honesty >= 60 ? 1 : 0.55 + (l.honesty / 100) * 0.7;
  const reported = Math.round(c.owed * shave);
  c.owed = 0;
  const before = c.unrecouped;
  const cleared = Math.min(before, reported);
  c.unrecouped = before - cleared;
  const paid = reported - cleared;
  s.money += paid;
  if (reported === 0 && before === 0) return;
  log(
    s,
    `Royalty statement from ${l.name}: £${reported.toLocaleString('en-GB')} earned${cleared ? `, £${cleared.toLocaleString('en-GB')} set against the advance` : ''}. ${paid ? `Cheque enclosed: £${paid.toLocaleString('en-GB')}.` : `Cheque enclosed: £0. You still owe them £${c.unrecouped.toLocaleString('en-GB')}.`}`,
    paid ? 'good' : 'neutral',
  );
  if (before > 0 && c.unrecouped === 0) milestone(s, 'career', `Recouped with ${l.name}. Every penny of the advance earned back.`);
}

function review(s: GameState, c: Contract, l: Label): void {
  c.reviewWeek = null;
  const album = [...s.releases].reverse().find((r) => r.label === c.label && r.kind === 'album');
  const sold = album?.sold ?? 0;
  if (sold < EXPECTS[l.tier]) {
    c.flops++;
    log(s, `${l.name} looked at the sales of "${album?.title}" (${sold.toLocaleString('en-GB')}). The meeting was short.`, 'bad');
  }
  if (c.flops > l.patience - 1) {
    drop(s, l, `${l.name} have dropped ${s.bandName}. The letter calls it "a difficult decision". It was a two-minute decision.`);
    return;
  }
  if (c.albumsDelivered >= c.terms.albums) {
    log(s, `That is the last album you owed ${l.name}. ${s.bandName} are out of contract and free to talk to anyone.`, 'good');
    milestone(s, 'career', `Contract with ${l.name} fulfilled.`);
    s.contract = null;
    s.flags[`passed_${l.id}`] = s.week - 26;
    return;
  }
  log(s, `${l.name} have taken up the option on the next album. ${c.terms.albums - c.albumsDelivered} to go.`, 'neutral');
}

function drop(s: GameState, l: Label, text: string): void {
  log(s, text, 'bad');
  milestone(s, 'career', `Dropped by ${l.name}.`);
  addBuzz(s, -6);
  for (const m of s.members) adjust(m, 'mood', -10);
  s.contract = null;
  s.flags[`passed_${l.id}`] = s.week + 200;
}

// ---------------------------------------------------------------- releases and money

/** Turns a release into a label release: budget charged to the band, quality from a real studio. */
export function labelRelease(s: GameState, kind: ReleaseKind): { studio: number; promo: number } | null {
  const c = s.contract;
  if (!c || kind === 'demo') return null;
  const l = labelById(c.label);
  c.unrecouped += Math.round(c.terms.budget * BUDGET_SHARE[kind]);
  if (c.terms.smallPrint.promoRecoup) c.unrecouped += Math.round(c.terms.budget * BUDGET_SHARE[kind] * 0.4);
  if (kind === 'album') { c.albumsDelivered++; c.reviewWeek = s.week + REVIEW_AFTER; }
  return { studio: l.tier === 'major' ? 9 : l.tier === 'indie' ? 5 : 3, promo: l.promo };
}

export function tagRelease(s: GameState, r: Release): void {
  if (!s.contract || r.kind === 'demo') return;
  r.label = s.contract.label;
  r.royalty = royaltyPerCopy(s.contract.terms, r.kind);
}

/** Label releases sell harder, and the money goes to the label's ledger, not your pocket. */
export function labelSales(s: GameState, r: Release, units: number): { units: number; cash: number } {
  if (!r.label) return { units, cash: -1 };
  const promoted = Math.round(units * labelById(r.label).promo);
  if (s.contract?.label === r.label) s.contract.owed += promoted * (r.royalty ?? 0);
  return { units: promoted, cash: 0 };
}

/** Tour profits seized under a tour-recoupment clause. Returns what the label took. */
export function seizeTourProfit(s: GameState, profit: number): number {
  const c = s.contract;
  if (!c || !c.terms.smallPrint.tourRecoup || c.unrecouped <= 0 || profit <= 0) return 0;
  const take = Math.min(profit, c.unrecouped);
  c.unrecouped -= take;
  s.money -= take;
  return take;
}

// ---------------------------------------------------------------- the player's moves

const offer = (s: GameState, id: string) => {
  const o = s.offers.find((x) => x.id === id);
  if (!o) throw new Error('That offer is gone.');
  return o;
};

export function readSmallPrint(state: GameState, id: string): GameState {
  return mutate(state, (s) => {
    const o = offer(s, id);
    if (o.read) return;
    if (s.money < LAWYER_FEE) throw new Error(`A lawyer costs £${LAWYER_FEE}. You do not have it.`);
    s.money -= LAWYER_FEE;
    o.read = true;
    const p = o.terms.smallPrint;
    const bad = [p.deductions >= 0.2 && `${Math.round(p.deductions * 100)}% of royalties lost to "deductions"`, p.tourRecoup && 'tour profits go to the label', p.ownsName && 'they own the band name', p.promoRecoup && 'promo and videos charged to you'].filter(Boolean);
    log(s, `A solicitor in Chancery Lane read the ${labelById(o.label).name} contract for £${LAWYER_FEE}. ${bad.length ? `He found: ${bad.join('; ')}.` : 'He found nothing worse than the usual. "Almost decent," he said, sounding disappointed.'}`, bad.length ? 'bad' : 'good');
  });
}

export function haggle(state: GameState, id: string): GameState {
  return mutate(state, (s, rng) => {
    const o = offer(s, id);
    const l = labelById(o.label);
    if (o.haggled >= 2) throw new Error(`${l.name} have made their final offer.`);
    o.haggled++;
    const odds = clamp(0.3 + heat(s) / 5000 + (s.offers.length - 1) * 0.15 - (o.haggled - 1) * 0.15, 0.1, 0.8);
    if (rng.chance(odds)) {
      o.terms.advance = Math.round((o.terms.advance * 1.25) / 50) * 50;
      o.terms.rate = Math.round((o.terms.rate + 0.01) * 100) / 100;
      log(s, `You played hard to get. ${l.name} came back with £${o.terms.advance.toLocaleString('en-GB')} and ${Math.round(o.terms.rate * 100)}%.`, 'good');
    } else if (rng.chance(l.tier === 'major' ? 0.4 : 0.25)) {
      s.offers = s.offers.filter((x) => x.id !== id);
      s.flags[`passed_${l.id}`] = s.week;
      log(s, `${l.name} withdrew the offer. "There are a hundred bands like you," said the letter. There are.`, 'bad');
    } else {
      log(s, `${l.name} will not budge. "Take it or leave it, darling."`, 'neutral');
    }
  });
}

export function declineOffer(state: GameState, id: string): GameState {
  return mutate(state, (s) => {
    const o = offer(s, id);
    s.offers = s.offers.filter((x) => x.id !== id);
    s.flags[`passed_${o.label}`] = s.week;
    log(s, `You turned down ${labelById(o.label).name}.`, 'neutral');
  });
}

export function signOffer(state: GameState, id: string): GameState {
  return mutate(state, (s) => {
    if (s.contract) throw new Error('You are already signed. Buy yourself out first.');
    const o = offer(s, id);
    const l = labelById(o.label);
    s.contract = { label: l.id, signed: s.week, terms: o.terms, unrecouped: o.terms.advance, albumsDelivered: 0, owed: 0, reviewWeek: null, flops: 0 };
    s.money += o.terms.advance;
    s.offers = [];
    addBuzz(s, l.tier === 'major' ? 12 : 6);
    for (const m of s.members) adjust(m, 'mood', 15);
    milestone(s, 'career', `Signed to ${l.name}: £${o.terms.advance.toLocaleString('en-GB')} advance, ${o.terms.albums} albums.`);
    const flavour: Record<LabelTier, string> = {
      indie: 'Signed on a pub table, sealed with a round. The advance arrived by cheque, and the cheque cleared.',
      shark: 'Signed in the back of a Rolls-Royce with a gold pen you were not allowed to keep. Champagne, cigars, a handshake that went on slightly too long.',
      major: 'Signed in a glass office on the twelfth floor. Somebody from marketing called you "the product". Nobody laughed but you.',
    };
    log(s, `${s.bandName} signed to ${l.name}. ${flavour[l.tier]} £${o.terms.advance.toLocaleString('en-GB')} in the bank, and every penny of it is a loan.`, 'good');
  });
}

export function buyOut(state: GameState): GameState {
  return mutate(state, (s) => {
    const c = s.contract;
    if (!c) throw new Error('You are not signed to anyone.');
    const cost = buyoutCost(s);
    if (s.money < cost) throw new Error(`Getting out costs £${cost.toLocaleString('en-GB')}. You do not have it.`);
    const l = labelById(c.label);
    s.money -= cost;
    s.contract = null;
    s.flags[`passed_${l.id}`] = s.week + 200;
    milestone(s, 'career', `Bought out of the ${l.name} deal for £${cost.toLocaleString('en-GB')}.`);
    log(s, `${s.bandName} paid £${cost.toLocaleString('en-GB')} to walk away from ${l.name}. ${c.terms.smallPrint.ownsName ? 'Buying back your own name was the expensive bit.' : 'The lawyers were the only winners, as usual.'}`, 'neutral');
  });
}
