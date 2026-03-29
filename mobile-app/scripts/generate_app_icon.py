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
FOOTBALL_PATH = ASSETS / "football_2026.png"

TROPHY_TARGET = 260  # היה 220 — גביע קצת יותר גדול
TROPHY_CENTER_Y = 720  # היה 760
TEXT_BASELINE_Y = 490  # היה 530
FONT_SIZE = 168  # היה 162 — קצת יותר גדול כי הטקסט עכשיו ה-hero

# Navy radial gradient: lighter center, darker edges
CENTER = (26, 42, 74)
EDGE = (8, 12, 28)
GOLD = (212, 175, 55)


def _find_predict_font() -> str:
    """Prefer Arial Black / heaviest bold for the wordmark."""
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Black.ttf",
        "/Library/Fonts/Arial Black.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/Library/Fonts/Arial Bold.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    for p in candidates:
        if Path(p).exists():
            return p
    print("No suitable system font found; install Arial Black or Arial Bold.", file=sys.stderr)
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


def _cap_height(font: ImageFont.FreeTypeFont) -> int:
    """Cap height from font metrics (H bbox)."""
    l, t, r, b = font.getbbox("H")
    return max(1, b - t)


def _text_advance(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont) -> float:
    if hasattr(draw, "textlength"):
        return float(draw.textlength(text, font=font))
    l, t, r, b = draw.textbbox((0, 0), text, font=font, anchor="ls")
    return float(r - l)


def _compose_foreground_rgba(trophy: Image.Image, font: ImageFont.FreeTypeFont) -> Image.Image:
    """Transparent background: trophy + PREDICT + ball as O (no border, no radial bg)."""
    out = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))

    scale = TROPHY_TARGET / trophy.height
    tw_img = max(1, int(trophy.width * scale))
    th_img = max(1, int(trophy.height * scale))
    trophy_r = trophy.resize((tw_img, th_img), Image.Resampling.LANCZOS)
    tlx = (SIZE - tw_img) // 2
    tly = int(round(TROPHY_CENTER_Y - th_img / 2))
    out.alpha_composite(trophy_r, (tlx, tly))

    cap_h = _cap_height(font)
    ball_d = float(cap_h) * 1.3
    ball_r = ball_d / 2

    layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    word = "PREDICT"
    tw = _text_advance(draw, word, font)
    total_w = tw + ball_d
    text_start_x = (SIZE - total_w) / 2
    ball_cx = text_start_x + tw + ball_r
    ball_cy = TEXT_BASELINE_Y - cap_h / 2

    draw.text(
        (text_start_x, TEXT_BASELINE_Y),
        word,
        font=font,
        fill=(255, 255, 255, 255),
        anchor="ls",
    )

    ball_side = max(1, int(round(ball_d)))
    football = Image.open(FOOTBALL_PATH).convert("RGBA")
    football_r = football.resize((ball_side, ball_side), Image.Resampling.LANCZOS)
    layer.alpha_composite(football_r, (int(ball_cx - ball_r), int(ball_cy - ball_r)))

    out = Image.alpha_composite(out, layer)
    return out


def main() -> None:
    if not TROPHY_PATH.exists():
        print(f"Missing {TROPHY_PATH}", file=sys.stderr)
        sys.exit(1)
    if not FOOTBALL_PATH.exists():
        print(f"Missing {FOOTBALL_PATH}", file=sys.stderr)
        sys.exit(1)

    font_path = _find_predict_font()
    try:
        font = ImageFont.truetype(font_path, FONT_SIZE)
    except OSError:
        print(f"Failed to load font: {font_path}", file=sys.stderr)
        sys.exit(1)

    trophy = Image.open(TROPHY_PATH).convert("RGBA")
    fg = _compose_foreground_rgba(trophy, font)

    bg = _make_radial_background()
    bg = bg.convert("RGBA")
    bg.alpha_composite(fg, (0, 0))
    out_main = ASSETS / "icon.png"
    bg.convert("RGB").save(out_main, "PNG", optimize=True)
    print(f"Wrote {out_main}")

    fg.save(ASSETS / "adaptive-icon.png", "PNG", optimize=True)
    print(f"Wrote {ASSETS / 'adaptive-icon.png'}")


if __name__ == "__main__":
    main()
