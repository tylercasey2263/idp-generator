"""
Generate PWA icons for Player IDP app.
Design: navy background, teal shield badge, white IDP text.
Run: python3 scripts/generate-icons.py
"""

from PIL import Image, ImageDraw, ImageFont
import os, struct, math

NAVY   = (13, 27, 42)      # #0D1B2A
TEAL   = (27, 138, 107)    # #1B8A6B
TEAL_L = (34, 168, 130)    # #22A882
WHITE  = (255, 255, 255)

OUT = os.path.join(os.path.dirname(__file__), '..', 'icons')

def draw_icon(size, maskable=False):
    img  = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Safe-zone padding for maskable icons (Android adaptive — 20% each side)
    pad = int(size * 0.20) if maskable else 0

    # Background — fill full square with navy (maskable needs full bleed)
    if maskable:
        draw.rectangle([0, 0, size, size], fill=NAVY)
    else:
        # Rounded background
        r = int(size * 0.18)
        draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=NAVY)

    # Shield dimensions
    cx    = size // 2
    sw    = int((size - pad * 2) * 0.62)  # shield width
    sh    = int((size - pad * 2) * 0.72)  # shield height
    sx    = cx - sw // 2
    sy    = pad + int((size - pad * 2) * 0.12)

    # Draw a shield shape (pentagon-like)
    pts = _shield_points(cx, sy, sw, sh)
    draw.polygon(pts, fill=TEAL)

    # Inner shield highlight (slightly smaller, lighter teal)
    inset = max(4, int(sw * 0.06))
    ipts  = _shield_points(cx, sy + inset, sw - inset * 2, sh - inset * 2)
    # gradient feel — draw a subtle inner shade
    draw.polygon(ipts, fill=TEAL_L)

    # "IDP" text — try to load a bold font, fall back to default
    fs = int(sw * 0.42)
    font = _get_font(fs)

    # Draw text with shadow for depth
    text = 'IDP'
    bbox = draw.textbbox((0, 0), text, font=font)
    tw   = bbox[2] - bbox[0]
    th   = bbox[3] - bbox[1]
    ty   = sy + int(sh * 0.28)
    tx   = cx - tw // 2 - bbox[0]

    # Shadow
    shadow_off = max(1, int(fs * 0.04))
    draw.text((tx + shadow_off, ty + shadow_off), text, font=font,
              fill=(0, 0, 0, 120))
    # Main text
    draw.text((tx, ty), text, font=font, fill=WHITE)

    return img


def _shield_points(cx, top_y, w, h):
    """Five-point shield: flat top two corners, curved bottom point."""
    hw   = w // 2
    tip_y = top_y + h
    mid_y = top_y + int(h * 0.60)
    return [
        (cx - hw, top_y),
        (cx + hw, top_y),
        (cx + hw, mid_y),
        (cx,      tip_y),
        (cx - hw, mid_y),
    ]


def _get_font(size):
    candidates = [
        'C:/Windows/Fonts/arialbd.ttf',
        'C:/Windows/Fonts/arial.ttf',
        'C:/Windows/Fonts/calibrib.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    ]
    for p in candidates:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()


def save(img, name, size=None):
    path = os.path.join(OUT, name)
    if size:
        img = img.resize((size, size), Image.LANCZOS)
    # Convert to RGBA, save as PNG
    img.save(path, 'PNG')
    print(f'  OK {name}')


def make_favicon(size=32):
    """Tiny favicon — just a teal square with I inside."""
    img  = Image.new('RGBA', (size, size), NAVY)
    draw = ImageDraw.Draw(img)
    r = max(2, size // 8)
    draw.rounded_rectangle([0, 0, size-1, size-1], radius=r, fill=NAVY)
    # Small teal dot
    d = int(size * 0.55)
    x = (size - d) // 2
    draw.ellipse([x, x, x + d, x + d], fill=TEAL_L)
    fs   = int(d * 0.65)
    font = _get_font(fs)
    bbox = draw.textbbox((0, 0), 'I', font=font)
    tw   = bbox[2] - bbox[0]
    th   = bbox[3] - bbox[1]
    draw.text((size // 2 - tw // 2 - bbox[0], size // 2 - th // 2 - bbox[1]),
              'I', font=font, fill=WHITE)
    return img


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    print('Generating PWA icons...')

    base_512 = draw_icon(512)
    save(base_512, 'icon-512.png')
    save(base_512, 'icon-192.png', size=192)
    save(base_512, 'icon-180.png', size=180)
    save(base_512, 'icon-96.png',  size=96)

    maskable = draw_icon(512, maskable=True)
    save(maskable, 'icon-512-maskable.png')

    fav = make_favicon(32)
    save(fav, 'favicon-32.png')

    # Also save a 16x16
    save(make_favicon(16), 'favicon-16.png')

    print('Done! Icons saved to /icons/')
