import type { Rng } from './rng';

const FIRST = [
  'Dave', 'Steve', 'Gary', 'Nick', 'Tony', 'Mick', 'Paul', 'Kev', 'Andy', 'Colin', 'Robbie', 'Lee',
  'Darren', 'Phil', 'Ian', 'Martin', 'Simon', 'Carl', 'Wayne', 'Danny', 'Jez', 'Neil', 'Rick', 'Terry',
  'Sharon', 'Debbie', 'Tracey', 'Julie', 'Karen', 'Mandy', 'Nikki', 'Jo', 'Suzi', 'Lorraine', 'Gail', 'Bev',
];
const LAST = [
  'Price', 'Walsh', 'Hughes', 'Carter', 'Doyle', 'Fletcher', 'Mason', 'Hardy', 'Webb', 'Lowe', 'Barker',
  'Nolan', 'Cross', 'Shaw', 'Rafferty', 'Quinn', 'Dawes', 'Kendrick', 'Pike', 'Slater', 'Moss', 'Ward',
  'Finch', 'Reeves', 'Booth', 'Hale', 'Gunn', 'Vance', 'Riley', 'Stone',
];
const NICK = [
  'Razor', 'Spider', 'Animal', 'Tex', 'Snake', 'Dog', 'Vixen', 'Sparky', 'Bones', 'Flash', 'Ace',
  'Diesel', 'Gypsy', 'Jet', 'Nitro', 'Smudge', 'Tank', 'Velvet', 'Wolf', 'Zippy',
];

const ADJ = [
  'Crimson', 'Savage', 'Electric', 'Iron', 'Velvet', 'Wild', 'Black', 'Burning', 'Silver', 'Toxic',
  'Midnight', 'Neon', 'Rebel', 'Steel', 'Lethal', 'Hungry', 'Dirty', 'Holy', 'Broken', 'Golden',
];
const NOUN_PL = [
  'Angels', 'Vipers', 'Saints', 'Daggers', 'Wolves', 'Hearts', 'Lovers', 'Knights', 'Sinners', 'Kings',
  'Gypsies', 'Tigers', 'Riders', 'Hounds', 'Roses', 'Rebels', 'Bullets', 'Dolls', 'Thieves', 'Mirrors',
];
const NOUN = [
  'Thunder', 'Leather', 'Lace', 'Chrome', 'Fire', 'Steel', 'Lightning', 'Sin', 'Glory', 'Venom',
  'Midnight', 'Heaven', 'Hell', 'Diamond', 'Lipstick', 'Razor', 'Danger', 'Fever', 'Desire', 'Voodoo',
];
const GLAM_WORDS = ['Kix', 'Stryk', 'Lyxx', 'Rokk', 'Vixxen', 'Bratt', 'Krash', 'Glitzz', 'Slaze', 'Hed'];

/** Real band names we never want the generator to produce by accident. */
const BLOCKLIST = new Set(
  [
    'iron maiden', 'def leppard', 'motley crue', 'poison', 'ratt', 'warrant', 'cinderella', 'whitesnake',
    'saxon', 'white lion', 'black sabbath', 'judas priest', 'skid row', 'kiss', 'twisted sister',
    'quiet riot', 'dokken', 'great white', 'faster pussycat', 'hanoi rocks', 'tigertailz', 'steel panther',
    'diamond head', 'venom', 'black widow', 'steelheart', 'night ranger', 'europe', 'vixen', 'danger danger',
  ].map((s) => s.toLowerCase()),
);

export function isBlocked(name: string): boolean {
  const n = name.toLowerCase().replace(/^the /, '').replace(/[^a-z ]/g, '').trim();
  return BLOCKLIST.has(n);
}

const GLAM_FIRST = [
  'Johnny', 'Nikki', 'Vinnie', 'Stevie', 'Rikki', 'Tommy', 'Misty', 'Roxy', 'Lizzy', 'Jet', 'Dee', 'Bobby',
  'Sammy', 'Candy', 'Jackie', 'Danny', 'Cherry', 'Lola', 'Frankie', 'Jimmy', 'Suzy', 'Angel', 'Kitty', 'Rocky',
];
const GLAM_LAST = [
  'Vain', 'Rivers', 'Blade', 'Venom', 'Steel', 'Diamond', 'Rocket', 'Saint', 'Thunder', 'Wilde', 'Velvet',
  'Storm', 'Kane', 'Valentine', 'Fury', 'Shade', 'Lace', 'Sinclair', 'Lovelace', 'Chrome', 'Danger', 'Cobra',
  'Heartbreak', 'Leather', 'Malone', 'Vegas', 'Royale', 'Dagger',
];
const TOWNS = [
  'Croydon', 'Dagenham', 'Slough', 'Luton', 'Basildon', 'Wolverhampton', 'Swindon', 'Rotherham', 'Ipswich',
  'Stevenage', 'Walsall', 'Barnsley', 'Reading', 'Grimsby', 'Bromley', 'Harlow', 'Dundee', 'Cardiff', 'Belfast',
];

