import { defendSelectedCodes, lateralityFinding } from '../family-support';
import {
  citing,
  codeScope,
  emptyDefenseEvaluation,
  ENTRY_SCOPE,
  FamilyEvaluation,
  ifPerformedClause,
  NOTHING_TO_CITE,
  ProcedureFactsInput,
} from '../model.types';
import { extractForeignBodyFacts, ForeignBodySite } from './foreign-body.extract';
import {
  FOREIGN_BODY_CODE_INFO,
  FOREIGN_BODY_CODES,
  isForeignBodyRemovalCode,
  SITE_BRANCH_LABELS,
} from './foreign-body.rules';
import {
  COMPLICATION_ELEMENT_MENU,
  EYE_SLIT_LAMP_ASK_CLAUSE,
  EYE_STRUCTURE_ASK_CLAUSE,
  GENERAL_ANESTHESIA_ALTERNATIVES,
  GENERAL_ANESTHESIA_CONTRADICTIONS,
  GeneralAnesthesiaOfficeCode,
  nonCornealEyeMessage,
  SITE_ASK_CLAUSE,
  WHERE_TO_DOCUMENT,
  whereClause,
} from './foreign-body.shared';

const POST_ASSESSMENT_ASKS: Record<ForeignBodySite, { ask: string; element: keyof typeof WHERE_TO_DOCUMENT }> = {
  skin: { ask: 'note hemostasis', element: 'postSkin' },
  nose: { ask: 'note hemostasis', element: 'postSkin' },
  eye: { ask: 'note the fluorescein exam', element: 'postEye' },
  ear: { ask: 'note that the TM is intact', element: 'postEar' },
};

function isGeneralAnesthesiaOfficeCode(code: string): code is GeneralAnesthesiaOfficeCode {
  return code in GENERAL_ANESTHESIA_ALTERNATIVES;
}

