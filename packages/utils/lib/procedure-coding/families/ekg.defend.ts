import { defendSelectedCodes } from '../family-support';
import {
  citing,
  codeScope,
  emptyDefenseEvaluation,
  ENTRY_SCOPE,
  FamilyEvaluation,
  NOTHING_TO_CITE,
  ProcedureFactsInput,
} from '../model.types';
import { extractEkgFacts } from './ekg.extract';
import { EKG_CODES, INTERPRETATION_CODES, isEkgCode } from './ekg.rules';
import {
  FULL_INTERPRETATION_MENU,
  limitedLeadMessage,
  missingElementFinding,
  missingElements,
  whereClause,
} from './ekg.shared';

export function defendEkgCodes(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractEkgFacts(input);
  const evaluation = emptyDefenseEvaluation();
  const { findings } = evaluation;
  const selected = input.cptCodes ?? [];
  if (selected.length === 0) return evaluation;

  const selectedCodes = selected.map((c) => c.code);
  const missing = missingElements(facts);
  const inScopeSelected = selected.filter((c) => isEkgCode(c.code));

  defendSelectedCodes(
    input,
    evaluation,
    (code) => (isEkgCode(code) ? code : undefined),
    (_info, code, codeFindings, answerAtEntryLevel) => {
      if (facts.limitedLeadDocumented) {
        findings.push({
          level: 'contradiction',
          scope: codeScope(code),
          message: limitedLeadMessage(`${code} is selected`),
          evidence: citing(facts.limitedLeadDocumented),
        });
        answerAtEntryLevel();
        return;
      }

      if (code !== EKG_CODES.tracingWithInterpretation && selectedCodes.includes(EKG_CODES.tracingWithInterpretation)) {
        const component = code === EKG_CODES.tracingOnly ? 'the tracing' : 'the interpretation & report';
        codeFindings.push({
          level: 'contradiction',
          scope: codeScope(code),
          message: `${code} bills ${component} only, but 93000 is also selected — 93000 already covers the tracing plus the interpretation & report, so adding ${code} double-bills that component.`,
          evidence: NOTHING_TO_CITE,
        });
      }

      if (INTERPRETATION_CODES.includes(code)) {
        for (const entry of missing) {
          codeFindings.push(missingElementFinding(entry, code));
        }
      }

      if (code === EKG_CODES.tracingOnly && missing.length === 0) {
        codeFindings.push({
          level: 'bestPractice',
          scope: codeScope(code),
          message: `The note documents a full interpretation (${FULL_INTERPRETATION_MENU}) — 93005 bills the tracing only; 93000 covers the tracing plus the interpretation & report.`,
          evidence: citing(facts.elements.impression),
        });
      }
    }
  );

  if (inScopeSelected.length > 0) {
    if (!facts.indicationDocumented) {
      findings.push({
        level: 'bestPractice',
        scope: ENTRY_SCOPE,
        message: `The indication for the EKG is not documented. ${whereClause('indication', 'Record it')}`,
        evidence: NOTHING_TO_CITE,
      });
    }

    if (!facts.comparisonDocumented) {
      findings.push({
        level: 'bestPractice',
        scope: ENTRY_SCOPE,
        message: `Comparison to a prior tracing is not documented — note the comparison, or that no prior is available. ${whereClause(
          'comparison',
          'Add it'
        )}`,
        evidence: NOTHING_TO_CITE,
      });
    }
  }

  return evaluation;
}
