import { AnatomicSite, isPlausibleLengthCm, MAX_PLAUSIBLE_LENGTH_CM } from '../extract';
import {
  DETAILS_FIELD_LABEL,
  LENGTH_FIELD_LABEL,
  REPAIR_DEPTH_FIELD_LABEL,
  SITE_FIELD_LABEL,
  TO_DETAILS,
  whereClauseFor,
} from '../family-support';
import {
  citing,
  ENTRY_SCOPE,
  EvidenceSource,
  FactProvenance,
  FactValue,
  fieldEvidence,
  Finding,
  FindingEvidence,
  NOTHING_TO_CITE,
  RepairDepthSelection,
  WhereToDocument,
} from '../model.types';
import {
  ComplexRepairElement,
  ComplexRepairSiteGroup,
  LacerationFacts,
  LacerationRepairClass,
  LacerationSiteGroup,
  LacerationWound,
} from './laceration.extract';
import {
  CodeBand,
  CodeSeries,
  COMPLEX_ADD_ON_INCREMENT_CM,
  COMPLEX_BASE_MAX_CM,
  COMPLEX_REPAIR_MIN_CM,
  COMPLEX_SECOND_MAX_CM,
  COMPLEX_SECOND_MIN_CM,
  ComplexCodeRole,
} from './laceration.rules';

export const LENGTH_COMPARISON_EPSILON_CM = 1e-9;

export const STRUCTURED_TEXT_LENGTH_MISMATCH_TOLERANCE_CM = 0.05;

export const LENGTH_DISPLAY_INCREMENT_CM = 0.1;

export const LENGTH_DISPLAY_ROUNDING_FACTOR = 10;

export const COMPLEX_ELEMENT_LABELS: Record<ComplexRepairElement, string> = {
  'extensive-undermining': 'extensive undermining',
  'retention-sutures': 'retention sutures',
  stents: 'stent placement',
  debridement: 'debridement of wound edges/devitalized tissue',
  'exposed-structure': 'exposed bone/cartilage/tendon/neurovascular structure',
  'free-margin': 'free-margin involvement',
};

export function complexElementList(facts: LacerationFacts): string {
  return facts.complexElements.map((element) => COMPLEX_ELEMENT_LABELS[element.value]).join(', ');
}

export const LACERATION_TISSUE_ADHESIVE_PAYER_NOTE =
  'Payer note: for tissue-adhesive-only closure, Medicare professional claims may report HCPCS G0168; under OPPS, facilities report the appropriate CPT repair code because G0168 is not recognized for payment. Commercial-payer handling varies.';

export const LACERATION_CONTAMINATION_PAYER_NOTE =
  'Payer note: an intermediate repair claimed for a single-layer closure of a heavily contaminated wound requiring extensive cleansing is a frequent denial and audit target; the note should state both the contamination and the cleansing that was performed.';

export const REPAIR_DEPTH_SELECTION_CLASS: Record<
  Exclude<RepairDepthSelection, 'tissue-adhesive-only' | 'strips-only'>,
  LacerationRepairClass
> = {
  'superficial-single': 'simple',
  'subcutaneous-single': 'simple',
  'subcutaneous-layered': 'intermediate',
  'fascia-muscle-layered': 'intermediate',
};

export const OUTSIDE_SCOPE_MESSAGE =
  'The note documents tissue rearrangement (e.g. a flap or Z-plasty) — that points to an adjacent tissue transfer (CPT 14000-series), which these documentation checks do not cover; not assessed.';

export const WHERE_TO_DOCUMENT = {
  site: { destination: `in the ${SITE_FIELD_LABEL} field` },
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
  separateWounds: { destination: TO_DETAILS, example: '"second 3 cm laceration of the right forearm"' },
} satisfies Record<string, WhereToDocument>;

export const whereClause = whereClauseFor(WHERE_TO_DOCUMENT);

export const FACE_MM_SITES: AnatomicSite[] = ['face', 'ear', 'eyelid', 'nose', 'lip', 'mucous-membrane'];

