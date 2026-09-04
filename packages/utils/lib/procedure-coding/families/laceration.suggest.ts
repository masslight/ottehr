import { AnatomicSite } from '../extract';
import { joinWithAnd, REPAIR_DEPTH_FIELD_LABEL } from '../family-support';
import {
  citing,
  CodeCandidate,
  CodeSuggestion,
  determinedCode,
  determinedCodeWithAlternates,
  emptySuggestionEvaluation,
  ENTRY_SCOPE,
  FamilyEvaluation,
  fieldEvidence,
  Finding,
  notAssessedCode,
  NOTHING_TO_CITE,
  openCodeSet,
  ProcedureFactsInput,
} from '../model.types';
import { extractLacerationFacts, LacerationFacts, LacerationRepairClass } from './laceration.extract';
import {
  CodeBand,
  CodeSeries,
  COMPLEX_ADD_ON_INCREMENT_CM,
  COMPLEX_BASE_MAX_CM,
  COMPLEX_CODE_SERIES,
  COMPLEX_SECOND_MAX_CM,
  COMPLEX_SERIES_BY_GROUP,
  ComplexCodeRole,
  ComplexCodeSeries,
  LACERATION_CODE_SERIES,
  LACERATION_CODES,
  SERIES_BY_GROUP,
} from './laceration.rules';
import {
  adhesiveStripsOnly,
  bandForLength,
  bandLabel,
  complexBandLabel,
  complexElementList,
  complexRepairSiteGroup,
  duplicateLengthAdvisory,
  EntryResolution,
  formatCm,
  LACERATION_CONTAMINATION_PAYER_NOTE,
  LACERATION_TISSUE_ADHESIVE_PAYER_NOTE,
  lacerationSiteGroup,
  LENGTH_COMPARISON_EPSILON_CM,
  otherGroupAdvisories,
  OUTSIDE_SCOPE_MESSAGE,
  pushUnique,
  RepairBasis,
  RepairClassOutcome,
  repairDepthMismatchFinding,
  resolveEntry,
  resolveRepairClass,
  SITE_LABELS,
  siteMismatchFinding,
  whereClause,
} from './laceration.shared';

const G0168_CANDIDATE: CodeCandidate = {
  code: LACERATION_CODES.tissueAdhesiveOnlyMedicare,
  display: 'G0168 — Wound closure utilizing tissue adhesive(s) only (Medicare)',
};

const CLASS_BASIS_DESCRIPTIONS: Record<RepairBasis, string> = {
  layered: 'layered closure documented',
  'single-layer': 'single-layer closure documented',
  'structured-layered': `layered closure selected in the ${REPAIR_DEPTH_FIELD_LABEL} field`,
  'structured-single': `single-layer closure selected in the ${REPAIR_DEPTH_FIELD_LABEL} field`,
  'structured-adhesive': `tissue-adhesive-only closure selected in the ${REPAIR_DEPTH_FIELD_LABEL} field`,
  'structured-strips': `adhesive-strips-only closure selected in the ${REPAIR_DEPTH_FIELD_LABEL} field`,
  contaminated:
    'single-layer closure of a heavily contaminated wound with extensive cleaning documented (together these qualify as an intermediate repair)',
  'complex-element': 'complex-repair element documented',
  adhesive: 'tissue-adhesive closure documented',
};

function classBasisDescription(basis: RepairBasis | undefined): string {
  return basis === undefined ? CLASS_BASIS_DESCRIPTIONS['single-layer'] : CLASS_BASIS_DESCRIPTIONS[basis];
}

function codeCandidate(series: CodeSeries, band: CodeBand): CodeCandidate {
  return {
    code: band.code,
    display: `${band.code} — ${series.classLabel} repair, ${series.groupLabel}, ${bandLabel(band)}`,
  };
}

function complexAddOnUnits(totalCm: number): number {
  return Math.max(
    0,
    Math.ceil((totalCm - COMPLEX_SECOND_MAX_CM) / COMPLEX_ADD_ON_INCREMENT_CM - LENGTH_COMPARISON_EPSILON_CM)
  );
}

function complexCodeForRole(series: ComplexCodeSeries, role: ComplexCodeRole): string {
  return role === 'base' ? series.baseCode : role === 'second' ? series.secondCode : series.addOnCode;
}

function complexCodeCandidate(series: ComplexCodeSeries, role: ComplexCodeRole): CodeCandidate {
  const code = complexCodeForRole(series, role);

  return { code, display: `${code} — Complex repair, ${series.groupLabel}, ${complexBandLabel(role)}` };
}

