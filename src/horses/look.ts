/**
 * What a horse looks like, as data (ADR-0002): build × coat × mane × markings × tack. Each choice is a layer
 * sheet in public/assets/horses/; ponies use the pony-* versions of the same layers. A breed is data only:
 * a build plus the coats it allows.
 */
export type Build = 'horse' | 'pony';
export type Anim = 'idle' | 'walk' | 'gallop';

/** The LPC coat sheets, each with the mane colour that belongs to it (a Fuchs has a red mane, a Brauner a black one). */
type Sheet = 'brown' | 'black' | 'gold' | 'gray' | 'white';
export const COATS = {
  fuchs: { label: 'Fuchs', sheet: 'brown', mane: 'braun' },
  brauner: { label: 'Brauner', sheet: 'brown', mane: 'schwarz' },
  rappe: { label: 'Rappe', sheet: 'black', mane: 'schwarz' },
  schimmel: { label: 'Schimmel', sheet: 'white', mane: 'weiss' },
  grauschimmel: { label: 'Grauschimmel', sheet: 'gray', mane: 'grau' },
  falbe: { label: 'Falbe', sheet: 'gold', mane: 'schwarz' },
  isabell: { label: 'Isabell', sheet: 'gold', mane: 'weiss' },
} as const satisfies Record<string, { label: string; sheet: Sheet; mane: string }>;
export type Coat = keyof typeof COATS;

export const MANES = { schwarz: 'black', braun: 'brown', blond: 'gold', grau: 'gray', weiss: 'white' } as const satisfies Record<string, Sheet>;
export const MANE_LABELS: Record<Mane, string> = { schwarz: 'schwarz', braun: 'braun', blond: 'blond', grau: 'grau', weiss: 'weiß' };
export type Mane = keyof typeof MANES;

export const FACES = { stern: 'star', blesse: 'blaze', strich: 'stripe', flocke: 'diamond' } as const;
export const FACE_LABELS: Record<Face, string> = { stern: 'Stern', blesse: 'Blesse', strich: 'Strich', flocke: 'Flocke' };
export type Face = keyof typeof FACES;

export const LEGS = { socken: 'socks', stiefel: 'stockings' } as const;
export const LEG_LABELS: Record<Legs, string> = { socken: 'Socken', stiefel: 'Stiefel' };
export type Legs = keyof typeof LEGS;

export type Look = {
  build: Build;
  coat: Coat;
  mane?: Mane; // overrides the coat's own mane colour
  face?: Face;
  legs?: Legs;
  saddle?: boolean;
  blanket?: string; // saddle pad colour, e.g. '#3d6fd9'
};

/** A layer: a sheet under public/assets/, optionally recoloured. */
export type Layer = { path: string; tint?: string };

/** The layers of a look for one animation, bottom to top. The mane is always its own layer (ponies' is thicker). */
export function layers(look: Look, anim: Anim): Layer[] {
  const p = look.build === 'pony' ? 'horses/pony-' : 'horses/';
  const coat = COATS[look.coat], mane: Mane = look.mane ?? coat.mane;
  const out: Layer[] = [{ path: `${p}horse-${anim}-${coat.sheet}.png` }];
  if (look.legs) out.push({ path: `${p}${LEGS[look.legs]}-${anim}.png` });
  if (look.face) out.push({ path: `${p}face-${FACES[look.face]}-${anim}.png` });
  out.push({ path: `${p}mane-${anim}-${MANES[mane]}.png` });
  if (look.blanket) out.push({ path: `${p}tack-blanket-${anim}.png`, tint: look.blanket });
  if (look.saddle) out.push({ path: `${p}tack-saddle-${anim}.png` });
  return out;
}

/** Breeds (Rassen): data only. */
export const BREEDS = {
  haflinger: { label: 'Haflinger', build: 'pony', coats: ['fuchs'], mane: 'blond' },
  islaender: { label: 'Isländer', build: 'pony', coats: ['fuchs', 'brauner', 'rappe', 'schimmel', 'grauschimmel', 'falbe', 'isabell'] },
  reitpony: { label: 'Deutsches Reitpony', build: 'pony', coats: ['fuchs', 'brauner', 'rappe', 'schimmel', 'isabell'] },
  warmblut: { label: 'Warmblut', build: 'horse', coats: ['fuchs', 'brauner', 'rappe', 'schimmel', 'grauschimmel'] },
  quarter: { label: 'Quarter Horse', build: 'horse', coats: ['fuchs', 'brauner', 'falbe', 'isabell', 'rappe'] },
} as const satisfies Record<string, { label: string; build: Build; coats: readonly Coat[]; mane?: Mane }>;
export type Breed = keyof typeof BREEDS;

/** A look that fits the breed: its build, the chosen (or first allowed) coat, and the breed's mane if it has one. */
export function breedLook(breed: Breed, coat?: Coat, extra: Omit<Look, 'build' | 'coat'> = {}): Look {
  const b: (typeof BREEDS)[Breed] = BREEDS[breed];
  const c = coat && (b.coats as readonly Coat[]).includes(coat) ? coat : b.coats[0];
  return { build: b.build, coat: c, ...('mane' in b ? { mane: b.mane } : {}), ...extra };
}
