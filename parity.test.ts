/**
 * The prompt-parity suite: the property the whole comparison rests on, asserted rather than
 * maintained by convention.
 *
 *     cd ../studio && node --import tsx --test ../emberkin-assets/parity.test.ts
 *
 * The property is **"every model is asked the same question about a given asset"**. It is NOT "the
 * prompt-building code produces the prompt that is on record", and the difference is the design:
 * the clauses in `generate.ts` were edited after the run that produced this set, so most recorded
 * assets carry a prompt the code no longer derives. A test asserting code-equals-record would be
 * red on arrival and "fixing" it would mean regenerating the whole set or weakening the assertion.
 *
 * What the comparison actually needs is that when a candidate is asked for `SAMPLE_KEY`, it is
 * asked the same thing FLUX was asked when that asset was made — whatever that was. That is what
 * `promptForProvider` guarantees by replaying the record.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

import { plannedAssets, type PlannedAsset } from './plan.ts'
import { promptFor } from './generate.ts'
import {
  identityFor,
  promptForProvider,
  referencePrompts,
  MissingReferencePromptError,
  RepromptNotForCandidateError,
  RepromptNotForDialectError,
} from './replay.ts'
import {
  PROVIDERS,
  REFERENCE,
  providerById,
  live,
  inDialect,
  dialectsInUse,
  ProviderWithdrawnError,
} from './providers.ts'
import {
  DIALECTS,
  LITERAL,
  applyDialect,
  dialectById,
  residualNegations,
  ResidualNegationError,
} from './dialects.ts'
import {
  backendFor,
  managedComputeBackend,
  referenceBackend,
  UnimplementedBackendError,
  UNKNOWNS,
  measureC2pa,
  scoringUri,
  managedHeaders,
  MODEL_FIELD,
  modelValueFor,
  isWarming,
  awaitWarm,
  resetWarmingGate,
  WARMING,
  type GenerationRequest,
} from './backends.ts'

// Derived from the registry, never counted. Cosmos 3 Super failed to deploy and is `withdrawn`; a
// third model will be tried again, so these tests assert SHAPE rather than arity.
const CANDIDATES = PROVIDERS.filter((p) => p.id !== REFERENCE.id)
const digest = (value: string): string => createHash('sha256').update(value).digest('hex')
const compute = (planned: Parameters<typeof promptFor>[0]): string => promptFor(planned)

const sampleRequest = (prompt: string): GenerationRequest => ({
  prompt,
  spec: { kind: 'icon', width: 512, height: 512, format: 'png' },
  requestWidth: 512,
  requestHeight: 512,
  kitName: 'sample',
  accent: '#e8622c',
})

const sendable = (id: string, planned: PlannedAsset): string | null => {
  // A prompt this dialect cannot yet clear of prohibitions is not a parity failure — it is an
  // asset that may not be generated in this dialect AT ALL, which promptForProvider enforces at
  // run time and the residual test below asserts separately.
  try {
    return promptForProvider(id, planned, compute)
  } catch (err) {
    if (err instanceof ResidualNegationError) return null
    throw err
  }
}

test('every provider in a dialect is given the same prompt for the same asset', () => {
  const recorded = referencePrompts()
  assert.ok(recorded.size > 0, 'the reference manifest carries no prompts to replay')

  // Grouped by dialect rather than run over every provider at once. That is the ONE thing dialects
  // changed about this property, and the group is derived from the registry so a third dialect is
  // covered the day it is registered rather than the day somebody remembers to edit this test.
  let compared = 0
  for (const planned of plannedAssets()) {
    const { key } = identityFor(planned)
    if (!recorded.has(key)) continue // not generated for the reference yet; nothing to replay.
    for (const dialect of dialectsInUse()) {
      const prompts = inDialect(dialect)
        .map((p) => sendable(p.id, planned))
        .filter((p): p is string => p !== null)
      if (prompts.length < 2) continue
      assert.equal(
        new Set(prompts.map(digest)).size,
        1,
        `${key}: the ${dialect}-dialect providers would be sent different prompts`,
      )
    }
    compared += 1
  }
  assert.ok(compared > 20, `only ${compared} assets had a recorded prompt to compare`)
})

/* ------------------------------------------------------------------ the dialect property */

