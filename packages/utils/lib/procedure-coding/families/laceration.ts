// Laceration repair (wound closure) coding model — functional requirements §6.1.
// Simple repairs 12001-12018, intermediate repairs 12031-12057.
// Complex repairs (131xx-133xx) and debridement/undermining/tissue-rearrangement
// wounds are outside scope and are reported "not assessed", never guessed.

import { AnatomicSite, extractLacerationFacts, LacerationFacts, LacerationWound } from '../extract';
import {
  CodeCandidate,
  FactConfidence,
  FamilyEvaluation,
  Finding,
  ProcedureFactsInput,
  ProcedureFamilyModel,
} from '../model.types';

export type LacerationRepairClass = 'simple' | 'intermediate';

export type LacerationSiteGroup =
  | 'simple-trunk-extremities'
  | 'simple-face-mm'
  | 'intermediate-trunk-extremities'
  | 'intermediate-neck-hands-feet-genitalia'
  | 'intermediate-face-mm';

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

/** Complex repair range (131xx-133xx) — adjacent to this family but outside its scope. */
export function isComplexRepairCode(code: string): boolean {
  return /^13[123]\d{2}$/.test(code);
}

export const LACERATION_TISSUE_ADHESIVE_PAYER_NOTE =
  'Payer note: for tissue-adhesive-only closure, Medicare bills HCPCS G0168 instead of a CPT repair code; commercial payer handling varies.';

const OUTSIDE_SCOPE_MESSAGE =
  'The note documents debridement, undermining, or tissue rearrangement — complex-repair territory (131xx-133xx) outside these documentation checks; not assessed.';

// ── Site grouping (differs per repair class: hands/feet move groups) ───────────

const FACE_MM_SITES: AnatomicSite[] = ['face', 'ear', 'eyelid', 'nose', 'lip', 'mucous-membrane'];
const INTERMEDIATE_NHFG_SITES: AnatomicSite[] = ['neck', 'hand', 'foot', 'genitalia'];

export function lacerationSiteGroup(repairClass: LacerationRepairClass, site: AnatomicSite): LacerationSiteGroup {
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

type RepairBasis = 'layered' | 'single-layer' | 'contaminated' | 'adhesive';

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
    case 'contaminated':
      return 'single-layer closure of a heavily contaminated wound with extensive cleaning documented (intermediate via the contamination path)';
    case 'adhesive':
      return 'tissue-adhesive closure documented';
    default:
      return 'single-layer closure documented';
  }
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
        message: `The structured length field documents ${formatCm(
          facts.structuredLengthCm
        )} cm, but the details text documents ${formatCm(
          textSum
        )} cm — please reconcile; the structured value is used for the checks.`,
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

