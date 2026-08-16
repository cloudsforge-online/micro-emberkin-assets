# How the models were judged — Emberkin

> ## ONE EVALUATION CONCLUDED. A SECOND ONE IS OPEN.
>
> **This banner covers the Qwen-Image 2512 comparison only, and it is closed.** A second
> challenger — **gpt-image-2** — was generated against this set in full afterwards, is on disk at
> `candidates/gpt-image-2/`, and its evaluation is the last section of this file. Read that section
> before treating anything below as the current state of the repository: three of the sentences in
> this banner were true of a repository holding one set and are not true of one holding two, and
> they are corrected in place rather than left to be discovered.
>
> **FLUX 2 Pro ships.** The Qwen-Image 2512 challenger was generated against this set in full,
> measured against every criterion below, and lost. A second pilot in a `positive` prompt dialect
> was run to test whether the verdict was partly an artefact of this estate's own prompt style;
> it was not. **The owner has since withdrawn Qwen-Image 2512 from the estate, and this
> repository's `candidates/qwen-image-2512/` and `candidates/qwen-image-2512-positive/` trees,
> their manifests, their deployment records and their two registry entries have been deleted.**
>
> **Every Qwen figure below was measured off that challenger's bytes while those bytes existed, and
> is now history rather than something you can re-derive.** `compare.py` cannot reproduce those
> columns — it reads manifests, and Qwen's two are gone. So the numbers it last printed have been
> transcribed into the *"transcribed before the sets were deleted"* section, because deleting 741
> images across the estate must not delete the reason the estate chose what it chose. **That
> section, and only that section, is the transcribed one.** The gpt-image-2 section after it is
> live: both manifests are on disk and `python3 compare.py` reprints every figure in it on demand.
>
> **What survived the deletion and can still be checked today:** `review/compare/artefacts.json`,
> the by-eye defect tally with its scope stated; the recorded literal prompts in `MANIFEST.json`;
> `claims.py`, which still re-derives every figure in this file that has a live source; and the
> provider seam itself — `providers.json`, `backends.ts`, the dialect registry and `verify.py`'s
> `check_parity` — kept whole because the estate has a stated 3D and animation gap FLUX cannot
> fill and a next challenger is a question of when rather than if. **Keeping the seam is what made
> the second evaluation an afternoon's work rather than a rewrite**, which is the strongest
> argument this file can offer for the decision it records.
>
> **One consequence was stated here because it is easy to miss, and the second challenger has since
> undone it.** `check_parity` compares sets to each other; with the Qwen trees deleted there was one
> set left, so it went DORMANT and returned clean because it had been handed one document.
> `verify.py` printed that word on every run instead of a zero, and `verify.py --self-test` proved
> on every CI run that it still failed when given something to fail on. **It is LIVE again today**
> — two sets on disk, and the last run reports `prompt parity across 2 sets: 0 disagreement(s)`.
> The distinction the paragraph was written to make still matters and is worth keeping in view: a
> zero from a comparison that happened and a zero from a comparison that did not are the same
> character, and only one of them is a result.


The criteria are estate-wide and are stated in full in **`micro-brand/COMPARISON.md`**. This file
records what is specific to this set, and the baseline numbers a challenger is measured against.

**Every count below is re-derived by `python3 claims.py`**, which reads the figure out of this file
and recomputes it from the manifests, the dialect registry and the scored artefacts. It is here
because two figures in the positive-dialect section were wrong and had been wrong in BOTH game
repositories at once: the paragraph was copied from one to the other and brought its numbers with
it. Idea drift was stated as 2 of 15 where the three repositories' own scored artefacts sum to 1,
and "74 of them here" was true of emberkin and not of aetherholm, where it is 92. A number a
document carries and nothing recomputes is a number waiting to be copied somewhere it is false.

The criteria were written **before** a challenger set existed, which is the only time criteria
can be written honestly. Once the images are on screen it is very easy to discover that the
thing the winner happens to be good at was the thing that mattered all along. They are left in
the tense they were written in, and the verdict is kept separate from them, because rewriting a
criterion after the result is the one thing this document exists to prevent.

## What is compared here

137 manifest entries: **83 generated** and **54 derived**. Only the 83 are compared. A
derivative is a deterministic Pillow operation on this provider's own output — running it against a
candidate set costs nothing and tells you nothing about the model, and asking a model for one
separately would break the relationship the `derivedFrom` column asserts.

Sets: `species, types, biomes, ui, title`.

## The set-specific coherence question

Coherence within the set is the criterion that matters most and the hardest thing for an image
model, and it matters *more* in a two-way comparison, not less: with a single challenger, "which is
better" collapses into a per-asset beauty contest unless the set-level judgement is doing real work.

Emberkin's own question: its species sheets are evolution LINES. Its verifier already fails a line whose members' rendered hues span more than 45 degrees, because the art bible's rule is that an evolution deepens and enriches a palette rather than recolouring it. That is a coherence test no other set in the estate has, and it is the sharpest single question to put to a challenger here.

**Judged within this set only.** The estate's three asset sets are deliberately unalike — a flat
geometric brand system, Emberkin's species sheets, Aetherholm's painterly islands. A model that
makes any two of them look like each other has failed rather than succeeded, and there is no
cross-repository coherence number.

## The baseline, measured

`python3 compare.py` against the reference set today:

| | FLUX 2 Pro |
| --- | ---: |
| generated | 83 |
| cost | **250.5 provider image units** |
| assets needing at least one retry | 24 of 83 |
| C2PA carried, measured off the bytes | see `compare.py` §5 |

**A number that is not what it looks like.** Summing `providerCostUnits` across the whole manifest
double-counts, because a derivative inherits its parent's cost so a reader can see what the file
behind it cost. `compare.py` sums over generated entries only, which is why the figure above is
250.5 rather than the larger number a naive sum produces.

## Cost, and why the two figures are not comparable