test('a dialect is a pure function of the record, so a cross-dialect set is re-derivable', () => {
  // The claim that lets a second dialect exist without weakening anything. Within a dialect the
  // check is equality (above); ACROSS dialects it is this — the prompt a set is sent is exactly
  // what the named rules produce from the reference's own record, so the two sets are provably two
  // phrasings of ONE brief about ONE asset. verify.py --parity runs the same check on the
  // artefacts, from dialects.py, against the same dialects.json.
  // ---- THE PROPERTY, OVER EVERY REGISTERED DIALECT. This half always has an operand.
  //
  // It used to loop over registered PROVIDERS and end with
  // `assert.ok(checked > 0, 'no non-literal provider is registered, so this property is untested')`
  // — a dormancy guard the original author was right to write, and which started failing the day
  // the owner withdrew Qwen and its positive-dialect entry went with it.
  //
  // The guard was NOT relaxed to `>= 0`, which would have made a check pass by removing its
  // ability to fail. The loop was moved onto the set the property is actually about. "A dialect is
  // a pure function of the record" is a statement about DIALECTS; providers were only ever how the
  // estate happened to reach them, and `dialects.json` still registers `positive` whether or not
  // any set was generated in it. So this half is broader than what it replaces: it covers a
  // dialect with no provider today, and it covers a third dialect the day it is registered rather
  // than the day a set is generated in it.
  let derived = 0
  for (const dialect of DIALECTS) {
    if (dialect.id === LITERAL.id) continue
    for (const record of referencePrompts().values()) {
      const sent = applyDialect(dialect.id, record)
      // Pure: same input, same output, no hidden state between calls.
      assert.equal(sent, applyDialect(dialect.id, record), `${dialect.id} is not deterministic`)
      // Total: it returns a prompt for every record rather than throwing on the awkward ones.
      assert.equal(typeof sent, 'string')
      derived += 1
    }
  }
  assert.ok(derived > 0, 'no non-literal dialect is registered, so this property is untested')

  // ---- AND THE SAME PROPERTY THROUGH promptForProvider, which is what actually runs at
  // generation time. DORMANT while every registered provider is literal: the loop below has
  // nothing to iterate, and `checkedViaProvider` is reported rather than asserted away, because a
  // zero here means "there is no non-literal set to send" and not "the transform agreed".
  const recorded = referencePrompts()
  let checked = 0
  for (const planned of plannedAssets()) {
    const record = recorded.get(identityFor(planned).key)
    if (record === undefined) continue
    for (const provider of PROVIDERS) {
      if (provider.dialect === LITERAL.id) continue
      const sent = sendable(provider.id, planned)
      if (sent === null) continue
      assert.equal(sent, applyDialect(provider.dialect, record), identityFor(planned).key)
      checked += 1
    }
  }
  assert.equal(
    checked === 0,
    PROVIDERS.every((p) => p.dialect === LITERAL.id),
    'checkedViaProvider disagrees with the registry: either a non-literal provider was skipped, ' +
      'or one was iterated that is not registered',
  )
})

test('a dialect that is not the identity must actually differ, or its label is a lie', () => {
  // A no-op transform registered as a dialect would be the worst outcome available: two sets that
  // LOOK like a prompt-style experiment, are byte-identical in what they were asked, and produce a
  // difference that is pure sampling noise dressed up as a finding.
  const recorded = referencePrompts()
  for (const dialect of DIALECTS) {
    if (dialect.id === LITERAL.id) {
      assert.equal(dialect.rules.length, 0, 'the literal dialect grew a rule; it IS the record')
      for (const [, prompt] of recorded) assert.equal(applyDialect(dialect.id, prompt), prompt)
      continue
    }
    assert.ok(
      [...recorded.values()].some((p) => applyDialect(dialect.id, p) !== p),
      `the ${dialect.id} dialect changes nothing on any recorded prompt here`,
    )
  }
})