function candidatesFor(
  repairClass: LacerationRepairClass | undefined,
  entrySite: AnatomicSite | undefined
): CodeCandidate[] {
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
    } — a different site group${
      repairClass ? ` for ${repairClass} repairs` : ''
    }. Lengths in different site groups are not summed; a wound in a different group needs its own procedure entry.`,
    sourceText: wound.sourceText,
    confidence: wound.confidence,
  }));
}

function missingClosureElements(facts: LacerationFacts): string[] {
  // Tissue adhesive documented as the closure: method is known and material/count do not apply.
  if (facts.closureMethod?.value === 'tissue adhesive' || tissueAdhesiveOnly(facts)) {
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

  if (adhesiveStripsOnly(facts)) {
    findings.push({
      level: 'contradiction',
      message:
        'The note documents wound closure with adhesive strips only — adhesive strips alone do not support a wound-repair code (the encounter is captured under E/M).',
      sourceText: facts.adhesiveStripsDocumented?.sourceText,
      confidence: facts.adhesiveStripsDocumented?.confidence,
    });
    return evaluation;
  }

  const entrySite = facts.site?.value;
  const repairClass = classResolution.repairClass;
  const totals = computeWoundTotals(facts, repairClass, entrySite);
  if (totals.mismatchFinding) findings.push(totals.mismatchFinding);
  findings.push(...otherGroupAdvisories(totals.otherGroupWounds, repairClass));

  const missingDeterminants: Finding[] = [];
  if (entrySite === undefined) {
    missingDeterminants.push({
      level: 'determines',
      message: 'Body site is not documented — the site group determines which laceration-repair code table applies.',
    });
  }
  if (repairClass === undefined) {
    missingDeterminants.push({
      level: 'determines',
      message:
        'Repair depth is not documented — single-layer versus layered closure determines whether a simple (12001-12018) or intermediate (12031-12057) code applies.',
    });
  }
  if (totals.totalCm === undefined) {
    missingDeterminants.push({
      level: 'determines',
      message: 'Wound length is not documented — the total repaired length (cm) determines the code within its table.',
    });
  }

  if (missingDeterminants.length > 0) {
    findings.push(...missingDeterminants);
    evaluation.openCandidates = candidatesFor(repairClass, entrySite);
    return evaluation;
  }

  const series = SERIES_BY_GROUP[lacerationSiteGroup(repairClass as LacerationRepairClass, entrySite as AnatomicSite)];
  const band = bandForLength(series, totals.totalCm as number);
  evaluation.suggestion = {
    code: band.code,
    display: codeCandidate(series, band).display,
    justification: `${series.classLabel} repair — ${classBasisDescription(classResolution.basis)}; ${
      SITE_LABELS[entrySite as AnatomicSite]
    } (${series.groupLabel}); total ${formatCm(totals.totalCm as number)} cm → ${band.code}.`,
  };
  if (classResolution.basis === 'adhesive') {
    evaluation.payerNotes = [LACERATION_TISSUE_ADHESIVE_PAYER_NOTE];
  }
  return evaluation;
}

// ── Inverse: selected codes → gaps and contradictions ──────────────────────────

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

  const stripsOnly = adhesiveStripsOnly(facts);
  const entrySite = facts.site?.value;
  const inScopeSelected = selected.filter((c) => isLacerationRepairCode(c.code));

  for (const selectedCode of selected) {
    const indexed = LACERATION_CODE_INDEX[selectedCode.code];
    if (!indexed) {
      notAssessedCodes.push(selectedCode.code);
      continue;
    }
    const codeFindings: Finding[] = [];
    const impliedClass = indexed.series.repairClass;

    if (stripsOnly) {
      codeFindings.push({
        level: 'contradiction',
        cptCode: selectedCode.code,
        message: `${selectedCode.code} is selected, but the note documents closure with adhesive strips only — adhesive strips alone do not support a wound-repair code.`,
        sourceText: facts.adhesiveStripsDocumented?.sourceText,
        confidence: facts.adhesiveStripsDocumented?.confidence,
      });
    }

    // Repair class: [C] when contradicted, [D] ask when undocumented.
    if (classResolution.repairClass !== undefined && classResolution.repairClass !== impliedClass) {
      const documentedClassDescription =
        classResolution.basis === 'layered'
          ? 'a layered closure (an intermediate repair)'
          : classResolution.basis === 'contaminated'
          ? 'a heavily contaminated wound with extensive cleaning (an intermediate repair via the contamination path)'
          : classResolution.basis === 'adhesive'
          ? 'closure with tissue adhesive alone (a simple repair)'
          : 'a single-layer superficial closure (a simple repair)';
      codeFindings.push({
        level: 'contradiction',
        cptCode: selectedCode.code,
        message: `${selectedCode.code} is ${
          impliedClass === 'simple' ? 'a simple' : 'an intermediate'
        }-repair code, but the note documents ${documentedClassDescription}.`,
        sourceText: classResolution.sourceText,
        confidence: classResolution.confidence,
      });
    } else if (classResolution.repairClass === undefined) {
      codeFindings.push({
        level: 'determines',
        cptCode: selectedCode.code,
        message: `Repair depth is not documented for ${selectedCode.code} — single-layer versus layered closure determines whether a simple or intermediate code applies.`,
      });
      // Contamination claimed as the basis for an intermediate code upgrades irrigation/cleaning to [R].
      if (impliedClass === 'intermediate' && facts.contaminationDocumented && !facts.extensiveCleaningDocumented) {
        codeFindings.push({
          level: 'required',
          cptCode: selectedCode.code,
          message: `${selectedCode.code} via the contaminated-wound path requires the extensive cleaning/irrigation to be documented alongside the contamination.`,
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
        message: `Body site is not documented for ${selectedCode.code} — the site group determines the code table.`,
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
            } — the total repaired length determines the code within the ${indexed.series.groupLabel} table; ${
              selectedCode.code
            } covers ${bandLabel(indexed.band)}.`,
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

    // [R] closure method / material / count (today's laceration check, retained — requirement B6).
    if (!stripsOnly) {
      const missingClosure = missingClosureElements(facts);
      if (missingClosure.length > 0) {
        codeFindings.push({
          level: 'required',
          cptCode: selectedCode.code,
          message: `Closure documentation for ${
            selectedCode.code
          } is incomplete — not documented: ${missingClosure.join(', ')}.`,
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
        message: `Laterality is not documented for this ${SITE_LABELS[entrySite]} wound — noting left/right helps disambiguate, especially with multiple wounds.`,
      });
    }
    if (!facts.anesthesiaDocumented) {
      findings.push({
        level: 'bestPractice',
        message:
          'Anesthesia is not documented — local anesthesia is bundled into repair codes, but noting it is expected.',
      });
    }
    if (!facts.irrigationDocumented) {
      findings.push({
        level: 'bestPractice',
        message: 'Wound irrigation is not documented.',
      });
    }
    if (!facts.tetanusDocumented) {
      findings.push({
        level: 'bestPractice',
        message: 'Tetanus status is not documented.',
      });
    }
    if (tissueAdhesiveOnly(facts)) {
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
