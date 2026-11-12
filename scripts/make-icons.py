#!/usr/bin/env python3
"""Rebuild every INSS icon from assets/inss.webp.

    python3 scripts/make-icons.py

One source, one place. The artwork is a square badge sitting inside a wide
mostly-white canvas, so it is cropped to its ink before being placed: fitting the
whole canvas into a square icon would shrink the badge to a third of the tile.

Three kinds of output, because the platforms want different things:

  * Opaque tiles (iOS, PWA "any", favicons) — the badge on white. iOS rejects an
    icon with an alpha channel, so these are RGB, never RGBA.
  * Adaptive layers (Android) — a transparent foreground that the launcher
    composites over its own background shape. Android crops to the central 66%,
    so the badge is kept well inside that.
  * Silhouettes (notification icons, splash) — Android draws notification icons
    as alpha masks and tints them itself, so they must be one colour on
    transparent; the splash sits on the accent field and needs the white one.

The source is 77x81, so a 1024 icon is upscaled ~13x. Ask for vector or a 1024
source and the same script produces a sharp set.
"""

from pathlib import Path

from PIL import Image, ImageChops, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets" / "inss.webp"

# Anything lighter than this on every channel counts as canvas, not ink.
CANVAS_LEVEL = 242


def badge() -> Image.Image:
    """The artwork cropped to its ink, as RGBA."""
    im = Image.open(SOURCE).convert("RGB")
    width, height = im.size
    px = im.load()

    xs, ys = [], []
    for y in range(height):
        for x in range(width):
            if not all(channel > CANVAS_LEVEL for channel in px[x, y]):
                xs.append(x)
                ys.append(y)
    if not xs:
        raise SystemExit(f"{SOURCE} looks blank: no ink found.")

    left, right, top, bottom = min(xs), max(xs), min(ys), max(ys)
    # A one-pixel margin keeps the badge's own edge off the crop boundary.
    box = (max(left - 1, 0), max(top - 1, 0), min(right + 2, width), min(bottom + 2, height))
    return im.crop(box).convert("RGBA")


def scaled(art: Image.Image, size: int, fraction: float) -> Image.Image:
    """The badge resized to `fraction` of a `size` square, sharpened, centred."""
    target = max(1, round(size * fraction))
    ratio = target / max(art.size)
    resized = art.resize(
        (max(1, round(art.width * ratio)), max(1, round(art.height * ratio))),
        Image.LANCZOS,
    )
    # Upscaling 13x softens the edges; this puts the contrast back without
    # inventing detail that is not in the source.
    resized = resized.filter(ImageFilter.UnsharpMask(radius=2, percent=70, threshold=2))
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(resized, ((size - resized.width) // 2, (size - resized.height) // 2), resized)
    return canvas


def tile(art: Image.Image, size: int, fraction: float, background: str = "#FFFFFF") -> Image.Image:
    """Opaque square: the badge on a solid field. No alpha, for iOS."""
    base = Image.new("RGB", (size, size), background)
    layer = scaled(art, size, fraction)
    base.paste(layer, (0, 0), layer)
    return base


def silhouette(art: Image.Image, size: int, fraction: float) -> Image.Image:
    """One colour on transparent: alpha from how dark the ink is.

    Both terms matter. Luminance alone would make the transparent margin around
    the badge opaque, because transparent pixels carry RGB 0,0,0 and read as
    black — the shape has to be the *intersection* of "there is ink here" and
    "this pixel is dark".
    """
    layer = scaled(art, size, fraction)
    ink = layer.convert("L").point(lambda value: 255 - value)
    alpha = ImageChops.multiply(layer.getchannel("A"), ink)
    out = Image.new("RGBA", layer.size, (255, 255, 255, 0))
    out.putalpha(alpha)
    return out


def main() -> None:
    art = badge()

    # iOS / store tile, and the source `icon` in app.json.
    tile(art, 1024, 0.88).save(ROOT / "assets" / "images" / "icon.png")

    # Android adaptive icon: foreground inside the 66% safe zone, flat background.
    scaled(art, 1024, 0.60).save(ROOT / "assets" / "images" / "android-icon-foreground.png")
    Image.new("RGB", (1024, 1024), "#FFFFFF").save(
        ROOT / "assets" / "images" / "android-icon-background.png"
    )
    silhouette(art, 1024, 0.60).save(ROOT / "assets" / "images" / "android-icon-monochrome.png")

    # Splash: white mark, because the splash field is the accent blue.
    silhouette(art, 512, 0.90).save(ROOT / "assets" / "images" / "splash-icon.png")

    # `web.favicon` in app.json.
    tile(art, 48, 0.96).save(ROOT / "assets" / "images" / "favicon.png")

    public = ROOT / "public"
    tile(art, 512, 0.92).save(public / "icon-512.png")
    tile(art, 192, 0.92).save(public / "icon-192.png")
    # Maskable is cropped to the launcher's shape, so the badge stays inside the
    # safe circle rather than filling the tile edge to edge.
    tile(art, 512, 0.78).save(public / "icon-maskable-512.png")
    tile(art, 180, 0.92).save(public / "apple-touch-icon.png")
    tile(art, 32, 0.96).save(public / "favicon-32.png")
    tile(art, 16, 0.98).save(public / "favicon-16.png")

    ico = [tile(art, s, 0.96) for s in (16, 32, 48)]
    ico[0].save(
        public / "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
        append_images=ico[1:],
    )

    # Colour, not silhouette: these are the icon and badge of a *browser*
    # notification, which paints them as they are. (An Android notification's
    # small icon does want a white mask, but that is set by the notifications
    # plugin, not by a file in public/.)
    tile(art, 192, 0.92).save(public / "notification-icon.png")
    tile(art, 72, 0.92).save(public / "notification-badge.png")

    written = [
        "assets/images/icon.png",
        "assets/images/android-icon-foreground.png",
        "assets/images/android-icon-background.png",
        "assets/images/android-icon-monochrome.png",
        "assets/images/splash-icon.png",
        "assets/images/favicon.png",
        "public/icon-512.png",
        "public/icon-192.png",
        "public/icon-maskable-512.png",
        "public/apple-touch-icon.png",
        "public/favicon-32.png",
        "public/favicon-16.png",
        "public/favicon.ico",
        "public/notification-icon.png",
        "public/notification-badge.png",
    ]
    for name in written:
        path = ROOT / name
        with Image.open(path) as out:
            print(f"  {name:<42} {out.size[0]:>4}x{out.size[1]:<4} {out.mode}")


if __name__ == "__main__":
    print(f"  source: {SOURCE.relative_to(ROOT)} " f"({Image.open(SOURCE).size[0]}x{Image.open(SOURCE).size[1]})")
    main()
