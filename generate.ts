/**
 * The Emberkin generation run. Drives `@cloudsforge/studio`'s own FLUX 2 Pro engine and records
 * the provenance the service's `generation_jobs` and `assets` tables record.
 *
 * ## What is reused, and what deliberately is not
 *
 * **Reused verbatim, by import:** `studio/src/backend.ts` (the endpoint contract — `model`
 * required in the body, the dotted spelling, `aspect_ratio` accepted and ignored, dimensions
 * floored to a multiple of 16, `output_format:png` required, C2PA read from the bytes),
 * `specs.ts` (the round-up arithmetic), `sizing.ts` (measure, never relabel) and the licence
 * constant from `assets.ts`. Every one of those facts cost a real request to learn and is under
 * test in the service; a second copy here would be a second place for it to rot. `studio/` is not
 * modified.
 *
 * **Not reused:** `studio/src/prompt.ts`. That module's art direction is "flat geometric vector,
 * one accent, no gradients" — correct for a software brand mark and wrong for a creature. Fifty
 * Kin drawn to it would be fifty logos. The art direction here is written instead from the game's
 * own `docs/ART_BIBLE.md` §1 pillars, and the parts of the brand voice that DO apply — the ground,
 * the accent discipline on chrome, the lettering clause — are carried across explicitly and are
 * marked with the defect each answers.
 *
 * ## Usage
 *
 *   cd ../studio && node --import tsx ../emberkin-assets/generate.ts --plan     # write PLAN.json only
 *   cd ../studio && node --import tsx ../emberkin-assets/generate.ts            # everything missing
 *   cd ../studio && node --import tsx ../emberkin-assets/generate.ts --only species/cindercub
 *   cd ../studio && node --import tsx ../emberkin-assets/generate.ts --force --only title/wordmark
 *   cd ../studio && node --import tsx ../emberkin-assets/generate.ts --derive-only
 *
 * It is run from `studio/` so `tsx` resolves out of that workspace's `node_modules`. All paths
 * here come from `import.meta.dirname`, never from the working directory.
 */

import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { ImageBackendError, type Attempt } from '../studio/src/backend.ts'
import { requestSizeFor, specFor, type AssetKind, type AssetSpec } from '../studio/src/specs.ts'
import { reportSizing } from '../studio/src/sizing.ts'
import { GENERATED_LICENCE } from '../studio/src/assets.ts'

import { backendFor, UnimplementedBackendError, type GenerationRequest, type ProviderBackend } from './backends.ts'
import { REFERENCE, providerById, assetsDirOf, manifestPathOf, type Provider } from './providers.ts'
import { identityFor, promptForProvider } from './replay.ts'
import {
  plannedAssets,
  colourWordForHex,
  PALETTE,
  FAMILIES,
  type PlannedAsset,
} from './plan.ts'

const run = promisify(execFile)

const HERE = import.meta.dirname
const PLAN_JSON = join(HERE, 'PLAN.json')
const ENV_FILE = join(HERE, '..', 'studio', '.env.local')

/* ------------------------------------------------------------------ configuration */

/**
 * Read `studio/.env.local` into this process without printing any of it.
 *
 * Copied from `brand/generate.ts`, which is deliberately not `dotenv`: this is fifteen lines and
 * the dependency would be the only one in this repository. Values are never echoed — not on
 * success, not in an error, not in a summary line — because the Foundry key is a spend credential.
 */
async function loadEnvFile(path: string): Promise<void> {
  const text = await readFile(path, 'utf8')
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (!(key in process.env)) process.env[key] = value
  }
}

/* ------------------------------------------------------------------ the prompt */

/** The one ground colour the whole estate sits on. design-system.md §7, verbatim. */
const BRAND_GROUND = '#12100f'

/**
 * The shared art direction for the fifty portraits. ART_BIBLE.md §1, rendered as a prompt.
 *
 * This paragraph is IDENTICAL on all fifty, and that is its entire job: it is what makes the set
 * read as one game's dex rather than as fifty pictures of animals. The only things that vary
 * between portraits are the subject, the type anchor and the stage.
 */
const SPECIES_STYLE =
  `Creature concept art ON A FLAT NEAR-BLACK BACKGROUND, hex ${BRAND_GROUND}, for a ` +
  'monster-collecting role-playing game, drawn as one member of an existing family of creature ' +
  'designs. Stylised painterly physically-based rendering at mid roughness: soft normal detail, ' +
  'broad gradient ramps rather than photo-real grime, and a clean warm rim light along the top ' +
  'and back edges so the creature pops away from that dark ground. Saturated, type-coded albedo. ' +
  'Appealing, expressive, readable at a glance. It is not photo-real, not a photograph, not a ' +
  'person in a costume, not a plush toy, not a taxidermy mount, not a turntable render and not a ' +
  'sticker.'

/**
 * The first pillar, restated as its own paragraph. ART_BIBLE.md §1: "every Kin must be
 * recognisable as a black shape. One primary silhouette motif per creature."
 *
 * The count clause at the end is not decoration. The brand run's recorded finding was that "the
 * model approximates any exact count, always plausibly and never exactly" — and the count that
 * matters most here is ONE, because a dex portrait containing two creatures is unusable.
 */
const SILHOUETTE_CLAUSE =
  'Silhouette first: the creature must be recognisable from its outline alone, as a single solid ' +
  'black shape. One primary silhouette motif, unbroken, unmistakable at thumbnail size. Full ' +
  'body, three-quarter front view, standing, the whole creature inside the frame with an even ' +
  'margin on all four sides. There is EXACTLY ONE creature in the picture: no second creature, no ' +
  'smaller copy of it, no companion, no reflection, no turnaround, no side view beside it, and no ' +
  'inset panel.'

