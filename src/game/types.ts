import type { World } from './world';

export type Role = 'vocals' | 'guitar' | 'bass' | 'drums' | 'keys';
export type PlayerInstrument = 'none' | 'guitar' | 'keys';
export type Genre = 'metal' | 'hardrock' | 'glam' | 'punk' | 'newwave';
/** Hidden traits. `potential` is the ceiling for skill, stage presence and writing. */
export type HiddenTrait = 'ego' | 'reliability' | 'vice' | 'stamina' | 'loyalty' | 'potential';
/** 0 = unknown, 1 = rough range known, 2 = exact value known */
export type Knowledge = 0 | 1 | 2;
export type Background = 'choirboy' | 'artschool' | 'factory' | 'posh';

export interface Musician {
  id: string;
  /** Known-as name shown everywhere, e.g. "Johnny Vain". */
  name: string;
  /** Name on the birth certificate, the contract and the charge sheet. */
  realName: string;
  /** Hometown, for the tabloids. */
  from: string;
  /** Set for the player; generated musicians go by their names. */
  gender?: Gender;
  age: number;
  role: Role;
  /** Player can double on an instrument; bandmates may too. */
  doubles?: Role;
  isPlayer: boolean;
  skill: number;
  stage: number;
  image: number;
  writing: number;
  style: Genre;
  hidden: Record<HiddenTrait, number>;
  known: Record<HiddenTrait, Knowledge>;
  energy: number;
  mood: number;
  habit: number;
  /** Weeks this member is unavailable (hospital, the clinic, vanished). */
  outWeeks: number;
  weeksInBand: number;
  /** The week they joined, for the line-up history. */
  joined?: number;
  blurb: string;
  /** How well you know their visible stats, 0-100. Low = wide, misleading ranges. */
  seen: number;
  /** Fixed skew (-1..1) so a range's midpoint never gives the true value away. */
  fog: number;
}

export type SongKind = 'standard' | 'ballad' | 'trend' | 'solo' | 'cover' | 'hired';

export interface Song {
  title: string;
  quality: number;
  writer: string;
  kind: SongKind;
  genre: Genre;
  released: boolean;
  /** The album this song came out on, if any. */
  album?: string;
  /** Already lifted from the album as a single. */
  lifted?: boolean;
  /** Written (or owned) by someone outside the band: the publishing goes elsewhere. */
  outside?: boolean;
}

export type ReleaseKind = 'demo' | 'single' | 'ep' | 'album';

/** Where the money comes from. The `u_` kinds count copies, not pounds. */
export type IncomeKind = 'gigs' | 'tours' | 'merch' | 'singles' | 'eps' | 'albums' | 'royalties' | 'advances' | 'other' | 'u_single' | 'u_ep' | 'u_album';

export interface Release {
  id: string;
  kind: ReleaseKind;
  title: string;
  quality: number;
  /** Sales multiplier from song kinds and fashion at release time. */
  appeal: number;
  week: number;
  sold: number;
  lastWeek: number;
  /** Label release: who put it out, and the band's royalty per copy after deductions. */
  label?: string;
  royalty?: number;
  /** Put together from the back catalogue by the label, or by a bootlegger, rather than recorded by the band. */
  comp?: 'hits' | 'live' | 'bootleg';
  /** Lead song owned outside the band: a slice of every copy goes to its publisher. */
  outside?: boolean;
  /** Best chart positions reached, by chart. */
  peaks?: Partial<Record<string, number>>;
}

/** A tour, once it is over. */
export interface TourRecord {
  name: string;
  tier: string;
  start: number;
  weeks: number;
  gigs: number;
  people: number;
  fans: number;
  net: number;
  abandoned: boolean;
  legends: number;
}

/** Someone who used to be in the band. */
export interface Alumnus {
  name: string;
  realName: string;
  role: Role;
  joined: number;
  left: number;
  how: 'fired' | 'quit' | 'poached';
}

export interface Award {
  year: number;
  title: string;
  from: string;
}

/** The nasty bits of a record deal. Hidden until a lawyer reads the contract. */
export interface SmallPrint {
  /** Share of royalties lost to "packaging", "breakage" and "new technology" deductions. */
  deductions: number;
  /** Tour profits go to the label until the advance is earned back. */
  tourRecoup: boolean;
  /** The label owns the band name: leaving costs extra. */
  ownsName: boolean;
  /** Promo and video costs are charged back to the band. */
  promoRecoup: boolean;
}

export interface DealTerms {
  advance: number;
  /** Royalty share of the retail price, before deductions. */
  rate: number;
  /** Albums owed. The label can drop you after each one. */
  albums: number;
  /** Recording budget per album (recoupable). Singles and EPs cost a share of it. */
  budget: number;
  smallPrint: SmallPrint;
}

export interface Offer {
  id: string;
  label: string;
  week: number;
  expires: number;
  terms: DealTerms;
  /** A lawyer has read the small print. */
  read: boolean;
  /** Times you have pushed for better terms. */
  haggled: number;
  /** A rival label offering to pay off your current contract. The buyout goes on your new tab. */
  buyout?: number;
}

export interface Manager {
  name: string;
  /** Hidden. Low means skimming and nasty clauses. */
  honesty: number;
  /** Connections: better gigs, better deals, labels listen. */
  clout: number;
  /** Commission on everything the band earns. */
  cut: number;
  signed: number;
  /** A solicitor read the management contract. */
  read: boolean;
  /** Commission taken so far. */
  taken: number;
}

