/**
 * The work list, DERIVED from the game's own content rather than hand-written beside it.
 *
 * `micro-brand`'s `plan.ts` copies the surface registry and asserts the copy against the real
 * one at run time, because that registry is a TSX-adjacent package in another workspace. Here the
 * specification is four plain JSON files — `species.json`, `visuals.json`, `types.json` and
 * `campaign.json` — so there is no reason to copy anything at all. This module READS them, and a
 * plan that is read cannot drift from the thing it was read from.
 *
 * That matters more here than it did for the brand set. The art bible's second pillar is
 * "**type is colour**: base albedo is driven by the type palette; evolutions deepen and enrich,
 * never fully recolour — the family reads as a family". A hand-copied palette that fell one hex
 * behind `visuals.json` would produce fifty portraits in a colour the game does not render, and
 * nothing would fail. So:
 *
 *   * the **type palette is derived**, from the `primaryColor` of every single-typed species, and
 *     asserted to be internally consistent and to match the art bible's own table;
 *   * the **families are derived**, by walking `species.json`'s `evolutions` edges back to their
 *     roots, so a new evolution branch upstream becomes a new family member here automatically;
 *   * the **regions are derived** from `campaign.json`.
 *
 * The one thing that is authored here is the *art direction* — what each type's icon is a picture
 * of, what each region looks like, what each UI glyph draws. Those are not in the content, they
 * come from `docs/ART_BIBLE.md` §1, §2 and §5 rendered into prose, and each is written so the
 * generated asset is recognisably the thing the game already specifies.
 *
 * `node --import tsx ../emberkin-assets/generate.ts --plan` writes the derived plan to
 * `PLAN.json`, which IS committed — so the set can be reviewed, and the derivation audited,
 * without the upstream checkout beside it and before a single generation is paid for.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const HERE = import.meta.dirname
const UPSTREAM = join(HERE, '..', 'kindred-upstream')
const CONTENT = join(UPSTREAM, 'content')

/* ------------------------------------------------------------------ the upstream shapes */

interface Species {
  readonly id: string
  readonly dexNumber: number
  readonly name: string
  readonly types: readonly string[]
  readonly category: string
  readonly lore: string
  readonly evolutions?: readonly { readonly into: string; readonly note?: string }[]
}

interface Visual {
  readonly id: string
  readonly name: string
  readonly archetype: string
  readonly stage: string
  readonly primaryColor: string
  readonly secondaryColor: string
  readonly scale: number
  readonly emissive: boolean
  readonly silhouette: string
}

interface Region {
  readonly id: string
  readonly name: string
  readonly act: number
}

const read = <T,>(file: string): T => JSON.parse(readFileSync(join(CONTENT, file), 'utf8')) as T

export const SPECIES: readonly Species[] = read<Species[]>('species.json')
export const VISUALS: readonly Visual[] = read<Visual[]>('visuals.json')
export const REGIONS: readonly Region[] = read<{ regions: Region[] }>('campaign.json').regions
export const ELEMENTS: readonly string[] = read<{ elements: string[] }>('types.json').elements

const VISUAL_BY_ID = new Map(VISUALS.map((v) => [v.id, v]))
const SPECIES_BY_ID = new Map(SPECIES.map((s) => [s.id, s]))

/* ------------------------------------------------------------------ the type palette */

/**
 * The art bible's albedo anchors, §2, transcribed once — and used ONLY as the assertion target.
 *
 * The values the plan actually uses are read out of `visuals.json`. This table exists so that a
 * disagreement between the art bible and the content is a loud failure before anything is spent,
 * rather than fifty portraits in whichever of the two happened to be read.
 */
const ART_BIBLE_PALETTE: Readonly<Record<string, string>> = {
  ember: '#ff6b4a',
  spark: '#ffd23f',
  tide: '#4aa8ff',
  frost: '#8ee7ff',
  verdant: '#5fce7a',
  umbra: '#9a7bd6',
  gale: '#9fd0ff',
  lumen: '#ffe59e',
  stone: '#c9a06b',
}

/**
 * Derive `type -> albedo hex` from the content itself.
 *
 * A single-typed species' `primaryColor` IS its type's anchor, and every one of the nine elements
 * has at least one single-typed species. Two species of one type that disagree is a content bug
 * and throws here rather than being averaged into a colour neither of them uses.
 */
