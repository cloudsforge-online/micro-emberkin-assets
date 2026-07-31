#!/usr/bin/env python3
"""Cut and resample the derivative assets, and report their provenance on stdout as JSON.

Two derivations, both of which exist because of a fact rather than a preference:

  * **The OG card.** 1200x630 is a platform requirement — a scraper rejects anything else — and
    630 is not a multiple of 16, which is the granularity FLUX floors every delivered dimension
    to. So 1200x640 is asked for, delivered exactly, and cut down by 5 pixels top and bottom.
    Down, never up: a centre crop invents no pixel, whereas upscaling turns a crisp edge soft.
  * **The dex thumbnails.** Every 1024 portrait is resampled to 256 with Lanczos. A dex grid
    renders fifty portraits at once and downloading fifty 1024 PNGs to draw them at 128 CSS
    pixels is the difference between a screen that opens and one that hangs. These cost no
    generation: they are the same artwork, resampled, and they say so.

Pillow, not macOS `sips`. design-system.md §7 item 3 names `sips` as the reason the estate's
post-processing stage exists on exactly one laptop, and "twelve game masters currently sit at
1024 against declared 512/256 because the refit has never been run". This runs anywhere Python
does — which is also what lets it run in CI.

**A derivative is re-encoded by Pillow, so it loses the PNG's C2PA chunk.** The invisible
Microsoft pixel watermark survives; the signed provenance box does not survive being rewritten by
a library that has never heard of it. (`normalise_ground.py`, which rewrites every flat-ground
file in place, does NOT lose it — it copies every ancillary chunk through by hand. That is the one
place this repository does better than its predecessor, and it is why only these derivatives read
`c2pa: false`.) Every source file is kept beside its derivative and `c2pa` below is MEASURED on
the bytes written rather than inherited: a derivative claiming provenance it no longer carries
would be worse than one that admits it.
"""

from __future__ import annotations

import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
ASSETS = HERE / "assets"
MANIFEST = HERE / "MANIFEST.json"

# The OG card: what the platform demands, and what had to be asked for to get there.
OG_DECLARED = (1200, 630)
OG_SOURCE = (1200, 640)

# The dex thumbnail, resampled from every 1024 portrait.
PORTRAIT = 1024
THUMB = 256

C2PA_MARKER = b"c2pa"


def load_parents() -> dict[str, dict]:
    """Index the manifest by asset key, so a derivative inherits its source's record.

    The prompt, the model, the accent, the family and the licence belong to the generation, not to
    the cut, so a derivative carries the same ones. Only the facts the cut CHANGES — size,
    checksum, byte count, C2PA state — are recomputed.
    """
    if not MANIFEST.exists():
        return {}
    document = json.loads(MANIFEST.read_text())
    return {a["asset"]: a for a in document.get("assets", [])}


def digest(path: Path) -> tuple[str, int, bool]:
    data = path.read_bytes()
    return hashlib.sha256(data).hexdigest(), len(data), C2PA_MARKER in data


def entry(parent: dict, *, asset: str, path: Path, declared: tuple[int, int], source: Path,
          cropped: bool, note: str) -> dict:
    sha, size, c2pa = digest(path)
    with Image.open(path) as image:
        delivered = image.size
    return {
        "asset": asset,
        "set": parent["set"],
        "slug": parent["slug"],
        "name": parent["name"],
        "path": str(path.relative_to(HERE)),
        "accent": parent["accent"],
        "secondaryAccent": parent["secondaryAccent"],
        "groundClass": parent["groundClass"],
        "family": parent["family"],
        "stage": parent["stage"],
        "declaredSize": f"{declared[0]}x{declared[1]}",
        "requestedSize": parent["requestedSize"],
        "deliveredSize": f"{delivered[0]}x{delivered[1]}",
        "sizing": "exact" if tuple(delivered) == declared else "unsized",
        "cropped": cropped,
        "derivedFrom": str(source.relative_to(HERE)),
        "backend": parent["backend"],
        "model": parent["model"],
        "prompt": parent["prompt"],
        "seed": parent["seed"],
        "sha256": sha,
        "byteSize": size,
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "c2pa": c2pa,
        "retries": parent["retries"],
        "licence": parent["licence"],
        "providerCostUnits": parent["providerCostUnits"],
        "providerOutputMegapixels": parent["providerOutputMegapixels"],
        "sourceSpec": parent["sourceSpec"],
        "promptVariant": parent.get("promptVariant", "full"),
        "postProcessing": list(parent.get("postProcessing", [])) + [
            "cropped by derive.py" if cropped else "resampled by derive.py"
        ],
        "deliveredGround": parent.get("deliveredGround"),
        "attempts": parent["attempts"],
        "note": note,
    }


def main() -> int:
    parents = load_parents()
    out: list[dict] = []

    # ---- the OG card: centre-crop 1200x640 down to the 1200x630 a scraper will accept.
    og_source = ASSETS / "title" / f"og-{OG_SOURCE[0]}x{OG_SOURCE[1]}-asdelivered.png"
    parent = parents.get("title/og-source")
    if og_source.exists() and parent:
        with Image.open(og_source) as image:
            width, height = image.size
            top = (height - OG_DECLARED[1]) // 2
            target = ASSETS / "title" / f"og-{OG_DECLARED[0]}x{OG_DECLARED[1]}.png"
            image.crop((0, top, width, top + OG_DECLARED[1])).save(
                target, format="PNG", optimize=True
            )
        out.append(
            entry(
                parent,
                asset="title/og",
                path=target,
                declared=OG_DECLARED,
                source=og_source,
                cropped=True,
                note=(
                    f"Centre-cropped from {OG_SOURCE[0]}x{OG_SOURCE[1]} by removing "
                    f"{(OG_SOURCE[1] - OG_DECLARED[1]) // 2} pixels from the top and bottom. No "
                    "pixel was invented and nothing was upscaled. Re-encoding drops the C2PA "
                    "chunk; the invisible pixel watermark is unaffected and the as-delivered "
                    "source is kept beside this file."
                ),
            )
        )

    # ---- the dex thumbnails: 256 from every 1024 portrait.
    species_dir = ASSETS / "species"
    if species_dir.is_dir():
        for portrait in sorted(species_dir.glob(f"*-{PORTRAIT}x{PORTRAIT}.png")):
            slug = portrait.name[: -len(f"-{PORTRAIT}x{PORTRAIT}.png")]
            parent = parents.get(f"species/{slug}")
            if not parent:
                continue
            with Image.open(portrait) as image:
                target = species_dir / f"{slug}-{THUMB}x{THUMB}.png"
                image.convert("RGB").resize((THUMB, THUMB), Image.LANCZOS).save(
                    target, format="PNG", optimize=True
                )
            out.append(
                entry(
                    parent,
                    asset=f"species/{slug}-thumb",
                    path=target,
                    declared=(THUMB, THUMB),
                    source=portrait,
                    cropped=False,
                    note=(
                        f"Lanczos downscale of the {PORTRAIT} portrait to {THUMB}, for the dex "
                        "grid. Pillow, not macOS sips, so the step runs anywhere. Re-encoding "
                        "drops the C2PA chunk; the invisible pixel watermark is unaffected and "
                        "the full-size portrait is kept beside this file."
                    ),
                )
            )

    json.dump(out, sys.stdout)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