/** Flat chrome: type icons, UI glyphs and frames, the wordless mark and the wordmark. */
const ICON_STYLE =
  'A single piece of user-interface artwork for a video game, drawn as one member of an existing ' +
  'family of icons. Flat geometric vector: every shape constructed from circles, squares and ' +
  '45-degree chamfers on one grid, one uniform stroke weight throughout, sharp corners left ' +
  'sharp, generous negative space, optically centred, and legible when it is shrunk to 24 pixels. ' +
  'Flat fills only: no gradients, no photographic texture, no bevels, no drop shadows, no glow, ' +
  'no 3D, no photo-realism, no weathering.'

/** Keyart, the capsule, the hero, the OG card and the social banner. */
/**
 * The scene style, plus the guard on the one thing that broke a scene.
 *
 * `title/social` came back as a rounded-cornered banner floating in the middle of a WHITE page —
 * the model drew a picture OF a social card rather than the card's artwork, which is a sensible
 * reading of "social card" and produces a file whose edges are 97% white against a ceiling of 12%.
 * Nothing in the style paragraph said the painting IS the file, so the last clause says it, in the
 * same terms `FLAT_GROUND_CLAUSE` had to learn to use for the flat assets.
 */
const SCENE_STYLE =
  'Key art for a monster-collecting role-playing game: painted, cinematic, high contrast, ' +
  'saturated without being garish, with deep atmospheric perspective and volumetric light. It is ' +
  'a painting, not a photograph: no lens flare, no chromatic aberration, no depth-of-field bokeh ' +
  'discs, no letterboxing, no user interface overlay, no watermark and no signature. The painting ' +
  'FILLS THE WHOLE IMAGE, edge to edge and corner to corner, and is dark at its edges: it is not ' +
  'a picture of a card, a banner, a poster, a screen, a mock-up or a device, it has no rounded ' +
  'corners, no border, no margin, no mount, no drop shadow and no page behind it, and there is no ' +
  'white, cream, grey or paper-coloured area anywhere in the frame.'

/**
 * The ground, restated LAST as its own paragraph.
 *
 * This is the brand run's most expensive lesson and it is carried across unchanged in substance.
 * `studio/src/prompt.ts` already named the ground, but it named it in the MIDDLE of the style
 * paragraph, and the first live image of that run came back on a mid-grey taupe field with
 * construction guides ruled across it. A constraint stated mid-paragraph is treated as a
 * suggestion. The two additions here are specific to creature art: a portrait model's instinct is
 * to put the animal on a floor and light a backdrop behind it, and either turns the ground into a
 * gradient that no amount of numeric snapping can repair without eating the artwork.
 */
const FLAT_GROUND_CLAUSE =
  `The background is one flat, uniform, unbroken near-black warm ash field, hex ${BRAND_GROUND}, ` +
  'filling the entire frame from edge to edge behind the subject — not grey, not taupe, not ' +
  'beige, not cream, not ivory, not off-white, not paper, not parchment, not a gradient, not a ' +
  'vignette, not a radial glow, not a spotlight, not a studio backdrop, and not lighter at the ' +
  'corners or behind the subject. The subject is bright against a dark ground, never dark against ' +
  'a light one, and the image is never inverted. It is not standing on anything: no floor, no ' +
  'ground plane, no platform, no pedestal, no podium, no horizon line, no cast shadow and no ' +
  'contact shadow. Draw only the subject itself: no construction lines, no grid, no guides, no ' +
  'ruled margins, no border, no frame, no bounding box, no registration marks, no colour swatches ' +
  'and no drop shadow.'

/**
 * The last line on every flat asset, and the shortest paragraph in the prompt.
 *
 * The wordmark on the first live batch of this run came back as an orange lockup on a CREAM field
 * — the same inversion the brand run saw once and recorded as "one later attempt inverted to a
 * near-white field". A long ground paragraph is evidently skimmable; a one-sentence restatement in
 * the final position is not, and it costs nothing. This is the same lesson as the ground clause
 * itself, applied one level further: position beats length.
 */
const DARK_TAIL =
  `Overall this image is DARK. The background is ONE SINGLE FLAT COLOUR, near-black ${BRAND_GROUND}, ` +
  'with no shading, no lighting, no shadow, no floor and no texture of any kind on it anywhere. ' +
  'It is NOT white, NOT cream and NOT grey. The artwork floats free on it with nothing beneath ' +
  'it, and is the only bright thing in the frame.'

/**
 * Per-set hardening, each clause written against a defect seen in THIS run's own output.
 *
 * **species — the dex card.** The first live portrait, Cindercub, came back with the creature's
 * name set in gold under it, a garbled second line beneath that, and an invented artist signature
 * in the corner — despite `NO_TEXT`. The source of it is this prompt's own subject paragraph,
 * which quotes the species' `category` from `species.json`: given a quoted string and a creature,
 * the model draws a trading card. The category is genuinely useful direction, so it is kept and
 * unquoted, and the card itself is forbidden by name here — in the final position, where the
 * ground clause had to go for exactly the same reason.
 */
const HARDENING: Readonly<Record<string, string>> = {
  species:
    'This is a single piece of creature art, not a trading card and not a page from a book. ' +
    'There is no nameplate, no name banner, no caption bar, no ribbon, no scroll, no type badge, ' +
    'no element symbol, no stat block, no number, no border, no card frame, no artist signature ' +
    'and no watermark. Do not write the creature\'s name anywhere. Do not draw a card.',
  types: '',
  ui: '',
  biomes: '',
  title: '',
}

