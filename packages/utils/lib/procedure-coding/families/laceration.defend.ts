import { AnatomicSite } from '../extract';
import { defendSelectedCodes, REPAIR_DEPTH_FIELD_LABEL } from '../family-support';
import {
  citing,
  CodeAssessmentKind,
  codeScope,
  emptyDefenseEvaluation,
  ENTRY_SCOPE,
  EvidenceSource,
  FamilyEvaluation,
  fieldEvidence,
  Finding,
  FindingScopeKind,
  ifPerformedClause,
  notAssessedCode,
  NOTHING_TO_CITE,
  ProcedureFactsInput,
  setCodeAssessment,
} from '../model.types';
import { extractLacerationFacts, LacerationFacts, LacerationRepairClass } from './laceration.extract';
import {
  CodeSeries,
  COMPLEX_ADD_ON_INCREMENT_CM,
  COMPLEX_BASE_MAX_CM,
  COMPLEX_CODE_INDEX,
  COMPLEX_REPAIR_MIN_CM,
  COMPLEX_SECOND_MAX_CM,
  COMPLEX_SECOND_MIN_CM,
  IndexedCode,
  IndexedComplexCode,
  isLacerationRepairCode,
  LACERATION_CODE_INDEX,
  SERIES_BY_GROUP,
} from './laceration.rules';
import {
  adhesiveStripsOnly,
  bandForLength,
  bandLabel,
  complexBandLabel,
  complexElementList,
  complexRepairSiteGroup,
  computeWoundTotals,
  duplicateLengthAdvisory,
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
  RepairClassResolution,
  repairDepthMismatchFinding,
  resolutionEvidence,
  resolvedBasisOf,
  resolvedClassOf,
  resolveEntry,
  resolveRepairClass,
  SITE_LABELS,
  siteMismatchFinding,
  stapleEvidence,
  tissueAdhesiveOnly,
  whereClause,
  withArticle,
  WoundTotals,
} from './laceration.shared';

const COMPLEX_ELEMENT_MENU =
  'extensive undermining, retention sutures, stents, debridement, exposed bone/cartilage/tendon, or free-margin involvement';

const LATERALIZABLE_SITES: AnatomicSite[] = ['extremity', 'hand', 'foot', 'ear', 'eyelid', 'axilla'];

const STRUCTURED_BASES: RepairBasis[] = [
  'structured-layered',
  'structured-single',
  'structured-adhesive',
  'structured-strips',
];

function bandLowerBound(series: CodeSeries, bandIndex: number): number {
  return bandIndex === 0 ? 0 : series.bands[bandIndex - 1].maxCm ?? 0;
}

function lengthFitsBand(indexed: IndexedCode, lengthCm: number): boolean {
  const lower = bandLowerBound(indexed.series, indexed.bandIndex);
  const upperOk = indexed.band.maxCm === null || lengthCm <= indexed.band.maxCm + LENGTH_COMPARISON_EPSILON_CM;

  return lengthCm > lower + LENGTH_COMPARISON_EPSILON_CM && upperOk;
}

function missingClosureElements(facts: LacerationFacts): string[] {
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
    if (!facts.closureCount) missing.push('staple count');
    return missing;
  }

  if (!facts.closureMaterial) missing.push('suture material');

  if (!facts.closureCount) missing.push('suture count');

  return missing;
}

const DOCUMENTED_CLASS_DESCRIPTIONS: Record<RepairBasis, (facts: LacerationFacts) => string> = {
  layered: () => 'a layered closure (an intermediate repair)',
  'structured-layered': () => 'a layered closure (an intermediate repair)',
  contaminated: () =>
    'a heavily contaminated wound with extensive cleaning (which qualifies as an intermediate repair)',
  'complex-element': (facts) =>
    `a complex-repair qualifying element (${complexElementList(facts)}), which supports a complex repair`,
  adhesive: () => 'closure with tissue adhesive alone (a simple repair)',
  'structured-adhesive': () => 'closure with tissue adhesive alone (a simple repair)',
  'structured-strips': () => 'closure with adhesive strips only (a simple repair)',
  'structured-single': () => 'a single-layer closure (a simple repair)',
  'single-layer': () => 'a single-layer superficial closure (a simple repair)',
};

