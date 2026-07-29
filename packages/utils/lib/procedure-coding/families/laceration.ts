// Laceration repair (wound closure) coding model — functional requirements §6.1.
// Simple repairs 12001-12018, intermediate repairs 12031-12057, complex repairs 13100-13153.
// Tissue-rearrangement wounds (adjacent tissue transfer, CPT 14xxx) and unmodeled 13xxx codes
// (e.g. 13160) are outside scope and are reported "not assessed", never guessed.

import {
  AnatomicSite,
  ComplexRepairElement,
  extractLacerationFacts,
  LacerationFacts,
  LacerationWound,
} from '../extract';
import {
  CodeCandidate,
  CodeSuggestion,
  FactConfidence,
  FamilyEvaluation,
  Finding,
  ProcedureFactsInput,
  ProcedureFamilyModel,
  RepairDepthSelection,
  WhereToDocument,
  whereToDocumentClause,
} from '../model.types';

export type LacerationRepairClass = 'simple' | 'intermediate' | 'complex';

export type LacerationSiteGroup =
  | 'simple-trunk-extremities'
  | 'simple-face-mm'
  | 'intermediate-trunk-extremities'
  | 'intermediate-neck-hands-feet-genitalia'
  | 'intermediate-face-mm';

/** Complex repairs group sites differently from both the simple and intermediate tables. */
export type ComplexRepairSiteGroup =
  | 'complex-trunk'
  | 'complex-scalp-arms-legs'
  | 'complex-forehead-neck-hands-feet'
  | 'complex-eyelids-nose-ears-lips';

interface CodeBand {
  code: string;
  /** Printed lower bound of the band (0 for the first band). */
  minCm: number;
  /** Inclusive upper bound; null for the open-ended top band. */
  maxCm: number | null;
}

interface CodeSeries {
  group: LacerationSiteGroup;
  repairClass: LacerationRepairClass;
  classLabel: 'Simple' | 'Intermediate';
  groupLabel: string;
  bands: CodeBand[];
}

// Band tables per requirements §6.1 (vintage: CPT_RULES_VINTAGE in ../provenance).
const LACERATION_CODE_SERIES: CodeSeries[] = [
  {
    group: 'simple-trunk-extremities',
    repairClass: 'simple',
    classLabel: 'Simple',
    groupLabel: 'scalp/neck/axillae/genitalia/trunk/extremities (including hands and feet)',
    bands: [
      { code: '12001', minCm: 0, maxCm: 2.5 },
      { code: '12002', minCm: 2.6, maxCm: 7.5 },
      { code: '12004', minCm: 7.6, maxCm: 12.5 },
      { code: '12005', minCm: 12.6, maxCm: 20.0 },
      { code: '12006', minCm: 20.1, maxCm: 30.0 },
      { code: '12007', minCm: 30.1, maxCm: null },
    ],
  },
  {
    group: 'simple-face-mm',
    repairClass: 'simple',
    classLabel: 'Simple',
    groupLabel: 'face/ears/eyelids/nose/lips/mucous membranes',
    bands: [
      { code: '12011', minCm: 0, maxCm: 2.5 },
      { code: '12013', minCm: 2.6, maxCm: 5.0 },
      { code: '12014', minCm: 5.1, maxCm: 7.5 },
      { code: '12015', minCm: 7.6, maxCm: 12.5 },
      { code: '12016', minCm: 12.6, maxCm: 20.0 },
      { code: '12017', minCm: 20.1, maxCm: 30.0 },
      { code: '12018', minCm: 30.1, maxCm: null },
    ],
  },
  {
    group: 'intermediate-trunk-extremities',
    repairClass: 'intermediate',
    classLabel: 'Intermediate',
    groupLabel: 'scalp/axillae/trunk/extremities (excluding hands and feet)',
    bands: [
      { code: '12031', minCm: 0, maxCm: 2.5 },
      { code: '12032', minCm: 2.6, maxCm: 7.5 },
      { code: '12034', minCm: 7.6, maxCm: 12.5 },
      { code: '12035', minCm: 12.6, maxCm: 20.0 },
      { code: '12036', minCm: 20.1, maxCm: 30.0 },
      { code: '12037', minCm: 30.1, maxCm: null },
    ],
  },
  {
    group: 'intermediate-neck-hands-feet-genitalia',
    repairClass: 'intermediate',
    classLabel: 'Intermediate',
    groupLabel: 'neck/hands/feet/genitalia',
    bands: [
      { code: '12041', minCm: 0, maxCm: 2.5 },
      { code: '12042', minCm: 2.6, maxCm: 7.5 },
      { code: '12044', minCm: 7.6, maxCm: 12.5 },
      { code: '12045', minCm: 12.6, maxCm: 20.0 },
      { code: '12046', minCm: 20.1, maxCm: 30.0 },
      { code: '12047', minCm: 30.1, maxCm: null },
    ],
  },
  {
    group: 'intermediate-face-mm',
    repairClass: 'intermediate',
    classLabel: 'Intermediate',
    groupLabel: 'face/ears/eyelids/nose/lips/mucous membranes',
    bands: [
      { code: '12051', minCm: 0, maxCm: 2.5 },
      { code: '12052', minCm: 2.6, maxCm: 7.5 },
      { code: '12054', minCm: 7.6, maxCm: 12.5 },
      { code: '12055', minCm: 12.6, maxCm: 20.0 },
      { code: '12056', minCm: 20.1, maxCm: 30.0 },
      { code: '12057', minCm: 30.1, maxCm: null },
    ],
  },
];

interface IndexedCode {
  series: CodeSeries;
  band: CodeBand;
  bandIndex: number;
}

const LACERATION_CODE_INDEX: Record<string, IndexedCode> = {};
const SERIES_BY_GROUP: Record<LacerationSiteGroup, CodeSeries> = {} as Record<LacerationSiteGroup, CodeSeries>;
for (const series of LACERATION_CODE_SERIES) {
  SERIES_BY_GROUP[series.group] = series;
  series.bands.forEach((band, bandIndex) => {
    LACERATION_CODE_INDEX[band.code] = { series, band, bandIndex };
  });
}

export function isLacerationRepairCode(code: string): boolean {
  return Boolean(LACERATION_CODE_INDEX[code]);
}

/** Complex repair range (131xx-133xx) — 13100-13153 are modeled; the rest stay not assessed. */
export function isComplexRepairCode(code: string): boolean {
  return /^13[123]\d{2}$/.test(code);
}

// ── Complex repair code tables (CPT 13100-13153) ───────────────────────────────
// Per site group: a base code (1.1-2.5 cm), a second code (2.6-7.5 cm), and an add-on
// code for each additional 5 cm or part thereof beyond 7.5 cm. Lengths under 1.1 cm
// cannot be billed as a complex repair at all.

export const COMPLEX_REPAIR_MIN_CM = 1.1;

interface ComplexCodeSeries {
  group: ComplexRepairSiteGroup;
  groupLabel: string;
  /** 1.1–2.5 cm. */
  baseCode: string;
  /** 2.6–7.5 cm. */
  secondCode: string;
  /** Add-on: each additional 5 cm or part thereof beyond 7.5 cm, billed with the second code. */
  addOnCode: string;
}