test('a prompt that keeps its prohibitions cannot be sent in a dialect that forbids them', () => {
  // "Positive" is a measured property of the string, not a claim in a registry. The gate is at
  // generation time and it is a refusal to SPEND: a per-hour deployment makes "generate it and
  // notice later" cost real money, and a set labelled positive whose prompts are half-negative
  // would answer a question nobody asked while looking entirely correct on disk.
  const positive = DIALECTS.find((d) => d.checkResiduals)
  assert.ok(positive, 'no dialect checks its own residuals; the label is then unfalsifiable')
  // Word boundaries: "generous negative space" is in every brief here and is not a prohibition.
  assert.deepEqual(residualNegations(positive!.id, 'generous negative space, nonetheless'), [])
  assert.deepEqual(residualNegations(positive!.id, 'no bevels'), ['no'])
  // The literal dialect is the control and is SUPPOSED to be prohibition-heavy.
  assert.deepEqual(residualNegations(LITERAL.id, 'no bevels, never inverted'), [])

  const uncleared = plannedAssets().find((planned) => {
    const record = referencePrompts().get(identityFor(planned).key)
    return (
      record !== undefined &&
      residualNegations(positive!.id, applyDialect(positive!.id, record)).length > 0
    )
  })
  if (uncleared) {
    for (const provider of inDialect(positive!.id)) {
      assert.throws(() => promptForProvider(provider.id, uncleared, compute), ResidualNegationError)
    }
  }
})

test('every registered provider declares a dialect that exists', () => {
  for (const provider of PROVIDERS) {
    assert.ok(provider.dialect, `${provider.id} declares no dialect`)
    assert.equal(dialectById(provider.dialect).id, provider.dialect)
  }
  // The reference is the record, so it is the literal dialect by definition. If this ever flips,
  // every other set's prompts derive from something that is itself a derivation.
  assert.equal(REFERENCE.dialect, LITERAL.id)
  assert.equal(LITERAL.source, null, 'the literal dialect derives from something; it IS the record')
  for (const dialect of DIALECTS) {
    if (dialect.id === LITERAL.id) continue
    assert.equal(dialect.source, LITERAL.id, `${dialect.id} does not derive from the record`)
  }
})

/**
 * WHAT REPLACED THE DIALECT-PAIR TEST, AND WHY IT IS NOT A REDUCTION.
 *
 * A test used to assert that `qwen-image-2512` and `qwen-image-2512-positive` differed in exactly
 * one meaningful field — the dialect — so that a difference in their output had exactly one
 * available explanation. The owner withdrew that model and both entries are gone, and a test that
 * looks up a deleted provider id can only ever fail for the wrong reason.
 *
 * The property it protected is not "those two entries exist". It is **"the registry can express two
 * sets that share every wire fact and differ only in what was asked"**, which is what makes the
 * dialect experiment controlled at all. That is asserted below against a pair CONSTRUCTED here, so
 * it holds with one provider registered, with four, and on the day a second challenger lands.
 */