function derivePalette(): Readonly<Record<string, string>> {
  const found: Record<string, string> = {}
  for (const species of SPECIES) {
    if (species.types.length !== 1) continue
    const type = species.types[0]!
    const visual = VISUAL_BY_ID.get(species.id)
    if (!visual) throw new Error(`${species.id} has no entry in visuals.json`)
    const existing = found[type]
    if (existing && existing !== visual.primaryColor) {
      throw new Error(
        `content disagrees about the ${type} albedo: ${existing} and ${visual.primaryColor}`,
      )
    }
    found[type] = visual.primaryColor
  }
  const problems: string[] = []
  for (const element of ELEMENTS) {
    const derived = found[element]
    if (!derived) problems.push(`${element}: no single-typed species to derive an albedo from`)
    else if (derived !== ART_BIBLE_PALETTE[element]) {
      problems.push(
        `${element}: content says ${derived}, ART_BIBLE.md §2 says ${ART_BIBLE_PALETTE[element]}`,
      )
    }
  }
  if (problems.length > 0) {
    throw new Error(`the type palette has drifted:\n  ${problems.join('\n  ')}`)
  }
  return Object.freeze(found)
}

export const PALETTE = derivePalette()

/**
 * Plain-language names for the nine anchors. Used in prompts; a hex alone reads as noise.
 *
 * Three of these were rewritten after measuring the first full pass, and the measurements are the
 * reason rather than taste. `verify.py` reports each portrait's rendered hue against its anchor:
 *
 *   * **verdant** was "fresh leaf green", and all seven verdant Kin came back 52 to 104 degrees
 *     YELLOW of #5fce7a — an olive leaf green, drawn consistently and drawn wrong. A leaf is
 *     yellow-green in almost every photograph ever captioned "leaf"; #5fce7a is not, it is a cool
 *     spring green at hue 135. The word was doing the opposite of its job.
 *   * **umbra** was "dusky violet", and four of the five umbra Kin came back essentially BLACK,
 *     with Shadepup registering ten chromatic pixels in a 200-square sample — a creature invisible
 *     against its own ground. "Dusky" plus a shadow-themed silhouette motif reads as "unlit".
 *   * **frost** and **gale** are both pale blues within 8 dE of each other under deuteranopia
 *     (see `verify.py --cvd`), so each names what it is NOT, to stop the two collapsing.
 *
 * The rule these three share: name the HUE and its direction round the wheel, never an object.
 * An object drags the model to the object's photographic average, which is exactly what happened.
 */
const COLOUR_WORDS: Readonly<Record<string, string>> = {
  ember: 'hot coral-orange',
  tide: 'deep sea blue',
  verdant:
    'bright cool spring green — a green that leans towards mint and blue, never towards olive, ' +
    'khaki, yellow-green or brown',
  gale: 'pale desaturated sky blue, greyer and softer than a cyan',
  stone: 'warm sandstone tan',
  spark: 'bright golden yellow',
  frost: 'bright icy pale cyan, clearly more green-blue than a plain sky blue',
  umbra:
    'vivid dusky violet-purple, clearly and obviously PURPLE at a glance and never black, ' +
    'charcoal or unlit grey',
  lumen: 'warm pale gold',
}

/* ------------------------------------------------------------------ the families */

export interface Family {
  /** The base-stage species the line starts from. Also the family's key. */
  readonly root: string
  /** Every member, in dex order. A single, unevolving Kin is a family of one. */
  readonly members: readonly string[]
  /** The line's primary type, taken from the root: what "type is colour" anchors the whole line to. */
  readonly type: string
}

/**
 * Walk the evolution edges back to their roots.
 *
 * Branching lines — Cinderpyre evolves into Flarelynx on the Ferocity branch and Hearthmane on
 * the Harmony branch — are ONE family, not two. That is the whole point of the consistency rule
 * this repository is checked against: a player who evolves down either branch must see the same
 * animal, grown up differently, and the two branch tips must read as siblings of each other as
 * well as as children of the root.
 */
function deriveFamilies(): readonly Family[] {
  const parent = new Map<string, string>()
  for (const species of SPECIES) {
    for (const evolution of species.evolutions ?? []) parent.set(evolution.into, species.id)
  }
  const rootOf = (id: string): string => {
    const seen = new Set<string>()
    let current = id
    while (parent.has(current) && !seen.has(current)) {
      seen.add(current)
      current = parent.get(current)!
    }
    return current
  }
  const grouped = new Map<string, string[]>()
  for (const species of SPECIES) {
    const root = rootOf(species.id)
    const list = grouped.get(root)
    if (list) list.push(species.id)
    else grouped.set(root, [species.id])
  }
  return [...grouped.entries()]
    .map(([root, members]) => ({
      root,
      members: members.sort(
        (a, b) => SPECIES_BY_ID.get(a)!.dexNumber - SPECIES_BY_ID.get(b)!.dexNumber,
      ),
      type: SPECIES_BY_ID.get(root)!.types[0]!,
    }))
    .sort((a, b) => SPECIES_BY_ID.get(a.root)!.dexNumber - SPECIES_BY_ID.get(b.root)!.dexNumber)
}