const COMPLEX_CODE_SERIES: ComplexCodeSeries[] = [
  { group: 'complex-trunk', groupLabel: 'trunk', baseCode: '13100', secondCode: '13101', addOnCode: '13102' },
  {
    group: 'complex-scalp-arms-legs',
    groupLabel: 'scalp/arms/legs',
    baseCode: '13120',
    secondCode: '13121',
    addOnCode: '13122',
  },
  {
    group: 'complex-forehead-neck-hands-feet',
    groupLabel: 'forehead/cheeks/chin/mouth/neck/axillae/genitalia/hands/feet',
    baseCode: '13131',
    secondCode: '13132',
    addOnCode: '13133',
  },
  {
    group: 'complex-eyelids-nose-ears-lips',
    groupLabel: 'eyelids/nose/ears/lips',
    baseCode: '13151',
    secondCode: '13152',
    addOnCode: '13153',
  },
];

type ComplexCodeRole = 'base' | 'second' | 'addOn';

interface IndexedComplexCode {
  series: ComplexCodeSeries;
  role: ComplexCodeRole;
}

const COMPLEX_CODE_INDEX: Record<string, IndexedComplexCode> = {};
const COMPLEX_SERIES_BY_GROUP = {} as Record<ComplexRepairSiteGroup, ComplexCodeSeries>;
for (const series of COMPLEX_CODE_SERIES) {
  COMPLEX_SERIES_BY_GROUP[series.group] = series;
  COMPLEX_CODE_INDEX[series.baseCode] = { series, role: 'base' };
  COMPLEX_CODE_INDEX[series.secondCode] = { series, role: 'second' };
  COMPLEX_CODE_INDEX[series.addOnCode] = { series, role: 'addOn' };
}

const COMPLEX_ELEMENT_LABELS: Record<ComplexRepairElement, string> = {
  'extensive-undermining': 'extensive undermining',
  'retention-sutures': 'retention sutures',
  stents: 'stent placement',
  debridement: 'debridement of wound edges/devitalized tissue',
  'exposed-structure': 'exposed bone/cartilage/tendon/neurovascular structure',
  'free-margin': 'free-margin involvement',
};

/** The qualifying-element menu, spelled out in plain language for findings. */
const COMPLEX_ELEMENT_MENU =
  'extensive undermining, retention sutures, stents, debridement, exposed bone/cartilage/tendon, or free-margin involvement';

function complexElementList(facts: LacerationFacts): string {
  return facts.complexElements.map((element) => COMPLEX_ELEMENT_LABELS[element.value]).join(', ');
}

export const LACERATION_TISSUE_ADHESIVE_PAYER_NOTE =
  'Payer note: when tissue adhesive is the only closure, Medicare is billed with HCPCS code G0168 instead of a CPT repair code; handling by commercial insurers varies.';

// ── Structured "Repair depth" select (design §6) ───────────────────────────────

/** The Repair depth select options, in display order (single-sourced for the UI and the engine). */
export const REPAIR_DEPTH_OPTIONS: Array<{ value: RepairDepthSelection; label: string }> = [
  { value: 'superficial-single', label: 'Superficial — single-layer closure' },
  { value: 'subcutaneous-single', label: 'Subcutaneous — single-layer closure' },
  { value: 'subcutaneous-layered', label: 'Subcutaneous — layered closure' },
  { value: 'fascia-muscle-layered', label: 'Fascia/muscle involved — layered closure' },
  { value: 'tissue-adhesive-only', label: 'Tissue adhesive only (e.g. Dermabond)' },
  { value: 'strips-only', label: 'Adhesive strips only' },
];

/** Narrows a persisted string (DTO/page state) to a known Repair depth selection. */
export function isRepairDepthSelection(value: string | undefined): value is RepairDepthSelection {
  return REPAIR_DEPTH_OPTIONS.some((option) => option.value === value);
}

/** Repair class each non-adhesive selection determines. */
const REPAIR_DEPTH_SELECTION_CLASS: Record<
  Exclude<RepairDepthSelection, 'tissue-adhesive-only' | 'strips-only'>,
  LacerationRepairClass
> = {
  'superficial-single': 'simple',
  'subcutaneous-single': 'simple',
  'subcutaneous-layered': 'intermediate',
  'fascia-muscle-layered': 'intermediate',
};

const OUTSIDE_SCOPE_MESSAGE =
  'The note documents tissue rearrangement (e.g. a flap or Z-plasty) — that points to an adjacent tissue transfer (CPT 14000-series), which these documentation checks do not cover; not assessed.';

// ── Where each missing element belongs on the procedure form ───────────────────
// Form-field labels as they appear on the Document Procedure page; single-sourced so
// the messages and the mismatch finding name the same fields.

const LENGTH_FIELD_LABEL = 'Wound/lesion size (cm)';
const REPAIR_DEPTH_FIELD_LABEL = 'Repair depth';
const DETAILS_FIELD_LABEL = 'Procedure details';
const TO_DETAILS = `to ${DETAILS_FIELD_LABEL}`;

/** Destination for every element a finding can report missing, folded into the message text. */
const WHERE_TO_DOCUMENT = {
  site: { destination: 'in the Site/location field' },
  laterality: { destination: 'in the Side of body field' },
  length: { destination: `in the ${LENGTH_FIELD_LABEL} field` },
  depth: {
    destination: `in the ${REPAIR_DEPTH_FIELD_LABEL} field, or describe the closure in ${DETAILS_FIELD_LABEL}`,
    example: '"Layered closure" or "Single-layer closure"',
  },
  sutureClosure: { destination: TO_DETAILS, example: '"5 x 4-0 nylon, simple interrupted"' },
  complexElement: { destination: TO_DETAILS, example: '"extensive undermining performed; retention sutures placed"' },
  stapleClosure: { destination: TO_DETAILS, example: '"4 staples"' },
  extensiveCleaning: { destination: TO_DETAILS, example: '"copiously irrigated with 500 mL saline"' },
  anesthesia: { destination: 'in the Anaesthesia / medication used field', example: '"3 mL 1% lidocaine"' },
  irrigation: { destination: TO_DETAILS, example: '"irrigated with 250 mL normal saline"' },
  tetanus: { destination: TO_DETAILS, example: '"tetanus up to date"' },
} satisfies Record<string, WhereToDocument>;

function whereClause(element: keyof typeof WHERE_TO_DOCUMENT, verb?: string): string {
  return whereToDocumentClause(WHERE_TO_DOCUMENT[element], verb);
}

// ── Site grouping (differs per repair class: each class has its own mapping) ───

const FACE_MM_SITES: AnatomicSite[] = ['face', 'ear', 'eyelid', 'nose', 'lip', 'mucous-membrane'];
const INTERMEDIATE_NHFG_SITES: AnatomicSite[] = ['neck', 'hand', 'foot', 'genitalia'];
const COMPLEX_ENEL_SITES: AnatomicSite[] = ['eyelid', 'nose', 'ear', 'lip'];

/** Complex repairs split sites differently again: eyelids/nose/ears/lips get their own table. */
export function complexRepairSiteGroup(site: AnatomicSite): ComplexRepairSiteGroup {
  if (COMPLEX_ENEL_SITES.includes(site)) return 'complex-eyelids-nose-ears-lips';
  if (site === 'trunk') return 'complex-trunk';
  if (site === 'scalp' || site === 'extremity') return 'complex-scalp-arms-legs';
  // Forehead/cheeks/chin (face), mouth, neck, axillae, genitalia, hands, feet.
  return 'complex-forehead-neck-hands-feet';
}

