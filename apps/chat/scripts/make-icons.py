"""Generate the PWA icon set from assets/icon.png.

Real sizes, not one large file declared as several. A manifest that claims
192x192 and serves 1024x1024 makes every install download a megabyte to draw a
thumbnail, and some launchers refuse an icon whose dimensions do not match.

The maskable variant is a separate image rather than the same file with a
different `purpose`. Android crops any icon to whatever shape the launcher
uses — circle, squircle, teardrop — and the safe area is the middle 80%. An
icon drawn edge to edge loses its edges to that crop, so this one is scaled
down inside a full-bleed background.

    python scripts/make-icons.py [dist-dir]
"""
import io
import os
import sys

from PIL import Image

DIST = sys.argv[1] if len(sys.argv) > 1 else "dist-web"
SOURCE = "assets/icon.png"
# Matches manifest background_color and the app's canvas, so the padding is
# invisible rather than a grey frame.
BACKGROUND = (23, 22, 20, 255)
# Android's documented safe area for a maskable icon.
SAFE_RATIO = 0.8

if not os.path.exists(SOURCE):
    sys.exit("missing %s" % SOURCE)

out_dir = os.path.join(DIST, "icons")
os.makedirs(out_dir, exist_ok=True)

source = Image.open(SOURCE).convert("RGBA")

for size in (192, 512):
    path = os.path.join(out_dir, "icon-%d.png" % size)
    source.resize((size, size), Image.LANCZOS).save(path, "PNG", optimize=True)
    print("wrote %s (%dx%d)" % (path, size, size))

# Maskable: the artwork occupies the safe area, the rest is background.
size = 512
inner = int(size * SAFE_RATIO)
canvas = Image.new("RGBA", (size, size), BACKGROUND)
art = source.resize((inner, inner), Image.LANCZOS)
offset = (size - inner) // 2
canvas.paste(art, (offset, offset), art)
path = os.path.join(out_dir, "maskable-512.png")
canvas.save(path, "PNG", optimize=True)
print("wrote %s (512x512, %d%% safe area)" % (path, SAFE_RATIO * 100))
