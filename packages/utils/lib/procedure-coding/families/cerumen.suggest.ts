import {
  citing,
  determinedCode,
  emptySuggestionEvaluation,
  ENTRY_SCOPE,
  FamilyEvaluation,
  NOTHING_TO_CITE,
  openCodeSet,
  ProcedureFactsInput,
} from '../model.types';
import { extractCerumenFacts } from './cerumen.extract';
import { CERUMEN_CODE_CATALOG, CERUMEN_CODE_RULES } from './cerumen.rules';
import {
  addPayerNote,
  CERUMEN_IRRIGATION_PAYER_NOTE,
  impactionAskMessage,
  impactionDeniedMessage,
  methodAskMessage,
  noteBilateralRemoval,
  resolveMethod,
} from './cerumen.shared';

const CERUMEN_BOTH_CODES = '69209 and 69210';

export function suggestCerumenCode(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractCerumenFacts(input);
  const evaluation = emptySuggestionEvaluation();
  const { findings } = evaluation;

  if (facts.impactionDeniedDocumented && !facts.impactionDocumented) {
    findings.push({
      level: 'contradiction',
      scope: ENTRY_SCOPE,
      message: impactionDeniedMessage(CERUMEN_BOTH_CODES),
      evidence: citing(facts.impactionDeniedDocumented),
    });
    return evaluation;
  }

  noteBilateralRemoval(evaluation, facts);
  const method = resolveMethod(facts);

  if (method === undefined) {
    findings.push({ level: 'determines', scope: ENTRY_SCOPE, message: methodAskMessage(), evidence: NOTHING_TO_CITE });
    if (!facts.impactionDocumented) {
      findings.push({
        level: 'determines',
        scope: ENTRY_SCOPE,
        message: impactionAskMessage(CERUMEN_BOTH_CODES),
        evidence: NOTHING_TO_CITE,
      });
    }
    evaluation.outcome = openCodeSet(
      CERUMEN_CODE_CATALOG.codes.map(CERUMEN_CODE_CATALOG.candidate),
      '69209–69210 — the removal method (irrigation/lavage vs instrumentation) determines the code'
    );
    return evaluation;
  }

  const code = CERUMEN_CODE_RULES[method].code;
  if (method === 'irrigation') {
    addPayerNote(evaluation, CERUMEN_IRRIGATION_PAYER_NOTE);
  }

  if (!facts.impactionDocumented) {
    findings.push({
      level: 'determines',
      scope: ENTRY_SCOPE,
      message: impactionAskMessage(code),
      evidence: NOTHING_TO_CITE,
    });

    evaluation.outcome = openCodeSet(
      [CERUMEN_CODE_CATALOG.candidate(code)],
      `${code} only — it applies only if impacted cerumen is documented; routine wax removal is part of the visit (E/M) charge`
    );

    return evaluation;
  }

  evaluation.outcome = determinedCode({
    code,
    display: CERUMEN_CODE_CATALOG.candidate(code).display,
    justification:
      method === 'instrumentation'
        ? `Impacted cerumen removal by instrumentation documented${
            facts.irrigationDocumented ? ' (irrigation is also documented — the instrumentation governs)' : ''
          } → 69210.`
        : 'Impacted cerumen removed by irrigation/lavage with no instrumentation documented → 69209.',
  });

  return evaluation;
}
