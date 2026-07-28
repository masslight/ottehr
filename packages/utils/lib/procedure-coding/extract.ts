// Deterministic fact extraction for the laceration family (design §4, priority 1-2 only —
// structured fields first, then details-text patterns). No AI in this layer.
// Every text-derived fact carries the verbatim sourceText snippet it was read from.

import { FactConfidence, FactValue, ProcedureFactsInput } from './model.types';

// ── Anatomy normalization ──────────────────────────────────────────────────────

export type AnatomicSite =
  | 'scalp'
  | 'face'
  | 'ear'
  | 'eyelid'
  | 'nose'
  | 'lip'
  | 'mucous-membrane'
  | 'neck'
  | 'axilla'
  | 'genitalia'
  | 'trunk'
  | 'extremity'
  | 'hand'
  | 'foot';

// Order matters: more specific sites (hand/foot) are listed before 'extremity' so
// "left hand" resolves to hand even though a broader term could also appear.
// 'Head' (the product body-site value) is offered alongside 'Face', so a Head
// selection means the non-face head, i.e. scalp for grouping purposes.
const SITE_SYNONYMS: Array<[AnatomicSite, string[]]> = [
  ['eyelid', ['eyelid', 'eyelids']],
  ['ear', ['ear', 'ears', 'pinna', 'helix', 'earlobe']],
  ['nose', ['nose', 'nasal', 'nostril']],
  ['lip', ['lip', 'lips']],
  ['mucous-membrane', ['mucous membrane', 'mucous membranes', 'mucosa', 'buccal', 'oral', 'mouth', 'tongue']],
  ['face', ['face', 'facial', 'forehead', 'cheek', 'chin', 'brow', 'eyebrow', 'temple', 'jaw']],
  ['scalp', ['scalp', 'head']],
  ['neck', ['neck']],
  ['axilla', ['axilla', 'axillae', 'axillary', 'armpit']],
  ['genitalia', ['genitalia', 'genital', 'genitals', 'scrotum', 'scrotal', 'labia', 'penis', 'perineum']],
  ['trunk', ['trunk', 'torso', 'chest', 'abdomen', 'abdominal', 'back', 'flank', 'buttock', 'buttocks']],
  ['hand', ['hand', 'hands', 'finger', 'fingers', 'fingertip', 'thumb', 'palm', 'palmar', 'knuckle']],
  ['foot', ['foot', 'feet', 'toe', 'toes', 'heel', 'sole', 'plantar']],
  [
    'extremity',
    [
      'arm',
      'forearm',
      'elbow',
      'shoulder',
      'wrist',
      'leg',
      'thigh',
      'knee',
      'shin',
      'calf',
      'ankle',
      'extremity',
      'extremities',
    ],
  ],
];

/** Normalize a site string (structured value or free text) to an anatomic site, or undefined if unrecognized. */
export function normalizeAnatomicSite(raw: string | undefined): AnatomicSite | undefined {
  if (!raw) return undefined;
  const text = raw.toLowerCase();
  for (const [site, synonyms] of SITE_SYNONYMS) {
    for (const synonym of synonyms) {
      if (new RegExp(`\\b${synonym}\\b`, 'i').test(text)) {
        return site;
      }
    }
  }
  return undefined;
}

// ── Laceration facts schema ────────────────────────────────────────────────────

export interface LacerationWound {
  lengthCm: number;
  /** Site the text tied this length to, when determinable; otherwise the entry-level site applies. */
  site?: AnatomicSite;
  confidence: FactConfidence;
  sourceText?: string;
}