FLUX bills **per image**. A Managed Compute deployment bills **per hour of existence**, whether or
not it generates anything — so `compare.py` prints each in its own unit and derives no per-image
figure for a per-hour provider. A per-image figure there would be a statement about how well the
run was organised, not about the model: run the same set twice, once starting the moment the
endpoint went healthy and once the next morning, and it differs by an order of magnitude with
byte-identical output.

This is already concrete. Cosmos 3 Super billed for its entire deployment lifetime and produced
**zero images**, because it never came up.

## Known asymmetries

1. **This set is not internally prompt-uniform.** Most recorded assets carry a prompt the current
   clauses no longer derive, because they were edited after the run. Parity is still exact, because
   it is *per asset*: a candidate replays the string that asset was actually generated from. But a
   challenger that beats the reference on an asset generated before a hardening clause has beaten a
   slightly easier opponent.

2. **`c2pa` is measured off the bytes, never asserted.** Whether a challenger emits C2PA at all is
   unknown and will be recorded as measured. A candidate set with no C2PA is a legitimate finding;
   one *claiming* C2PA it does not carry is a defect this estate has already shipped once.

3. **Delivered dimensions may not floor the same way.** FLUX floors each dimension to a multiple of
   16. That arithmetic is FLUX's, measured, and must be re-measured per provider before reuse.

4. **A text encoder may silently truncate.** These prompts are long and their prohibitions are
   deliberately last. A model with a small token budget receives the opening and discards them —
   and the comparison would read that as a style failure rather than as truncation. Probe it before
   the run.

5. **Nothing here counts providers, and that is why the seam outlived the challenger.** The
   comparison was briefed three-way, ran two-way because Cosmos 3 Super failed to deploy, and
   is one-way today because the owner withdrew Qwen-Image 2512. The registry, the backend
   interface, the dialect seam and the parity check are all kept: the estate has a stated 3D
   and animation gap FLUX cannot fill (`docs/ecosystem/19-new-products.md`), so reinstating
   them for the next challenger would be a rewrite rather than an edit. What was deleted with
   the model is only what could not outlive it — its OpenAI-images envelope, and the
   transposed-`size` compensation written for that one endpoint's bug. The transposition
   DETECTION is kept and is not specific to any model.

## The positive dialect: was the verdict partly our prompt style?

Everything above is one controlled experiment — every model replays the recorded prompt byte for
byte — and it answers **"which model is better on identical input"**. The truncation probe raised a
second question it cannot answer.

**Qwen does not truncate.** It receives the prohibitions in full and disregards them while honouring
the positives, so the prohibition-last technique this estate built against FLUX does not transfer.
These briefs are heavy with prohibitions, which would make them close to the worst possible shape of
brief for it — and the framing and bevelling above would then be partly OUR failure, not the model's.

**The hypothesis: restating the prohibitions as positive assertions fixes the defects.**

### How a second prompt style exists without weakening prompt parity

A **dialect** is a named, deterministic, total function from the prompt on record for an asset to
the prompt a set is actually sent. `literal` is the identity transform, has zero rules, and is what
every set above was generated in. `positive` is one ordered rule list in `dialects.json` — the same
file, byte for byte, in all three asset repositories — read by both `dialects.ts` and `dialects.py`,
which is the one-file-two-loaders arrangement `providers.json` already uses.

Parity is enforced **within** a dialect exactly as before, and **across** dialects by
**re-derivation**, which is *stronger* than the equality it replaces: a candidate's recorded prompt
must be exactly what its dialect's rules produce from the reference's own record, and `verify.py
--parity` fails on one differing byte. Equality could only say *"these two strings differ"*;
re-derivation says *"this string is not what this dialect produces from the record"*, which catches
a hand-edited prompt, a rule added after a run, and a set whose declared dialect is not the one it
was generated in.

A candidate still cannot invent an asset the reference has never generated — the transform's input
IS the reference record. `--reprompt` is refused outside the literal dialect. And "positive" is
measured rather than claimed: the dialect declares the vocabulary it forbids itself, the result is
scanned for it on word boundaries, and a prompt that still carries any **cannot be sent at all**.
Every prompt in this pilot passed at zero residuals.

`qwen-image-2512-positive` differs from `qwen-image-2512` in one field — same model, same
deployment, same route, same key, same concurrency, asserted by test — so a difference in output has
exactly one available explanation. The FLUX set and the existing Qwen set are byte-identical.

### The restatement

*"Flat fills only: no gradients, no bevels, no drop shadows, no glow, no 3D"* became *"Flat fills
only: this is a vector graphic of the kind an SVG file holds. Every shape is one single solid block
of colour, exactly the same value at its centre as at its rim, and every edge is a hard boundary
where one flat colour stops and the next flat colour begins."*

*"Draw only the subject itself: no construction lines, no grid, no guides, no ruled margins, no
border, no frame, no bounding box"* became *"Draw only the finished subject: the subject and the
flat field are the whole of the image, and the subject's own outline is the only edge anywhere in
the frame."*

*"It is not standing on anything: no floor, no platform, no pedestal, no cast shadow"* became *"The
subject floats free: the #12100f field continues unbroken beneath it and on all four sides of it,
right up to its outline, so the last pixel outside its edge is #12100f and the first pixel inside is
the accent."*

The subject sentence is carried through untouched wherever it holds no prohibition, which is what
keeps the two dialects two phrasings of one brief rather than two briefs.

### The result, and why phase 2 was not run

The full 15-asset pilot and its measurements are in `micro-brand/COMPARISON.md` §9. This
repository's share is scored into `review/compare/artefacts.json` beside the other two columns, on
the same taxonomy and the same assets.

**The hypothesis is rejected.** Across all 15 pilot assets, framing survived at 15 of 15 and
non-flat rendering at 15 of 15 — against a brief containing *not one prohibition word*. That is the
model's register. It is not truncation and it is not a misread brief: we asked in the negative and
it framed everything, we asked in the positive and it framed everything.

Positive phrasing did do two things. Construction guides went to zero, and both assets flagged as a
different class of failure came back on-subject — a recursive grid of picture frames became a single
framed shape, and a Hokusai pastiche became a plain wave curl. And it made one thing worse: idea
drift rose from 1 of 15 to 8 of 15, because restating a shape prohibition as a positive description
hands the model more shape vocabulary and it elaborates on it.