export const FAMILIES = deriveFamilies()

/* ------------------------------------------------------------------ what a planned asset is */

/**
 * How this asset's background is treated after generation.
 *
 * `flat` — the asset sits on the estate's one ground, `#12100f`, and is snapped to it exactly by
 * `normalise_ground.py`. Every portrait, icon, glyph, frame and the wordless mark: all of them are
 * composited onto the app's real background, where a ground eleven values too light shows as a
 * visible lighter rectangle.
 *
 * `scene` — the asset IS a picture, edge to edge: keyart, the capsule, the hero, the social card.
 * Snapping a keyart's sky to a single hex would not enforce a brand rule, it would destroy the
 * artwork. These are held to a darkness ceiling instead and are never snapped, and `verify.py`
 * says which rule it applied to which file rather than implying one rule covered everything.
 */
export type GroundClass = 'flat' | 'scene'

export type SetName = 'species' | 'types' | 'biomes' | 'title' | 'ui'

export interface PlannedAsset {
  /** `species/cindercub`. The manifest key and, with the size, the file name. */
  readonly key: string
  readonly set: SetName
  readonly slug: string
  readonly name: string
  /** The size the asset must END UP at. `generate.ts` rounds the request up to the 16 grid. */
  readonly width: number
  readonly height: number
  readonly ground: GroundClass
  /** The dominant colour the artwork must be drawn in. A type anchor, or the estate's ember. */
  readonly accent: string
  /** For a dual-typed Kin, the second anchor blended along the silhouette. Null otherwise. */
  readonly secondaryAccent: string | null
  /** The ONLY string permitted in the image. Null on everything wordless, which is most of it. */
  readonly lettering: string | null
  /** The subject paragraph: what this specific asset is a picture of. */
  readonly subject: string
  /**
   * The species' `lore` line, held SEPARATELY from the subject rather than inlined into it.
   *
   * It is the only free-form prose in any prompt, it is written for a player rather than for a
   * safety filter, and it is what Azure's content filter refused on: Maelhound's "a savage hunter
   * that corners prey in the crushing dark" is a `content_safety_violation` and Cinderpyre's
   * refusal is the same class. A refusal is a 400 and the service correctly declines to retry a
   * 400 — the request is wrong at the fallback model too — so the only honest retry is a DIFFERENT
   * request. Splitting the flavour out makes "the same prompt minus its flavour line" a thing
   * `generate.ts` can construct rather than a thing a person edits by hand, and the manifest
   * records which variant produced the file. Null on everything that is not a creature.
   */
  readonly flavour: string | null
  /** Family root id, for a species portrait. Null elsewhere. */
  readonly family: string | null
  /** `base` | `mid` | `final` | `apex`, from visuals.json. Null elsewhere. */
  readonly stage: string | null
  /** Where in the game's own specification this asset's brief came from. Provenance, per asset. */
  readonly source: string
  /** Lower is generated first. See the ordering note at the bottom of this file. */
  readonly priority: number
}

/* ------------------------------------------------------------------ set 1: species portraits */

const STAGE_DIRECTION: Readonly<Record<string, string>> = {
  base: 'This is the BASE stage of the line: small, compact, rounded, young — large head relative to the body, short limbs, soft edges. Its albedo is the family colour at its lightest and most open.',
  mid: 'This is the MIDDLE stage of the line: the same animal grown taller and leaner, the motif sharpened and repeated more times along the body. Its albedo is the SAME family colour, DEEPENED — richer and more saturated than the base stage, never a different hue.',
  final:
    'This is the FINAL stage of the line: the largest and most imposing form, the motif at its fullest expression, heavier plating or longer streamers, a clear reading of power at rest. Its albedo is the SAME family colour, deepened FURTHER and enriched with darker shadow ramps and brighter rim light — never recoloured, never a new hue.',
  apex: 'This is an APEX legendary: singular, architectural, larger than anything else in the world, with a designed sense of ceremony. Its albedo is still its type anchor, at its deepest and most jewel-like.',
}

/**
 * Render a line as prose, following its real edges rather than dex order.
 *
 * Branching matters, and flattening it is not a harmless simplification. Cinderpyre evolves into
 * Flarelynx on the Ferocity branch OR Hearthmane on the Harmony branch; writing that as
 * "Cindercub, Cinderpyre, Flarelynx, Hearthmane" tells the model there is a fourth, later,
 * still-larger stage, and the fourth stage it then draws is not a sibling of the third. The two
 * branch tips are peers and must read as peers.
 */
