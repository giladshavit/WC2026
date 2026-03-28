#!/usr/bin/env python3
"""
Generates Predicto app icons: full home-screen icon + Android adaptive foreground.
Requires Pillow (mobile-app/.venv-icon).
"""
from __future__ import annotations

import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SIZE = 1024
ASSETS = Path(__file__).resolve().parent.parent / "assets"
TROPHY_PATH = ASSETS / "trophy.png"

# Navy radial gradient: lighter center, darker edges
CENTER = (26, 42, 74)
EDGE = (8, 12, 28)
GOLD = (212, 175, 55)
# Max bounding-box side for the "P" (slightly larger = bigger letter on the icon).
P_MAX_SIDE = 835
# How much of the counter the trophy fills horizontally vs vertically (lower = more margin around trophy).
TROPHY_HOLE_FILL_X = 0.92
TROPHY_HOLE_FILL_Y = 0.88


def _find_p_font() -> str:
    """Prefer a bold-but-not-heavy weight so the bowl is wider and the trophy can scale up."""
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/Library/Fonts/Arial Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial Black.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    for p in candidates:
        if Path(p).exists():
            return p
    print("No suitable system font found; install Arial Bold.", file=sys.stderr)
    sys.exit(1)


def _make_radial_background() -> Image.Image:
    img = Image.new("RGB", (SIZE, SIZE))
    px = img.load()
    cx, cy = SIZE / 2, SIZE / 2
    max_d = ((SIZE / 2) ** 2 + (SIZE / 2) ** 2) ** 0.5
    for y in range(SIZE):
        for x in range(SIZE):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 / max_d
            t = min(1.0, d * 1.08)
            r = int(CENTER[0] + (EDGE[0] - CENTER[0]) * t)
            g = int(CENTER[1] + (EDGE[1] - CENTER[1]) * t)
            b = int(CENTER[2] + (EDGE[2] - CENTER[2]) * t)
            px[x, y] = (r, g, b)
    rng = random.Random(42)
    for _ in range(220):
        sx, sy = rng.randint(0, SIZE - 1), rng.randint(0, SIZE - 1)
        br = rng.randint(180, 255)
        px[sx, sy] = (br, br, br)
        if rng.random() < 0.35:
            for dx, dy in ((1, 0), (0, 1), (1, 1)):
                nx, ny = sx + dx, sy + dy
                if 0 <= nx < SIZE and 0 <= ny < SIZE:
                    px[nx, ny] = (min(255, br + 20),) * 3
    return img


def _draw_squircle_border(img: Image.Image, inset: int = 8, radius: int = 200, width: int = 3) -> None:
    draw = ImageDraw.Draw(img)
    r, g, b = GOLD
    for w in range(width):
        o = inset + w
        draw.rounded_rectangle(
            [o, o, SIZE - 1 - o, SIZE - 1 - o],
            radius=radius,
            outline=(r, g, b),
            width=1,
        )


def _pick_font_size(font_path: str, max_side: int = P_MAX_SIDE) -> tuple[ImageFont.FreeTypeFont, tuple[int, int, int, int]]:
    """Return font and text bbox (0,0) anchored for 'P'."""
    draw = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    for size in range(860, 280, -4):
        try:
            font = ImageFont.truetype(font_path, size)
        except OSError:
            continue
        bb = draw.textbbox((0, 0), "P", font=font)
        tw, th = bb[2] - bb[0], bb[3] - bb[1]
        if tw <= max_side and th <= max_side:
            return font, bb
    font = ImageFont.truetype(font_path, 280)
    bb = draw.textbbox((0, 0), "P", font=font)
    return font, bb


def _render_p_mask_white_on_black(font: ImageFont.FreeTypeFont, bb: tuple[int, int, int, int]) -> Image.Image:
    """White P on black; used for hole detection."""
    img = Image.new("RGB", (SIZE, SIZE), (0, 0, 0))
    draw = ImageDraw.Draw(img)
    tw = bb[2] - bb[0]
    th = bb[3] - bb[1]
    x = (SIZE - tw) // 2 - bb[0]
    y = (SIZE - th) // 2 - bb[1]
    draw.text((x, y), "P", font=font, fill=(255, 255, 255))
    return img


def _hole_centroid_and_span(mask_bw: Image.Image) -> tuple[tuple[float, float], tuple[int, int, int, int]]:
    """Exterior flood-filled; remaining black is the counter (hole)."""
    img = mask_bw.convert("RGB").copy()
    ImageDraw.floodfill(img, (0, 0), (255, 0, 0))
    px = img.load()
    xs: list[int] = []
    ys: list[int] = []
    for y in range(SIZE):
        for x in range(SIZE):
            if px[x, y] == (0, 0, 0):
                xs.append(x)
                ys.append(y)
    if not xs:
        return ((SIZE / 2, SIZE / 2), (0, 0, SIZE, SIZE))
    cx = sum(xs) / len(xs)
    cy = sum(ys) / len(ys)
    hl, hr = min(xs), max(xs)
    ht, hb = min(ys), max(ys)
    return (cx, cy), (hl, ht, hr, hb)


def _compose_p_trophy_rgba(
    font: ImageFont.FreeTypeFont,
    bb: tuple[int, int, int, int],
    trophy: Image.Image,
    hole_cx: float,
    hole_cy: float,
    hole_box: tuple[int, int, int, int],
) -> Image.Image:
    """Transparent background; trophy behind white P."""
    tw = bb[2] - bb[0]
    th = bb[3] - bb[1]
    tx = (SIZE - tw) // 2 - bb[0]
    ty = (SIZE - th) // 2 - bb[1]

    hl, ht, hr, hb = hole_box
    hole_w = max(1, hr - hl)
    hole_h = max(1, hb - ht)
    scale = min(
        hole_w * TROPHY_HOLE_FILL_X / trophy.width,
        hole_h * TROPHY_HOLE_FILL_Y / trophy.height,
    )
    tw_img = max(1, int(trophy.width * scale))
    th_img = max(1, int(trophy.height * scale))
    trophy_r = trophy.resize((tw_img, th_img), Image.Resampling.LANCZOS)

    out = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    tlx = int(round(hole_cx - tw_img / 2))
    tly = int(round(hole_cy - th_img / 2))
    out.alpha_composite(trophy_r, (tlx, tly))

    p_layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    p_draw = ImageDraw.Draw(p_layer)
    p_draw.text((tx, ty), "P", font=font, fill=(255, 255, 255, 255))
    out = Image.alpha_composite(out, p_layer)
    return out


def main() -> None:
    if not TROPHY_PATH.exists():
        print(f"Missing {TROPHY_PATH}", file=sys.stderr)
        sys.exit(1)

    font_path = _find_p_font()
    font, bb = _pick_font_size(font_path)
    mask = _render_p_mask_white_on_black(font, bb)
    (hole_cx, hole_cy), hole_box = _hole_centroid_and_span(mask)

    trophy = Image.open(TROPHY_PATH).convert("RGBA")
    fg = _compose_p_trophy_rgba(font, bb, trophy, hole_cx, hole_cy, hole_box)

    bg = _make_radial_background()
    bg = bg.convert("RGBA")
    bg.alpha_composite(fg, (0, 0))
    _draw_squircle_border(bg)
    out_main = ASSETS / "icon.png"
    bg.convert("RGB").save(out_main, "PNG", optimize=True)
    print(f"Wrote {out_main}")

    fg.save(ASSETS / "adaptive-icon.png", "PNG", optimize=True)
    print(f"Wrote {ASSETS / 'adaptive-icon.png'}")


if __name__ == "__main__":
    main()