export interface LacerationFacts {
  /** Entry-level anatomic site (structured body site preferred, text fallback). */
  site?: FactValue<AnatomicSite>;
  /** Text-derived wound lengths (multi-wound entries yield several). */
  wounds: LacerationWound[];
  /** The structured length input, when present — preferred over text lengths. */
  structuredLengthCm?: number;
  /** Explicit depth/layer language only; closure method (e.g. subcuticular) is never depth proof. */
  depth?: FactValue<'layered' | 'single-layer'>;
  /** Debridement/undermining/tissue-rearrangement language ⇒ outside this model's scope. */
  outsideScope?: FactValue<true>;
  closureMethod?: FactValue<string>;
  closureMaterial?: FactValue<string>;
  closureCount?: FactValue<number>;
  suturesDocumented?: FactValue<true>;
  staplesDocumented?: FactValue<true>;
  tissueAdhesiveDocumented?: FactValue<true>;
  adhesiveStripsDocumented?: FactValue<true>;
  contaminationDocumented?: FactValue<true>;
  extensiveCleaningDocumented?: FactValue<true>;
  irrigationDocumented?: FactValue<true>;
  anesthesiaDocumented?: FactValue<true>;
  tetanusDocumented?: FactValue<true>;
  lateralityDocumented: boolean;
}

// ── Text pattern helpers ───────────────────────────────────────────────────────

/** True when the match at `index` is negated shortly before it ("no sutures", "without staples"). */
function isNegated(text: string, index: number): boolean {
  const before = text.slice(Math.max(0, index - 24), index);
  return /\b(no|not|without|denies|denied)\b[^.;,]{0,16}$/i.test(before);
}

/** Snippet of the source text around a match, for citation. */
function snippetAround(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 30);
  const end = Math.min(text.length, index + length + 30);
  return text.slice(start, end).trim();
}

function firstMatch(text: string, pattern: RegExp): { match: string; index: number } | undefined {
  const regex = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
  let result: RegExpExecArray | null;
  while ((result = regex.exec(text)) !== null) {
    if (!isNegated(text, result.index)) {
      return { match: result[0], index: result.index };
    }
  }
  return undefined;
}

function textFlag(text: string, pattern: RegExp): FactValue<true> | undefined {
  const found = firstMatch(text, pattern);
  if (!found) return undefined;
  return { value: true, confidence: 'text', sourceText: snippetAround(text, found.index, found.match.length) };
}

// ── Length extraction ──────────────────────────────────────────────────────────

// "3.2 cm", "3.2cm", "3,2 cm" — tolerant of template and freehand shapes.
const LENGTH_CM_PATTERN = /(\d+(?:[.,]\d+)?)\s*cm\b/gi;
// "Wound Length: 3.2" template lines where the unit was omitted. The trailing guard keeps the
// capture from backtracking to a partial number when the full figure is followed by "cm"
// (that shape is already handled by LENGTH_CM_PATTERN).
const WOUND_LENGTH_LINE_PATTERN = /wound\s+length:?\s*(\d+(?:[.,]\d+)?)(?![\d.,]|\s*cm)/gi;
// A cm figure that is a distance ("2 cm from the elbow"), not a wound length.
const DISTANCE_CONTEXT_PATTERN = /^\s*(?:from|proximal|distal|above|below|lateral|medial|superior|inferior)\b/i;
// Language signalling that repeated equal lengths are genuinely separate wounds.
const PLURAL_WOUND_PATTERN = /\b(second|another|two|three|four|multiple)\b[\s\S]{0,40}\b(wound|laceration|cut)/i;

function parseCmValue(raw: string): number {
  return parseFloat(raw.replace(',', '.'));
}

/** Site the text ties a specific length to: the nearest site keyword within the same sentence. */
function siteNearIndex(text: string, index: number, matchLength: number): AnatomicSite | undefined {
  const sentenceStart = Math.max(text.lastIndexOf('.', index), text.lastIndexOf('\n', index)) + 1;
  let sentenceEnd = text.length;
  for (const boundary of ['.', '\n']) {
    const found = text.indexOf(boundary, index + matchLength);
    if (found !== -1 && found < sentenceEnd) sentenceEnd = found;
  }
  const windowStart = Math.max(sentenceStart, index - 80);
  const windowEnd = Math.min(sentenceEnd, index + matchLength + 80);
  let best: { site: AnatomicSite; distance: number } | undefined;
  for (const [site, synonyms] of SITE_SYNONYMS) {
    for (const synonym of synonyms) {
      const regex = new RegExp(`\\b${synonym}\\b`, 'gi');
      regex.lastIndex = windowStart;
      let result: RegExpExecArray | null;
      while ((result = regex.exec(text)) !== null && result.index < windowEnd) {
        const distance = Math.abs(result.index - index);
        if (best === undefined || distance < best.distance) {
          best = { site, distance };
        }
      }
    }
  }
  return best?.site;
}