export function lineage(root: string): string {
  const walk = (id: string): string => {
    const species = SPECIES_BY_ID.get(id)!
    const children = (species.evolutions ?? []).map((e) => e.into)
    if (children.length === 0) return species.name
    if (children.length === 1) return `${species.name} -> ${walk(children[0]!)}`
    return `${species.name} -> then EITHER ${children.map((child) => walk(child)).join(' OR ')}`
  }
  return walk(root)
}

function familyClause(family: Family): string {
  if (family.members.length === 1) return ''
  const branching = family.members.some(
    (id) => (SPECIES_BY_ID.get(id)!.evolutions ?? []).length > 1,
  )
  const branchNote = branching
    ? 'Where the line branches, the two branch tips are PEERS of one another — two ways the same ' +
      'creature grew up, not two more stages — so they must read as siblings as well as as ' +
      'children of the stage above them. '
    : ''
  return (
    `This creature is one member of a single evolution line: ${lineage(family.root)}. Every ` +
    'member of that line shares one body plan, one silhouette motif and one base colour; they ' +
    'differ only in size, in how far the motif is developed, and in how deep the same colour is ' +
    `pushed. ${branchNote}` +
    'Draw it so a player who has seen its siblings recognises it instantly as the same animal.'
  )
}

function speciesAssets(): PlannedAsset[] {
  const familyOf = new Map<string, Family>()
  for (const family of FAMILIES) for (const member of family.members) familyOf.set(member, family)

  return SPECIES.map((species) => {
    const visual = VISUAL_BY_ID.get(species.id)
    if (!visual) throw new Error(`${species.id} has no entry in visuals.json`)
    const family = familyOf.get(species.id)!
    const primary = species.types[0]!
    const secondary = species.types[1] ?? null
    const stage = species.dexNumber >= 48 ? 'apex' : visual.stage

    // The share is stated as a fraction because "dominant" was not enough. Lumitide is
    // tide+lumen and came back 175 degrees off its tide anchor — which is to say it came back
    // gold, its SECONDARY, with the primary nowhere. A dual-type Kin whose secondary has taken
    // over is mis-typed at a glance, which is the one thing the type palette exists to prevent.
    const dual = secondary
      ? `It is a dual-type Kin: ${COLOUR_WORDS[primary]} ${PALETTE[primary]} is the PRIMARY and ` +
        'covers at least three quarters of the body, and it is the colour a viewer names when ' +
        `asked what colour this creature is. ${COLOUR_WORDS[secondary]} ${PALETTE[secondary]} is ` +
        'the SECONDARY and blends into the primary along the silhouette, confined to the ' +
        'extremities and to no more than a quarter of the body. The secondary never takes over ' +
        'and never becomes the creature\'s main colour. Two anchors, blended, and no third hue. '
      : ''
    const emission = visual.emissive
      ? 'It carries an emission mask: a small number of glowing elements — vents, sigils, arc ' +
        'nodes or a core — that read as lit from inside, brighter than any other part of it. '
      : ''

    return {
      key: `species/${species.id}`,
      set: 'species' as const,
      slug: species.id,
      name: species.name,
      width: 1024,
      height: 1024,
      ground: 'flat' as const,
      accent: PALETTE[primary]!,
      secondaryAccent: secondary ? PALETTE[secondary]! : null,
      lettering: null,
      family: family.root,
      stage,
      source: `kindred-upstream/content/visuals.json#${species.id}, species.json#${species.id}`,
      priority: 200 + species.dexNumber,
      flavour: `In character it is: ${species.lore}`,
      subject:
        // Two findings from this run's first live batch are encoded in this one line.
        //
        // The category is NOT quoted: quoting it is how the first Cindercub acquired a gold
        // nameplate and a garbled subtitle — given a quoted string beside a creature, the model
        // draws a trading card.
        //
        // The colour word is repeated HERE, in the opening noun phrase, as well as in the albedo
        // clause further down. Gleamoth came back charcoal with pale gold wing markings against
        // an albedo clause that said in capitals that the creature itself is warm pale gold. A
        // clause several paragraphs below the subject loses to the subject's own noun: a moth is
        // grey, so the model drew a grey moth. Naming the colour as part of what the thing IS
        // costs four words and beats arguing with it afterwards.
        `A single creature from a monster-collecting role-playing game: a ${COLOUR_WORDS[primary]} ` +
        `${species.category.toLowerCase()} called ${species.name}. Body plan: a ${visual.archetype}. ` +
        `Its one silhouette motif, which ` +
        `must dominate the shape, is: ${visual.silhouette}. ${dual}${emission}` +
        `${STAGE_DIRECTION[stage] ?? STAGE_DIRECTION['final']!} ${familyClause(family)}`,
    }
  })
}

