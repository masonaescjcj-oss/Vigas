"""Render the Retro Code logo into the app's image assets.

The logo is "r." set in the dots of a round speaker grille — the same drawing
as src/components/ui/MatrixMark.tsx, from the same numbers: a 9x9 grid in a
100-unit box, dots centred every 10 units, only those within 42.5 of the
centre drawn. Keep the two in step.

Writes:
  assets/icon.png           1024 full-bleed, for iOS and the legacy Android icon
  assets/adaptive-icon.png  1024 transparent foreground; the mark sits inside
                            Android's safe circle so no launcher mask cuts it
  assets/splash.png         1284x2778, the mark small on the canvas colour
  assets/favicon.png        256 rounded square for the browser tab

Drawn at 4x and scaled down, which is the antialiasing PIL's ellipse lacks.

    python scripts/make-brand-assets.py
"""
import math

from PIL import Image, ImageDraw

# The "Black" theme, which is the app's default (src/theme/theme.ts).
GROUND = (23, 22, 20, 255)      # canvasBase  #171614
DIM = (58, 54, 49, 255)         # surfaceStrong #3A3631
INK = (239, 234, 225, 255)      # inkPrimary  #EFEAE1
ACCENT = (255, 106, 26, 255)    # brandPrimary #FF6A1A

R_CELLS = {(2, 2), (4, 2), (5, 2), (2, 3), (3, 3), (6, 3), (2, 4), (2, 5), (2, 6)}
PERIOD = (6, 6)
SS = 4  # supersampling factor


def draw_mark(draw, left, top, unit):
    """Draw the mark with its 100-unit box at (left, top), `unit` px per unit."""
    for row in range(9):
        for col in range(9):
            x, y = 10 + col * 10, 10 + row * 10
            if math.hypot(x - 50, y - 50) > 42.5:
                continue
            if (col, row) == PERIOD:
                radius, colour = 4.0, ACCENT
            elif (col, row) in R_CELLS:
                radius, colour = 3.7, INK
            else:
                radius, colour = 3.0, DIM
            cx, cy, r = left + x * unit, top + y * unit, radius * unit
            draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=colour)


def render(width, height, ground, mark_box, rounded=None):
    """A canvas with the mark centred in a square of `mark_box` px."""
    w, h = width * SS, height * SS
    image = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    if ground:
        if rounded:
            draw.rounded_rectangle((0, 0, w - 1, h - 1), radius=rounded * SS, fill=ground)
        else:
            draw.rectangle((0, 0, w, h), fill=ground)
    box = mark_box * SS
    draw_mark(draw, (w - box) / 2, (h - box) / 2, box / 100)
    return image.resize((width, height), Image.LANCZOS)


# Same proportion as the icon drawn on the logo canvas: the 100-unit box
# scaled to 68% of the tile.
render(1024, 1024, GROUND, 1024 * 0.68).save("assets/icon.png", optimize=True)

# The dots reach 46.5 units from the centre (42.5 + the period's radius), so
# the mark is 93 units across. Android's safe circle is 66 of the layer's
# 108 dp (61%); 58% leaves a margin inside it.
render(1024, 1024, None, 1024 * 0.58 * 100 / 93).save("assets/adaptive-icon.png", optimize=True)

render(1284, 2778, GROUND, 300).save("assets/splash.png", optimize=True)

render(256, 256, GROUND, 256 * 0.68, rounded=round(256 * 0.224)).save("assets/favicon.png", optimize=True)

print("wrote assets/icon.png, adaptive-icon.png, splash.png, favicon.png")