function documentedClassClause(
  facts: LacerationFacts,
  classResolution: RepairClassResolution
): { documentedIn: string; description: string } {
  const basis = resolvedBasisOf(classResolution);

  const documentedIn =
    basis !== undefined && STRUCTURED_BASES.includes(basis) ? `the ${REPAIR_DEPTH_FIELD_LABEL} field` : 'the note';

  const description = DOCUMENTED_CLASS_DESCRIPTIONS[basis ?? 'single-layer'](facts);

  return { documentedIn, description };
}

function documentedLengthIn(totals: WoundTotals): string {
  const evidence = totals.totalEvidence;

  return evidence?.source === EvidenceSource.Field ? `the ${evidence.field} field` : 'the note';
}

function repairClassArticle(repairClass: LacerationRepairClass): string {
  return repairClass === 'simple' ? 'a simple' : repairClass === 'intermediate' ? 'an intermediate' : 'a complex';
}

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
  const resolvedClass = resolvedClassOf(classResolution);
  const hasElement = facts.complexElements.length > 0;

  if (resolvedClass === 'simple') {
    const { documentedIn, description } = documentedClassClause(facts, classResolution);
    codeFindings.push({
      level: 'contradiction',
      scope: codeScope(code),
      message: `${code} is a complex-repair code, but ${documentedIn} documents ${description}.`,
      evidence: resolutionEvidence(classResolution),
    });
  } else if (!hasElement) {
    const elementAsk = whereClause(
      'complexElement',
      ifPerformedClause('performed', 'add the qualifying element', 'it')
    );

    if (resolvedClass === 'intermediate') {
      const { documentedIn } = documentedClassClause(facts, classResolution);

      const closureDescription =
        resolvedBasisOf(classResolution) === 'contaminated'
          ? 'a heavily contaminated wound with extensive cleaning'
          : 'a layered closure';

      codeFindings.push({
        level: 'contradiction',
        scope: codeScope(code),
        message: `${code} is selected, but ${documentedIn} documents ${closureDescription} without any complex-repair element (${COMPLEX_ELEMENT_MENU}) — as documented this supports ${intermediateEquivalentRef(
          facts,
          entrySite
        )}. ${elementAsk}`,
        evidence: resolutionEvidence(classResolution),
      });
    } else {
      codeFindings.push({
        level: 'contradiction',
        scope: codeScope(code),
        message: `${code} is selected, but the note does not document any complex-repair element (${COMPLEX_ELEMENT_MENU}) — a complex repair needs at least one. ${elementAsk}`,
        evidence: NOTHING_TO_CITE,
      });
    }
  }

  if (entrySite === undefined) {
    codeFindings.push({
      level: 'determines',
      scope: codeScope(code),
      message: `Body site is not documented for ${code} — which repair codes apply depends on where on the body the wound is. ${whereClause(
        'site',
        'Select it'
      )}`,
      evidence: NOTHING_TO_CITE,
    });
  } else if (complexRepairSiteGroup(entrySite) !== series.group) {
    codeFindings.push({
      level: 'contradiction',
      scope: codeScope(code),
      message: `${code} covers ${series.groupLabel}, but the note documents ${withArticle(
        SITE_LABELS[entrySite]
      )} wound.`,
      evidence: citing(facts.site),
    });
  } else {
    const totals = computeWoundTotals(facts, 'complex', entrySite);
    pushUnique(entryFindings, totals.lengthIssueFinding);
    pushUnique(entryFindings, totals.mismatchFinding);

    if (totals.totalCm === undefined) {
      codeFindings.push({
        level: 'determines',
        scope: codeScope(code),
        message: `Wound length is not documented for ${code} — the exact code depends on the total repaired length; ${code} covers ${complexBandLabel(
          role
        )}. ${whereClause('length', 'Enter it')}`,
        evidence: NOTHING_TO_CITE,
      });
    } else if (totals.totalCm < COMPLEX_REPAIR_MIN_CM - LENGTH_COMPARISON_EPSILON_CM) {
      codeFindings.push({
        level: 'contradiction',
        scope: codeScope(code),
        message: `${code} is a complex-repair code — complex repairs are reported starting at ${formatCm(
          COMPLEX_REPAIR_MIN_CM
        )} cm, but ${documentedLengthIn(totals)} documents a total repaired length of ${formatCm(
          totals.totalCm
        )} cm; a wound that size is coded as a simple or intermediate repair.`,
        evidence: totals.totalEvidence ?? NOTHING_TO_CITE,
      });
    } else {
      const bandMismatch =
        role === 'base'
          ? totals.totalCm > COMPLEX_BASE_MAX_CM + LENGTH_COMPARISON_EPSILON_CM
          : role === 'second'
          ? totals.totalCm <= COMPLEX_BASE_MAX_CM + LENGTH_COMPARISON_EPSILON_CM
          : totals.totalCm <= COMPLEX_SECOND_MAX_CM + LENGTH_COMPARISON_EPSILON_CM;

      if (bandMismatch) {
        codeFindings.push({
          level: 'contradiction',
          scope: codeScope(code),
          message: `${code} covers ${complexBandLabel(role)} for ${series.groupLabel}, but ${documentedLengthIn(
            totals
          )} documents a total repaired length of ${formatCm(totals.totalCm)} cm.`,
          evidence: totals.totalEvidence ?? NOTHING_TO_CITE,
        });
      }
    }
  }

  if (role === 'addOn' && !selected.some((c) => c.code === series.secondCode)) {
    const foreignPrimary = selected.find((c) => {
      const other = COMPLEX_CODE_INDEX[c.code];
      return other !== undefined && other.role !== 'addOn' && other.series.group !== series.group;
    });

    if (foreignPrimary) {
      codeFindings.push({
        level: 'contradiction',
        scope: codeScope(code),
        message: `${code} is the add-on for complex repairs of ${series.groupLabel} (${series.baseCode}/${
          series.secondCode
        }), but the selected complex-repair code ${foreignPrimary.code} covers ${
          COMPLEX_CODE_INDEX[foreignPrimary.code].series.groupLabel
        } — an add-on must come from the same site group as its primary code.`,
        evidence: NOTHING_TO_CITE,
      });
    } else {
      codeFindings.push({
        level: 'contradiction',
        scope: codeScope(code),
        message: `${code} is an add-on code for each additional ${COMPLEX_ADD_ON_INCREMENT_CM} cm beyond ${COMPLEX_SECOND_MAX_CM} cm — it is billed alongside ${series.secondCode} (complex repair, ${series.groupLabel}, ${COMPLEX_SECOND_MIN_CM}–${COMPLEX_SECOND_MAX_CM} cm), but ${series.secondCode} is not selected.`,
        evidence: NOTHING_TO_CITE,
      });
    }
  }

  return codeFindings;
}