function extractWounds(text: string): LacerationWound[] {
  const raw: LacerationWound[] = [];
  const seenIndexes = new Set<number>();
  const collect = (pattern: RegExp): void => {
    const regex = new RegExp(pattern.source, pattern.flags);
    let result: RegExpExecArray | null;
    while ((result = regex.exec(text)) !== null) {
      const after = text.slice(result.index + result[0].length, result.index + result[0].length + 24);
      if (DISTANCE_CONTEXT_PATTERN.test(after)) continue; // "2 cm from the elbow" is not a wound length
      if (seenIndexes.has(result.index)) continue;
      seenIndexes.add(result.index);
      const lengthCm = parseCmValue(result[1]);
      if (!Number.isFinite(lengthCm) || lengthCm <= 0) continue;
      raw.push({
        lengthCm,
        site: siteNearIndex(text, result.index, result[0].length),
        confidence: 'text',
        sourceText: snippetAround(text, result.index, result[0].length),
      });
    }
  };
  collect(LENGTH_CM_PATTERN);
  collect(WOUND_LENGTH_LINE_PATTERN);

  // Conservative de-duplication: a repeated mention of the same value at the same site is
  // treated as one wound unless the text signals plural wounds — never over-sum silently.
  const pluralSignal = PLURAL_WOUND_PATTERN.test(text);
  if (pluralSignal) return raw;
  const unique: LacerationWound[] = [];
  for (const wound of raw) {
    const duplicate = unique.some((w) => w.lengthCm === wound.lengthCm && w.site === wound.site);
    if (!duplicate) unique.push(wound);
  }
  return unique;
}

// ── Closure / depth / wound-condition patterns ─────────────────────────────────

// Explicit depth/layer language only (a closure method like subcuticular is NOT depth proof).
const LAYERED_PATTERN =
  /\blayered\b|\btwo[-\s]layer|\bmulti[-\s]?layer|deep\s+dermal\s+sutur|deep\s+sutur|subcutaneous\s+sutur/i;
const SINGLE_LAYER_PATTERN = /single[-\s]layer|\bsuperficial\b/i;
const OUTSIDE_SCOPE_PATTERN =
  /debrid\w*|undermin\w*|tissue\s+rearrangement|advancement\s+flap|rotation\s+flap|z-?plasty|complex\s+repair/i;

const CONTAMINATION_PATTERN =
  /heavil?y\s+contaminated|grossly\s+contaminated|heavy\s+contamination|gross\s+contamination/i;
const EXTENSIVE_CLEANING_PATTERN =
  /extensive(?:ly)?\s+(?:clean\w*|irrigat\w*|scrub\w*)|copious(?:ly)?\s+irrigat\w*|prolonged\s+(?:irrigation|cleaning|scrubbing)/i;
const IRRIGATION_PATTERN = /irrigat\w*/i;

const CLOSURE_METHOD_PATTERNS: Array<[RegExp, string]> = [
  [/simple\s+interrupted/i, 'simple interrupted'],
  [/vertical\s+mattress/i, 'vertical mattress'],
  [/horizontal\s+mattress/i, 'horizontal mattress'],
  [/running\s+subcuticular|subcuticular/i, 'subcuticular'],
  [/running\s+(?:sutur\w*|closure|stitch\w*)|\brunning\b/i, 'running'],
  [/\binterrupted\b/i, 'interrupted'],
  [/stapl(?:es?|ed|er)\b/i, 'staples'],
  [/dermabond|tissue\s+adhesive|skin\s+adhesive|skin\s+glue/i, 'tissue adhesive'],
];

