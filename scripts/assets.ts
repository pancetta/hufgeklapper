/**
 * npm run assets: downloads the free art packs, copies the sheets the game uses into public/assets/ unchanged,
 * derives the pony sheets from the LPC horses, and writes the credits (src/credits.json and CREDITS.md).
 * Downloads are cached in .cache/assets/. Never edit public/assets/, src/credits.json or CREDITS.md by hand.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import sharp from 'sharp';
import { shineEyes } from './eyes.ts';
import { applyPlans, byColumn, byRow, type Image, type Layout, planSheet } from './pony.ts';

const CACHE = '.cache/assets', OUT = 'public/assets';
const OGA = 'https://opengameart.org/sites/default/files';
const COATS = { brown: 'Brown', black: 'Black', gold: 'Gold', gray: 'Gray', white: 'White' };

type Pack = {
  title: string; authors: string; license: string; licenseUrl: string; page: string;
  download: string[]; // files, or one .zip that is unpacked
  credits?: string; // the pack's own credits file (path inside the zip), shipped alongside
  copy: Record<string, string>; // output path under public/assets → path inside the pack
  crop?: Record<string, [x: number, y: number, w: number, h: number]>; // outputs cut down to the part the game uses
};

const LICENSES = {
  'CC-BY 3.0': 'https://creativecommons.org/licenses/by/3.0/',
  'CC-BY 4.0': 'https://creativecommons.org/licenses/by/4.0/',
  'CC-BY-SA 3.0': 'https://creativecommons.org/licenses/by-sa/3.0/',
  'CC-BY-SA 4.0': 'https://creativecommons.org/licenses/by-sa/4.0/',
  'OFL 1.1': 'https://openfontlicense.org/',
};
const lic = (l: keyof typeof LICENSES) => ({ license: l, licenseUrl: LICENSES[l] });

const ext = 'LPC Horse Extended';
const PACKS: Record<string, Pack> = {
  'lpc-horse-extended': {
    title: 'LPC Horse Extended', authors: 'bluecarrot16; Benjamin K. Smith (BenCreating)', ...lic('CC-BY 3.0'),
    page: 'https://opengameart.org/content/lpc-horse-extended', download: [`${OGA}/LPC%20Horse%20Extended.zip`],
    credits: `${ext}/Read Me.txt`,
    copy: Object.fromEntries(['Idle', 'Walk', 'Gallop'].flatMap((A) => {
      const a = A.toLowerCase();
      return [
        ...Object.entries(COATS).flatMap(([c, C]) => [
          [`horses/horse-${a}-${c}.png`, `${ext}/Horse/Horse ${A} ${C}.png`],
          [`horses/mane-${a}-${c}.png`, `${ext}/Markings/Mane:Tail/Mane:Tail ${A} ${C}.png`],
        ]),
        // white leg markings: the white coat's version, which reads as white on every coat
        ...['Socks', 'Stockings'].map((l) => [`horses/${l.toLowerCase()}-${a}.png`, `${ext}/Markings/Legs/All Legs/${l} ${A} White.png`]),
        // white face markings and tack fit every coat, so they exist once per animation
        ...['Star', 'Blaze', 'Stripe', 'Diamond'].map((m) => [`horses/face-${m.toLowerCase()}-${a}.png`, `${ext}/Markings/Face/${m} ${A}.png`]),
        ...['Saddle', 'Blanket'].map((t) => [`horses/tack-${t.toLowerCase()}-${a}.png`, `${ext}/Accessories/${t} ${A}.png`]),
      ];
    })),
  },
  'lpc-horses': {
    title: '[LPC] Horses', authors: 'bluecarrot16', ...lic('CC-BY 3.0'), page: 'https://opengameart.org/content/lpc-horses',
    download: ['brown', 'black', 'golden', 'gray', 'white'].map((c) => `${OGA}/horse-${c}_0.png`),
    copy: Object.fromEntries(Object.keys(COATS).map((c) => [`horses/classic-${c}.png`, `horse-${c === 'gold' ? 'golden' : c}_0.png`])),
  },
  'lpc-farm': {
    title: '[LPC] Farm', authors: 'bluecarrot16; Wolthera van Hövell tot Westerflier (TheraHedwig); Ivan Voirol', ...lic('CC-BY 4.0'),
    page: 'https://opengameart.org/content/lpc-farm', download: [`${OGA}/lpc-farm.zip`], credits: 'lpc-farm/CREDITS-farm.txt',
    copy: { 'farm/barn.png': 'lpc-farm/barn.png', 'farm/windmill-blades.png': 'lpc-farm/blade-small.png' },
  },
  'lpc-terrains': {
    title: '[LPC] Terrains', authors: 'bluecarrot16, Sharm, Daneeklu, Jetrel, Zabin, Hyptosis, Casper Nilsson, Buko Studios, Nushio, ZaPaper, billknye, William Thompson, caeles, Redshrike, Bertram, RayaneFLX (all in the credits file)',
    ...lic('CC-BY-SA 4.0'), page: 'https://opengameart.org/content/lpc-terrains', download: [`${OGA}/lpc-terrains.zip`],
    credits: 'lpc-terrains/CREDITS-terrain.txt', copy: { 'nature/terrain.png': 'lpc-terrains/terrain-v7.png' },
  },
  'lpc-trees': {
    title: '[LPC] Trees', authors: 'bluecarrot16, Jetrel, Zabin, Hyptosis, Surt, Buch, Johann Charlot, Open Surge team, Gaurav Munjal, Ivan Voirol (all in the credits file)',
    ...lic('CC-BY-SA 3.0'), page: 'https://opengameart.org/content/lpc-trees', download: [`${OGA}/lpc-trees.zip`],
    credits: 'lpc-trees/CREDITS-trees.txt', copy: { 'nature/trees.png': 'lpc-trees/trees-green.png' },
  },
  'lpc-fruit-trees': {
    title: '[LPC] Fruit Trees', authors: 'bluecarrot16, Joshua Taylor, cynicmusic', ...lic('CC-BY-SA 4.0'),
    page: 'https://opengameart.org/content/lpc-fruit-trees', download: [`${OGA}/lpc-fruit-trees.zip`],
    credits: 'lpc-fruit-trees/CREDITS-fruit-trees.txt', copy: { 'nature/fruit-trees.png': 'lpc-fruit-trees/fruit-trees.png' },
    crop: { 'nature/fruit-trees.png': [0, 512, 1024, 512] }, // the full sheet is 1024×4096 (16 MB decoded) for one tree
  },
  'lpc-plants': {
    title: '[LPC] Flowers / Plants / Fungi / Wood', authors: 'bluecarrot16, Guido Bos, Ivan Voirol, SpiderDave, William Thompson, Yar and others (all in the credits file)',
    ...lic('CC-BY-SA 3.0'), page: 'https://opengameart.org/content/lpc-flowers-plants-fungi-wood',
    download: [`${OGA}/lpc-flowers-plants-fungi-wood.zip`], credits: 'lpc-flowers-plants-fungi-wood/CREDITS-plants.txt',
    copy: { 'nature/plants.png': 'lpc-flowers-plants-fungi-wood/plants.png' },
  },
  'lpc-decorations': {
    title: '[LPC] Medieval Village Decorations', authors: 'bluecarrot16, Sharm, Reemax, Xenodora, Johann C, Johannes Sjölund, Casper Nilsson, Daniel Cook, RayaneFLX, TheraHedwig and others (all in the credits file)',
    ...lic('CC-BY-SA 4.0'), page: 'https://opengameart.org/content/lpc-medieval-village-decorations',
    download: [`${OGA}/decoration_medieval.zip`], credits: 'decoration_medieval/CREDITS-decorations-medieval.txt',
    copy: { 'farm/decorations.png': 'decoration_medieval/decorations-medieval.png', 'farm/fences.png': 'decoration_medieval/fence_medieval.png' },
  },
  'lpc-farm-animals': {
    title: 'LPC style farm animals', authors: 'Daniel Eddeland (daneeklu)', ...lic('CC-BY 3.0'),
    page: 'https://opengameart.org/content/lpc-style-farm-animals',
    download: ['chicken_eat', 'chicken_walk', 'sheep_eat', 'sheep_walk'].map((f) => `${OGA}/${f}.png`),
    copy: Object.fromEntries(['chicken_eat', 'chicken_walk', 'sheep_eat', 'sheep_walk'].map((f) => [`animals/${f.replace('_', '-')}.png`, `${f}.png`])),
  },
  'lpc-cats-dogs': {
    title: '[LPC] Cats and Dogs', authors: 'bluecarrot16', ...lic('CC-BY 3.0'), page: 'https://opengameart.org/content/lpc-cats-and-dogs',
    download: [`${OGA}/cat_0.png`, `${OGA}/dog_2.png`], copy: { 'animals/cat.png': 'cat_0.png', 'animals/dog.png': 'dog_2.png' },
  },
  vt323: {
    title: 'VT323', authors: 'The VT323 Project Authors (Peter Hull)', ...lic('OFL 1.1'),
    page: 'https://github.com/phoikoi/VT323',
    download: ['https://github.com/google/fonts/raw/main/ofl/vt323/VT323-Regular.ttf', 'https://github.com/google/fonts/raw/main/ofl/vt323/OFL.txt'],
    credits: 'OFL.txt', copy: { 'fonts/VT323.ttf': 'VT323-Regular.ttf' },
  },
};

/** Sheets derived from the horses: every Extended layer and the classic sheet get a pony version. */
const PONY_SOURCES = ['lpc-horse-extended', 'lpc-horses'];

