# Art: the LPC collection at 32px, plus our own drawings in its style

The look is top-down pixel art in the spirit of 16-bit action RPGs, without copying any game. A search of free sources found only one collection with top-down horses, riders and stables in one consistent style: the Liberated Pixel Cup (LPC) family on OpenGameArt (32px grid; horses by bluecarrot16 and others, the [LPC] Farm set, the LPC character generator). We use it, and draw what is missing ourselves in the same style: foals, trot, grooming animations, show jumps, stalls, water trough, hay, brushes.

A look prototype (branch `prototype/look`, see issue #2) settled the details:

- **Horses**: LPC Horse Extended (128px frames; side, front and back views; walk, gallop, idle; mane, socks and saddle layers). One sheet set covers both the side close-up in the stable and the top-down farm map and course, so a build needs no second drawing.
- **Ponies** are derived from the LPC horse by a script that moves pixels without resampling: every 2nd row of the legs and every 2nd column in the middle third of the body are removed, and the mane layer grows by a pixel (upwards by two). It runs on every layer, so all coats, manes and markings work for ponies too. Shortening the neck as well was tried and dropped: the head then juts forward. The front and back views change little; touch them up by hand if they bother.
- **Eyes**: `scripts/eyes.ts` puts a light glint into every horse eye (side and front views), which makes the horses look alive. Very dark coats are skipped: their eye doesn't stand out.
- **Farm**: the red barn is assembled from [LPC] Farm parts; scenery from [LPC] Terrains, Trees, Fruit Trees, Flowers/Plants and Medieval Village Decorations; chickens and sheep from LPC style farm animals, cat and dog from [LPC] Cats and Dogs; the font is VT323 (OFL). Show jumps, butterflies, birds, cloud shadows, pond ripples and plot stakes are drawn in code.
- **Rejected**: Loota's "Horses Sprites Pack" (CC BY 4.0, 64×48): far too coarse for the stable close-up and too small next to LPC buildings.
- No budget for an artist: whatever is missing we draw or derive ourselves.

## Licence rules

- Use only free licences: CC0, CC-BY, OGA-BY, OFL for fonts, and CC-BY-SA for scenery. Where a file is dual-licensed, take the CC-BY or OGA-BY option, never GPL.
- Most LPC scenery (terrain, trees, plants, village decorations) exists only under CC-BY-SA; the owner accepted that. Those sheets ship unchanged (PNGs only re-encoded losslessly), so share-alike binds nothing of ours; if we ever edit one, the edited file is CC-BY-SA too. Our code is not affected.
- Check every licence on the asset's own page before a file enters the repo. Checked so far: [LPC] Horses and LPC Horse Extended offer CC-BY 3.0 (we use that option); [LPC] Farm is CC-BY 4.0.
- `npm run assets` (`scripts/assets.ts`) downloads the packs, copies the sheets, adds the eye glints and derives the ponies, and writes `CREDITS.md` and `src/credits.json`. Each pack's own credits file (which names the author of every part, as LPC asks) ships under `public/assets/credits/`. The in-game credits screen shows all of it, and a test fails if any file under `public/assets/` has no credits entry.

## Considered options

- **Onfe's "Horse Sprite With Rider"** (itch.io): the best fit in content (trot, jump, rearing, 9 coats), but only "free with credit" with no redistribution of the raw sheets, which a public repo and a web game do. Usable only with the author's written permission.
- **16px CC0 packs** (Ninja Adventure, Kenney): good and simple licences, but no horses at all.
- **Everything self-drawn**: no licence questions, but much more drawing and a quality risk.
