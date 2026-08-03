#!/usr/bin/env python3
"""Re-derive every figure and identity claim this repository's documents make, from source.

    python3 claims.py            # check every claim in claims.json
    python3 claims.py --list     # what is pinned, and to what
    python3 claims.py --show     # the derived value of every derivation, without checking

WHY THIS EXISTS. design-system.md section 7 records six colour hexes duplicated into prose that
were wrong throughout a defect AND after the fix, because only the test inside the package could
stay honest. The same thing happened here, faster: COMPARISON.md carried "94", "54" and "0 of 94"
after the currency marks took the set to 98 and 56, and after two of those files acquired a C2PA
box — so a rate had a wrong denominator and a clean sheet was asserted on a set that was not
clean. It said "32 rules" against a dialects.json holding 31. Its section 9.3 table said idea
drift was 2 of 15 while its own prose four paragraphs below said 1, and the three repositories'
scored artefacts sum to 1. Every one of those rotted inside a single day.

So a figure in a document is either derived here or it is not trusted. The rule this file enforces
is narrow and mechanical: a claim names a document, a regular expression with exactly one capture
group, and a derivation. The expression must match EXACTLY ONCE. A pattern that stops matching is
a failure, not a pass — that is the failure mode a guard like this usually rots into, and zero
matches is indistinguishable from a claim that was deleted or reworded past the guard's notice.

WHAT IT DOES NOT DO. It does not check prose, and it does not invent figures for rows nobody
scored. Where a pilot row has no recorded value in one of the three repositories, $pilot records
the absence in $unscored and that row of the table is reported UNVERIFIED rather than passed. An
unscored row and a row scored zero are different statements and only one of them is evidence.

EXIT CODES. 0 every claim holds. 1 a claim is FALSE. 2 a claim could not be checked — a sibling
checkout is missing, or a row has no source. Those are different states and the estate has been
bitten by collapsing them: a check that silently passes when it cannot run is worse than no check.
"""

from __future__ import annotations

import argparse
import ast
import hashlib
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ESTATE = HERE.parent


class Unverifiable(Exception):
    """The claim could not be checked. Distinct from the claim being false."""


# ---------------------------------------------------------------- reading source


def _repo(name: str | None = None) -> Path:
    if name is None or name == HERE.name:
        return HERE
    path = ESTATE / name
    if not path.is_dir():
        raise Unverifiable(f"sibling checkout {name} is not at {path}")
    return path


def _manifest(repo: str | None = None) -> list[dict]:
    path = _repo(repo) / "MANIFEST.json"
    if not path.exists():
        raise Unverifiable(f"{path} does not exist")
    return json.loads(path.read_text())["assets"]


def _generated(repo: str | None = None) -> list[dict]:
    return [a for a in _manifest(repo) if not a.get("derivedFrom")]


_C2PA_CACHE: dict[str, int] = {}


def _c2pa(repo: str | None = None) -> int:
    """Measured off the bytes, never read from the manifest's own `c2pa` field.

    The whole reason this repository has a disclosure check at all is that the field went stale
    while the verifier stayed green. A claims file that counted the field would reproduce exactly
    that defect one level up.
    """
    key = repo or HERE.name
    if key not in _C2PA_CACHE:
        root = _repo(repo)
        count = 0
        for asset in _manifest(repo):
            path = root / asset["path"]
            if not path.exists():
                raise Unverifiable(f"{path} is in the manifest and not on disk")
            if b"c2pa" in path.read_bytes():
                count += 1
        _C2PA_CACHE[key] = count
    return _C2PA_CACHE[key]


def _siblings() -> list[str]:
    return json.loads((HERE / "providers.json").read_text())["shared"]["siblings"]


def _artefacts(repo: str | None = None) -> dict:
    path = _repo(repo) / "review" / "compare" / "artefacts.json"
    if not path.exists():
        raise Unverifiable(f"{path} does not exist")
    return json.loads(path.read_text())


# ---------------------------------------------------------------- derivations


def _sum_over_siblings(fn) -> int:
    return sum(fn(name) for name in _siblings())


