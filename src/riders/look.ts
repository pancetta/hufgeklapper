/**
 * How riders look (pupils and the player's avatar): palettes and hair styles, as plain data the Sim can check
 * and the scene draws (see scene/kids.ts).
 */
export const SKIN = ['#f2d3b3', '#e8bf98', '#c99268', '#8d5a3b'];
export const HELMET = ['#2b2b3a', '#2f4f9a', '#7a2b4f', '#2f6b3a'];
export const JACKET = ['#d94f3d', '#3d6fd9', '#f2c14e', '#43a047', '#b05ec9', '#ff8fc7'];
export const HAIR = ['#4a2f1a', '#e2c068', '#1e1a17', '#a0522d'];
export const HAIR_STYLES = ['zopf', 'kurz', 'zoepfe', 'lang'] as const;

/** A rider's look: indices into the palettes above. */
export type Kid = { size: 'small' | 'big'; skin: number; hair: (typeof HAIR_STYLES)[number]; hairColor: number; jacket: number; helmet: number };

/** A pupil's look from its look number: each part takes a few bits. */
export function pupilKid(p: { size: Kid['size']; look: number }): Kid {
  const n = p.look;
  return { size: p.size, skin: n % 4, helmet: (n >> 2) % 4, jacket: (n >> 4) % 6, hairColor: (n >> 6) % 4, hair: HAIR_STYLES[(n >> 8) % 4] };
}

/** The player's avatar as a rider: a big child; the helmet is always the dark one. */
export const avatarKid = (a: { skin: number; hair: Kid['hair']; hairColor: number; jacket: number }): Kid =>
  ({ size: 'big', skin: a.skin, hair: a.hair, hairColor: a.hairColor, jacket: a.jacket, helmet: 0 });
