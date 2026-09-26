"""Render the RetroAI logo into the app's image assets.

The logo is two tape reels joined by the tape, the left hub lit — the same
drawing as src/components/ui/BrandMark.tsx, from the same numbers in a
100-unit box: reels centred at (29, 50) and (71, 50), radius 17 to the middle
of a 6.5-wide ring, the tape along their bottoms at y = 67. Keep the two in
step.

Writes:
  assets/icon.png           1024 full-bleed, for iOS and the legacy Android icon
  assets/adaptive-icon.png  1024 transparent foreground; the mark sits inside
                            Android's safe circle so no launcher mask cuts it
  assets/splash.png         1284x2778, the mark small on the canvas colour
  assets/favicon.png        256 rounded square for the browser tab

Drawn at 4x and scaled down, which is the antialiasing PIL's ellipse lacks.

    python scripts/make-brand-assets.py
"""
from PIL import Image, ImageDraw

# The "Black" theme, which is the app's default (src/theme/theme.ts).
GROUND = (23, 22, 20, 255)      # canvasBase   #171614
INK = (239, 234, 225, 255)      # inkPrimary   #EFEAE1
ACCENT = (255, 106, 26, 255)    # brandPrimary #FF6A1A

RING, STROKE, REELS, CENTRE_Y, TAPE_Y = 17, 6.5, (29, 71), 50, 67
# Farthest ink from the centre: a reel's outer edge, 21 + 20.25 units out.
EXTENT = 2 * (50 - REELS[0] + RING + STROKE / 2)
SS = 4  # supersampling factor


def draw_mark(draw, left, top, unit):
    """Draw the mark with its 100-unit box at (left, top), `unit` px per unit."""
    def circle(cx, cy, r, **kw):
        x, y, rr = left + cx * unit, top + cy * unit, r * unit
        draw.ellipse((x - rr, y - rr, x + rr, y + rr), **kw)

    outer = RING + STROKE / 2
    for cx in REELS:
        # PIL draws an outline inward from the box, so the box is the outer edge.
        circle(cx, CENTRE_Y, outer, outline=INK, width=round(STROKE * unit))
    draw.rounded_rectangle(
        (left + (REELS[0] - STROKE / 2) * unit, top + (TAPE_Y - STROKE / 2) * unit,
         left + (REELS[1] + STROKE / 2) * unit, top + (TAPE_Y + STROKE / 2) * unit),
        radius=STROKE / 2 * unit, fill=INK)
    circle(REELS[0], CENTRE_Y, 6.2, fill=ACCENT)
    circle(REELS[1], CENTRE_Y, 3.4, fill=INK)


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

# Android's safe circle is 66 of the layer's 108 dp (61%); the mark is kept
# to 58% so it has a margin inside it whatever shape the launcher cuts.
render(1024, 1024, None, 1024 * 0.58 * 100 / EXTENT).save("assets/adaptive-icon.png", optimize=True)

render(1284, 2778, GROUND, 320).save("assets/splash.png", optimize=True)

render(256, 256, GROUND, 256 * 0.68, rounded=round(256 * 0.224)).save("assets/favicon.png", optimize=True)


def og_image():
    """The 1200x630 card a link to the site unfurls into: mark, name, line."""
    from PIL import ImageFont
    fonts = "node_modules/@expo-google-fonts"
    display = ImageFont.truetype(f"{fonts}/bricolage-grotesque/600SemiBold/BricolageGrotesque_600SemiBold.ttf", 132 * SS)
    mono = ImageFont.truetype(f"{fonts}/ibm-plex-mono/400Regular/IBMPlexMono_400Regular.ttf", 34 * SS)
    w, h = 1200 * SS, 630 * SS
    image = Image.new("RGBA", (w, h), GROUND)
    draw = ImageDraw.Draw(image)
    box = 330 * SS
    draw_mark(draw, 70 * SS, (h - box) / 2, box / 100)
    x, baseline = 430 * SS, 322 * SS
    draw.text((x, baseline), "retro", font=display, fill=INK, anchor="ls")
    draw.text((x + draw.textlength("retro", font=display), baseline), "ai", font=display, fill=ACCENT, anchor="ls")
    draw.text((x + 6 * SS, baseline + 74 * SS), "ask anything · build anything", font=mono, fill=(168, 161, 151, 255), anchor="ls")
    return image.resize((1200, 630), Image.LANCZOS).convert("RGB")


og_image().save("assets/og-image.png", optimize=True)

print("wrote assets/icon.png, adaptive-icon.png, splash.png, favicon.png, og-image.png")