const SUTURE_MATERIALS =
  'nylon|ethilon|prolene|vicryl|monocryl|chromic(?:\\s+gut)?|fast[-\\s]absorbing\\s+gut|plain\\s+gut|gut|silk|pds';
const SIZED_MATERIAL_PATTERN = new RegExp(`\\b(\\d{1,2}[-–/]0)\\s+(${SUTURE_MATERIALS})\\b`, 'i');
const MATERIAL_ONLY_PATTERN = new RegExp(`\\b(${SUTURE_MATERIALS})\\b`, 'i');

const STITCH_COUNT_LINE_PATTERN = /total\s+(?:stitch|suture|staple)\s+count:?\s*(\d+)/i;
// "5 sutures", "4 simple interrupted 5-0 nylon sutures" — the lookbehind keeps "4-0" and "5-0"
// suture sizes from being read as counts.
const COUNT_PATTERN = /(?<![\d/–-])(\d+)\s+(?:[\w–-]+\s+){0,4}?(sutures?|stitches?|staples?)\b/i;

const SUTURE_EVIDENCE_PATTERN = /sutur\w*|stitch\w*/i;
const STAPLE_EVIDENCE_PATTERN = /stapl\w*/i;
const TISSUE_ADHESIVE_PATTERN = /dermabond|tissue\s+adhesive|skin\s+adhesive|skin\s+glue|\bglued?\b/i;
const ADHESIVE_STRIPS_PATTERN = /steri[-\s]?strips?|adhesive\s+strips?|butterfly\s+(?:strips?|closures?|bandage)/i;

const ANESTHESIA_PATTERN =
  /lidocaine|bupivacaine|marcaine|septocaine|\bLET\b|anesthe\w*|digital\s+block|field\s+block/i;
const TETANUS_PATTERN = /tetanus|tdap|dtap|\btd\s+(?:given|administered|up\s+to\s+date)/i;

// ── Main extraction ────────────────────────────────────────────────────────────

function extractSite(input: ProcedureFactsInput, text: string): FactValue<AnatomicSite> | undefined {
  const structured = normalizeAnatomicSite(input.bodySite) ?? normalizeAnatomicSite(input.otherBodySite);
  if (structured) {
    return { value: structured, confidence: 'structured' };
  }
  for (const [site, synonyms] of SITE_SYNONYMS) {
    for (const synonym of synonyms) {
      const found = firstMatch(text, new RegExp(`\\b${synonym}\\b`, 'i'));
      if (found) {
        return { value: site, confidence: 'text', sourceText: snippetAround(text, found.index, found.match.length) };
      }
    }
  }
  return undefined;
}

function extractDepth(text: string): FactValue<'layered' | 'single-layer'> | undefined {
  const layered = firstMatch(text, LAYERED_PATTERN);
  if (layered) {
    return {
      value: 'layered',
      confidence: 'text',
      sourceText: snippetAround(text, layered.index, layered.match.length),
    };
  }
  const single = firstMatch(text, SINGLE_LAYER_PATTERN);
  if (single) {
    return {
      value: 'single-layer',
      confidence: 'text',
      sourceText: snippetAround(text, single.index, single.match.length),
    };
  }
  return undefined;
}

function extractClosureMethod(text: string): FactValue<string> | undefined {
  for (const [pattern, method] of CLOSURE_METHOD_PATTERNS) {
    const found = firstMatch(text, pattern);
    if (found) {
      return { value: method, confidence: 'text', sourceText: snippetAround(text, found.index, found.match.length) };
    }
  }
  return undefined;
}

