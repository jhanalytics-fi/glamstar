// Lives, not just stats. Somewhere in the middle of a career a member gets married, finds God on the
// M6, opens a bar, stops answering the door or starts a slide. Each arc shows on the card, changes how
// they behave for a year or two, and turns at the end into something else.
import { Rng, clamp } from './rng';
import { addAffinity, available } from './chemistry';
import { addBuzz, adjust, first, log, milestone, removeMember } from './helpers';
import type { EventDef } from './events';
import type { Arc, GameState, Musician } from './types';

export type ArcKind = Arc['kind'];

/** One line for the card. */
export function arcLine(m: Musician, s: GameState): string | null {
  const a = m.arc;
  if (!a) return null;
  const w = s.week - a.since;
  switch (a.kind) {
    case 'wedding': return a.stage >= 1 ? (w < 60 ? `Married, a baby at home. Rings home from every hotel.` : 'Married, a child at school. Home by Friday, if possible.') : w < 8 ? 'Just married. Still smiling about it.' : 'Married. Comes to rehearsal with sandwiches.';
    case 'faith': return w < 20 ? 'Found God, loudly. Drinks water now.' : 'Keeps the faith, quietly. Writes hymns in the van.';
    case 'mogul': return a.stage >= 1 ? 'Owns a bar that does not lose money. Yet.' : 'Opening a bar. Talks about nothing else.';
    case 'hermit': return 'Has stopped answering the door. Plays better than ever, alone.';
    case 'spiral': return w < 20 ? 'On a slide and enjoying the view.' : 'A long way down the slide now. Everyone can see it but them.';
  }
}

const eligible = (s: GameState, m: Musician) => !m.isPlayer && !m.arc && m.outWeeks === 0 && m.weeksInBand >= 26 && s.week >= 52;

/** Pick an arc for a member, from who they are. */
function pickArc(s: GameState, m: Musician, rng: Rng): ArcKind {
  const w: [ArcKind, number][] = [
    ['wedding', 3 + (m.hidden.reliability >= 60 ? 2 : 0) + (m.age >= 27 ? 2 : 0)],
    ['faith', 1 + (m.habit >= 40 ? 2 : 0) + (m.hidden.vice <= 40 ? 1 : 0)],
    ['mogul', 1 + (s.money >= 50000 ? 2 : 0) + (m.hidden.ego >= 60 ? 1 : 0)],
    ['hermit', 1 + (m.hidden.ego <= 40 ? 2 : 0) + (m.skill >= 75 ? 1 : 0)],
    ['spiral', 1 + (m.hidden.vice >= 65 ? 3 : 0) + (m.habit >= 50 ? 2 : 0) + (s.fans >= 50000 ? 1 : 0)],
  ];
  const total = w.reduce((a, x) => a + x[1], 0);
  let r = rng.next() * total;
  for (const [k, v] of w) { r -= v; if (r < 0) return k; }
  return 'wedding';
}