def _residuals(repo: str | None = None) -> tuple[int, int]:
    """(clean, owed) recorded prompts in this repository under every checked dialect."""
    import dialects

    clean = owed = 0
    for dialect in dialects.load():
        if not dialect.check_residuals:
            continue
        for asset in _generated(repo):
            if dialects.residuals(dialect.id, dialect.apply(asset["prompt"])):
                owed += 1
            else:
                clean += 1
    return clean, owed


def _dialect_rules(dialect_id: str) -> int:
    import dialects

    return len(dialects.by_id(dialect_id).rules)


def _candidate_assets(repo: str, candidate: str) -> int:
    path = _repo(repo) / "candidates" / candidate / "MANIFEST.json"
    if not path.exists():
        raise Unverifiable(f"{path} does not exist")
    return len(json.loads(path.read_text())["assets"])


def _candidate_ungenerated(candidate: str) -> int:
    """Assets this repository plans that the named candidate set has never generated.

    What verify.py reports as "planned but never generated" on a deliberately partial set. Pinned
    because both game repositories stated it as 74: it is 74 in emberkin and 92 in aetherholm, and
    the sentence had been copied from one file into the other along with its number.
    """
    return len(_generated()) - _candidate_assets(HERE.name, candidate)


def _failed_attempts(repo: str | None = None) -> int:
    return sum(
        1
        for a in _generated(repo)
        for attempt in a.get("attempts", [])
        if attempt.get("outcome") != "ok"
    )


def _pilot(row: str, column: str) -> int:
    """The estate-wide pilot tally for one row, summed over the three repositories' $pilot blocks.

    Every repository must carry a figure for the row. If one records it in $unscored instead, the
    row is UNVERIFIED — a sum with a guessed term in it is not a measurement.
    """
    total = 0
    for name in _siblings():
        block = _artefacts(name).get("$pilot")
        if block is None:
            raise Unverifiable(f"{name} has no $pilot block in review/compare/artefacts.json")
        if row in block.get("$unscored", {}):
            raise Unverifiable(f"{name} did not score {row!r}: {block['$unscored'][row]}")
        if column not in block:
            raise Unverifiable(f"{name}'s $pilot has no column {column!r}")
        if row not in block[column]:
            raise Unverifiable(f"{name}'s $pilot {column!r} has no row {row!r}")
        total += block[column][row]
    return total


DERIVATIONS = {
    "repo.assets": lambda: len(_manifest()),
    "repo.generated": lambda: len(_generated()),
    "repo.derived": lambda: len(_manifest()) - len(_generated()),
    "repo.c2pa": lambda: _c2pa(),
    "repo.retried": lambda: sum(1 for a in _generated() if a.get("retries", 0) > 0),
    "repo.retries": lambda: sum(a.get("retries", 0) for a in _generated()),
    "repo.failedAttempts": lambda: _failed_attempts(),
    "sibling.assets": lambda name: len(_manifest(name)),
    "sibling.generated": lambda name: len(_generated(name)),
    "sibling.derived": lambda name: len(_manifest(name)) - len(_generated(name)),
    "sibling.c2pa": lambda name: _c2pa(name),
    "sibling.retried": lambda name: sum(1 for a in _generated(name) if a.get("retries", 0) > 0),
    "estate.assets": lambda: _sum_over_siblings(lambda n: len(_manifest(n))),
    "estate.generated": lambda: _sum_over_siblings(lambda n: len(_generated(n))),
    "estate.derived": lambda: _sum_over_siblings(lambda n: len(_manifest(n)) - len(_generated(n))),
    "estate.residualClean": lambda: _sum_over_siblings(lambda n: _residuals(n)[0]),
    "estate.residualOwed": lambda: _sum_over_siblings(lambda n: _residuals(n)[1]),
    "dialect.rules": _dialect_rules,
    "candidate.assets": _candidate_assets,
    "candidate.ungenerated": _candidate_ungenerated,
    "pilot": _pilot,
    "pilot.assets": lambda: _sum_over_siblings(
        lambda n: len(_artefacts(n).get("$pilot", {}).get("$assets", []))
    ),
}

