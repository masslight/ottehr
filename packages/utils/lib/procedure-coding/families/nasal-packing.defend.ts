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
import { extractNasalPackingFacts } from './nasal-packing.extract';
import { isNasalPackingCode, NASAL_PACKING_CODES } from './nasal-packing.rules';
import {
  COMPLEXITY_ELEMENT_MENU,
  complexityElementList,
  LOCATION_ASK_CLAUSE,
  subsequentPackingMessage,
  whereClause,
} from './nasal-packing.shared';

export function defendNasalPackingCodes(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractNasalPackingFacts(input);
  const evaluation = emptyDefenseEvaluation();
  const selected = input.cptCodes ?? [];

  if (selected.length === 0) return evaluation;

  const location = facts.location?.value;
  const firstElement = facts.complexityElements[0];

  defendSelectedCodes(
    input,
    evaluation,
    (code) => (isNasalPackingCode(code) ? code : undefined),
    (_info, code, codeFindings) => {
      if (location === undefined) {
        codeFindings.push({
          level: 'determines',
          scope: codeScope(code),
          message: `The bleeding site is not documented for ${code} — ${LOCATION_ASK_CLAUSE}. ${whereClause(
            'location'
          )}`,
          evidence: NOTHING_TO_CITE,
        });
      } else if (
        code === NASAL_PACKING_CODES.posteriorInitial &&
        location === 'posterior' &&
        facts.subsequentPackingDocumented
      ) {
        codeFindings.push({
          level: 'contradiction',
          scope: codeScope(code),
          message: subsequentPackingMessage('30905 is selected'),
          evidence: citing(facts.subsequentPackingDocumented),
        });
      } else if (code === NASAL_PACKING_CODES.posteriorInitial && location === 'anterior') {
        codeFindings.push({
          level: 'contradiction',
          scope: codeScope(code),
          message:
            '30905 covers posterior epistaxis control, but the note documents anterior packing only — as documented this supports 30901/30903 (anterior control).',
          evidence: citing(facts.location),
        });
      } else if (code !== NASAL_PACKING_CODES.posteriorInitial && location === 'posterior') {
        codeFindings.push({
          level: 'contradiction',
          scope: codeScope(code),
          message: `${code} covers anterior epistaxis control, but the note documents posterior packing — as documented this supports 30905 (posterior, initial).`,
          evidence: citing(facts.location),
        });
      } else if (code === NASAL_PACKING_CODES.anteriorComplex && firstElement === undefined) {
        codeFindings.push({
          level: 'contradiction',
          scope: codeScope(code),
          message: `30903 is selected, but the note does not document any complexity element (${COMPLEXITY_ELEMENT_MENU}) — as documented this supports 30901 (anterior, simple). ${whereClause(
            'complexityElement',
            ifPerformedClause('performed', 'add it', 'extensive control')
          )}`,
          evidence: NOTHING_TO_CITE,
        });
      } else if (code === NASAL_PACKING_CODES.anteriorSimple && firstElement !== undefined) {
        codeFindings.push({
          level: 'contradiction',
          scope: codeScope(code),
          message: `30901 is selected, but the note documents ${complexityElementList(
            facts
          )} — as documented this supports 30903 (anterior, complex/extensive).`,
          evidence: citing(firstElement),
        });
      }

      if (!facts.lateralityDocumented) {
        codeFindings.push({
          level: 'required',
          scope: codeScope(code),
          message: `The treated naris is not documented for ${code}. ${whereClause('laterality', 'Select it')}`,
          evidence: NOTHING_TO_CITE,
        });
      }

      if (!facts.cauteryDocumented && !facts.packingDocumented) {
        codeFindings.push({
          level: 'required',
          scope: codeScope(code),
          message: `The control method is not documented for ${code} — the note should record the cautery and/or packing used (and the product, e.g. Merocel or Rapid Rhino). ${whereClause(
            'method'
          )}`,
          evidence: NOTHING_TO_CITE,
        });
      }

      if (!facts.hemostasisDocumented) {
        codeFindings.push({
          level: 'required',
          scope: codeScope(code),
          message: `Hemostasis is not documented for ${code} — the note should state that the bleeding was controlled. ${whereClause(
            'hemostasis'
          )}`,
          evidence: NOTHING_TO_CITE,
        });
      }
    }
  );

  return evaluation;
}