export const INTERMEDIATE_NHFG_SITES: AnatomicSite[] = ['neck', 'hand', 'foot', 'genitalia'];

export const COMPLEX_ENEL_SITES: AnatomicSite[] = ['eyelid', 'nose', 'ear', 'lip'];

export function complexRepairSiteGroup(site: AnatomicSite): ComplexRepairSiteGroup {
  if (COMPLEX_ENEL_SITES.includes(site)) return 'complex-eyelids-nose-ears-lips';

  if (site === 'trunk') return 'complex-trunk';

  if (site === 'scalp' || site === 'extremity') return 'complex-scalp-arms-legs';

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

export const SITE_LABELS: Record<AnatomicSite, string> = {
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

export function withArticle(label: string): string {
  return `${/^[aeiou]/i.test(label) ? 'an' : 'a'} ${label}`;
}

export type RepairBasis =
  | 'layered'
  | 'single-layer'
  | 'contaminated'
  | 'adhesive'
  | 'complex-element'
  | 'structured-layered'
  | 'structured-single'
  | 'structured-adhesive'
  | 'structured-strips';

export enum RepairClassOutcome {
  OutsideScope = 'outside-scope',
  Resolved = 'resolved',
  Undetermined = 'undetermined',
}

export interface OutsideScopeRepair {
  kind: RepairClassOutcome.OutsideScope;
  evidence: FactProvenance;
}

export interface ResolvedRepairClass {
  kind: RepairClassOutcome.Resolved;
  repairClass: LacerationRepairClass;
  basis: RepairBasis;
  evidence: FactProvenance;
}

export interface UndeterminedRepairClass {
  kind: RepairClassOutcome.Undetermined;
}

export type RepairClassResolution = OutsideScopeRepair | ResolvedRepairClass | UndeterminedRepairClass;

export function resolvedClassOf(resolution: RepairClassResolution): LacerationRepairClass | undefined {
  return resolution.kind === RepairClassOutcome.Resolved ? resolution.repairClass : undefined;
}

export function resolvedBasisOf(resolution: RepairClassResolution): RepairBasis | undefined {
  return resolution.kind === RepairClassOutcome.Resolved ? resolution.basis : undefined;
}

export function resolutionEvidence(resolution: RepairClassResolution): FindingEvidence {
  return resolution.kind === RepairClassOutcome.Undetermined ? NOTHING_TO_CITE : resolution.evidence;
}

export function sutureEvidence(facts: LacerationFacts): boolean {
  return Boolean(
    facts.suturesDocumented ||
      facts.closureCount ||
      facts.closureMaterial ||
      (facts.closureMethod && !['staples', 'tissue adhesive'].includes(facts.closureMethod.value))
  );
}

export function stapleEvidence(facts: LacerationFacts): boolean {
  return Boolean(facts.staplesDocumented || facts.closureMethod?.value === 'staples');
}

export function tissueAdhesiveOnly(facts: LacerationFacts): FactValue<true> | undefined {
  const adhesive = facts.tissueAdhesiveDocumented;

  return adhesive !== undefined && !sutureEvidence(facts) && !stapleEvidence(facts) ? adhesive : undefined;
}

export function adhesiveStripsOnly(facts: LacerationFacts): boolean {
  return (
    Boolean(facts.adhesiveStripsDocumented) &&
    !sutureEvidence(facts) &&
    !stapleEvidence(facts) &&
    !facts.tissueAdhesiveDocumented
  );
}

export function contaminatedIntermediate(facts: LacerationFacts): FactValue<true> | undefined {
  return facts.contaminationDocumented !== undefined && facts.extensiveCleaningDocumented !== undefined
    ? facts.contaminationDocumented
    : undefined;
}

export function resolveRepairClass(facts: LacerationFacts): RepairClassResolution {
  if (facts.outsideScope !== undefined) {
    return { kind: RepairClassOutcome.OutsideScope, evidence: facts.outsideScope.evidence };
  }

  const selection = facts.structuredRepairDepth;

  if (selection === 'tissue-adhesive-only') {
    return {
      kind: RepairClassOutcome.Resolved,
      repairClass: 'simple',
      basis: 'structured-adhesive',
      evidence: fieldEvidence(REPAIR_DEPTH_FIELD_LABEL),
    };
  }

  if (selection === 'strips-only') {
    return {
      kind: RepairClassOutcome.Resolved,
      repairClass: 'simple',
      basis: 'structured-strips',
      evidence: fieldEvidence(REPAIR_DEPTH_FIELD_LABEL),
    };
  }

  const complexElement = facts.complexElements[0];

  if (selection !== undefined) {
    if (REPAIR_DEPTH_SELECTION_CLASS[selection] === 'intermediate') {
      if (complexElement) {
        return {
          kind: RepairClassOutcome.Resolved,
          repairClass: 'complex',
          basis: 'complex-element',
          evidence: complexElement.evidence,
        };
      }
      return {
        kind: RepairClassOutcome.Resolved,
        repairClass: 'intermediate',
        basis: 'structured-layered',
        evidence: fieldEvidence(REPAIR_DEPTH_FIELD_LABEL),
      };
    }

    const contaminated = contaminatedIntermediate(facts);

    if (contaminated !== undefined) {
      return {
        kind: RepairClassOutcome.Resolved,
        repairClass: 'intermediate',
        basis: 'contaminated',
        evidence: contaminated.evidence,
      };
    }

    return {
      kind: RepairClassOutcome.Resolved,
      repairClass: 'simple',
      basis: 'structured-single',
      evidence: fieldEvidence(REPAIR_DEPTH_FIELD_LABEL),
    };
  }

  if (complexElement && facts.depth?.value !== 'single-layer') {
    return {
      kind: RepairClassOutcome.Resolved,
      repairClass: 'complex',
      basis: 'complex-element',
      evidence: complexElement.evidence,
    };
  }

  if (facts.depth?.value === 'layered') {
    return {
      kind: RepairClassOutcome.Resolved,
      repairClass: 'intermediate',
      basis: 'layered',
      evidence: facts.depth.evidence,
    };
  }

  const contaminated = contaminatedIntermediate(facts);

  if (contaminated !== undefined) {
    return {
      kind: RepairClassOutcome.Resolved,
      repairClass: 'intermediate',
      basis: 'contaminated',
      evidence: contaminated.evidence,
    };
  }

  if (facts.depth?.value === 'single-layer') {
    return {
      kind: RepairClassOutcome.Resolved,
      repairClass: 'simple',
      basis: 'single-layer',
      evidence: facts.depth.evidence,
    };
  }

  const adhesiveOnly = tissueAdhesiveOnly(facts);

  if (adhesiveOnly !== undefined) {
    return {
      kind: RepairClassOutcome.Resolved,
      repairClass: 'simple',
      basis: 'adhesive',
      evidence: adhesiveOnly.evidence,
    };
  }

  return { kind: RepairClassOutcome.Undetermined };
}

export const RECONCILE_CLAUSE = 'please reconcile them; the checks use the value from the field.';

export function repairDepthMismatchFinding(facts: LacerationFacts): Finding | undefined {
  const selection = facts.structuredRepairDepth;

  if (selection === undefined) return undefined;
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
      scope: ENTRY_SCOPE,
      message: `The ${REPAIR_DEPTH_FIELD_LABEL} field documents ${fieldClosure}, but the ${DETAILS_FIELD_LABEL} text documents ${closureEvidence} — ${RECONCILE_CLAUSE}`,
      evidence: citing(
        facts.suturesDocumented ??
          facts.staplesDocumented ??
          facts.closureMethod ??
          facts.closureMaterial ??
          facts.closureCount
      ),
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
    scope: ENTRY_SCOPE,
    message: `The ${REPAIR_DEPTH_FIELD_LABEL} field documents ${classDescription(
      fieldClass
    )}, but the ${DETAILS_FIELD_LABEL} text documents ${classDescription(textClass)} — ${RECONCILE_CLAUSE}`,
    evidence: citing(facts.depth),
  };
}

export function siteMismatchFinding(facts: LacerationFacts): Finding | undefined {
  if (facts.site?.evidence.source !== EvidenceSource.Field) return undefined;

  const fieldSite = facts.site.value;
  const textSite = facts.siteFromText?.value;

  if (textSite === undefined || textSite === fieldSite) return undefined;

  return {
    level: 'contradiction',
    scope: ENTRY_SCOPE,
    message: `The ${SITE_FIELD_LABEL} field documents ${withArticle(
      SITE_LABELS[fieldSite]
    )} wound, but the ${DETAILS_FIELD_LABEL} text documents ${withArticle(
      SITE_LABELS[textSite]
    )} wound — ${RECONCILE_CLAUSE}`,
    evidence: citing(facts.siteFromText),
  };
}

export interface WoundTotals {
  totalCm?: number;
  totalEvidence?: FactProvenance;
  otherGroupWounds: LacerationWound[];
  mismatchFinding?: Finding;
  lengthIssueFinding?: Finding;
}

export function implausibleLengthFinding(value: number): Finding {
  const shown = Number.isFinite(value) ? `${value}` : 'a value that is not a number';

  return {
    level: 'determines',
    scope: ENTRY_SCOPE,
    message: `The ${LENGTH_FIELD_LABEL} field holds ${shown}, which cannot be a repaired wound length — the exact code depends on the total repaired length, from 0.1 up to ${formatCm(
      MAX_PLAUSIBLE_LENGTH_CM
    )} cm. ${whereClause('length', 'Enter the measured length')}`,
    evidence: fieldEvidence(LENGTH_FIELD_LABEL),
  };
}

export function computeWoundTotals(
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
        : woundSite === entrySite;

    if (sameGroup) {
      primaryWounds.push(wound);
    } else {
      otherGroupWounds.push(wound);
    }
  }

  const textSum = primaryWounds.length > 0 ? roundCm(primaryWounds.reduce((sum, w) => sum + w.lengthCm, 0)) : undefined;
  const textEvidenceForSum = primaryWounds[0]?.evidence;
  const result: WoundTotals = { otherGroupWounds };
  const structuredLengthCm = facts.structuredLengthCm;

  if (structuredLengthCm !== undefined && !isPlausibleLengthCm(structuredLengthCm)) {
    result.lengthIssueFinding = implausibleLengthFinding(structuredLengthCm);
  } else if (structuredLengthCm !== undefined) {
    result.totalCm = structuredLengthCm;
    result.totalEvidence = fieldEvidence(LENGTH_FIELD_LABEL);

    if (
      textSum !== undefined &&
      Math.abs(textSum - roundCm(structuredLengthCm)) > STRUCTURED_TEXT_LENGTH_MISMATCH_TOLERANCE_CM
    ) {
      result.mismatchFinding = {
        level: 'contradiction',
        scope: ENTRY_SCOPE,
        message: `The ${LENGTH_FIELD_LABEL} field documents ${formatCm(
          structuredLengthCm
        )} cm, but the ${DETAILS_FIELD_LABEL} text documents ${formatCm(textSum)} cm — ${RECONCILE_CLAUSE}`,
        evidence: textEvidenceForSum ?? NOTHING_TO_CITE,
      };
    }

    return result;
  }

  if (textSum !== undefined) {
    result.totalCm = textSum;
    result.totalEvidence = textEvidenceForSum;
  }

  return result;
}

