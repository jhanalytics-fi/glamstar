// The music press: four papers with four sets of prejudices, stars out of five, a line for the sleeve
// sticker, and now and then a question with a microphone in your face and four ways to answer it.
import { Rng, clamp } from './rng';
import { available } from './chemistry';
import { addBuzz, adjust, first, log, player } from './helpers';
import { addAffinity } from './chemistry';
import { PRESS } from './names';
import type { EventDef } from './events';
import type { GameState, Release, Review } from './types';
import type { StarGenre as Genre } from './world';

interface Paper { name: string; likes: Genre[]; hates: Genre[]; /** How much the paper's stars move sales. */ weight: number }
export const PAPERS: Paper[] = [
  { name: PRESS, likes: ['glam', 'newwave', 'punk'], hates: [], weight: 1 },
  { name: 'The Gramophone Gazette', likes: ['hardrock'], hates: ['pop', 'glam'], weight: 0.6 },
  { name: 'Smash!', likes: ['pop', 'glam', 'newwave'], hates: ['metal', 'punk'], weight: 1.2 },
  { name: 'Kerrunch', likes: ['metal', 'hardrock'], hates: ['pop', 'newwave'], weight: 0.8 },
];

const QUOTES: Record<number, string[]> = {
  1: ['A record that should have stayed a rumour.', 'Eight songs, one idea, no excuse.', 'The sleeve is the best thing about it, and the sleeve is cream.', 'Played it twice. The second time was a mistake.'],
  2: ['Competent, which is the cruellest word we have.', 'There is a good single in here. It is on somebody else\'s album.', 'The drummer is trying. So is the listener.', 'Loud, long and, by side two, lonely.'],
  3: ['Does what it says on the leather jacket.', 'Half a great record. The other half is the other half.', 'Solid, honest, and about as surprising as rain.', 'You will play it at parties. You will not notice when it ends.'],
  4: ['The band has found the sound it was shouting about.', 'Every chorus arrives like a mate at the door with beer.', 'Loud, lewd and gloriously unnecessary.', 'If this is a cash-in, send more cash.'],
  5: ['The record the decade was waiting for and did not deserve.', 'Nothing on it is less than the one. Buy two: one to play, one to lend and lose.', 'We have run out of stars. We have asked for more.', 'Forty minutes that will be in every bedroom in the country by Friday, and should be.'],
};

/** Stars out of five for a record, from one paper: quality, genre prejudice, and a reviewer's mood. */
function stars(p: Paper, r: Release, genre: Genre, rng: Rng): number {
  let v = (r.quality - 30) / 14; // 30 -> 0, 86 -> 4
  if (p.likes.includes(genre)) v += 0.6;
  if (p.hates.includes(genre)) v -= 0.9;
  if (r.comp === 'hits') v -= 0.5;
  if (r.comp === 'live') v -= 0.3;
  if (r.double) v += rng.chance(0.5) ? 0.5 : -0.7;
  v += rng.next() * 1.2 - 0.6;
  return clamp(Math.round(v), 1, 5);
}

/** Review a new record: one or two papers, stars, a quote, and a nudge to how it sells. Returns the average. */
export function reviewRecord(s: GameState, rng: Rng, r: Release): number {
  const genre = s.members[0].style;
  const n = s.fans >= 5000 ? 2 : rng.chance(0.6) ? 1 : 0;
  if (!n) return 1;
  const papers = rng.shuffle([...PAPERS]).slice(0, n);
  const reviews: Review[] = papers.map((p) => { const st = stars(p, r, genre, rng); return { paper: p.name, stars: st, quote: rng.pick(QUOTES[st]) }; });
  r.reviews = reviews;
  const avg = reviews.reduce((a, x) => a + x.stars, 0) / reviews.length;
  const w = reviews.reduce((a, x) => a + (PAPERS.find((p) => p.name === x.paper)?.weight ?? 1), 0) / reviews.length;
  const mult = 1 + (avg - 3) * 0.08 * w; // one star either way is about 8% on sales
  r.appeal *= mult;
  const best = [...reviews].sort((a, b) => b.stars - a.stars)[0];
  const worst = [...reviews].sort((a, b) => a.stars - b.stars)[0];
  if (avg >= 4) { addBuzz(s, 4); for (const m of available(s)) adjust(m, 'mood', 3); }
  if (avg <= 2) { addBuzz(s, -3); for (const m of available(s)) adjust(m, 'mood', -4); }
  log(s, `${best.paper}, ${'★'.repeat(best.stars)}${'☆'.repeat(5 - best.stars)}: "${best.quote}"${reviews.length > 1 && worst !== best ? ` ${worst.paper} gave it ${worst.stars}: "${worst.quote}"` : ''}`, avg >= 3.5 ? 'good' : avg <= 2 ? 'bad' : 'neutral');
  return mult;
}