/* ------------------------------------------------------------------ set 2: type icons */

/**
 * The nine type icons, and why each one is a DIFFERENT KIND OF SHAPE.
 *
 * `ui/packages/ui/src/surfaces.ts` states the estate's rule plainly — "colour is never the only
 * channel", and every switcher entry ships a glyph as well as an accent — and the reason it exists
 * is measured: the palette that registry replaced had five oranges out of six accents, with the
 * worst pair at dE 4.1 under normal vision and dE 1.3 under protanopia.
 *
 * The type palette here is in exactly that danger and it CANNOT be corrected, because "type is
 * colour" is a gameplay rule: a player reads a matchup off the colour, and re-picking the nine
 * anchors for separation would change what the game means. Three of the nine are pale blues
 * (tide, frost, gale) and two are yellows (spark, lumen). Under deuteranopia that is five icons
 * distinguished by a channel that distinguishes two.
 *
 * So the correction is applied on the OTHER channel, which is the same move the corrected accent
 * method made: each icon is a topologically distinct shape — a closed loop, an open crescent, a
 * radial star, a stack of chevrons — so the pairs that colour cannot separate, form does.
 * `verify.py --cvd` prints the measured separation matrix under normal, protan and deutan vision
 * and names the pairs that are carrying their whole distinction on form.
 */
const TYPE_ICONS: Readonly<Record<string, string>> = {
  ember: 'one solid teardrop flame, point upward, its base resting on a short flat bar',
  tide: 'one breaking wave: a single thick curl of water rolling over from the left and closing on itself, with no spray and no droplets',
  verdant: 'one broad three-lobed leaf on a straight stem, seen flat on, with a single centre vein',
  gale: 'three nested open chevrons of the same weight, stacked one above another, each pointing right, the middle one longest',
  stone: 'one flat-topped faceted boulder: a solid six-sided block seen from slightly above, with two visible facet lines and a squared base',
  spark: 'one struck spark: a four-point burst made of a long vertical stroke crossed by a shorter horizontal stroke, with a fainter diagonal cross behind it',
  frost: 'one six-armed ice crystal: six straight arms of equal length radiating from a centre point at sixty degrees, each arm carrying two short side branches',
  umbra: 'one solid disc with a crescent bitten out of its upper right, an eclipse — the disc is filled and the bite is empty',
  lumen: 'one small solid disc surrounded by eight straight rays of equal length, separated from the disc by a clear gap',
}

function typeAssets(): PlannedAsset[] {
  return ELEMENTS.map((element, index) => ({
    key: `types/${element}`,
    set: 'types' as const,
    slug: element,
    name: element,
    width: 512,
    height: 512,
    ground: 'flat' as const,
    accent: PALETTE[element]!,
    secondaryAccent: null,
    lettering: null,
    flavour: null,
    family: null,
    stage: null,
    source: `kindred-upstream/content/types.json#elements[${index}], docs/ART_BIBLE.md §2`,
    priority: 100 + index,
    subject:
      `A single interface icon for the "${element}" element of a monster-collecting game. It is ` +
      `${TYPE_ICONS[element]}. Drawn as one flat geometric shape with a uniform stroke weight, ` +
      'centred in the square with an even margin, filling most of the frame, and legible at 24 ' +
      'pixels. This is an icon, not an illustration: no scene, no creature, no background, no ' +
      'detail that dies when it is shrunk.',
  }))
}

/* ------------------------------------------------------------------ set 3: biome keyart */

/**
 * Six regions, from `campaign.json`, each with the key/fill/ambient palette ART_BIBLE.md §5
 * assigns it. The one thing every plate shares is the world's premise, which is also the reason
 * the rebrand is nearly free: Aurea is shattered into floating **shards**, bound by Aether.
 */
const BIOMES: Readonly<Record<string, string>> = {
  emberfall_vale:
    'a warm gold ember valley: terraced orchard shelves on a broad floating shard, ash drifting on the updraught, banked coals glowing in the rock seams, a low sun raking across from the left',
  tidalreach:
    'a frozen teal coast: a shard whose seaward edge is a frozen breaking wave, pack ice in the shallows, cold spray held in the air, a pale flat overcast light',
  verdant_spire:
    'a lush green spire: a single enormous tree-cored tower rising through stacked canopy shards, long green shafts of light falling between the leaves, spores hanging in the beams',
  galecrest:
    'a pale windswept blue ridge: bare stone crests on thin high shards, long banners of cloud tearing past at ridge height, grass flattened one way, cold thin daylight',
  sunken_cathedral:
    'a violet gloom: a flooded cathedral shard half submerged, broken vaulting and drowned columns, god-rays falling through the ruined roof into deep water, dust and silt in the light',
  lumen_core:
    'a white-gold core: the innermost shard, a vast chamber of concentric rings of light around a bright core, heavy volumetric beams, everything else in silhouette against it',
}

