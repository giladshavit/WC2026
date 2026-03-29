#!/usr/bin/env python3
"""
Generates Predicto app icons: full home-screen icon + Android adaptive foreground.
Requires Pillow (mobile-app/.venv-icon).
"""
from __future__ import annotations

import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

SIZE = 1024
ASSETS = Path(__file__).resolve().parent.parent / "assets"
TROPHY_PATH = ASSETS / "trophy.png"
FOOTBALL_PATH = ASSETS / "football_2026.png"

# Dimensions and positions for the perfect pyramidal composition (from image_13.png)
TROPHY_TARGET = 260  # Scaled down to avoid clipping
TROPHY_CENTER_Y = 698  # slightly up — balances with text toward canvas center
TEXT_BASELINE_Y = 458  # closer to vertical middle (512)
FONT_SIZE = 156  # slightly larger wordmark

# Navy radial gradient: lighter center, darker edges (starry field background)
CENTER = (26, 42, 74)
EDGE = (8, 12, 28)

# Solid gold for glow mask (#FFD700) before Gaussian blur
GLOW_GOLD_RGBA = (255, 215, 0, 255)
GLOW_BLUR_RADIUS = 18


def _find_predict_font() -> str:
    """Prefer modern geometric sans (Montserrat, Avenir, Roboto) before Arial/Helvetica."""
    candidates = [
        # Montserrat — macOS / user Library
        "/Library/Fonts/Montserrat-Black.ttf",
        "/Library/Fonts/Montserrat Black.ttf",
        "/System/Library/Fonts/Supplemental/Montserrat-Black.ttf",
        # Montserrat — Windows
        "C:/Windows/Fonts/Montserrat-Black.ttf",
        "C:/Windows/Fonts/Montserrat-Bold.ttf",
        "C:/Windows/Fonts/montserrat_black.ttf",
        "C:/Windows/Fonts/montserrat_bold.ttf",
        # Avenir Next — macOS system
        "/System/Library/Fonts/Supplemental/Avenir Next.ttc",
        "/System/Library/Fonts/Supplemental/Avenir Next Condensed.ttc",
        "/Library/Fonts/Avenir Next.ttc",
        "/Library/Fonts/Avenir Next Condensed.ttc",
        # Avenir — Windows (if installed)
        "C:/Windows/Fonts/Avenir Next Heavy.ttf",
        "C:/Windows/Fonts/AvenirNext-Heavy.ttf",
        "C:/Windows/Fonts/Avenir Next Condensed Heavy.ttf",
        # Roboto
        "/Library/Fonts/Roboto-Black.ttf",
        "/System/Library/Fonts/Supplemental/Roboto-Black.ttf",
        "C:/Windows/Fonts/Roboto-Black.ttf",
        "C:/Windows/Fonts/Roboto-Bold.ttf",
        # Fallbacks — Arial / Helvetica (broad availability)
        "/System/Library/Fonts/Supplemental/Arial Black.ttf",
        "/Library/Fonts/Arial Black.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/Library/Fonts/Arial Bold.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    for p in candidates:
        if Path(p).exists():
            return p
    print(
        "No suitable font found. Install Montserrat Black, Roboto Black, or Arial Black.",
        file=sys.stderr,
    )
    sys.exit(1)


def _make_radial_background() -> Image.Image:
    """Create the dark navy blue starry field with radial gradient."""
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


def _cap_height(font: ImageFont.FreeTypeFont) -> int:
    """Cap height from font metrics (H bbox)."""
    l, t, r, b = font.getbbox("H")
    return max(1, b - t)


def _text_advance(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont) -> float:
    if hasattr(draw, "textlength"):
        return float(draw.textlength(text, font=font))
    l, t, r, b = draw.textbbox((0, 0), text, font=font, anchor="ls")
    return float(r - l)


def _gold_silhouette(rgba: Image.Image) -> Image.Image:
    """Solid #FFD700 with the source alpha channel (for glow mask)."""
    gold = Image.new("RGBA", rgba.size, GLOW_GOLD_RGBA)
    gold.putalpha(rgba.split()[3])
    return gold


def _build_foreground_layers(
    trophy: Image.Image,
    font: ImageFont.FreeTypeFont,
    football_src: Image.Image,
) -> tuple[Image.Image, Image.Image]:
    """Return (gold glow mask pre-blur, sharp foreground with original colors)."""
    glow_mask = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    sharp = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))

    scale = TROPHY_TARGET / trophy.height
    tw_img = max(1, int(trophy.width * scale))
    th_img = max(1, int(trophy.height * scale))
    trophy_r = trophy.resize((tw_img, th_img), Image.Resampling.LANCZOS)
    tlx = (SIZE - tw_img) // 2
    tly = int(round(TROPHY_CENTER_Y - th_img / 2))

    glow_mask.alpha_composite(_gold_silhouette(trophy_r), (tlx, tly))
    sharp.alpha_composite(trophy_r, (tlx, tly))

    word = "PREDICTO"
    cap_h = _cap_height(font)
    measure = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    pre = "PREDICT"
    pre_w = _text_advance(measure, pre, font)
    ball_d = float(cap_h) * 1.5
    ball_r = ball_d / 2
    ball_side = max(1, int(round(ball_d)))
    l, t, r, b = font.getbbox("O")
    o_char_w = float(r - l)
    # Ball center on the O glyph (scales with FONT_SIZE); span = P through ball's right edge
    visual_w = pre_w + o_char_w / 2 + ball_r
    text_start_x = (SIZE - visual_w) / 2
    ball_cx = text_start_x + pre_w + o_char_w / 2
    ball_cy = TEXT_BASELINE_Y - cap_h / 2

    ImageDraw.Draw(glow_mask).text(
        (text_start_x, TEXT_BASELINE_Y),
        word,
        font=font,
        fill=GLOW_GOLD_RGBA,
        anchor="ls",
    )
    ImageDraw.Draw(sharp).text(
        (text_start_x, TEXT_BASELINE_Y),
        word,
        font=font,
        fill=(255, 255, 255, 255),
        anchor="ls",
    )

    football_r = football_src.resize((ball_side, ball_side), Image.Resampling.LANCZOS)
    bx, by = int(ball_cx - ball_r), int(ball_cy - ball_r)

    glow_mask.alpha_composite(_gold_silhouette(football_r), (bx, by))
    sharp.alpha_composite(football_r, (bx, by))

    return glow_mask, sharp


