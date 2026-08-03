# How the models were judged — Emberkin

> ## CONCLUDED. This is a record of an evaluation that finished, not an open one.
>
> **FLUX 2 Pro ships.** The Qwen-Image 2512 challenger was generated against this set in full,
> measured against every criterion below, and lost. A second pilot in a `positive` prompt dialect
> was run to test whether the verdict was partly an artefact of this estate's own prompt style;
> it was not. **The owner has since withdrawn Qwen-Image 2512 from the estate, and this
> repository's `candidates/qwen-image-2512/` and `candidates/qwen-image-2512-positive/` trees,
> their manifests, their deployment records and their two registry entries have been deleted.**
>
> **Every figure below was measured off the challenger's bytes while those bytes existed, and is
> now history rather than something you can re-derive.** `compare.py` cannot reproduce these
> columns: it reads manifests, and there is one manifest left. So the numbers it last printed have
> been transcribed into this file — see the final section — because deleting 741 images across the
> estate must not delete the reason the estate chose what it chose.
>
> **What survived the deletion and can still be checked today:** `review/compare/artefacts.json`,
> the by-eye defect tally with its scope stated; the recorded literal prompts in `MANIFEST.json`;
> `claims.py`, which still re-derives every figure in this file that has a live source; and the
> provider seam itself — `providers.json`, `backends.ts`, the dialect registry and `verify.py`'s
> `check_parity` — kept whole because the estate has a stated 3D and animation gap FLUX cannot
> fill and a next challenger is a question of when rather than if.
>
> **One consequence is stated here because it is easy to miss.** `check_parity` compared sets to
> each other and there is one set now, so it is DORMANT: it returns clean because it was handed one
> document. `verify.py` prints that word on every run instead of a zero, and `verify.py
> --self-test` proves on every CI run that it still fails when it is given something to fail on.


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
   and animation gap FLUX cannot fill (`docs/ecosystem/19-new-products.md:97`), so reinstating
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
