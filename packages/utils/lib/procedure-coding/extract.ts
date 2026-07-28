import { MEDICATION_FIELD_LABEL, SITE_FIELD_LABEL, TECHNIQUE_FIELD_LABEL } from './family-support';
import { FactValue, fieldEvidence, ProcedureFactsInput, textEvidence } from './model.types';

export const MAX_ANALYZED_TEXT_LENGTH = 20_000;

const DECIMAL_LOOKALIKE_PATTERN = /[·•∙⋅‧]/g;

export function normalizeNoteText(raw: string | undefined): string {
  if (!raw) return '';
  const capped = raw.length > MAX_ANALYZED_TEXT_LENGTH ? raw.slice(0, MAX_ANALYZED_TEXT_LENGTH) : raw;
  return capped.normalize('NFKC').replace(DECIMAL_LOOKALIKE_PATTERN, '.');
}

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
      'hip',
      'knee',
      'shin',
      'calf',
      'ankle',
      'extremity',
      'extremities',
    ],
  ],
];

function synonymSource(synonym: string): string {
  return synonym
    .split(/\s+/)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join(String.raw`\s+`);
}

const STRUCTURED_SITE_PATTERNS: Array<[AnatomicSite, RegExp]> = SITE_SYNONYMS.map(([site, synonyms]) => [
  site,
  new RegExp(String.raw`\b(?:${synonyms.map(synonymSource).join('|')})\b`, 'i'),
]);

export function normalizeAnatomicSite(raw: string | undefined): AnatomicSite | undefined {
  if (!raw) return undefined;
  for (const [site, pattern] of STRUCTURED_SITE_PATTERNS) {
    if (pattern.test(raw)) return site;
  }
  return undefined;
}

const EXAM_CONTEXT_GUARD = String.raw`(?!\s*(?:x-?rays?|xr\b|ct\b|cta\b|mri\b|us\b|ultrasound|radiograph\w*|films?\b|imaging|scans?\b|exams?\b|examination|clear\b|sounds?\b|auscultat\w*|soft\b|non-?tender\w*|tender\w*|pain\b|intake\b|output\b|breathing\b))`;

const TEXT_SITE_SOURCES: Array<[AnatomicSite, string]> = [
  ['eyelid', String.raw`\beyelids?\b|\blid\s+margin\b`],
  ['ear', String.raw`\bears?\b${EXAM_CONTEXT_GUARD}|\bpinna\b|\bhelix\b|\bhelical\s+rim\b|\bearlobes?\b|\bauricle\b`],
  ['nose', String.raw`\bnose\b|\bnasal\b|\bnostrils?\b|\bcolumella\b`],
  ['lip', String.raw`\blips?\b|\bvermill?ion\b`],
  [
    'mucous-membrane',
    String.raw`\bmucous\s+membranes?\b|\bmucosal?\b|\bbuccal\b|\bintra-?oral\b|\boral\s+(?:mucosa\w*|cavity|lacerat\w*|wound\w*|lesion\w*)\b|\bmouth\b(?!\s*(?:care|breathing))|\btongue\b`,
  ],
  [
    'face',
    String.raw`\bfaces?\b|\bfacial\b|\bforeheads?\b|\bcheeks?\b|\bchin\b|\bbrow\b|\beyebrows?\b|\btemple\b|\bjaw\b`,
  ],
  ['scalp', String.raw`\bscalp\b|\bheads?\b${EXAM_CONTEXT_GUARD}|\bocciput\b|\boccipital\b`],
  ['neck', String.raw`\bnecks?\b${EXAM_CONTEXT_GUARD}`],
  ['axilla', String.raw`\baxilla[el]?\b|\baxillary\b|\barmpit\b`],
  [
    'genitalia',
    String.raw`\bgenitali[ae]\b|\bgenitals?\b|\bscrot(?:um|al)\b|\blabia\b|\bpenis\b|\bperineum\b|\bperineal\b`,
  ],
  [
    'trunk',
    String.raw`\btrunks?\b|\btorso\b|\bchest\b${EXAM_CONTEXT_GUARD}|\babdom(?:en|inal)\b${EXAM_CONTEXT_GUARD}|\bflanks?\b${EXAM_CONTEXT_GUARD}|\bbuttocks?\b|\b(?:upper|lower|mid|middle|left|right)\s+backs?\b|\bthe\s+back\b(?!\s+of\b)`,
  ],
  ['hand', String.raw`\bhands?\b|\bfingers?\b|\bfingertips?\b|\bthumbs?\b|\bpalmar?\b|\bknuckles?\b|\bwebspace\b`],
  ['foot', String.raw`\bfoot\b|\bfeet\b|\btoes?\b|\bheel\b|\bsole\b|\bplantar\b`],
  [
    'extremity',
    String.raw`\bforearms?\b|\barms?\b|\belbows?\b|\bshoulders?\b|\bwrists?\b|\blegs?\b|\bthighs?\b|\bhips?\b|\bknees?\b|\bshins?\b|\bcalf\b|\bankles?\b|\bextremit(?:y|ies)\b`,
  ],
];

