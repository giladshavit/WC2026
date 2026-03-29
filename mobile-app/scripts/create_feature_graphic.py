#!/usr/bin/env python3
"""
Generates Google Play Feature Graphic (1024x500 PNG) matching the splash / app aesthetic.
Requires Pillow.
Run from mobile-app: .venv-icon/bin/python scripts/create_feature_graphic.py
Or from repo root: python mobile-app/scripts/create_feature_graphic.py
"""
from __future__ import annotations

import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

W, H = 1024, 500
ASSETS = Path(__file__).resolve().parent.parent / "assets"
TROPHY_PATH = ASSETS / "trophy.png"
OUT_PATH = ASSETS / "feature-graphic.png"

# Radial gradient: lighter center → dark edges (splash-inspired)
CENTER_RGB = (26, 58, 110)  # #1a3a6e
EDGE_RGB = (6, 13, 26)  # #060d1a

GOLD = (212, 175, 55)
GOLD_LINE = (212, 175, 55)  # #d4af37
SUBTITLE_GRAY = (210, 220, 235)  # brighter white-gray for subtitle

TROPHY_TARGET_HEIGHT = 380
TROPHY_CENTER_X = 220
TITLE_SIZE = 95
SUBTITLE_SIZE = 30
TITLE_LETTER_SPACING = 6
STAR_COUNT = 150


def _find_bold_font() -> str:
    """Same candidate list as generate_app_icon.py (_find_p_font)."""
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/Library/Fonts/Arial Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial Black.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    for p in candidates:
        if Path(p).exists():
            return p
    print("No suitable bold system font found; install Arial Bold.", file=sys.stderr)
    sys.exit(1)


def _find_regular_font() -> str:
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/Library/Fonts/Arial Bold.ttf",
    ]
    for p in candidates:
        if Path(p).exists():
            return p
    print("No Arial font found; install Arial.", file=sys.stderr)
    sys.exit(1)


def _radial_background() -> Image.Image:
    img = Image.new("RGB", (W, H))
    px = img.load()
    cx, cy = W / 2, H / 2
    max_d = ((W / 2) ** 2 + (H / 2) ** 2) ** 0.5
    for y in range(H):
        for x in range(W):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 / max_d
            t = min(1.0, d * 1.08)
            r = int(CENTER_RGB[0] + (EDGE_RGB[0] - CENTER_RGB[0]) * t)
            g = int(CENTER_RGB[1] + (EDGE_RGB[1] - CENTER_RGB[1]) * t)
            b = int(CENTER_RGB[2] + (EDGE_RGB[2] - CENTER_RGB[2]) * t)
            px[x, y] = (r, g, b)
    return img


def _add_stars(img: Image.Image, rng: random.Random) -> None:
    px = img.load()
    for _ in range(STAR_COUNT):
        sx = rng.randint(0, W - 1)
        sy = rng.randint(0, H - 1)
        br = rng.randint(200, 255)
        size = rng.choice([1, 1, 2, 2, 3])
        for dx in range(size):
            for dy in range(size):
                nx, ny = sx + dx, sy + dy
                if 0 <= nx < W and 0 <= ny < H:
                    px[nx, ny] = (br, br, br)


def _gold_radial_glow_layer() -> Image.Image:
    """Soft golden glow behind trophy; peak rgba(212,175,55,0.15)."""
    gw, gh = 520, 460
    glow = Image.new("RGBA", (gw, gh), (0, 0, 0, 0))
    gpx = glow.load()
    gcx, gcy = gw / 2, gh / 2
    max_r = (gcx**2 + gcy**2) ** 0.5
    gold_a_peak = int(round(0.15 * 255))
    r0, g0, b0 = GOLD
    for y in range(gh):
        for x in range(gw):
            d = ((x - gcx) ** 2 + (y - gcy) ** 2) ** 0.5 / max_r
            t = min(1.0, d * 1.15)
            a = int(gold_a_peak * (1.0 - t) ** 2)
            if a > 0:
                gpx[x, y] = (r0, g0, b0, a)
    return glow


def _blend_border_pixel(
    base: tuple[int, int, int], fg: tuple[int, int, int], alpha: float
) -> tuple[int, int, int]:
    return tuple(int(base[i] * (1 - alpha) + fg[i] * alpha) for i in range(3))


def _fix_draw_border_rgb(img: Image.Image, width_px: int = 2, opacity: float = 0.4) -> None:
    """2px gold border with ~0.4 opacity over existing RGB pixels."""
    px = img.load()
    w, h = img.size
    for t in range(width_px):
        for x in range(w):
            for y in (t, h - 1 - t):
                cur = px[x, y]
                px[x, y] = _blend_border_pixel(cur, GOLD_LINE, opacity)
        for y in range(h):
            for x in (t, w - 1 - t):
                cur = px[x, y]
                px[x, y] = _blend_border_pixel(cur, GOLD_LINE, opacity)


