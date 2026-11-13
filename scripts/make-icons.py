#!/usr/bin/env python3
"""Rebuild every INSS icon from the vector logo.

    python3 scripts/make-icons.py

The artwork is `assets/in-logo-pmsC.eps` — the 216x251pt Illustrator original,
drawn once and rasterised here at 1200dpi (~3600px wide), so every size below is
downsampled from the same sharp master instead of upscaled from a thumbnail.
It needs ghostscript on the machine that runs it:

    brew install ghostscript     # macOS
    apt install ghostscript      # Debian/Ubuntu

The EPS is a Mac-binary Illustrator file: a preview header sits in front of the
PostScript and a TIFF preview is appended after it, and ghostscript tries to
execute both. The two are trimmed off before it is rendered.

Four kinds of output, because the platforms want different things:

  * Opaque tiles (iOS/App Store, Play, PWA "any", favicons, Windows tiles) — the
    lockup on white. Apple rejects an icon with an alpha channel, so these are
    RGB, never RGBA.
  * Adaptive layers (Android) — a transparent foreground that the launcher
    composites over its own background shape. Android crops to the central 66%,
    so the mark alone is kept well inside that; the wordmark would not survive.
  * Silhouettes (splash, notification badge, lock-screen logo) — one colour on
    transparent. The splash sits on the accent field and needs the white one.
  * Maskable PWA icons — full-bleed, with the lockup inside the 80% safe circle
    so a launcher's own shape cannot clip it.

Three logo crops come out of the master: the full lockup (unit + "in" + "SELF
STORAGE"), the mark alone (unit + "in"), and those recoloured white.
"""

from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets" / "in-logo-pmsC.eps"

WHITE = (255, 255, 255, 255)

# Microsoft Store / MSIX package assets are scale-qualified; scale-100 is the
# unsuffixed base name Partner Center looks for.
SCALES = (100, 125, 150, 200, 400)


def render(dpi: int = 1200) -> Image.Image:
    """The EPS rasterised to RGBA at `dpi`, without its binary previews."""
    gs = shutil.which("gs")
    if gs is None:
        raise SystemExit(
            "Missing ghostscript, which rasterises the EPS. "
            "On macOS: brew install ghostscript. On Debian/Ubuntu: apt install ghostscript."
        )

    data = SOURCE.read_bytes()
    start = data.find(b"%!PS-Adobe")
    end = data.find(b"%%EOF", start)
    if start < 0 or end < 0:
        raise SystemExit(f"{SOURCE} does not look like an EPS file.")

    with tempfile.TemporaryDirectory() as tmp:
        eps = Path(tmp) / "logo.eps"
        png = Path(tmp) / "logo.png"
        eps.write_bytes(data[start : end + 5])

        subprocess.run(
            [
                gs,
                "-q",
                "-dSAFER",
                "-dBATCH",
                "-dNOPAUSE",
                "-dEPSCrop",
                "-dTextAlphaBits=4",
                "-dGraphicsAlphaBits=4",
                "-sDEVICE=pngalpha",
                f"-r{dpi}",
                f"-sOutputFile={png}",
                str(eps),
            ],
            check=True,
        )
        return Image.open(png).convert("RGBA")


def crops(master: Image.Image) -> tuple[Image.Image, Image.Image]:
    """(mark, lockup) — the unit + "in", and the same with the wordmark."""
    alpha = master.getchannel("A")
    blank = [
        alpha.crop((0, y, master.width, y + 1)).getbbox() is None
        for y in range(master.height)
    ]
    first, last = blank.index(False), len(blank) - 1 - blank[::-1].index(False)
    gaps = [y for y in range(first, last) if blank[y]]

    lockup = master.crop(master.getbbox())
    if not gaps:
        return lockup, lockup
    return master.crop((0, 0, master.width, gaps[0])).crop(
        master.crop((0, 0, master.width, gaps[0])).getbbox()
    ), lockup


def tint(art: Image.Image, colour: str) -> Image.Image:
    """The artwork's shape in one colour, alpha preserved."""
    out = Image.new("RGBA", art.size, colour)
    out.putalpha(art.getchannel("A"))
    return out