const TEXT_SITE_ORDER: AnatomicSite[] = TEXT_SITE_SOURCES.map(([site]) => site);

const TEXT_SITE_SCANNER = new RegExp(TEXT_SITE_SOURCES.map(([, source]) => `(${source})`).join('|'), 'gi');

interface SiteHit {
  site: AnatomicSite;
  index: number;
  length: number;
}

function scanSites(text: string, slice: string, offset: number, limit = Number.POSITIVE_INFINITY): SiteHit[] {
  const hits: SiteHit[] = [];
  TEXT_SITE_SCANNER.lastIndex = 0;
  let result: RegExpExecArray | null;
  while ((result = TEXT_SITE_SCANNER.exec(slice)) !== null) {
    if (result[0].length === 0) {
      TEXT_SITE_SCANNER.lastIndex += 1;
      continue;
    }
    const groupIndex = result.findIndex((group, position) => position > 0 && group !== undefined);
    const index = offset + result.index;
    if (groupIndex > 0 && !isNegatedMatch(text, index, result[0].length)) {
      hits.push({ site: TEXT_SITE_ORDER[groupIndex - 1], index, length: result[0].length });
      if (hits.length >= limit) break;
    }
  }
  return hits;
}

const CLAUSE_BREAK_SOURCE = String.raw`[.;:!?\n\r|]|\band\b`;
const CLAUSE_BREAK_PATTERN_GLOBAL = new RegExp(CLAUSE_BREAK_SOURCE, 'gi');
const CLAUSE_BREAK_PATTERN = new RegExp(CLAUSE_BREAK_SOURCE, 'i');
const CLAUSE_WINDOW_RADIUS = 80;

function clauseWindow(
  text: string,
  index: number,
  matchLength: number,
  radius = CLAUSE_WINDOW_RADIUS
): { start: number; end: number } {
  const from = Math.max(0, index - radius);
  let start = from;
  CLAUSE_BREAK_PATTERN_GLOBAL.lastIndex = 0;
  const before = text.slice(from, index);
  let breakMatch: RegExpExecArray | null;
  while ((breakMatch = CLAUSE_BREAK_PATTERN_GLOBAL.exec(before)) !== null) {
    start = from + breakMatch.index + breakMatch[0].length;
  }
  const matchEnd = index + matchLength;
  const to = Math.min(text.length, matchEnd + radius);
  const after = text.slice(matchEnd, to);
  const nextBreak = CLAUSE_BREAK_PATTERN.exec(after);
  return { start, end: nextBreak === null ? to : matchEnd + nextBreak.index };
}

const NEGATOR_SOURCE = String.raw`no|not|none|never|without|w\/o|denies|denied|negative\s+for|rules?\s+out|ruled\s+out|unable\s+to|declines?|declined|defers?|deferred|refuses?|refused|cannot|can'?t|won'?t|wasn'?t|weren'?t|didn'?t|doesn'?t|isn'?t|aren'?t|hasn'?t|haven'?t|unavailable|not\s+available|withheld`;
const NEGATION_RADIUS = 48;
const PRE_NEGATION_PATTERN = new RegExp(String.raw`\b(?:${NEGATOR_SOURCE})\b[^.;,:!?\n\r]{0,24}$`, 'i');
const POST_NEGATION_PATTERN = new RegExp(String.raw`^[^.;,:!\n\r]{0,24}?\b(?:${NEGATOR_SOURCE})\b`, 'i');