def _draw_letter_spaced(
    draw: ImageDraw.ImageDraw,
    text: str,
    xy: tuple[float, float],
    font: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int],
    letter_spacing: int,
) -> tuple[float, float, float, float]:
    """Draw text with extra letter spacing; returns bounding box of the whole string."""
    x, y = xy
    min_x = min_y = float("inf")
    max_x = max_y = float("-inf")
    for i, ch in enumerate(text):
        draw.text((x, y), ch, font=font, fill=fill)
        bb = draw.textbbox((x, y), ch, font=font)
        min_x = min(min_x, bb[0])
        min_y = min(min_y, bb[1])
        max_x = max(max_x, bb[2])
        max_y = max(max_y, bb[3])
        adv = draw.textlength(ch, font=font)
        if i < len(text) - 1:
            x += adv + letter_spacing
        else:
            x += adv
    return (min_x, min_y, max_x, max_y)


def _title_width(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, letter_spacing: int) -> float:
    if not text:
        return 0.0
    total = sum(draw.textlength(ch, font=font) for ch in text)
    total += letter_spacing * (len(text) - 1)
    return float(total)


def main() -> None:
    if not TROPHY_PATH.exists():
        print(f"Missing {TROPHY_PATH}", file=sys.stderr)
        sys.exit(1)

    rng = random.Random(2026)
    base = _radial_background()
    _add_stars(base, rng)

    img = base.convert("RGBA")
    glow = _gold_radial_glow_layer()
    trophy = Image.open(TROPHY_PATH).convert("RGBA")
    th = TROPHY_TARGET_HEIGHT
    tw = max(1, int(trophy.width * (th / trophy.height)))
    trophy_r = trophy.resize((tw, th), Image.Resampling.LANCZOS)

    tcx, tcy = TROPHY_CENTER_X, H // 2
    glx = tcx - glow.width // 2
    gly = tcy - glow.height // 2
    img.alpha_composite(glow, (glx, gly))

    tlx = int(round(tcx - tw / 2))
    tly = int(round(tcy - th / 2))
    img.alpha_composite(trophy_r, (tlx, tly))

    bold_path = _find_bold_font()
    subtitle_path = _find_regular_font()
    title_font = ImageFont.truetype(bold_path, TITLE_SIZE)
    sub_font = ImageFont.truetype(subtitle_path, SUBTITLE_SIZE)

    draw = ImageDraw.Draw(img)
    title_text = "PREDICTO"

    words = ["World", "Cup", "2026", "Predictions"]
    word_gap = 12  # pixels between words (no space character rendering)
    fills = [SUBTITLE_GRAY, SUBTITLE_GRAY, SUBTITLE_GRAY, SUBTITLE_GRAY]
    word_widths = [draw.textlength(w, font=sub_font) for w in words]
    total_sub_w = sum(word_widths) + word_gap * (len(words) - 1)
    sub_bb0 = draw.textbbox((0, 0), words[0], font=sub_font)
    sub_w = total_sub_w
    title_bb_probe = draw.textbbox((0, 0), title_text, font=title_font)
    title_total_w = _title_width(draw, title_text, title_font, TITLE_LETTER_SPACING)

    text_left = 430
    line_w = max(title_total_w, sub_w)

    # Vertical stack: title, gap, line, gap, subtitle
    gap_title_line = 14
    gap_line_sub = 12
    line_thickness = 2

    sub_h = sub_bb0[3] - sub_bb0[1]
    title_h = title_bb_probe[3] - title_bb_probe[1]

    stack_h = title_h + gap_title_line + line_thickness + gap_line_sub + sub_h
    top_y = (H - stack_h) / 2

    title_x = float(text_left)
    title_y = float(top_y - title_bb_probe[1])

    bb_title = _draw_letter_spaced(
        draw,
        title_text,
        (title_x, title_y),
        title_font,
        (255, 255, 255),
        TITLE_LETTER_SPACING,
    )

    line_y = bb_title[3] + gap_title_line
    line_x0 = text_left
    line_x1 = line_x0 + line_w
    draw.rectangle(
        [line_x0, line_y, line_x1, line_y + line_thickness],
        fill=(*GOLD_LINE, 255),
    )

    sub_y = line_y + line_thickness + gap_line_sub
    line_center = line_x0 + line_w / 2
    cur_x = line_center - total_sub_w / 2
    sub_y_draw = sub_y - sub_bb0[1]
    for i, word in enumerate(words):
        draw.text((cur_x, sub_y_draw), word, font=sub_font, fill=fills[i])
        cur_x += word_widths[i]
        if i < len(words) - 1:
            cur_x += word_gap

    out_rgb = img.convert("RGB")

    _fix_draw_border_rgb(out_rgb, width_px=2, opacity=0.4)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    out_rgb.save(OUT_PATH, "PNG", optimize=True)
    print(f"Wrote {OUT_PATH}")


if __name__ == "__main__":
    main()