/** Real stage names the generator must never produce. */
const STAGE_BLOCKLIST = new Set(
  ['nikki sixx', 'vince neil', 'tommy lee', 'johnny rotten', 'sid vicious', 'billy idol', 'jimmy page', 'johnny thunders',
   'stiv bators', 'rikki rockett', 'tommy thunder', 'kim wilde', 'johnny vain', 'misty rivers'],
);

export function hometown(rng: Rng): string {
  return rng.pick(TOWNS);
}

/** An invented showbiz name, e.g. "Nikki Valentine". */
export function stageName(rng: Rng): string {
  for (let i = 0; i < 20; i++) {
    const n = rng.chance(0.15) ? rng.pick(GLAM_LAST) : `${rng.pick(GLAM_FIRST)} ${rng.pick(GLAM_LAST)}`;
    if (!STAGE_BLOCKLIST.has(n.toLowerCase())) return n;
  }
  return 'Kid Nobody';
}

/** Known-as name for a generated musician: a full stage name, a nickname, or just their real name. */
export function knownAs(rng: Rng, real: string): string {
  const r = rng.next();
  if (r < 0.4) return stageName(rng);
  if (r < 0.7) {
    const [f, ...rest] = real.split(' ');
    return `${f} "${rng.pick(NICK)}" ${rest.join(' ')}`;
  }
  return real;
}

/** Generates a real name whose first and last names are not in `taken`, so the log never mixes up two Daves. */
export function personName(rng: Rng, taken: Iterable<string> = []): string {
  const names = [...taken];
  const used = new Set(names.map((n) => n.split(' ')[0]));
  const usedLast = new Set(names.map((n) => n.split(' ').at(-1)));
  const free = FIRST.filter((f) => !used.has(f));
  const freeLast = LAST.filter((l) => !usedLast.has(l));
  const first = rng.pick(free.length ? free : FIRST);
  const last = rng.pick(freeLast.length ? freeLast : LAST);
  return `${first} ${last}`;
}

export function bandName(rng: Rng): string {
  for (let i = 0; i < 20; i++) {
    const pattern = rng.int(0, 5);
    let n: string;
    switch (pattern) {
      case 0: n = `${rng.pick(ADJ)} ${rng.pick(NOUN_PL)}`; break;
      case 1: n = `${rng.pick(NOUN)} ${rng.pick(NOUN_PL)}`; break;
      case 2: n = `${rng.pick(NOUN_PL)} of ${rng.pick(NOUN)}`; break;
      case 3: n = rng.pick(GLAM_WORDS); break;
      case 4: n = `The ${rng.pick(ADJ)} ${rng.pick(NOUN_PL)}`; break;
      default: n = `${rng.pick(NOUN)}${rng.pick(['', ' ', ''])}${rng.pick(['Queen', 'Kult', 'Cats', 'Machine', 'Child'])}`;
    }
    if (!isBlocked(n)) return n;
  }
  return 'Untitled';
}

const SONG_A = ['Hot', 'Wild', 'Cold', 'Dirty', 'Sweet', 'Bad', 'Fast', 'Loud', 'Lonely', 'Electric', 'Crazy', 'Dangerous'];
const SONG_B = ['Love', 'Night', 'Heart', 'City', 'Blood', 'Money', 'Lady', 'Street', 'Wheels', 'Rain', 'Tonight', 'Fever'];
const SONG_PATTERNS: ((a: string, b: string, n: string) => string)[] = [
  (a, b) => `${a} ${b}`,
  (_a, b) => `${b} on the Run`,
  (a, b) => `Too ${a} for ${b}`,
  (_a, _b, n) => `Rock Me ${n}`,
  (a) => `${a}, ${a}, ${a}`,
  (_a, b) => `Kiss of ${b}`,
  (_a, b, n) => `${n} ${b}`,
  (a) => `Born to Be ${a}`,
  (_a, b) => `Shot Down in ${b}`,
  (a) => `(Living) ${a} and Free`,
];

export function songTitle(rng: Rng): string {
  return rng.pick(SONG_PATTERNS)(rng.pick(SONG_A), rng.pick(SONG_B), rng.pick(['Tonight', 'Baby', 'Forever', 'Again', 'Midnight', 'Sister']));
}

export const PRESS = 'Noise Weekly';

export interface Venue {
  name: string;
  capacity: number;
  minFans: number;
  fee: number;
}

export const VENUES: Venue[] = [
  { name: 'The Crown & Gutter, Camden', capacity: 80, minFans: 0, fee: 25 },
  { name: 'The Rat Pit, Islington', capacity: 150, minFans: 60, fee: 45 },
  { name: 'The Velvet Cellar, Soho', capacity: 300, minFans: 180, fee: 90 },
  { name: 'Hammerton Social Club', capacity: 600, minFans: 400, fee: 180 },
  { name: 'The Odeum, Kentish Town', capacity: 1400, minFans: 900, fee: 420 },
];

export function bestVenue(fans: number): Venue {
  return [...VENUES].reverse().find((v) => fans >= v.minFans) ?? VENUES[0];
}
