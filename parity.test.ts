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
  openAiImagesBackend,
  sizeParamFor,
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
  assert.ok(checked > 0, 'no non-literal provider is registered, so this property is untested')
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

test('the two Qwen sets differ in exactly one field, and it is the dialect', () => {
  // The controlled part of the second experiment. If they differed in the model, the deployment,
  // the route or the concurrency, a difference in their output would have more than one available
  // explanation and the exercise would prove nothing.
  const literal = providerById('qwen-image-2512')
  const positive = providerById('qwen-image-2512-positive')
  const differs = (Object.keys(literal) as (keyof typeof literal)[]).filter(
    (k) => JSON.stringify(literal[k]) !== JSON.stringify(positive[k]),
  )
  assert.deepEqual(differs.sort(), ['billing', 'dialect', 'id', 'label', 'notes', 'root'])
  assert.equal(literal.dialect, LITERAL.id)
  assert.equal(positive.dialect, 'positive')
  assert.equal(literal.deployment, positive.deployment, 'same deployment, or it is not controlled')
  assert.equal(literal.adapter, positive.adapter)
  assert.equal(literal.route, positive.route)
  assert.equal(literal.concurrency, positive.concurrency)
  assert.deepEqual(literal.env, positive.env)
  assert.equal(literal.billing.unit, positive.billing.unit)
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
    managedComputeBackend(providerById('qwen-image-2512')).bodyFor(sampleRequest('x'))
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
  // Deliberately NOT an arity assertion. The comparison was three-way, is two-way because Cosmos
  // failed to deploy, and will be three-way again — the estate has a 3D/animation gap FLUX cannot
  // fill. A test pinning the count is how a design gets collapsed back into hardcoded providers.
  assert.ok(CANDIDATES.length >= 1)
  assert.ok(live().length >= 1)
  for (const candidate of CANDIDATES) {
    assert.equal(candidate.billing.unit, 'deployment hour')
    assert.equal(candidate.billing.hourlyRate, null, 'a rate was filled in; check it was measured')
  }
  const cosmos = providerById('cosmos-3-super')
  assert.equal(cosmos.status, 'withdrawn')
  assert.throws(() => backendFor(cosmos, {}), ProviderWithdrawnError)
})

test('the managed wire facts that were measured, pinned', () => {
  const qwen = providerById('qwen-image-2512')
  // Qwen turned out to serve on an OpenAI-shaped images route, not under /managed-deployments/.
  assert.equal(qwen.route, '/openai/v1/images/generations')
  assert.equal(
    scoringUri({ baseUrl: 'https://h.example/', apiKey: 'x', deployment: qwen.deployment!, route: qwen.route! }),
    'https://h.example/openai/v1/images/generations',
  )
  // `api-key`, never Bearer — Bearer is a measured 401 on that host. Asserted on the object the
  // code sends rather than by grepping the source, so a comment cannot fail the build.
  const headers = managedHeaders({ baseUrl: 'https://h.example', apiKey: 'k', deployment: 'd', route: '/r' })
  assert.deepEqual(Object.keys(headers).sort(), ['api-key', 'content-type'])
  assert.equal(headers['authorization'], undefined)
  // `model` is required in the body and its value is the DEPLOYMENT name, not the catalogue name.
  assert.equal(MODEL_FIELD, 'model')
  assert.equal(modelValueFor({ baseUrl: '', apiKey: '', deployment: 'qwen--qwen-image-2512', route: '' }), 'qwen--qwen-image-2512')
  // Still true on the images route: `model` carries the deployment name, not the catalogue name.
  // The near miss: the natural spelling of the Cosmos deployment is a measured 404.
  assert.equal(providerById('cosmos-3-super').deployment, 'nvidia--cosmos3-super')
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

test('the Qwen envelope carries the prompt verbatim and transposes the size', () => {
  const qwen = providerById('qwen-image-2512')
  assert.equal(qwen.adapter, 'foundry-openai-images')
  assert.equal(qwen.implemented, true)
  const backend = openAiImagesBackend(qwen, {
    baseUrl: 'https://h.example',
    apiKey: 'k',
    deployment: 'qwen--qwen-image-2512',
    route: '/openai/v1/images/generations',
  })
  const prompt = 'first paragraph\n\nthe name is "Forge Trade" — accent #2a9e93\n\nlast paragraph'
  const body = backend.bodyFor({
    prompt,
    spec: { kind: 'wordmark', width: 1024, height: 384, format: 'png' },
    requestWidth: 1024,
    requestHeight: 384,
    kitName: 'Forge Trade',
    accent: '#2a9e93',
  })

  // Parity: untouched, un-prefixed, un-truncated.
  assert.equal(body['prompt'], prompt)
  assert.equal(body['model'], 'qwen--qwen-image-2512')
  // Required; the OpenAI default `url` is a measured 400 from the model itself.
  assert.equal(body['response_format'], 'b64_json')
  assert.equal(body['n'], 1)

  // THE TRAP. Asking this endpoint for 1024x384 delivers 384x1024 while reporting 1024x384, so
  // the envelope asks for the transpose. A square probe cannot see this — which is how it survived
  // a careful handover — and every wordmark, OG card and banner in the estate is non-square.
  assert.equal(body['size'], '384x1024')
  assert.equal(sizeParamFor(1280, 640), '640x1280')
  assert.equal(sizeParamFor(512, 512), '512x512', 'squares are unaffected, which is why it hides')

  // width/height are a measured `unrecognized_request_argument` here; the reference provider is
  // the exact mirror image, taking those and ignoring `size`.
  assert.equal(body['width'], undefined)
  assert.equal(body['height'], undefined)
  assert.deepEqual(
    Object.keys(body).sort(),
    ['model', 'n', 'prompt', 'response_format', 'size'],
    'the body grew a field; if it is prompt-adjacent, parity is at risk',
  )
})

test('the two implemented backends are given the identical prompt for one asset', () => {
  // The end-to-end version of the parity property: same asset, both live providers, compare the
  // strings that reach the wire rather than the strings that go into the builders.
  const qwen = providerById('qwen-image-2512')
  const prompt = 'a prompt with\n\nparagraphs and "quotes" and — dashes'
  const request = {
    prompt,
    spec: { kind: 'mark' as const, width: 1024, height: 1024, format: 'png' as const },
    requestWidth: 1024,
    requestHeight: 1024,
    kitName: 'x',
    accent: '#e8622c',
  }
  const qwenBody = openAiImagesBackend(qwen, {
    baseUrl: 'https://h.example',
    apiKey: 'k',
    deployment: qwen.deployment!,
    route: qwen.route!,
  }).bodyFor(request)
  const fluxBody = referenceBackend(REFERENCE, {
    endpoint: 'https://f.example',
    apiKey: 'k',
    imagePath: '/p',
    model: 'FLUX.2-pro',
    fallbackModel: '',
  }).bodyFor(request)
  assert.equal(qwenBody['prompt'], fluxBody['prompt'])
  assert.equal(qwenBody['prompt'], prompt)
})

test('c2pa is read off the bytes, never asserted', () => {
  assert.equal(measureC2pa(Buffer.from('\x89PNG....c2pa....')), true)
  assert.equal(measureC2pa(Buffer.from('\x89PNG....IDAT....')), false)
})