async function fetchPack(id: string, pack: Pack) {
  const dir = `${CACHE}/${id}`;
  if (existsSync(dir)) return dir;
  mkdirSync(dir, { recursive: true });
  try {
    for (const url of pack.download) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
      const file = `${dir}/${decodeURIComponent(basename(new URL(url).pathname))}`;
      writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      if (file.endsWith('.zip')) { execFileSync('unzip', ['-q', '-o', file, '-d', dir, '-x', '__MACOSX/*']); rmSync(file); }
    }
  } catch (e) {
    rmSync(dir, { recursive: true, force: true }); // a half-filled cache would pass for a complete one next time
    throw e;
  }
  return dir;
}

async function read(path: string): Promise<Image> {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data) };
}
const write = (path: string, img: Image) =>
  sharp(Buffer.from(img.data), { raw: { width: img.width, height: img.height, channels: 4 } }).png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(path);

/** Pony versions of the horse sheets; a sheet's frames are measured on the horse sheet of the same animation and coat. */
async function derivePonies(files: string[]) {
  const made: string[] = [];
  for (const file of files) {
    const name = basename(file);
    // frames are measured on the horse of the same animation (and coat; layers that fit every coat use the brown one)
    const anim = name.match(/-(idle|walk|gallop)[-.]/)?.[1];
    const base = /^(face|tack|socks|stockings)-/.test(name) ? `horse-${anim}-brown.png` : name.replace(/^mane-/, 'horse-');
    const layout = layoutOf(name);
    const out = `${dirname(file)}/pony-${name}`;
    await write(out, applyPlans(await read(file), planSheet(await read(`${dirname(file)}/${base}`), layout), name.startsWith('mane-')));
    made.push(out);
  }
  return made;
}
const layoutOf = (name: string): Layout => (/-idle[-.]/.test(name) ? byColumn : name.startsWith('classic-') ? classicLayout : byRow);

