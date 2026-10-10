import { Rng, clamp } from './rng';
import { hometown, knownAs, personName } from './names';
import type { Background, Genre, HiddenTrait, Knowledge, Musician, NewGameInput, Role } from './types';

export const HIDDEN_TRAITS: HiddenTrait[] = ['potential', 'ego', 'reliability', 'vice', 'stamina', 'loyalty'];
export const GENRES: Genre[] = ['metal', 'hardrock', 'glam', 'punk', 'newwave'];

export const GENRE_LABEL: Record<Genre, string> = {
  metal: 'Heavy metal',
  hardrock: 'Hard rock',
  glam: 'Glam',
  punk: 'Punk',
  newwave: 'New wave',
};

export const ROLE_LABEL: Record<Role, string> = {
  vocals: 'Vocals',
  guitar: 'Guitar',
  bass: 'Bass',
  drums: 'Drums',
  keys: 'Keys',
};

export const BACKGROUNDS: Record<Background, { label: string; text: string }> = {
  choirboy: { label: 'Choirboy gone wrong', text: 'Trained voice, wobbly morals.' },
  artschool: { label: 'Art school dropout', text: 'Great look, better lyrics, worse habits.' },
  factory: { label: 'Factory kid', text: 'Tough as old boots and always on time.' },
  posh: { label: 'Posh runaway', text: 'Daddy cut you off, but not before a small cheque.' },
};

export type Tier = 'good' | 'average' | 'weak';
const TIER_MEAN: Record<Tier, number> = { good: 62, average: 46, weak: 32 };

const BLURBS = [
  'Works days at a record shop. Judges you for owning the wrong albums.',
  'Has a van. Nobody asks where the van came from.',
  'Learned everything from one live album, played at the wrong speed.',
  'Claims to have jammed with somebody famous once. Details vary.',
  'Still lives with Mum, who irons the stage gear.',
  'Got thrown out of three bands. Swears none of it was their fault.',
  'Quiet until the second pint, then the loudest person in Camden.',
  'Sleeps in the rehearsal room more than is strictly legal.',
  'Has a partner who hates the band and attends every gig.',
  'Plays brilliantly when nobody is watching.',
  'Spends the rent money on hairspray, without regret.',
  'Owns one pair of leather trousers and is rarely seen out of them.',
];

function genreNear(rng: Rng, base: Genre): Genre {
  // Most mates share the singer's taste, some drift.
  const neighbours: Record<Genre, Genre[]> = {
    metal: ['hardrock', 'punk'],
    hardrock: ['metal', 'glam'],
    glam: ['hardrock', 'newwave'],
    punk: ['newwave', 'metal'],
    newwave: ['punk', 'glam'],
  };
  const r = rng.next();
  if (r < 0.5) return base;
  if (r < 0.85) return rng.pick(neighbours[base]);
  return rng.pick(GENRES);
}

export function generateMusician(rng: Rng, id: string, role: Role, tier: Tier, styleBase?: Genre, takenNames: string[] = []): Musician {
  const mean = TIER_MEAN[tier];
  const real = personName(rng, takenNames);
  const age = rng.int(18, 29);
  const skill = rng.around(mean, 14);
  const hidden = {
    ego: rng.int(10, 95),
    reliability: rng.int(10, 95),
    vice: rng.int(10, 95),
    stamina: rng.int(20, 90),
    loyalty: rng.int(10, 95),
    potential: rollPotential(rng, skill, age),
  };
  // Talent and trouble often travel together.
  if (tier === 'good' && rng.chance(0.5)) hidden.ego = clamp(hidden.ego + 20, 1, 99);
  return {
    id,
    name: knownAs(rng, real, takenNames),
    realName: real,
    from: hometown(rng),
    age,
    role,
    isPlayer: false,
    skill,
    stage: rng.around(mean - 4, 20),
    image: rng.around(48, 30),
    writing: rng.around(mean - 8, 24),
    style: styleBase ? genreNear(rng, styleBase) : rng.pick(GENRES),
    hidden,
    known: unknownTraits(),
    energy: rng.int(70, 95),
    mood: rng.int(50, 75),
    habit: rng.int(0, 25),
    outWeeks: 0,
    weeksInBand: 0,
    blurb: rng.pick(BLURBS),
    seen: 15,
    fog: rng.next() * 2 - 1,
  };
}

function unknownTraits(): Record<HiddenTrait, Knowledge> {
  return { ego: 0, reliability: 0, vice: 0, stamina: 0, loyalty: 0, potential: 0 };
}

/**
 * The ceiling a musician can grow to. Young players have more headroom; a few are
 * raw talents with a lot more. Someone starting at 20 will never become a legend.
 */
export function rollPotential(rng: Rng, skill: number, age: number): number {
  const youth = Math.max(0, 30 - age) * 1.2;
  let headroom = youth + rng.int(0, 12);
  if (rng.chance(0.06)) headroom += rng.int(15, 30); // the raw talent nobody has spotted yet
  // Low starters rarely hide much: talent shows early.
  if (skill < 35) headroom *= 0.6;
  return clamp(Math.round(skill + headroom), skill, 99);
}

