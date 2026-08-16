#!/usr/bin/env python3
"""Check every generated asset against the numbers it claims, the plan, and the art bible.

Looking at an image tells you whether a creature is appealing and whether a wordmark's lettering
is mangled. It does not reliably tell you that a ground is #2b2b2d rather than #12100f, that a
portrait has drifted twenty degrees of hue off its type anchor, or that the four members of one
evolution line are no longer the same colour as each other — the eye adapts, and a set of fifty
portraits adapts it fifty times. So the measurable things are measured here and the rest is done
by looking, on the contact sheets `sheet.py` builds.

Six checks:

  1. **Completeness.** Every asset in PLAN.json has a manifest entry and a file on disk. A set
     that is quietly missing nine portraits is the failure this repository exists to avoid.
     **Fatal for the SHIPPED set; counted and named for a candidate.** A challenger that
     generated fifteen assets to answer one question is partial by design, not broken.
  2. **Dimensions.** The bytes must measure exactly what the manifest declares. This is the check
     the estate currently fails silently — design-system.md §7 item 3, twelve game masters at 1024
     against a declared 512.
  3. **Checksum.** The file on disk must be the file the manifest recorded. A manifest that has
     drifted from its artefacts is worse than no manifest — and this repository rewrites its own
     files twice after generation (normalise, derive), so it is the check most likely to catch a
     step that forgot to write back.
  4. **Ground, by class.** A `flat` asset must be EXACTLY #12100f in all four corners after
     normalisation; there is no tolerance, because the value is set numerically and any deviation
     means the step did not run. A `scene` asset is a picture and is held to a darkness ceiling
     instead. The two rules are reported separately rather than averaged into one claim.
  5. **Not degenerate.** A file that is 99.5% ground is a blank, and a blank passes every other
     check on this list. Ink coverage is measured against the ground, and a scene must also have
     real tonal range rather than being one flat field.
  6. **Type is colour, and families read as families.** The art bible's second pillar is the one
     consistency rule this whole set is judged on, and it is a rule about hue. Each portrait's
     chromatic pixels are measured against its own type anchor, and then each evolution line is
     measured against ITSELF: the spread of its members' rendered hues. A family whose members
     sit 40 degrees apart does not read as a family, whatever each portrait looks like alone.

`--cvd` prints the separation matrix for the nine type colours under normal, protan and deutan
vision. See the note on it below: it is evidence, not a gate.


** THE CHECK THAT WAS DORMANT IS LIVE AGAIN, AND THE RUN SAYS WHICH IT IS. ** When the owner
withdrew Qwen-Image 2512 and its candidate trees were deleted, `check_parity` — the only check
here that compares SETS rather than reading one manifest and its bytes — was left with a single
operand and returned clean because it had been handed one document. It said DORMANT on every run
for as long as that was true. `candidates/gpt-image-2` is a second manifest on disk, so a full run
now compares two sets and prints the count of disagreements it actually found.

The DORMANT wording has NOT been deleted, because dormancy is a property of the SELECTION and not
of the estate: `verify.py --provider gpt-image-2` hands the function one document and is dormant
this afternoon whatever is on disk. What changed is which branch a full run takes. `--self-test`
still hands the real function two-set fixtures on every CI run, and still will after a candidate
is promoted and the loser deleted, so this cannot quietly stop being able to fail again. Every
other check in this file is unaffected either way: they read one manifest and its pixels, and they
would go red today exactly as they would have yesterday.

    python3 verify.py --self-test    # break the cross-set guard on a fixture; no images needed
    python3 verify.py                          # every set present, every asset
    python3 verify.py species types            # only these sets
    python3 verify.py --provider flux-2-pro    # one set — parity DORMANT by selection
    python3 verify.py --provider gpt-image-2   # the candidate alone
    python3 verify.py --cvd                    # the colour-vision separation table
"""

from __future__ import annotations

import argparse
import colorsys
import hashlib
import json
import sys
from pathlib import Path

from PIL import Image

import dialects
import providers

HERE = Path(__file__).resolve().parent
PLAN = HERE / "PLAN.json"

GROUND = "#12100f"

# A scene is a picture and cannot have a flat ground, so it is held to a darkness ceiling at its
# EDGES instead. 0.12 passes a near-black with room to spare and fails the mid-grey taupe field
# (about 0.23) that came back on the brand run's first live image. Keyart legitimately reaches
# this: Emberfall Vale is a gold-lit valley, and its edges are the part that must stay dark.
MAX_SCENE_EDGE_LUMA = 0.12

# Degrees of hue. A flat fill rendered lighter or darker is variation; a different hue is a bug.
# 30 rather than 25, as the brand run settled on: FLUX renders every colour lighter than the hex
# it is given, and lightening a fill drags its hue a little as well.
MAX_HUE_DRIFT = 30.0
# Below this saturation a pixel is ground, ink or rim light, and its hue is noise.
MIN_SAT = 0.18

# The share of the image that must be drawn in the asset's own colour.
MIN_COVERAGE = {"species": 0.02, "types": 0.010, "ui": 0.005, "title": 0.005, "biomes": 0.0}
# The share of the image that must be something other than ground. Below this it is a blank.
MIN_INK = 0.02

# How far apart one evolution line's members' rendered hues may sit. Wider than MAX_HUE_DRIFT
# because both ends of the comparison are rendered rather than specified, so both carry the
# model's lightening drift; a line that exceeds it is not one family.
MAX_FAMILY_SPREAD = 45.0


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def rgb_to_hex(rgb: tuple[int, int, int]) -> str:
    return "#%02x%02x%02x" % tuple(int(v) for v in rgb)


def _linear(value: int) -> float:
    c = value / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def luma(rgb) -> float:
    """Relative luminance, sRGB-linearised. The same transfer function WCAG contrast uses."""
    r, g, b = (_linear(int(v)) for v in rgb[:3])
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def hue_degrees(rgb) -> float:
    h, _, _ = colorsys.rgb_to_hls(*(int(v) / 255 for v in rgb[:3]))
    return h * 360


def hue_gap(a: float, b: float) -> float:
    """Shortest way round the hue circle. 350 and 10 are twenty degrees apart, not three hundred."""
    gap = abs(a - b) % 360
    return min(gap, 360 - gap)


