// The picture behind the page: a pub doorway, a studio, a stadium, a hotel room nobody will clean.
// Picked from what the band just did, and crossfaded when it changes.
import type { GameState } from '../game/types';

// Literal paths so the artifact build can inline them one by one.
export const BG: Record<string, string> = {
  'studio-guitar': './bg/studio-guitar.webp',
  'studio-vocal': './bg/studio-vocal.webp',
  'writing-table': './bg/writing-table.webp',
  'writing-lounge': './bg/writing-lounge.webp',
  rehearsal: './bg/rehearsal.webp',
  'club-crowd': './bg/club-crowd.webp',
  'rat-pit': './bg/rat-pit.webp',
  'crown-gutter': './bg/crown-gutter.webp',
  'crown-gutter-2': './bg/crown-gutter-2.webp',
  'tour-bus': './bg/tour-bus.webp',
  'hotel-excess': './bg/hotel-excess.webp',
  stadium: './bg/stadium.webp',
  'arena-crowd': './bg/arena-crowd.webp',
  'gold-discs': './bg/gold-discs.webp',
  signing: './bg/signing.webp',
  backstage: './bg/backstage.webp',
  'stage-theatre': './bg/stage-theatre.webp',
};

/** Which picture fits the moment. */
export function backdropFor(s: GameState | null): string {
  if (!s) return 'crown-gutter';
  if (s.over) return s.over.won ? 'gold-discs' : 'backstage';
  const odd = s.week % 2 === 1;
  const big = s.fans >= 20000;
  switch (s.scene?.kind) {
    case 'gig': return s.fans >= 150000 ? 'stadium' : big ? 'arena-crowd' : s.fans >= 2000 ? 'stage-theatre' : 'club-crowd';
    case 'tour': {
      const tier = s.tour?.tier ?? '';
      if (tier === 'stadiums' || tier === 'america' || tier === 'world') return odd ? 'stadium' : 'tour-bus';
      if (tier === 'arenas' || tier === 'japan') return odd ? 'arena-crowd' : 'backstage';
      return odd ? 'stage-theatre' : 'tour-bus';
    }
    case 'write': return s.fans >= 5000 ? 'writing-lounge' : 'writing-table';
    case 'release': return odd ? 'studio-vocal' : 'studio-guitar';
    case 'rehearse': return 'rehearsal';
    case 'party': return s.fans >= 5000 ? 'hotel-excess' : 'crown-gutter-2';
    case 'rest': return 'backstage';
    case 'advertise': return 'rat-pit';
    case 'event': return big ? 'signing' : s.fans >= 500 ? 'stage-theatre' : 'rat-pit';
    case 'start': return 'crown-gutter';
    default: return s.fans >= 2000 ? 'signing' : 'rat-pit';
  }
}

let shown = '';
let layer = 0;

/** Crossfade the backdrop to the picture for this state. */
export function showBackdrop(s: GameState | null): void {
  const name = backdropFor(s);
  if (name === shown) return;
  const host = document.querySelector<HTMLElement>('.backdrop');
  if (!host) return;
  const layers = host.querySelectorAll<HTMLElement>('.bg');
  if (layers.length < 2) return;
  layer = 1 - layer;
  const next = layers[layer];
  const prev = layers[1 - layer];
  next.style.backgroundImage = `url("${BG[name]}")`;
  next.classList.add('on');
  prev.classList.remove('on');
  shown = name;
}