export function createPlayer(rng: Rng, input: NewGameInput): Musician {
  const p: Musician = {
    id: 'p',
    name: input.stageName?.trim() || input.name.trim() || 'Nobody',
    realName: input.name.trim() || 'Nobody',
    from: hometown(rng),
    age: 20,
    role: 'vocals',
    doubles: input.instrument === 'none' ? undefined : input.instrument,
    isPlayer: true,
    skill: rng.around(52, 8),
    stage: rng.around(55, 8),
    image: rng.around(55, 10),
    writing: rng.around(50, 10),
    style: input.style,
    hidden: {
      ego: rng.int(45, 70),
      reliability: rng.int(40, 70),
      vice: rng.int(30, 70),
      stamina: rng.int(45, 70),
      loyalty: 99,
      potential: 0,
    },
    // You know yourself. Except how much you can handle, and how good you could get.
    known: { ego: 2, reliability: 2, vice: 0, stamina: 2, loyalty: 2, potential: 0 },
    energy: 90,
    mood: 70,
    habit: 5,
    outWeeks: 0,
    weeksInBand: 0,
    blurb: BACKGROUNDS[input.background].text,
    seen: 100,
    fog: 0,
  };
  switch (input.background) {
    case 'choirboy': p.skill += 12; p.hidden.vice += 8; break;
    case 'artschool': p.image += 12; p.writing += 10; p.hidden.vice += 12; break;
    case 'factory': p.hidden.stamina += 18; p.hidden.reliability += 15; p.image -= 5; break;
    case 'posh': p.image += 6; p.hidden.ego += 15; break;
  }
  // A frontperson who also plays splits their focus a little.
  if (p.doubles) p.stage -= 4;
  p.hidden.potential = rollPotential(rng, Math.max(p.skill, p.stage, p.writing), p.age);
  for (const k of ['skill', 'stage', 'image', 'writing'] as const) p[k] = clamp(p[k], 1, 99);
  for (const t of HIDDEN_TRAITS) p.hidden[t] = clamp(p.hidden[t], 1, 99);
  return p;
}

/** The three mates from the pub: always guitar, bass and drums, deliberately uneven. */
export function generateStartingBand(rng: Rng, style: Genre, nextId: () => string, playerName: string): Musician[] {
  const roles: Role[] = ['guitar', 'bass', 'drums'];
  const tiers = rng.shuffle<Tier>(['good', 'average', 'weak']);
  const band: Musician[] = [];
  for (const [i, role] of roles.entries()) {
    const m = generateMusician(rng, nextId(), role, tiers[i], style, [playerName, ...band.flatMap((x) => [x.name, x.realName])]);
    for (let k = 0; k < 10 && band.some((x) => x.blurb === m.blurb); k++) m.blurb = rng.pick(BLURBS);
    band.push(m);
  }
  normaliseBand(band);
  return band;
}

/** Every starting trio is worth the same in total; only the shape differs. Rerolling changes style, not strength. */
export const START_TOTAL_OVR = 138;
export const START_TOTAL_HEADROOM = 36;
const GROWABLE = ['skill', 'stage', 'writing'] as const;

export function headroom(m: Musician): number {
  return m.hidden.potential - Math.max(m.skill, m.stage);
}

function normaliseBand(band: Musician[]): void {
  for (let i = 0; i < 600; i++) {
    const total = band.reduce((a, m) => a + overall(m), 0);
    if (Math.abs(total - START_TOTAL_OVR) <= 1) break;
    const m = band[i % band.length];
    const k = GROWABLE[Math.floor(i / band.length) % GROWABLE.length];
    m[k] = clamp(m[k] + (total < START_TOTAL_OVR ? 1 : -1), 8, 92);
  }
  for (let i = 0; i < 600; i++) {
    const total = band.reduce((a, m) => a + headroom(m), 0);
    if (Math.abs(total - START_TOTAL_HEADROOM) <= 1) break;
    const m = band[i % band.length];
    const floor = Math.max(m.skill, m.stage);
    m.hidden.potential = clamp(m.hidden.potential + (total < START_TOTAL_HEADROOM ? 1 : -1), floor, 99);
  }
}

/** The range you believe a visible stat lies in. Exact once you know someone well. */
export function seenRange(m: Musician, v: number): [number, number] {
  const w = Math.round(((100 - m.seen) / 100) * 18);
  if (w <= 1) return [v, v];
  return [clamp(Math.round(v - w * (1 + m.fog)), 1, 99), clamp(Math.round(v + w * (1 - m.fog)), 1, 99)];
}

/** Your best guess at a stat: the middle of the range you believe in. */
export function estimate(m: Musician, v: number): number {
  const [lo, hi] = seenRange(m, v);
  return Math.round((lo + hi) / 2);
}

export function getToKnow(m: Musician, amount: number): void {
  m.seen = clamp(Math.round(m.seen + amount), 0, 100);
}

/** Overall rating shown in big type on the card. */
export function overall(m: Musician): number {
  return Math.round(m.skill * 0.45 + m.stage * 0.25 + m.image * 0.15 + m.writing * 0.15);
}

export function traitDisplay(m: Musician, t: HiddenTrait): string {
  const k = m.known[t];
  if (k === 0) return '?';
  const v = m.hidden[t];
  // Potential is never a number, only an opinion about how far they can still go.
  if (t === 'potential') {
    const gap = v - Math.max(m.skill, m.stage);
    return gap >= 15 ? 'Big future' : gap >= 6 ? 'Can improve' : 'Peaked';
  }
  if (k === 2) return String(v);
  return v >= 67 ? 'High' : v >= 34 ? 'Mid' : 'Low';
}

/** Returns true if knowledge actually increased. */
export function reveal(m: Musician, t: HiddenTrait, level: Knowledge): boolean {
  if (t === 'potential') level = Math.min(level, 1) as Knowledge;
  if (m.known[t] >= level) return false;
  m.known[t] = level;
  return true;
}