function wideOpenSetSummary(
  candidates: CodeCandidate[],
  entry: Pick<EntryResolution, 'repairClass' | 'totals'>,
  entrySite: AnatomicSite | undefined
): string {
  const codes = candidates.map((candidate) => candidate.code).sort();
  const span = codes[0] === codes[codes.length - 1] ? codes[0] : `${codes[0]}–${codes[codes.length - 1]}`;

  const open = [
    entrySite === undefined ? 'the body site' : undefined,
    entry.repairClass === undefined ? 'the repair depth' : undefined,
    entry.totals.totalCm === undefined ? 'the total repaired length (cm)' : undefined,
  ].filter((part): part is string => part !== undefined);

  return `${span} — ${joinWithAnd(open)} determine${open.length === 1 ? 's' : ''} the exact code`;
}

function openSetSummary(
  candidates: CodeCandidate[],
  entry: Pick<EntryResolution, 'repairClass' | 'totals'>,
  entrySite: AnatomicSite | undefined
): string {
  const { repairClass } = entry;

  if (repairClass !== undefined && entrySite !== undefined && entry.totals.totalCm === undefined) {
    if (repairClass === 'complex') {
      const series = COMPLEX_SERIES_BY_GROUP[complexRepairSiteGroup(entrySite)];
      return `${series.baseCode}–${series.addOnCode} — wound length (cm) determines the exact code`;
    }

    const bands = SERIES_BY_GROUP[lacerationSiteGroup(repairClass, entrySite)].bands;

    return `${bands[0].code}–${bands[bands.length - 1].code} — wound length (cm) determines the exact code`;
  }

  return wideOpenSetSummary(candidates, entry, entrySite);
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

interface DeterminedRepair {
  repairClass: LacerationRepairClass;
  basis: RepairBasis | undefined;
  entrySite: AnatomicSite;
  totalCm: number;
}

function determinedRepair(entry: EntryResolution, entrySite: AnatomicSite | undefined): DeterminedRepair | undefined {
  if (entry.repairClass === undefined || entrySite === undefined || entry.totals.totalCm === undefined) {
    return undefined;
  }
  return { repairClass: entry.repairClass, basis: entry.basis, entrySite, totalCm: entry.totals.totalCm };
}

export function suggestLacerationCode(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractLacerationFacts(input);
  const evaluation = emptySuggestionEvaluation();
  const { findings } = evaluation;

  const classResolution = resolveRepairClass(facts);
  if (classResolution.kind === RepairClassOutcome.OutsideScope) {
    findings.push({
      level: 'bestPractice',
      scope: ENTRY_SCOPE,
      message: OUTSIDE_SCOPE_MESSAGE,
      evidence: citing(classResolution),
    });
    evaluation.outcome = notAssessedCode(OUTSIDE_SCOPE_MESSAGE);
    return evaluation;
  }

  pushUnique(findings, repairDepthMismatchFinding(facts));
  pushUnique(findings, siteMismatchFinding(facts));

  if (facts.structuredRepairDepth === 'strips-only') {
    findings.push({
      level: 'contradiction',
      scope: ENTRY_SCOPE,
      message: `The ${REPAIR_DEPTH_FIELD_LABEL} field documents closure with adhesive strips only — adhesive strips alone do not support a wound-repair code; that care is part of the visit (E/M) charge instead.`,
      evidence: fieldEvidence(REPAIR_DEPTH_FIELD_LABEL),
    });
    return evaluation;
  }

  if (facts.structuredRepairDepth === undefined && adhesiveStripsOnly(facts)) {
    findings.push({
      level: 'contradiction',
      scope: ENTRY_SCOPE,
      message:
        'The note documents wound closure with adhesive strips only — adhesive strips alone do not support a wound-repair code; that care is part of the visit (E/M) charge instead.',
      evidence: citing(facts.adhesiveStripsDocumented),
    });
    return evaluation;
  }

  const entrySite = facts.site?.value;
  const entry = resolveEntry(facts, classResolution, entrySite);
  pushUnique(findings, entry.totals.lengthIssueFinding);
  pushUnique(findings, entry.totals.mismatchFinding);
  pushUnique(findings, entry.complexFloorAdvisory);
  pushUnique(findings, duplicateLengthAdvisory(facts));

  for (const advisory of otherGroupAdvisories(entry.totals.otherGroupWounds, entry.repairClass)) {
    pushUnique(findings, advisory);
  }

  const missingDeterminants: Finding[] = [];

  if (entrySite === undefined) {
    missingDeterminants.push({
      level: 'determines',
      scope: ENTRY_SCOPE,
      message: `Body site is not documented — which repair codes apply depends on where on the body the wound is. ${whereClause(
        'site',
        'Select it'
      )}`,
      evidence: NOTHING_TO_CITE,
    });
  }

  if (entry.repairClass === undefined) {
    missingDeterminants.push({
      level: 'determines',
      scope: ENTRY_SCOPE,
      message: `Repair depth is not documented — a single-layer closure codes as a simple repair and a layered closure as an intermediate repair. ${whereClause(
        'depth',
        'Select it'
      )}`,
      evidence: NOTHING_TO_CITE,
    });
  }

  if (entry.totals.totalCm === undefined && entry.totals.lengthIssueFinding === undefined) {
    missingDeterminants.push({
      level: 'determines',
      scope: ENTRY_SCOPE,
      message: `Wound length is not documented — the exact code depends on the total repaired length in cm. ${whereClause(
        'length',
        'Enter it'
      )}`,
      evidence: NOTHING_TO_CITE,
    });
  }

  const determined = determinedRepair(entry, entrySite);

  if (determined === undefined) {
    findings.push(...missingDeterminants);
    const candidates = candidatesFor(entry.repairClass, entrySite);
    evaluation.outcome = openCodeSet(candidates, openSetSummary(candidates, entry, entrySite));
    return evaluation;
  }

  if (determined.repairClass === 'complex') {
    evaluation.outcome = determinedCode(complexSuggestion(facts, determined.entrySite, determined.totalCm));
    return evaluation;
  }

  const series = SERIES_BY_GROUP[lacerationSiteGroup(determined.repairClass, determined.entrySite)];
  const band = bandForLength(series, determined.totalCm);

  const suggestion: CodeSuggestion = {
    code: band.code,
    display: codeCandidate(series, band).display,
    justification: `${series.classLabel} repair — ${classBasisDescription(determined.basis)}; ${
      SITE_LABELS[determined.entrySite]
    } (${series.groupLabel}); total ${formatCm(determined.totalCm)} cm → ${band.code}.`,
  };

  if (determined.basis === 'adhesive' || determined.basis === 'structured-adhesive') {
    evaluation.payerNotes = [LACERATION_TISSUE_ADHESIVE_PAYER_NOTE];
    evaluation.outcome = determinedCodeWithAlternates(
      suggestion,
      [G0168_CANDIDATE],
      `G0168 is the Medicare professional-claim alternative for tissue-adhesive-only closure; OPPS facilities use ${band.code}, and commercial-payer handling varies`
    );

    return evaluation;
  }

  evaluation.outcome = determinedCode(suggestion);

  if (determined.basis === 'contaminated') {
    evaluation.payerNotes = [LACERATION_CONTAMINATION_PAYER_NOTE];
  }

  return evaluation;
}

function complexSuggestion(facts: LacerationFacts, entrySite: AnatomicSite, totalCm: number): CodeSuggestion {
  const series = COMPLEX_SERIES_BY_GROUP[complexRepairSiteGroup(entrySite)];
  const elements = complexElementList(facts);
  const siteClause = `${SITE_LABELS[entrySite]} (${series.groupLabel})`;

  if (totalCm <= COMPLEX_SECOND_MAX_CM + LENGTH_COMPARISON_EPSILON_CM) {
    const role: ComplexCodeRole = totalCm <= COMPLEX_BASE_MAX_CM + LENGTH_COMPARISON_EPSILON_CM ? 'base' : 'second';
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
    display: `${series.secondCode} — Complex repair, ${series.groupLabel}, ${formatCm(totalCm)} cm total (with add-on ${
      series.addOnCode
    } × ${units} for the length beyond ${COMPLEX_SECOND_MAX_CM} cm)`,
    justification: `Complex repair — ${elements} documented; ${siteClause}; total ${formatCm(totalCm)} cm → ${
      series.secondCode
    } + ${series.addOnCode} × ${units} (${series.secondCode} covers the first ${COMPLEX_SECOND_MAX_CM} cm; ${
      series.addOnCode
    } each additional 5 cm or part).`,
    addOns: [
      {
        code: series.addOnCode,
        units,
        display: complexCodeCandidate(series, 'addOn').display,
        justification: `${formatCm(
          totalCm - COMPLEX_SECOND_MAX_CM
        )} cm beyond the first ${COMPLEX_SECOND_MAX_CM} cm → ${series.addOnCode} × ${units}.`,
      },
    ],
  };
}
