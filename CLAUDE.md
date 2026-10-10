# GLAMSTAR

Rock-career management sim, London 1982 onwards. Design lives in `docs/design.md`; read it before changing game rules and update it when a design decision changes.

## Rules

- All in-game text is English. Discussion with the owner (Jussi) is in Finnish.
- Never use real band, musician, label, magazine, venue or TV show names. Everything is fictional, generated or parodic.
- Adult themes (drugs, alcohol, excess) are part of the game, written with satirical bite. Sexual content stays implied and off-screen.
- Game logic in `src/game/` is pure and takes a seeded RNG; no DOM access there. Rendering lives in `src/ui/`.
- Every change to game logic gets or updates a Vitest test.
- Use "->" for arrows in text, never the unicode arrow.

## Commands

- `npm run dev` - local dev server
- `npm test` - unit tests
- `npm run build` - type check and production build
