// The manager as a person in the room: things they say, things they do without being asked, and the
// odd special they bring in. What they say depends on who they are; whether it helps depends on how
// good they are.
import { Rng, clamp } from './rng';
import { addBuzz, adjust, first, log, milestone } from './helpers';
import { pickRivalName } from './world';
import { labelById } from './labels';
import type { GameState, ManagerKind, Musician } from './types';

type Mood = 'badGig' | 'goodGig' | 'flop' | 'hit' | 'broke' | 'rich' | 'habit' | 'quiet' | 'idle' | 'tour' | 'any';

const VOICE: Record<ManagerKind, Partial<Record<Mood, string[]>>> = {
  hustler: {
    badGig: ['"Bad room, sweetheart. I know a better one."', '"They were a wedding crowd. I booked it. My fault. Next one is proper."'],
    goodGig: ['"Told you. Told you! I have three more like that by Friday."', '"That promoter owes me now. I will collect."'],
    flop: ['"Records. Who buys records? Gigs. We do gigs."'],
    hit: ['"We are not sleeping until Christmas. I have the phone."'],
    broke: ['"Skint is a state of mind. Also I have a corporate do on Thursday."', '"I have had an idea. You will not like it. It pays."'],
    habit: ['"{m} needs to be on stage, not in the toilets. Have a word, or I will."'],
    idle: ['"Three weeks and no gig. The phone has not stopped and I have not answered it, because what would I say?"'],
    any: ['"Everything is going to plan. There is no plan. That is the plan."', '"Sign nothing. Ring me. Ring me first."'],
  },
  suit: {
    badGig: ['"A loss of £140 on the night after costs. I have a spreadsheet."'],
    goodGig: ['"Takings up 40% on the last one. I have noted it."'],
    flop: ['"The budget on that record was unrealistic. I said so in writing. Page four."', '"Under-recouped by a sum I will not say in front of the drummer."'],
    hit: ['"The royalty statement will be interesting. I will read it twice."'],
    broke: ['"We are spending more than we earn. This is a sentence, not an opinion."', '"I have cancelled the florist."'],
    rich: ['"The tax position needs attention. I have a man."', '"Do not buy the boat. I know about the boat."'],
    habit: ['"{m}\'s expenses this month are medical, in the loosest sense."'],
    quiet: ['"{m} has not cashed the last two cheques. People who are leaving do that."'],
    any: ['"I have read the contract. All of it. You should sit down."', '"Clause nine is fine now. It was not fine before."'],
  },
  nanny: {
    badGig: ['"Bad night. Bath, bed, breakfast. Tomorrow is a different night."'],
    goodGig: ['"Lovely. Now drink some water, all of you."'],
    flop: ['"A record is a record. The band is the band. Eat something."'],
    habit: ['"I have {m}\'s keys and {m}\'s wallet and I am not giving them back until Monday."', '"I have put {m} to bed. {m} is twenty-six and I have put {m} to bed."'],
    quiet: ['"{m} has gone quiet. {m} does not go quiet. I am taking {m} for a walk."', '"Something is up with {m}. I have made a note and a sandwich."'],
    tour: ['"Passports, pills, pants. In that order. Bus leaves at nine."'],
    idle: ['"A rest is a rest. Nobody is allowed to feel guilty about it."'],
    any: ['"Everyone\'s mother has my number. Behave accordingly."', '"Aspirin is on the dashboard. Do not ask why."'],
  },
  godfather: {
    badGig: ['"The promoter paid in full. He understood."', '"The sound man has been spoken to. He will not be a problem."'],
    goodGig: ['"Good. The door takings were higher than the promoter said. He has corrected it."'],
    flop: ['"The shops will stock the next one. I have visited the shops."'],
    hit: ['"Now we talk to the label about the money. I will do the talking."'],
    broke: ['"Money is not a problem. Money is never a problem. People are a problem."'],
    habit: ['"{m} has a friend who sells things. The friend has moved away."'],
    any: ['"Sign nothing. Say nothing. Ring me."', '"I have a cousin at the pressing plant. We will be fine."'],
  },
  visionary: {
    badGig: ['"The room was wrong. The lighting was wrong. You were, mostly, right."'],
    goodGig: ['"That is the band I saw in my head. I want it on film."'],
    flop: ['"The sleeve was wrong. I said white. They used cream."'],
    hit: ['"Now the video. I have a concept. There is a horse."'],
    rich: ['"Stop buying cars. Buy a look."'],
    habit: ['"{m} looks fantastic, actually. Thin. Haunted. Keep it, for the photographs, within reason."'],
    quiet: ['"{m} is brooding. Brooding sells. Do not fix it yet."'],
    any: ['"I have been thinking about your hair."', '"The next record is a concept. The concept is: more."'],
  },
};

