#!/usr/bin/env python3
"""Cut and resample the derivative assets, and report their provenance on stdout as JSON.

Three derivations, each of which exists because of a fact rather than a preference:

  * **The OG card.** 1200x630 is a platform requirement — a scraper rejects anything else — and
    630 is not a multiple of 16, which is the granularity FLUX floors every delivered dimension
    to. So 1200x640 is asked for, delivered exactly, and cut down by 5 pixels top and bottom.
    Down, never up: a centre crop invents no pixel, whereas upscaling turns a crisp edge soft.
  * **The dex thumbnails.** Every 1024 portrait is resampled to 256 with Lanczos. A dex grid
    renders fifty portraits at once and downloading fifty 1024 PNGs to draw them at 128 CSS
    pixels is the difference between a screen that opens and one that hangs. These cost no
    generation: they are the same artwork, resampled, and they say so.
  * **The three title favicons.** 512, 192 and 32, resampled from the 1024 mark. A browser tab
    wants a mark that IS the mark rather than a second drawing of it, which is why these are cut
    and not generated — see the block above `FAVICON_STEPS` for how the recipe was recovered.

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

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image

import providers

HERE = Path(__file__).resolve().parent

# The provider root every emitted path is relative to. Set once by main(); a module-level name
# rather than another parameter threaded through builders whose signatures differ between the
# estate's asset repositories. Keeping `assets/...` identical in every manifest is what lets
# compare.py line the same asset up across models without parsing a directory name.
ROOT = HERE

# The OG card: what the platform demands, and what had to be asked for to get there.
OG_DECLARED = (1200, 630)
OG_SOURCE = (1200, 640)

# The dex thumbnail, resampled from every 1024 portrait.
PORTRAIT = 1024
THUMB = 256

# ═══ THE THREE FAVICONS, WHICH HAD NO RECIPE UNTIL THIS BRANCH MEASURED ONE ═══════════════════
#
# `title/favicon-512x512`, `-192x192` and `-32x32` are recorded in MANIFEST.json with
# `derivedFrom: assets/title/mark-1024x1024.png`, and their shared note says the entries were
# "Recorded AFTER the fact ... Origin inferred as a resample of the mark (the estate convention)".
# Inferred, because nothing in this repository could produce them: this file cut the OG card and
# the dex thumbnails and nothing else, so three of the 54 derivatives had no code behind them.
#
# That was survivable while there was one set. It stops being survivable the moment there are two:
# a candidate can generate all 83 originals and still stand at 134 of 137 entries, `materialise.py`
# raises `IncompleteSetError` on any missing key and writes nothing, and `verify.py --as-shipped`
# — the gate `promote.py` runs before it will move a tree — fails on the three absent files. A
# challenger would have been rejected for a hole in THIS repository's tooling and the report would
# have read like a defect in the model.
#
# So the recipe was recovered by measurement rather than by assertion, without touching `assets/`.
# Every one of the 54 derivatives was recut in memory from its recorded source with today's Pillow
# (12.3.0) and the sha256 compared against the manifest: **53 of 54 came back byte-identical**,
# including `favicon-512x512` and `favicon-192x192`. So the inference in that note is correct and
# the recipe is exactly an RGBA Lanczos downscale of the mark — no crop, no sharpen, no separate
# heavier source of the kind micro-brand's favicons are cut from.
#
# The one that did not reproduce is `favicon-32x32` (689 bytes on disk, 1072 from a plain recut),
# and its own note says why: "the resample had left antialiased near-black strays in the corners,
# which the flat-asset rule rightly refuses; the normaliser snapped them to #12100f". Measured, the
# corners of a fresh 32 hold five distinct colours (#0e0c0c to #201d1b) where 512 and 192 hold
# exactly one (#12100f) — Lanczos over a 32x downscale simply has more ground and more edge in the
# same pixel. `flatten_ground_if_stray` therefore runs the estate's own normaliser over a cut
# whose corners are not already exact, and leaves the other two untouched.
#
# What that reproduces, measured on a copy of the mark in /tmp so that `assets/` was never written
# to: 512 and 192 byte-identical to the shipped files, and 32 at 702 bytes against the shipped 689
# with corners of exactly one colour, #12100f. The 13 bytes are the normaliser's own zlib level 9
# and chunk layout rather than whatever encoder produced the file in 2026 — the recipe reproduces
# the RULE the 32 was cut to, which is the property `verify.py` tests, and it does not pretend to
# reproduce a byte count nobody recorded the provenance of. Both passes are idempotent: a second
# `flatten_ground_if_stray` over any of the three finds exact corners and returns False.
MARK = "mark-1024x1024.png"
FAVICON_STEPS = (512, 192, 32)

C2PA_MARKER = b"c2pa"


def load_parents(manifest: Path) -> dict[str, dict]:
    """Index the manifest by asset key, so a derivative inherits its source's record.

    The prompt, the model, the accent, the family and the licence belong to the generation, not to
    the cut, so a derivative carries the same ones. Only the facts the cut CHANGES — size,
    checksum, byte count, C2PA state — are recomputed.
    """
    if not manifest.exists():
        return {}
    document = json.loads(manifest.read_text())
    return {a["asset"]: a for a in document.get("assets", [])}


def digest(path: Path) -> tuple[str, int, bool]:
    data = path.read_bytes()
    return hashlib.sha256(data).hexdigest(), len(data), C2PA_MARKER in data


def corner_colours(path: Path) -> list[tuple[int, int, int]]:
    """Every distinct colour in the four corner patches.

    Deliberately the SAME sampling as `verify.py`'s `corner_extremes` — same patch size, same
    stride — rather than a cheaper four-pixel probe. The point of the check below is "leave nothing
    the verifier will refuse", and a laxer sample here would let exactly the failures through that
    it exists to prevent.
    """
    with Image.open(path) as raw:
        image = raw.convert("RGB")
        width, height = image.size
        patch = max(8, min(width, height) // 24)
        found = set()
        for left, top in ((0, 0), (width - patch, 0), (0, height - patch),
                          (width - patch, height - patch)):
            for y in range(top, top + patch, 2):
                for x in range(left, left + patch, 2):
                    found.add(image.getpixel((x, y))[:3])
    return sorted(found)


def flatten_ground_if_stray(path: Path) -> bool:
    """Snap a resample's corner strays to the brand ground, and say whether it had to. Idempotent.

    Imported lazily and used conditionally, both on purpose. `normalise_ground` is pure standard
    library so that it runs in CI, and importing it at module scope would drag this file's Pillow
    dependency into anything that reaches for it. Conditionally, because a cut whose corners are
    already exactly the target must be left ALONE: `favicon-512x512` and `favicon-192x192`
    reproduce their shipped bytes only if nothing re-encodes them afterwards, and a normaliser that
    ran unconditionally would rewrite two files it has no work to do on and lose that proof.
    """
    import normalise_ground

    target = normalise_ground.TARGET
    if all(colour == target for colour in corner_colours(path)):
        return False
    normalise_ground.normalise(path)
    return True


def entry(parent: dict, *, asset: str, path: Path, declared: tuple[int, int], source: Path,
          cropped: bool, note: str) -> dict:
    sha, size, c2pa = digest(path)
    with Image.open(path) as image:
        delivered = image.size
    return {
        "provider": parent.get("provider", providers.reference().id),
        "asset": asset,
        "set": parent["set"],
        "slug": parent["slug"],
        "name": parent["name"],
        "path": str(path.relative_to(ROOT)),
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
        "derivedFrom": str(source.relative_to(ROOT)),
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


def resample_one(source: Path, target: Path, size: tuple[int, int]) -> dict:
    """Lanczos one file down to one size and report what the result measures. Nothing else.

    ## Why this mode exists, and why it is here rather than in generate.ts

    Some endpoints refuse to generate at a size this set declares. gpt-image-2 has a minimum pixel
    budget — measured, by bisection, to sit in (524288, 655360] — and TWENTY-ONE of this set's 83
    generations fall under it: the nine type icons and eight UI glyphs at 512x512, two UI banners
    at 1024x512, the 1024x384 wordmark and one 512x256 pill. Each is generated at the smallest
    exact-aspect multiple on the 16-grid that clears the budget and cut DOWN to the declared size.

    The pixels have to move in Pillow, for the same reason every other resample in this file does:
    `studio/src/sizing.ts` measures and deliberately does not resample, because doing it in pure
    TypeScript is a PNG decoder, a filter reconstructor, a resampler and an encoder, and doing it
    with `sharp` is a native dependency in a repository that has none. And Pillow rather than macOS
    `sips` — design-system.md §7 item 3 names `sips` as the reason the estate's post-processing
    stage exists on exactly one laptop.

    It is in THIS file rather than in a new shared module because `derive.py` is already the
    per-repository Pillow tool and is already listed under `shared.perRepository` in providers.json.
    A new `resample.py` would have to go in `shared.acrossAllThree`, which claims.py validates in
    both directions and which requires every sibling's `shared` block to be byte-identical — a
    three-repository change to avoid a thirty-line function.

    **This mode never touches the manifest**, on purpose. The caller has the prompt, the model, the
    attempts and the retry count; this has one source file, one target and one size, so it cannot
    corrupt a record it does not read.
    """
    with Image.open(source) as image:
        # RGBA before resizing: a palette image resampled in its own mode gives Lanczos nothing to
        # interpolate between and comes back with the same stair-stepping the downscale was for.
        resized = image.convert("RGBA").resize(size, Image.LANCZOS)
        target.parent.mkdir(parents=True, exist_ok=True)
        resized.save(target, format="PNG", optimize=True)
    sha, byte_size, c2pa = digest(target)
    with Image.open(target) as written:
        measured = written.size
    return {
        "sha256": sha,
        "byteSize": byte_size,
        # Measured on the bytes written, never inherited from the source. Re-encoding drops the
        # C2PA chunk, so this is expected to be False even where the native carried one — and it is
        # reported rather than assumed, because assuming it is the defect this estate shipped once.
        "c2pa": c2pa,
        # The caller REFUSES the file if this is not what it asked for. Reported from the file on
        # disk rather than echoed from the argument, so the check is on the bytes.
        "size": f"{measured[0]}x{measured[1]}",
    }


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Rebuild this set's derivatives.")
    parser.add_argument("--provider", default=None, help="provider id from providers.json")
    parser.add_argument(
        "--resample",
        nargs=3,
        metavar=("SOURCE", "TARGET", "WxH"),
        default=None,
        help="Lanczos SOURCE down to WxH at TARGET and print the result as JSON. Used by "
        "generate.ts for a provider that refuses to generate at a declared size.",
    )
    args = parser.parse_args(argv[1:])

    if args.resample:
        source, target, wanted = args.resample
        width, height = (int(n) for n in wanted.split("x"))
        json.dump(resample_one(Path(source), Path(target), (width, height)), sys.stdout)
        return 0

    provider = providers.by_id(args.provider) if args.provider else providers.reference()
    global ROOT
    ROOT, ASSETS = provider.root, provider.assets
    if not ASSETS.is_dir():
        # A candidate with nothing generated yet is not an error. It is the normal state of a
        # candidate set until its endpoint serves.
        json.dump([], sys.stdout)
        return 0
    parents = load_parents(provider.manifest)
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

    # ---- the three favicons: 512, 192 and 32, resampled from the 1024 mark.
    mark = ASSETS / "title" / MARK
    parent = parents.get("title/mark")
    if mark.exists() and parent:
        for step in FAVICON_STEPS:
            target = ASSETS / "title" / f"favicon-{step}x{step}.png"
            with Image.open(mark) as image:
                # RGBA, matching the 512 and 192 that reproduce byte-identically this way. A mark
                # sits on a flat ground and has no transparency, so the mode is about what Lanczos
                # gets to interpolate between rather than about the alpha channel.
                image.convert("RGBA").resize((step, step), Image.LANCZOS).save(
                    target, format="PNG", optimize=True
                )
            snapped = flatten_ground_if_stray(target)
            record = entry(
                parent,
                asset=f"title/favicon-{step}x{step}",
                path=target,
                declared=(step, step),
                source=mark,
                # The shipped entries have read `cropped: true` since they were recorded after the
                # fact, on an inference. It is false, measurably: this is a downscale of the whole
                # mark with nothing cut off, and the recipe reproduces two of the three files
                # byte-for-byte, so the record is corrected here rather than copied.
                cropped=False,
                note=(
                    f"Lanczos downscale of the {PORTRAIT} mark to {step}, for the browser tab and "
                    "the web manifest. A favicon that IS the mark rather than a second drawing of "
                    "it. Re-encoding drops the C2PA chunk; the invisible pixel watermark is "
                    "unaffected and the full-size mark is kept beside this file."
                    + (
                        " The downscale left antialiased near-black strays in the corners, which "
                        "the flat-asset rule refuses, so the estate's normaliser was run over the "
                        "cut and snapped them to the exact ground."
                        if snapped
                        else ""
                    )
                ),
            )
            if snapped:
                import normalise_ground

                steps = list(record["postProcessing"])
                # The step string is appended a SECOND time on purpose where it applies twice: the
                # parent was normalised before this cut and the cut was normalised after it. The
                # manifest records what was run over these bytes, and collapsing the two would
                # describe a file that had been through one pass when it has been through two.
                steps.append(normalise_ground.STEP)
                record["postProcessing"] = steps
            out.append(record)

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
    raise SystemExit(main(sys.argv))