function biomeAssets(): PlannedAsset[] {
  return REGIONS.map((region, index) => ({
    key: `biomes/${region.id}`,
    set: 'biomes' as const,
    slug: region.id,
    name: region.name,
    width: 1536,
    height: 640,
    ground: 'scene' as const,
    accent: '#e8622c',
    secondaryAccent: null,
    lettering: null,
    flavour: null,
    family: null,
    stage: null,
    source: `kindred-upstream/content/campaign.json#regions[${index}], docs/ART_BIBLE.md §5`,
    priority: 300 + index,
    subject:
      `Wide environment keyart for the region "${region.name}" of a monster-collecting ` +
      'role-playing game, set in a world that has shattered into floating islands of rock bound ' +
      `together by a resonant energy. The region is ${BIOMES[region.id]}. Painted as one ` +
      'establishing shot with a clear foreground, midground and far distance, deep atmospheric ' +
      'perspective, and volumetric light. No creature in it, no character in it, no user ' +
      'interface, no map, no icons, and nothing written anywhere.',
  }))
}

/* ------------------------------------------------------------------ set 4: title and store art */

/**
 * The title set. `Emberkin`, subtitle *Resonance* — 19-new-products.md §1.2.
 *
 * The subtitle is deliberately NOT drawn. The brand run's one reliable failure mode was a second
 * string appearing on a wide composition that nobody asked for, and the fix that worked was
 * "exactly one permitted string, spelled out, and nothing else anywhere". A second legitimate
 * line would re-open the door the lettering clause exists to hold shut, and the subtitle is
 * typeset by the client anyway.
 *
 * The mark's idea is written to sit inside the CloudsForge family: `brand/plan.ts` makes the ash
 * ridge the ground line every estate mark shares, and design-system.md §5 permits one accent
 * element above it. Emberkin's is a kindled ember with a creature's eye in it.
 */
const TITLE_ACCENT = '#e8622c'

const EMBERKIN_MARK =
  'a kindled ember on the ash ridge: one solid rounded ember shape, wider at the base and drawn ' +
  'up into a single flame tip, with one narrow almond eye held in its centre as negative space — ' +
  'the fire is alive and it is looking back. Beneath it the ash ridge: one flat baseline with a ' +
  'single shallow arc rising from its centre, like the face of an anvil seen from the front. Two ' +
  'elements only, the ember and the ridge.'

