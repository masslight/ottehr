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
import { extractNasalPackingFacts } from './nasal-packing.extract';
import { codeCandidate, NASAL_PACKING_CODES } from './nasal-packing.rules';
import {
  COMPLEXITY_ELEMENT_MENU,
  complexityElementList,
  LOCATION_ASK_CLAUSE,
  subsequentPackingMessage,
  whereClause,
} from './nasal-packing.shared';

function methodAskMessage(subject: string): string {
  return `The control performed is not documented${subject} — each code in this family is defined by the cautery and/or packing used (30901 limited, 30903 extensive, 30905 posterior nasal packs), so as documented the note supports none of them. ${whereClause(
    'method'
  )}`;
}

export function suggestNasalPackingCode(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractNasalPackingFacts(input);
  const evaluation = emptySuggestionEvaluation();
  const { findings } = evaluation;

  if (facts.location === undefined) {
    findings.push({
      level: 'determines',
      scope: ENTRY_SCOPE,
      message: `The bleeding site is not documented — ${LOCATION_ASK_CLAUSE}. ${whereClause('location')}`,
      evidence: NOTHING_TO_CITE,
    });

    evaluation.outcome = openCodeSet(
      Object.values(NASAL_PACKING_CODES).map(codeCandidate),
      '30901–30905 — the bleeding site (anterior vs posterior) and packing extent determine the code'
    );

    return evaluation;
  }

  if (facts.location.value === 'posterior') {
    if (facts.subsequentPackingDocumented) {
      const message = subsequentPackingMessage('No code is suggested');

      findings.push({
        level: 'contradiction',
        scope: ENTRY_SCOPE,
        message,
        evidence: citing(facts.subsequentPackingDocumented),
      });

      evaluation.outcome = notAssessedCode(message);

      return evaluation;
    }
    if (!facts.cauteryDocumented && !facts.packingDocumented) {
      findings.push({
        level: 'determines',
        scope: ENTRY_SCOPE,
        message: methodAskMessage(''),
        evidence: NOTHING_TO_CITE,
      });

      evaluation.outcome = openCodeSet(
        [codeCandidate(NASAL_PACKING_CODES.posteriorInitial)],
        '30905 only — posterior control; it applies once the posterior packing and/or cautery performed is documented'
      );

      return evaluation;
    }
    evaluation.outcome = determinedCode({
      code: NASAL_PACKING_CODES.posteriorInitial,
      display: codeCandidate(NASAL_PACKING_CODES.posteriorInitial).display,
      justification: 'Posterior epistaxis control — posterior packing documented → 30905.',
    });

    return evaluation;
  }

  if (!facts.cauteryDocumented && !facts.packingDocumented) {
    findings.push({
      level: 'determines',
      scope: ENTRY_SCOPE,
      message: methodAskMessage(''),
      evidence: NOTHING_TO_CITE,
    });

    evaluation.outcome = openCodeSet(
      [codeCandidate(NASAL_PACKING_CODES.anteriorSimple), codeCandidate(NASAL_PACKING_CODES.anteriorComplex)],
      '30901–30903 — anterior control; the cautery/packing performed and its extent determine which'
    );

    return evaluation;
  }

  if (facts.complexityElements.length > 0) {
    evaluation.outcome = determinedCode({
      code: NASAL_PACKING_CODES.anteriorComplex,
      display: codeCandidate(NASAL_PACKING_CODES.anteriorComplex).display,
      justification: `Complex anterior epistaxis control — ${complexityElementList(facts)} documented → 30903.`,
    });
  } else {
    evaluation.outcome = determinedCode({
      code: NASAL_PACKING_CODES.anteriorSimple,
      display: codeCandidate(NASAL_PACKING_CODES.anteriorSimple).display,
      justification: `Simple anterior epistaxis control — none of the complexity elements (${COMPLEXITY_ELEMENT_MENU}) is documented → 30901.`,
    });
  }

  return evaluation;
}
