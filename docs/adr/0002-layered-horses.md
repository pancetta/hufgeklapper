# Horses are composed from layers and palettes

The game needs many different horses and ponies, and later breeding with inherited looks. So a horse's picture is not one drawing per horse but a stack composed at load time and cached:

1. **Build** (pony, big horse; later Shetland pony, draft horse, foal): one set of animations per build, drawn in a few neutral grey shades.
2. **Coat**: a palette that maps those shades to colours (chestnut, bay, black, grey, dun, …).
3. **Markings**: overlay layers (star, blaze, socks).
4. **Mane and tail**: their own layer and colour.
5. **Tack**: halter, saddle, saddle pad.

A **Breed** is data only: a build plus the coats and markings it allows (a Haflinger is a pony with a chestnut coat and a light mane).

## Considered options

- **One fixed sprite per horse**: simplest code, but every new colour is a new drawing and breeding can't produce new looks.
- **Recolouring one base sprite**: no distinction between ponies and horses.

## As built (#4)

The LPC horse comes in five coat sheets with shading drawn by hand, so instead of recolouring one grey base we map each **Coat** to an LPC sheet plus a mane colour (a Fuchs is the brown sheet with a red mane, a Brauner the same sheet with a black one): seven coats from five sheets, without losing the hand-drawn shading. White leg markings always use the white sheet's version, which reads as white on every coat. The saddle pad is tinted to any colour. A halter has no LPC art yet. `src/horses/look.ts` holds the data, `src/horses/compose.ts` the pure compositor; `?debug=pferde` shows the looks side by side.

## Consequences

- The compositor is a pure function from a horse's look to an image; a test pins that the same look always gives the same pixels.
- Breeding later only has to combine the parents' look values; nothing new needs to be drawn.
- Each new build costs one full animation set, so builds are added sparingly. Where a build can be derived from another by moving pixels (the pony from the horse, see ADR-0003), the derivation runs over every layer, so the layers stay aligned.