const sit = (s: GameState, rng: Rng): { mood: Mood; who?: Musician } => {
  const last = s.scene;
  const here = s.members.filter((m) => m.outWeeks === 0);
  const high = [...here].sort((a, b) => b.habit - a.habit)[0];
  const low = [...here].filter((m) => !m.isPlayer).sort((a, b) => a.mood - b.mood)[0];
  if (high && high.habit >= 60 && rng.chance(0.6)) return { mood: 'habit', who: high };
  if (low && low.mood < 35 && rng.chance(0.6)) return { mood: 'quiet', who: low };
  if (s.flags.flop !== undefined && s.week - s.flags.flop <= 2) return { mood: 'flop' };
  if (s.money < 50) return { mood: 'broke' };
  if (s.money > 500000 && rng.chance(0.5)) return { mood: 'rich' };
  if (s.tour) return { mood: 'tour' };
  if (last?.kind === 'gig' && last.verdict) return { mood: last.verdict.tone === 'good' ? 'goodGig' : last.verdict.tone === 'bad' ? 'badGig' : 'any' };
  const idle = s.week - Math.max(s.lastGigWeek ?? -99, s.flags.lastTourWeek ?? -99);
  if (idle >= 4 && rng.chance(0.5)) return { mood: 'idle' };
  if (s.world.peaks.uk === 1 && s.releases.some((r) => s.week - r.week <= 3) && rng.chance(0.5)) return { mood: 'hit' };
  return { mood: 'any' };
};

/** Something the manager says this week, if anything. */
export function managerComment(s: GameState, rng: Rng): void {
  const m = s.manager;
  if (!m || !rng.chance(0.3)) return;
  const kind = m.kind ?? 'hustler';
  const { mood, who } = sit(s, rng);
  const lines = VOICE[kind][mood] ?? VOICE[kind].any ?? [];
  if (!lines.length) return;
  const line = rng.pick(lines).replace(/\{m\}/g, who ? (who.isPlayer ? 'you' : first(who)) : 'somebody');
  log(s, `${m.name.split(' ')[0]}: ${line}`, 'neutral');
}

/** What the manager has lined up this week: one special gig, shown in the gig menu. */
export interface Special { id: string; label: string; hint: string; venue: string; capacity: number; crowd: [number, number]; fee: number; fanMult: number; buzz: number; image: number }

export function managerSpecial(s: GameState): Special | null {
  const m = s.manager;
  if (!m || s.flags.mgrSpecialWeek !== s.week) return null;
  const k = s.flags.mgrSpecial ?? 1;
  const name = m.name.split(' ')[0];
  const fee = Math.round(((150 + s.fans * 0.25) * (0.6 + m.clout / 100) * 1.5) / 10) * 10;
  if (k === 1) return { id: 'mgr_private', label: `${name}'s special: a private do`, hint: `A shipping heir's birthday, a car launch, a wedding in Surrey: £${fee.toLocaleString('en-GB')} for one night nobody will admit to. Energy -8, no new fans to speak of.`, venue: 'a private party nobody will admit to', capacity: 300, crowd: [120, 300], fee, fanMult: 0.1, buzz: 0, image: 0 };
  if (k === 2) return { id: 'mgr_support', label: `${name}'s special: a support slot on a big night`, hint: `Opening for a bigger act in front of their crowd. Small fee, a lot of new faces, a chance to steal them.`, venue: `the support slot on a big night ${name} talked the band into`, capacity: Math.round(clamp(s.fans * 2, 600, 60000)), crowd: [Math.round(clamp(s.fans * 1.2, 400, 40000)), Math.round(clamp(s.fans * 2, 600, 60000))], fee: Math.round(fee / 4), fanMult: 1.7, buzz: 4, image: 0 };
  return { id: 'mgr_gala', label: `${name}'s special: a charity gala on television`, hint: 'No fee, the cameras, a duet with somebody famous and a dress code. Image up, fans up, the band in make-up.', venue: 'a televised charity gala', capacity: 2000, crowd: [1500, 2000], fee: 0, fanMult: 3.5, buzz: 12, image: 3 };
}