/** The scene equivalent. A picture cannot have a flat ground, but it can refuse to be pale. */
const SCENE_GROUND_CLAUSE =
  'The darkest values in this picture are a warm near-black ash, hex ' +
  `${BRAND_GROUND}, and the four outer edges of the frame fall away into that darkness rather ` +
  'than into grey, white or pale blue. It is a dusk or an interior, never a bright daylight ' +
  'scene, and never a light or white background. Draw only the picture: no border, no frame, no ' +
  'letterbox bars, no drawn vignette ring, no user interface, no logo and no signature.'

const NO_TEXT =
  'Nothing is written anywhere in this image: no text, no lettering, no numerals, no caption, no ' +
  'label, no title, no logo, no watermark and no signature. If any string would appear, leave ' +
  'that area empty instead.'

/**
 * The lettering clause, for the four assets that carry the title.
 *
 * Carried across from the brand run, where the failure was never a misread of the name: it was a
 * SECOND phrase arriving that nobody asked for, sourced from the prompt's own vocabulary —
 * "Sftware Company" from the style paragraph's opening words, "Quench Curve / ash ridge" from the
 * plan's own prose. So the clause forbids the CATEGORY, and the name is spelled character by
 * character, which is the one thing that reliably moves an image model off an invented string.
 *
 * The blocklist is this repository's vocabulary rather than the brand run's, because that is where
 * the leak comes from. `Resonance` is on it deliberately: it is the real subtitle, so it is the
 * single most likely second line to appear, and the client typesets it rather than the model.
 */
function letteringClause(name: string): string {
  const spelled = name
    .split('')
    .map((character) => (character === ' ' ? 'space' : character))
    .join('-')
  return (
    `The ONLY text anywhere in this image is the title "${name}", set once. Spelled character by ` +
    `character it is: ${spelled}. Nothing else is written anywhere in the frame: no subtitle, no ` +
    'tagline, no strapline, no second line, no caption, no label, no annotation, no legend, no ' +
    'studio name, no platform badge, no age rating, no review quote, no release date, no word ' +
    'naming a part of the picture, no word taken from any description of the picture, no words ' +
    'such as "resonance", "kin", "warden", "temperament", "sync", "shard", "ember", "creature", ' +
    '"monster", "game", "keyart" or "capsule", no invented words, no misspelled or partial words, ' +
    'no repeated title, no URL, no dot-com and no registered mark. If any other string would ' +
    'appear, leave that area empty instead.'
  )
}

/**
 * The accent clause for flat chrome, carried across from the brand run.
 *
 * The defect it answers: Hub's OG card drew its ridge in mid-grey with a five-pixel ember diamond
 * and Worlds drew its whole settlement in white — a mark that cannot be told from any other
 * surface's, which is the entire job the accent does. The bone exemption is design-system.md §5's
 * own ground line in `--cf-fg-mute`, so forbidding a second colour outright would forbid the
 * family's construction.
 *
 * The clause named the hex and nothing else, and on eight of the nine type icons that was enough.
 * On the ninth it was not: `types/verdant` is a leaf, and it came back at hue 87 against an anchor
 * at 135 — 47 degrees of yellow, from a prompt that stated #5fce7a twice. The same lesson the
 * albedo clause is built on ("a bare hex reads as noise to an image model") applies here, so the
 * anchor's plain-language name is now stated beside it. `verify.py` measures both.
 */
function accentClause(accent: string): string {
  const { name, qualifier } = colourWordForHex(accent)
  const named =
    name === 'its anchor colour'
      ? ''
      : `That colour is ${name}${qualifier ? ` — ${qualifier}` : ''}. `
  return (
    `Every drawn element is filled or stroked in ${accent} — that exact colour, at full strength. ` +
    named +
    'The only permitted exception is a ground line, which may instead be a muted bone #b7ae9b. ' +
    `Nothing is drawn in plain white, plain grey or the ground colour, and ${accent} is the ` +
    'dominant colour of the artwork rather than a small detail on it.'
  )
}

/**
 * The albedo clause. ART_BIBLE.md §1 pillar two, stated as a prohibition — twice.
 *
 * The version this replaced said the anchor "covers most of its body", and the first live
 * Cindercub came back CHARCOAL with orange glowing vents. That is a defensible reading of its
 * silhouette motif ("smouldering vents, ember-lit underbelly"), and it is exactly the wrong
 * reading of the specification: the art bible says "base albedo is driven by the type palette",
 * and a creature whose body is black with a coloured emission mask has no type colour at all at
 * thumbnail size — which is where a player actually reads it, and which is the entire reason the
 * pillar exists.
 *
 * So the clause names the SURFACE — fur, scales, hide, plating — rather than "the albedo",
 * forbids the specific substitution that happened (black, charcoal, grey, white bodies with the
 * anchor demoted to a glow), and states the test a reader applies: what colour is this creature.
 *
 * ═══ The nine strings this file used to keep for itself, and the call they cost. ═══
 *
 * There were TWO copies of the anchors' colour words: `plan.ts`'s, which writes the subject line,
 * and a second one here, which writes this clause. Correcting verdant in `plan.ts` alone left the
 * four repetitions below still saying "fresh leaf green", and since this clause is the loudest
 * statement of colour in the prompt — capitals, hex, and a naming test — the correction lost.
 * Seedling was regenerated against the "fixed" prompt and came back at hue 67, unchanged from the
 * 74 it had before. One paid call to discover a second copy of a table. There is now one table,
 * in `plan.ts`, and this file looks its entry up by hex.
 *
 * ═══ The motif override, which is the other half of the umbra defect. ═══
 *
 * Shadepup's silhouette motif, read verbatim out of `visuals.json`, is "shadow wisps, void-black
 * core", and the picture that came back was 0.13% ink: a black creature on a black ground, which
 * is a blank. Nocthound and Umbrawulf are the same motif and came back the same way. The motif is
 * upstream content and correct — it describes the SHAPE — but nothing in the prompt said so, and
 * "void-black" beside an albedo is read as an albedo. So the clause now says which of the two the
 * motif is. This matters beyond umbra: ember has "smouldering vents", frost has "void" language
 * further down the dex, and every one of them is a shape.
 */