// ---------------------------------------------------------------- the press conference

const Q = (s: GameState, rng: Rng) => {
  const me = player(s);
  const mates = s.members.filter((m) => !m.isPlayer && m.outWeeks === 0);
  const mate = mates.length ? rng.pick(mates) : null;
  const rec = [...s.releases].reverse().find((r) => r.kind !== 'demo');
  const rival = s.world.rivals.length ? rng.pick(s.world.rivals).name : 'the other lot';
  return { me, mate, rec, rival };
};

export const PRESS_EVENTS: EventDef[] = [
  {
    id: 'press_question',
    weight: 4,
    where: 'home',
    when: (s, rng) => {
      const recent = s.releases.some((r) => r.kind !== 'demo' && s.week - r.week <= 2) || (s.flags.legendaryGigs ?? 0) > (s.flags.pressQLegends ?? 0);
      if (s.fans < 300 || !recent || (s.flags.pressQ !== undefined && s.week - s.flags.pressQ < 10)) return null;
      return { q: rng.int(0, 4), seed: rng.int(1, 1e9) };
    },
    title: () => `${PRESS} has a question`,
    text: (s, p) => {
      const rng = new Rng(Number(p.seed));
      const { mate, rec, rival } = Q(s, rng);
      const qs = [
        `A journalist with a tape recorder, backstage, no warning: "${rival} say you stole your sound from them. Comment?"`,
        `The interview is going fine until: "Is it true ${mate ? first(mate) : 'the drummer'} nearly left last month?"`,
        `"${rec ? `'${rec.title}'` : 'The new record'}: a step forward, or the same record again with a new sleeve?"`,
        `"You have been called the most dangerous band in Britain. What do you say to parents?"`,
        `"Three questions in and I have to ask: are you in it for the music or the money?"`,
      ];
      return qs[Number(p.q)];
    },
    options: (s, p) => {
      const rng = new Rng(Number(p.seed));
      const { mate, rival } = Q(s, rng);
      const done = (st: GameState) => { st.flags.pressQ = st.week; st.flags.pressQLegends = st.flags.legendaryGigs ?? 0; };
      const q = Number(p.q);
      const sets: { label: string; hint: string; resolve: (st: GameState, r: Rng) => void }[][] = [
        [
          { label: `"${rival} couldn't steal a sound. They'd drop it."`, hint: 'A quote for the cover. A feud for the year.', resolve: (st) => { done(st); addBuzz(st, 8); st.flags.feud = st.week; log(st, `Headline: "${st.bandName} v ${rival}: it's war". ${rival} replied in print. Their reply was worse than yours, which is the point.`, 'good'); } },
          { label: '"We all steal. Ask them who they stole from."', hint: 'Clever. Nobody prints clever.', resolve: (st) => { done(st); addBuzz(st, 2); log(st, 'A paragraph on page nine. Clever does not sell papers.', 'neutral'); } },
          { label: '"They\'re a great band. Next question."', hint: 'Gracious. The band thinks you went soft.', resolve: (st) => { done(st); for (const m of available(st)) if (m.hidden.ego >= 60) adjust(m, 'mood', -3); log(st, 'Gracious. The paper called it "diplomatic", the drummer called it something else.', 'neutral'); } },
          { label: 'Walk out', hint: 'No quote, a photograph of your back, and a legend of sorts.', resolve: (st) => { done(st); addBuzz(st, 4); adjust(player(st), 'image', 1); log(st, 'A photograph of the back of your jacket and the caption "No comment". The jacket looked great.', 'neutral'); } },
        ],
        [
          { label: `"${mate ? first(mate) : 'Nobody'} isn't going anywhere."`, hint: 'Loyalty in print. It is noticed in the band.', resolve: (st) => { done(st); if (mate) { const x = st.members.find((m) => m.id === mate.id); if (x) { adjust(x, 'mood', 6); x.hidden.loyalty = clamp(x.hidden.loyalty + 5, 1, 99); addAffinity(st, x.id, 'p', 4); } } log(st, `In print, in bold: "${mate ? first(mate) : 'Nobody'} isn't going anywhere." ${mate ? first(mate) : 'The drummer'} cut it out and kept it.`, 'good'); } },
          { label: '"Everybody nearly leaves every month. It\'s a band."', hint: 'True, funny, and a headline about a band in crisis.', resolve: (st) => { done(st); addBuzz(st, 5); for (const m of available(st)) adjust(m, 'mood', -2); log(st, 'Headline: "CRISIS". The quote was a joke. The headline was not.', 'neutral'); } },
          { label: '"Who told you that?"', hint: 'Defensive. Now they know it is true.', resolve: (st) => { done(st); addBuzz(st, 3); if (mate) { const x = st.members.find((m) => m.id === mate.id); if (x) adjust(x, 'mood', -4); } log(st, '"Who told you that?" is a yes, in every language. The paper ran it as one.', 'bad'); } },
          { label: `"Ask ${mate ? first(mate) : 'them'}."`, hint: 'Pass the microphone. Whatever they say, it is on them.', resolve: (st, r) => { done(st); const x = mate ? st.members.find((m) => m.id === mate.id) : null; if (x && r.chance(x.hidden.loyalty / 100)) { adjust(x, 'mood', 4); log(st, `${first(x)} took the microphone and said "I'm here, aren't I?" and the room laughed. Good answer.`, 'good'); } else if (x) { addBuzz(st, 4); adjust(x, 'mood', -3); log(st, `${first(x)} took the microphone and said "no comment" in a voice. The paper heard the voice.`, 'bad'); } } },
        ],
        [
          { label: '"It\'s the best thing we\'ve done."', hint: 'What everyone says. Harmless.', resolve: (st) => { done(st); addBuzz(st, 1); log(st, 'The quote every band gives. It ran next to a photograph of a different band.', 'neutral'); } },
          { label: '"It\'s the same record. That\'s the point. Nobody else can make it."', hint: 'Confidence. The fans love it, the critics sharpen pencils.', resolve: (st) => { done(st); addBuzz(st, 5); st.fans += Math.round(st.fans * 0.01); log(st, '"Nobody else can make it" is on T-shirts within a month. The critics called it arrogant, in a tone that sold tickets.', 'good'); } },
          { label: '"The next one will be different. Completely."', hint: 'A promise in print. The label will hold you to it; so will the fans.', resolve: (st) => { done(st); addBuzz(st, 3); st.flags.promisedChange = st.week; log(st, 'A promise. It is in the cuttings file now, with a date on it.', 'neutral'); } },
          { label: '"Have you listened to it?"', hint: 'Rude. Journalists remember rude.', resolve: (st) => { done(st); addBuzz(st, 2); adjust(player(st), 'image', 1); log(st, 'The journalist had not listened to it. The journalist will listen to the next one very carefully.', 'neutral'); } },
        ],
        [
          { label: '"Lock up your daughters. And your sons. And the dog."', hint: 'The quote of the year. Buzz up, a vicar\'s letter, parents cross.', resolve: (st) => { done(st); addBuzz(st, 10); for (const m of available(st)) adjust(m, 'image', 1); log(st, 'The quote went round the world. A vicar wrote. A newsagent put a sticker on the paper. Everyone under twenty bought one.', 'good'); } },
          { label: '"We\'re a rock band. We\'re about as dangerous as a sandwich."', hint: 'Honest and funny. Mums like you. The kids less.', resolve: (st) => { done(st); addBuzz(st, 2); st.fans += Math.round(st.fans * 0.005); log(st, '"Dangerous as a sandwich" made the parents laugh and the kids wince. Both bought the record.', 'neutral'); } },
          { label: '"Parents should come to a gig."', hint: 'Sweet. Nobody prints sweet. A few do come.', resolve: (st) => { done(st); st.fans += Math.round(20 + st.fans * 0.003); log(st, 'Three sets of parents came to the next gig. One of them danced. The drummer has not recovered.', 'neutral'); } },
          { label: 'Say nothing and light a cigarette', hint: 'Image. Nothing but image.', resolve: (st) => { done(st); adjust(player(st), 'image', 2); addBuzz(st, 3); log(st, 'The photograph is of a cigarette and a stare. It is the best photograph of the band there is.', 'good'); } },
        ],
        [
          { label: '"The music. Obviously."', hint: 'The answer. Nobody believes it, everyone prints it.', resolve: (st) => { done(st); addBuzz(st, 1); log(st, '"The music, obviously." Printed under a photograph of the car.', 'neutral'); } },
          { label: '"The money. Obviously."', hint: 'Honest. The press loves it, the purists in the band do not.', resolve: (st) => { done(st); addBuzz(st, 6); for (const m of available(st)) if (m.style === 'punk' || m.style === 'metal') adjust(m, 'mood', -4); log(st, '"The money, obviously" was the headline. The guitarist is not speaking to the headline.', 'neutral'); } },
          { label: '"The girls. Boys. Whoever\'s there."', hint: 'A quote that follows you around. Image up, some fans gone.', resolve: (st) => { done(st); adjust(player(st), 'image', 2); addBuzz(st, 5); st.fans -= Math.round(st.fans * 0.01); log(st, 'The quote is in the cuttings file for life. It is also on a badge.', 'neutral'); } },
          { label: '"Can I have a drink first?"', hint: 'The journalist buys. The interview goes on for six hours and nothing printable survives.', resolve: (st) => { done(st); adjust(player(st), 'habit', 3); adjust(player(st), 'mood', 4); log(st, 'Six hours later the journalist had no notes and a new best friend. The piece was kind, and short.', 'neutral'); } },
        ],
      ];
      return sets[q];
    },
  },
];
