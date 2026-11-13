/** IV catheter removal note. Product scope, not a CMS rule: removal is charted for the record and never
 * suggests a code, so the fluid times here have no billing effect (hydration is coded in injection-infusion).
 * The tip-intact reminder is a documentation cue; it does not prevent saving.
 */
import { noCode } from '../cpt';
import { ENTRY_SCOPE, NOTHING_TO_CITE, ProcedureFamilyModel } from '../model.types';
import { PROCEDURE_NAMES } from '../procedure-names';
import { CodingField } from '../structured-fields';

const SITE_CLEAR = 'Clear, no signs of infection/phlebitis';
const TIME_KEYS = ['insertionTime', 'fluidStart', 'fluidStop', 'removalTime'];

const fields: CodingField[] = [
  { key: 'insertionTime', label: 'Catheter insertion time', kind: 'time' },
  { key: 'fluidStart', label: 'Fluid start time', kind: 'time' },
  { key: 'fluidStop', label: 'Fluid end time', kind: 'time' },
  { key: 'removalTime', label: 'Catheter removal time', kind: 'time' },
  { key: 'gauge', label: 'Catheter gauge', kind: 'select', options: ['14G', '16G', '18G', '20G', '22G', '24G'] },
  { key: 'attempts', label: 'Insertion attempts', kind: 'number', min: 1, step: 1 },
  {
    key: 'removalReason',
    label: 'Reason for removal',
    kind: 'select',
    options: ['Completed', 'Infiltration', 'Phlebitis', 'Occlusion', 'Dislodgement', 'Patient request', 'Other'],
  },
  { key: 'tipIntact', label: 'Catheter tip intact', kind: 'checkbox', neededForCoding: true },
  {
    key: 'siteCondition',
    label: 'Site condition',
    kind: 'multi',
    options: [SITE_CLEAR, 'Redness', 'Swelling', 'Tenderness', 'Drainage', 'Bruising'],
    exclusive: SITE_CLEAR,
  },
];

export const ivCatheterRemovalFamily: ProcedureFamilyModel = {
  id: 'iv-catheter-removal',
  procedureNames: PROCEDURE_NAMES['iv-catheter-removal'],
  displayName: 'IV catheter removal',
  fields,
  codes: [],
  quickPickExcludes: TIME_KEYS,
  suggest: (facts) => {
    const evaluation = noCode('IV catheter removal is not reported separately.');
    if (facts.tipIntact === undefined)
      evaluation.findings.push({
        level: 'bestPractice',
        scope: ENTRY_SCOPE,
        evidence: NOTHING_TO_CITE,
        message: 'Record whether the catheter tip was intact.',
      });
    return evaluation;
  },
};