/** Weekly: start an arc now and then, and let the running ones work on their people. */
export function arcsWeek(s: GameState, rng: Rng): void {
  for (const m of s.members) {
    if (eligible(s, m) && rng.chance(0.0025) && !s.pending) {
      const kind = pickArc(s, m, rng);
      m.arc = { kind, since: s.week, stage: 0 };
      s.pending = { def: `arc_${kind}`, params: { m: m.id }, week: s.week };
      continue;
    }
    const a = m.arc;
    if (!a) continue;
    const w = s.week - a.since;
    switch (a.kind) {
      case 'wedding':
        if (m.habit > 10 && rng.chance(0.3)) adjust(m, 'habit', -1);
        if (s.tour && s.tour.week >= 5 && rng.chance(0.4)) adjust(m, 'mood', -2);
        if (w === 40 && a.stage === 0) { a.stage = 1; adjust(m, 'mood', 12); log(s, `${first(m)} is a parent. A photograph went round the van: a small, furious face in a ${s.bandName} T-shirt. ${first(m)} has not slept and does not care.`, 'good'); milestone(s, 'lineup', `${m.name} became a parent.`); }
        if (a.stage >= 1 && s.tour && s.tour.week >= 8 && rng.chance(0.3)) { adjust(m, 'mood', -3); m.hidden.loyalty = clamp(m.hidden.loyalty - 1, 1, 99); }
        break;
      case 'faith':
        if (m.habit > 0 && rng.chance(0.6)) adjust(m, 'habit', -2);
        if (rng.chance(0.1)) adjust(m, 'writing', 1);
        if (s.flags.lastBigParty === s.week && rng.chance(0.5)) { adjust(m, 'mood', -4); for (const o of available(s)) if (o.id !== m.id && o.habit >= 40) addAffinity(s, m.id, o.id, -1); }
        break;
      case 'mogul':
        if (a.stage === 0 && w >= 30) { a.stage = 1; log(s, `${first(m)}'s bar opened. Half the band were there, the other half were behind it. It took £${rng.int(400, 1400)} on the first night, which ${first(m)} has mentioned.`, 'neutral'); }
        if (a.stage >= 1 && s.week % 13 === 0) { const take = rng.int(-800, 1600); if (take > 0) { s.money += take; log(s, `${first(m)}'s bar paid the band a dividend of £${take}. ${first(m)} would like that noted.`, 'good'); } else { adjust(m, 'mood', -3); log(s, `${first(m)}'s bar had a bad quarter. ${first(m)} is not talking about the bar.`, 'neutral'); } }
        if (rng.chance(0.1)) adjust(m, 'mood', -1);
        break;
      case 'hermit':
        if (rng.chance(0.15)) adjust(m, 'skill', 1);
        if (rng.chance(0.08)) adjust(m, 'stage', -1);
        if (rng.chance(0.1)) adjust(m, 'image', -1);
        for (const o of available(s)) if (o.id !== m.id && rng.chance(0.08)) addAffinity(s, m.id, o.id, -1);
        break;
      case 'spiral':
        if (rng.chance(0.5)) adjust(m, 'habit', 2);
        if (rng.chance(0.1)) adjust(m, 'mood', 3);
        if (w >= 30 && rng.chance(0.02)) { delete m.arc; log(s, `${first(m)} woke up in a hospital in ${rng.pick(['Hamburg', 'Leeds', 'Rotterdam', 'Glasgow'])} and decided, for now, to stop. The slide is over. The bill is not.`, 'neutral'); m.habit = Math.round(m.habit * 0.5); }
        break;
    }
  }
}

const who = (s: GameState, p: Record<string, string | number>) => s.members.find((m) => m.id === p.m)!;

