import {
  citing,
  determinedCode,
  emptySuggestionEvaluation,
  ENTRY_SCOPE,
  FamilyEvaluation,
  notAssessedCode,
  NOTHING_TO_CITE,
  openCodeSet,
  ProcedureFactsInput,
} from '../model.types';
import { extractIncisionDrainageFacts, IncisionDrainageFacts } from './incision-drainage.extract';
import { codeCandidate, INCISION_DRAINAGE_CODES } from './incision-drainage.rules';
import {
  COMPLEXITY_ELEMENT_MENU,
  complexityElementList,
  outOfScopeSiteMessage,
  whereClause,
} from './incision-drainage.shared';

const OPEN_CANDIDATES_SUMMARY =
  '10060–10061 — the incision and drainage performed, and whether any complexity element is documented, determine which';

function procedureAskMessage(facts: IncisionDrainageFacts): string {
  const missing = [
    facts.incisionDocumented === undefined ? 'the incision' : undefined,
    facts.drainageDocumented === undefined ? 'the drainage' : undefined,
  ].filter((part): part is string => part !== undefined);
  return `The procedure itself is not documented (${missing.join(
    ' and '
  )} missing) — 10060 and 10061 are both defined as incision and drainage of an abscess, so as documented the note supports neither, and with the procedure absent the absence of complexity language says nothing about complexity. ${whereClause(
    'procedure'
  )}`;
}

export function suggestIncisionDrainageCode(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractIncisionDrainageFacts(input);
  const evaluation = emptySuggestionEvaluation();

  if (facts.outOfScopeSite) {
    const message = outOfScopeSiteMessage(facts.outOfScopeSite.value, 'No code is suggested');
    evaluation.findings.push({
      level: 'bestPractice',
      scope: ENTRY_SCOPE,
      message,
      evidence: citing(facts.outOfScopeSite),
    });
    evaluation.outcome = notAssessedCode(message);
    return evaluation;
  }

  if (!facts.incisionDocumented || !facts.drainageDocumented) {
    evaluation.findings.push({
      level: 'determines',
      scope: ENTRY_SCOPE,
      message: procedureAskMessage(facts),
      evidence: NOTHING_TO_CITE,
    });

    evaluation.outcome = openCodeSet(
      [
        codeCandidate(INCISION_DRAINAGE_CODES.simpleOrSingle.code),
        codeCandidate(INCISION_DRAINAGE_CODES.complicatedOrMultiple.code),
      ],
      OPEN_CANDIDATES_SUMMARY
    );

    return evaluation;
  }

  if (facts.complexityElements.length > 0) {
    evaluation.outcome = determinedCode({
      code: INCISION_DRAINAGE_CODES.complicatedOrMultiple.code,
      display: codeCandidate(INCISION_DRAINAGE_CODES.complicatedOrMultiple.code).display,
      justification: `Complicated or multiple I&D — ${complexityElementList(facts)} documented → 10061.`,
    });
  } else {
    evaluation.outcome = determinedCode({
      code: INCISION_DRAINAGE_CODES.simpleOrSingle.code,
      display: codeCandidate(INCISION_DRAINAGE_CODES.simpleOrSingle.code).display,
      justification: `Simple I&D — none of the complexity elements (${COMPLEXITY_ELEMENT_MENU}) is documented → 10060.`,
    });
  }

  return evaluation;
}