/** The manager's week: specials brought in, favours done, the label leaned on, the shark spoken to. */
export function managerActs(s: GameState, rng: Rng): void {
  const m = s.manager;
  if (!m || s.tour) return;
  const kind = m.kind ?? 'hustler';
  const name = m.name.split(' ')[0];
  // A special gig for next week: the hustler and the heavy bring them in; the visionary brings the telly.
  const odds = kind === 'hustler' ? 0.3 : kind === 'godfather' ? 0.22 : kind === 'visionary' ? 0.18 : 0.08;
  if (s.fans >= 150 && rng.chance(odds + m.clout / 500)) {
    s.flags.mgrSpecialWeek = s.week + 1;
    s.flags.mgrSpecial = kind === 'visionary' && s.fans >= 2000 ? 3 : rng.chance(0.55) ? 1 : s.fans >= 500 ? 2 : 1;
  }
  // The accountant leans on the label, unasked, once a quarter.
  if (kind === 'suit' && s.contract && s.contract.unrecouped > 1000 && s.week % 13 === 5) {
    const c = s.contract;
    const l = labelById(c.label);
    if (rng.chance(0.35 + (m.nous ?? 40) / 150)) {
      const off = Math.round(Math.min(c.unrecouped, 400 + c.unrecouped * (0.04 + (m.nous ?? 40) / 600)));
      c.unrecouped -= off;
      log(s, `${name} spent a morning in ${l.name}'s accounts department with a calculator. £${off.toLocaleString('en-GB')} of "promotional expenses" are no longer on the tab.`, 'good');
    } else {
      c.goodwill = clamp(c.goodwill - 3, 0, 100);
      log(s, `${name} sent ${l.name} a four-page letter about the tab. They sent back a one-line one.`, 'neutral');
    }
  }
  // The minder and the heavy keep stories out of the papers.
  if ((kind === 'nanny' || kind === 'godfather') && !s.flags.pressFavour && s.members.some((x) => x.habit >= 55) && rng.chance(0.12 + m.clout / 600)) {
    s.flags.pressFavour = 1;
    log(s, kind === 'nanny' ? `${name} took a Sunday editor's daughter to a gig and got her an autograph. There is a favour in the bank now.` : `${name} had a quiet word with a Sunday editor. The editor is very keen to be helpful.`, 'good');
  }
  // The heavy deals with Big Tony.
  if (kind === 'godfather' && s.flags.shark && rng.chance(0.2)) {
    const owed = s.flags.shark;
    s.flags.shark = 0;
    delete s.flags.shark;
    log(s, `${name} and Big Tony had lunch. Big Tony paid. The £${owed.toLocaleString('en-GB')} is "forgotten", and so, Big Tony hopes, is he.`, 'good');
    milestone(s, 'drama', `${m.name} made Big Tony's debt go away.`);
  }
  // Any manager with clout: a tip about the line-up, now and then.
  if (m.clout >= 40 && s.fans >= 300 && (s.flags.mgrTip === undefined || s.week - s.flags.mgrTip >= 40) && rng.chance(0.04) && s.members.length > 1) {
    const here = s.members.filter((x) => !x.isPlayer && x.outWeeks === 0);
    const weak = [...here].sort((a, b) => a.skill + a.stage - (b.skill + b.stage))[0];
    const avg = here.reduce((a, x) => a + x.skill + x.stage, 0) / Math.max(1, here.length);
    if (weak && weak.skill + weak.stage < avg - 12) {
      s.flags.mgrTip = s.week;
      s.pending ??= { def: 'manager_tip', params: { m: weak.id, rival: pickRivalName(s.world, rng) }, week: s.week };
    }
  }
  // The visionary and anyone with real clout: television, now and then.
  if (s.fans >= 1500 && (kind === 'visionary' || m.clout >= 60) && (s.flags.mgrTv === undefined || s.week - s.flags.mgrTv >= 20) && rng.chance(0.05 + m.clout / 1000)) {
    s.flags.mgrTv = s.week;
    s.pending ??= { def: 'manager_tv', params: {}, week: s.week };
  }
}

/** After a special is played: what it did beyond the gig itself. */
export function afterSpecial(s: GameState, id: string, perf: number): void {
  const m = s.manager;
  if (!m) return;
  const sp = managerSpecial({ ...s, flags: { ...s.flags, mgrSpecialWeek: s.week } });
  if (!sp) return;
  for (const x of s.members) adjust(x, 'image', sp.image);
  if (id === 'mgr_gala') { addBuzz(s, perf >= 55 ? sp.buzz : 2); log(s, perf >= 55 ? 'The gala went out live. The duet was with somebody enormous, who sang the wrong verse. The band looked fantastic in the papers.' : 'The gala went out live. The band looked lost in dinner jackets and the duet was a disaster. The clip will be shown at Christmas for years.', perf >= 55 ? 'good' : 'bad'); }
  else if (id === 'mgr_private') log(s, `${m.name.split(' ')[0]} took the envelope, counted it twice, and gave the band most of it. Nobody mentions the night again.`, 'neutral');
  else log(s, perf >= 55 ? 'Their crowd came in cold and went out yours. The headliner noticed and shortened your set for the next night, which there was not.' : 'Their crowd was their crowd. The bar did well.', perf >= 55 ? 'good' : 'neutral');
}
