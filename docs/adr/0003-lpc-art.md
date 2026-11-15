# Art: the LPC collection at 32px, plus our own drawings in its style

The look is top-down pixel art in the spirit of 16-bit action RPGs, without copying any game. A search of free sources found only one collection with top-down horses, riders and stables in one consistent style: the Liberated Pixel Cup (LPC) family on OpenGameArt (32px grid; horses by bluecarrot16 and others, the [LPC] Farm set, the LPC character generator). We use it, and draw what is missing ourselves in the same style: foals, trot, grooming animations, show jumps, stalls, water trough, hay, brushes.

A look prototype (branch `prototype/look`, see issue #2) settled the details:

- **Horses**: LPC Horse Extended (128px frames; side, front and back views; walk, gallop, idle; mane, socks and saddle layers). One sheet set covers both the side close-up in the stable and the top-down farm map and course, so a build needs no second drawing.
- **Ponies** are derived from the LPC horse by a script that moves pixels without resampling: every 2nd row of the legs and every 2nd column in the middle third of the body are removed, and the mane layer grows by a pixel (upwards by two). It runs on every layer, so all coats, manes and markings work for ponies too. Shortening the neck as well was tried and dropped: the head then juts forward. The front and back views change little; touch them up by hand if they bother.
- **Farm**: [LPC] Farm pieces (sheds, trough, fences, hay, windmill tower and its 8-frame blades).
- **Rejected**: Loota's "Horses Sprites Pack" (CC BY 4.0, 64×48): far too coarse for the stable close-up and too small next to LPC buildings.
- No budget for an artist: whatever is missing we draw or derive ourselves.

## Licence rules

- Use only free licences: CC0, CC-BY, OGA-BY. Where a file is dual-licensed, take the CC-BY or OGA-BY option, never GPL. Avoid CC-BY-SA; if a file is offered only under CC-BY-SA, our edits of it must be CC-BY-SA too, so keep such files unedited or find another.
- Check every licence on the asset's own page before a file enters the repo. Checked so far: [LPC] Horses and LPC Horse Extended offer CC-BY 3.0 (we use that option); [LPC] Farm is CC-BY 4.0.
- Every third-party file is listed in `CREDITS.md` with author, source and licence, per file as LPC requires, and shown on the in-game credits screen.

## Considered options

- **Onfe's "Horse Sprite With Rider"** (itch.io): the best fit in content (trot, jump, rearing, 9 coats), but only "free with credit" with no redistribution of the raw sheets, which a public repo and a web game do. Usable only with the author's written permission.
- **16px CC0 packs** (Ninja Adventure, Kenney): good and simple licences, but no horses at all.
- **Everything self-drawn**: no licence questions, but much more drawing and a quality risk.
