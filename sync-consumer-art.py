#!/usr/bin/env python3
"""Push the SHIPPED set into a game client's `public/art/`, and say exactly what moved.

    python3 sync-consumer-art.py --into ../emberkin-web/public/art --dry-run
    python3 sync-consumer-art.py --into ../emberkin-web/public/art

═══════════════════════════════════════════════════════════════════════════════════════════════
## WHY THIS EXISTS SEPARATELY FROM materialise.py

`materialise.py` answers "write set X into directory D". It is the right tool when the directory
is a destination the estate controls end to end — a mount, a scratch tree, a `public/` that
mirrors `assets/` completely. It is the wrong tool here, for one measured reason: **these two
clients do not carry the whole set.** `emberkin-web/public/art` holds 134 of the 137 entries and
omits the three `title/favicon-*` files, which the client takes from its own root instead;
`aetherholm-web/public/art` records all 101 rows but carries only 75 of the images, because 26
heraldry and keyart entries are listed in that client's own `UNSHIPPED` table as belonging to
`worlds-web`. Pointing `materialise.py` at either directory would add files the client has
deliberately never had, and `--only` cannot express "everything except three favicons".

So this tool inverts the question. It does not decide what a consumer should carry. **It reads
what the consumer already carries and replaces exactly that**, which means a promotion can never
change the shape of a client's `public/`, only the bytes inside it. An image in `public/art` that
the manifest does not list is REPORTED, never deleted — deleting something a client put there on
purpose is not a switch, it is a decision, and it is not this tool's to make.

## THE MANIFEST IS THE PROVENANCE, AND IT IS SERVED

`public/art/MANIFEST.json` is fetched by the browser at `/art/MANIFEST.json` and is where the
credits screen reads its AI disclosure from, so it has to travel with the bytes or the page
credits the wrong model. It is rewritten here from the shipped manifest, narrowed to the rows the
consumer carries, with `assetCount` corrected to match. That narrowing is what makes the result
byte-comparable with what was there before: everything else in the document — `$comment`,
`disclosure`, `endpoint`, `generator`, `licence`, `specification`, `provider` — is copied verbatim
rather than re-authored, because a consumer that disagrees with its source about the model is
worse than one that is merely out of date.

`tools/sync-art.mjs` in the client still has to run afterwards: it regenerates `src/art/
catalogue.ts` from this manifest, and this tool deliberately does not reach across into a
repository it does not own to run it.

## THIS FILE IS BYTE-IDENTICAL IN emberkin-assets AND aetherholm-assets

Same reason `materialise.py` is. Nothing in it names a game; the destination's own manifest
supplies every difference between the two.
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent

RECEIPT = "MANIFEST.json"


def carried(destination: Path) -> dict:
    """The consumer's own manifest — the definitive statement of what it carries."""
    receipt = destination / RECEIPT
    if not receipt.exists():
        raise SystemExit(
            f"\n{receipt} does not exist.\n\n"
            "This tool replaces what a consumer already carries and cannot invent that list. If "
            "you are populating a NEW directory, `materialise.py --into <dir>` is the tool: it "
            "writes the whole set and a SET.json receipt beside it.\n"
        )
    return json.loads(receipt.read_text())


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--into", required=True, help="e.g. ../emberkin-web/public/art")
    parser.add_argument("--dry-run", action="store_true", help="report; write nothing")
    args = parser.parse_args(argv[1:])

    destination = Path(args.into).resolve()
    shipped = json.loads((HERE / RECEIPT).read_text())
    source_rows = {row["path"]: row for row in shipped.get("assets", [])}

    consumer = carried(destination)
    wanted = [row["path"] for row in consumer.get("assets", [])]

    replaced: list[str] = []
    unchanged: list[str] = []
    recorded_not_carried: list[str] = []
    absent_upstream: list[str] = []

    for path in wanted:
        if path not in source_rows:
            absent_upstream.append(path)
            continue
        source = HERE / path
        target = destination / Path(path).relative_to("assets")
        if not source.exists():
            absent_upstream.append(f"{path} (recorded in the shipped manifest, not on disk)")
            continue
        if not target.exists():
            # aetherholm's 26 heraldry rows. Recorded for provenance, carried by worlds-web.
            recorded_not_carried.append(path)
            continue
        if target.read_bytes() == source.read_bytes():
            unchanged.append(path)
            continue
        replaced.append(path)
        if not args.dry_run:
            shutil.copyfile(source, target)

    # Anything under the destination that no row accounts for. Reported, never removed.
    accounted = {destination / Path(p).relative_to("assets") for p in wanted}
    orphans = sorted(
        str(p.relative_to(destination))
        for p in destination.rglob("*.png")
        if p not in accounted
    )

    if absent_upstream:
        listed = "\n  ".join(absent_upstream)
        raise SystemExit(
            f"\nNOTHING WAS WRITTEN — the shipped set is missing {len(absent_upstream)} row(s) "
            f"this consumer carries:\n  {listed}\n\n"
            "A partial push would leave the client serving two models at once and its credits "
            "screen naming one of them.\n"
        )

    narrowed = dict(shipped)
    narrowed["assets"] = [source_rows[p] for p in wanted]
    narrowed["assetCount"] = len(narrowed["assets"])
    body = json.dumps(narrowed, indent=2) + "\n"
    manifest_changed = (destination / RECEIPT).read_text() != body
    if manifest_changed and not args.dry_run:
        (destination / RECEIPT).write_text(body)

    verb = "would be" if args.dry_run else "were"
    print(f"{destination}")
    print(f"  {len(replaced)} image(s) {verb} replaced, {len(unchanged)} already identical")
    print(f"  MANIFEST.json {verb} rewritten: {'yes' if manifest_changed else 'no, already current'}"
          f" ({narrowed['assetCount']} of {len(source_rows)} row(s), "
          f"provider {narrowed.get('provider', '(unrecorded)')})")
    if recorded_not_carried:
        print(f"  {len(recorded_not_carried)} row(s) recorded but not carried here — left alone")
    if orphans:
        print(f"  {len(orphans)} image(s) here that no row accounts for — left alone:")
        for name in orphans:
            print(f"      {name}")
    for path in replaced:
        print(f"    replace {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