#: `name` or `name(arg | arg)`. Arguments are split on `|` rather than `,` because two of the
#: pilot row names contain commas — "non-flat (3D, bevel, gradient, glow)" — and splitting those
#: into four arguments is exactly the kind of quiet mangling this file exists to prevent.
_CALL = re.compile(r"^([a-zA-Z][\w.]*)(?:\((.*)\))?$", re.DOTALL)


def derive(expression: str) -> int:
    match = _CALL.match(expression.strip())
    if not match:
        raise SystemExit(f"claims.json: {expression!r} is not a derivation")
    name, raw_args = match.group(1), match.group(2)
    if name not in DERIVATIONS:
        known = ", ".join(sorted(DERIVATIONS))
        raise SystemExit(f"claims.json: unknown derivation {name!r}; claims.py offers: {known}")
    args = [a.strip() for a in raw_args.split("|")] if raw_args else []
    return DERIVATIONS[name](*args)


# ---------------------------------------------------------------- the shared-file declaration


def _function_source(path: Path, name: str) -> str:
    tree = ast.parse(path.read_text())
    lines = path.read_text().splitlines(True)
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == name:
            return "".join(lines[node.lineno - 1 : node.end_lineno])
    raise Unverifiable(f"{path} has no function named {name}")


def _digest(path: Path) -> str:
    return hashlib.md5(path.read_bytes()).hexdigest()


def check_shared() -> tuple[list[str], list[str]]:
    """providers.json's `shared` block, re-derived from the bytes, in BOTH directions.

    A file listed as shared that has forked is a failure. A file listed as per-repository that has
    quietly CONVERGED is also a failure, and asks for it to be promoted — because the value of the
    declaration is that a reader can rely on it, and a stale "these differ" is a claim too.
    """
    failures: list[str] = []
    unverified: list[str] = []
    shared = json.loads((HERE / "providers.json").read_text())["shared"]
    names = shared["siblings"]

    try:
        roots = {name: _repo(name) for name in names}
    except Unverifiable as exc:
        return failures, [f"the shared-file declaration: {exc}"]

    for filename in shared["acrossAllThree"]:
        present = {n: r / filename for n, r in roots.items() if (r / filename).exists()}
        missing = sorted(set(names) - set(present))
        if missing:
            failures.append(
                f"providers.json calls {filename} shared across all three, and it is absent from "
                f"{', '.join(missing)}"
            )
            continue
        digests = {n: _digest(p) for n, p in present.items()}
        if len(set(digests.values())) != 1:
            failures.append(
                f"providers.json calls {filename} byte-identical across all three and it is not: "
                + ", ".join(f"{n} {d[:8]}" for n, d in sorted(digests.items()))
            )

    game_sets = [n for n in names if n != "brand"]
    for filename in shared.get("betweenTheGameSetsOnly", []):
        digests = {}
        for name in game_sets:
            path = roots[name] / filename
            if not path.exists():
                failures.append(f"providers.json calls {filename} shared between the game sets, "
                                f"and it is absent from {name}")
                break
            digests[name] = _digest(path)
        else:
            if len(set(digests.values())) != 1:
                failures.append(
                    f"providers.json calls {filename} byte-identical between the game sets and it "
                    "is not: " + ", ".join(f"{n} {d[:8]}" for n, d in sorted(digests.items()))
                )

    for entry in shared.get("identicalFunctions", []):
        try:
            sources = {
                name: _function_source(roots[name] / entry["file"], entry["function"])
                for name in names
            }
        except Unverifiable as exc:
            failures.append(str(exc))
            continue
        if len(set(sources.values())) != 1:
            failures.append(
                f"providers.json calls {entry['file']}'s {entry['function']} byte-identical across "
                "all three and it is not"
            )

    for filename in shared["perRepository"]:
        present = {n: r / filename for n, r in roots.items() if (r / filename).exists()}
        if len(present) < 2:
            unverified.append(
                f"{filename} is declared per-repository and exists in fewer than two checkouts"
            )
            continue
        digests = {n: _digest(p) for n, p in present.items()}
        if len(set(digests.values())) == 1:
            failures.append(
                f"providers.json calls {filename} per-repository, and it is now byte-identical "
                f"across {', '.join(sorted(present))}. If that is deliberate, move it to "
                "shared.acrossAllThree; if it is not, the divergence has been lost."
            )

    for name in names:
        block = json.loads((roots[name] / "providers.json").read_text()).get("shared")
        if block != shared:
            failures.append(
                f"{name}/providers.json's `shared` block differs from this one. It describes the "
                "estate rather than one repository, so the three copies must agree."
            )

    return failures, unverified


