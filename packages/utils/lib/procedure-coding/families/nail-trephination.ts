/** Nail trephination, target CPT 2026.
 * CMS MPFS RVU26A, PPRRVU2026_Jan_nonQPP, row 11740 corroborates code identity (short descriptor).
 * https://www.cms.gov/files/zip/rvu26a.zip
 * NCCI III supplies general surgery/bundling policy, not a complete trephination algorithm.
 * https://www.cms.gov/files/document/03-chapter3-ncci-medicare-policy-manual-2026-final.pdf
 * Count-per-digit and route-out rules follow the reviewed specification; full CPT body verification is outstanding.
 */
import { buildEvaluation, coder, missing, MueAdjudication } from '../cpt';
import { NAIL_TREPHINATION_PTP_EDITS } from '../medicare-ptp';
import { ProcedureFamilyModel } from '../model.types';
import { PROCEDURE_NAMES } from '../procedure-names';
import { readNumber } from '../structured-fields';

const NAIL_TREPHINATION_CODES = {
  SubungualHematomaEvacuation: '11740',
} as const;

type NailTrephinationCode = (typeof NAIL_TREPHINATION_CODES)[keyof typeof NAIL_TREPHINATION_CODES];

export const nailTrephinationFamily: ProcedureFamilyModel<NailTrephinationCode> = {
  codePairEdits: NAIL_TREPHINATION_PTP_EDITS,
  id: 'nail-trephination',
  procedureNames: PROCEDURE_NAMES['nail-trephination'],
  displayName: 'Nail trephination',
  fields: [
    { key: 'count', label: 'Digits treated', kind: 'number', defaultValue: 1, min: 0, step: 1 },
    { key: 'nailRemoved', label: 'Nail removed', kind: 'checkbox', defaultValue: false },
    { key: 'nailBedRepaired', label: 'Nail bed repaired', kind: 'checkbox', defaultValue: false },
  ],
  codes: Object.values(NAIL_TREPHINATION_CODES),
  suggest: (facts) => {
    if (facts.nailRemoved || facts.nailBedRepaired) return coder('Nail removal or nail-bed repair uses other codes.');

    const count = readNumber(facts, 'count');

    return count && Number.isInteger(count)
      ? buildEvaluation({
          suggestions: [
            {
              code: NAIL_TREPHINATION_CODES.SubungualHematomaEvacuation,
              display: 'Evacuation of subungual hematoma',
              justification: 'Drainage through a retained nail.',
              units: count,
              modifiers: [],
            },
          ],
        })
      : missing('Digits treated');
  },
  dailyLimits: {
    [NAIL_TREPHINATION_CODES.SubungualHematomaEvacuation]: {
      maxUnits: 2,
      adjudicationIndicator: MueAdjudication.DateOfServiceClinical,
    },
  },
  documentationChecklist: () => [
    'Identify each digit and applicable digit modifier, trauma mechanism, clinical findings and fracture assessment if performed.',
    'Record trephination method, drainage achieved, retained nail plate and aftercare.',
  ],
};