def downscale(art: Image.Image, width: int, height: int) -> Image.Image:
    """Step-halve before the last LANCZOS pass so 16px icons stay clean."""
    out = art
    while out.width >= width * 2 and out.height >= height * 2:
        out = out.resize((max(1, out.width // 2), max(1, out.height // 2)), Image.LANCZOS)
    return out.resize((max(1, width), max(1, height)), Image.LANCZOS)


def place(
    art: Image.Image,
    width: int,
    height: int,
    fraction: float,
    background: tuple[int, int, int, int] | None = None,
) -> Image.Image:
    """`art` centred on a canvas, scaled to `fraction` of it, aspect kept."""
    canvas = Image.new("RGBA", (width, height), background or (0, 0, 0, 0))
    ratio = min(width * fraction / art.width, height * fraction / art.height)
    resized = downscale(
        art, max(1, round(art.width * ratio)), max(1, round(art.height * ratio))
    )
    canvas.alpha_composite(
        resized, ((width - resized.width) // 2, (height - resized.height) // 2)
    )
    return canvas


def save(img: Image.Image, path: Path, opaque: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    out = img.convert("RGB") if opaque else img
    out.save(path, "PNG", optimize=True)
    printed.append((path.relative_to(ROOT), out.size, out.mode))


def main() -> None:
    master = render()
    mark, lockup = crops(master)
    white_lockup = tint(lockup, "#FFFFFF")
    white_mark = tint(mark, "#FFFFFF")
    black_mark = tint(mark, "#000000")

    images = ROOT / "assets" / "images"
    public = ROOT / "public"
    store = ROOT / "assets" / "store"
    windows = store / "windows"

    # ----------------------------------------------------------- app icons
    # iOS / App Store tile and the `icon` in app.json: the lockup, opaque.
    save(place(lockup, 1024, 1024, 0.86, WHITE), images / "icon.png", opaque=True)

    # Android adaptive icon: the mark inside the 66% safe zone, on white.
    save(place(mark, 1024, 1024, 0.60), images / "android-icon-foreground.png")
    save(
        Image.new("RGBA", (1024, 1024), WHITE),
        images / "android-icon-background.png",
        opaque=True,
    )
    save(place(black_mark, 1024, 1024, 0.60), images / "android-icon-monochrome.png")

    # Splash: white lockup on transparent; the splash field is the accent blue.
    save(
        downscale(
            white_lockup, 1080, round(1080 * white_lockup.height / white_lockup.width)
        ),
        images / "splash-icon.png",
    )

    # ------------------------------------------------------------ web/PWA
    # `web.favicon` in app.json, then everything public/ needs.
    save(place(mark, 48, 48, 0.94, WHITE), images / "favicon.png", opaque=True)

    for size in (16, 32, 48):
        save(
            place(mark, size, size, 0.94, WHITE),
            public / f"favicon-{size}.png",
            opaque=True,
        )

    ico = [place(mark, s, s, 0.94, WHITE).convert("RGB") for s in (16, 32, 48)]
    ico[-1].save(
        public / "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
        append_images=ico[:2],
    )
    printed.append((Path("public/favicon.ico"), (48, 48), "RGB+ICO"))

    save(
        place(lockup, 180, 180, 0.86, WHITE),
        public / "apple-touch-icon.png",
        opaque=True,
    )

    for size in (72, 96, 128, 144, 152, 192, 256, 384, 512):
        save(
            place(lockup, size, size, 0.88, WHITE),
            public / f"icon-{size}.png",
            opaque=True,
        )

    # Maskable is cropped to the launcher's shape, so the lockup stays inside the
    # safe circle rather than filling the tile edge to edge.
    for size in (192, 512):
        save(
            place(lockup, size, size, 0.56, WHITE),
            public / f"icon-maskable-{size}.png",
            opaque=True,
        )

    save(place(lockup, 1024, 1024, 0.86, WHITE), public / "icon-1024.png", opaque=True)
    save(place(lockup, 150, 150, 0.88, WHITE), public / "mstile-150x150.png", opaque=True)

    # The splash the web shell paints before the bundle runs (public/index.html).
    # Same aspect as the native splash asset: the shell sizes it 180x209, and a
    # square file would be stretched to fit that box.
    save(
        downscale(
            white_lockup, 512, round(512 * white_lockup.height / white_lockup.width)
        ),
        public / "splash-logo.png",
    )

    # Colour, not silhouette, for the icon a browser notification paints; the
    # badge is the white mask Android's status bar expects.
    save(
        place(lockup, 192, 192, 0.88, WHITE),
        public / "notification-icon.png",
        opaque=True,
    )
    save(place(white_mark, 96, 96, 0.92), public / "notification-badge.png")

    # --------------------------------------------------------- store listing
    save(place(lockup, 1024, 1024, 0.86, WHITE), store / "app-store-1024.png", opaque=True)
    save(place(lockup, 512, 512, 0.88, WHITE), store / "play-store-512.png", opaque=True)

    # Microsoft Store / MSIX: squares get the white plate, the small marks that
    # sit on the taskbar and lock screen stay transparent.
    tiles = {
        "Square71x71Logo": (71, 71, lockup, WHITE, 0.9),
        "Square150x150Logo": (150, 150, lockup, WHITE, 0.8),
        "Square310x310Logo": (310, 310, lockup, WHITE, 0.8),
        "Wide310x150Logo": (310, 150, lockup, WHITE, 0.56),
        "StoreLogo": (50, 50, mark, WHITE, 0.9),
        "SplashScreen": (620, 300, lockup, WHITE, 0.56),
        "LockScreenLogo": (24, 24, white_mark, None, 0.9),
        "BadgeLogo": (24, 24, white_mark, None, 0.9),
    }

    for name, (width, height, art, background, fraction) in tiles.items():
        for scale in SCALES:
            size = (round(width * scale / 100), round(height * scale / 100))
            suffix = "" if scale == 100 else f".scale-{scale}"
            save(
                place(art, size[0], size[1], fraction, background),
                windows / f"{name}{suffix}.png",
                opaque=background is not None,
            )

    # Taskbar / Start icon: unplated and transparent, plus the target sizes
    # Windows asks for by name.
    for scale in SCALES:
        size = round(44 * scale / 100)
        suffix = "" if scale == 100 else f".scale-{scale}"
        save(place(mark, size, size, 0.92), windows / f"Square44x44Logo{suffix}.png")

    for size in (16, 24, 32, 48, 256):
        save(
            place(mark, size, size, 0.92),
            windows / f"Square44x44Logo.targetsize-{size}.png",
        )

    print(f"  source: {SOURCE.relative_to(ROOT)} ({master.width}x{master.height} at 1200dpi)")
    print(f"  mark:   {mark.width}x{mark.height}   lockup: {lockup.width}x{lockup.height}")
    print(f"  wrote {len(printed)} files\n")
    for path, size, mode in printed:
        print(f"  {str(path):<52} {size[0]:>4}x{size[1]:<4} {mode}")


printed: list[tuple[Path, tuple[int, int], str]] = []

if __name__ == "__main__":
    main()