**What `verify.py` said about all three sets, on the last run that could see them.** Zero
failures in each: the shipped set, the complete literal-dialect challenger, and this
repository's 9 assets of the pilot. The positive-dialect set is a
15-asset pilot, not a whole set, spread across the three repositories, so the verifier
reported the rest of the plan as un-generated. That reads as "planned but never generated" and is the
check doing its job on a deliberately partial set, not a defect in the set. Prompt parity,
checksums, dimensions and C2PA passed at zero failures across all three.

**And that run is the last one there will be.** With the candidate trees deleted the verifier
reads one manifest, so `check_parity` has nothing to compare and prints DORMANT rather than a
zero — see `verify.py`'s header. The zero above was a comparison passing; the zero today is a
comparison not happening, and the two must not be spelled the same way.

Phase 2 — all 235 in this dialect — was **not** run. It would have spent a deployment lifetime to
confirm a negative already established at 15 of 15 with no variance. Stopping was the finding,
and the verdict is unchanged and now final: **FLUX, decisively.** The dialect machinery is left
in place — `dialects.json`, `dialects.ts`, `dialects.py` and the cross-dialect re-derivation in
`check_parity` are untouched — because it is estate code shared byte-for-byte with the sibling
repositories and the question it was built to ask is about prompting in general rather than
about one vendor. The recorded literal prompts remain the corpus, whenever there is a second
model to put them to.

---

## What the comparison measured, transcribed before the sets were deleted

`compare.py` produced these columns from the three manifests and the delivered pixels. Two of those
manifests no longer exist, so the tool cannot print this again and the last run it did print is
copied here verbatim. **Nothing in this section is re-derivable and `claims.py` does not pin it** —
that is stated rather than hidden, because a figure that outlives its source and keeps a confident
tone is exactly the defect `claims.json` was written after.

**The third column is a DIFFERENT PROMPT DIALECT** and is not a controlled comparison with the
first two. It answers "which is better when each is prompted the way it wants", which is a
different question from "which is better on identical input". It is scored on the same taxonomy
and the same assets, which is what makes it readable at all.

### 1. Prompt adherence

|  | FLUX 2 Pro | Qwen-Image 2512 | Qwen positive |
| --- | ---: | ---: | ---: |
| ground off-target (>0.12 luma) | 0 | 0 | 0 |
| median ground luma | 0.0053 | 0.0039 | 0.0150 |
| below the accent floor | 2 | 2 | 1 |
| nearly blank | 0 | 0 | 0 |
| delivered size != declared | 0 | 0 | 0 |

Set sizes at the time of the run: FLUX 137 entries (83 generated), the literal
challenger 134, the positive pilot 9.

### 2. Style coherence within the set — spread, not average; lower is one hand

|  | FLUX 2 Pro | Qwen-Image 2512 | Qwen positive |
| --- | ---: | ---: | ---: |
| accent lightness: bias | -0.109 | -0.363 | -0.252 |
| accent lightness: SPREAD | 0.128 | 0.134 | 0.197 |
| accent hue error: mean deg | 7.6 | 7.7 | 9.2 |
| accent hue error: SPREAD | 6.4 | 5.2 | 7.4 |
| ink coverage spread (in-kind) | 0.1030 | 0.1140 | 0.1946 |
| ground luma spread | 0.0063 | 0.0073 | 0.0077 |
| KB per megapixel (median) | 492 | 1275 | 851 |

**The confound, restated so the table is not over-read.** The reference set has had
`normalise_ground.py` run over it and a candidate set as generated has not, so the ground-luma row
is NOT a like-for-like model comparison; the honest reading is each candidate's absolute figure on
its own. The accent, ink and KB/MP rows are unaffected — normalisation rewrites near-ground pixels
only. KB per megapixel is a proxy and not a verdict: flat geometric art compresses hard and
photographic texture does not, so a large gap means the two models answered one brief in different
REGISTERS, which is what criterion 2 cares about most.

### 3. Legibility at the size the asset is used at

|  | FLUX 2 Pro | Qwen-Image 2512 | Qwen positive |
| --- | ---: | ---: | ---: |
| median contrast retained at 32px | 81% | 79% | 87% |
| median contrast retained at 16px | 69% | 68% | 77% |
| marks under 50% at 16px | 9 | 5 | 2 |

### 4. Artefact rate, tallied by eye

Scored over all 9 `types` icons of each set, scored row by row off `review/compare/compare-types.png` — a complete set, not a sample.

|  | FLUX 2 Pro | Qwen-Image 2512 | Qwen positive |
| --- | ---: | ---: | ---: |
| frame / border / bounding box | 0 / 9 | 9 / 9 | 9 / 9 |
| ground not the flat ash field | 0 / 9 | 4 / 9 | 4 / 9 |
| idea not recognisable from plan.ts | 0 / 9 | 1 / 9 | 4 / 9 |
| non-flat rendering (3D, bevel, gradient, glow, texture) | 0 / 9 | 9 / 9 | 9 / 9 |
| recognisable pastiche of an existing artwork | 0 / 9 | 1 / 9 | 0 / 9 |

### 5. Retries and disclosure, free from the manifests

|  | FLUX 2 Pro | Qwen-Image 2512 | Qwen positive |
| --- | ---: | ---: | ---: |
| assets needing >= 1 retry | 24 / 83 | 0 / 83 | 0 / 9 |
| total retries | 46 | 0 | 0 |
| failed attempts logged | 0 | 8 | 0 |
| carries C2PA, measured off the bytes | 83 / 137 | 0 / 134 | 0 / 9 |

### 6. Cost, in the unit each model billed in

These are **not the same number** and were never added, averaged or divided into each other.

