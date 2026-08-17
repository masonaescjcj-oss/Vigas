"""
scripts/recolour-assets.py
---------------------------------------------------------------------------
Bring the launch assets in line with the app's palette.

The icon, splash and favicon were the pre-launch purple (#6D42C7) while the app
itself renders on near-black (#0E0F0F). That is not only an old brand — it is a
full-screen purple flash on every single launch, because the splash background
and the app's first frame are different colours. The splash is the first thing
anyone sees, and it currently looks like a different app handing over to ours.

The mark itself is untouched: this only remaps the two flat colours each asset
contains, so the shape and the anti-aliasing are preserved exactly.

Requires Pillow (dev-only tooling, not an app dependency):

    python scripts/recolour-assets.py
---------------------------------------------------------------------------
"""

from PIL import Image

# The app's canvas in the darkest theme. The splash background must equal this
# exactly, or the handover flashes.
CANVAS = (14, 15, 15)
# The brand accent used for every primary action in the app.
ACCENT = (63, 193, 211)

OLD_BRAND = (109, 66, 199)
OLD_MARK = (255, 255, 255)

ASSETS = ["splash", "icon", "adaptive-icon", "favicon"]


def recolour(name: str) -> str:
    path = f"assets/{name}.png"
    image = Image.open(path).convert("RGBA")
    pixels = image.load()
    width, height = image.size
    changed = 0

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            # Anti-aliased edges are blends of the two flat colours, so nearness
            # decides which one a pixel belongs to rather than equality.
            to_brand = abs(r - OLD_BRAND[0]) + abs(g - OLD_BRAND[1]) + abs(b - OLD_BRAND[2])
            to_mark = abs(r - OLD_MARK[0]) + abs(g - OLD_MARK[1]) + abs(b - OLD_MARK[2])
            target = CANVAS if to_brand <= to_mark else ACCENT
            # Alpha is left alone. The Android adaptive foreground stores its
            # background as fully transparent purple, and filling that in would
            # produce a square icon inside the system's own mask.
            pixels[x, y] = (target[0], target[1], target[2], a)
            changed += 1

    image.save(path)
    return f"{name}: {width}x{height}, {changed} pixels remapped"


for asset in ASSETS:
    print(recolour(asset))

print("\nRemember: app.json's splash.backgroundColor and android.adaptiveIcon")
print("backgroundColor must both be #0E0F0F to match.")
