#!/usr/bin/env python3
"""Build labelled contact sheets into review/, so the set can be judged as a set.

`verify.py` measures what is measurable. Three things are not, and all three are what this set
lives or dies by:

  * whether fifty portraits read as ONE GAME's creature art rather than as fifty pictures of
    animals — a style question, and the eye answers it in one glance across a grid and cannot
    answer it at all one file at a time;
  * whether an evolution line reads as one family — the art bible's central rule, and a
    side-by-side question by construction: "Cinderpyre is the same animal as Cindercub, grown up"
    is a claim about a PAIR;
  * whether a wordmark's lettering actually spells the title.

So there are two kinds of sheet. `sheet-<set>.png` is the whole of one set on one page. And
`families.png` is one ROW PER EVOLUTION LINE, members in dex order, branch tips side by side —
which is the exact comparison the rule is written about, and the one a grid sorted by dex number
almost makes but not quite.

Sheets land in review/, which is gitignored: they are scaffolding for a judgement, not artefacts.

    python3 sheet.py              # every set, plus the family sheet
    python3 sheet.py species      # only this set
    python3 sheet.py families     # only the family sheet
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
MANIFEST = HERE / "MANIFEST.json"
PLAN = HERE / "PLAN.json"
REVIEW = HERE / "review"

# Tile width per set, and how many across. Wide sets get fewer columns so lettering stays legible
# at review size — a wordmark shrunk to a thumbnail cannot be checked for a mangled letter, which
# is the single thing title review exists to catch.
LAYOUT = {
    "species": (230, 8),
    "types": (230, 5),
    "ui": (260, 4),
    "biomes": (760, 2),
    "title": (760, 2),
}

PAD = 12
LABEL = 26
BACKDROP = (24, 24, 26)
INK = (190, 185, 175)


def font() -> ImageFont.ImageFont:
    try:
        return ImageFont.load_default(size=17)
    except TypeError:  # Pillow older than 9.2 has no size argument on the default font.
        return ImageFont.load_default()


def tile(sheet: Image.Image, draw, path: Path, x: int, y: int, width: int, caption: str, typeface):
    with Image.open(path) as image:
        height = round(width * image.size[1] / image.size[0])
        sheet.paste(image.convert("RGB").resize((width, height), Image.LANCZOS), (x, y))
    draw.text((x, y + height + 4), caption, fill=INK, font=typeface)
    return height


def build_set(name: str, assets: list[dict]) -> Path | None:
    """One page per set. Derivatives are excluded: a thumbnail beside its own parent tells you
    nothing about the set and costs a slot on the page."""
    chosen = [
        a
        for a in assets
        if a["set"] == name and a["derivedFrom"] is None and not a["asset"].endswith("-source")
    ]
    if not chosen:
        return None
    chosen.sort(key=lambda a: a["slug"])

    tile_width, columns = LAYOUT.get(name, (260, 6))
    with Image.open(HERE / chosen[0]["path"]) as first:
        tile_height = round(tile_width * first.size[1] / first.size[0])

    rows = (len(chosen) + columns - 1) // columns
    sheet = Image.new(
        "RGB",
        (
            columns * tile_width + (columns + 1) * PAD,
            rows * (tile_height + LABEL) + (rows + 1) * PAD,
        ),
        BACKDROP,
    )
    draw = ImageDraw.Draw(sheet)
    typeface = font()

    for index, asset in enumerate(chosen):
        column, row = index % columns, index // columns
        x = PAD + column * (tile_width + PAD)
        y = PAD + row * (tile_height + LABEL + PAD)
        tile(
            sheet,
            draw,
            HERE / asset["path"],
            x,
            y,
            tile_width,
            f'{asset["slug"]}  {asset["accent"]}',
            typeface,
        )

    REVIEW.mkdir(exist_ok=True)
    out = REVIEW / f"sheet-{name}.png"
    sheet.save(out, format="PNG")
    return out


def build_families(assets: list[dict], plan: dict) -> Path | None:
    """One row per evolution line, in dex order along the row.

    This is the sheet the art bible's second pillar is checked on, and it is deliberately NOT the
    species grid sorted differently. A grid answers "do these fifty look like one game"; a row
    answers "is this the same animal, four times, growing up" — which is a different question with
    a different answer, and the only one that can catch an evolution that came back recoloured.
    """
    by_slug = {a["slug"]: a for a in assets if a["set"] == "species" and a["derivedFrom"] is None}
    families = [f for f in plan["families"] if len(f["members"]) > 1]
    if not families:
        return None

    tile_width = 210
    columns = max(len(f["members"]) for f in families)
    rows = len(families)
    sheet = Image.new(
        "RGB",
        (
            columns * tile_width + (columns + 1) * PAD + 130,
            rows * (tile_width + LABEL) + (rows + 1) * PAD,
        ),
        BACKDROP,
    )
    draw = ImageDraw.Draw(sheet)
    typeface = font()

    for row, family in enumerate(families):
        y = PAD + row * (tile_width + LABEL + PAD)
        draw.text((PAD, y + tile_width // 2), f'{family["type"]}', fill=INK, font=typeface)
        draw.text((PAD, y + tile_width // 2 + 20), family["root"][:14], fill=INK, font=typeface)
        for column, member in enumerate(family["members"]):
            asset = by_slug.get(member)
            if not asset:
                continue
            x = 130 + PAD + column * (tile_width + PAD)
            tile(
                sheet,
                draw,
                HERE / asset["path"],
                x,
                y,
                tile_width,
                f'{member}  {asset["stage"]}',
                typeface,
            )

    REVIEW.mkdir(exist_ok=True)
    out = REVIEW / "families.png"
    sheet.save(out, format="PNG")
    return out


def main(argv: list[str]) -> int:
    assets = json.loads(MANIFEST.read_text())["assets"]
    plan = json.loads(PLAN.read_text())
    wanted = argv or ["species", "types", "biomes", "title", "ui", "families"]
    for name in wanted:
        built = build_families(assets, plan) if name == "families" else build_set(name, assets)
        if built:
            with Image.open(built) as image:
                print(f"{built.relative_to(HERE)}  {image.size[0]}x{image.size[1]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
