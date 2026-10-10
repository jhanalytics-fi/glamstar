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
  blurb: string;
  /** How well you know their visible stats, 0-100. Low = wide, misleading ranges. */
  seen: number;
  /** Fixed skew (-1..1) so a range's midpoint never gives the true value away. */
  fog: number;
}

export type SongKind = 'standard' | 'ballad' | 'trend' | 'solo';

export interface Song {
  title: string;
  quality: number;
  writer: string;
  kind: SongKind;
  genre: Genre;
  released: boolean;
}

export type ReleaseKind = 'demo' | 'single' | 'ep' | 'album';

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
  releases: Release[];
  /** A situation the player must respond to before the next week. */
  pending: PendingEvent | null;
}

export interface NewGameInput {
  /** Real name. */
  name: string;
  /** Known-as name; falls back to the real name. */
  stageName?: string;
  instrument: PlayerInstrument;
  bandName: string;
  background: Background;
  style: Genre;
  seed?: number;
}

export type ActionType = 'rehearse' | 'write' | 'gig' | 'party' | 'rest' | 'advertise' | 'release';

export interface Action {
  type: ActionType;
  option: string;
  /** For adverts: which role to recruit. */
  role?: Role;
}
