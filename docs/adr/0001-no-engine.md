# No game engine: HTML screens, canvas minigames, a pure Sim

The game has no walking avatar: the farm, the stable, the shop and the menus are tappable screens, about 80 % of what the player sees. The MVP has one real-time scene, the jumping minigame. So we build with Vite and TypeScript and no engine. Screens are HTML/CSS over pixel-art images. Each minigame draws on its own canvas with a small fixed-step loop. All rules live in a pure, tested Sim module that knows nothing about pixels.

## Considered options

- **Phaser**: gives scenes, sprites, tweens, a camera, particles, physics and iOS audio unlocking out of the box. But it adds several hundred KB to an offline iPad app, makes German text and menus harder to render crisply, hides UI from Playwright (canvas, not DOM), and pulls rules into scene code.
- **PixiJS**: a renderer only; the same canvas-text and testing costs as Phaser for screens that are mostly UI.
- **No engine** (chosen): we write a loop, a sprite animator, a tween and an image loader, a few hundred lines in all. Touch gestures (brushing, tapping hooves) need Pointer Events with or without an engine.

## Consequences

- When three or more real-time minigames with collisions or particles are planned (cross-country, races, carriage races), reconsider PixiJS or Phaser **for the minigame canvases only**. The Sim, the screens and the saves stay as they are.
- Sound (later) goes through Web Audio directly or a small library such as Howler.js, not an engine.
