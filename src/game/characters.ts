import { Rng, clamp } from './rng';
import { personName } from './names';
import type { Background, Genre, HiddenTrait, Knowledge, Musician, NewGameInput, Role } from './types';

export const HIDDEN_TRAITS: HiddenTrait[] = ['ego', 'reliability', 'vice', 'stamina', 'loyalty'];
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
  'Still lives with his mum, who irons his stage gear.',
  'Got thrown out of three bands. Swears none of it was his fault.',
  'Quiet until the second pint, then the loudest person in Camden.',
  'Sleeps in the rehearsal room more than is strictly legal.',
  'Has a girlfriend who hates the band and attends every gig.',
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
  const hidden = {
    ego: rng.int(10, 95),
    reliability: rng.int(10, 95),
    vice: rng.int(10, 95),
    stamina: rng.int(20, 90),
    loyalty: rng.int(10, 95),
  };
  // Talent and trouble often travel together.
  if (tier === 'good' && rng.chance(0.5)) hidden.ego = clamp(hidden.ego + 20, 1, 99);
  return {
    id,
    name: personName(rng, takenNames),
    age: rng.int(18, 29),
    role,
    isPlayer: false,
    skill: rng.around(mean, 14),
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
  };
}

function unknownTraits(): Record<HiddenTrait, Knowledge> {
  return { ego: 0, reliability: 0, vice: 0, stamina: 0, loyalty: 0 };
}

export function createPlayer(rng: Rng, input: NewGameInput): Musician {
  const p: Musician = {
    id: 'p',
    name: input.name.trim() || 'Nobody',
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
    },
    // You know yourself. Except how much you can handle.
    known: { ego: 2, reliability: 2, vice: 0, stamina: 2, loyalty: 2 },
    energy: 90,
    mood: 70,
    habit: 5,
    outWeeks: 0,
    weeksInBand: 0,
    blurb: BACKGROUNDS[input.background].text,
  };
  switch (input.background) {
    case 'choirboy': p.skill += 12; p.hidden.vice += 8; break;
    case 'artschool': p.image += 12; p.writing += 10; p.hidden.vice += 12; break;
    case 'factory': p.hidden.stamina += 18; p.hidden.reliability += 15; p.image -= 5; break;
    case 'posh': p.image += 6; p.hidden.ego += 15; break;
  }
  // A frontperson who also plays splits their focus a little.
  if (p.doubles) p.stage -= 4;
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
    band.push(generateMusician(rng, nextId(), role, tiers[i], style, [playerName, ...band.map((m) => m.name)]));
  }
  return band;
}

/** Overall rating shown in big type on the card. */
export function overall(m: Musician): number {
  return Math.round(m.skill * 0.45 + m.stage * 0.25 + m.image * 0.15 + m.writing * 0.15);
}

export function traitDisplay(m: Musician, t: HiddenTrait): string {
  const k = m.known[t];
  if (k === 0) return '?';
  const v = m.hidden[t];
  if (k === 2) return String(v);
  return v >= 67 ? 'High' : v >= 34 ? 'Mid' : 'Low';
}

/** Returns true if knowledge actually increased. */
export function reveal(m: Musician, t: HiddenTrait, level: Knowledge): boolean {
  if (m.known[t] >= level) return false;
  m.known[t] = level;
  return true;
}