export function defendForeignBodyCodes(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractForeignBodyFacts(input);
  const evaluation = emptyDefenseEvaluation();
  const { findings } = evaluation;
  const selected = input.cptCodes ?? [];

  if (selected.length === 0) return evaluation;

  const site = facts.site?.value;
  const inScopeSelected = selected.filter((c) => isForeignBodyRemovalCode(c.code));

  defendSelectedCodes(
    input,
    evaluation,
    (code) => (isForeignBodyRemovalCode(code) ? FOREIGN_BODY_CODE_INFO[code] : undefined),
    (info, code, codeFindings) => {
      if (site === undefined) {
        codeFindings.push({
          level: 'determines',
          scope: codeScope(code),
          message: `Body site is not documented for ${code} — ${SITE_ASK_CLAUSE}. ${whereClause('site', 'Select it')}`,
          evidence: NOTHING_TO_CITE,
        });
      } else if (site !== info.site) {
        codeFindings.push({
          level: 'contradiction',
          scope: codeScope(code),
          message: `${code} covers ${info.coverage}, but the note documents the foreign body in the ${SITE_BRANCH_LABELS[site]}.`,
          evidence: citing(facts.site),
        });
      } else {
        if (info.site === 'skin' && !facts.incisionDocumented) {
          codeFindings.push({
            level: 'contradiction',
            scope: codeScope(code),
            message: `${code} requires removal by incision — the note does not document an incision. ${whereClause(
              'incision',
              ifPerformedClause('made', 'add it')
            )}`,
            evidence: NOTHING_TO_CITE,
          });
        }
        if (code === FOREIGN_BODY_CODES.skinComplicated && facts.complicationElements.length === 0) {
          codeFindings.push({
            level: 'contradiction',
            scope: codeScope(code),
            message: `10121 is selected, but the note documents none of the elements that make a removal complicated (${COMPLICATION_ELEMENT_MENU}) — as documented this supports 10120 (simple removal by incision). ${whereClause(
              'complicated',
              ifPerformedClause('performed', 'add it', 'it')
            )}`,
            evidence: NOTHING_TO_CITE,
          });
        }
        if (code === FOREIGN_BODY_CODES.cornealWithoutSlitLamp || code === FOREIGN_BODY_CODES.cornealWithSlitLamp) {
          const structure = facts.eyeStructure;
          if (structure !== undefined && structure.value !== 'cornea') {
            codeFindings.push({
              level: 'contradiction',
              scope: codeScope(code),
              message: nonCornealEyeMessage(structure.value, code),
              evidence: citing(structure),
            });
          } else {
            if (structure === undefined) {
              codeFindings.push({
                level: 'determines',
                scope: codeScope(code),
                message: `The eye structure is not documented for ${code} — ${EYE_STRUCTURE_ASK_CLAUSE}. ${whereClause(
                  'eyeStructure',
                  'Add which structure it was on'
                )}`,
                evidence: NOTHING_TO_CITE,
              });
            }

            if (code === FOREIGN_BODY_CODES.cornealWithSlitLamp && facts.withoutSlitLampDocumented) {
              codeFindings.push({
                level: 'contradiction',
                scope: codeScope(code),
                message:
                  '65222 requires slit-lamp use, but the note documents removal without a slit lamp — as documented this supports 65220.',
                evidence: citing(facts.withoutSlitLampDocumented),
              });
            } else if (code === FOREIGN_BODY_CODES.cornealWithSlitLamp && !facts.slitLampDocumented) {
              codeFindings.push({
                level: 'determines',
                scope: codeScope(code),
                message: `Slit-lamp use is not documented for 65222 — ${EYE_SLIT_LAMP_ASK_CLAUSE}. ${whereClause(
                  'slitLamp',
                  'Add whether it was used'
                )}`,
                evidence: NOTHING_TO_CITE,
              });
            } else if (code === FOREIGN_BODY_CODES.cornealWithoutSlitLamp && facts.slitLampDocumented) {
              codeFindings.push({
                level: 'contradiction',
                scope: codeScope(code),
                message:
                  '65220 covers corneal removal without a slit lamp, but the note documents slit-lamp use — as documented this supports 65222.',
                evidence: citing(facts.slitLampDocumented),
              });
            } else if (code === FOREIGN_BODY_CODES.cornealWithoutSlitLamp && !facts.withoutSlitLampDocumented) {
              codeFindings.push({
                level: 'determines',
                scope: codeScope(code),
                message: `Removal without a slit lamp is not documented for 65220 — ${EYE_SLIT_LAMP_ASK_CLAUSE}. ${whereClause(
                  'slitLamp',
                  'Add whether it was used'
                )}`,
                evidence: NOTHING_TO_CITE,
              });
            }
          }
        }

        const generalAnesthesiaContradiction = isGeneralAnesthesiaOfficeCode(code)
          ? GENERAL_ANESTHESIA_CONTRADICTIONS[code]
          : undefined;

        if (generalAnesthesiaContradiction !== undefined && facts.generalAnesthesiaDocumented) {
          codeFindings.push({
            level: 'contradiction',
            scope: codeScope(code),
            message: generalAnesthesiaContradiction,
            evidence: citing(facts.generalAnesthesiaDocumented),
          });
        }

        if (!facts.postAssessmentDocumented) {
          const { ask, element } = POST_ASSESSMENT_ASKS[info.site];
          codeFindings.push({
            level: 'required',
            scope: codeScope(code),
            message: `A post-removal assessment is not documented for ${code} — for this site, ${ask}. ${whereClause(
              element
            )}`,
            evidence: NOTHING_TO_CITE,
          });
        }
      }

      if (facts.lateralityRequired && !facts.lateralityDocumented) {
        codeFindings.push(
          lateralityFinding(
            code,
            whereClause('laterality', 'Select it'),
            'the documented removal site is paired and should record the side'
          )
        );
      }

      if (!facts.descriptionDocumented) {
        codeFindings.push({
          level: 'required',
          scope: codeScope(code),
          message: `The foreign body is not described for ${code} — the note should say what was removed. ${whereClause(
            'description'
          )}`,
          evidence: NOTHING_TO_CITE,
        });
      }

      if (!facts.outcomeDocumented) {
        codeFindings.push({
          level: 'required',
          scope: codeScope(code),
          message: `Complete removal is not documented for ${code} — the note should state that the foreign body came out entirely. ${whereClause(
            'outcome'
          )}`,
          evidence: NOTHING_TO_CITE,
        });
      }
    }
  );

  if (inScopeSelected.length > 0) {
    if (site === 'skin' && !facts.sizeDocumented) {
      findings.push({
        level: 'bestPractice',
        scope: ENTRY_SCOPE,
        message: `Wound/lesion size is not documented — it does not select the code, but it completes the note. ${whereClause(
          'size',
          'Enter it'
        )}`,
        evidence: NOTHING_TO_CITE,
      });
    }

    if (!facts.anesthesiaDocumented) {
      findings.push({
        level: 'bestPractice',
        scope: ENTRY_SCOPE,
        message: `Anesthesia is not noted — it does not affect these codes, but a complete note records what was used. ${whereClause(
          'anesthesia'
        )}`,
        evidence: NOTHING_TO_CITE,
      });
    }
  }

  return evaluation;
}