test('the registry can still express a controlled dialect pair', () => {
  const base = providerById(REFERENCE.id)
  // Same deployment, same route, same key, same concurrency; one field different. If `dialect`
  // ever stops being enough to express that, the next positive-vs-literal experiment silently
  // becomes uncontrolled and nothing in the output would say so.
  const positive = { ...base, id: `${base.id}-positive`, dialect: 'positive' }
  const differs = (Object.keys(base) as (keyof typeof base)[]).filter(
    (k) => JSON.stringify(base[k]) !== JSON.stringify(positive[k]),
  )
  assert.deepEqual(differs.sort(), ['dialect', 'id'])
  assert.equal(base.dialect, LITERAL.id)
  assert.ok(dialectById('positive'), 'the positive dialect is no longer registered')
  // A clause taken from the real rule list rather than invented, so this asserts that the dialect
  // still transforms THIS estate's briefs and not merely that it transforms something.
  const clause = 'with exactly one accent colour — #e8622c — and no second hue anywhere'
  assert.notEqual(
    applyDialect('positive', clause),
    clause,
    'the positive dialect has become the identity transform, so the pair could not differ',
  )
  assert.deepEqual(
    residualNegations('positive', applyDialect('positive', clause)),
    [],
    'the positive dialect no longer clears the clause it was written for',
  )
  // And every registered provider really does declare a dialect that exists — the guard that stops
  // a new entry joining the registry without saying what it was asked.
  for (const provider of PROVIDERS) {
    assert.ok(DIALECTS.some((d) => d.id === provider.dialect), `${provider.id}: unknown dialect`)
  }
})

test('--reprompt is refused outside the dialect that holds the record', () => {
  // Unreachable while the reference is itself in the literal dialect, which it must be. It is here
  // because the failure it prevents is silent and expensive: a reprompt in a DERIVED dialect writes
  // a record nothing produced, after which verify.py --parity can no longer re-derive that set and
  // the cross-dialect guarantee quietly stops being checkable while every file still looks correct.
  const message = new RepromptNotForDialectError('some-provider', 'positive', 'types/ember@512x512')
    .message
  assert.ok(message.includes('positive'))
  assert.ok(message.includes(LITERAL.id))
  assert.ok(message.includes('re-derive'))
})

test('every provider replays the recorded prompt, including the reference', () => {
  const recorded = referencePrompts()
  // The case that makes this worth testing: an asset whose recorded prompt the current code no
  // longer produces. If ANY provider recomputed instead of replaying, regenerating one of these
  // would ask that model a different question from the one the others answered, and every other
  // check in the repository would stay green while the comparison stopped meaning anything.
  const drifted = plannedAssets().filter((planned) => {
    const record = recorded.get(identityFor(planned).key)
    return record !== undefined && record !== promptFor(planned)
  })
  assert.ok(drifted.length > 0, 'no drifted asset to test against; give this a synthetic fixture')
  for (const planned of drifted) {
    for (const provider of PROVIDERS) {
      // The record, TRANSLATED into that provider's dialect — which for a literal-dialect provider
      // is the record itself, unchanged, and that is still the case being tested here. A dialect
      // translates the record; it never lets a provider fall back to recomputing one.
      const sent = sendable(provider.id, planned)
      if (sent === null) continue
      assert.equal(
        sent,
        applyDialect(provider.dialect, recorded.get(identityFor(planned).key)!),
        `${identityFor(planned).key}: ${provider.id} was not given the recorded prompt`,
      )
      if (provider.dialect === LITERAL.id) {
        assert.equal(sent, recorded.get(identityFor(planned).key))
        assert.notEqual(sent, promptFor(planned), 'it recomputed and happened to match')
      }
    }
  }
})

test('changing the question is deliberate and reference-only', () => {
  const recorded = referencePrompts()
  const drifted = plannedAssets().find((planned) => {
    const record = recorded.get(identityFor(planned).key)
    return record !== undefined && record !== promptFor(planned)
  })!
  const reprompted = promptForProvider(REFERENCE.id, drifted, compute, { reprompt: true })
  assert.equal(reprompted, promptFor(drifted))
  assert.notEqual(reprompted, recorded.get(identityFor(drifted).key))
  for (const candidate of CANDIDATES) {
    assert.throws(
      () => promptForProvider(candidate.id, drifted, compute, { reprompt: true }),
      RepromptNotForCandidateError,
  RepromptNotForDialectError,
    )
  }
})