/** Glints in the eyes of the horse sheets (the mane and socks layers have no eyes). */
async function shineHorses(files: string[]) {
  for (const file of files.filter((f) => /\/(horse|classic)-[^/]*\.png$/.test(f))) await write(file, shineEyes(await read(file), layoutOf(basename(file))));
}

/**
 * The classic [LPC] Horses sheet, rows of 4 frames: 0–3 gallop and 4–7 walk (N, W, S, E), 8 one idle frame per
 * direction, 9–12 eat (N, W, S, E), 13+ the long gallop sideways.
 */
const classicLayout: Layout = (col, row) =>
  row < 8 ? byRow(col, row) : row === 8 ? byColumn(col, row) : row <= 12 ? byRow(col, row - 9) : 'W';

const credits: { title: string; authors: string; license: string; licenseUrl: string; page: string; creditsFile?: string; files: string[]; note?: string }[] = [];
rmSync(OUT, { recursive: true, force: true });
for (const [id, pack] of Object.entries(PACKS)) {
  const dir = await fetchPack(id, pack);
  const files: string[] = [];
  for (const [out, from] of Object.entries(pack.copy)) {
    mkdirSync(dirname(`${OUT}/${out}`), { recursive: true });
    // PNGs are re-encoded losslessly (some LPC sheets are stored almost uncompressed); the pixels stay identical
    const crop = pack.crop?.[out];
    if (out.endsWith('.png')) await (crop ? sharp(`${dir}/${from}`).extract({ left: crop[0], top: crop[1], width: crop[2], height: crop[3] }) : sharp(`${dir}/${from}`))
      .png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(`${OUT}/${out}`);
    else copyFileSync(`${dir}/${from}`, `${OUT}/${out}`);
    files.push(`${OUT}/${out}`);
  }
  let creditsFile;
  if (pack.credits) {
    creditsFile = `${OUT}/credits/${id}.txt`;
    mkdirSync(dirname(creditsFile), { recursive: true });
    copyFileSync(`${dir}/${pack.credits}`, creditsFile);
    files.push(creditsFile);
  }
  if (PONY_SOURCES.includes(id)) await shineHorses(files);
  const ponies = PONY_SOURCES.includes(id) ? await derivePonies(files.filter((f) => f.endsWith('.png'))) : [];
  credits.push({ title: pack.title, authors: pack.authors, license: pack.license, licenseUrl: pack.licenseUrl, page: pack.page, creditsFile, files: [...files, ...ponies],
    note: pack.crop ? 'cropped to the part the game uses' : ponies.length ? 'a glint added to every eye (scripts/eyes.ts); pony-* sheets derived by scripts/pony.ts (legs and body shortened, mane thickened)' : undefined });
}