def main() -> None:
    if not TROPHY_PATH.exists():
        print(f"Error: Missing trophy image at {TROPHY_PATH}", file=sys.stderr)
        print("Please place the trophy.png from your asset bundle in the assets folder.", file=sys.stderr)
        sys.exit(1)
    if not FOOTBALL_PATH.exists():
        print(f"Error: Missing football image at {FOOTBALL_PATH}", file=sys.stderr)
        print("Please place the football_2026.png from your asset bundle in the assets folder.", file=sys.stderr)
        sys.exit(1)

    font_path = _find_predict_font()
    try:
        font = ImageFont.truetype(font_path, FONT_SIZE)
    except OSError:
        print(f"Failed to load font: {font_path}", file=sys.stderr)
        sys.exit(1)

    trophy = Image.open(TROPHY_PATH).convert("RGBA")
    football = Image.open(FOOTBALL_PATH).convert("RGBA")
    glow_mask, sharp_fg = _build_foreground_layers(trophy, font, football)
    glow_blurred = glow_mask.filter(ImageFilter.GaussianBlur(GLOW_BLUR_RADIUS))

    bg = _make_radial_background()
    bg = bg.convert("RGBA")
    for _ in range(3):
        bg.alpha_composite(glow_blurred, (0, 0))
    bg.alpha_composite(sharp_fg, (0, 0))
    out_main = ASSETS / "icon.png"
    bg.convert("RGB").save(out_main, "PNG", optimize=True)
    print(f"Wrote {out_main}")

    adaptive = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    for _ in range(3):
        adaptive.alpha_composite(glow_blurred, (0, 0))
    adaptive.alpha_composite(sharp_fg, (0, 0))
    adaptive.save(ASSETS / "adaptive-icon.png", "PNG", optimize=True)
    print(f"Wrote {ASSETS / 'adaptive-icon.png'}")


if __name__ == "__main__":
    main()