test('an asset the reference has never generated cannot be generated for a candidate', () => {
  const invented = { ...plannedAssets()[0]!, key: 'no-such/asset' }
  for (const candidate of CANDIDATES) {
    assert.throws(
      () => promptForProvider(candidate.id, invented, compute),
      MissingReferencePromptError,
    )
  }
  // ...and the reference itself may, because it is what establishes the record.
  assert.ok(promptForProvider(REFERENCE.id, invented, compute).length > 0)
})

test('an unimplemented backend throws rather than guessing a wire shape', async () => {
  for (const candidate of CANDIDATES.filter((p) => p.adapter === 'foundry-managed-compute')) {
    assert.equal(candidate.implemented, false)
    const backend = managedComputeBackend(candidate)
    assert.throws(() => backend.bodyFor(sampleRequest('anything')), UnimplementedBackendError)
    // generate must refuse BEFORE it opens a socket: an unknown body has to cost nothing, and on a
    // per-hour deployment "nothing" includes not making a billable call.
    await assert.rejects(backend.generate(sampleRequest('x'), AbortSignal.timeout(1)))
  }
  assert.ok(UNKNOWNS.length >= 8, 'the checklist has been trimmed; that is how a body gets guessed')
  assert.ok(UNKNOWNS[0]!.startsWith('BODY FIELD NAMES'))
})

test('the unimplemented error names the unknowns and leaks no credential', () => {
  let message = ''
  try {
    managedComputeBackend(providerById('cosmos-3-super')).bodyFor(sampleRequest('x'))
  } catch (err) {
    message = (err as Error).message
  }
  for (const heading of ['BODY FIELD NAMES', 'RESPONSE SHAPE', 'C2PA', 'PROMPT LENGTH']) {
    assert.ok(message.includes(heading), `the error no longer mentions ${heading}`)
  }
  assert.equal(/[A-Za-z0-9_-]{32,}/.test(message), false, 'a token-shaped string reached the error')
})

test('the registry describes the models rather than counting them', () => {
  assert.equal(REFERENCE.implemented, true)
  assert.equal(REFERENCE.shipped, true)
  assert.equal(REFERENCE.billing.unit, 'provider image unit')
  // Deliberately NOT an arity assertion, and that decision has now been tested by events. The
  // comparison was briefed three-way, ran two-way because Cosmos failed to deploy, and is one-way
  // since the owner withdrew Qwen — and none of those three states needed an edit here. The estate
  // has a stated 3D/animation gap FLUX cannot fill, so the count will move again. A test pinning
  // it is how a design gets collapsed back into hardcoded providers.
  assert.ok(CANDIDATES.length >= 1)
  assert.ok(live().length >= 1)
  for (const candidate of CANDIDATES) {
    assert.equal(candidate.shipped, false)
    assert.equal(candidate.billing.hourlyRate, null, 'a rate was filled in; check it was measured')
  }

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // BILLING IS ASSERTED AS A CONSISTENT SHAPE, NOT AS A LIST OF KNOWN UNIT STRINGS.
  //
  // This used to read `assert.equal(candidate.billing.unit, 'deployment hour')` for every
  // candidate, on the reasoning that the unit string is not decoration — compare.py refuses to add
  // costs across units and the honesty of COMPARISON.md's cost section depends on it being right.
  // The reasoning was correct and the assertion was the wrong shape for it: it pinned the two units
  // that happened to exist, so a third one could only ever arrive by editing a test, and the
  // obvious edit is to widen it into a set of allowed strings that then has to be widened again.
  //
  // gpt-image-2 is the third unit — output image tokens, per image, and neither of the other two.
  // What actually has to hold is not WHICH unit it is but that the unit and the BASIS agree, and
  // that the basis is one compare.py knows how to read: `per image generated` takes the per-image
  // path and needs a response field named as its source, `per hour…` takes the deployment-hour path
  // and needs a DEPLOYMENT.json and a SKU. compare.py branches on `basis` for exactly this reason.
  // A provider whose blocks disagree would send it down a path that reads a file that is not there,
  // or would silently report a per-image cost for something that has none.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  for (const provider of PROVIDERS) {
    const { unit, basis, source, sku } = provider.billing
    assert.ok(unit.length > 0, `${provider.id}: no billing unit`)
    assert.ok(
      basis.startsWith('per image generated') || basis.startsWith('per hour'),
      `${provider.id}: billing basis "${basis}" is one compare.py cannot dispatch on`,
    )
    if (basis.startsWith('per image generated')) {
      // A per-image provider has to name the response field its figure comes off, because that
      // figure lands in providerCostUnits on every row and there is no other record of where it
      // came from months later.
      assert.ok(
        source.includes('providerCostUnits'),
        `${provider.id}: a per-image basis must say which response field providerCostUnits holds`,
      )
      assert.equal(sku, null, `${provider.id}: a per-image provider has no hardware SKU`)
    } else {
      assert.ok(
        source.includes('DEPLOYMENT.json'),
        `${provider.id}: an hourly basis must name the operator's deployment record as its source`,
      )
      assert.ok(sku !== null, `${provider.id}: an hourly provider bills for a SKU; name it`)
    }
  }

  const cosmos = providerById('cosmos-3-super')
  assert.equal(cosmos.status, 'withdrawn')
  assert.throws(() => backendFor(cosmos, {}), ProviderWithdrawnError)
})

