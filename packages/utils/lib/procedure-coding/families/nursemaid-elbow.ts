/** Nursemaid's elbow reduction, target CPT 2026.
 * CMS MPFS RVU26A, PPRRVU2026_Jan_nonQPP, row 24640: code identity and payment indicators.
 * https://www.cms.gov/files/zip/rvu26a.zip
 * NCCI IV supplies fracture/dislocation bundling policy; it does not define the clinical diagnosis.
 * https://www.cms.gov/files/document/04-chapter4-ncci-medicare-policy-manual-2026-final.pdf
 * The subluxation/true-dislocation boundary requires the CPT descriptor, not inference from the procedure name.
 */
import { buildEvaluation, coder, missing, MueAdjudication } from '../cpt';
import { NURSEMAID_ELBOW_PTP_EDITS } from '../medicare-ptp';
import { ProcedureFamilyModel } from '../model.types';
import { PROCEDURE_NAMES } from '../procedure-names';

const NURSEMAID_ELBOW_CODES = {
  RadialHeadSubluxationReduction: '24640',
} as const;
type NursemaidElbowCode = (typeof NURSEMAID_ELBOW_CODES)[keyof typeof NURSEMAID_ELBOW_CODES];

export const nursemaidElbowFamily: ProcedureFamilyModel<NursemaidElbowCode> = {
  codePairEdits: NURSEMAID_ELBOW_PTP_EDITS,
  id: 'nursemaid-elbow',
  procedureNames: PROCEDURE_NAMES['nursemaid-elbow'],
  displayName: "Nursemaid's elbow",
  fields: [
    {
      key: 'condition',
      label: 'Condition',
      kind: 'select',
      options: ['subluxation', 'true dislocation/fracture', 'other/unconfirmed'],
    },
  ],
  codes: Object.values(NURSEMAID_ELBOW_CODES),
  suggest: (facts) => {
    if (!facts.condition) return missing('Condition');

    return facts.condition === 'subluxation'
      ? buildEvaluation({
          suggestions: [
            {
              code: NURSEMAID_ELBOW_CODES.RadialHeadSubluxationReduction,
              display: "Reduction of nursemaid's elbow",
              justification: 'Subluxation reduced by manipulation.',
              units: 1,
              modifiers: [],
            },
          ],
        })
      : coder('The documented condition is not confirmed radial-head subluxation.');
  },
  dailyLimits: {
    [NURSEMAID_ELBOW_CODES.RadialHeadSubluxationReduction]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServicePolicy,
    },
  },
  documentationChecklist: () => [
    'Record mechanism, presentation and radial-head subluxation diagnosis with laterality; describe findings concerning for fracture/dislocation if present.',
    'Record manipulation technique, return of arm function, imaging if obtained and aftercare.',
  ],
};