export function lacerationSiteGroup(repairClass: 'simple' | 'intermediate', site: AnatomicSite): LacerationSiteGroup;
export function lacerationSiteGroup(
  repairClass: LacerationRepairClass,
  site: AnatomicSite
): LacerationSiteGroup | ComplexRepairSiteGroup;
export function lacerationSiteGroup(
  repairClass: LacerationRepairClass,
  site: AnatomicSite
): LacerationSiteGroup | ComplexRepairSiteGroup {
  if (repairClass === 'complex') {
    return complexRepairSiteGroup(site);
  }
  if (FACE_MM_SITES.includes(site)) {
    return repairClass === 'simple' ? 'simple-face-mm' : 'intermediate-face-mm';
  }
  if (repairClass === 'simple') {
    return 'simple-trunk-extremities';
  }
  return INTERMEDIATE_NHFG_SITES.includes(site)
    ? 'intermediate-neck-hands-feet-genitalia'
    : 'intermediate-trunk-extremities';
}

const SITE_LABELS: Record<AnatomicSite, string> = {
  scalp: 'scalp',
  face: 'face',
  ear: 'ear',
  eyelid: 'eyelid',
  nose: 'nose',
  lip: 'lip',
  'mucous-membrane': 'mucous membrane',
  neck: 'neck',
  axilla: 'axilla',
  genitalia: 'genitalia',
  trunk: 'trunk',
  extremity: 'extremity',
  hand: 'hand',
  foot: 'foot',
};

const LATERALIZABLE_SITES: AnatomicSite[] = ['extremity', 'hand', 'foot', 'ear', 'eyelid', 'axilla'];

// ── Repair class resolution ────────────────────────────────────────────────────

type RepairBasis =
  | 'layered'
  | 'single-layer'
  | 'contaminated'
  | 'adhesive'
  | 'complex-element'
  | 'structured-layered'
  | 'structured-single'
  | 'structured-adhesive'
  | 'structured-strips';

/** Bases established by the structured Repair depth field (vs the details text or supplies). */
const STRUCTURED_BASES: RepairBasis[] = [
  'structured-layered',
  'structured-single',
  'structured-adhesive',
  'structured-strips',
];

interface RepairClassResolution {
  repairClass?: LacerationRepairClass | 'outside-scope';
  basis?: RepairBasis;
  sourceText?: string;
  confidence?: FactConfidence;
}

function sutureEvidence(facts: LacerationFacts): boolean {
  return Boolean(
    facts.suturesDocumented ||
      facts.closureCount ||
      facts.closureMaterial ||
      (facts.closureMethod && !['staples', 'tissue adhesive'].includes(facts.closureMethod.value))
  );
}

function stapleEvidence(facts: LacerationFacts): boolean {
  return Boolean(facts.staplesDocumented || facts.closureMethod?.value === 'staples');
}

function tissueAdhesiveOnly(facts: LacerationFacts): boolean {
  return Boolean(facts.tissueAdhesiveDocumented) && !sutureEvidence(facts) && !stapleEvidence(facts);
}

function adhesiveStripsOnly(facts: LacerationFacts): boolean {
  return (
    Boolean(facts.adhesiveStripsDocumented) &&
    !sutureEvidence(facts) &&
    !stapleEvidence(facts) &&
    !facts.tissueAdhesiveDocumented
  );
}

export function resolveRepairClass(facts: LacerationFacts): RepairClassResolution {
  if (facts.outsideScope) {
    return { repairClass: 'outside-scope', sourceText: facts.outsideScope.sourceText, confidence: 'text' };
  }
  // Structured Repair depth selection wins over the text-derived class/adhesive facts below;
  // disagreements with the text surface as a reconcile finding (repairDepthMismatchFinding).
  const selection = facts.structuredRepairDepth;
  if (selection === 'tissue-adhesive-only') {
    // Tissue adhesive as the only closure: by definition a simple repair (Medicare's G0168
    // redirection is a payer footnote, matching the text-driven tissue-adhesive path).
    return { repairClass: 'simple', basis: 'structured-adhesive', confidence: 'structured' };
  }
  if (selection === 'strips-only') {
    // Strips support no repair code (the callers early-return on that); the class is still
    // resolved so the field satisfies the repair-depth [D] ask.
    return { repairClass: 'simple', basis: 'structured-strips', confidence: 'structured' };
  }
  const complexElement = facts.complexElements[0];
  if (selection !== undefined) {
    if (REPAIR_DEPTH_SELECTION_CLASS[selection] === 'intermediate') {
      // A layered selection is compatible with a complex repair: a documented qualifying
      // element (CPT 2020 complex definition) upgrades the class to complex.
      if (complexElement) {
        return {
          repairClass: 'complex',
          basis: 'complex-element',
          sourceText: complexElement.sourceText,
          confidence: 'text',
        };
      }
      return { repairClass: 'intermediate', basis: 'structured-layered', confidence: 'structured' };
    }
    // Single-layer selection: heavy contamination + extensive cleaning still upgrades to
    // intermediate (the same rule as text-documented single-layer closures below).
    if (facts.contaminationDocumented && facts.extensiveCleaningDocumented) {
      return {
        repairClass: 'intermediate',
        basis: 'contaminated',
        sourceText: facts.contaminationDocumented.sourceText,
        confidence: 'text',
      };
    }
    // An explicit single-layer selection wins even over a documented qualifying element —
    // a single-layer closure is not a complex repair (the inverse still flags complex codes).
    return { repairClass: 'simple', basis: 'structured-single', confidence: 'structured' };
  }
  // Text path: a qualifying element upgrades to complex unless the text pins single-layer.
  if (complexElement && facts.depth?.value !== 'single-layer') {
    return {
      repairClass: 'complex',
      basis: 'complex-element',
      sourceText: complexElement.sourceText,
      confidence: 'text',
    };
  }
  if (facts.depth?.value === 'layered') {
    return {
      repairClass: 'intermediate',
      basis: 'layered',
      sourceText: facts.depth.sourceText,
      confidence: facts.depth.confidence,
    };
  }
  // Contamination path: heavy contamination + extensive cleaning documented ⇒ intermediate
  // (single-layer + that documentation qualifies; a layered wound is intermediate regardless).
  if (facts.contaminationDocumented && facts.extensiveCleaningDocumented) {
    return {
      repairClass: 'intermediate',
      basis: 'contaminated',
      sourceText: facts.contaminationDocumented.sourceText,
      confidence: 'text',
    };
  }
  if (facts.depth?.value === 'single-layer') {
    return {
      repairClass: 'simple',
      basis: 'single-layer',
      sourceText: facts.depth.sourceText,
      confidence: facts.depth.confidence,
    };
  }
  // Tissue adhesive as the only closure: by definition a simple repair (no layered closure documented).
  if (tissueAdhesiveOnly(facts)) {
    return {
      repairClass: 'simple',
      basis: 'adhesive',
      sourceText: facts.tissueAdhesiveDocumented?.sourceText,
      confidence: facts.tissueAdhesiveDocumented?.confidence,
    };
  }
  return {};
}

function classBasisDescription(basis: RepairBasis | undefined): string {
  switch (basis) {
    case 'layered':
      return 'layered closure documented';
    case 'structured-layered':
      return `layered closure selected in the ${REPAIR_DEPTH_FIELD_LABEL} field`;
    case 'structured-single':
      return `single-layer closure selected in the ${REPAIR_DEPTH_FIELD_LABEL} field`;
    case 'structured-adhesive':
      return `tissue-adhesive-only closure selected in the ${REPAIR_DEPTH_FIELD_LABEL} field`;
    case 'structured-strips':
      return `adhesive-strips-only closure selected in the ${REPAIR_DEPTH_FIELD_LABEL} field`;
    case 'contaminated':
      return 'single-layer closure of a heavily contaminated wound with extensive cleaning documented (together these qualify as an intermediate repair)';
    case 'complex-element':
      return 'complex-repair element documented';
    case 'adhesive':
      return 'tissue-adhesive closure documented';
    default:
      return 'single-layer closure documented';
  }
}