function titleAssets(): PlannedAsset[] {
  const common = {
    set: 'title' as const,
    accent: TITLE_ACCENT,
    secondaryAccent: null,
    family: null,
    stage: null,
    flavour: null,
    source: 'docs/ecosystem/19-new-products.md §1.2, §1.4; assets/design-system.md §5',
  }
  return [
    {
      ...common,
      key: 'title/mark',
      slug: 'mark',
      name: 'Emberkin',
      width: 1024,
      height: 1024,
      ground: 'flat' as const,
      lettering: null,
      priority: 1,
      subject:
        'The wordless brand mark for a video game called Emberkin, drawn as one member of an ' +
        'existing family of software brand marks. Flat geometric vector: shapes built from ' +
        'circles, squares and 45-degree chamfers, one uniform stroke weight, generous negative ' +
        `space, optically centred, legible at 16 pixels. The one idea it is built around is ` +
        `${EMBERKIN_MARK} No gradients, no bevels, no glow, no 3D, no photo-realism.`,
    },
    {
      ...common,
      key: 'title/wordmark',
      slug: 'wordmark',
      name: 'Emberkin',
      width: 1024,
      height: 384,
      ground: 'flat' as const,
      lettering: 'Emberkin',
      priority: 2,
      subject:
        'A horizontal wordmark lockup for a video game: the brand mark on the left, then a clear ' +
        'gap of one mark-width, then the name set as text in one clean geometric sans of medium ' +
        'weight with wide tracking, its baseline optically aligned to the centre of the mark. A ' +
        `wide empty field with the lockup in the middle third. The mark is ${EMBERKIN_MARK} ` +
        'Flat geometric vector, one uniform stroke weight, no gradients and no 3D.',
    },
    {
      ...common,
      key: 'title/capsule',
      slug: 'capsule',
      name: 'Emberkin',
      width: 1600,
      height: 640,
      ground: 'scene' as const,
      lettering: 'Emberkin',
      priority: 3,
      subject:
        'A store capsule for a monster-collecting role-playing game. A young ember-coloured ' +
        'creature with a smouldering mane stands on a broken ledge in the left third, seen from ' +
        'behind and slightly above, looking out across a valley of floating islands of rock at ' +
        'dusk. Warm rim light on the creature, deep near-black rock in the foreground, the ' +
        'distance falling away into warm haze. The right half is deliberately open sky, where ' +
        'the title sits. Painterly, cinematic, saturated, high contrast.',
    },
    {
      ...common,
      key: 'title/hero',
      slug: 'hero',
      name: 'Emberkin',
      width: 1920,
      height: 768,
      ground: 'scene' as const,
      lettering: null,
      priority: 4,
      subject:
        'A wide hero banner for a monster-collecting role-playing game, with nothing written on ' +
        'it. Three creatures — one ember-orange and smouldering, one deep sea blue and finned, ' +
        'one leaf green and plated — stand together in the lower left third on a broken shelf of ' +
        'rock, small in the frame, facing away from the viewer into a vast dusk of floating ' +
        'islands bound by threads of warm light. The upper right two thirds are open sky and ' +
        'haze, left deliberately empty for overlaid text. Painterly, cinematic, deep ' +
        'atmospheric perspective.',
    },
    {
      ...common,
      key: 'title/og',
      slug: 'og',
      name: 'Emberkin',
      // 630 is not on the 16 grid. Asked for at 640 and cut down — see generate.ts and derive.py.
      width: 1200,
      height: 630,
      ground: 'scene' as const,
      lettering: 'Emberkin',
      priority: 5,
      subject:
        'An Open Graph card for a video game. A wide composition: one ember-orange creature with ' +
        'a smouldering mane in the left third at roughly half the card height, standing in ' +
        'three-quarter view on dark rock, warm rim light along its back. The right two thirds ' +
        'are a deep near-black warm dusk left almost empty apart from the title. Nothing near ' +
        'the outer edges, because social platforms crop them. Painterly and high contrast.',
    },
    {
      ...common,
      key: 'title/social',
      slug: 'social',
      name: 'Emberkin',
      width: 1280,
      height: 640,
      ground: 'scene' as const,
      lettering: 'Emberkin',
      priority: 6,
      subject:
        'A repository social preview banner for a video game. The title on the left over deep ' +
        'near-black warm rock, and to its right a single ember-orange creature in profile, ' +
        'small, rim lit, with generous empty dark space around it. A banner, not a poster: no ' +
        'scene behind it, no pattern, no border. The platform rounds the corners and darkens the ' +
        'edges, so everything is kept well inboard.',
    },
  ]
}

/* ------------------------------------------------------------------ set 5: UI chrome */

/**
 * Twelve pieces of interface chrome, replacing what `web/tools/bake-ui.mjs` draws in code.
 *
 * Eight glyphs and four frames. The glyphs are named for the systems 19-new-products.md §1.2 says
 * survive the rebrand verbatim — Resonance, Temperament, Sync — because those are the words the
 * player learns and the icons they will be looking for. Chrome is drawn in the estate's ember
 * rather than in a type colour: it belongs to the game's shell, and a type colour on a frame would
 * claim a matchup meaning it does not have.
 */
interface ChromeSpec {
  readonly slug: string
  readonly name: string
  readonly width: number
  readonly height: number
  readonly subject: string
}