- **FLUX 2 Pro:** **250.5 provider image units** over 83 generations, 3.02 per image, 54 derivatives free.
- **Qwen-Image 2512:** deployment hours. **No per-image figure exists or was invented** — the
  endpoint returned `quality` and `usage` as null, so there was no per-image signal at all.

  The deployment record was deleted with the candidate tree, so what it measured is transcribed
  here rather than left as a dangling path. One `GlobalManagedCompute` deployment at capacity 1,
  named `qwen--qwen-image-2512`, served **all three asset repositories one after another**, so its
  hours are joint and cannot be attributed to this repository alone — there is no non-arbitrary way
  to split them and `compare.py` refused to try.

  **Creation time: never observed, and deliberately never guessed.** The deployment existed before
  the run began and ARM exposes no creation timestamp for a project-scoped managed-compute
  deployment, so its true billed lifetime is LONGER than any window recorded here. Writing a
  plausible timestamp would have turned an unknown into a figure somebody would later quote.

  | | literal-dialect run | positive-dialect pilot |
  | --- | --- | --- |
  | window, first to last generation | 07:43:31Z to 08:25:31Z | 10:57:49Z to 10:59:33Z |
  | observed working hours | 0.7 | 0.03, and MARGINAL |
  | generations in the window, all three repos | 233 | 15 |
  | this repository's share | 83 | 9 |
  | mean seconds per generation | 10.8 | 6.8 |

  All times 2026-08-03. The 0.7 hours **exclude provisioning and warming, which are billed**: the
  endpoint returned `500 Model service is unavailable` for at least 17 minutes of observed probing
  before it served anything. The pilot's 0.03 is marginal hours over a deployment that was already
  running and already billing — that cuts both ways and must not be quoted as "the experiment was
  free". It was free only because a deployment nobody could delete was already burning.

  **It was not torn down from here, and the record says so rather than showing a closed bill.** A
  `GlobalManagedCompute` deployment on an AIServices account is project-scoped and none of three
  routes reached it: the ARM account-level deployments collection listed only `claude-opus-5` at
  every api-version tried; the project-scoped ARM path answered `500 InternalServerError` on both
  GET and DELETE; the data-plane path was 200 on GET and 404 on DELETE. Deleting it required a
  human in the Azure AI Foundry portal, and it was confirmed still present at 08:30:17Z.

**The operational finding is worth more than either number.** The challenger ran on dedicated
hardware and was idle for most of its billed life, because a candidate may only be generated once
the reference set it replays is complete. That is a fact about how the comparison had to be
sequenced, not about the model, and it is the reason a per-hour provider must never be given a
per-image figure.

---

## The second challenger: gpt-image-2, on the same 83 assets

Written after everything above and scored against it unchanged. Nothing here reopens a criterion,
reweights one or adds one, because the entire value of fixing them before the images existed is
spent the first time a result is allowed to edit the rubric.

**The short version, and it is not a single winner.** gpt-image-2 wins this set's own sharpest
question — evolution-line coherence — by a distance, wins colour fidelity outright, and wins the
`ui` kind on sight. It loses the `types` kind on a register the rubric has no row for, loses the
favicons that are cut from `title/mark`, and its `biomes` are darker and less legible than the
shipped set's. Read the verdict before quoting a row out of the tables.

### What was run, and what it cost to find out

| | |
| --- | --- |
| model | `gpt-image-2`, OpenAI, served by Azure AI Foundry |
| adapter | `openai-images` in `backends.ts`, shared byte-for-byte with the sibling repositories |
| dialect | `literal` — the identity transform, so every prompt is the reference record replayed byte for byte |
| concurrency | **1**, measured rather than chosen for caution: two back-to-back requests return `429 RateLimitReached, "Please retry after 32 seconds"` |
| set | `candidates/gpt-image-2/`, its own `MANIFEST.json`, its own `native/` |

The candidate set holds the same 137 entries as the reference: 83 generated, and the same 54
derivatives — 50 dex thumbnails, 3 favicons and 1 `og` crop — cut by `derive.py` from its own
output rather than asked for separately.

`verify.py` reports **0 disagreements across 2 sets** on prompt parity, which is the precondition
for everything below: the two models answered the same question character for character, so any
difference in the output belongs to the model. Both sets are the `literal` dialect, so parity here
is exact string equality *and* re-derivation from the reference record, and either alone would have
been enough.

**Sixteen of the 83 could not be requested at their declared size, and none of them were upscaled.**
This deployment enforces a minimum pixel budget no documentation states; it was bisected to
(524288, 655360]. Everything at 512x512 (262,144 px), 512x256 (131,072 px), 1024x384 (393,216 px)
and — exactly on the boundary — 1024x512 (524,288 px) falls under it. Those 21 entries are generated
at an exact integer-factor multiple on the required 16-grid (1024x1024, 1280x640, 1536x576,
1536x768), **Lanczos-downscaled** to the declared size, and the as-delivered native is kept at
`candidates/gpt-image-2/native/` and recorded on the entry in four columns (`nativePath`,
`nativeSize`, `nativeSha256`, `nativeC2pa`). `verify.py`'s `check_native` fails any entry whose
native is *smaller* than its declared size, so the one thing this arrangement could be used to hide
— an upscale reported as a generation — is the one thing it is checked for on every run.

**Billing is in a third unit.** `usage.output_tokens`, per image, varying with size and quality.
It is per-image accounting like FLUX's cost units, so `compare.py` takes the per-image path — but an
output image token and a provider image unit are not convertible without two price lists this
repository does not hold, and the rule above stands unchanged: report each in its own unit, never
add them, and take the money question to the invoices. `compare.py` now branches on
`billing.basis` rather than on `billing.unit`, because a third unit is exactly what a unit-string
branch breaks on: before the fix it printed `UNKNOWN` for this provider and demanded a
`DEPLOYMENT.json` that a serverless endpoint will never have.

### The ground confound, which is REMOVABLE here and was removed