// ── Structured Repair depth vs details-text reconciliation ─────────────────────

/**
 * The structured Repair depth selection vs details-text disagreement, when both are present:
 * either the two disagree on repair class, or the field says an adhesive-only closure
 * (tissue adhesive or strips) while the text documents sutures/staples. Modeled on the
 * length mismatch finding — plain language, names both fields, and says the checks use
 * the field's value.
 */
function repairDepthMismatchFinding(facts: LacerationFacts): Finding | undefined {
  const selection = facts.structuredRepairDepth;
  if (selection === undefined) return undefined;
  const reconcileClause = `— please reconcile them; the checks use the value from the field.`;
  if (selection === 'tissue-adhesive-only' || selection === 'strips-only') {
    const sutures = sutureEvidence(facts);
    const staples = stapleEvidence(facts);
    if (!sutures && !staples) return undefined;
    const closureEvidence = sutures && staples ? 'sutures and staples' : staples ? 'staples' : 'sutures';
    const fieldClosure =
      selection === 'tissue-adhesive-only'
        ? 'a tissue-adhesive-only closure (no sutures or staples)'
        : 'closure with adhesive strips only (no sutures or staples)';
    return {
      level: 'contradiction',
      message: `The ${REPAIR_DEPTH_FIELD_LABEL} field documents ${fieldClosure}, but the ${DETAILS_FIELD_LABEL} text documents ${closureEvidence} ${reconcileClause}`,
      sourceText:
        facts.suturesDocumented?.sourceText ??
        facts.staplesDocumented?.sourceText ??
        facts.closureMethod?.sourceText ??
        facts.closureMaterial?.sourceText ??
        facts.closureCount?.sourceText,
      confidence: 'text',
    };
  }
  if (facts.depth === undefined) return undefined;
  const fieldClass = REPAIR_DEPTH_SELECTION_CLASS[selection];
  const textClass: LacerationRepairClass = facts.depth.value === 'layered' ? 'intermediate' : 'simple';
  if (fieldClass === textClass) return undefined;
  const classDescription = (repairClass: LacerationRepairClass): string =>
    repairClass === 'intermediate' ? 'a layered closure' : 'a single-layer closure';
  return {
    level: 'contradiction',
    message: `The ${REPAIR_DEPTH_FIELD_LABEL} field documents ${classDescription(
      fieldClass
    )}, but the ${DETAILS_FIELD_LABEL} text documents ${classDescription(textClass)} ${reconcileClause}`,
    sourceText: facts.depth.sourceText,
    confidence: 'text',
  };
}

// ── Length totals (multi-wound sum rule) ───────────────────────────────────────

interface WoundTotals {
  /** Total repaired length for the entry's own site group (structured input preferred). */
  totalCm?: number;
  totalConfidence?: FactConfidence;
  totalSourceText?: string;
  /** Wounds the text places in a different site group — never summed into the total. */
  otherGroupWounds: LacerationWound[];
  /** Structured length vs details-text disagreement, when both are present. */
  mismatchFinding?: Finding;
}

function computeWoundTotals(
  facts: LacerationFacts,
  repairClass: LacerationRepairClass | undefined,
  entrySite: AnatomicSite | undefined
): WoundTotals {
  const primaryWounds: LacerationWound[] = [];
  const otherGroupWounds: LacerationWound[] = [];
  for (const wound of facts.wounds) {
    const woundSite = wound.site ?? entrySite;
    if (entrySite === undefined || woundSite === undefined) {
      primaryWounds.push(wound);
      continue;
    }
    const sameGroup =
      repairClass !== undefined
        ? lacerationSiteGroup(repairClass, woundSite) === lacerationSiteGroup(repairClass, entrySite)
        : woundSite === entrySite; // class unknown: only same-site wounds are provably same-group
    if (sameGroup) {
      primaryWounds.push(wound);
    } else {
      otherGroupWounds.push(wound);
    }
  }

  const textSum = primaryWounds.length > 0 ? primaryWounds.reduce((sum, w) => sum + w.lengthCm, 0) : undefined;
  const textSourceText = primaryWounds.find((w) => w.sourceText)?.sourceText;

  const result: WoundTotals = { otherGroupWounds };
  if (facts.structuredLengthCm !== undefined) {
    result.totalCm = facts.structuredLengthCm;
    result.totalConfidence = 'structured';
    if (textSum !== undefined && Math.abs(textSum - facts.structuredLengthCm) > 0.05) {
      result.mismatchFinding = {
        level: 'contradiction',
        message: `The ${LENGTH_FIELD_LABEL} field documents ${formatCm(
          facts.structuredLengthCm
        )} cm, but the ${DETAILS_FIELD_LABEL} text documents ${formatCm(
          textSum
        )} cm — please reconcile them; the checks use the value from the field.`,
        sourceText: textSourceText,
        confidence: 'text',
      };
    }
  } else if (textSum !== undefined) {
    result.totalCm = roundCm(textSum);
    result.totalConfidence = 'text';
    result.totalSourceText = textSourceText;
  }
  return result;
}

function roundCm(value: number): number {
  return Math.round(value * 10) / 10;
}

function formatCm(value: number): string {
  return value.toFixed(1);
}

// ── Band helpers ───────────────────────────────────────────────────────────────

function bandLowerBound(series: CodeSeries, bandIndex: number): number {
  return bandIndex === 0 ? 0 : series.bands[bandIndex - 1].maxCm ?? 0;
}

function lengthFitsBand(indexed: IndexedCode, lengthCm: number): boolean {
  const lower = bandLowerBound(indexed.series, indexed.bandIndex);
  const upperOk = indexed.band.maxCm === null || lengthCm <= indexed.band.maxCm + 1e-9;
  return lengthCm > lower + 1e-9 && upperOk;
}

function bandForLength(series: CodeSeries, lengthCm: number): CodeBand {
  for (const band of series.bands) {
    if (band.maxCm === null || lengthCm <= band.maxCm + 1e-9) {
      return band;
    }
  }
  return series.bands[series.bands.length - 1];
}

function bandLabel(band: CodeBand): string {
  if (band.maxCm === null) return `>${formatCm(band.minCm - 0.1)} cm`;
  if (band.minCm === 0) return `≤${formatCm(band.maxCm)} cm`;
  return `${formatCm(band.minCm)}–${formatCm(band.maxCm)} cm`;
}

function codeCandidate(series: CodeSeries, band: CodeBand): CodeCandidate {
  return {
    code: band.code,
    display: `${band.code} — ${series.classLabel} repair, ${series.groupLabel}, ${bandLabel(band)}`,
  };
}

// ── Complex band helpers ───────────────────────────────────────────────────────

/** Add-on units for a complex repair: one per additional 5 cm (or part) beyond 7.5 cm. */
function complexAddOnUnits(totalCm: number): number {
  return Math.max(0, Math.ceil((totalCm - 7.5) / 5 - 1e-9));
}

function complexBandLabel(role: ComplexCodeRole): string {
  if (role === 'base') return `${formatCm(COMPLEX_REPAIR_MIN_CM)}–2.5 cm`;
  if (role === 'second') return '2.6–7.5 cm';
  return 'each additional 5 cm (or part) beyond 7.5 cm';
}

