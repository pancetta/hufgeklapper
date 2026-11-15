"""PROTOTYPE: derive a pony build from the LPC horse sheets.

Usage: python3 -I ponyfy.py <assets/lpc dir>
Reads horse-/mane-/socks-{idle,walk,gallop}-<coat>.png, writes pony-<same name>.png next to them.

Every layer of a frame gets the same geometric edit, measured on the brown base horse of that frame:
- legs: every 2nd pixel row between belly and hooves is removed (legs about half as long),
- body (side views only): every 2nd column in the middle third of the body is removed (shorter, stockier);
  shortening the neck too was tried and dropped: the head then juts forward like a llama's,
- mane layer: grown by one pixel, and one more upwards (thicker, crested pony mane).
Pixels are moved, never resampled, so the pixel art stays crisp.
"""
import os, subprocess, sys

D = sys.argv[1]
F = 128
DIRS = ['N', 'W', 'S', 'E']  # LPC row/column order


def load(p):
    w, h = map(int, subprocess.check_output(['magick', 'identify', '-format', '%w %h', p]).split())
    return w, h, bytearray(subprocess.check_output(['magick', p, '-depth', '8', 'rgba:-']))


def save(p, w, h, buf):
    subprocess.run(['magick', '-size', f'{w}x{h}', '-depth', '8', 'rgba:-', '-strip', p], input=bytes(buf), check=True)


def frames(kind):
    """(x, y, dir) of every frame in a sheet."""
    if kind == 'idle':
        return [(i * F, 0, DIRS[i]) for i in range(4)]
    return [(f * F, r * F, DIRS[r]) for r in range(4) for f in range(6)]


def alpha(buf, w, x, y):
    return buf[(y * w + x) * 4 + 3]


def plan(buf, w, fx, fy, d):
    """Rows and columns to keep for one frame, measured on the base horse."""
    rows = [sum(1 for x in range(F) if alpha(buf, w, fx + x, fy + y) > 0) for y in range(F)]
    filled = [y for y in range(F) if rows[y]]
    if not filled:
        return list(range(F)), list(range(F))
    top, bottom = filled[0], filled[-1]
    widest = max(rows)
    side = d in 'WE'
    body = [y for y in range(top, bottom + 1) if rows[y] >= (0.45 if side else 0.8) * widest]
    belly = body[-1] if body else (top + bottom) // 2
    legs = lambda y: belly + 2 <= y <= bottom - 3 and (y - belly) % 2 == 0
    keep_rows = [y for y in range(F) if not legs(y)]
    keep_cols = list(range(F))
    if side:
        cols = [x for x in range(F) if any(alpha(buf, w, fx + x, fy + y) for y in range(top, belly + 1))]
        x0, x1 = cols[0], cols[-1]
        mid0, mid1 = x0 + int(0.35 * (x1 - x0)), x0 + int(0.65 * (x1 - x0))
        keep_cols = [x for x in range(F) if not (mid0 <= x <= mid1 and (x - mid0) % 2 == 1)]
    return keep_rows, keep_cols


def apply(src, w, fx, fy, keep_rows, keep_cols, dst):
    """Copy kept rows/cols into dst, bottom- and centre-aligned so hooves stay on the ground."""
    dy = F - len(keep_rows)
    dx = (F - len(keep_cols)) // 2
    for j, y in enumerate(keep_rows):
        for i, x in enumerate(keep_cols):
            s = ((fy + y) * w + fx + x) * 4
            t = ((fy + dy + j) * w + fx + dx + i) * 4
            dst[t:t + 4] = src[s:s + 4]


def grow(buf, w, h, up=False):
    """One-pixel dilation of a layer (thicker mane); with up, a second pass grows it upwards only."""
    out = bytearray(buf)
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            if buf[(y * w + x) * 4 + 3]:
                continue
            for nx, ny in ((x, y + 1), (x + 1, y), (x - 1, y), (x, y - 1)):
                s = (ny * w + nx) * 4
                if buf[s + 3]:
                    out[(y * w + x) * 4:(y * w + x) * 4 + 4] = buf[s:s + 4]
                    break
    if up:
        buf, out = out, bytearray(out)
        for y in range(0, h - 1):
            for x in range(w):
                t, s = (y * w + x) * 4, ((y + 1) * w + x) * 4
                if not buf[t + 3] and buf[s + 3]:
                    out[t:t + 4] = buf[s:s + 4]
    return out


for kind in ['idle', 'walk', 'gallop']:
    w, h, base = load(f'{D}/horse-{kind}-brown.png')
    plans = {(fx, fy): plan(base, w, fx, fy, d) for fx, fy, d in frames(kind)}
    for name in sorted(os.listdir(D)):
        if not name.endswith('.png') or name.startswith('pony-') or f'-{kind}-' not in name:
            continue
        w2, h2, src = load(f'{D}/{name}')
        assert (w2, h2) == (w, h), name
        dst = bytearray(len(src))
        for (fx, fy), (kr, kc) in plans.items():
            apply(src, w, fx, fy, kr, kc, dst)
        if name.startswith('mane-'):
            dst = grow(dst, w, h, up=True)
        save(f'{D}/pony-{name}', w, h, dst)
        print('wrote', f'pony-{name}')
