/** Nebulizer treatment, target CPT 2026; CMS NCCI XI §J.7–8, pp. XI-19–20.
 * https://www.cms.gov/files/document/11-chapter11a-ncci-medicare-policy-manual-2026-final.pdf
 * These paragraphs define the 94060 exclusion, one 94640 per episode, repeat-episode modifier 76,
 * and the continuous-treatment-over-one-hour pathway. Acute obstruction is a product default.
 */
import { buildEvaluation, coder, CPT_MODIFIERS, missing, MueAdjudication, noCode } from '../cpt';
import { NEBULIZER_PTP_EDITS } from '../medicare-ptp';
import { CodeSuggestion, ProcedureFamilyModel } from '../model.types';
import { PROCEDURE_NAMES } from '../procedure-names';
import { readNumber } from '../structured-fields';

const NEBULIZER_CODES = {
  InhalationTreatment: '94640',
} as const;

type NebulizerCode = (typeof NEBULIZER_CODES)[keyof typeof NEBULIZER_CODES];

export const nebulizerFamily: ProcedureFamilyModel<NebulizerCode> = {
  codePairEdits: NEBULIZER_PTP_EDITS,
  id: 'nebulizer',
  procedureNames: PROCEDURE_NAMES['nebulizer'],
  displayName: 'Nebulizer',
  fields: [
    {
      key: 'context',
      label: 'Treatment context',
      kind: 'select',
      options: ['acute obstruction', 'sputum induction', 'bronchodilation testing', 'no treatment'],
      defaultValue: 'acute obstruction',
    },
    { key: 'overHour', label: 'Continuous treatment over one hour', kind: 'checkbox', defaultValue: false },
    { key: 'count', label: 'Episodes of care', kind: 'number', defaultValue: 1, min: 0, step: 1 },
  ],
  codes: Object.values(NEBULIZER_CODES),
  suggest: (facts) => {
    if (facts.context === 'no treatment') return noCode('No inhalation treatment documented.');

    if (facts.overHour) return coder('Continuous inhalation treatment lasting over one hour is coded separately.');

    if (facts.context === 'bronchodilation testing')
      return noCode('Administration is included in bronchodilation testing.');

    const count = readNumber(facts, 'count');

    if (!count || !Number.isInteger(count)) return missing('Episodes of care');

    // NCCI XI pulmonary services: count episodes, not repeated treatments within one episode.
    const suggestions: CodeSuggestion[] = [];

    suggestions.push({
      code: NEBULIZER_CODES.InhalationTreatment,
      display: 'Inhalation treatment',
      justification: 'First episode.',
      units: 1,
      modifiers: [],
    });

    if (count > 1) {
      suggestions.push({
        code: NEBULIZER_CODES.InhalationTreatment,
        display: 'Inhalation treatment',
        justification: 'Separate repeat episodes.',
        units: count - 1,
        modifiers: [CPT_MODIFIERS.RepeatSameClinician],
      });
    }

    return buildEvaluation({ suggestions });
  },
  dailyLimits: {
    [NEBULIZER_CODES.InhalationTreatment]: {
      maxUnits: 4,
      adjudicationIndicator: MueAdjudication.DateOfServiceClinical,
    },
  },
  // NCCI XI §J.7–8 distinguishes back-to-back treatments from separate episodes. Clinical response is a documentation reminder.
  // https://www.cms.gov/files/document/11-chapter11a-ncci-medicare-policy-manual-2026-final.pdf
  documentationChecklist: (facts) => [
    'Record indication, drug/dose/device, treatment times, administering clinician and applicable supervision.',
    'Record pre/post-treatment respiratory findings, oxygen saturation when measured, response and aftercare.',
    ...((readNumber(facts, 'count') ?? 1) > 1
      ? ['Record departure/return times for separate episodes; back-to-back treatments in one episode count once.']
      : []),
  ],
};
