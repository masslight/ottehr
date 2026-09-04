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
import { extractBurnFacts } from './burn-treatment.extract';
import { BURN_CLASS_INFO, CLASS_FOR_CODE, isBurnTreatmentCode } from './burn-treatment.rules';
import {
  depthAskMessage,
  EXTENT_ASK_CLAUSE,
  extentPhrase,
  implausibleExtentMessage,
  MIXED_DEPTH_MESSAGE,
  outOfScopeDepthMessage,
  whereClause,
} from './burn-treatment.shared';

export function defendBurnTreatmentCodes(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractBurnFacts(input);
  const evaluation = emptyDefenseEvaluation();
  const { findings } = evaluation;
  const selected = input.cptCodes ?? [];

  if (selected.length === 0) return evaluation;

  const documentedClass = facts.extentClass?.value;
  const depth = facts.depthClass;

  defendSelectedCodes(
    input,
    evaluation,
    (code) => CLASS_FOR_CODE[code],
    (codeClass, code, codeFindings) => {
      const outOfScopeDepth =
        depth === undefined ? undefined : outOfScopeDepthMessage(depth.value, `${code} is selected`);

      if (depth !== undefined && outOfScopeDepth !== undefined) {
        codeFindings.push({
          level: 'contradiction',
          scope: codeScope(code),
          message: outOfScopeDepth,
          evidence: citing(depth),
        });
      } else if (depth === undefined) {
        codeFindings.push({
          level: 'required',
          scope: codeScope(code),
          message: depthAskMessage(` for ${code}`),
          evidence: NOTHING_TO_CITE,
        });
      }

      if (outOfScopeDepth === undefined) {
        if (documentedClass === undefined) {
          const implausiblePercent = facts.implausibleTbsaPercent;
          codeFindings.push({
            level: 'determines',
            scope: codeScope(code),
            message:
              implausiblePercent === undefined
                ? `The burn's extent is not documented for ${code} — ${EXTENT_ASK_CLAUSE}. ${whereClause('extent')}`
                : implausibleExtentMessage(` for ${code}`, implausiblePercent.value),
            evidence: citing(implausiblePercent),
          });
        } else if (documentedClass !== codeClass) {
          const codeInfo = BURN_CLASS_INFO[codeClass];
          const documentedInfo = BURN_CLASS_INFO[documentedClass];
          codeFindings.push({
            level: 'contradiction',
            scope: codeScope(code),
            message: `${code} covers a ${codeClass} burn (${codeInfo.coverage}), but the note documents ${extentPhrase(
              facts
            )} (${documentedClass}, ${documentedInfo.coverage}) — as documented this supports ${documentedInfo.code}.`,
            evidence: citing(facts.extentClass),
          });
        }
      }

      const codeDefiningFactsDocumented = depth?.value === 'partial-thickness' && documentedClass !== undefined;

      if (codeDefiningFactsDocumented && !facts.locationDocumented) {
        codeFindings.push({
          level: 'bestPractice',
          scope: codeScope(code),
          message: `The burn location is not documented for ${code}. ${whereClause('site', 'Select it')}`,
          evidence: NOTHING_TO_CITE,
        });
      }

      if (codeDefiningFactsDocumented && facts.siteIsLateralizable && !facts.lateralityDocumented) {
        codeFindings.push({
          level: 'bestPractice',
          scope: codeScope(code),
          message: `Laterality is not documented for ${code} — the documented site is a paired one, so a complete note records which side was burned. ${whereClause(
            'laterality',
            'Select it'
          )}`,
          evidence: NOTHING_TO_CITE,
        });
      }

      if (!facts.treatmentDocumented) {
        codeFindings.push({
          level: 'required',
          scope: codeScope(code),
          message: `The treatment performed is not documented for ${code} — the note should describe the dressing and/or debridement. ${whereClause(
            'treatment'
          )}`,
          evidence: NOTHING_TO_CITE,
        });
      }
    }
  );

  if (facts.mixedFullThickness && selected.some((c) => isBurnTreatmentCode(c.code))) {
    findings.push({
      level: 'bestPractice',
      scope: ENTRY_SCOPE,
      message: MIXED_DEPTH_MESSAGE,
      evidence: citing(facts.mixedFullThickness),
    });
  }

  return evaluation;
}