const CHROME: readonly ChromeSpec[] = [
  {
    slug: 'glyph-resonance',
    name: 'Resonance',
    width: 512,
    height: 512,
    subject:
      'one solid round core with two concentric open rings expanding away from it, the outer ring ' +
      'thinner than the inner one, like a note still sounding',
  },
  {
    slug: 'glyph-sync',
    name: 'Sync',
    width: 512,
    height: 512,
    subject:
      'two identical open arcs interlocking into one continuous closed loop, each arc turning into ' +
      'the other, with a clear gap between the two strokes where they pass',
  },
  {
    slug: 'glyph-temperament-ferocity',
    name: 'Ferocity',
    width: 512,
    height: 512,
    subject:
      'two sharp chevrons pointing down and inward, stacked one above the other, tense and narrow, ' +
      'the lower one shorter — a shape crouched and about to spring',
  },
  {
    slug: 'glyph-temperament-harmony',
    name: 'Harmony',
    width: 512,
    height: 512,
    subject:
      'two shallow arcs opening upward and outward, stacked one above the other, wide and calm, ' +
      'the upper one wider — a shape at rest and open',
  },
  {
    slug: 'glyph-dex',
    name: 'Dex',
    width: 512,
    height: 512,
    subject:
      'one open codex seen from the front: two facing rectangular pages meeting at a straight ' +
      'centre spine, with a single small four-sided shard shape held above the right page',
  },
  {
    slug: 'glyph-party',
    name: 'Party',
    width: 512,
    height: 512,
    subject:
      'three equal solid dots set at the corners of an upright triangle, joined by three straight ' +
      'strokes of uniform weight, the top dot slightly larger',
  },
  {
    slug: 'glyph-satchel',
    name: 'Satchel',
    width: 512,
    height: 512,
    subject:
      'one squared pouch: a rounded rectangular body with a wide flap folded down over its top ' +
      'third, and a single strap arcing over it from side to side',
  },
  {
    slug: 'glyph-shard',
    name: 'Shard',
    width: 512,
    height: 512,
    subject:
      'one floating four-sided shard of rock, tilted, wider at the top and tapering to a point ' +
      'below, with one straight facet line down its face and a short flat sliver drifting beneath it',
  },
  {
    slug: 'frame-dialogue',
    name: 'Dialogue frame',
    width: 1024,
    height: 512,
    subject:
      'an empty rectangular dialogue panel frame for a game interface: a single clean border of ' +
      'uniform weight with the corners cut at 45 degrees, a short flat tab centred on the top ' +
      'edge for a speaker name, and the whole interior completely empty',
  },
  {
    slug: 'frame-battle-hud',
    name: 'Battle HUD plate',
    width: 1024,
    height: 512,
    subject:
      'an empty battle status plate for a game interface: a wide shallow bordered slab with its ' +
      'left end cut at 45 degrees, holding two empty horizontal meter tracks one above the other, ' +
      'the upper track twice the height of the lower, and no fill in either',
  },
  {
    slug: 'frame-portrait',
    name: 'Portrait frame',
    width: 768,
    height: 1024,
    subject:
      'an empty upright portrait card frame for a game interface: a tall rectangular border of ' +
      'uniform weight with all four corners cut at 45 degrees, a narrow empty banner strip across ' +
      'the bottom, and the whole interior completely empty',
  },
  {
    slug: 'frame-button',
    name: 'Button plate',
    width: 512,
    height: 256,
    subject:
      'an empty wide button plate for a game interface: a single horizontal slab with both ends ' +
      'cut at 45 degrees, one uniform border, one hairline inset line following that border, and ' +
      'nothing at all inside it',
  },
]

function uiAssets(): PlannedAsset[] {
  return CHROME.map((chrome, index) => ({
    key: `ui/${chrome.slug}`,
    set: 'ui' as const,
    slug: chrome.slug,
    name: chrome.name,
    width: chrome.width,
    height: chrome.height,
    ground: 'flat' as const,
    accent: TITLE_ACCENT,
    secondaryAccent: null,
    lettering: null,
    flavour: null,
    family: null,
    stage: null,
    source: 'kindred-upstream/web/tools/bake-ui.mjs (replaced); assets/design-system.md §5',
    priority: 400 + index,
    subject:
      `A single piece of game interface chrome, drawn flat: ${chrome.subject}. Flat geometric ` +
      'vector with one uniform stroke weight throughout, sharp corners left sharp, centred with ' +
      'an even margin, and legible when it is shrunk. No creature, no scene, no photographic ' +
      'texture, no bevel, no glow, no 3D, no drop shadow, and nothing written on it.',
  }))
}

/* ------------------------------------------------------------------ the whole plan */

/**
 * Everything, in generation order.
 *
 * The order is a property of the PLAN, not of the loop, for the same reason `brand/plan.ts` gives:
 * a run cut short by quota, an outage or a budget ceiling should leave a coherent set behind it
 * rather than a partial everything.
 *
 * Here that means one extra rule the brand run did not need. Species are ordered by dex number,
 * and dex order groups every evolution line contiguously — so a run that stops early stops
 * between families, never inside one. A half-generated family is the one outcome this set cannot
 * usefully ship, because "do the families read as families" is unanswerable when half of one is
 * missing.
 */
export function plannedAssets(): readonly PlannedAsset[] {
  return [...titleAssets(), ...typeAssets(), ...speciesAssets(), ...biomeAssets(), ...uiAssets()].sort(
    (a, b) => a.priority - b.priority,
  )
}

export const SPECIES_BY_ID_EXPORT = SPECIES_BY_ID
export const VISUAL_BY_ID_EXPORT = VISUAL_BY_ID