const rel = (f: string) => f.replace(/^public\//, '');
writeFileSync('src/credits.json', JSON.stringify(credits.map((c) => ({ ...c, creditsFile: c.creditsFile && rel(c.creditsFile), files: c.files.map(rel) })), null, 2) + '\n');
writeFileSync('CREDITS.md', `# Credits

Third-party art and fonts in Hufgeklapper. Written by \`npm run assets\` (\`scripts/assets.ts\`); don't edit by hand.
Sheets are shipped unchanged (PNGs re-encoded losslessly) unless the note says otherwise. Each pack's own credits file, which names the author of
every part, ships next to the art under \`public/assets/credits/\`.

| Asset | Authors | Licence | Source | Files |
|---|---|---|---|---|
${credits.map((c) => `| ${c.title} | ${c.authors} | [${c.license}](${c.licenseUrl}) | ${c.page} | ${c.files.map((f) => `\`${f}\``).join(', ')}${c.note ? ` (${c.note})` : ''} |`).join('\n')}

## Our own drawings

Made for Hufgeklapper and drawn in code, in the LPC style (32 px grid, dark outlines):

- Riders: the pupils and the player's avatar with riding helmet, jacket, breeches, boots and four hair styles (\`src/scene/kids.ts\`)
- Portraits: Oma Hanne and Frau Berger, the inspector (\`src/scene/oma.ts\`)
- The farm: the windmill's tower (\`src/scene/windmill.ts\`; its blades are from [LPC] Farm), the open shelter, the Reitschule's pennants, flower boxes, the free plot's stakes and sign, the arena's show jumps (\`src/scene/buildings.ts\`)
- The show-jumping arena: sand, white fence, upright, cross pole and oxer from above, knocked poles, number plates, start and finish flags (\`src/scene/jumping.ts\`)
- The stable and the care stall: plank wall, straw, half doors, light through the windows, manure, hoof rings, sparkles (\`src/scene/stable.ts\`, \`src/scene/care.ts\`; the windows and the hay are LPC)
- The manure heap by the barn (\`src/scene/buildings.ts\`)
- Butterflies, birds, cloud shadows, ripples on the pond (\`src/scene/life.ts\`)
- Icons for needs, care tools, money, the riding helmet and the riding badge's rosette (\`src/ui/icons.ts\`)
- The home-screen icon, a golden horseshoe (\`scripts/icon.ts\` → \`public/icons/\`)

The ponies (\`scripts/pony.ts\`) and the eye glints (\`scripts/eyes.ts\`) are derived from LPC files, so they keep the attribution above.
`);
console.log(`wrote ${credits.reduce((n, c) => n + c.files.length, 0)} files from ${credits.length} packs`);