function complexCodeForRole(series: ComplexCodeSeries, role: ComplexCodeRole): string {
  return role === 'base' ? series.baseCode : role === 'second' ? series.secondCode : series.addOnCode;
}

function complexCodeCandidate(series: ComplexCodeSeries, role: ComplexCodeRole): CodeCandidate {
  const code = complexCodeForRole(series, role);
  return { code, display: `${code} — Complex repair, ${series.groupLabel}, ${complexBandLabel(role)}` };
}

function candidatesFor(
  repairClass: LacerationRepairClass | undefined,
  entrySite: AnatomicSite | undefined
): CodeCandidate[] {
  if (repairClass === 'complex') {
    const complexSeriesList =
      entrySite !== undefined ? [COMPLEX_SERIES_BY_GROUP[complexRepairSiteGroup(entrySite)]] : COMPLEX_CODE_SERIES;
    return complexSeriesList.flatMap((series) =>
      (['base', 'second', 'addOn'] as ComplexCodeRole[]).map((role) => complexCodeCandidate(series, role))
    );
  }
  let seriesList: CodeSeries[];
  if (repairClass !== undefined && entrySite !== undefined) {
    seriesList = [SERIES_BY_GROUP[lacerationSiteGroup(repairClass, entrySite)]];
  } else if (repairClass !== undefined) {
    seriesList = LACERATION_CODE_SERIES.filter((s) => s.repairClass === repairClass);
  } else if (entrySite !== undefined) {
    seriesList = [
      SERIES_BY_GROUP[lacerationSiteGroup('simple', entrySite)],
      SERIES_BY_GROUP[lacerationSiteGroup('intermediate', entrySite)],
    ];
  } else {
    seriesList = LACERATION_CODE_SERIES;
  }
  return seriesList.flatMap((series) => series.bands.map((band) => codeCandidate(series, band)));
}

// ── Shared finding builders ────────────────────────────────────────────────────

function otherGroupAdvisories(
  otherGroupWounds: LacerationWound[],
  repairClass: LacerationRepairClass | undefined
): Finding[] {
  return otherGroupWounds.map((wound) => ({
    level: 'bestPractice' as const,
    message: `The note also documents a ${formatCm(wound.lengthCm)} cm wound on the ${
      wound.site ? SITE_LABELS[wound.site] : 'documented site'
    } — ${
      repairClass ? `for ${repairClass} repairs, ` : ''
    }that site is coded separately from this entry's site, so the lengths are not added together. That wound needs its own procedure entry.`,
    sourceText: wound.sourceText,
    confidence: wound.confidence,
  }));
}

function missingClosureElements(facts: LacerationFacts): string[] {
  // Adhesive documented as the closure: method is known and material/count do not apply.
  if (
    facts.structuredRepairDepth === 'tissue-adhesive-only' ||
    facts.closureMethod?.value === 'tissue adhesive' ||
    tissueAdhesiveOnly(facts)
  ) {
    return [];
  }
  const missing: string[] = [];
  if (!facts.closureMethod) missing.push('closure method');
  if (stapleEvidence(facts)) {
    // Staples: the material is the staples themselves; the count still belongs in the note.
    if (!facts.closureCount) missing.push('staple count');
    return missing;
  }
  if (!facts.closureMaterial) missing.push('suture material');
  if (!facts.closureCount) missing.push('suture count');
  return missing;
}

function emptyEvaluation(): FamilyEvaluation {
  return { findings: [], supportedCodes: [], notAssessedCodes: [] };
}

// ── Forward: facts → code ──────────────────────────────────────────────────────

function suggestLacerationCode(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractLacerationFacts(input);
  const evaluation = emptyEvaluation();
  const { findings } = evaluation;

  const classResolution = resolveRepairClass(facts);
  if (classResolution.repairClass === 'outside-scope') {
    findings.push({
      level: 'bestPractice',
      message: OUTSIDE_SCOPE_MESSAGE,
      sourceText: classResolution.sourceText,
      confidence: 'text',
    });
    evaluation.notAssessed = true;
    evaluation.notAssessedReason = OUTSIDE_SCOPE_MESSAGE;
    return evaluation;
  }

  const depthMismatch = repairDepthMismatchFinding(facts);
  if (depthMismatch) findings.push(depthMismatch);

  // Adhesive strips selected in the Repair depth field: no repair code, per the same rule as the
  // text-driven adhesive-strips path below. (A tissue-adhesive-only selection is different — it
  // resolves to a simple repair and the suggestion proceeds normally, with the G0168 payer note.)
  if (facts.structuredRepairDepth === 'strips-only') {
    findings.push({
      level: 'contradiction',
      message: `The ${REPAIR_DEPTH_FIELD_LABEL} field documents closure with adhesive strips only — adhesive strips alone do not support a wound-repair code; that care is part of the visit (E/M) charge instead.`,
      confidence: 'structured',
    });
    return evaluation;
  }

  if (facts.structuredRepairDepth === undefined && adhesiveStripsOnly(facts)) {
    findings.push({
      level: 'contradiction',
      message:
        'The note documents wound closure with adhesive strips only — adhesive strips alone do not support a wound-repair code; that care is part of the visit (E/M) charge instead.',
      sourceText: facts.adhesiveStripsDocumented?.sourceText,
      confidence: facts.adhesiveStripsDocumented?.confidence,
    });
    return evaluation;
  }

  const entrySite = facts.site?.value;
  let repairClass = classResolution.repairClass;
  let repairBasis = classResolution.basis;
  const totals = computeWoundTotals(facts, repairClass, entrySite);
  if (totals.mismatchFinding) findings.push(totals.mismatchFinding);
  findings.push(...otherGroupAdvisories(totals.otherGroupWounds, repairClass));

  // Complex repairs are reported starting at 1.1 cm: a shorter wound falls back to the
  // class its closure alone would establish (layered ⇒ intermediate).
  if (repairClass === 'complex' && totals.totalCm !== undefined && totals.totalCm < COMPLEX_REPAIR_MIN_CM - 1e-9) {
    findings.push({
      level: 'bestPractice',
      message: `The note documents a complex-repair element (${complexElementList(
        facts
      )}), but complex repair codes start at ${formatCm(COMPLEX_REPAIR_MIN_CM)} cm — a ${formatCm(
        totals.totalCm
      )} cm wound is coded as a simple or intermediate repair by its closure depth.`,
      sourceText: classResolution.sourceText,
      confidence: 'text',
    });
    const fallback = complexFallbackClass(facts);
    repairClass = fallback?.repairClass;
    repairBasis = fallback?.basis;
  }

  const missingDeterminants: Finding[] = [];
  if (entrySite === undefined) {
    missingDeterminants.push({
      level: 'determines',
      message: `Body site is not documented — which repair codes apply depends on where on the body the wound is. ${whereClause(
        'site',
        'Select it'
      )}`,
    });
  }
  if (repairClass === undefined) {
    missingDeterminants.push({
      level: 'determines',
      message: `Repair depth is not documented — a single-layer closure codes as a simple repair and a layered closure as an intermediate repair. ${whereClause(
        'depth',
        'Select it'
      )}`,
    });
  }
  if (totals.totalCm === undefined) {
    missingDeterminants.push({
      level: 'determines',
      message: `Wound length is not documented — the exact code depends on the total repaired length in cm. ${whereClause(
        'length',
        'Enter it'
      )}`,
    });
  }

  if (missingDeterminants.length > 0) {
    findings.push(...missingDeterminants);
    evaluation.openCandidates = candidatesFor(repairClass, entrySite);
    // Class + group known, only length missing: the open set narrows to one code table,
    // so surface the compact range line the UI shows above the AI list (design §5).
    if (repairClass !== undefined && entrySite !== undefined && totals.totalCm === undefined) {
      if (repairClass === 'complex') {
        const series = COMPLEX_SERIES_BY_GROUP[complexRepairSiteGroup(entrySite)];
        evaluation.openCandidatesSummary = `${series.baseCode}–${series.addOnCode} — wound length (cm) determines the exact code`;
      } else {
        const series = SERIES_BY_GROUP[lacerationSiteGroup(repairClass, entrySite)];
        const bands = series.bands;
        evaluation.openCandidatesSummary = `${bands[0].code}–${
          bands[bands.length - 1].code
        } — wound length (cm) determines the exact code`;
      }
    }
    return evaluation;
  }

  if (repairClass === 'complex') {
    evaluation.suggestion = complexSuggestion(facts, entrySite as AnatomicSite, totals.totalCm as number);
    return evaluation;
  }

  const series =
    SERIES_BY_GROUP[lacerationSiteGroup(repairClass as 'simple' | 'intermediate', entrySite as AnatomicSite)];
  const band = bandForLength(series, totals.totalCm as number);
  evaluation.suggestion = {
    code: band.code,
    display: codeCandidate(series, band).display,
    justification: `${series.classLabel} repair — ${classBasisDescription(repairBasis)}; ${
      SITE_LABELS[entrySite as AnatomicSite]
    } (${series.groupLabel}); total ${formatCm(totals.totalCm as number)} cm → ${band.code}.`,
  };
  if (repairBasis === 'adhesive' || repairBasis === 'structured-adhesive') {
    evaluation.payerNotes = [LACERATION_TISSUE_ADHESIVE_PAYER_NOTE];
  }
  return evaluation;
}