test('the managed wire facts that were measured, pinned', () => {
  // These are facts about the Managed Compute HOST, not about either model that has been on it,
  // which is why they survive the removal of the Qwen deployment: the next challenger lands on the
  // same route, the same header and the same deployment-name rule, and every line below cost a
  // real request to learn.
  const cosmos = providerById('cosmos-3-super')
  assert.equal(cosmos.route, '/managed-deployments/{deployment}/v1/chat/completions')
  assert.equal(
    scoringUri({ baseUrl: 'https://h.example/', apiKey: 'x', deployment: cosmos.deployment!, route: cosmos.route! }),
    'https://h.example/managed-deployments/nvidia--cosmos3-super/v1/chat/completions',
  )
  // `api-key`, never Bearer — Bearer is a measured 401 on that host. Asserted on the object the
  // code sends rather than by grepping the source, so a comment cannot fail the build.
  const headers = managedHeaders({ baseUrl: 'https://h.example', apiKey: 'k', deployment: 'd', route: '/r' })
  assert.deepEqual(Object.keys(headers).sort(), ['api-key', 'content-type'])
  assert.equal(headers['authorization'], undefined)
  // `model` is required in the body and its value is the DEPLOYMENT name, not the catalogue name.
  assert.equal(MODEL_FIELD, 'model')
  assert.equal(
    modelValueFor({ baseUrl: '', apiKey: '', deployment: 'nvidia--cosmos3-super', route: '' }),
    'nvidia--cosmos3-super',
  )
  // The near miss: the natural spelling of the Cosmos deployment is a measured 404.
  assert.equal(cosmos.deployment, 'nvidia--cosmos3-super')
  assert.notEqual(cosmos.deployment, 'nvidia--cosmos-3-super')
})