Every comparison above carries a caveat: the reference set has had `normalise_ground.py` run over it
and a candidate set as generated has not, so the ground rows are not like-for-like. **In this
repository that caveat does not have to be lived with.** `normalise_ground.py` here copies ancillary
PNG chunks through — it is one of the files `providers.json`'s `shared.perRepository` block names as
deliberately *not* identical across the estate, and this is the reason — so snapping a ground does
not destroy a C2PA box. The script was given a `--provider` flag on this branch, the candidate was
normalised exactly as the reference was, and both columns below are post-normalisation.

**What that flag cost, and it is worth stating because the sibling repository could not do this.**
Before the flag, `normalise_ground.py` hardcoded `Path("assets")`. Running it for any reason would
have rewritten **the shipped set**. In `micro-brand` the same script does not preserve ancillary
chunks, so normalising a candidate there would have destroyed the provenance the comparison then
measures, and that evaluation had to leave the confound in place and argue around it.

**What the models actually delivered, before either was touched** — the `deliveredGround` column,
recorded at generation time over the 73 flat-ground assets:

| | distinct delivered grounds | range |
| --- | ---: | --- |
| target | 1 | `#12100f` |
| FLUX 2 Pro, as delivered | 21 | `#040404` to `#fcfcfc` |
| gpt-image-2, as delivered | 5 | `#040404` to `#0c0c0c` |

FLUX's spread includes a *white* ground. gpt-image-2 misses the target in one direction only — every
delivery is too dark, most of them at `#0c0c0c`, which is a **bias rather than a spread**, and the
coherence criterion says in as many words which of those two matters. On raw delivery the challenger
holds the brand ground about four times more consistently than the reference did.

### What was looked at, by eye

The measurements are in the next section. This is the half of criterion 1 that no measurement
speaks for, scored off the sheets `compare.py` rebuilt for this run: all 9 `types`, all 12 `ui`, all
6 `biomes`, all 9 `title`, and four species evolution lines beside each other stage by stage.

**The one finding that explains most of the others: gpt-image-2 draws OUTLINES where this set's flat
assets are filled.** All nine `types` icons and most of the `ui` glyphs come back as uniform-weight
strokes around an empty ash interior. `plan.ts` says "solid" or "filled" in so many words for
`ember`, `lumen`, `umbra` and `stone`, so those four are flat adherence misses; the rest is a
register the brief neither asks for nor forbids. Where the asset *is* an outline by nature the
register is exactly right, and where it is a silhouette it is wrong.

- **`types` — the reference wins, and the brief is partly to blame.** FLUX draws solid fills. It
  also draws a muted bone ground bar under six of the nine, and only `ember` asks for one.
  gpt-image-2 draws no bar at all — including under `ember`, where it is specified. So each set
  misses the same requirement from opposite directions, one over-applying it six times and the other
  under-applying it once. The brief contradicts itself here: *"It is not standing on anything … no
  horizon line"* sits a few lines from *"The only permitted exception is a ground line … muted bone
  `#b7ae9b`"*. Both readings are defensible, the fix is to the brief rather than to either set, and
  a candidate evaluation is forbidden from touching a recorded prompt.
- **`ui` — the challenger wins it outright, and it is the clearest kind in either set.** Eleven of
  the twelve are frames and glyphs, which are outline work by construction, and the challenger's
  register is simply correct for them. Its `frame-battle-hud`, `frame-dialogue` and `frame-portrait`
  are symmetric double-ruled panels of one stroke weight; the reference's carry stray corner ticks,
  a stray bone underline and visibly varying weight. `frame-button` is the sharpest case: the
  reference returns a **solid filled parallelogram** — a button frame with no hole in it — where the
  challenger returns an octagonal outline you could put a label inside. `glyph-sync` is two clean
  interlocking rings against an arch-and-rings hybrid with a bone bar under it; `glyph-party` is a
  symmetric triangle of three nodes against a skewed perspective one. The one it loses is
  `glyph-temperament-harmony`, where the reference's two solid arcs read at a glance and the
  challenger's thin outlined arc is nearly empty.
- **`title/mark`, and therefore the three favicons cut from it — the reference wins.** The mark is
  the one flat asset in this set that has to survive being shrunk to 32 pixels, and the challenger
  drew it as an outline. At 512 and 192 it is a clean hollow ember-and-anvil form; at 32 the
  interior is gone and what is left is a ring with a smudge in it. The reference's filled mark keeps
  a legible silhouette all the way down. `compare.py` names `title/favicon-192x192` and
  `title/favicon-512x512` among the challenger's weak marks at 16px and names no reference favicon
  at all, which is this by-eye finding arriving independently through a measurement.
- **`title` lettering — a tie on correctness, and the challenger's type is further from the
  estate's.** Five title assets carry the word "Emberkin" and both sets spell it correctly in all
  five, which is worth recording because wide lettered compositions are this brief's known weak
  point. The challenger sets it in a warm gold serif with wide, light tracking; the reference in a
  bolder rounded sans. The serif is prettier at full size and thinner at small size, and it is not
  the estate's type.
- **`biomes` — the reference wins, and this is the challenger's worst kind.** The challenger's key
  art is consistently darker and more saturated: `emberfall_vale` becomes a molten crater under an
  orange sun rather than floating islands with lava veins, and `galecrest` loses its bridges and
  spires into near-black. Two of them are genuinely better — `lumen_core` is a striking golden
  amphitheatre and `tidalreach` a far more convincing frozen wave — but a biome plate is a
  background that other things are read against, and the reference's lighter, hazier plates do that
  job and the challenger's compete with it. `compare.py` puts `biomes/sunken_cathedral` below its
  accent floor for the challenger and `biomes/galecrest` for the reference, so each set has two
  under the line and they are not the same two.
- **`species` — the challenger wins the set-level question and loses some of the individual ideas.**
  Line by line the challenger is unmistakably one family: its whole `seedling` line is one saturated
  green across all four stages, where the reference drifts from sage-grey through teal. That is the
  criterion this set says matters most, and it is not close. What it costs is material variety. The
  reference's `cindercub` is a charcoal kitten with lava glowing through the cracks — ash *and*
  ember, which is what the name means; the challenger's is a bright orange kitten, which is only
  ember. Its `bloomward` and `bramblejaw` are both green leafy bipeds and are harder to tell apart
  than the reference's quadruped and dragon. **The challenger buys line coherence partly with
  material range**, and both halves of that sentence are true.

