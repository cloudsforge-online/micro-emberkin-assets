# Emberkin art set

The 2D art for **Emberkin**, the estate's monster-collecting game: 83 generated images and 51
derivatives, every one of them made by **FLUX 2 Pro** on Azure AI Foundry and recorded in
[MANIFEST.json](MANIFEST.json) with the exact prompt that produced it, the model, the delivered
size, the checksum, the ground it arrived on, the post-processing applied and the number of times
it had to be regenerated.

**All of this artwork is AI-generated.** That is stated here, on every manifest entry, and in the
licence string carried by each asset.

**It is all 2D.** See §7 — the 3D creature models this game actually renders are a different
artefact entirely and are not produced here.

Design authority: [`ecosystem/24-asset-model-comparison.md`](https://github.com/cloudsforge-online/micro-docs/blob/main/ecosystem/24-asset-model-comparison.md)

---

## 1. What is here

```
assets/<set>/<slug>-<width>x<height>.png
```

| Set | Count | What |
| --- | --- | --- |
| `species/` | 50 at 1024, 50 at 256 | One portrait per Kin, plus a dex thumbnail resampled from it. |
| `types/` | 9 | The nine element icons, each a topologically different shape. |
| `biomes/` | 6 | Region key art, 1536x640. |
| `title/` | 10 | Mark, wordmark, capsule, hero, OG card (plus its as-delivered source), social banner, and the three favicons derived from the mark. |
| `ui/` | 12 | Eight glyphs and four frames, in the estate's ember accent. |

137 files, 83 of them generated and 54 derived. The set is defined by
`docs/ecosystem/19-new-products.md` §1.4; the per-Kin briefs are read out of
`kindred-upstream/content/{species,visuals,types,campaign}.json` and the art direction from
`kindred-upstream/docs/ART_BIBLE.md`. Neither is copied into this repository — `plan.ts` reads
them, and [PLAN.json](PLAN.json) is the reviewable result, written before anything is paid for.

## 2. How it was generated

`generate.ts` drives **`@cloudsforge/studio`'s own engine**, importing `backend.ts`, `specs.ts`,
`sizing.ts` and the licence constant from the sibling service verbatim. `studio/` is not modified.
Every verified fact about this endpoint already lives in those modules under test, and a second
copy here would be a second place for it to rot.

It deliberately does **not** reuse `studio/src/prompt.ts`. That module's art direction is "flat
geometric vector, one accent, no gradients" — correct for a software brand mark and wrong for a
creature. Fifty Kin drawn to it would be fifty logos. The creature direction is written instead
from the art bible's own pillars, and the parts of the brand voice that *do* apply — the ground,
the accent discipline on chrome, the lettering clause — are carried across explicitly, each marked
in the source with the defect it answers.

```bash
cd ../studio && node --import tsx ../emberkin-assets/generate.ts --plan     # PLAN.json only, free
cd ../studio && node --import tsx ../emberkin-assets/generate.ts            # everything missing
cd ../studio && node --import tsx ../emberkin-assets/generate.ts --force --only species/seedling
cd ../studio && node --import tsx ../emberkin-assets/generate.ts --limit 5  # a ceiling on spend
cd ../studio && node --import tsx ../emberkin-assets/generate.ts --derive-only

python3 normalise_ground.py --dry-run   # report the delivered grounds, change nothing
python3 normalise_ground.py             # snap every flat ground to #12100f
python3 verify.py                       # measure everything measurable
python3 verify.py --cvd                 # the colour-vision separation table
python3 sheet.py                        # contact sheets into review/
```

It runs from `studio/` so `tsx` resolves out of that workspace. **The Foundry key is read from
`../studio/.env.local`, held in one variable, and never written, logged or echoed** — not on
success, not in an error, not in a summary line. It is a spend credential. This repository
contains no credential and never should; `.gitignore` covers `.env*` and the tree and the whole
diff were scanned for the key before the first push.

Order of operations after a generation: **normalise, then derive, then verify.** The thumbnails
are cut from the normalised 1024, so deriving first ships fifty thumbnails on the wrong ground.

## 3. The two FLUX traps that cost this run the most

Both contradict what the documentation implies, both were verified by real requests, and both are
encoded in `studio/src/backend.ts` and `specs.ts` rather than remembered.

1. **`aspect_ratio` is accepted and silently ignored.** Only `width`/`height` are honoured. A
   parameter that is accepted and ignored is worse than one that is rejected, because nothing
   fails and the file looks plausible.
2. **`width`/`height` are floored to a multiple of 16.** `1200x630` comes back `1200x624`. So any
   size off the grid is requested rounded **up** and cut **down** — never upscaled, because a
   centre crop invents no pixel and an upscale softens a crisp edge. That is why the OG card ships
   as a 630 cut from a generated 640, with the as-delivered 640 kept beside it as
   `og-1200x640-asdelivered.png`.

A third, less a trap than a requirement: `model` is required in the body even though the path
names it, and the body spelling (`FLUX.2-pro`, with dots) differs from the path spelling
(`flux-2-pro`).

## 4. The ground

**FLUX will not reproduce an exact hex.** Across this run the grounds came back anywhere from
`#040404` to `#4c4c44` — 20 distinct values across 73 generated flat assets, against a target of
`#12100f`. Most were too light, several were neutral grey rather than warm ash, and, worse, they
were inconsistent *with each other*, so the set did not read as one set. On the app's real
background a portrait would have shown as a visibly lighter square.

Reprompting does not fix this reliably. It is a numeric property and it is corrected numerically:
`normalise_ground.py` remaps ground pixels to the exact value, leaves the artwork alone, and
blends the band between so anti-aliased edges do not acquire a halo. All 123 flat-ground files now
measure `#12100f` exactly, checked in all four corners by `verify.py` with no tolerance at all —
any deviation means the step did not run.

Key art, the capsule, the hero and the social banner are `scene`, not `flat`: they *are* pictures,
edge to edge, and snapping a sky to one hex would destroy the artwork rather than enforce a rule.
Those are held to a darkness ceiling on their edges instead, and the manifest says which rule was
applied to which file rather than implying one rule covered everything.

## 5. The colour lesson: verdant, umbra, and a motif that is not a colour

This is the defect that consumed most of this run's spend, and it took three separate corrections
to close.

`verify.py` measures every portrait's rendered hue against its own type anchor. Measured across
all fifty, **only two lines were out of tolerance** — which is the reason nothing else was
regenerated:

- **verdant** (`#5fce7a`, hue 135) came back 54 to 102 degrees *yellow* across all seven Kin;
- **umbra** (`#9a7bd6`, hue 260) came back essentially **black** on four of five, with Shadepup at
  0.13% ink — a creature invisible against its own ground.

Every other line sat inside 20 degrees.

**Correction one — one table, not two.** The colour words had already been rewritten once, in
`plan.ts`, and the rewrite did nothing: Seedling was regenerated against it and came back at hue
67 against 74 before. There were *two* copies of the nine words — `plan.ts`'s, which writes the
subject's opening noun, and a second in `generate.ts`, which writes the albedo clause. The albedo
clause is the loudest statement of colour in the prompt: capitals, the hex, a naming test, four
repetitions. Only the quiet copy had been corrected. There is now one table, split into a short
`name` and a `qualifier`, and `generate.ts` looks its entry up by hex.

**Correction two — a motif names a shape, never a colour.** All seven verdant Kin share one
silhouette motif, read verbatim from upstream `visuals.json`: *"leaf frills, bark plating"*. Bark
is brown, and a photographed leaf is yellow-green, so the model drew a brown creature with sage
leaves however the green was named. The same shape of defect explains three other failures:
frost's *"ice crystal spines"* is white, Stormcrow's *"hollow bones, streamer feathers"* is black,
and umbra's *"void-black core"* is black. Four defects, one cause. The albedo clause now states
what a motif is — shapes and materials, never colours — and that whatever material it names is
carved out of the creature and drawn in the creature's own colour. Frostkit went from 0.83% of its
image inside tolerance to 4.03%, at hue 189 against an anchor of 193, on that clause alone.

**Correction three — deepened means richer, not darker.** Seedling's two branch tips and Beetlord
then passed every measure — hue in tolerance, coverage above the floor, ground exact — and still
did not read as members of their lines: near-black silhouettes with green foliage hung on them,
beside bases that are solidly green animals. The cause was the final and apex stage directions,
which asked for the family colour "deepened FURTHER and enriched with darker shadow ramps". The
model reads *deeper* as *darker* and takes it to black. Both now say what deepening is for.

**And the word itself.** Naming an object drags the model to that object's photographic average,
which is the opposite of what the word is for. Measured, on the same prompt otherwise unchanged:

| verdant colour word | rendered hue (anchor 135) |
| --- | --- |
| "fresh leaf green" | 74 |
| "vivid mint-emerald green" | desaturated to grey |
| "bright emerald green" | 96 |
| **"bright jade green — halfway between emerald and teal, the green of a jade stone or a green traffic light"** | **132–134** |
| the above plus "SATURATED" | 103 |

`types/verdant` was the ninth type icon and the only one the hex alone could not carry: a leaf at
hue 87 from a prompt stating `#5fce7a` twice. The accent clause now names the colour as well as
numbering it. It renders at 149.

The rule all of this reduces to: **name the hue and its direction round the wheel, never an
object, and say so in every clause that mentions colour rather than only the quiet one.**

## 6. What is checked

`verify.py` runs six checks over all 137 files and currently reports **0 failures**:

1. **Completeness**, against `PLAN.json` rather than against itself.
2. **Dimensions** — the bytes must measure what the manifest declares.
3. **Checksum** — the file must be the file the manifest recorded. This repository rewrites its
   own files twice after generation, so it is the check most likely to catch a step that forgot to
   write back.
4. **Ground**, by class: exactly `#12100f` on flat, a darkness ceiling on scene edges.
5. **Not degenerate** — a file that is 99.5% ground is a blank, and a blank passes every other
   check on this list.
6. **Type is colour, and families read as families** — each portrait against its own anchor, and
   then each evolution line against *itself*, by the spread of its members' rendered hues.

The widest of the 24 evolution lines is Shadepup's at 24.1 degrees, against a ceiling of 45.

What is *not* measurable is judged by eye on the contact sheets `sheet.py` builds into `review/`
(gitignored — they are scaffolding for a judgement, not artefacts). `families.png` is one row per
evolution line, members in dex order, branch tips side by side, which is the exact comparison the
art bible's second pillar is written about and the one a dex-sorted grid almost makes but not
quite.

`verify.py --cvd` prints the nine anchors' separation under normal, protan and deutan vision. It
is **evidence, not a gate**: three of the nine are pale blues and two are yellows, and the hexes
cannot be re-picked because "type is colour" is a gameplay rule. The correction is applied on the
other channel — every type icon is a topologically distinct shape — and the table is how anyone
can check which pairs rely on that entirely.

## 7. Scope: this is 2D, and the 3D models are not this

**FLUX produces 2D images. Nothing in this repository is a 3D model, and no 3D asset was produced
by this run.** Every file here is a PNG.

Emberkin renders creatures in 3D, and those models are a wholly separate artefact: they are
**procedural glTF bakes**, generated by `kindred-upstream/web/tools/` — one `.glb` per species
built from its archetype template with per-species variation, referencing shared procedural PBR
texture sets, loaded at runtime through `GLTFLoader` and rigged by `userData.role` node bindings.
That pipeline is unchanged and remains the source of the game's 3D creatures.

What this set is for is everything a 3D bake does not give you: dex portraits and thumbnails,
element icons, region key art, store and social imagery, and UI chrome. Treat the portraits as
concept art and 2D presentation, not as reference the 3D pipeline consumes.

## 8. Provenance, C2PA and the watermark

Every image FLUX returns carries C2PA provenance and a Microsoft invisible watermark. **All 83
generated files carry it**, verified by reading the marker out of the bytes rather than assuming
it from the vendor. `normalise_ground.py` copies every ancillary PNG chunk through by hand, so
rewriting a ground does not destroy the provenance box.

The 54 derivatives — the dex thumbnails, the title favicons and the OG crop — are re-encoded by
Pillow, which has
never heard of a `caBX` chunk, so **they keep the invisible pixel watermark and lose the C2PA
box**. That is why every derivative names its source in `derivedFrom`, why the as-delivered OG
card is kept beside its crop, and why `c2pa` on a derivative reads `false`: it is measured on the
bytes written, not inherited. A file claiming provenance it no longer carries would be worse than
one that admits it.

Resizing is Pillow, not macOS `sips`. `design-system.md` §7 item 3 names `sips` as the reason the
estate's resize stage exists on exactly one laptop — which is also what lets `derive.py` and
`sheet.py` run in CI.

`seed` is `null` on every entry. This deployment of FLUX 2 Pro accepts no seed parameter, so **no
image here is exactly reproducible**; the field exists so that absence is recorded rather than
implied, and so a seeded model later has somewhere to put one. The prompt, model and endpoint are
recorded in full, so a run is reproducible in kind but not byte-for-byte.

Each entry records the licence as a constant imported from `studio/src/assets.ts` rather than free
text:

> `cloudsforge-generated: commercial use permitted; AI-generated, C2PA provenance retained`

The **artwork** is AI-generated and disclosed as such. The code in this repository is MIT.

## 9. What FLUX handled well, and what it did not

**Well:**

- **Creature appeal and silhouette.** Fifty Kin, and the base/mid/final read of size and menace
  came back essentially as specified. The branching lines — Cinderpyre into Flarelynx *or*
  Hearthmane — came back as siblings without being argued with.
- **Consistent style across a large set.** Fifty portraits that read as one game's art, which is
  the thing a grid answers and a single file cannot.
- **Wordmark lettering.** "Emberkin" is spelled correctly on the mark, the capsule and the social
  banner.

**Badly:**

- **Colour words that name objects.** The whole of §5.
- **Content refusals on the flavour line.** Six species were refused
  `content_safety_violation` on the first pass, all of them on the lore prose — Maelhound's "a
  savage hunter that corners prey in the crushing dark" and its like. A refusal is a 400 and the
  service correctly declines to retry a 400, so the flavour line is held *separately* from the
  subject and "the same prompt minus its flavour" is a request `generate.ts` can construct. The
  manifest records which variant produced each file. Re-issuing the same prompt unchanged also
  sometimes succeeds, which is recorded in the source as a measured finding rather than a theory.
- **A wide composition invites a frame.** `title/social` came back as a rounded-cornered banner
  floating on a **white page** — a picture *of* a social card rather than the card's artwork, with
  its edges 97% white against a 12% ceiling. The scene style now says the painting *is* the file.
- **Run-to-run variance on a marginal asset.** Beetlord needed five rolls of an unchanged prompt
  to clear the coverage floor. When a prompt is right and the output is not, re-roll; when the
  same defect appears across a whole line, it is the prompt.

## 10. What the run cost

83 images shipped, from **129 generations** — 46 of them retries across 24 assets, of which 37
were spent in this repair pass on the verdant and umbra lines and the four assets that failed
alongside them. At the provider's flat 3 units an image that is roughly 387 units of spend for 249
units of kept artwork.

The three-correction sequence in §5 was found by trial generations of **one asset at a time**
before any line of seven was regenerated, which is why the repair cost 37 calls rather than the
150 a "regenerate everything and look at it" pass would have cost. Measure first, regenerate the
measured failures, and re-measure.

## 11. Reproducing

`generate.ts` imports from the sibling `studio/` checkout and `plan.ts` reads
`../kindred-upstream/content`, so **this repository is not self-contained: a *run* needs those
checkouts beside it.** The *artefacts* are self-contained — the PNGs, `MANIFEST.json` and
`PLAN.json` carry everything needed to audit what was made and from what.

`normalise_ground.py` and `verify.py --cvd` are pure standard library. `derive.py`, `sheet.py` and
the rest of `verify.py` need Pillow. Nothing here has `node_modules` of its own.

---

## Provenance

The code in this repository was written by **Claude Opus 5** and **Claude Fable 5**, under
human direction and review.

The shipped art was generated with **FLUX 2 Pro** (`flux-2-pro`). Comparison sets generated
with **Qwen-Image 2512** (`qwen-image-2512`) live under `candidates/` and are never shipped.
