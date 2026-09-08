import { defendSelectedCodes } from '../family-support';
import {
  citing,
  codeScope,
  emptyDefenseEvaluation,
  FamilyEvaluation,
  NOTHING_TO_CITE,
  ProcedureFactsInput,
} from '../model.types';
import { extractUrinaryCatheterizationFacts } from './urinary-catheterization.extract';
import { URINARY_CATHETER_CODE_CATALOG, URINARY_CATHETER_RULES } from './urinary-catheterization.rules';
import { TYPE_ASK_CLAUSE, TYPE_CONFLICT_CLAUSE, TYPE_LABELS, whereClause } from './urinary-catheterization.shared';

export function defendUrinaryCatheterizationCodes(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractUrinaryCatheterizationFacts(input);
  const evaluation = emptyDefenseEvaluation();
  const selected = input.cptCodes ?? [];

  if (selected.length === 0) return evaluation;

  const documentedType = facts.catheterType?.value;

  defendSelectedCodes(
    input,
    evaluation,
    (code) => URINARY_CATHETER_CODE_CATALOG.resolve(code),
    (info, code, codeFindings) => {
      if (facts.typeConflict) {
        codeFindings.push({
          level: 'determines',
          scope: codeScope(code),
          message: `The catheter type is ambiguous for ${code} — ${TYPE_CONFLICT_CLAUSE}.`,
          evidence: NOTHING_TO_CITE,
        });
      } else if (documentedType === undefined) {
        codeFindings.push({
          level: 'determines',
          scope: codeScope(code),
          message: `The catheter type is not documented for ${code} — ${TYPE_ASK_CLAUSE}. ${whereClause('type')}`,
          evidence: NOTHING_TO_CITE,
        });
      } else if (documentedType !== info.type) {
        codeFindings.push({
          level: 'contradiction',
          scope: codeScope(code),
          message: `${code} covers ${info.coverage}, but the note documents ${TYPE_LABELS[documentedType]} — as documented this supports ${URINARY_CATHETER_RULES[documentedType].code}.`,
          evidence: citing(facts.catheterType),
        });
      }

      if (!facts.sizeDocumented) {
        codeFindings.push({
          level: 'bestPractice',
          scope: codeScope(code),
          message: `The catheter size is not documented for ${code} — it does not affect the code, but a complete note records the French size. ${whereClause(
            'size'
          )}`,
          evidence: NOTHING_TO_CITE,
        });
      }

      if (!facts.indicationDocumented) {
        codeFindings.push({
          level: 'bestPractice',
          scope: codeScope(code),
          message: `The indication is not documented for ${code} — a complete note says why the catheterization was performed. ${whereClause(
            'indication'
          )}`,
          evidence: NOTHING_TO_CITE,
        });
      }

      if (!facts.outcomeDocumented) {
        codeFindings.push({
          level: 'required',
          scope: codeScope(code),
          message: `The outcome is not documented for ${code} — record whether urine was obtained and how the patient tolerated it. ${whereClause(
            'outcome'
          )}`,
          evidence: NOTHING_TO_CITE,
        });
      }
    }
  );

  return evaluation;
}
