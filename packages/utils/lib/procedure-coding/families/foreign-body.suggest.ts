import { joinWithOr } from '../family-support';
import {
  citing,
  determinedCode,
  emptySuggestionEvaluation,
  ENTRY_SCOPE,
  FamilyEvaluation,
  ifPerformedClause,
  notAssessedCode,
  NOTHING_TO_CITE,
  openCodeSet,
  ProcedureFactsInput,
} from '../model.types';
import { extractForeignBodyFacts } from './foreign-body.extract';
import {
  codeCandidate,
  FOREIGN_BODY_CODE_INFO,
  FOREIGN_BODY_CODES,
  NO_PROCEDURE_CODE_CANDIDATE,
} from './foreign-body.rules';
import {
  COMPLICATION_ELEMENT_LABELS,
  COMPLICATION_ELEMENT_MENU,
  EYE_SLIT_LAMP_ASK_CLAUSE,
  EYE_STRUCTURE_ASK_CLAUSE,
  GENERAL_ANESTHESIA_ALTERNATIVES,
  GENERAL_ANESTHESIA_CONTRADICTIONS,
  GeneralAnesthesiaOfficeCode,
  nonCornealEyeMessage,
  SITE_ASK_CLAUSE,
  whereClause,
} from './foreign-body.shared';

function generalAnesthesiaNotAssessedReason(officeCode: GeneralAnesthesiaOfficeCode): string {
  return `The note documents general anesthesia or procedural sedation, which points at ${GENERAL_ANESTHESIA_ALTERNATIVES[officeCode]} rather than ${officeCode}; ${GENERAL_ANESTHESIA_ALTERNATIVES[officeCode]} is outside this model's scope and is not assessed.`;
}

const SKIN_OPEN_CANDIDATES_SUMMARY =
  '10120–10121, or no separate procedure code — whether an incision was made decides which';

const SITE_OPEN_CANDIDATES_SUMMARY = `${Object.keys(FOREIGN_BODY_CODE_INFO).join(
  ', '
)} — the documented body site selects the branch`;