export function roundCm(value: number): number {
  return Math.round(value * LENGTH_DISPLAY_ROUNDING_FACTOR) / LENGTH_DISPLAY_ROUNDING_FACTOR;
}

export function formatCm(value: number): string {
  return value.toFixed(1);
}

export function bandForLength(series: CodeSeries, lengthCm: number): CodeBand {
  for (const band of series.bands) {
    if (band.maxCm === null || lengthCm <= band.maxCm + LENGTH_COMPARISON_EPSILON_CM) {
      return band;
    }
  }

  return series.bands[series.bands.length - 1];
}

export function bandLabel(band: CodeBand): string {
  if (band.maxCm === null) return `>${formatCm(band.minCm - LENGTH_DISPLAY_INCREMENT_CM)} cm`;
  if (band.minCm === 0) return `≤${formatCm(band.maxCm)} cm`;

  return `${formatCm(band.minCm)}–${formatCm(band.maxCm)} cm`;
}

export function complexBandLabel(role: ComplexCodeRole): string {
  if (role === 'base') return `${formatCm(COMPLEX_REPAIR_MIN_CM)}–${COMPLEX_BASE_MAX_CM} cm`;
  if (role === 'second') return `${COMPLEX_SECOND_MIN_CM}–${COMPLEX_SECOND_MAX_CM} cm`;

  return `each additional ${COMPLEX_ADD_ON_INCREMENT_CM} cm (or part) beyond ${COMPLEX_SECOND_MAX_CM} cm`;
}