export interface Contract {
  label: string;
  signed: number;
  terms: DealTerms;
  /** Money the label wants back before you see a penny of royalties. */
  unrecouped: number;
  albumsDelivered: number;
  /** Royalties earned since the last statement (not yet paid or set against the debt). */
  owed: number;
  /** Week the label decides whether to keep you, after an album has had time to sell. */
  reviewWeek: number | null;
  /** Albums that sold under what the label expected. */
  flops: number;
  /** 0-100: how the label feels about you. Do as the A&R says and it rises. */
  goodwill: number;
  /** Royalties the label quietly kept off the statements. Only an audit finds them. */
  shaved: number;
  /** Statements sent so far. */
  statements: number;
}

export interface PendingEvent {
  def: string;
  params: Record<string, string | number>;
  week: number;
}

export interface LogEntry {
  week: number;
  text: string;
  /** 'fx' = the measurable effects of what just happened. */
  tone: 'good' | 'bad' | 'neutral' | 'reveal' | 'fx';
  /** Changes to hidden values, shown only in debug mode. */
  hidden?: string;
}

export type GameOver = { reason: string; won: boolean };

/** One line of the week's running commentary. */
export interface Beat {
  /** Clock time or day, e.g. "21:40" or "Tuesday". */
  time?: string;
  text: string;
  tone: LogEntry['tone'];
  /** Happened later in the week, after the main event. */
  late?: boolean;
}

/** A single measurable change, shown as a chip under the commentary. */
export interface EffectChip {
  /** Member's short name, or null for band-level figures. */
  who: string | null;
  stat: string;
  delta: number;
}

export type Vibe = 'normal' | 'gig' | 'trip' | 'wasted' | 'drama' | 'quiet';

/** What the action zone plays back: the week (or situation) just lived through. */
export interface Scene {
  id: number;
  /** Band figures when the scene opened, so the UI can count them over to the new values. */
  start?: { money: number; fans: number; buzz: number; tightness: number };
  kind: ActionType | 'event' | 'start';
  title: string;
  vibe: Vibe;
  beats: Beat[];
  effects: EffectChip[];
  hidden?: string;
  /** One-word verdict on the week, e.g. Storming. */
  verdict?: { text: string; tone: Beat['tone'] };
  /** Key figures to show big, e.g. crowd 13 / 80. */
  stats?: { label: string; value: string; sub?: string }[];
  /** While true, logged lines are mirrored into the beats. */
  recording: boolean;
  /** While true, mirrored lines are marked as later in the week. */
  late: boolean;
}

export interface GameState {
  version: 1;
  rng: number;
  week: number;
  bandName: string;
  money: number;
  fans: number;
  buzz: number;
  tightness: number;
  songs: Song[];
  members: Musician[];
  /** Pairwise relationship, key = sorted ids joined with "|", value -100..100 */
  affinity: Record<string, number>;
  candidates: Musician[];
  candidateRole: Role | null;
  lastGigWeek: number | null;
  log: LogEntry[];
  over: GameOver | null;
  nextId: number;
  world: World;
  /** Gear quality 0-5, adds to performance. */
  gear: number;
  /** Misc. persistent state: roadie, noVan, lastBigParty week, rentUp, tvBan... */
  flags: Record<string, number>;
  /** The band's transport. Mirrored in flags.noVan for older code. */
  wheels: Wheels;
  releases: Release[];
  /** Money in, by year and by stream, plus copies sold. Never spent from; the bank is `money`. */
  ledger: Record<string, Partial<Record<IncomeKind, number>>>;
  tours: TourRecord[];
  alumni: Alumnus[];
  awards: Award[];
  /** A situation the player must respond to before the next week. */
  pending: PendingEvent | null;
  /** The latest week or situation, for the action zone. */
  scene: Scene | null;
  /** The tour in progress, if any. */
  tour: Tour | null;
  /** The career highlights: releases, line-up changes, chart moments, tours. */
  milestones: Milestone[];
  /** Record deal offers on the table. */
  offers: Offer[];
  /** The deal you are signed to, if any. */
  contract: Contract | null;
  /** Your manager, if you have one. */
  manager: Manager | null;
}

export type MilestoneKind = 'career' | 'release' | 'lineup' | 'chart' | 'tour' | 'drama';

export interface Milestone {
  week: number;
  kind: MilestoneKind;
  text: string;
}

export type Gender = 'male' | 'female' | 'nonbinary';

export interface NewGameInput {
  /** Real name. */
  name: string;
  /** Known-as name; falls back to the real name. */
  stageName?: string;
  gender?: Gender;
  instrument: PlayerInstrument;
  bandName: string;
  background: Background;
  style: Genre;
  seed?: number;
}

export type ActionType = 'rehearse' | 'write' | 'gig' | 'party' | 'rest' | 'advertise' | 'release' | 'tour';

export interface Action {
  type: ActionType;
  option: string;
  /** For adverts: which role to recruit. */
  role?: Role;
  /** For starting a tour: how many weeks. */
  weeks?: number;
  /** For tours: how the band behaves on the road. */
  policy?: TourPolicy;
  /** For starting a tour: where the band sleeps. */
  lodging?: Lodging;
}

export type TourPolicy = 'wild' | 'steady' | 'clean';
/** How the band gets about. */
export type Wheels = 'bus' | 'van' | 'splitter' | 'coach' | 'jet';
/** Where the band sleeps on tour. */
export type Lodging = 'floors' | 'bnb' | 'hotels' | 'suites';

export interface TourStop {
  city: string;
  country: string;
  venue: string;
  capacity: number;
}

export interface Tour {
  tier: string;
  name: string;
  weeks: number;
  /** Weeks already played. */
  week: number;
  policy: TourPolicy;
  lodging: Lodging;
  route: TourStop[];
  gigsPerWeek: number;
  gigsPlayed: number;
  people: number;
  fansGained: number;
  startMoney: number;
  legendsAtStart?: number;
}