function intermediateEquivalentRef(facts: LacerationFacts, entrySite: AnatomicSite | undefined): string {
  if (entrySite === undefined) return 'an intermediate repair';

  const series = SERIES_BY_GROUP[lacerationSiteGroup('intermediate', entrySite)];
  const totals = computeWoundTotals(facts, 'intermediate', entrySite);

  if (totals.totalCm === undefined) {
    return `an intermediate repair (${series.bands[0].code}–${series.bands[series.bands.length - 1].code})`;
  }

  return `an intermediate repair (${bandForLength(series, totals.totalCm).code})`;
}

export function defendLacerationCodes(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractLacerationFacts(input);
  const evaluation = emptyDefenseEvaluation();
  const { findings } = evaluation;
  const selected = input.cptCodes ?? [];

  if (selected.length === 0) return evaluation;

  const classResolution = resolveRepairClass(facts);

  if (classResolution.kind === RepairClassOutcome.OutsideScope) {
    selected.forEach((selectedCode) =>
      setCodeAssessment(evaluation, selectedCode.code, CodeAssessmentKind.NotAssessed)
    );

    evaluation.outcome = notAssessedCode(OUTSIDE_SCOPE_MESSAGE);

    findings.push({
      level: 'bestPractice',
      scope: ENTRY_SCOPE,
      message: OUTSIDE_SCOPE_MESSAGE,
      evidence: citing(classResolution),
    });

    return evaluation;
  }

  pushUnique(findings, repairDepthMismatchFinding(facts));
  pushUnique(findings, siteMismatchFinding(facts));

  const stripsSelected = facts.structuredRepairDepth === 'strips-only';
  const stripsOnly = stripsSelected || (facts.structuredRepairDepth === undefined && adhesiveStripsOnly(facts));
  const entrySite = facts.site?.value;

  const inScopeSelected = selected.filter(
    (c) => isLacerationRepairCode(c.code) || COMPLEX_CODE_INDEX[c.code] !== undefined
  );

  const entry = resolveEntry(facts, classResolution, entrySite);

  if (inScopeSelected.length > 0) {
    pushUnique(findings, entry.totals.lengthIssueFinding);
    pushUnique(findings, entry.totals.mismatchFinding);
  }

  defendSelectedCodes(
    input,
    evaluation,
    (code) => {
      const indexed = LACERATION_CODE_INDEX[code];
      const complexIndexed = COMPLEX_CODE_INDEX[code];
      return indexed || complexIndexed ? { indexed, complexIndexed } : undefined;
    },
    ({ indexed, complexIndexed }, code, codeFindings) => {
      if (stripsOnly) {
        codeFindings.push({
          level: 'contradiction',
          scope: codeScope(code),
          message: `${code} is selected, but ${
            stripsSelected ? `the ${REPAIR_DEPTH_FIELD_LABEL} field` : 'the note'
          } documents closure with adhesive strips only — adhesive strips alone do not support a wound-repair code.`,
          evidence: stripsSelected ? fieldEvidence(REPAIR_DEPTH_FIELD_LABEL) : citing(facts.adhesiveStripsDocumented),
        });
      }

      if (complexIndexed) {
        codeFindings.push(
          ...complexCodeFindings(code, complexIndexed, facts, classResolution, entrySite, selected, findings)
        );
      } else if (indexed) {
        const impliedClass = indexed.series.repairClass;
        const resolvedClass = resolvedClassOf(classResolution);

        if (resolvedClass !== undefined && resolvedClass !== impliedClass) {
          const { documentedIn, description } = documentedClassClause(facts, classResolution);

          codeFindings.push({
            level: 'contradiction',
            scope: codeScope(code),
            message: `${code} is ${repairClassArticle(
              impliedClass
            )}-repair code, but ${documentedIn} documents ${description}.`,
            evidence: resolutionEvidence(classResolution),
          });
        } else if (resolvedClass === undefined) {
          codeFindings.push({
            level: 'determines',
            scope: codeScope(code),
            message: `Repair depth is not documented for ${code} — a single-layer closure codes as a simple repair and a layered closure as an intermediate repair. ${whereClause(
              'depth',
              'Select it'
            )}`,
            evidence: NOTHING_TO_CITE,
          });

          if (impliedClass === 'intermediate' && facts.contaminationDocumented && !facts.extensiveCleaningDocumented) {
            codeFindings.push({
              level: 'required',
              scope: codeScope(code),
              message: `The note documents heavy contamination but not the extensive cleaning/irrigation — ${code} as an intermediate repair on that basis needs both documented. ${whereClause(
                'extensiveCleaning'
              )}`,
              evidence: citing(facts.contaminationDocumented),
            });
          }
        }

        if (entrySite === undefined) {
          codeFindings.push({
            level: 'determines',
            scope: codeScope(code),
            message: `Body site is not documented for ${code} — which repair codes apply depends on where on the body the wound is. ${whereClause(
              'site',
              'Select it'
            )}`,
            evidence: NOTHING_TO_CITE,
          });
        } else {
          const entryGroup = lacerationSiteGroup(impliedClass, entrySite);

          if (entryGroup !== indexed.series.group) {
            codeFindings.push({
              level: 'contradiction',
              scope: codeScope(code),
              message: `${code} covers ${indexed.series.groupLabel}, but the note documents ${withArticle(
                SITE_LABELS[entrySite]
              )} wound.`,
              evidence: citing(facts.site),
            });
          } else {
            const totals = computeWoundTotals(facts, impliedClass, entrySite);
            pushUnique(findings, totals.lengthIssueFinding);
            pushUnique(findings, totals.mismatchFinding);

            if (totals.totalCm === undefined) {
              codeFindings.push({
                level: 'determines',
                scope: codeScope(code),
                message: `Wound length is not documented for ${code} — the exact code depends on the total repaired length; ${code} covers ${bandLabel(
                  indexed.band
                )}. ${whereClause('length', 'Enter it')}`,
                evidence: NOTHING_TO_CITE,
              });
            } else if (!lengthFitsBand(indexed, totals.totalCm)) {
              codeFindings.push({
                level: 'contradiction',
                scope: codeScope(code),
                message: `${code} covers ${bandLabel(indexed.band)} for ${
                  indexed.series.groupLabel
                }, but ${documentedLengthIn(totals)} documents a total repaired length of ${formatCm(
                  totals.totalCm
                )} cm.`,
                evidence: totals.totalEvidence ?? NOTHING_TO_CITE,
              });
            }
          }
        }
      }

      if (!stripsOnly) {
        const missingClosure = missingClosureElements(facts);

        if (missingClosure.length > 0) {
          codeFindings.push({
            level: 'required',
            scope: codeScope(code),
            message: `Closure documentation for ${code} is incomplete — not documented: ${missingClosure.join(
              ', '
            )}. ${whereClause(
              stapleEvidence(facts) ? 'stapleClosure' : 'sutureClosure',
              missingClosure.length > 1 ? 'Add these' : 'Add it'
            )}`,
            evidence: NOTHING_TO_CITE,
          });
        }
      }
    }
  );

  if (inScopeSelected.length > 0) {
    pushUnique(findings, duplicateLengthAdvisory(facts));

    for (const advisory of otherGroupAdvisories(entry.totals.otherGroupWounds, entry.repairClass)) {
      pushUnique(findings, advisory);
    }

    if (!facts.lateralityDocumented && entrySite !== undefined && LATERALIZABLE_SITES.includes(entrySite)) {
      findings.push({
        level: 'bestPractice',
        scope: ENTRY_SCOPE,
        message: `Laterality is not documented for this ${
          SITE_LABELS[entrySite]
        } wound — noting left or right avoids ambiguity, especially with multiple wounds. ${whereClause(
          'laterality',
          'Select it'
        )}`,
        evidence: NOTHING_TO_CITE,
      });
    }
    if (!facts.anesthesiaDocumented) {
      findings.push({
        level: 'bestPractice',
        scope: ENTRY_SCOPE,
        message: `Anesthesia is not noted — it does not affect the code (local anesthesia is included in the repair), but a complete note records what was used. ${whereClause(
          'anesthesia'
        )}`,
        evidence: NOTHING_TO_CITE,
      });
    }
    if (!facts.irrigationDocumented) {
      findings.push({
        level: 'bestPractice',
        scope: ENTRY_SCOPE,
        message: `Wound irrigation is not documented. ${whereClause('irrigation')}`,
        evidence: NOTHING_TO_CITE,
      });
    }
    if (!facts.tetanusDocumented) {
      findings.push({
        level: 'bestPractice',
        scope: ENTRY_SCOPE,
        message: `Tetanus status is not documented. ${whereClause('tetanus')}`,
        evidence: NOTHING_TO_CITE,
      });
    }

    const payerNotes: string[] = [];

    if (facts.structuredRepairDepth === 'tissue-adhesive-only' || tissueAdhesiveOnly(facts)) {
      payerNotes.push(LACERATION_TISSUE_ADHESIVE_PAYER_NOTE);
    }

    if (resolvedBasisOf(classResolution) === 'contaminated') {
      payerNotes.push(LACERATION_CONTAMINATION_PAYER_NOTE);
    }

    if (payerNotes.length > 0) evaluation.payerNotes = payerNotes;
  }

  if (findings.some((f) => f.level === 'contradiction' && f.scope.kind === FindingScopeKind.Entry)) {
    for (const [code, assessment] of evaluation.codeAssessments) {
      if (assessment.kind === CodeAssessmentKind.Supported) {
        setCodeAssessment(evaluation, code, CodeAssessmentKind.Unsupported);
      }
    }
  }

  return evaluation;
}