export function isNegatedMatch(text: string, index: number, matchLength = 0): boolean {
  const before = text.slice(Math.max(0, index - NEGATION_RADIUS), index);
  if (PRE_NEGATION_PATTERN.test(before)) return true;
  const matchEnd = index + matchLength;
  return POST_NEGATION_PATTERN.test(text.slice(matchEnd, matchEnd + NEGATION_RADIUS));
}

const PRE_MODALITY_SOURCE = String.raw`will|would|plans?|planned|planning|recommends?|recommended|advis\w+|considers?|considered|considering|discuss\w+|schedul\w+|may|might|should|could|if\s+(?:needed|required|indicated)|as\s+needed|prn|return\s+for|instruct\w+|anticipat\w+|history\s+of|h\/o|hx\s+of|prior|previous(?:ly)?|status\s+post|s\/p|remote`;
const POST_MODALITY_SOURCE = String.raw`at\s+(?:the\s+)?(?:follow-?up|next\s+visit|discharge)|on\s+follow-?up|is\s+planned|was\s+planned|were\s+planned|recommended|if\s+(?:needed|required|indicated)|as\s+needed|prn|last\s+(?:week|month|year|night|visit)|\d+\s+(?:days?|weeks?|months?|years?)\s+ago|\b(?:19|20)\d{2}\b`;
const PRE_MODALITY_PATTERN = new RegExp(String.raw`\b(?:${PRE_MODALITY_SOURCE})\b[^.;,:!?\n\r]{0,24}$`, 'i');
const POST_MODALITY_PATTERN = new RegExp(String.raw`^[^.;,:!\n\r]{0,24}?(?:${POST_MODALITY_SOURCE})`, 'i');

export function isPlannedOrHistoricalMatch(text: string, index: number, matchLength = 0): boolean {
  const before = text.slice(Math.max(0, index - NEGATION_RADIUS), index);
  if (PRE_MODALITY_PATTERN.test(before)) return true;
  const matchEnd = index + matchLength;
  return POST_MODALITY_PATTERN.test(text.slice(matchEnd, matchEnd + NEGATION_RADIUS));
}

export function snippetAround(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 30);
  const end = Math.min(text.length, index + length + 30);
  return text.slice(start, end).trim();
}

const GLOBAL_PATTERN_CACHE = new Map<string, RegExp>();

function globalVariant(pattern: RegExp): RegExp {
  const key = `${pattern.flags}\u0000${pattern.source}`;
  let cached = GLOBAL_PATTERN_CACHE.get(key);
  if (cached === undefined) {
    cached = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
    GLOBAL_PATTERN_CACHE.set(key, cached);
  }
  cached.lastIndex = 0;
  return cached;
}

export interface GuardedMatch {
  match: string;
  index: number;
  groups: (string | undefined)[];
}

export function firstMatchGroups(text: string, pattern: RegExp): GuardedMatch | undefined {
  const regex = globalVariant(pattern);
  let result: RegExpExecArray | null;
  while ((result = regex.exec(text)) !== null) {
    if (!isNegatedMatch(text, result.index, result[0].length)) {
      return { match: result[0], index: result.index, groups: result.slice(1) };
    }
    if (result[0].length === 0) regex.lastIndex += 1;
  }
  return undefined;
}

export function firstMatch(text: string, pattern: RegExp): { match: string; index: number } | undefined {
  return firstMatchGroups(text, pattern);
}

export function firstPerformedMatch(text: string, pattern: RegExp): GuardedMatch | undefined {
  const regex = globalVariant(pattern);
  let result: RegExpExecArray | null;
  while ((result = regex.exec(text)) !== null) {
    if (
      !isNegatedMatch(text, result.index, result[0].length) &&
      !isPlannedOrHistoricalMatch(text, result.index, result[0].length)
    ) {
      return { match: result[0], index: result.index, groups: result.slice(1) };
    }
    if (result[0].length === 0) regex.lastIndex += 1;
  }
  return undefined;
}

export function textFlag(text: string, pattern: RegExp): FactValue<true> | undefined {
  const found = firstMatch(text, pattern);
  if (!found) return undefined;
  return { value: true, evidence: textEvidence(snippetAround(text, found.index, found.match.length)) };
}

export function textFlagPerformed(text: string, pattern: RegExp): FactValue<true> | undefined {
  const found = firstPerformedMatch(text, pattern);
  if (!found) return undefined;
  return { value: true, evidence: textEvidence(snippetAround(text, found.index, found.match.length)) };
}

