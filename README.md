# Hufgeklapper

Ein Browserspiel über einen Reiterhof für Kinder von 8 bis 12: Pferde und Ponys pflegen, reiten und springen, den Hof wirtschaftlich führen und ausbauen. Gemacht fürs iPad im Querformat, per Finger.

A browser game about running a riding farm, for children aged 8–12. Work in progress: the design is in [`docs/design.md`](docs/design.md), the vocabulary in [`GLOSSARY.md`](GLOSSARY.md), the decisions in [`docs/adr/`](docs/adr/), and the work in the [issues](https://github.com/pancetta/hufgeklapper/issues).

**Play it:** https://pancetta.github.io/hufgeklapper/

## Run, test, build

```bash
npm install
npm run dev        # dev server; open the URL it prints (served under /hufgeklapper/)
npm run typecheck  # TypeScript, strict
npm test           # Vitest: rules and helpers
npx playwright install webkit   # once, for the touch tests
npm run e2e        # Playwright: builds, then runs the touch flows in WebKit on an iPad in landscape
npm run assets     # download the free art packs, add eye glints, derive ponies, write CREDITS.md
```

The art is free pixel art from the LPC collection and others, credited in [`CREDITS.md`](CREDITS.md) and in the game. Never edit `public/assets/`, `src/credits.json` or `CREDITS.md` by hand: change `scripts/assets.ts` and run `npm run assets`.

Every pull request runs the type check, Vitest and Playwright (`.github/workflows/ci.yml`). Every push to `main` runs the same and then deploys `dist/` to GitHub Pages; a failing test stops the deploy.