function albedoClause(accent: string, secondary: string | null): string {
  const { name: word, qualifier } = colourWordForHex(accent)
  const shade = qualifier ? ` — ${qualifier} — ` : ', '
  const second = secondary
    ? `Its one permitted second colour is ${colourWordForHex(secondary).name} ` +
      `${secondary}, blended into the primary along the silhouette and concentrated at the ` +
      'extremities. '
    : 'It has no second colour. '
  return (
    `THE CREATURE ITSELF IS ${word.toUpperCase()}. Its fur, scales, hide, skin or plating — the ` +
    `actual surface of the animal — is ${word}${shade}hex ${accent}, over the whole of its ` +
    'body, in the light and in the shadow, and the deeper and lighter values on it are deeper ' +
    'and lighter values OF THAT SAME COLOUR. Asked what colour this creature is, a viewer says ' +
    `"${word}" immediately and without hesitating. ${second}` +
    'It is NOT a black creature, NOT a charcoal one, NOT dark grey, NOT white and NOT ' +
    `neutral-coloured with ${word} markings, glowing seams or lit accents on it — the colour is ` +
    'the animal, not a decoration applied to it. THE SILHOUETTE MOTIF ABOVE NAMES SHAPES AND ' +
    'MATERIALS, NEVER COLOURS. Whatever material it names — bark, wood, leaf, moss, stone, ' +
    'mineral, metal, bone, feather, ice, frost, water, cloud, smoke, ash, shadow or void — is ' +
    `carved out of the creature itself and is therefore drawn in ${word}, in deeper and lighter ` +
    `values of ${word}, and never in that material's own real-world colour: no brown bark, no ` +
    'grey stone, no white ice, no black shadow. It is a brightly coloured animal that HAS a ' +
    'wooden or icy or shadowy shape, not an animal made of wood or ice or shadow. Apart from ' +
    'that, the only other values anywhere on it are the near-neutral darks of its own shadow, ' +
    'the warm off-white of its rim light, and the whites of its eyes and teeth. No third hue, no ' +
    'rainbow, no unrelated accent, no coloured jewellery, and no armour in a metal that is not ' +
    'already its own colour.'
  )
}

const LETTERING_LEAK_GUARD =
  'Draw the subject exactly ONCE, filling the frame. Do not repeat it, do not inset a second ' +
  'smaller copy, do not add a thumbnail, a preview box, a framed panel, a tile, a mirror, a ' +
  'variant or a sheet of alternates beside or below it.'

/**
 * Assemble one prompt.
 *
 * Order matters and is the same order `studio/src/prompt.ts` argues for: style first, subject
 * second, colour third, prohibitions LAST. A prohibition placed before the subject is routinely
 * ignored by image models, which is how "no text" produces a mark with a word in it.
 */
export function promptFor(planned: PlannedAsset, omitFlavour = false): string {
  const style =
    planned.set === 'species'
      ? SPECIES_STYLE
      : planned.ground === 'scene'
        ? SCENE_STYLE
        : ICON_STYLE

  const colour =
    planned.set === 'species'
      ? albedoClause(planned.accent, planned.secondaryAccent)
      : planned.ground === 'flat'
        ? accentClause(planned.accent)
        : ''

  const parts = [
    style,
    planned.set === 'species' ? SILHOUETTE_CLAUSE : LETTERING_LEAK_GUARD,
    planned.subject,
    omitFlavour ? '' : (planned.flavour ?? ''),
    colour,
    planned.ground === 'flat' ? FLAT_GROUND_CLAUSE : SCENE_GROUND_CLAUSE,
    planned.lettering ? letteringClause(planned.lettering) : NO_TEXT,
    HARDENING[planned.set] ?? '',
    planned.ground === 'flat' ? DARK_TAIL : '',
  ]
  return parts.filter((part) => part.trim().length > 0).join('\n\n')
}

/* ------------------------------------------------------------------ the manifest */