export function textMention(text: string, pattern: RegExp): FactValue<true> | undefined {
  const regex = globalVariant(pattern);
  const result = regex.exec(text);
  if (result === null) return undefined;
  return { value: true, evidence: textEvidence(snippetAround(text, result.index, result[0].length)) };
}

export const MAX_PLAUSIBLE_LENGTH_CM = 100;

export const NUMBER_SOURCE = String.raw`\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:[.,]\d+)?`;
export const LENGTH_UNIT_SOURCE = String.raw`(cm|cms|centimet(?:er|re)s?|mm|mms|millimet(?:er|re)s?)`;
const THOUSANDS_GROUPED_PATTERN = /^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/;
const MILLIMETRE_UNIT_PATTERN = /^m/i;

export function parseLengthNumber(raw: string): number {
  const normalized = THOUSANDS_GROUPED_PATTERN.test(raw) ? raw.replace(/,/g, '') : raw.replace(',', '.');
  return parseFloat(normalized);
}

export function parseLengthCm(raw: string, unit: string | undefined): number {
  const value = parseLengthNumber(raw);
  return unit !== undefined && MILLIMETRE_UNIT_PATTERN.test(unit) ? value / 10 : value;
}

export function isPlausibleLengthCm(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value > 0 && value <= MAX_PLAUSIBLE_LENGTH_CM;
}

const LESION_MENTION_PATTERN =
  /\b(?:lacerat\w*|lacs?\b|wound\w*|cuts?|incisions?|avuls\w*|lesions?|abscess\w*|burns?\b|burned|abrasions?|punctures?|ulcers?|cysts?|foreign\s+bod(?:y|ies))\b/gi;

const MAX_LESION_MENTIONS = 200;

const LOCATION_LABEL_PATTERN =
  /(?:anatomical\s+location|site\s*\/\s*location|body\s+site|location|site)\s*:([^\n.;]{1,60})/gi;

function siteNearestLesion(text: string): SiteHit | undefined {
  let best: (SiteHit & { distance: number }) | undefined;
  const regex = globalVariant(LESION_MENTION_PATTERN);
  let mentions = 0;
  let result: RegExpExecArray | null;
  while ((result = regex.exec(text)) !== null && mentions < MAX_LESION_MENTIONS) {
    mentions += 1;
    const mentionIndex = result.index;
    const { start, end } = clauseWindow(text, mentionIndex, result[0].length);
    for (const hit of scanSites(text, text.slice(start, end), start)) {
      const distance = Math.abs(hit.index - mentionIndex);
      if (best === undefined || distance < best.distance) {
        best = { ...hit, distance };
      }
    }
  }
  return best;
}

function siteFromLocationLabel(text: string): SiteHit | undefined {
  const regex = globalVariant(LOCATION_LABEL_PATTERN);
  let result: RegExpExecArray | null;
  while ((result = regex.exec(text)) !== null) {
    const valueStart = result.index + result[0].length - result[1].length;
    const hit = scanSites(text, result[1], valueStart, 1)[0];
    if (hit) return hit;
  }
  return undefined;
}

export function extractSiteFromText(rawText: string): FactValue<AnatomicSite> | undefined {
  const text = normalizeNoteText(rawText);
  const hit = siteNearestLesion(text) ?? siteFromLocationLabel(text) ?? scanSites(text, text, 0, 1)[0];
  if (hit === undefined) return undefined;
  return { value: hit.site, evidence: textEvidence(snippetAround(text, hit.index, hit.length)) };
}

export function extractSite(input: ProcedureFactsInput, text: string): FactValue<AnatomicSite> | undefined {
  const structured = normalizeAnatomicSite(input.bodySite) ?? normalizeAnatomicSite(input.otherBodySite);
  if (structured) {
    return { value: structured, evidence: fieldEvidence(SITE_FIELD_LABEL) };
  }
  return extractSiteFromText(text);
}

export function siteNearIndex(text: string, index: number, matchLength: number): AnatomicSite | undefined {
  const { start, end } = clauseWindow(text, index, matchLength);
  let best: { site: AnatomicSite; distance: number } | undefined;
  for (const hit of scanSites(text, text.slice(start, end), start)) {
    const distance = Math.abs(hit.index - index);
    if (best === undefined || distance < best.distance) {
      best = { site: hit.site, distance };
    }
  }
  return best?.site;
}