export const ARC_EVENTS: EventDef[] = [
  {
    id: 'arc_wedding',
    weight: 0,
    when: (s) => { const m = s.members.find((x) => x.arc?.kind === 'wedding' && x.arc.since === s.week); return m ? { m: m.id } : null; },
    title: (s, p) => `${first(who(s, p))} is getting married`,
    text: (s, p) => `${first(who(s, p))} stood up in the rehearsal room, went red, and said it: married, in June, a registry office and a function room, and the band is invited. ${first(who(s, p))} would like the band to play. ${first(who(s, p))}'s intended would like the band to behave.`,
    options: (s, p) => [
      { label: 'Play the wedding, behave', hint: 'A day lost, a friend for life. Affinity up all round.', resolve: (st) => { const m = who(st, p); for (const o of available(st)) { adjust(o, 'mood', 5); if (o.id !== m.id) addAffinity(st, m.id, o.id, 8); } m.hidden.loyalty = clamp(m.hidden.loyalty + 10, 1, 99); log(st, `The band played the wedding, sober until the speeches and nearly sober after. ${first(m)} cried during the slow one. So did the mother-in-law, for different reasons.`, 'good'); } },
      { label: 'Play the wedding, do not behave', hint: 'The best night of the year and the worst speech. Habit up, a story for life.', resolve: (st, rng) => { const m = who(st, p); for (const o of available(st)) { adjust(o, 'mood', 8); adjust(o, 'habit', rng.int(2, 6)); if (o.id !== m.id) addAffinity(st, m.id, o.id, 3); } addBuzz(st, 3); log(st, `The band played the wedding. The drummer made a speech. The speech is why the function room no longer takes bands. ${first(m)}'s intended has forgiven everyone but the drummer.`, 'neutral'); } },
      { label: 'Send a toaster and a card', hint: `${first(who(s, p))} notices who was not there.`, resolve: (st) => { const m = who(st, p); adjust(m, 'mood', -8); m.hidden.loyalty = clamp(m.hidden.loyalty - 8, 1, 99); addAffinity(st, m.id, 'p', -6); log(st, `A toaster. ${first(m)} said thank you in a voice. The photographs of the wedding have a gap in them where the band should be.`, 'bad'); } },
    ],
  },
  {
    id: 'arc_faith',
    weight: 0,
    when: (s) => { const m = s.members.find((x) => x.arc?.kind === 'faith' && x.arc.since === s.week); return m ? { m: m.id } : null; },
    title: (s, p) => `${first(who(s, p))} has found God`,
    text: (s, p) => `Somewhere on the M6, at four in the morning, ${first(who(s, p))} found God, or God found ${first(who(s, p))}; the account varies. ${first(who(s, p))} has poured everything down the sink, including the good stuff, and would like a word with the band about the lyrics.`,
    options: (_s, p) => [
      { label: 'Good for them. Leave the lyrics alone', hint: 'Live and let live. The habit goes; the sermons stay.', resolve: (st) => { const m = who(st, p); adjust(m, 'mood', 6); m.habit = Math.round(m.habit * 0.3); log(st, `${first(m)} is clean, calm and keen to talk about it. The band has learned to nod. The playing is better; the van is quieter.`, 'neutral'); } },
      { label: 'Let them write one. See what happens', hint: 'A hymn in the set, written by the convert. It might be the one.', resolve: (st, rng) => { const m = who(st, p); const q = clamp(m.writing + rng.int(-5, 25), 20, 95); st.songs.push({ title: rng.pick(['Light Over the Motorway', 'Mercy Street', 'Saved at the Services', 'Hallelujah Hard Shoulder']), quality: q, writer: m.id, kind: 'ballad', genre: st.members[0].style, released: false }); adjust(m, 'mood', 10); log(st, `${first(m)} wrote it in a night. "${st.songs.at(-1)!.title}" (${q}). Nobody knows what to do with it, including ${first(m)}.`, 'good'); } },
      { label: '"Not in this band." Draw the line', hint: 'The band is the band. The convert may not stay.', resolve: (st, rng) => { const m = who(st, p); if (m.hidden.loyalty < 45 && rng.chance(0.5)) { removeMember(st, m.id, 'quit'); log(st, `${m.name} left, in peace, with a smile that nobody could argue with. There is a gospel record out next year.`, 'bad'); } else { adjust(m, 'mood', -10); m.hidden.loyalty = clamp(m.hidden.loyalty - 8, 1, 99); log(st, `${first(m)} stayed, quietly, and prays for the band in the van. Out loud.`, 'neutral'); } } },
    ],
  },
  {
    id: 'arc_mogul',
    weight: 0,
    when: (s) => { const m = s.members.find((x) => x.arc?.kind === 'mogul' && x.arc.since === s.week); return m ? { m: m.id } : null; },
    title: (s, p) => `${first(who(s, p))} is opening a bar`,
    text: (s, p) => `${first(who(s, p))} has a lease, a name ("${first(who(s, p))}'s"), a business plan on a beer mat and a question: would the band like to invest? "It cannot fail. Everyone drinks."`,
    options: (s, p) => {
      const ask = Math.round(clamp(s.money * 0.1, 500, 40000));
      return [
        { label: `Invest £${ask.toLocaleString('en-GB')}`, hint: 'A share of a bar. Dividends if it works, silence if it does not.', cost: ask, resolve: (st) => { const m = who(st, p); st.flags.barShare = 1; adjust(m, 'mood', 10); addAffinity(st, m.id, 'p', 6); log(st, `The band is in the bar business. ${first(m)} has had cards printed with "Director" on them.`, 'neutral'); } },
        { label: 'Wish them luck and keep your money', hint: `${first(who(s, p))} understands. ${first(who(s, p))} will mention it.`, resolve: (st) => { const m = who(st, p); adjust(m, 'mood', -3); log(st, `${first(m)} opened the bar with a loan from an uncle. The band drinks there at full price, as a point.`, 'neutral'); } },
      ];
    },
  },
  {
    id: 'arc_hermit',
    weight: 0,
    when: (s) => { const m = s.members.find((x) => x.arc?.kind === 'hermit' && x.arc.since === s.week); return m ? { m: m.id } : null; },
    title: (s, p) => `${first(who(s, p))} has stopped answering the door`,
    text: (s, p) => `${first(who(s, p))} turns up to rehearsal, plays better than anyone has ever heard, and leaves without a word. No pub, no parties, no photographs. The phone rings out. The roadie says the curtains have been shut for a month.`,
    options: (_s, p) => [
      { label: 'Leave them be. Genius needs the curtains shut', hint: 'The playing climbs. The band drifts a little. The press notices the empty space in the photos.', resolve: (st) => { const m = who(st, p); adjust(m, 'mood', 4); log(st, `You left ${first(m)} alone. The solos got longer and stranger and better. The photographs have four people and a shadow.`, 'neutral'); } },
      { label: 'Go round with a bottle and sit on the step', hint: 'Takes a week. Might open the door; might not.', resolve: (st, rng) => { const m = who(st, p); if (rng.chance(0.6)) { addAffinity(st, m.id, 'p', 10); adjust(m, 'mood', 8); delete m.arc; log(st, `An hour on the step, then the door opened. Four hours of talk, no music. ${first(m)} came to the pub on Friday, sat in the corner, and was there.`, 'good'); } else { adjust(m, 'mood', -2); log(st, `The door did not open. A note came under it: "Rehearsal Tuesday. Thanks for the bottle."`, 'neutral'); } } },
    ],
  },
  {
    id: 'arc_spiral',
    weight: 0,
    when: (s) => { const m = s.members.find((x) => x.arc?.kind === 'spiral' && x.arc.since === s.week); return m ? { m: m.id } : null; },
    title: (s, p) => `${first(who(s, p))} is on a slide`,
    text: (s, p) => `Everybody has seen it and nobody has said it: ${first(who(s, p))} is on the slide. Later every night, earlier every morning, and, for now, playing like a god on it. The roadie has started carrying ${first(who(s, p))}'s bag. The bag is heavy.`,
    options: (_s, p) => [
      { label: 'Say nothing. Ride it while it plays', hint: 'Legendary nights, for a while. Then the bill.', resolve: (st) => { const m = who(st, p); adjust(m, 'stage', 3); adjust(m, 'mood', 5); addBuzz(st, 4); log(st, `Nobody said anything. ${first(m)} played the gig of the year on Thursday and could not be found on Friday.`, 'neutral'); } },
      { label: 'A quiet word, one to one', hint: 'Loyalty decides whether it lands. Either way, they know you saw.', resolve: (st, rng) => { const m = who(st, p); if (rng.chance(m.hidden.loyalty / 100)) { delete m.arc; adjust(m, 'habit', -15); addAffinity(st, m.id, 'p', 8); log(st, `A long talk in a car park. ${first(m)} cried, then laughed, then handed over the bag. It is not over, but it has stopped.`, 'good'); } else { adjust(m, 'mood', -8); addAffinity(st, m.id, 'p', -5); log(st, `${first(m)} said "I'm fine" in the voice that means the opposite, and was late the next day on purpose.`, 'bad'); } } },
      { label: 'The clinic. Now. No argument', hint: 'Three weeks out, habit cut hard, a grudge for a while.', cost: 60, resolve: (st) => { const m = who(st, p); delete m.arc; m.outWeeks = Math.max(m.outWeeks, 3); m.habit = Math.round(m.habit * 0.3); adjust(m, 'mood', -10); m.hidden.loyalty = clamp(m.hidden.loyalty - 5, 1, 99); log(st, `${first(m)} went to the clinic in the manager's car, swearing. Three weeks. ${first(m)} will be back, thinner, clearer, and not speaking to you until the first gig.`, 'neutral'); } },
    ],
  },
];