### What `compare.py` measured, over all 137 entries

Unlike the transcribed section, **this table is live**. Both sets are on disk, both manifests are
complete, and `python3 compare.py` reprints every figure below on demand.

#### Prompt adherence

| | FLUX 2 Pro | gpt-image-2 |
| --- | ---: | ---: |
| entries in the set | 137 | 137 |
| generated, the rest derived | 83 | 83 |
| ground off-target (>0.12 luma) | 0 | 0 |
| median ground luma | 0.0053 | 0.0053 |
| below the accent floor | 2 | 2 |
| nearly blank | 0 | 0 |
| delivered size != declared | 0 | 0 |

Identical on five of seven rows, including the ground rows — which is the point of the previous
section: with the candidate normalised the same way the reference was, the ground stops being a
confound and becomes a tie.

#### Style coherence within the set — spread, not average; lower is one hand

| | FLUX 2 Pro | gpt-image-2 |
| --- | ---: | ---: |
| accent lightness: bias | -0.109 | -0.155 |
| accent lightness: SPREAD | 0.128 | **0.088** |
| accent hue error: mean degrees | 7.6 | **4.2** |
| accent hue error: SPREAD | 6.4 | **4.5** |
| ink coverage spread (within kind) | 0.1030 | **0.0910** |
| ground luma spread | 0.0063 | **0.0012** |
| KB per megapixel (median) | 492 | 791 |

**The challenger wins every spread row.** It is darker on the accent than the reference is
(-0.155 against -0.109) and more consistent about it, which is the bias-versus-spread distinction
this criterion was written around.

**KB per megapixel is the one row that goes the other way, and it is not evidence of the failure it
was written to catch.** A gap of that size convicted the previous challenger of answering a
flat-vector brief in a photographic register — but 62 of these 83 are *supposed* to be painted
(46 species portraits, 6 biome plates, 9 title pieces, and a set of dex sheets), and the by-eye
tally finds no bevels, gradients, glows or three-dimensional forms in the 21 that are supposed to be
flat. What explains it is the register finding above with its sign reversed: an outline drawing on a
flat field has more edge per unit area than a filled one, and edges are what a PNG cannot compress.

#### The evolution-line question, which is this set's own criterion

The art bible's rule is that an evolution deepens and enriches a palette rather than recolouring it,
and `verify.py` fails any line whose members' rendered hues span more than 45 degrees. This is the
one criterion no other set in the estate has, and it is the one this comparison was always going to
turn on. Fifteen of the 24 families have more than one member and can therefore drift at all:

| line | members | FLUX 2 Pro | gpt-image-2 |
| --- | ---: | ---: | ---: |
| seedling | 4 | 38.6° | **8.8°** |
| shadepup | 3 | 24.1° | **6.6°** |
| breezlet | 3 | 17.2° | **2.4°** |
| frostkit | 3 | 13.6° | **5.0°** |
| finnling | 2 | 10.4° | **2.0°** |
| tidepup | 4 | 9.9° | **4.7°** |
| oreling | 3 | 8.5° | **4.4°** |
| mossbug | 2 | 2.8° | **1.1°** |
| coalcrawl | 2 | 2.6° | **1.5°** |
| zaplet | 2 | **2.3°** | 7.2° |
| pebblit | 3 | 2.2° | **1.9°** |
| snowseal | 2 | **2.0°** | 4.1° |
| cindercub | 4 | **1.8°** | 3.0° |
| gleamoth | 2 | **1.1°** | 1.6° |
| joltmouse | 2 | 1.0° | **0.3°** |
| **worst line in the set** | | **38.6°** | **8.8°** |
| **mean over the fifteen** | | 9.2° | **3.6°** |

**Eleven of fifteen to the challenger, and the four it loses are all small.** The widest margin
against it is 4.9 degrees on `zaplet`, where it tips the `stormcrow`'s wings in blue and the
reference keeps the whole line gold. The widest margin *for* it is 29.8 degrees. Neither set fails
the 45-degree ceiling, so this is not a pass/fail row — but the reference's worst line sits at 86%
of the ceiling and the challenger's at 20%, and that is the difference between a rule that is being
respected and one that is being scraped past.

`cindercub` is the interesting loss and it is the same finding as the by-eye note: the reference's
ash-bodied, ember-veined cubs are a *wider* hue span precisely because they are two materials, and
the challenger's tighter number is bought by drawing one.

#### Legibility at the size the asset is used at

| | FLUX 2 Pro | gpt-image-2 |
| --- | ---: | ---: |
| median contrast retained at 32px | 81% | **84%** |
| median contrast retained at 16px | 69% | 69% |
| marks under 50% at 16px | **9** | 12 |

**A genuinely mixed row, and the split is the outline register again.** The challenger holds more
contrast at 32px and ties at 16px, and it still puts three more marks under the half-way line —
because an outline shrinks to nothing while a fill shrinks to a blob. The two sets' weak marks are
different populations rather than different scores:

- FLUX 2 Pro: six species dex thumbnails — `beetlord` 32%, `maelhound` 34%, `mistling` 34%,
  `razorfin` 45%, `umbrawulf` 47%, `flarelynx` 50%.
- gpt-image-2: `types/stone` 38%, `types/gale` 42%, `types/verdant` 45%, `title/favicon-512x512`
  47%, `title/favicon-192x192` 48%, `types/lumen` 50%.

The reference's failures are 256-pixel thumbnails of detailed painted portraits, which is a
downscale problem. The challenger's are flat icons and favicons, which is the register problem, and
a flat icon that stops reading at 16px has failed at the size it exists for.

#### Artefact rate, tallied by eye

Same nine `types` icons as the transcribed section, scored off the rebuilt sheet. The full reasoning,
including what this taxonomy cannot see, is in `review/compare/artefacts.json`.