def check_pilot_against_columns() -> list[str]:
    """$pilot must agree with the columns it was taken from, wherever $columnAlias names one."""
    failures: list[str] = []
    for name in _siblings():
        try:
            document = _artefacts(name)
        except Unverifiable as exc:
            failures.append(str(exc))
            continue
        block = document.get("$pilot")
        if block is None:
            failures.append(f"{name} has no $pilot block")
            continue
        for canonical, column_row in block.get("$columnAlias", {}).items():
            for provider, rows in block.items():
                if provider.startswith("$") or canonical not in rows:
                    continue
                column = document.get(provider)
                if column is None or column_row not in column:
                    continue
                if rows[canonical] != column[column_row]:
                    failures.append(
                        f"{name} $pilot {provider} {canonical!r} is {rows[canonical]} and the "
                        f"column above it says {column[column_row]} for {column_row!r}"
                    )
    return failures


# ---------------------------------------------------------------- the document claims


def _claims() -> list[dict]:
    path = HERE / "claims.json"
    if not path.exists():
        raise SystemExit(f"{path} does not exist; claims.py has nothing to check")
    return json.loads(path.read_text())["claims"]


def check_documents() -> tuple[list[str], list[str]]:
    failures: list[str] = []
    unverified: list[str] = []
    for claim in _claims():
        label = f"{claim['document']} :: {claim['derive']}"
        document = HERE / claim["document"]
        if not document.exists():
            failures.append(f"{label}: {document} does not exist")
            continue
        pattern = re.compile(claim["find"])
        found = pattern.findall(document.read_text())
        if len(found) != 1:
            failures.append(
                f"{label}: /{claim['find']}/ matched {len(found)} times in "
                f"{claim['document']}, and a claim is pinned by matching exactly once. "
                "Either the sentence moved and the pattern must follow it, or it is now stated "
                "in more than one place and only one of them is being checked."
            )
            continue
        try:
            expected = derive(claim["derive"])
        except Unverifiable as exc:
            unverified.append(f"{label}: {exc}")
            continue
        actual = int(str(found[0]).replace(",", ""))
        if actual != expected:
            failures.append(
                f"{label}: {claim['document']} says {actual} and {claim['derive']} is {expected}"
                + (f" — {claim['why']}" if claim.get("why") else "")
            )
    return failures, unverified


# ---------------------------------------------------------------- entry point


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    parser.add_argument("--list", action="store_true", help="what is pinned, and to what")
    parser.add_argument("--show", action="store_true", help="the value of every derivation")
    args = parser.parse_args()

    if args.list:
        for claim in _claims():
            print(f"{claim['document']:<16} {claim['derive']:<44} /{claim['find']}/")
        return 0

    if args.show:
        for claim in sorted({c["derive"] for c in _claims()}):
            try:
                print(f"{claim:<44} {derive(claim)}")
            except Unverifiable as exc:
                print(f"{claim:<44} UNVERIFIABLE — {exc}")
        return 0

    failures, unverified = check_shared()
    document_failures, document_unverified = check_documents()
    failures += document_failures + check_pilot_against_columns()
    unverified += document_unverified

    for line in failures:
        print(f"FALSE       {line}")
    for line in unverified:
        print(f"UNVERIFIED  {line}")

    checked = len(_claims())
    if failures:
        print(f"\n{len(failures)} claim(s) FALSE, out of {checked} figure(s) plus the shared-file "
              "declaration. Correct the document or the source; do not adjust this file to agree.")
        return 1
    if unverified:
        print(f"\nno false claim, but {len(unverified)} could not be checked. That is not a pass.")
        return 2
    print(f"{checked} figure(s) re-derived and the shared-file declaration holds.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