test('a warming 500 is not a failure, and workers share one wait', async () => {
  assert.equal(isWarming(500, 'Model service is unavailable'), true)
  assert.equal(isWarming(500, 'internal server error'), false, 'a real 500 must not be waited out')
  assert.equal(isWarming(400, 'model service is unavailable'), false)

  resetWarmingGate()
  let polls = 0
  let clock = 0
  await Promise.all(
    Array.from({ length: 4 }, () =>
      awaitWarm(
        async () => ++polls >= 3,
        () => {},
        () => clock,
        async (ms) => {
          clock += ms
        },
      ),
    ),
  )
  // Ten workers hammering a container that is loading weights do not make it load faster, and on
  // dedicated hardware there is no 429 to tell them to stop.
  assert.equal(polls, 3, 'the endpoint was polled once per worker per wait')
  assert.ok(WARMING.budgetMs > 0)
  resetWarmingGate()
})

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT REPLACED THE TWO QWEN ENVELOPE TESTS, AND WHY IT IS NOT A REDUCTION
 *
 * Two tests were deleted with the Qwen deployment. One asserted that its OpenAI-images envelope
 * carried the prompt verbatim and that `sizeParamFor` transposed the requested size; the other put
 * both live backends side by side and compared the strings that reached the wire.
 *
 * The transposition half pinned a WORKAROUND for one vendor's bug, in an endpoint that no longer
 * exists. A test that pins a deleted workaround is a test that can only ever fail for the wrong
 * reason, and keeping it would have been keeping a green tick rather than a check.
 *
 * The property both of them really protected is not "we transpose". It is **"a delivered image is
 * the size that was asked for, measured on the bytes"** and **"the prompt reaches the wire
 * untouched"**. Both survive here, and neither is specific to any model: `generate.ts`'s
 * `TransposedDeliveryError` still refuses to keep a rotated file for ANY provider, and
 * `verify.py`'s cross-set check still re-measures every non-square asset. Those two are blind on a
 * square, so the size of the population they can see is pinned below — a suite that stopped
 * knowing how many non-square assets exist would not notice the day that number went to zero.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
test('the reference envelope carries the prompt verbatim', () => {
  // The end-to-end form of the parity property: compare the string that reaches the WIRE against
  // the string handed in, not two builders against each other. A backend that prepended a system
  // preamble, appended a negative prompt or truncated to a token budget fails here.
  const prompt = 'a prompt with\n\nparagraphs and "quotes" and — dashes'
  const body = referenceBackend(REFERENCE, {
    endpoint: 'https://f.example',
    apiKey: 'k',
    imagePath: '/p',
    model: 'FLUX.2-pro',
    fallbackModel: '',
  }).bodyFor({
    prompt,
    spec: { kind: 'mark', width: 1024, height: 1024, format: 'png' },
    requestWidth: 1024,
    requestHeight: 1024,
    kitName: 'x',
    accent: '#e8622c',
  })
  assert.equal(body['prompt'], prompt)
})

test('the reference asks for the size it wants, and the non-square population is pinned', () => {
  const backend = referenceBackend(REFERENCE, {
    endpoint: 'https://f.example',
    apiKey: 'k',
    imagePath: '/p',
    model: 'FLUX.2-pro',
    fallbackModel: '',
  })

  const nonSquare = plannedAssets().filter((a) => a.width !== a.height)
  // Not a decoration. `TransposedDeliveryError` and verify.py's delivered-size check are both blind
  // on a square, so the number of non-square assets IS the size of the population they can see.
  assert.ok(nonSquare.length > 0, 'no non-square asset is planned, so nothing can observe a rotation')

  for (const planned of nonSquare.slice(0, 8)) {
    const body = backend.bodyFor({
      prompt: 'x',
      spec: { kind: 'banner', width: planned.width, height: planned.height, format: 'png' },
      requestWidth: planned.width,
      requestHeight: planned.height,
      kitName: planned.name,
      accent: planned.accent,
    })
    // Width and height as themselves. The reference provider takes exactly these and ignores
    // `size`; nothing in this repository transposes anything any more.
    assert.equal(body['width'], planned.width)
    assert.equal(body['height'], planned.height)
  }
})

test('c2pa is read off the bytes, never asserted', () => {
  assert.equal(measureC2pa(Buffer.from('\x89PNG....c2pa....')), true)
  assert.equal(measureC2pa(Buffer.from('\x89PNG....IDAT....')), false)
})