/** The class a complex-element wound falls back to when complex cannot be billed (<1.1 cm). */
function complexFallbackClass(
  facts: LacerationFacts
): { repairClass: LacerationRepairClass; basis: RepairBasis } | undefined {
  // Only layered selections resolve to complex, so a structured field means intermediate.
  if (facts.structuredRepairDepth !== undefined) {
    return { repairClass: 'intermediate', basis: 'structured-layered' };
  }
  if (facts.depth?.value === 'layered') {
    return { repairClass: 'intermediate', basis: 'layered' };
  }
  return undefined;
}

/** Forward suggestion for a determined complex repair: base/second code, plus add-on units beyond 7.5 cm. */
function complexSuggestion(facts: LacerationFacts, entrySite: AnatomicSite, totalCm: number): CodeSuggestion {
  const series = COMPLEX_SERIES_BY_GROUP[complexRepairSiteGroup(entrySite)];
  const elements = complexElementList(facts);
  const siteClause = `${SITE_LABELS[entrySite]} (${series.groupLabel})`;
  if (totalCm <= 7.5 + 1e-9) {
    const role: ComplexCodeRole = totalCm <= 2.5 + 1e-9 ? 'base' : 'second';
    const code = complexCodeForRole(series, role);
    return {
      code,
      display: complexCodeCandidate(series, role).display,
      justification: `Complex repair — ${elements} documented; ${siteClause}; total ${formatCm(totalCm)} cm → ${code}.`,
    };
  }
  const units = complexAddOnUnits(totalCm);
  return {
    code: series.secondCode,
    // The display string carries the add-on so the single suggestion row reads as the full billing.
    display: `${series.secondCode} — Complex repair, ${series.groupLabel}, ${formatCm(totalCm)} cm total (with add-on ${
      series.addOnCode
    } × ${units} for the length beyond 7.5 cm)`,
    justification: `Complex repair — ${elements} documented; ${siteClause}; total ${formatCm(totalCm)} cm → ${
      series.secondCode
    } + ${series.addOnCode} × ${units} (${series.secondCode} covers the first 7.5 cm; ${
      series.addOnCode
    } each additional 5 cm or part).`,
    addOns: [
      {
        code: series.addOnCode,
        units,
        display: complexCodeCandidate(series, 'addOn').display,
        justification: `${formatCm(totalCm - 7.5)} cm beyond the first 7.5 cm → ${series.addOnCode} × ${units}.`,
      },
    ],
  };
}

// ── Inverse: selected codes → gaps and contradictions ──────────────────────────

/** Where the resolved class was documented and how to describe it, for class-contradiction findings. */
function documentedClassClause(
  facts: LacerationFacts,
  classResolution: RepairClassResolution
): { documentedIn: string; description: string } {
  const { basis } = classResolution;
  const documentedIn =
    basis !== undefined && STRUCTURED_BASES.includes(basis) ? `the ${REPAIR_DEPTH_FIELD_LABEL} field` : 'the note';
  const description =
    basis === 'layered' || basis === 'structured-layered'
      ? 'a layered closure (an intermediate repair)'
      : basis === 'contaminated'
      ? 'a heavily contaminated wound with extensive cleaning (which qualifies as an intermediate repair)'
      : basis === 'complex-element'
      ? `a complex-repair qualifying element (${complexElementList(facts)}), which supports a complex repair`
      : basis === 'adhesive' || basis === 'structured-adhesive'
      ? 'closure with tissue adhesive alone (a simple repair)'
      : basis === 'structured-strips'
      ? 'closure with adhesive strips only (a simple repair)'
      : basis === 'structured-single'
      ? 'a single-layer closure (a simple repair)'
      : 'a single-layer superficial closure (a simple repair)';
  return { documentedIn, description };
}

function repairClassArticle(repairClass: LacerationRepairClass): string {
  return repairClass === 'simple' ? 'a simple' : repairClass === 'intermediate' ? 'an intermediate' : 'a complex';
}

/**
 * Findings for a selected complex repair code (13100-13153): the qualifying-element rule
 * (CPT 2020), the 1.1 cm minimum, the complex site-group/band tables, and add-on pairing.
 * The shared closure [R] check runs in the caller.
 */
