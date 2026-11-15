# Hufgeklapper

Ein Browserspiel über einen Reiterhof für Kinder von 8 bis 12: Pferde und Ponys pflegen, reiten und springen, den Hof wirtschaftlich führen und ausbauen. Gemacht fürs iPad im Querformat, per Finger.

A browser game about running a riding farm, for children aged 8–12. Work in progress: the design is in [`docs/design.md`](docs/design.md), the vocabulary in [`GLOSSARY.md`](GLOSSARY.md), the decisions in [`docs/adr/`](docs/adr/), and the work in the [issues](https://github.com/pancetta/hufgeklapper/issues).

**Play it:** https://pancetta.github.io/hufgeklapper/

### On the iPad

Open the game in Safari, tap *Teilen* → *Zum Home-Bildschirm*, and open the new app once while online. From then on it starts full screen like an app and runs offline: a service worker keeps the whole game, and a new version is fetched in the background and starts the next time the game is opened.

- iOS keeps the home-screen app's saves apart from Safari's: a game saved in Safari is not in the app, and the other way round. To move one, export it from the save slot and import it on the other side.
- Safari deletes a website's saves after 7 days without a visit. The home-screen app is not affected, so play it from there.

## Run, test, build

```bash
npm install
npm run dev        # dev server; open the URL it prints (served under /hufgeklapper/)
npm run typecheck  # TypeScript, strict
npm test           # Vitest: rules and helpers
npx playwright install webkit   # once, for the touch tests
npm run e2e        # Playwright: builds, then runs the touch flows in WebKit on an iPad in landscape
npm run assets     # download the free art packs, add eye glints, derive ponies, write CREDITS.md
npm run icon       # draw the home-screen icon (our own pixel art) into public/icons/
```

The art is free pixel art from the LPC collection and others, credited in [`CREDITS.md`](CREDITS.md) and in the game. Never edit `public/assets/`, `src/credits.json` or `CREDITS.md` by hand: change `scripts/assets.ts` and run `npm run assets`.

Every pull request runs the type check, Vitest and Playwright (`.github/workflows/ci.yml`). Every push to `main` runs the same and then deploys `dist/` to GitHub Pages; a failing test stops the deploy.