def median(values: list[float]) -> float:
    ordered = sorted(values)
    return ordered[len(ordered) // 2] if ordered else 0.0


def circular_spread(hues: list[float]) -> float:
    """The widest gap between any two of these hues, measured the short way round.

    Not a standard deviation: a family is judged by its two most distant members, because that is
    the pair a player sees side by side in the dex and says "those are not the same animal".
    """
    return max((hue_gap(a, b) for i, a in enumerate(hues) for b in hues[i + 1 :]), default=0.0)


# ------------------------------------------------------------------ colour vision


def _to_lab(rgb) -> tuple[float, float, float]:
    r, g, b = (_linear(int(v)) for v in rgb[:3])
    # sRGB D65 -> XYZ, then XYZ -> CIE L*a*b*.
    x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
    y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
    f = lambda t: t ** (1 / 3) if t > 0.008856 else (7.787 * t + 16 / 116)  # noqa: E731
    fx, fy, fz = f(x), f(y), f(z)
    return (116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz))


def delta_e(a, b) -> float:
    """CIE76. Crude next to CIEDE2000, and it is the measure the estate's own palette claims use."""
    la, aa, ba = _to_lab(a)
    lb, ab, bb = _to_lab(b)
    return ((la - lb) ** 2 + (aa - ab) ** 2 + (ba - bb) ** 2) ** 0.5


# Machado, Oliveira and Fernandes (2009), severity 1.0, applied in linear RGB. The standard
# approximation, and the one the estate's own accent work is quoted against.
CVD_MATRICES = {
    "protan": (
        (0.152286, 1.052583, -0.204868),
        (0.114503, 0.786281, 0.099216),
        (-0.003882, -0.048116, 1.051998),
    ),
    "deutan": (
        (0.367322, 0.860646, -0.227968),
        (0.280085, 0.672501, 0.047413),
        (-0.011820, 0.042940, 0.968881),
    ),
}


def simulate(rgb, kind: str):
    if kind == "normal":
        return tuple(int(v) for v in rgb[:3])
    m = CVD_MATRICES[kind]
    lin = [_linear(int(v)) for v in rgb[:3]]
    out = []
    for row in m:
        v = max(0.0, min(1.0, sum(row[i] * lin[i] for i in range(3))))
        srgb = 12.92 * v if v <= 0.0031308 else 1.055 * v ** (1 / 2.4) - 0.055
        out.append(int(round(max(0.0, min(1.0, srgb)) * 255)))
    return tuple(out)


def cvd_report(plan: dict) -> int:
    """Print the nine type colours' separation, and name the pairs form has to carry.

    This is EVIDENCE, not a gate, and the distinction is the whole point. `ui/`'s corrected accent
    method could re-pick the five product accents for separation because an accent is decoration.
    The nine type anchors cannot be re-picked: "type is colour" is a gameplay rule, a player reads
    a matchup off the colour, and changing the hexes would change what the game means. Three of
    the nine are pale blues and two are yellows, and no amount of care makes them separate.

    So the correction is applied on the other channel — every type icon is a topologically
    distinct shape, declared in plan.ts — and this table is how anyone can check which pairs are
    relying on that entirely, rather than taking the claim on trust.
    """
    palette = plan["palette"]
    names = list(palette)
    print("Type-colour separation, CIE76 dE. The nine anchors are fixed by the game's rules;")
    print("this measures what colour alone can and cannot do, so form has to do the rest.\n")
    worst: list[tuple[float, str, str, str]] = []
    for kind in ("normal", "protan", "deutan"):
        print(f"  {kind}:")
        header = "           " + " ".join(f"{n[:5]:>6}" for n in names)
        print(header)
        for a in names:
            row = [f"{a:>10} "]
            for b in names:
                if a == b:
                    row.append("     -")
                    continue
                d = delta_e(simulate(hex_to_rgb(palette[a]), kind), simulate(hex_to_rgb(palette[b]), kind))
                row.append(f"{d:6.1f}")
                if a < b:
                    worst.append((d, a, b, kind))
            print(" ".join(row))
        print()
    worst.sort()
    print("The ten closest pairs anywhere in the three tables — these are the ones whose")
    print("distinction is carried ENTIRELY by icon shape:\n")
    for d, a, b, kind in worst[:10]:
        print(f"  dE {d:5.1f}  {a:>8} / {b:<8} under {kind}")
    print(
        "\nFor scale: the accent palette ui/ replaced had its worst pair at dE 4.1 under normal\n"
        "vision and dE 1.3 under protanopia, and was replaced for it. The corrected set reaches\n"
        "dE 17.0 normal / 12.9 deutan on its worst ADJACENT pair."
    )
    return 0


# ------------------------------------------------------------------ measurement


