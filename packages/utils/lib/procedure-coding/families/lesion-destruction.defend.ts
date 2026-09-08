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
import { extractLesionDestructionFacts } from './lesion-destruction.extract';
import { isLesionDestructionCode, LESION_COUNT_BOUNDARY, LESION_DESTRUCTION_CODES } from './lesion-destruction.rules';
import {
  countAskMessage,
  excludedLesionMessage,
  implausibleCountMessage,
  whereClause,
} from './lesion-destruction.shared';

export function defendLesionDestructionCodes(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractLesionDestructionFacts(input);
  const evaluation = emptyDefenseEvaluation();
  const { findings } = evaluation;
  const selected = input.cptCodes ?? [];

  if (selected.length === 0) return evaluation;

  const count = facts.lesionCount?.value;
  const excluded = facts.excludedLesionType;

  defendSelectedCodes(
    input,
    evaluation,
    (code) => (isLesionDestructionCode(code) ? code : undefined),
    (_info, code, codeFindings) => {
      if (excluded !== undefined) {
        codeFindings.push({
          level: 'contradiction',
          scope: codeScope(code),
          message: excludedLesionMessage(excluded.value, `${code} is selected`),
          evidence: citing(excluded),
        });
      } else if (count === undefined) {
        const implausibleCount = facts.implausibleLesionCount;

        codeFindings.push({
          level: 'determines',
          scope: codeScope(code),
          message:
            implausibleCount === undefined
              ? countAskMessage(` for ${code}`)
              : implausibleCountMessage(` for ${code}`, implausibleCount.value),
          evidence: citing(implausibleCount),
        });
      } else if (code === LESION_DESTRUCTION_CODES.overBoundary && count <= LESION_COUNT_BOUNDARY) {
        codeFindings.push({
          level: 'contradiction',
          scope: codeScope(code),
          message: `17111 covers 15 or more lesions, but the note documents ${count} — as documented this supports 17110 (up to 14 lesions).`,
          evidence: citing(facts.lesionCount),
        });
      } else if (code === LESION_DESTRUCTION_CODES.upToBoundary && count > LESION_COUNT_BOUNDARY) {
        codeFindings.push({
          level: 'contradiction',
          scope: codeScope(code),
          message: `17110 covers up to 14 lesions, but the note documents ${count} — as documented this supports 17111 (15 or more lesions).`,
          evidence: citing(facts.lesionCount),
        });
      }

      if (!facts.methodDocumented) {
        codeFindings.push({
          level: 'required',
          scope: codeScope(code),
          message: `The destruction method is not documented for ${code} — the note should say how the lesions were destroyed (e.g. liquid nitrogen). ${whereClause(
            'method'
          )}`,
          evidence: NOTHING_TO_CITE,
        });
      }
      if (!facts.locationsDocumented) {
        codeFindings.push({
          level: 'required',
          scope: codeScope(code),
          message: `The treated locations are not documented for ${code}. ${whereClause('locations', 'Record them')}`,
          evidence: NOTHING_TO_CITE,
        });
      }
    }
  );

  if (selected.some((c) => isLesionDestructionCode(c.code))) {
    if (!facts.lateralityDocumented) {
      findings.push({
        level: 'bestPractice',
        scope: ENTRY_SCOPE,
        message: `The side is not documented — 17110 and 17111 are not unilateral codes, so it does not select the code, but for a paired site it completes the note. ${whereClause(
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
        message: `Anesthesia is not noted — cryotherapy is usually performed without any, and it does not affect these codes, but a complete note records what was used. ${whereClause(
          'anesthesia'
        )}`,
        evidence: NOTHING_TO_CITE,
      });
    }
  }

  return evaluation;
}