function complexCodeFindings(
  code: string,
  indexed: IndexedComplexCode,
  facts: LacerationFacts,
  classResolution: RepairClassResolution,
  entrySite: AnatomicSite | undefined,
  selected: { code: string }[],
  entryFindings: Finding[]
): Finding[] {
  const codeFindings: Finding[] = [];
  const { series, role } = indexed;
  const resolvedClass = classResolution.repairClass as LacerationRepairClass | undefined;
  const hasElement = facts.complexElements.length > 0;

  // Qualifying element / repair class (a resolved 'complex' class implies an element).
  if (resolvedClass === 'simple') {
    // Single-layer or adhesive-only documentation actively contradicts a complex repair.
    const { documentedIn, description } = documentedClassClause(facts, classResolution);
    codeFindings.push({
      level: 'contradiction',
      cptCode: code,
      message: `${code} is a complex-repair code, but ${documentedIn} documents ${description}.`,
      sourceText: classResolution.sourceText,
      confidence: classResolution.confidence,
    });
  } else if (!hasElement) {
    const elementAsk = whereClause('complexElement', 'If it was performed, add the qualifying element');
    if (resolvedClass === 'intermediate') {
      const { documentedIn } = documentedClassClause(facts, classResolution);
      const closureDescription =
        classResolution.basis === 'contaminated'
          ? 'a heavily contaminated wound with extensive cleaning'
          : 'a layered closure';
      codeFindings.push({
        level: 'contradiction',
        cptCode: code,
        message: `${code} is selected, but ${documentedIn} documents ${closureDescription} without any complex-repair element (${COMPLEX_ELEMENT_MENU}) — as documented this supports ${intermediateEquivalentRef(
          facts,
          entrySite
        )}. ${elementAsk}`,
        sourceText: classResolution.sourceText,
        confidence: classResolution.confidence,
      });
    } else {
      codeFindings.push({
        level: 'contradiction',
        cptCode: code,
        message: `${code} is selected, but the note does not document any complex-repair element (${COMPLEX_ELEMENT_MENU}) — a complex repair needs at least one. ${elementAsk}`,
      });
    }
  }

  // Site group and length band per the complex tables.
  if (entrySite === undefined) {
    codeFindings.push({
      level: 'determines',
      cptCode: code,
      message: `Body site is not documented for ${code} — which repair codes apply depends on where on the body the wound is. ${whereClause(
        'site',
        'Select it'
      )}`,
    });
  } else if (complexRepairSiteGroup(entrySite) !== series.group) {
    codeFindings.push({
      level: 'contradiction',
      cptCode: code,
      message: `${code} covers ${series.groupLabel}, but the note documents a ${SITE_LABELS[entrySite]} wound.`,
      sourceText: facts.site?.sourceText,
      confidence: facts.site?.confidence,
    });
  } else {
    const totals = computeWoundTotals(facts, 'complex', entrySite);
    if (totals.mismatchFinding && !entryFindings.some((f) => f.message === totals.mismatchFinding?.message)) {
      entryFindings.push(totals.mismatchFinding);
    }
    if (totals.totalCm === undefined) {
      codeFindings.push({
        level: 'determines',
        cptCode: code,
        message: `Wound length is not documented for ${code} — the exact code depends on the total repaired length; ${code} covers ${complexBandLabel(
          role
        )}. ${whereClause('length', 'Enter it')}`,
      });
    } else if (totals.totalCm < COMPLEX_REPAIR_MIN_CM - 1e-9) {
      codeFindings.push({
        level: 'contradiction',
        cptCode: code,
        message: `${code} is a complex-repair code — complex repairs are reported starting at ${formatCm(
          COMPLEX_REPAIR_MIN_CM
        )} cm, but the note documents a total repaired length of ${formatCm(
          totals.totalCm
        )} cm; a wound that size is coded as a simple or intermediate repair.`,
        sourceText: totals.totalSourceText,
        confidence: totals.totalConfidence,
      });
    } else {
      const bandMismatch =
        role === 'base'
          ? totals.totalCm > 2.5 + 1e-9
          : role === 'second'
          ? totals.totalCm <= 2.5 + 1e-9
          : totals.totalCm <= 7.5 + 1e-9;
      if (bandMismatch) {
        codeFindings.push({
          level: 'contradiction',
          cptCode: code,
          message: `${code} covers ${complexBandLabel(role)} for ${
            series.groupLabel
          }, but the note documents a total repaired length of ${formatCm(totals.totalCm)} cm.`,
          sourceText: totals.totalSourceText,
          confidence: totals.totalConfidence,
        });
      }
    }
  }

  // Add-on pairing: an add-on is billed alongside its own site group's second code.
  if (role === 'addOn' && !selected.some((c) => c.code === series.secondCode)) {
    const foreignPrimary = selected.find((c) => {
      const other = COMPLEX_CODE_INDEX[c.code];
      return other !== undefined && other.role !== 'addOn' && other.series.group !== series.group;
    });
    if (foreignPrimary) {
      codeFindings.push({
        level: 'contradiction',
        cptCode: code,
        message: `${code} is the add-on for complex repairs of ${series.groupLabel} (${series.baseCode}/${
          series.secondCode
        }), but the selected complex-repair code ${foreignPrimary.code} covers ${
          COMPLEX_CODE_INDEX[foreignPrimary.code].series.groupLabel
        } — an add-on must come from the same site group as its primary code.`,
      });
    } else {
      codeFindings.push({
        level: 'contradiction',
        cptCode: code,
        message: `${code} is an add-on code for each additional 5 cm beyond 7.5 cm — it is billed alongside ${series.secondCode} (complex repair, ${series.groupLabel}, 2.6–7.5 cm), but ${series.secondCode} is not selected.`,
      });
    }
  }

  return codeFindings;
}

/** Names the intermediate repair the documentation supports instead of a complex code, as exactly as the facts allow. */
function intermediateEquivalentRef(facts: LacerationFacts, entrySite: AnatomicSite | undefined): string {
  if (entrySite === undefined) return 'an intermediate repair';
  const series = SERIES_BY_GROUP[lacerationSiteGroup('intermediate', entrySite)];
  const totals = computeWoundTotals(facts, 'intermediate', entrySite);
  if (totals.totalCm === undefined) {
    return `an intermediate repair (${series.bands[0].code}–${series.bands[series.bands.length - 1].code})`;
  }
  return `an intermediate repair (${bandForLength(series, totals.totalCm).code})`;
}

