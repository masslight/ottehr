import { defendSelectedCodes } from '../family-support';
import {
  citing,
  codeScope,
  emptyDefenseEvaluation,
  FamilyEvaluation,
  ifPerformedClause,
  NOTHING_TO_CITE,
  ProcedureFactsInput,
} from '../model.types';
import { extractCerumenFacts } from './cerumen.extract';
import { CERUMEN_CODE_CATALOG, CerumenCode, isCerumenRemovalCode } from './cerumen.rules';
import {
  addPayerNote,
  CERUMEN_IRRIGATION_PAYER_NOTE,
  impactionAskMessage,
  impactionDeniedMessage,
  INSTRUMENTATION_MENU,
  methodAskMessage,
  noteBilateralRemoval,
  resolveMethod,
  whereClause,
} from './cerumen.shared';

function irrigationAloneMessage(prefix: string): string {
  return `${prefix} — irrigation alone does not qualify for 69210, which is defined by instrumentation (${INSTRUMENTATION_MENU}); as documented the method supports 69209. ${whereClause(
    'method',
    ifPerformedClause('also used', 'add it', 'an instrument')
  )}`;
}

function instrumentationGovernsMessage(): string {
  return `69209 is selected, but the note documents removal by instrumentation (${INSTRUMENTATION_MENU}) — instrumentation governs even when irrigation is also documented, so as documented this supports 69210. ${whereClause(
    'method',
    'If the removal was irrigation/lavage only, say so'
  )}`;
}

function lateralityAskMessage(code: CerumenCode): string {
  return `Laterality is not documented for ${code} — 69209 and 69210 are unilateral codes. ${whereClause(
    'laterality',
    'Select it'
  )}`;
}

function postExamAskMessage(code: CerumenCode): string {
  return `A post-procedure exam is not documented for ${code} — note that the canal is clear and the TM intact. ${whereClause(
    'postExam'
  )}`;
}

export function defendCerumenCodes(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractCerumenFacts(input);
  const evaluation = emptyDefenseEvaluation();
  const selected = input.cptCodes ?? [];
  if (selected.length === 0) return evaluation;

  const method = resolveMethod(facts);

  defendSelectedCodes(input, evaluation, CERUMEN_CODE_CATALOG.resolve, (rule, code, codeFindings) => {
    if (method === undefined) {
      codeFindings.push({
        level: 'determines',
        scope: codeScope(code),
        message: methodAskMessage(code),
        evidence: NOTHING_TO_CITE,
      });
    } else if (rule.method === 'instrumentation' && method === 'irrigation') {
      codeFindings.push({
        level: 'contradiction',
        scope: codeScope(code),
        message: irrigationAloneMessage(
          '69210 is selected, but the note documents cerumen removal by irrigation/lavage alone'
        ),
        evidence: citing(facts.irrigationDocumented),
      });
      addPayerNote(evaluation, CERUMEN_IRRIGATION_PAYER_NOTE);
    } else if (rule.method === 'irrigation' && method === 'instrumentation') {
      codeFindings.push({
        level: 'contradiction',
        scope: codeScope(code),
        message: instrumentationGovernsMessage(),
        evidence: citing(facts.instrumentationDocumented),
      });
    }

    if (!facts.impactionDocumented) {
      if (facts.impactionDeniedDocumented) {
        codeFindings.push({
          level: 'contradiction',
          scope: codeScope(code),
          message: impactionDeniedMessage(code),
          evidence: citing(facts.impactionDeniedDocumented),
        });
      } else {
        codeFindings.push({
          level: 'required',
          scope: codeScope(code),
          message: impactionAskMessage(code),
          evidence: NOTHING_TO_CITE,
        });
      }
    }

    if (!facts.lateralityDocumented) {
      codeFindings.push({
        level: 'required',
        scope: codeScope(code),
        message: lateralityAskMessage(rule.code),
        evidence: NOTHING_TO_CITE,
      });
    }

    if (!facts.postExamDocumented) {
      codeFindings.push({
        level: 'required',
        scope: codeScope(code),
        message: postExamAskMessage(rule.code),
        evidence: NOTHING_TO_CITE,
      });
    }
  });

  if (selected.some((c) => isCerumenRemovalCode(c.code))) {
    noteBilateralRemoval(evaluation, facts);
  }

  return evaluation;
}