function extractClosureMaterial(text: string): FactValue<string> | undefined {
  const sized = firstMatch(text, SIZED_MATERIAL_PATTERN);
  if (sized) {
    return { value: sized.match, confidence: 'text', sourceText: snippetAround(text, sized.index, sized.match.length) };
  }
  const materialOnly = firstMatch(text, MATERIAL_ONLY_PATTERN);
  if (materialOnly) {
    return {
      value: materialOnly.match,
      confidence: 'text',
      sourceText: snippetAround(text, materialOnly.index, materialOnly.match.length),
    };
  }
  return undefined;
}

function extractClosureCount(text: string): FactValue<number> | undefined {
  for (const pattern of [STITCH_COUNT_LINE_PATTERN, COUNT_PATTERN]) {
    const regex = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
    let result: RegExpExecArray | null;
    while ((result = regex.exec(text)) !== null) {
      if (isNegated(text, result.index)) continue;
      const count = parseInt(result[1], 10);
      if (!Number.isFinite(count) || count <= 0) continue;
      return { value: count, confidence: 'text', sourceText: snippetAround(text, result.index, result[0].length) };
    }
  }
  return undefined;
}

function suppliesContain(input: ProcedureFactsInput, keyword: RegExp): boolean {
  const supplies = [...(input.suppliesUsed ?? []), input.otherSuppliesUsed ?? ''];
  return supplies.some((supply) => keyword.test(supply));
}

/** Deterministic laceration fact extraction: structured fields first, then details-text patterns. */
export function extractLacerationFacts(input: ProcedureFactsInput): LacerationFacts {
  const text = input.procedureDetails ?? '';

  const facts: LacerationFacts = {
    site: extractSite(input, text),
    wounds: extractWounds(text),
    structuredLengthCm: input.lengthCm,
    depth: extractDepth(text),
    outsideScope: textFlag(text, OUTSIDE_SCOPE_PATTERN),
    closureMethod: extractClosureMethod(text),
    closureMaterial: extractClosureMaterial(text),
    closureCount: extractClosureCount(text),
    suturesDocumented: textFlag(text, SUTURE_EVIDENCE_PATTERN),
    staplesDocumented: textFlag(text, STAPLE_EVIDENCE_PATTERN),
    tissueAdhesiveDocumented: textFlag(text, TISSUE_ADHESIVE_PATTERN),
    adhesiveStripsDocumented: textFlag(text, ADHESIVE_STRIPS_PATTERN),
    contaminationDocumented: textFlag(text, CONTAMINATION_PATTERN),
    extensiveCleaningDocumented: textFlag(text, EXTENSIVE_CLEANING_PATTERN),
    irrigationDocumented: textFlag(text, IRRIGATION_PATTERN),
    anesthesiaDocumented: textFlag(text, ANESTHESIA_PATTERN),
    tetanusDocumented: textFlag(text, TETANUS_PATTERN),
    lateralityDocumented: Boolean(input.bodySide),
  };

  // Structured supplies corroborate closure evidence (prevents a false strips-only reading).
  if (!facts.suturesDocumented && suppliesContain(input, /sutur/i)) {
    facts.suturesDocumented = { value: true, confidence: 'structured' };
  }
  if (!facts.staplesDocumented && suppliesContain(input, /stapl/i)) {
    facts.staplesDocumented = { value: true, confidence: 'structured' };
  }
  if (!facts.tissueAdhesiveDocumented && suppliesContain(input, /dermabond|adhesive(?!\s+strip)|glue/i)) {
    facts.tissueAdhesiveDocumented = { value: true, confidence: 'structured' };
  }

  // Structured medication field documents anesthesia.
  if (!facts.anesthesiaDocumented && input.medicationUsed && input.medicationUsed.trim().length > 0) {
    facts.anesthesiaDocumented = { value: true, confidence: 'structured' };
  }

  // Extensive cleaning counts toward the contaminated-wound path only alongside contamination language.
  if (facts.extensiveCleaningDocumented && !facts.contaminationDocumented) {
    facts.extensiveCleaningDocumented = undefined;
  }

  return facts;
}