export interface ManifestEntry {
  /**
   * The provider id from providers.json. Added when the set stopped being the only set: without
   * it, two manifests describing two different models would be distinguishable only by which
   * directory they were found in, and compare.py would be reading a fact off a path.
   */
  readonly provider: string
  /** `species/cindercub`. Stable across runs; the manifest is keyed on it plus the declared size. */
  readonly asset: string
  readonly set: string
  readonly slug: string
  readonly name: string
  readonly path: string
  /** The type anchor, or the estate ember on chrome. `verify.py` measures against this. */
  readonly accent: string
  readonly secondaryAccent: string | null
  /** `flat` (snapped to #12100f) or `scene` (held to a darkness ceiling, never snapped). */
  readonly groundClass: string
  /** Family root id, for a species portrait. This is what the family consistency check groups on. */
  readonly family: string | null
  readonly stage: string | null
  /** What the plan declares this asset must end up at. */
  readonly declaredSize: string
  /** What was asked of FLUX — rounded UP to the 16-pixel grid, never down. */
  readonly requestedSize: string
  /** What the bytes on disk actually measure. */
  readonly deliveredSize: string
  /** `exact` | `unsized` | `unknown`, from the service's own sizing report. */
  readonly sizing: string
  readonly cropped: boolean
  /** Set on a derivative; names the as-delivered file it was cut or resampled from. */
  readonly derivedFrom: string | null
  readonly backend: string
  readonly model: string | null
  readonly prompt: string
  /**
   * Null on every asset here: this deployment of FLUX 2 Pro accepts no seed parameter, so nothing
   * true can be recorded. Kept as a column so the absence is a stated fact rather than a missing
   * field, and so a seeded model later has somewhere to put one.
   */
  readonly seed: number | null
  readonly sha256: string
  readonly byteSize: number
  readonly generatedAt: string
  /** Read from the bytes on disk, not assumed from the vendor. */
  readonly c2pa: boolean
  /** Generations beyond the first that were needed before this file was accepted. */
  readonly retries: number
  readonly licence: string
  readonly providerCostUnits: number | null
  readonly providerOutputMegapixels: number | null
  /** Where in the game's own specification this asset's brief came from. */
  readonly sourceSpec: string
  /**
   * `full`, or `lore-omitted` when the content filter refused the full prompt and the species'
   * flavour line was dropped to get past it. Recorded because it means this portrait was drawn
   * from strictly less of the game's own specification than its siblings were.
   */
  readonly promptVariant: string
  /** Every post-processing step applied to the bytes since delivery, in order. */
  readonly postProcessing: readonly string[]
  /** The ground FLUX actually delivered, before normalisation. Written by normalise_ground.py. */
  readonly deliveredGround: string | null
  /** Every attempt made, including the ones that failed. Details are redacted by the service. */
  readonly attempts: readonly Attempt[]
  readonly note?: string
}

type Manifest = Record<string, ManifestEntry>

const keyOf = (asset: string, size: string): string => `${asset}@${size}`

async function readManifest(provider: Provider): Promise<Manifest> {
  const path = manifestPathOf(provider)
  if (!existsSync(path)) return {}
  const parsed = JSON.parse(await readFile(path, 'utf8')) as { assets?: ManifestEntry[] }
  const out: Manifest = {}
  for (const entry of parsed.assets ?? []) out[keyOf(entry.asset, entry.declaredSize)] = entry
  return out
}

async function writeManifest(provider: Provider, manifest: Manifest): Promise<void> {
  const assets = Object.values(manifest).sort(
    (a, b) => a.asset.localeCompare(b.asset) || a.path.localeCompare(b.path),
  )
  const document = {
    $comment:
      'Provenance for every image in this repository. One entry per file, carrying the columns ' +
      "studio's generation_jobs and assets tables carry. Generated by generate.ts and updated in " +
      'place by normalise_ground.py and derive.py; do not edit by hand.',
    provider: provider.id,
    providerLabel: provider.label,
    billing: provider.billing,
    generator: '@cloudsforge/studio via emberkin-assets/generate.ts',
    endpoint: 'Azure AI Foundry, Black Forest Labs FLUX 2 Pro',
    specification:
      'kindred-upstream/content/{species,visuals,types,campaign}.json and docs/ART_BIBLE.md; ' +
      'the set is defined by docs/ecosystem/19-new-products.md §1.4.',
    disclosure:
      'Every image here is AI-generated. Each as-delivered file carries C2PA provenance and a ' +
      'Microsoft invisible watermark. Ground normalisation preserves the C2PA chunk by copying ' +
      'every ancillary chunk through; a derivative re-encoded by Pillow does not, and each ' +
      "derivative names the file it came from and reports the c2pa state actually measured.",
    licence: GENERATED_LICENCE,
    assetCount: assets.length,
    updatedAt: new Date().toISOString(),
    assets,
  }
  await mkdir(provider.root, { recursive: true })
  await writeFile(manifestPathOf(provider), `${JSON.stringify(document, null, 2)}\n`, 'utf8')
}

/* ------------------------------------------------------------------ generation */

/** The C2PA box identifier, in the PNG's metadata chunks. Same marker the service reads. */
const C2PA = Buffer.from('c2pa')

const sha256 = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex')

/**
 * The `AssetSpec` kind carried on the request.
 *
 * It is provenance and shape only: the FLUX backend sends `width`/`height` from
 * `requestWidth`/`requestHeight`, and `spec` is read by the placeholder backend, which this run
 * never reaches. The mapping is by proportion so the recorded kind is not a lie.
 */
function assetKindFor(planned: PlannedAsset): AssetKind {
  if (planned.key === 'title/og') return 'og'
  if (planned.key === 'title/social') return 'social'
  if (planned.key === 'title/wordmark') return 'wordmark'
  if (planned.ground === 'scene') return 'banner'
  if (planned.width === planned.height) return planned.width <= 512 ? 'icon' : 'mark'
  return 'banner'
}

function specForPlanned(planned: PlannedAsset): AssetSpec {
  return specFor(assetKindFor(planned), { width: planned.width, height: planned.height })
}