| | FLUX 2 Pro | gpt-image-2 |
| --- | ---: | ---: |
| frame / border / bounding box | 0 / 9 | 0 / 9 |
| ground not the flat ash field | 0 / 9 | 0 / 9 |
| idea not recognisable from `plan.ts` | 0 / 9 | 0 / 9 |
| non-flat rendering (3D, bevel, gradient, glow, texture) | 0 / 9 | 0 / 9 |
| recognisable pastiche of an existing artwork | 0 / 9 | 0 / 9 |

**Two clean columns, and saying so is the point of keeping the table.** The taxonomy was fixed to
catch what the previous challenger did — it scored 9, 9, 4, 1 and 1 on these rows — and
gpt-image-2 does none of it. It fails somewhere the rows cannot see, which is the outline register,
and **a rubric that catches the last model's failures is not the same thing as a rubric that catches
this one's.** The rows are left exactly as they were rather than a sixth being added after the
result, and the gap is answered in the verdict instead.

#### Colour fidelity on the nine flat icons, measured

Not one of the six criteria, and included because the by-eye review kept returning to it. ΔE is
measured between the accent hex the registry specifies and the colour actually rendered, using
`verify.py`'s own reader so the numbers are the ones the verifier sees:

| icon | specified | FLUX rendered | ΔE | gpt-image-2 rendered | ΔE |
| --- | --- | --- | ---: | --- | ---: |
| verdant | `#5fce7a` | `#87c3a4` | 33.2 | `#58cb7d` | **3.2** |
| lumen | `#ffe59e` | `#fbc649` | 31.3 | `#fcdb84` | **9.5** |
| umbra | `#9a7bd6` | `#796393` | 26.1 | `#966dcd` | **6.4** |
| tide | `#4aa8ff` | `#25afe6` | 21.3 | `#44a3fa` | **1.9** |
| gale | `#9fd0ff` | `#52aae7` | 18.5 | `#99c6f7` | **3.8** |
| stone | `#c9a06b` | `#e4be8a` | 11.0 | `#d2a461` | **7.9** |
| spark | `#ffd23f` | `#e5cd2a` | 10.1 | `#fcc71b` | **8.3** |
| frost | `#8ee7ff` | `#9ddff8` | 6.3 | `#7edcf8` | **4.6** |
| ember | `#ff6b4a` | `#f66a41` | **4.3** | `#fb532c` | 13.3 |
| **mean** | | | 18.0 | | **6.5** |

`verdant` is the failure this repository's README already documents by name — the specified green
comes back as a desaturated sage — and the challenger renders it at 3.2. Two further rows measured
at the same time: ink coverage across the nine spans 21.0 points for the reference and **5.8** for
the challenger, and non-accent ink — the bone bars and the grey trunk, against a brief that says
nothing is drawn in plain white, plain grey or the ground colour — reaches 4.66% of the frame for
the reference and **0.04%** for the challenger.

#### Retries, and provenance

| | FLUX 2 Pro | gpt-image-2 |
| --- | ---: | ---: |
| assets needing at least one retry | 24 / 83 | **1 / 83** |
| total retries | 46 | **3** |
| failed attempts logged | 0 | 0 |
| C2PA on the file at `assets/`, measured off the bytes | **83 / 137** | 62 / 137 |
| C2PA on the as-delivered native, measured off the bytes | n/a | **21 / 21** |

**The retry row measures the harness as much as the model** and the caveat above applies again: the
reference's 46 retries were overwhelmingly `429`s on a shared serverless endpoint, and this
challenger ran against a rate limit severe enough to force concurrency 1 and still logged three,
because serialising and sleeping meant it was never throttled.

**The single retried asset is `species/joltmouse` and it is worth naming.** It came back
`moderation_blocked` with `"moderation_stage": "output"` — the model's own output filter, not the
prompt — and the harness did not recognise the refusal, because `isContentRefusal` had been written
against FLUX's vocabulary and knew nothing of `moderation_blocked` or
`image_generation_user_error`. The repeat-verbatim ladder therefore never ran and the asset simply
failed. With the matcher extended, a re-run of that one asset succeeded at `retries=3` on the
**unmodified** prompt, which is the finding: this filter is non-deterministic, and the same string
that was refused three times was accepted the fourth.

**The C2PA rows are exact and the second one is why there are two.** 62 of the challenger's 83
generations keep their C2PA box; the 21 that do not are not a sample, they are exactly the 21 that
had to be Lanczos-downscaled from a larger native, and re-encoding a PNG through Pillow drops the
box. **All 21 of those natives carry C2PA**, so no provenance was lost — it moved to the
as-delivered file, which is where the manifest's `nativeC2pa` column says to look. The reference's
83 of 83 is a genuine win on the file that ships, and it is a *vendor* property in both directions:
FLUX emits the box, and this repository's ground normaliser is one of the two in the estate that
does not destroy it.

#### Cost, in the unit each model billed in

These are **not the same number**, were never added, averaged or divided into each other, and
`compare.py` refuses to derive a ratio between them.

- **FLUX 2 Pro: 250.5 provider image units** over 83 generations, 3.02 per image, 54 derivatives free.
- **gpt-image-2: 525,262 output image tokens** over 83 generations, 6,328.46 per image, 54
  derivatives free.

Both bill per image and they still do not compare, which is the case the cost section anticipated in
principle and this run produced in fact. What *is* comparable is each provider against its own runs,
and the useful figure for the next one is the second: roughly 6,300 output image tokens per image at
`quality: "high"`, and the 21 assets generated at a larger native cost more than the size they
declare, because the endpoint charges for what it renders rather than for what is kept.

### Verdict: by kind, because there is no single winner

**The recommendation is: do not promote gpt-image-2 to `assets/` today, and do not treat that as a
loss for the challenger.** It wins the criterion this set says matters most, by the largest margin
in the document. What it does not win is the set as a whole, and the reason is one register decision
applied uniformly to kinds that wanted opposite things.