function defendLacerationCodes(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractLacerationFacts(input);
  const evaluation = emptyEvaluation();
  const { findings, supportedCodes, notAssessedCodes } = evaluation;
  const selected = input.cptCodes ?? [];
  if (selected.length === 0) return evaluation;

  const classResolution = resolveRepairClass(facts);
  if (classResolution.repairClass === 'outside-scope') {
    notAssessedCodes.push(...selected.map((c) => c.code));
    evaluation.notAssessed = true;
    evaluation.notAssessedReason = OUTSIDE_SCOPE_MESSAGE;
    findings.push({
      level: 'bestPractice',
      message: OUTSIDE_SCOPE_MESSAGE,
      sourceText: classResolution.sourceText,
      confidence: 'text',
    });
    return evaluation;
  }

  const depthMismatch = repairDepthMismatchFinding(facts);
  if (depthMismatch) findings.push(depthMismatch);

  const stripsSelected = facts.structuredRepairDepth === 'strips-only';
  const stripsOnly = stripsSelected || (facts.structuredRepairDepth === undefined && adhesiveStripsOnly(facts));
  const entrySite = facts.site?.value;
  const inScopeSelected = selected.filter(
    (c) => isLacerationRepairCode(c.code) || COMPLEX_CODE_INDEX[c.code] !== undefined
  );

  for (const selectedCode of selected) {
    const indexed = LACERATION_CODE_INDEX[selectedCode.code];
    const complexIndexed = COMPLEX_CODE_INDEX[selectedCode.code];
    if (!indexed && !complexIndexed) {
      notAssessedCodes.push(selectedCode.code);
      continue;
    }
    const codeFindings: Finding[] = [];

    if (stripsOnly) {
      codeFindings.push({
        level: 'contradiction',
        cptCode: selectedCode.code,
        message: `${selectedCode.code} is selected, but ${
          stripsSelected ? `the ${REPAIR_DEPTH_FIELD_LABEL} field` : 'the note'
        } documents closure with adhesive strips only — adhesive strips alone do not support a wound-repair code.`,
        sourceText: stripsSelected ? undefined : facts.adhesiveStripsDocumented?.sourceText,
        confidence: stripsSelected ? 'structured' : facts.adhesiveStripsDocumented?.confidence,
      });
    }

    if (complexIndexed) {
      codeFindings.push(
        ...complexCodeFindings(selectedCode.code, complexIndexed, facts, classResolution, entrySite, selected, findings)
      );
    } else if (indexed) {
      const impliedClass = indexed.series.repairClass;

      // Repair class: [C] when contradicted, [D] ask when undocumented.
      if (classResolution.repairClass !== undefined && classResolution.repairClass !== impliedClass) {
        const { documentedIn, description } = documentedClassClause(facts, classResolution);
        codeFindings.push({
          level: 'contradiction',
          cptCode: selectedCode.code,
          message: `${selectedCode.code} is ${repairClassArticle(
            impliedClass
          )}-repair code, but ${documentedIn} documents ${description}.`,
          sourceText: classResolution.sourceText,
          confidence: classResolution.confidence,
        });
      } else if (classResolution.repairClass === undefined) {
        codeFindings.push({
          level: 'determines',
          cptCode: selectedCode.code,
          message: `Repair depth is not documented for ${
            selectedCode.code
          } — a single-layer closure codes as a simple repair and a layered closure as an intermediate repair. ${whereClause(
            'depth',
            'Select it'
          )}`,
        });
        // Contamination claimed as the basis for an intermediate code upgrades irrigation/cleaning to [R].
        if (impliedClass === 'intermediate' && facts.contaminationDocumented && !facts.extensiveCleaningDocumented) {
          codeFindings.push({
            level: 'required',
            cptCode: selectedCode.code,
            message: `The note documents heavy contamination but not the extensive cleaning/irrigation — ${
              selectedCode.code
            } as an intermediate repair on that basis needs both documented. ${whereClause('extensiveCleaning')}`,
            sourceText: facts.contaminationDocumented.sourceText,
            confidence: facts.contaminationDocumented.confidence,
          });
        }
      }

      // Site group and length band.
      if (entrySite === undefined) {
        codeFindings.push({
          level: 'determines',
          cptCode: selectedCode.code,
          message: `Body site is not documented for ${
            selectedCode.code
          } — which repair codes apply depends on where on the body the wound is. ${whereClause('site', 'Select it')}`,
        });
      } else {
        const entryGroup = lacerationSiteGroup(impliedClass, entrySite);
        if (entryGroup !== indexed.series.group) {
          codeFindings.push({
            level: 'contradiction',
            cptCode: selectedCode.code,
            message: `${selectedCode.code} covers ${indexed.series.groupLabel}, but the note documents a ${SITE_LABELS[entrySite]} wound.`,
            sourceText: facts.site?.sourceText,
            confidence: facts.site?.confidence,
          });
        } else {
          const totals = computeWoundTotals(facts, impliedClass, entrySite);
          if (totals.mismatchFinding && !findings.some((f) => f.message === totals.mismatchFinding?.message)) {
            findings.push(totals.mismatchFinding);
          }
          if (totals.totalCm === undefined) {
            codeFindings.push({
              level: 'determines',
              cptCode: selectedCode.code,
              message: `Wound length is not documented for ${
                selectedCode.code
              } — the exact code depends on the total repaired length; ${selectedCode.code} covers ${bandLabel(
                indexed.band
              )}. ${whereClause('length', 'Enter it')}`,
            });
          } else if (!lengthFitsBand(indexed, totals.totalCm)) {
            codeFindings.push({
              level: 'contradiction',
              cptCode: selectedCode.code,
              message: `${selectedCode.code} covers ${bandLabel(indexed.band)} for ${
                indexed.series.groupLabel
              }, but the note documents a total repaired length of ${formatCm(totals.totalCm)} cm.`,
              sourceText: totals.totalSourceText,
              confidence: totals.totalConfidence,
            });
          }
        }
      }
    }

    // [R] closure method / material / count (today's laceration check, retained — requirement B6).
    if (!stripsOnly) {
      const missingClosure = missingClosureElements(facts);
      if (missingClosure.length > 0) {
        codeFindings.push({
          level: 'required',
          cptCode: selectedCode.code,
          message: `Closure documentation for ${
            selectedCode.code
          } is incomplete — not documented: ${missingClosure.join(', ')}. ${whereClause(
            stapleEvidence(facts) ? 'stapleClosure' : 'sutureClosure',
            missingClosure.length > 1 ? 'Add these' : 'Add it'
          )}`,
        });
      }
    }

    if (!codeFindings.some((f) => f.level === 'determines' || f.level === 'required' || f.level === 'contradiction')) {
      supportedCodes.push(selectedCode.code);
    }
    findings.push(...codeFindings);
  }

  if (inScopeSelected.length > 0) {
    // Entry-level advisories and best practices, emitted once per entry.
    const totals = computeWoundTotals(
      facts,
      classResolution.repairClass as LacerationRepairClass | undefined,
      entrySite
    );
    findings.push(
      ...otherGroupAdvisories(totals.otherGroupWounds, classResolution.repairClass as LacerationRepairClass | undefined)
    );
    if (!facts.lateralityDocumented && entrySite !== undefined && LATERALIZABLE_SITES.includes(entrySite)) {
      findings.push({
        level: 'bestPractice',
        message: `Laterality is not documented for this ${
          SITE_LABELS[entrySite]
        } wound — noting left or right avoids ambiguity, especially with multiple wounds. ${whereClause(
          'laterality',
          'Select it'
        )}`,
      });
    }
    if (!facts.anesthesiaDocumented) {
      findings.push({
        level: 'bestPractice',
        message: `Anesthesia is not noted — it does not affect the code (local anesthesia is included in the repair), but a complete note records what was used. ${whereClause(
          'anesthesia'
        )}`,
      });
    }
    if (!facts.irrigationDocumented) {
      findings.push({
        level: 'bestPractice',
        message: `Wound irrigation is not documented. ${whereClause('irrigation')}`,
      });
    }
    if (!facts.tetanusDocumented) {
      findings.push({
        level: 'bestPractice',
        message: `Tetanus status is not documented. ${whereClause('tetanus')}`,
      });
    }
    if (facts.structuredRepairDepth === 'tissue-adhesive-only' || tissueAdhesiveOnly(facts)) {
      evaluation.payerNotes = [LACERATION_TISSUE_ADHESIVE_PAYER_NOTE];
    }
  }

  // A structured-vs-text length disagreement means no selected code is quietly "fully supported".
  if (findings.some((f) => f.level === 'contradiction' && f.cptCode === undefined)) {
    supportedCodes.length = 0;
  }

  return evaluation;
}

// ── Family model ───────────────────────────────────────────────────────────────

const LACERATION_TYPE_PATTERN = /lacerat|wound\s*(closure|repair)|sutur|stapl/i;

export const lacerationFamily: ProcedureFamilyModel = {
  id: 'laceration',
  displayName: 'Laceration Repair (Wound Closure)',
  usesStructuredLength: true,
  usesStructuredRepairDepth: true,
  detect(input: ProcedureFactsInput): boolean {
    const procedureType = input.procedureType ?? '';
    const typeMatches = LACERATION_TYPE_PATTERN.test(procedureType) && !/removal/i.test(procedureType);
    const codeMatches = (input.cptCodes ?? []).some(
      (c) => isLacerationRepairCode(c.code) || isComplexRepairCode(c.code)
    );
    return typeMatches || codeMatches;
  },
  extractFacts(input: ProcedureFactsInput): LacerationFacts {
    return extractLacerationFacts(input);
  },
  suggestCode: suggestLacerationCode,
  defendCodes: defendLacerationCodes,
};
