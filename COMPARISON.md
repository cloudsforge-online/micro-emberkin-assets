# How the models are judged — Emberkin

The criteria are estate-wide and are stated in full in **`micro-brand/COMPARISON.md`**. This file
records what is specific to this set, and the baseline numbers a challenger is measured against.

**Every count below is re-derived by `python3 claims.py`**, which reads the figure out of this file
and recomputes it from the manifests, the dialect registry and the scored artefacts. It is here
because two figures in the positive-dialect section were wrong and had been wrong in BOTH game
repositories at once: the paragraph was copied from one to the other and brought its numbers with
it. Idea drift was stated as 2 of 15 where the three repositories' own scored artefacts sum to 1,
and "74 of them here" was true of emberkin and not of aetherholm, where it is 92. A number a
document carries and nothing recomputes is a number waiting to be copied somewhere it is false.

Written **before** a challenger set exists, which is the only time criteria can be written
honestly. Once the images are on screen it is very easy to discover that the thing the winner
happens to be good at was the thing that mattered all along.

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

5. **Nothing here counts providers.** The comparison was briefed three-way, is two-way because
   Cosmos 3 Super failed to deploy, and will be three-way again — the estate has a stated 3D and
   animation gap FLUX cannot fill (`docs/ecosystem/19-new-products.md:97`).

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

**One thing to know before reading `verify.py` on this set.** The positive-dialect set is a
15-asset pilot, not a whole set, so this repository's verifier reports every un-generated asset as
"planned but never generated" — 74 of them here. That is the check doing its job on a deliberately
partial set, not a defect in the set, and it is why the count is not comparable with the complete
literal-dialect candidate's. Prompt parity, checksums, dimensions and C2PA all pass at zero
failures across all three sets.

Phase 2 — all 235 in this dialect — was **not** run. It would spend a deployment lifetime to confirm
a negative already established at 15 of 15 with no variance. Stopping is the finding, and the
verdict above is unchanged: **FLUX, decisively.**