export function pushUnique(findings: Finding[], finding: Finding | undefined): void {
  if (finding === undefined) return;
  if (findings.some((existing) => existing.message === finding.message)) return;
  findings.push(finding);
}

export function otherGroupAdvisories(
  otherGroupWounds: LacerationWound[],
  repairClass: LacerationRepairClass | undefined
): Finding[] {
  return otherGroupWounds.map((wound) => ({
    level: 'bestPractice' as const,
    scope: ENTRY_SCOPE,
    message: `The note also documents a ${formatCm(wound.lengthCm)} cm wound on the ${
      wound.site ? SITE_LABELS[wound.site] : 'documented site'
    } — ${
      repairClass ? `for ${repairClass} repairs, ` : ''
    }that site is coded separately from this entry's site, so the lengths are not added together. That wound needs its own procedure entry.`,
    evidence: citing(wound),
  }));
}

export function duplicateLengthAdvisory(facts: LacerationFacts): Finding | undefined {
  if (!facts.duplicateLengthMention) return undefined;

  return {
    level: 'bestPractice',
    scope: ENTRY_SCOPE,
    message: `The note repeats the same wound length more than once — the checks count it as one wound, so the total repaired length is not inflated. If these were separate wounds, describe each one. ${whereClause(
      'separateWounds'
    )}`,
    evidence: citing(facts.duplicateLengthMention),
  };
}