def sample_corners(image: Image.Image) -> tuple[int, int, int]:
    """Median of four corner patches. A corner is where no composition in the plan puts a subject."""
    width, height = image.size
    patch = max(8, min(width, height) // 24)
    pixels = []
    for left, top in (
        (0, 0),
        (width - patch, 0),
        (0, height - patch),
        (width - patch, height - patch),
    ):
        for y in range(top, top + patch):
            for x in range(left, left + patch):
                pixels.append(image.getpixel((x, y)))
    return (
        int(median([p[0] for p in pixels])),
        int(median([p[1] for p in pixels])),
        int(median([p[2] for p in pixels])),
    )


def corner_extremes(image: Image.Image) -> list[tuple[int, int, int]]:
    """Every distinct colour found in the four corner patches. Used for the exact-ground check."""
    width, height = image.size
    patch = max(8, min(width, height) // 24)
    found = set()
    for left, top in (
        (0, 0),
        (width - patch, 0),
        (0, height - patch),
        (width - patch, height - patch),
    ):
        for y in range(top, top + patch, 2):
            for x in range(left, left + patch, 2):
                found.add(image.getpixel((x, y))[:3])
    return sorted(found)


class Reading:
    def __init__(self, coverage, rendered, ink, tonal_range):
        #: Share of the sampled pixels within tolerance of the asset's own colour.
        self.coverage = coverage
        #: That colour AS RENDERED — the median of those pixels. Always lighter than the hex given.
        self.rendered = rendered
        #: Share of sampled pixels that are not ground. Below MIN_INK the file is a blank.
        self.ink = ink
        #: Spread of luma across the sample. A scene with none of it is one flat field.
        self.tonal_range = tonal_range


def read_image(image: Image.Image, accent: str, ground: tuple[int, int, int]) -> Reading:
    """Sample on a grid rather than exhaustively: every sixth row and column of a 1024 square is
    thirty thousand pixels, which is far more than a share needs and is instantaneous."""
    width, height = image.size
    step = max(1, min(width, height) // 200)
    accent_hue = hue_degrees(hex_to_rgb(accent))

    total = 0
    matched: list[tuple[int, int, int]] = []
    ink = 0
    lumas: list[float] = []
    for y in range(0, height, step):
        for x in range(0, width, step):
            total += 1
            pixel = image.getpixel((x, y))[:3]
            lumas.append(luma(pixel))
            if sum((pixel[i] - ground[i]) ** 2 for i in range(3)) ** 0.5 > 24:
                ink += 1
            _, lightness, saturation = colorsys.rgb_to_hls(*(v / 255 for v in pixel))
            if saturation < MIN_SAT or not 0.12 < lightness < 0.92:
                continue
            if hue_gap(hue_degrees(pixel), accent_hue) <= MAX_HUE_DRIFT:
                matched.append(pixel)

    rendered = (
        (
            int(median([p[0] for p in matched])),
            int(median([p[1] for p in matched])),
            int(median([p[2] for p in matched])),
        )
        if matched
        else None
    )
    lumas.sort()
    span = lumas[int(len(lumas) * 0.95)] - lumas[int(len(lumas) * 0.05)] if lumas else 0.0
    return Reading(len(matched) / total, rendered, ink / total, span)


def check_parity(documents: dict[str, dict]) -> list[str]:
    """The cross-set prompt check, in two halves — within a dialect, and across dialects.

    THE CHECK THE WHOLE COMPARISON RESTS ON. Two models asked different questions produce an
    incomparable answer, and the failure is invisible in the images — it looks like one model being
    worse at prompt adherence, which is exactly the conclusion this exercise is supposed to reach
    honestly or not at all.

    It compares the MANIFESTS, not PLAN.json and not the prompt-building code, because the manifest
    is the only artefact that records what was actually SENT. PLAN.json is regenerated from the
    current clauses on every run and drifts away from the run it describes the moment a clause is
    edited. Checking against the code would be checking against a thing that has already moved.

    Keyed on the manifest key rather than on the file path, so that a provider whose delivered
    dimensions differ from FLUX's is still lined up with the right reference asset.

    WITHIN A DIALECT: unchanged, and this is the property the controlled comparison rests on. Every
    asset present in two or more sets of the same dialect must carry the byte-identical prompt in
    all of them. A set that disagrees with its own dialect-mates is not comparable with them and
    this says so.

    ACROSS DIALECTS: RE-DERIVED, which is strictly stronger than the equality above rather than a
    relaxation of it. A dialect is a pure function of the reference set's recorded prompt, so a
    candidate in another dialect does not merely get to be different — its prompt must be EXACTLY
    what applying its dialect's rules to the reference's record produces. Equality could only ever
    say "these two strings differ". This says "this string is not what this dialect produces from
    the record", which catches a hand-edited prompt, a rule added after a run, and a set whose
    declared dialect is not the one it was actually generated in — none of which plain equality
    could see, because none of them looks like agreement or disagreement.

    The effect is that a set generated from a different prompt can never be silently compared with
    one it does not match: either it is in the same dialect and must be identical, or it is in a
    declared dialect and must be derivable. There is no third state.

    Also reports an asset a candidate has that the reference does not. Every dialect derives from
    the reference record, so a candidate can only ever be a subset of it whatever dialect it is in;
    an extra key means something generated a prompt of its own, which is the failure this whole
    check exists to catch.

    ** THE EARLY RETURN BELOW IS NARROW ON PURPOSE, AND THE CALLER SAYS SO OUT LOUD. ** For the
    year between Qwen-Image 2512 being withdrawn and gpt-image-2 arriving, every repository here
    held exactly one manifest and this function had nothing to compare it against. It returned
    clean because it had been handed ONE DOCUMENT, not because it looked and found nothing — and an
    exit code cannot tell those two apart. That is this estate's recurring defect, found five times
    in a day: a CI job that read image metadata without decoding the image, a grep that skipped
    files containing NUL bytes, a secret scan whose `-I` discarded the binary stream it was meant
    to search.

    That state can always come back — a promotion deletes the loser, and `--provider X` narrows a
    live run to one document on any afternoon — so the guard below is spelled "fewer than two sets"
    and never "no problems"; `main` prints the word DORMANT instead of a reassuring zero whenever
    it fires; and `python3 verify.py --self-test` runs this exact function against two-set fixtures
    on every CI run regardless of what is on disk. A SECOND SET WHOSE PROMPT DIFFERS BY ONE WORD
    MUST STILL FAIL, and that sentence is executable rather than a claim.
    """
    if len(documents) < 2:
        return []

    by_key: dict[str, dict[str, str]] = {}
    for provider_id, document in documents.items():
        for asset in document["assets"]:
            # providers.key_of, not a hand-built string: the three asset repositories identify an
            # asset differently and this function is the only place that difference lives.
            by_key.setdefault(providers.key_of(asset), {})[provider_id] = asset["prompt"]

    reference = providers.reference()
    dialect_of = {p.id: p.dialect for p in providers.load()}
    problems: list[str] = []

    for key, prompts in sorted(by_key.items()):
        if reference.id in documents and reference.id not in prompts:
            problems.append(
                f"{key}: present in {', '.join(sorted(prompts))} but not in the reference set "
                f"{reference.id} — every dialect derives from the reference's recorded prompt, so "
                "no set can hold an asset the reference has never generated"
            )
            continue

        # ---- within a dialect: byte-identical, exactly as before
        by_dialect: dict[str, dict[str, str]] = {}
        for provider_id, prompt in prompts.items():
            by_dialect.setdefault(dialect_of.get(provider_id, "?"), {})[provider_id] = prompt
        for dialect, group in sorted(by_dialect.items()):
            if len(group) < 2:
                continue
            distinct: dict[str, list[str]] = {}
            for provider_id, prompt in group.items():
                distinct.setdefault(
                    hashlib.sha256(prompt.encode()).hexdigest()[:12], []
                ).append(provider_id)
            if len(distinct) > 1:
                groups = "; ".join(
                    f'{digest} = {", ".join(sorted(ids))}' for digest, ids in sorted(distinct.items())
                )
                problems.append(
                    f"{key}: the {dialect}-dialect sets were given DIFFERENT prompts ({groups}). "
                    "The comparison between them is not valid until they agree — regenerate the "
                    "candidate, which replays the recorded prompt rather than computing one"
                )

        # ---- across dialects: re-derive from the record and compare bytes
        record = prompts.get(reference.id)
        if record is None:
            continue
        for provider_id, prompt in sorted(prompts.items()):
            dialect = dialect_of.get(provider_id, "?")
            if dialect == reference.dialect:
                continue
            expected = dialects.apply(dialect, record)
            if prompt != expected:
                problems.append(
                    f"{key}: {provider_id} declares the {dialect!r} dialect, but its recorded "
                    f"prompt is not what that dialect produces from the reference record "
                    f"(recorded {hashlib.sha256(prompt.encode()).hexdigest()[:12]}, derived "
                    f"{hashlib.sha256(expected.encode()).hexdigest()[:12]}). Either the set was "
                    "generated in a different dialect from the one it claims, or dialects.json "
                    "changed after the run — regenerate it, or the two sets are not two phrasings "
                    "of one brief and nothing may be concluded by putting them side by side"
                )
                continue
            owed = dialects.residuals(dialect, prompt)
            if owed:
                problems.append(
                    f"{key}: {provider_id} is labelled {dialect!r} but its prompt still carries "
                    f"{len(owed)} prohibition word(s) — {', '.join(owed)}. The label is a claim "
                    "about the prompt and this one is not true of it"
                )
    return problems


# ══════════════════════════════════════════════════════════════════════════════════════════════
# THE CHECK THAT CAN GO DORMANT, AND THE MACHINERY THAT PROVES IT CAN STILL BITE
#
# `check_parity` above is the only check in this file that is ABOUT THE SET OF SETS. Every other
# check reads one manifest and the bytes it points at, and goes on working whatever else exists.
# This one compares sets to each other, so when the owner withdrew the only challenger it was left
# with one operand: its failure count went to zero at a stroke with nothing about the shipped set
# changed.
#
# That is the precise shape of a number improving because a check stopped looking, and this estate
# has been bitten by it repeatedly. The response was two things, neither of which is a comment:
# `main` prints DORMANT rather than 0, and everything below hands the real function a real second
# set and fails if it stays green.
#
# gpt-image-2 has since put a second manifest on disk, so a full run compares two real sets again.
# NONE OF THIS MACHINERY IS BEING REMOVED ON THAT NEWS. It is what makes the live run's number
# trustworthy, it is what will hold when a promotion deletes the loser and the count returns to
# one, and it costs a fixture and no images to run. A guard deleted the day its subject arrives is
# a guard that was never doing the work its author claimed.
# ══════════════════════════════════════════════════════════════════════════════════════════════

#: A recorded prompt that the positive dialect genuinely REWRITES, and whose rewrite comes out with
#: no negation vocabulary left. Both halves are load-bearing: a fixture the transform happens to
#: leave alone would pass the re-derivation check without the transform ever running.
_FIXTURE_RECORD = (
    "A flat mark, with exactly one accent colour — #e8622c — and no second hue anywhere."
)
#: A record the positive rule list does NOT cover. It transforms to itself, so it passes the
#: re-derivation half and must be caught by the residual half instead — which is the half that
#: makes "positive" a measured property of the prompt rather than a label somebody typed.
_FIXTURE_UNCOVERED = "A mark on the ash field. There is no chartreuse anywhere in the frame."


def _fixture_asset(name: str, prompt: str) -> dict:
    """One manifest entry, spelled with THIS repository's own identity fields.

    Built from providers.json's `identity` block rather than hardcoded, for two reasons. It makes
    the fixture travel through `providers.key_of` exactly as a real manifest entry does — and it
    lets this whole file's self-test be the same code in all three asset repositories, which key
    their assets differently. A hardcoded `surface`/`kind` entry would key on nothing at all in the
    game sets, and a check handed keys it cannot build is a check that passes for the wrong reason.
    """
    fields = json.loads((HERE / "providers.json").read_text())["identity"]["key"]
    entry = {field: "fixture" for field in fields}
    entry[fields[0]] = name
    entry["prompt"] = prompt
    return entry


class _registry_with:
    """providers.json with challenger entries appended, for the duration of one call.

    `check_parity` reads the registry every time it runs — the identity block, the reference id and
    every provider's declared dialect. A fixture made only of manifests would therefore be handed
    to a check that could not see a second provider at all, and would prove nothing.

    So this appends to the REAL document rather than inventing one: `identity`, `reference` and
    dialects.json are exactly what ships. What is synthetic is a second SET, and nothing else —
    which for a year was precisely the thing that did not exist on disk, and is why these fixtures
    are built in memory rather than read from `candidates/`: they must go red in a checkout that
    has one set, or none, or one that has just been promoted. The challengers are registered `live`,
    because a withdrawn provider with a manifest present would get the same verdict — this function
    compares the manifests it is GIVEN — and registering them live is the harder case to pass.
    """

    def __init__(self, *challengers: tuple[str, str]) -> None:
        self._challengers = challengers
        self._real = providers._document

    def __enter__(self):
        document = json.loads((HERE / "providers.json").read_text())
        template = next(p for p in document["providers"] if p["id"] == document["reference"])
        for provider_id, dialect in self._challengers:
            entry = dict(template)
            entry.update(
                id=provider_id,
                label=provider_id,
                dialect=dialect,
                root=f"candidates/{provider_id}",
                shipped=False,
                status="live",
            )
            document["providers"].append(entry)
        providers._document = lambda: document
        return self

    def __exit__(self, *exc) -> None:
        providers._document = self._real


def self_test() -> int:
    """Break the cross-set guard on a fixture and watch it go red. No images, no endpoint, no keys.

    WHAT THIS IS FOR. `check_parity` lost its second operand when the Qwen challenger was deleted.
    Nothing about the shipped set changed, and nothing about this function's ability to find a
    defect changed either — but from the outside those are indistinguishable from the check having
    quietly died, because both look like a zero. Reading the source is not evidence; the source
    always looks like it works. So the real function is called here, unmodified, against manifests
    built in memory.

    BOTH DIRECTIONS ARE ASSERTED. A check that always fails is exactly as useless as one that never
    does, and it is the easier of the two mistakes to make when writing a test like this. Every
    property below is exercised twice: once with a fixture that should pass and once with a fixture
    that should fail, and only the pair is evidence.

    THE FOUR PROPERTIES, which are the four ways two sets can stop being comparable:

      within a dialect   two sets given different prompts for one asset
      across dialects    a set whose prompt is not what its declared dialect derives from the record
      the residual rule  a set labelled `positive` whose prompt still carries negation vocabulary
      the subset rule    a set holding an asset the reference has never generated

    And the dormant state itself is asserted last, on a document that WOULD fail if it had a
    partner — which is the difference between "there is nothing wrong" and "there is nothing here".
    """
    document = json.loads((HERE / "providers.json").read_text())
    reference_id = document["reference"]
    reference_dialect = next(p["dialect"] for p in document["providers"] if p["id"] == reference_id)
    checks: list[tuple[str, bool, list[str]]] = []

    def check(name: str, ok: bool, detail=()) -> None:
        checks.append((name, bool(ok), [str(d) for d in detail]))

    # The fixtures below assume the record is in the literal dialect. If that ever stops being
    # true the cross-dialect cases silently become no-ops, so it is asserted rather than assumed.
    check(
        f"the reference set {reference_id} is the dialect the record is in",
        reference_dialect == "literal",
        [f"reference dialect is {reference_dialect!r}"],
    )

    # ---- WITHIN A DIALECT. Byte-identical, or the two sets answered different questions.
    with _registry_with(("fixture-literal", "literal")):
        agreeing = {
            reference_id: {"assets": [_fixture_asset("alpha", _FIXTURE_RECORD)]},
            "fixture-literal": {"assets": [_fixture_asset("alpha", _FIXTURE_RECORD)]},
        }
        check("parity passes two literal sets that agree", check_parity(agreeing) == [])

        divergent = {
            reference_id: {"assets": [_fixture_asset("alpha", _FIXTURE_RECORD)]},
            "fixture-literal": {
                "assets": [_fixture_asset("alpha", _FIXTURE_RECORD.replace("flat", "glossy"))]
            },
        }
        found = check_parity(divergent)
        check(
            "parity FAILS a live second set whose prompt differs by ONE WORD",
            len(found) == 1 and "DIFFERENT prompts" in found[0],
            found,
        )

        # ---- THE SUBSET RULE. Every dialect derives from the reference record, so a candidate can
        # only ever be a subset of it. An extra key means something generated a prompt of its own.
        orphan = {
            reference_id: {"assets": [_fixture_asset("alpha", _FIXTURE_RECORD)]},
            "fixture-literal": {"assets": [_fixture_asset("beta", _FIXTURE_RECORD)]},
        }
        found = check_parity(orphan)
        check(
            "parity FAILS an asset the reference has never generated",
            len(found) == 1 and "never generated" in found[0],
            found,
        )

    # ---- ACROSS DIALECTS. Re-derived from the record, which is stronger than equality: equality
    # could only ever say "these differ", and every case below looks like agreement to it.
    with _registry_with(("fixture-positive", "positive")):
        derived = dialects.apply("positive", _FIXTURE_RECORD)
        check(
            "the positive dialect actually rewrites the fixture, so the next two cases are real",
            derived != _FIXTURE_RECORD,
            [derived],
        )

        correct = {
            reference_id: {"assets": [_fixture_asset("alpha", _FIXTURE_RECORD)]},
            "fixture-positive": {"assets": [_fixture_asset("alpha", derived)]},
        }
        check("parity passes a cross-dialect set that IS derivable", check_parity(correct) == [])

        # The case plain equality is blind to: a prompt that differs from the reference's exactly
        # as a different dialect would — but is not what THIS dialect produces from the record.
        undertransformed = {
            reference_id: {"assets": [_fixture_asset("alpha", _FIXTURE_RECORD)]},
            "fixture-positive": {"assets": [_fixture_asset("alpha", _FIXTURE_RECORD)]},
        }
        found = check_parity(undertransformed)
        check(
            "parity FAILS a set declaring a dialect it was not generated in",
            len(found) == 1 and "is not what that dialect produces" in found[0],
            found,
        )

        # ---- THE RESIDUAL RULE. Derivable and still wrong: the label is a claim about the prompt.
        uncovered = dialects.apply("positive", _FIXTURE_UNCOVERED)
        residual = {
            reference_id: {"assets": [_fixture_asset("alpha", _FIXTURE_UNCOVERED)]},
            "fixture-positive": {"assets": [_fixture_asset("alpha", uncovered)]},
        }
        found = check_parity(residual)
        check(
            "parity FAILS a 'positive' set whose prompt still carries a prohibition word",
            len(found) == 1 and "prohibition word" in found[0],
            found,
        )

    # ---- AND THE DORMANT STATE ITSELF, asserted rather than described.
    #
    # The single document handed in here is the SAME divergent fixture that went red above, minus
    # its partner. It comes back clean. That is the whole point: the clean result is a statement
    # about how many sets are on disk and about nothing else, and it is why `main` refuses to print
    # it as a zero.
    lone = {reference_id: {"assets": [_fixture_asset("alpha", _FIXTURE_RECORD)]}}
    check(
        "one set is DORMANT, not clean — the same fixture fails the moment it has a partner",
        check_parity(lone) == [],
        [],
    )
    # ---- AND THAT A FULL RUN REALLY COMPARES EVERYTHING ON DISK.
    #
    # This slot used to assert `len(providers.present()) == 1` — "and the repository really is in
    # that state, so the DORMANT line is not decoration". That was true when it was written and it
    # went false the hour gpt-image-2's manifest landed, failing the self-test for the one reason a
    # self-test must never fail: the estate got BETTER. Pinning a headcount pins the weather.
    #
    # What that line was really guarding is worth keeping, so it is asserted directly instead: a
    # full run must hand `check_parity` every set that exists. The way this check silently dies is
    # not the count changing, it is `selected()` growing a filter — on `shipped`, on `status`, on
    # anything — that quietly drops the candidate, at which point two sets sit on disk and the
    # comparison between them never runs while the output still says how many failures it found.
    # That is falsifiable, it is about the code rather than about today, and it holds at one set,
    # at two, and after a promotion demotes the loser.
    present = {p.id for p in providers.present()}
    full_run = {p.id for p in providers.selected(argparse.Namespace(provider=None))}
    check(
        "a full run selects every set on disk, so nothing can sit unread beside a green parity line",
        full_run == present,
        [f"on disk: {sorted(present)}", f"a full run reads: {sorted(full_run)}"],
    )
    print(
        f"      (informational: {len(present)} set(s) on disk — "
        + (
            "a full run compares them, so parity is LIVE"
            if len(present) > 1
            else "a full run is therefore DORMANT, which is what main will print"
        )
        + ")"
    )

    print("===== self-test: the cross-set guard, broken on a fixture")
    failed = 0
    for name, ok, detail in checks:
        print(f"  {'ok  ' if ok else 'FAIL'} {name}")
        if not ok:
            failed += 1
            for line in detail:
                print(f"         {line}")
    print(f"\n{failed} of {len(checks)} self-test(s) failed")
    return 1 if failed else 0



NATIVE_COLUMNS = ("nativePath", "nativeSize", "nativeSha256", "nativeC2pa")


def check_native(asset: dict, root: Path) -> list[str]:
    """The four `native*` columns, re-derived from the file they name. INTEGRITY, never conformance.

    ## What these columns are, and why they need a check of their own

    Some endpoints refuse to generate at a size this set declares. gpt-image-2 has a minimum pixel
    budget, measured by bisection to sit in (524288, 655360], and TWENTY-ONE of this set's eighty-
    three generations fall under it: the nine type icons and eight UI glyphs at 512x512, the two
    1024x512 UI banners, the 1024x384 wordmark and the 512x256 button. Each is generated at an
    exact multiple of the same aspect ratio and Lanczos'd DOWN by `derive.py --resample`, and the
    as-delivered file is kept at `native/<set>/<slug>-<w>x<h>-asdelivered.png` — outside `assets/`,
    so the orphan walk below does not see it and so nothing ever ships it by accident.

    That leaves the shipped-looking PNG one step removed from anything the model returned, which is
    exactly the situation in which "generated at 512x512" quietly becomes an upscale of something
    smaller. Four columns say what the model actually delivered; without this function they are
    four strings nobody has ever compared to a file, which is this estate's favourite kind of
    defect. `verify.py`'s whole claim is that a manifest is TRUE about bytes, and the native
    columns are part of the manifest.

    Five things are checked and every one of them is fatal for a candidate as well as for the
    shipped set, because all five are claims the manifest makes about itself:

      * the columns arrive together or not at all — three of four is a half-written record
      * the named file exists, and its sha256 and c2pa state are what the row says (c2pa MEASURED,
        because re-encoding drops the chunk and the downscaled asset is expected to have lost it
        while the native is expected to have kept it — the pair is the evidence)
      * the file's real pixel size is `nativeSize`
      * the native is not SMALLER than the declared size on either axis. That is the upscale check.
        A native under the declared size means the shipped file was invented, not downscaled.
      * the two aspect ratios agree to within half a pixel, so the "derived" file really is this
        file's downscale and not a differently-shaped image that happens to sit beside it.
    """
    if not any(column in asset for column in NATIVE_COLUMNS):
        return []
    missing = [column for column in NATIVE_COLUMNS if column not in asset]
    if missing:
        held = ", ".join(sorted(set(NATIVE_COLUMNS) - set(missing)))
        return [f"records {held} but not {', '.join(missing)}"]

    problems: list[str] = []
    native = root / asset["nativePath"]
    if not native.exists():
        return [f'nativePath {asset["nativePath"]} is not on disk']

    data = native.read_bytes()
    if hashlib.sha256(data).hexdigest() != asset["nativeSha256"]:
        problems.append(f'{asset["nativePath"]}: checksum does not match nativeSha256')
    carries = b"c2pa" in data
    if carries != asset["nativeC2pa"]:
        problems.append(
            f'{asset["nativePath"]}: manifest says nativeC2pa={asset["nativeC2pa"]} and the bytes '
            f"say {carries}"
        )

    with Image.open(native) as raw:
        measured = raw.size
    stated = tuple(int(n) for n in asset["nativeSize"].split("x"))
    if measured != stated:
        problems.append(
            f'{asset["nativePath"]}: {measured[0]}x{measured[1]} against a recorded nativeSize '
            f'{asset["nativeSize"]}'
        )

    declared = tuple(int(n) for n in asset["declaredSize"].split("x"))
    if measured[0] < declared[0] or measured[1] < declared[1]:
        problems.append(
            f'native {measured[0]}x{measured[1]} is smaller than the declared '
            f'{asset["declaredSize"]} on at least one axis — the shipped file would be an UPSCALE '
            "of it, and no set here upscales"
        )
    elif abs(measured[0] / measured[1] - declared[0] / declared[1]) > 0.5 / max(declared):
        problems.append(
            f'native {measured[0]}x{measured[1]} is not the same shape as the declared '
            f'{asset["declaredSize"]}, so the shipped file is not a downscale of it'
        )
    return problems


def check_integrity(provider, document: dict) -> list[str]:
    """Two things about the manifest as a whole, rather than about any one image."""
    problems: list[str] = []
    declared = document.get("assetCount")
    if declared is not None and declared != len(document["assets"]):
        # It was wrong in two of the estate's three asset repositories when this was written,
        # because the count is written by the generator and later entries were added by another
        # tool. A manifest whose own summary disagrees with its own body is one nobody can quote.
        problems.append(
            f'MANIFEST.json: assetCount says {declared} and the file carries '
            f'{len(document["assets"])} entries'
        )
    recorded = {a["path"] for a in document["assets"]}
    on_disk = {str(p.relative_to(provider.root)) for p in provider.root.glob("assets/**/*.png")}
    for orphan in sorted(on_disk - recorded):
        problems.append(f"{orphan}: on disk with no manifest entry")
    return problems


def verify_set(provider, document: dict, wanted: set[str], as_shipped: bool = False) -> list[str]:
    plan = json.loads(PLAN.read_text())
    ground_target = hex_to_rgb(GROUND)

    failures: list[str] = []
    rows: list[str] = []
    by_family: dict[str, list[tuple[str, float]]] = {}
    assets = {a["asset"]: a for a in document["assets"]}

    # ---- 1. completeness, against the plan rather than against itself.
    #
    # FATAL FOR THE SHIPPED SET, COUNTED AND NAMED FOR A CANDIDATE — the same line the conformance
    # checks below already draw, and for the same reason. "A set that is quietly missing nine
    # portraits" is the failure this repository exists to avoid, and that sentence is about the set
    # the estate consumes. A challenger is on trial: a PARTIAL challenger is a normal and often
    # deliberate state, because the point of generating fifteen assets in a new dialect is to
    # answer a question without spending a deployment lifetime on all of them.
    #
    # It was fatal for both, and that is what turned this repository red today. The positive-dialect
    # pilot is fifteen assets by design — COMPARISON.md says so and gives the number this check
    # reports — so every un-generated asset in it counted as a build failure. That leaves exactly
    # three ways to get a green run: delete the pilot, weaken a check, or stop the completeness
    # rule from grading a set it was never written about. The third is the only one that costs
    # nothing, and `verify_set`'s own comment below already predicted the other two: "turning CI
    # red for it would mean the only way to land the evidence is to weaken a check, which is the
    # one thing that must not happen."
    #
    # Nothing the shipped set is held to has changed, and a partial candidate is still SAID OUT
    # LOUD with a count, so this cannot become a set that quietly failed to generate.
    missing = [
        planned["key"]
        for planned in plan["assets"]
        if not (wanted and planned["set"] not in wanted)
        and planned["key"] not in assets
        and f'{planned["key"]}-source' not in assets
    ]
    if missing:
        if provider.shipped or as_shipped:
            failures.extend(f"{key}: planned but never generated" for key in missing)
        else:
            print(
                f"note {len(missing)} of {len(plan['assets'])} planned asset(s) are not in this "
                f"CANDIDATE set — a partial challenger is not a build failure. First few: "
                f"{', '.join(missing[:5])}"
            )

    for asset in document["assets"]:
        if wanted and asset["set"] not in wanted:
            continue
        path = provider.root / asset["path"]
        # INTEGRITY: is this manifest TRUE about these bytes. Fatal for every set, always.
        problems: list[str] = []
        # CONFORMANCE: does this art meet this set's own specification. Fatal for the SHIPPED set;
        # reported by name for a candidate. A candidate is on trial, and how far it sits from the
        # art bible is the comparison's first criterion rather than a broken build. Turning CI red
        # for it would mean the only way to land the evidence is to weaken a check, which is the
        # one thing that must not happen. Nothing the shipped set is held to has changed.
        conformance: list[str] = []

        if not path.exists():
            failures.append(f'{asset["path"]}: missing')
            continue

        data = path.read_bytes()
        if hashlib.sha256(data).hexdigest() != asset["sha256"]:
            problems.append("checksum does not match the manifest")

        # The as-delivered native, where the endpoint refused the declared size. INTEGRITY: these
        # are claims the manifest makes about bytes, so they are fatal for a candidate too.
        problems.extend(check_native(asset, provider.root))

        with Image.open(path) as raw:
            image = raw.convert("RGB")
            declared = tuple(int(n) for n in asset["declaredSize"].split("x"))
            if image.size != declared:
                problems.append(
                    f'{image.size[0]}x{image.size[1]} against a declared {asset["declaredSize"]}'
                )

            corners = sample_corners(image)
            corner_luma = luma(corners)

            # ---- 4. ground, by class.
            if asset["groundClass"] == "flat":
                distinct = corner_extremes(image)
                off = [c for c in distinct if c != ground_target]
                if off:
                    conformance.append(
                        f"{len(off)} of {len(distinct)} sampled corner colour(s) are not exactly "
                        f"{GROUND} — nearest stray {rgb_to_hex(off[0])}; normalisation did not run "
                        "or did not take"
                    )
            elif corner_luma > MAX_SCENE_EDGE_LUMA:
                conformance.append(
                    f"scene edges at {rgb_to_hex(corners)} are too light (luma {corner_luma:.3f}, "
                    f"ceiling {MAX_SCENE_EDGE_LUMA})"
                )

            reading = read_image(image, asset["accent"], corners)

            # ---- 5. not degenerate.
            if reading.ink < MIN_INK:
                problems.append(
                    f"only {reading.ink * 100:.2f}% of the image differs from its ground — this is "
                    "a blank"
                )
            if asset["groundClass"] == "scene" and reading.tonal_range < 0.02:
                problems.append(
                    f"tonal range {reading.tonal_range:.3f} — a scene that is one flat field"
                )

            # ---- 6. type is colour.
            floor = MIN_COVERAGE.get(asset["set"], 0.005)
            if reading.coverage < floor:
                conformance.append(
                    f'only {reading.coverage * 100:.2f}% of the image is drawn within '
                    f'{MAX_HUE_DRIFT:.0f} degrees of {asset["accent"]} (floor {floor * 100:.1f}%)'
                )
            if asset["set"] == "species" and asset["family"] and reading.rendered:
                by_family.setdefault(asset["family"], []).append(
                    (asset["slug"], hue_degrees(reading.rendered))
                )

        fatal = problems + (conformance if (provider.shipped or as_shipped) else [])
        mark = "FAIL" if fatal else ("warn" if conformance else "ok  ")
        rows.append(
            f'{mark} {asset["set"]:<8} {asset["slug"]:<26} {asset["declaredSize"]:>9} '
            f'{asset["groundClass"]:<5} corner {rgb_to_hex(corners)} '
            f"ink {reading.ink * 100:5.1f}%  "
            f'colour {rgb_to_hex(reading.rendered) if reading.rendered else "-":<8} '
            f"{reading.coverage * 100:5.2f}%"
        )
        for problem in problems + conformance:
            rows.append(f"       -> {problem}")
        for problem in fatal:
            failures.append(f'{asset["path"]}: {problem}')

    print("\n".join(rows))

    # ---- families read as families.
    if by_family:
        print("\nEvolution lines, by the spread of their members' rendered hue:")
        print("(the art bible's rule: evolutions deepen and enrich, never fully recolour)\n")
        for root in sorted(by_family, key=lambda r: -circular_spread([h for _, h in by_family[r]])):
            members = by_family[root]
            if len(members) < 2:
                continue
            spread = circular_spread([h for _, h in members])
            mark = "FAIL" if spread > MAX_FAMILY_SPREAD else "ok  "
            detail = "  ".join(f"{slug} {hue:.0f}deg" for slug, hue in members)
            print(f"  {mark} {root:<14} spread {spread:5.1f}deg   {detail}")
            if spread > MAX_FAMILY_SPREAD and (provider.shipped or as_shipped):
                # Conformance, like the per-asset colour checks: an evolution line that does not
                # read as one family is this set's sharpest single quality question, and for a
                # CANDIDATE it is the answer to comparison criterion 2 rather than a build error.
                # The shipped set is still held to it.
                failures.append(
                    f"family {root}: members' rendered hues span {spread:.1f} degrees "
                    f"(ceiling {MAX_FAMILY_SPREAD}) — this line does not read as one family"
                )

    print(
        f"\ntarget ground {GROUND} (exact on flat assets, luma ceiling "
        f"{MAX_SCENE_EDGE_LUMA} on scene edges); hue tolerance {MAX_HUE_DRIFT:.0f} degrees, "
        f"family ceiling {MAX_FAMILY_SPREAD:.0f} degrees"
    )
    return failures


def main(argv: list[str]) -> int:
    """Run every check, per provider, and then the two that are about the set of sets.

    A candidate set is expected to be RED while it is being worked on. That must not be able to
    turn the shipped reference set red with it, which is why each set has its own manifest and its
    own pass-or-fail line, and why the default is "every set that exists on disk" rather than a
    fixed list — a challenger that has not been generated yet is the normal state, not a fault.
    """
    parser = argparse.ArgumentParser(description="Verify one or more generated asset sets.")
    providers.add_argument(parser)
    parser.add_argument("--cvd", action="store_true", help="the colour-vision report only")
    parser.add_argument("sets", nargs="*", help="only these sets")
    parser.add_argument(
        "--self-test",
        action="store_true",
        help="break the cross-set guard against a fixture and prove it goes red. No images needed.",
    )
    # ═══ WHY A FLAG THAT ONLY CHANGES WHAT COUNTS AS FATAL ═══════════════════════════════════════
    #
    # The INTEGRITY / CONFORMANCE split below is right and is not being softened: a manifest that
    # is untrue about its bytes is broken for every set, and how far a CANDIDATE's art sits from
    # the art bible is the comparison's first criterion rather than a broken build. Turning CI red
    # for a challenger would mean the only way to land the evidence is to weaken a check.
    #
    # But it leaves a gap with teeth, and it is a gap about the FUTURE rather than about today. A
    # candidate can pass `--provider <id>` with a page of conformance deviations printed as warn,
    # be promoted on the strength of that green line, and turn the repository red the instant
    # `shipped` flips to true — at which point the artwork is already at `assets/` and the honest
    # fix is to switch back. In micro-brand this is not hypothetical: gpt-image-2 passes its own
    # verify and fails as-shipped on one asset's accent coverage.
    #
    # `--as-shipped` asks the other question: not "is this candidate sound" but "would this set be
    # green if it were the shipped one". It changes nothing except which list is fatal — the same
    # measurements, the same output, the same rows. `promote.py` gates on it, so a promotion cannot
    # be the thing that discovers the answer.
    parser.add_argument(
        "--as-shipped",
        action="store_true",
        help="hold a candidate to the SHIPPED set's rules: conformance and completeness become "
        "fatal. What promote.py gates on, so a promotion cannot discover the answer.",
    )
    args = parser.parse_args(argv)

    if args.self_test:
        return self_test()

    if args.cvd:
        return cvd_report(json.loads(PLAN.read_text()))

    chosen = providers.selected(args)
    if not chosen:
        print("no provider has a manifest on disk", file=sys.stderr)
        return 1

    all_failures: list[str] = []
    documents: dict[str, dict] = {}

    for provider in chosen:
        print(
            f"===== {provider.id}  ({provider.label})"
            + ("  — graded AS SHIPPED" if args.as_shipped and not provider.shipped else "")
        )
        document = json.loads(provider.manifest.read_text())
        documents[provider.id] = document
        failures = verify_set(provider, document, set(args.sets), as_shipped=args.as_shipped)
        failures.extend(check_integrity(provider, document))
        print(f"{len(failures)} failure(s) in {provider.id}\n")
        all_failures.extend(f"{provider.id}: {f}" for f in failures)

    parity = check_parity(documents)
    if len(documents) > 1:
        spoken = {p.id: p.dialect for p in chosen if p.id in documents}
        grouped = ", ".join(
            f"{d}({', '.join(sorted(i for i, v in spoken.items() if v == d))})"
            for d in sorted(set(spoken.values()))
        )
        print(f"===== prompt parity across {len(documents)} sets: {len(parity)} disagreement(s)")
        print(f"      dialects: {grouped}")
        print(
            "      identical WITHIN a dialect; RE-DERIVED from the reference record across them, "
            "which is the stronger check of the two"
        )
        for problem in parity:
            print(f"  -> {problem}")
    else:
        # NEVER A BARE ZERO. This check compares sets to each other, and since the owner withdrew
        # the Qwen challenger there is one manifest on disk — so it returned clean because it was
        # handed one document, NOT because it looked and found nothing. Those two states produce
        # the identical exit code and the identical count, and this estate has spent a day finding
        # checks in the second one. The word is printed so that a reader scanning the output cannot
        # mistake an absent operand for a passing comparison.
        only = next(iter(documents), "the only set")
        print(
            f"===== prompt parity: DORMANT — {only} is the only set on disk, so this check has "
            "nothing to compare it against. It returned clean because it was handed ONE document, "
            "not because it looked and found nothing."
        )
        print(
            "      It is exercised against two-set fixtures by `python3 verify.py --self-test`, "
            "which CI runs before this command, so it is not a check that has quietly stopped "
            "being able to fail. Every other check in this file reads one manifest and its bytes, "
            "and is unaffected."
        )
    all_failures.extend(f"parity: {p}" for p in parity)

    trailer = f"\n{len(all_failures)} failure(s) across {len(chosen)} set(s)"
    if args.as_shipped:
        # Said out loud, because a red line under --as-shipped means something quite different
        # from a red line without it: the set is SOUND and would not be CONFORMANT if it shipped.
        # Reading it as "the candidate is broken" is how a real answer gets argued with.
        trailer += (
            " — graded AS SHIPPED, so conformance and completeness were fatal. A failure here "
            "means this set would turn the repository red if it were promoted, not that its "
            "manifest is untrue about its bytes."
        )
    print(trailer)
    return 1 if all_failures else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
