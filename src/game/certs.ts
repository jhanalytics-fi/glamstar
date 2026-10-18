// Silver, gold and platinum: the trade body counts the copies and sends a framed disc.
import { addBuzz, adjust, log, milestone } from './helpers';
import type { Cert, GameState, Release } from './types';

/** Thresholds as the British trade counted them in the eighties (copies). */
export const CERT_LEVELS: Record<'single' | 'album', [Cert, number][]> = {
  single: [['silver', 250000], ['gold', 500000], ['platinum', 1000000], ['multiplatinum', 2000000]],
  album: [['silver', 60000], ['gold', 100000], ['platinum', 300000], ['multiplatinum', 900000]],
};
const RANK: Record<Cert, number> = { silver: 1, gold: 2, platinum: 3, multiplatinum: 4 };

export function certFor(r: Release): Cert | undefined {
  if (r.kind === 'demo' || r.comp === 'bootleg') return undefined;
  const levels = CERT_LEVELS[r.kind === 'album' ? 'album' : 'single'];
  let out: Cert | undefined;
  for (const [c, n] of levels) if (r.sold >= n) out = c;
  return out;
}

export const CERT_LABEL: Record<Cert, string> = { silver: 'Silver', gold: 'Gold', platinum: 'Platinum', multiplatinum: 'Multi-platinum' };

/** Once a week: any record that has crossed a line gets its disc. */
export function certify(s: GameState): void {
  for (const r of s.releases) {
    const c = certFor(r);
    if (!c || (r.cert && RANK[r.cert] >= RANK[c])) continue;
    r.cert = c;
    const bump = RANK[c];
    addBuzz(s, 2 + bump * 2);
    for (const m of s.members) adjust(m, 'mood', 2 + bump);
    milestone(s, 'release', `"${r.title}" went ${CERT_LABEL[c]}.`);
    log(s, `"${r.title}" is certified ${CERT_LABEL[c]}. A framed disc arrives for everyone, including the drummer who missed the session.${c === 'multiplatinum' ? ' The label sent champagne. It went on the tab.' : ''}`, 'good');
  }
}