| kind | entries | better set | why |
| --- | ---: | --- | --- |
| `species` | 46 + 50 thumbs | **gpt-image-2 on coherence, reference on character** | Eleven of fifteen evolution lines are tighter, the worst line goes from 38.6° to 8.8°, and the lines simply look like families. The cost is material range: ash-and-ember cubs become ember cubs, and two stages of the seedling line become hard to tell apart. |
| `types` | 9 | **reference** | Four flat adherence misses where `plan.ts` says "solid" or "filled", the one specified ground bar missing, and three of the nine under 50% contrast at 16px. Colour fidelity goes the other way by a distance — mean ΔE 6.5 against 18.0 — and does not buy back a glyph that has stopped reading. |
| `ui` | 12 | **gpt-image-2** | Frames and glyphs are outline work, the challenger's register is right for them, and its symmetry and stroke-weight discipline are visibly better on nine of the twelve. `frame-button` alone is worth the comparison: the reference drew a button frame with no hole in it. |
| `biomes` | 6 | **reference** | The challenger's plates are darker and more saturated and two of the six lose their structure into near-black. Key art is a background; competing with what is read against it is a failure even when the plate is the more striking image. |
| `title` | 9 + 4 derived | **reference** | Both spell "Emberkin" correctly in all five lettered assets. But the mark is an outline, and the three favicons cut from it hollow out at small size, which is the one place in this set where the register decision is unambiguously wrong. |
| everything derived | 54 | **neither** | 50 dex thumbnails, 3 favicons and 1 `og` crop, cut by identical code in both sets. A difference here is inherited from the source and is not a measurement of the model — except where the source's register decides what survives the downscale, which is exactly what happened to the favicons. |

**What would change the verdict, and it is cheap — which is precisely why it was not done.** The
challenger logged one retry in 83 generations. Regenerating the nine `types` icons and `title/mark`
with the word "filled" emphasised, or simply re-rolling them, is ten images and about an hour. That
was deliberately not done: **re-rolling the assets that failed, and only those, until they pass is
how a comparison stops measuring a model and starts measuring the patience of the person running
it.** The reference set's 46 retries were `429`s rather than re-rolls for taste, and the challenger
is entitled to the same rule.

**The verdict and the tooling agree, and they agree for different reasons.** Unlike the sibling
repository — where `promote.py` refuses the switch outright because a candidate that passed every
gate turned the repository red the moment it landed on `assets/` — this candidate passes the
promotion gate cleanly: `verify.py --provider gpt-image-2 --as-shipped` reports **0 failures**, with
conformance and completeness held fatal. Nothing mechanical stands in the way of promoting it. The
recommendation not to is a judgement about `types`, `biomes` and the favicons, it is recorded as a
judgement rather than dressed up as a gate, and `promote.py --provider gpt-image-2` will carry it
out in one command the day somebody disagrees.

**And one honest limit on all of the above.** This is one run of 83 images at one setting
(`quality: "high"`), on one brief, judged by one pair of eyes, against a reference set whose
prompts were in several cases edited after it was generated — so the challenger replayed the
recorded string and in places beat a slightly easier opponent. The measurements are reproducible on
demand and the by-eye scoring is not. Where the two disagree, the tables are what can be checked and
the prose is what has to be argued with.

## Addendum: the experiment this document proposed could not be run, so the control was run instead

The section above ends by naming what would change the verdict — a regeneration of the losing
categories with the brief pushed towards **filled shapes** rather than the outline register
gpt-image-2 chose. That was attempted on 2026-08-16. **It is not possible in this repository**, and
the reason is worth recording because it is a property of the tooling rather than of the models.

`reprompt` — the field that would carry a changed instruction — is **reference-only**. A candidate
set replays the prompt string recorded in its own manifest; there is no supported path that hands a
candidate provider a new brief without first making it the reference, which is the promotion this
document recommends against. So the only thing that *could* be run was a plain re-roll: same literal
prompt, same setting, new draws.

That is the control for the proposed experiment, and it is worth having, because it separates two
explanations for the outline register that the section above could not distinguish: *the model
answered this brief that way* versus *the model draws that way when asked this*. The control answers
it.

**Fifteen assets were re-rolled** — the six `biomes` plates and all nine `types` marks, i.e. the
whole of both categories the verdict turned on. The result:

| | flux-2-pro | gpt-image-2 before | gpt-image-2 after |
| --- | ---: | ---: | ---: |
| marks under 50% at 16px | 9 | 12 | **13** |

**It moved nothing, and moved the headline row the wrong way.** New draws, same register: dark-red
outline strokes on near-black where the reference fills. The register is not a bad roll to be rolled
past; it is what this model does with this brief at this setting, and one re-roll per asset does not
reach it.

`title/mark` is the sharpest case and it was pushed hardest — **four draws**, because it is the one
asset a re-roll would most obviously be worth. Every draw after the first *failed the flat-ground
conformance check*, with corner ink at **17.1%**, **8.0%** and **13.5%** where the check requires the
four corner patches to be exactly `#12100f`. Draw 1 was restored — bytes and its `MANIFEST.json` row,
keyed by `(set, slug, declaredSize)` — and the set re-derived. `verify.py --provider gpt-image-2
--as-shipped` is back to **0 failures**.

Three things follow, and only the first is about this repository.

1. **The verdict stands: do not promote.** It is unchanged, for the reasons already given, now with
   the re-roll defence closed rather than left open.
2. **The candidate remains switchable and is committed.** Nothing here removes the option; the set
   passes its own gate as shipped, and `promote.py --provider gpt-image-2` still carries it out in
   one command, reversibly.
3. **The same model won the sibling brand repository on this exact criterion** — 7 marks under 50%
   at 16px against the reference's 11, promoted the same day. Same model, same setting, same literal
   dialect, opposite result. What separates them is the brief: `micro-brand`'s surfaces ask for solid
   emblems, and `emberkin`'s ask for creatures and terrain, where this model reaches for line work.
   **That is a fact about our prompts, not about the model**, and it is the most actionable thing
   this control produced — the filled-shape experiment is still the right one to run, and running it
   needs a `reprompt` path for candidates, which does not exist today.
