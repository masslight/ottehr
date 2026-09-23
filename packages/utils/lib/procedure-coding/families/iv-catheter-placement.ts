/** Standalone IV placement, target CPT 2026; CMS NCCI XI §B.4 (access bundled into administration).
 * https://www.cms.gov/files/document/11-chapter11a-ncci-medicare-policy-manual-2026-final.pdf
 * CMS MPFS RVU26A, PPRRVU2026_Jan_nonQPP, row 36000: status B (no separate Medicare payment).
 * https://www.cms.gov/files/zip/rvu26a.zip
 * Assuming that separately charted placement was the sole service is product policy, not a CMS rule.
 */
import { buildEvaluation, MueAdjudication } from '../cpt';
import { IV_CATHETER_PLACEMENT_PTP_EDITS } from '../medicare-ptp';
import { ProcedureFamilyModel } from '../model.types';
import { PROCEDURE_NAMES } from '../procedure-names';

const IV_CATHETER_PLACEMENT_CODES = {
  VenousAccess: '36000',
} as const;
type IvCatheterPlacementCode = (typeof IV_CATHETER_PLACEMENT_CODES)[keyof typeof IV_CATHETER_PLACEMENT_CODES];

// Customer procedure names, compared exactly. Wording never supplies clinical facts.
export const ivCatheterPlacementFamily: ProcedureFamilyModel<IvCatheterPlacementCode> = {
  codePairEdits: IV_CATHETER_PLACEMENT_PTP_EDITS,
  id: 'iv-catheter-placement',
  procedureNames: PROCEDURE_NAMES['iv-catheter-placement'],
  displayName: 'IV catheter placement',
  fields: [],
  codes: Object.values(IV_CATHETER_PLACEMENT_CODES),
  suggest: () =>
    // Product scope: independently charted placement asserts standalone service. CMS bundling still applies.
    buildEvaluation({
      suggestions: [
        {
          code: IV_CATHETER_PLACEMENT_CODES.VenousAccess,
          display: 'Introduction of needle or intracatheter',
          justification: 'Standalone venous access documented.',
          units: 1,
          modifiers: [],
        },
      ],
      findings: [],
      payerNotes: ['Medicare does not separately pay 36000. Access used for an infusion is included in that service.'],
    }),
  dailyLimits: {
    [IV_CATHETER_PLACEMENT_CODES.VenousAccess]: {
      maxUnits: 4,
      adjudicationIndicator: MueAdjudication.DateOfServiceClinical,
    },
  },
  // NCCI XI §B.4 includes access in administration services; the standalone-use reminder prevents double billing.
  // https://www.cms.gov/files/document/11-chapter11a-ncci-medicare-policy-manual-2026-final.pdf
  documentationChecklist: () => [
    'Record access indication, site/vein, catheter gauge and disposition.',
    'Standalone access coding requires that no infusion, injection or other procedure followed using that access.',
  ],
};