export interface EntryResolution {
  repairClass: LacerationRepairClass | undefined;
  basis: RepairBasis | undefined;
  totals: WoundTotals;
  complexFloorAdvisory?: Finding;
}

export function complexFallbackClass(
  facts: LacerationFacts
): { repairClass: LacerationRepairClass; basis: RepairBasis } | undefined {
  if (facts.structuredRepairDepth !== undefined) {
    return { repairClass: 'intermediate', basis: 'structured-layered' };
  }

  if (facts.depth?.value === 'layered') {
    return { repairClass: 'intermediate', basis: 'layered' };
  }

  return undefined;
}

export function resolveEntry(
  facts: LacerationFacts,
  classResolution: RepairClassResolution,
  entrySite: AnatomicSite | undefined
): EntryResolution {
  let repairClass = resolvedClassOf(classResolution);
  let basis = resolvedBasisOf(classResolution);
  let totals = computeWoundTotals(facts, repairClass, entrySite);
  let complexFloorAdvisory: Finding | undefined;

  if (
    repairClass === 'complex' &&
    totals.totalCm !== undefined &&
    totals.totalCm < COMPLEX_REPAIR_MIN_CM - LENGTH_COMPARISON_EPSILON_CM
  ) {
    complexFloorAdvisory = {
      level: 'bestPractice',
      scope: ENTRY_SCOPE,
      message: `The note documents a complex-repair element (${complexElementList(
        facts
      )}), but complex repair codes start at ${formatCm(COMPLEX_REPAIR_MIN_CM)} cm — a ${formatCm(
        totals.totalCm
      )} cm wound is coded as a simple or intermediate repair by its closure depth.`,
      evidence: resolutionEvidence(classResolution),
    };
    const fallback = complexFallbackClass(facts);
    repairClass = fallback?.repairClass;
    basis = fallback?.basis;
    totals = computeWoundTotals(facts, repairClass, entrySite);
  }

  return { repairClass, basis, totals, complexFloorAdvisory };
}