export function suppliesContain(input: ProcedureFactsInput, keyword: RegExp): boolean {
  const supplies = [...(input.suppliesUsed ?? []), input.otherSuppliesUsed ?? ''];
  return supplies.some((supply) => keyword.test(supply));
}

interface StructuredHaystack {
  field: string;
  values: string[];
}

function structuredValuesOrTextFlag(
  haystacks: StructuredHaystack[],
  text: string,
  pattern: RegExp
): FactValue<true> | undefined {
  for (const { field, values } of haystacks) {
    if (values.some((value) => pattern.test(value))) {
      return { value: true, evidence: fieldEvidence(field) };
    }
  }
  return textFlag(text, pattern);
}

export function techniqueOrTextFlag(
  input: ProcedureFactsInput,
  text: string,
  pattern: RegExp
): FactValue<true> | undefined {
  return structuredValuesOrTextFlag([{ field: TECHNIQUE_FIELD_LABEL, values: input.technique ?? [] }], text, pattern);
}

export function medicationOrTechniqueOrTextFlag(
  input: ProcedureFactsInput,
  text: string,
  pattern: RegExp
): FactValue<true> | undefined {
  return structuredValuesOrTextFlag(
    [
      { field: MEDICATION_FIELD_LABEL, values: [input.medicationUsed ?? ''] },
      { field: TECHNIQUE_FIELD_LABEL, values: input.technique ?? [] },
    ],
    text,
    pattern
  );
}

const SIDE_WORD_PATTERN = /\b(?:left|right|bilateral)\b/gi;
const SIDE_WORD_BINDING_RADIUS = 24;

function sideWordBoundToBodyPart(text: string): boolean {
  const regex = globalVariant(SIDE_WORD_PATTERN);
  let result: RegExpExecArray | null;
  while ((result = regex.exec(text)) !== null) {
    const after = result.index + result[0].length;
    if (normalizeAnatomicSite(text.slice(after, after + SIDE_WORD_BINDING_RADIUS)) !== undefined) return true;
  }
  return false;
}

export function lateralityDocumented(input: ProcedureFactsInput, text: string, boundPattern?: RegExp): boolean {
  if (input.bodySide?.trim()) return true;
  return boundPattern === undefined ? sideWordBoundToBodyPart(text) : firstMatch(text, boundPattern) !== undefined;
}

export const INCISION_PATTERN = /\bincis\w+\b|scalpel|#\s*11\s+blade|\b11[-\s]?blade\b/i;

const ANY_SIZE_FIGURE_PATTERN = new RegExp(String.raw`(?:${NUMBER_SOURCE})\s*${LENGTH_UNIT_SOURCE}\b`, 'i');

export function lesionSizeDocumented(input: ProcedureFactsInput, text: string): boolean {
  return input.lengthCm !== undefined || ANY_SIZE_FIGURE_PATTERN.test(normalizeNoteText(text));
}

export const ANESTHESIA_PATTERN =
  /lidocaine|\blido\b|bupivacaine|marcaine|septocaine|tetracaine|proparacaine|anesthe\w*|digital\s+block|field\s+block/i;

const LET_GEL_PATTERN = /\bLET\b/;

export function extractAnesthesiaDocumented(input: ProcedureFactsInput, text: string): FactValue<true> | undefined {
  const fromText = textFlag(text, ANESTHESIA_PATTERN) ?? textFlag(text, LET_GEL_PATTERN);
  if (fromText) return fromText;
  if (input.medicationUsed && input.medicationUsed.trim().length > 0) {
    return { value: true, evidence: fieldEvidence(MEDICATION_FIELD_LABEL) };
  }
  return undefined;
}

export const HEMOSTASIS_PATTERN =
  /hemostasis|bleeding\s+(?:controlled|stopped|resolved|ceased)|no\s+(?:active\s+|further\s+|ongoing\s+)?bleeding|without\s+bleeding|epistaxis\s+(?:controlled|resolved)/i;

export const TM_INTACT_PATTERN =
  /(?:tympanic\s+membrane|\bTM\b)[^.;\n]{0,30}\b(?:intact|normal|clear|visualized|without)|intact\s+(?:tympanic\s+membrane|\bTM\b)/i;

export const TOLERANCE_PATTERN =
  /tolerat\w*|no\s+adverse\s+(?:reaction|event)|(?:without|w\/o)\s+adverse|no\s+reaction/i;