export function suggestForeignBodyCode(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractForeignBodyFacts(input);
  const evaluation = emptySuggestionEvaluation();
  const { findings } = evaluation;
  const site = facts.site?.value;

  if (site === undefined) {
    findings.push({
      level: 'determines',
      scope: ENTRY_SCOPE,
      message: `Body site is not documented — ${SITE_ASK_CLAUSE}. ${whereClause('site', 'Select it')}`,
      evidence: NOTHING_TO_CITE,
    });
    evaluation.outcome = openCodeSet(
      Object.values(FOREIGN_BODY_CODES).map(codeCandidate),
      SITE_OPEN_CANDIDATES_SUMMARY
    );
    return evaluation;
  }

  if (site === 'nose') {
    if (facts.generalAnesthesiaDocumented) {
      findings.push({
        level: 'contradiction',
        scope: ENTRY_SCOPE,
        message: GENERAL_ANESTHESIA_CONTRADICTIONS[FOREIGN_BODY_CODES.intranasalOffice],
        evidence: citing(facts.generalAnesthesiaDocumented),
      });
      evaluation.outcome = notAssessedCode(generalAnesthesiaNotAssessedReason(FOREIGN_BODY_CODES.intranasalOffice));
      return evaluation;
    }
    evaluation.outcome = determinedCode({
      code: FOREIGN_BODY_CODES.intranasalOffice,
      display: codeCandidate(FOREIGN_BODY_CODES.intranasalOffice).display,
      justification: 'Intranasal foreign body — the nose is the documented site → 30300.',
    });
    return evaluation;
  }

  if (site === 'eye') {
    const structure = facts.eyeStructure;
    if (structure !== undefined && structure.value !== 'cornea') {
      const message = nonCornealEyeMessage(structure.value);
      findings.push({
        level: 'bestPractice',
        scope: ENTRY_SCOPE,
        message,
        evidence: citing(structure),
      });
      evaluation.outcome = notAssessedCode(message);
      return evaluation;
    }
    if (structure === undefined) {
      findings.push({
        level: 'determines',
        scope: ENTRY_SCOPE,
        message: `The eye structure is not documented — ${EYE_STRUCTURE_ASK_CLAUSE}. ${whereClause(
          'eyeStructure',
          'Add which structure it was on'
        )}`,
        evidence: NOTHING_TO_CITE,
      });
    }

    const withSlitLamp = facts.slitLampDocumented;
    const withoutSlitLamp = facts.withoutSlitLampDocumented;

    if (withSlitLamp !== undefined && withoutSlitLamp !== undefined) {
      findings.push({
        level: 'contradiction',
        scope: ENTRY_SCOPE,
        message: `The note documents both slit-lamp use and removal without a slit lamp — reconcile how the corneal foreign body was removed. ${whereClause(
          'slitLamp',
          'Correct it'
        )}`,
        evidence: citing(withoutSlitLamp),
      });
    } else if (withSlitLamp === undefined && withoutSlitLamp === undefined) {
      findings.push({
        level: 'determines',
        scope: ENTRY_SCOPE,
        message: `Slit-lamp use is not documented — ${EYE_SLIT_LAMP_ASK_CLAUSE}. ${whereClause(
          'slitLamp',
          'Add whether it was used'
        )}`,
        evidence: NOTHING_TO_CITE,
      });
    }

    if (findings.length > 0) {
      const candidates =
        withSlitLamp !== undefined && withoutSlitLamp === undefined
          ? [codeCandidate(FOREIGN_BODY_CODES.cornealWithSlitLamp)]
          : withoutSlitLamp !== undefined && withSlitLamp === undefined
          ? [codeCandidate(FOREIGN_BODY_CODES.cornealWithoutSlitLamp)]
          : [
              codeCandidate(FOREIGN_BODY_CODES.cornealWithoutSlitLamp),
              codeCandidate(FOREIGN_BODY_CODES.cornealWithSlitLamp),
            ];

      evaluation.outcome = openCodeSet(
        candidates,
        candidates.length === 1
          ? `${candidates[0].code} — a single conditional candidate: it applies only to a corneal foreign body`
          : `65220–65222 — ${EYE_SLIT_LAMP_ASK_CLAUSE}`
      );

      return evaluation;
    }

    const code =
      withSlitLamp !== undefined ? FOREIGN_BODY_CODES.cornealWithSlitLamp : FOREIGN_BODY_CODES.cornealWithoutSlitLamp;

    evaluation.outcome = determinedCode({
      code,
      display: codeCandidate(code).display,
      justification:
        code === FOREIGN_BODY_CODES.cornealWithSlitLamp
          ? 'Corneal foreign body — the eye is the documented site and slit-lamp use is documented → 65222.'
          : 'Corneal foreign body — the eye is the documented site and removal without a slit lamp is documented → 65220.',
    });
    return evaluation;
  }

  if (site === 'ear') {
    if (facts.generalAnesthesiaDocumented) {
      findings.push({
        level: 'contradiction',
        scope: ENTRY_SCOPE,
        message: GENERAL_ANESTHESIA_CONTRADICTIONS[FOREIGN_BODY_CODES.earCanalWithoutGeneralAnesthesia],
        evidence: citing(facts.generalAnesthesiaDocumented),
      });
      evaluation.outcome = notAssessedCode(
        generalAnesthesiaNotAssessedReason(FOREIGN_BODY_CODES.earCanalWithoutGeneralAnesthesia)
      );
      return evaluation;
    }

    evaluation.outcome = determinedCode({
      code: FOREIGN_BODY_CODES.earCanalWithoutGeneralAnesthesia,
      display: codeCandidate(FOREIGN_BODY_CODES.earCanalWithoutGeneralAnesthesia).display,
      justification: 'Foreign body in the ear canal, removed without general anesthesia → 69200.',
    });

    return evaluation;
  }

  if (!facts.incisionDocumented) {
    findings.push({
      level: 'determines',
      scope: ENTRY_SCOPE,
      message: `An incision is not documented — 10120 and 10121 are defined as removal by incision; without one the removal is generally part of the visit (E/M) charge. ${whereClause(
        'incision',
        ifPerformedClause('made', 'add it')
      )}`,
      evidence: NOTHING_TO_CITE,
    });

    evaluation.outcome = openCodeSet(
      [
        codeCandidate(FOREIGN_BODY_CODES.skinSimple),
        codeCandidate(FOREIGN_BODY_CODES.skinComplicated),
        NO_PROCEDURE_CODE_CANDIDATE,
      ],
      SKIN_OPEN_CANDIDATES_SUMMARY
    );

    return evaluation;
  }
  if (facts.complicationElements.length > 0) {
    const documented = joinWithOr(facts.complicationElements.map((e) => COMPLICATION_ELEMENT_LABELS[e.value]));

    evaluation.outcome = determinedCode({
      code: FOREIGN_BODY_CODES.skinComplicated,
      display: codeCandidate(FOREIGN_BODY_CODES.skinComplicated).display,
      justification: `Complicated foreign-body removal — skin/soft-tissue site; incision documented with ${documented} → 10121.`,
    });
  } else {
    evaluation.outcome = determinedCode({
      code: FOREIGN_BODY_CODES.skinSimple,
      display: codeCandidate(FOREIGN_BODY_CODES.skinSimple).display,
      justification: `Simple foreign-body removal — skin/soft-tissue site; removal by incision documented with none of the complicating elements (${COMPLICATION_ELEMENT_MENU}) → 10120.`,
    });
  }

  return evaluation;
}