function fileNameFor(planned: PlannedAsset, requested: { width: number; height: number }): string {
  const onGrid = requested.width === planned.width && requested.height === planned.height
  // A cropped asset keeps BOTH files: the as-delivered one, which still carries its C2PA chunk,
  // and the cut-down one the platform actually requires. Naming the as-delivered file for what it
  // is stops it being mistaken for the shippable asset.
  return onGrid
    ? `${planned.slug}-${planned.width}x${planned.height}.png`
    : `${planned.slug}-${requested.width}x${requested.height}-asdelivered.png`
}

/**
 * True when a refusal was the CONTENT filter rather than a malformed request.
 *
 * The two are both 400s and both correctly non-retryable at the fallback model, but they call for
 * different responses: a malformed request is a bug in this file, and a refused one is a sentence
 * of the game's own flavour text that Azure will not draw. Only the second has a cheaper prompt
 * available to try.
 */
function isContentRefusal(err: unknown): boolean {
  if (!(err instanceof ImageBackendError) || err.code !== 'bad_request') return false
  const text = `${err.message} ${err.attempts.map((a) => a.detail).join(' ')}`.toLowerCase()
  return text.includes('content_safety') || text.includes('rai policy') || text.includes('blocklist')
}

async function generateOne(
  provider: Provider,
  backend: ProviderBackend,
  planned: PlannedAsset,
  previousRetries: number,
  reprompt: boolean,
  omitFlavour = false,
): Promise<ManifestEntry> {
  const spec = specForPlanned(planned)
  const requested = requestSizeFor({ width: planned.width, height: planned.height })
  // Replayed from the reference manifest where there is a record, computed only where there is
  // not. See replay.ts for why that asymmetry is the whole parity guarantee.
  //
  // `omitFlavour` is this repository's own wrinkle and replay handles it correctly by not caring:
  // a second content refusal drops the lore line, which produces a DIFFERENT prompt, and what goes
  // on record is whichever one actually succeeded. A candidate then replays that exact string —
  // so the two models are compared on the same question even for the six species where that
  // question ended up shorter than its siblings'.
  const prompt = promptForProvider(
    provider.id,
    planned,
    (asset) => promptFor(asset, omitFlavour),
    { reprompt },
  )

  const request: GenerationRequest = {
    prompt,
    spec,
    requestWidth: requested.width,
    requestHeight: requested.height,
    kitName: planned.name,
    accent: planned.accent,
  }

  // Transport faults and 429s are the two things worth retrying here; the service's own chain
  // handles the model-level fallback, and there is only one model deployed for it to try. A
  // refusal or a credential problem is wrong the same way on every retry and is rethrown at once,
  // which is also the cheapest possible behaviour on a constrained budget.
  const MAX_TRANSIENT = 3
  let transient = 0
  let lastError: unknown = null
  const allAttempts: Attempt[] = []

  for (let go = 0; go <= MAX_TRANSIENT; go += 1) {
    try {
      const result = await backend.generate(request, AbortSignal.timeout(300_000))
      allAttempts.push(...result.attempts)
      const [directory] = planned.key.split('/')
      const dir = join(assetsDirOf(provider), directory!)
      await mkdir(dir, { recursive: true })
      const fileName = fileNameFor(planned, requested)
      const path = join(dir, fileName)
      await writeFile(path, result.bytes)

      const sizing = reportSizing(
        result.bytes,
        { width: requested.width, height: requested.height },
        'png',
      )
      const delivered = sizing.actual ? `${sizing.actual.width}x${sizing.actual.height}` : 'unknown'
      const isSource = fileName.includes('asdelivered')

      return {
        asset: isSource ? `${planned.key}-source` : planned.key,
        set: planned.set,
        slug: planned.slug,
        name: planned.name,
        path: `assets/${directory}/${fileName}`,
        accent: planned.accent,
        secondaryAccent: planned.secondaryAccent,
        groundClass: planned.ground,
        family: planned.family,
        stage: planned.stage,
        declaredSize: isSource
          ? `${requested.width}x${requested.height}`
          : `${planned.width}x${planned.height}`,
        requestedSize: `${requested.width}x${requested.height}`,
        deliveredSize: delivered,
        sizing: sizing.sizing,
        cropped: false,
        derivedFrom: null,
        provider: provider.id,
        backend: result.backend,
        model: result.model,
        prompt,
        seed: result.seed,
        sha256: sha256(result.bytes),
        byteSize: result.bytes.length,
        generatedAt: new Date().toISOString(),
        // Measured on the bytes, never asserted from the vendor. The standing rule.
        c2pa: result.c2pa,
        retries: previousRetries + transient,
        licence: GENERATED_LICENCE,
        providerCostUnits: result.providerCostUnits,
        providerOutputMegapixels: result.providerOutputMegapixels,
        sourceSpec: planned.source,
        promptVariant: omitFlavour && planned.flavour ? 'lore-omitted' : 'full',
        postProcessing: [],
        deliveredGround: null,
        attempts: allAttempts,
        ...(omitFlavour && planned.flavour
          ? {
              note:
                'Azure\'s content filter refused the full prompt with ' +
                'content_safety_violation. The species\' lore line — the only free-form prose in ' +
                'the prompt, and the only part written for a player rather than for a filter — ' +
                `was dropped and the request repeated. The omitted line was: "${planned.flavour}"`,
            }
          : {}),
        ...(isSource
          ? {
              note:
                `As delivered at ${requested.width}x${requested.height}. The declared ` +
                `${planned.width}x${planned.height} is not a multiple of 16, so it was asked for ` +
                'rounded UP and cut down rather than upscaled. This file is kept because it is ' +
                'the one that still carries the C2PA chunk.',
            }
          : {}),
      }
    } catch (err) {
      lastError = err
      // An unimplemented backend is wrong on every retry and for every asset. Fail the whole run
      // at once rather than N times per asset across the set.
      if (err instanceof UnimplementedBackendError) throw err
      if (err instanceof ImageBackendError) {
        allAttempts.push(...err.attempts)
        if (err.code === 'bad_request' || err.code === 'unauthorised') throw err
      }
      transient += 1
      if (go === MAX_TRANSIENT) break
      const backoffMs = 2_000 * 2 ** go
      process.stdout.write(`    ${planned.key}: transient failure, retrying in ${backoffMs / 1000}s\n`)
      await new Promise((resolve) => setTimeout(resolve, backoffMs))
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

/* ------------------------------------------------------------------ derivatives */

/**
 * Cut the OG card down from its as-delivered 640, in Python's Pillow.
 *
 * Pillow rather than macOS `sips`, so this is reproducible off one laptop — design-system.md §7
 * item 3 names `sips` as the reason twelve game masters still sit at 1024 against a declared 512.
 * A derivative is re-encoded and so loses the PNG's C2PA chunk while keeping the invisible pixel
 * watermark; `derive.py` reports the C2PA state it measures rather than inheriting the claim.
 */
async function derive(provider: Provider): Promise<ManifestEntry[]> {
  const { stdout } = await run('python3', [join(HERE, 'derive.py'), '--provider', provider.id], {
    maxBuffer: 32 * 1024 * 1024,
  })
  return JSON.parse(stdout) as ManifestEntry[]
}

/* ------------------------------------------------------------------ the reviewable plan */

/**
 * Write `PLAN.json`: the whole derived set, with every prompt, before anything is spent.
 *
 * This is the artefact that makes the run reviewable rather than merely repeatable. It is
 * committed, so the derivation from `visuals.json` can be audited without the upstream checkout
 * beside it, and a prompt can be read and argued with before it costs money.
 */
async function writePlanJson(): Promise<number> {
  const planned = plannedAssets()
  const requested = (asset: PlannedAsset) =>
    requestSizeFor({ width: asset.width, height: asset.height })
  const document = {
    $comment:
      'The generation plan, derived by plan.ts from kindred-upstream/content and written by ' +
      '`generate.ts --plan`. Reviewable before a single generation is paid for. Do not edit by ' +
      'hand: it is regenerated from the content, which is the point of it.',
    generatedAt: new Date().toISOString(),
    palette: PALETTE,
    families: FAMILIES,
    counts: planned.reduce<Record<string, number>>((acc, asset) => {
      acc[asset.set] = (acc[asset.set] ?? 0) + 1
      return acc
    }, {}),
    total: planned.length,
    assets: planned.map((asset) => ({
      key: asset.key,
      set: asset.set,
      name: asset.name,
      declaredSize: `${asset.width}x${asset.height}`,
      requestedSize: `${requested(asset).width}x${requested(asset).height}`,
      groundClass: asset.ground,
      accent: asset.accent,
      secondaryAccent: asset.secondaryAccent,
      family: asset.family,
      stage: asset.stage,
      lettering: asset.lettering,
      sourceSpec: asset.source,
      prompt: promptFor(asset),
    })),
  }
  await writeFile(PLAN_JSON, `${JSON.stringify(document, null, 2)}\n`, 'utf8')
  return planned.length
}

/* ------------------------------------------------------------------ main */

interface Selection {
  readonly provider: Provider
  readonly force: boolean
  readonly only: ReadonlySet<string> | null
  readonly deriveOnly: boolean
  readonly planOnly: boolean
  readonly limit: number | null
  readonly concurrency: number
  /**
   * Deliberately change the question an already-generated asset is asked. Reference-only, and it
   * makes every candidate's copy of that asset stale — verify.py will say so until they are
   * regenerated. Without it, a regeneration replays the prompt on record, which is what keeps the
   * sets comparable across time.
   */
  readonly reprompt: boolean
}

function parseArgs(argv: readonly string[]): Selection {
  const valueOf = (flag: string): string | null => {
    const index = argv.indexOf(flag)
    return index >= 0 && argv[index + 1] ? argv[index + 1]! : null
  }
  const only = valueOf('--only')
  const limit = valueOf('--limit')
  const concurrency = valueOf('--concurrency')
  const provider = providerById(valueOf('--provider') ?? REFERENCE.id)
  return {
    provider,
    reprompt: argv.includes('--reprompt'),
    // Per provider, from providers.json: a shared serverless endpoint and a dedicated A100 have
    // completely different reasons to be narrow, and the right width for one is wrong for the
    // other. Overridable because the honest value is measured, not predicted.
    concurrency: concurrency && Number(concurrency) > 0 ? Number(concurrency) : provider.concurrency,
    force: argv.includes('--force'),
    deriveOnly: argv.includes('--derive-only'),
    planOnly: argv.includes('--plan'),
    only: only ? new Set(only.split(',').map((s) => s.trim()).filter(Boolean)) : null,
    // A ceiling on how many generations one invocation may pay for. There is no way to ask FLUX
    // what a call costs before making it, so the only real budget control is arithmetic on the
    // number of calls, and it belongs here rather than in a person's memory of how far they got.
    limit: limit && Number.isInteger(Number(limit)) ? Number(limit) : null,
  }
}

async function main(): Promise<void> {
  const selection = parseArgs(process.argv.slice(2))

  const planned = await writePlanJson()
  process.stdout.write(`PLAN.json: ${planned} asset(s) planned\n`)
  if (selection.planOnly) return

  await loadEnvFile(ENV_FILE)
  const provider = selection.provider
  const manifest = await readManifest(provider)
  const startedAt = Date.now()
  process.stdout.write(
    `provider ${provider.id} (${provider.label}) — ` +
      `${provider.shipped ? 'the shipped reference set' : 'a candidate set'}, ` +
      `billed per ${provider.billing.unit}\n`,
  )

  if (!selection.deriveOnly) {
    const backend = backendFor(provider)
    let work = plannedAssets().filter((asset) => {
      if (selection.only && !selection.only.has(asset.key)) return false
      if (selection.force) return true
      // The resume rule: anything already recorded in THIS provider's manifest is done. The
      // manifest is written after every single asset, so an interrupted run — or a redeployed
      // endpoint — costs only the assets that were in flight.
      return manifest[identityFor(asset).key] === undefined
    })
    if (selection.limit !== null) work = work.slice(0, selection.limit)

    process.stdout.write(`${work.length} asset(s) to generate\n`)

    // Three at a time, as the brand run settled on. FLUX takes twenty to forty seconds an image,
    // so serial would be most of an hour for this set; more than a handful in flight is how a
    // shared deployment starts answering 429 and the retry budget goes on capacity, not quality.
    const CONCURRENCY = selection.concurrency
    let cursor = 0
    let failures = 0
    const failed: string[] = []
    const worker = async (): Promise<void> => {
      for (;;) {
        const index = cursor
        cursor += 1
        const asset = work[index]
        if (!asset) return
        const previous = manifest[identityFor(asset).key]
        // A forced regeneration counts as a retry of the asset, whatever the reason: a transport
        // fault and "it drew two creatures" both mean this file was not right the first time.
        const previousRetries = previous ? previous.retries + 1 : 0
        try {
          let entry: ManifestEntry
          try {
            entry = await generateOne(provider, backend, asset, previousRetries, selection.reprompt)
          } catch (err) {
            if (!isContentRefusal(err)) throw err
            // ═══ A MEASURED FINDING, and it contradicts what a 400 usually means. ═══
            //
            // Six species were refused `content_safety_violation (DallEBlockList_Prompt)` on the
            // first full pass. Re-issuing the SAME SIX PROMPTS, unchanged, in the next invocation
            // produced all six on the first attempt. So this deployment's content filter is
            // NON-DETERMINISTIC: a refusal here is not the service telling us the request is
            // wrong, which is what `backend.ts` reasonably assumes a 400 is and why it declines to
            // retry one.
            //
            // The two possibilities were also distinguishable from the refused set itself.
            // Maelhound's lore reads "a savage hunter ... corners prey in the crushing dark" and
            // is an obvious candidate; Dawnfawn's reads "its antlers catch the first light of
            // morning and scatter it as gold", which is not. A filter that refuses the second is
            // not refusing the words.
            //
            // So the first retry repeats the prompt VERBATIM — cheap, and it is what actually
            // worked. Only if that is refused too does the lore line come out, because dropping
            // it means the portrait is drawn from less of the game's own specification than its
            // siblings, and that is a real cost to pay only against a real, repeatable refusal.
            process.stdout.write(`    ${asset.key}: content filter refused, repeating verbatim\n`)
            try {
              entry = await generateOne(provider, backend, asset, previousRetries + 1, selection.reprompt)
            } catch (again) {
              if (!isContentRefusal(again) || !asset.flavour) throw again
              process.stdout.write(
                `    ${asset.key}: refused twice, retrying without its lore line\n`,
              )
              entry = await generateOne(provider, backend, asset, previousRetries + 2, selection.reprompt, true)
            }
          }
          manifest[keyOf(entry.asset, entry.declaredSize)] = entry
          process.stdout.write(
            `  ok  ${asset.key} ${entry.deliveredSize} ` +
              `${(entry.byteSize / 1024).toFixed(0)}KB c2pa=${entry.c2pa} ` +
              `retries=${entry.retries} prompt=${entry.promptVariant}\n`,
          )
          await writeManifest(provider, manifest)
        } catch (err) {
          failures += 1
          failed.push(asset.key)
          const message = err instanceof Error ? err.message : String(err)
          process.stdout.write(`  FAIL ${asset.key}: ${message}\n`)
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker))
    if (failures > 0) {
      process.stdout.write(`\n${failures} asset(s) failed:\n  ${failed.join('\n  ')}\n`)
    }
  }

  // Derivatives are rebuilt from whatever is on disk every run, so a regenerated source can never
  // leave a stale crop behind it.
  for (const entry of await derive(provider)) manifest[keyOf(entry.asset, entry.declaredSize)] = entry
  await writeManifest(provider, manifest)
  process.stdout.write(`\nmanifest: ${Object.keys(manifest).length} entries\n`)
}


/**
 * Only when this file is the program, never on import.
 *
 * `parity.test.ts` imports `promptFor` from here, and a bare `await main()` at module scope meant
 * that importing it started a real generation run — against a live, billed endpoint, from a test.
 * A module that spends money when it is read is a hazard whatever else is true of it.
 */
const invokedDirectly = process.argv[1] !== undefined && process.argv[1].endsWith('generate.ts')

if (invokedDirectly) {
  // The checklist is the entire value of an unimplemented backend, so it is printed in full rather
  // than flattened into a stack trace.
  await main().catch((err: unknown) => {
    if (err instanceof UnimplementedBackendError) {
      process.stderr.write(`\n${err.message}\n`)
      process.exitCode = 2
      return
    }
    throw err
  })
}
