import type { World } from './world';

export type Role = 'vocals' | 'guitar' | 'bass' | 'drums' | 'keys';
export type PlayerInstrument = 'none' | 'guitar' | 'keys';
export type Genre = 'metal' | 'hardrock' | 'glam' | 'punk' | 'newwave';
export type HiddenTrait = 'ego' | 'reliability' | 'vice' | 'stamina' | 'loyalty';
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
}

export interface Song {
  title: string;
  quality: number;
  writer: string;
}

export interface LogEntry {
  week: number;
  text: string;
  tone: 'good' | 'bad' | 'neutral' | 'reveal';
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

export type Action =
  | { type: 'rehearse' }
  | { type: 'write' }
  | { type: 'gig' }
  | { type: 'party' }
  | { type: 'rest' }
  | { type: 'advertise'; role: Role };
