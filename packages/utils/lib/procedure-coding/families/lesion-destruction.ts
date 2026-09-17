/** Implements the cited rules using explicit form answers. Target code set: CPT 2026.
 * CMS NCCI 2026 Chapter III §E governs bundling. MAC A57482, Coding Information §1,
 * explicitly gives the 1–14 / 15+ lesion bands and one unit for either code.
 * https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleid=57482
 * https://www.cms.gov/files/document/03-chapter3-ncci-medicare-policy-manual-2026-final.pdf
 */
import { buildEvaluation, coder, missing, MueAdjudication } from '../cpt';
import { LESION_DESTRUCTION_PTP_EDITS } from '../medicare-ptp';
import { ProcedureFamilyModel } from '../model.types';
import { PROCEDURE_NAMES } from '../procedure-names';
import { CodingField, readNumber } from '../structured-fields';

const LESION_DESTRUCTION_CODES = {
  UpTo14BenignLesions: '17110',
  AtLeast15BenignLesions: '17111',
} as const;

type LesionDestructionCode = (typeof LESION_DESTRUCTION_CODES)[keyof typeof LESION_DESTRUCTION_CODES];

// CPT benign-lesion code boundary; a larger count selects one 17111 service, not more units.
const MULTIPLE_BENIGN_LESIONS_MIN_COUNT = 15;

const fields: readonly CodingField[] = [
  {
    key: 'category',
    label: 'Lesion category',
    kind: 'select',
    options: ['benign (excluding tags/vascular)', 'premalignant', 'malignant', 'vascular', 'anogenital', 'skin tags'],
  },
  { key: 'count', label: 'Lesion count', kind: 'number', defaultValue: 1, min: 0, step: 1 },
];

export const lesionDestructionFamily: ProcedureFamilyModel<LesionDestructionCode> = {
  codePairEdits: LESION_DESTRUCTION_PTP_EDITS,
  id: 'lesion-destruction',
  procedureNames: PROCEDURE_NAMES['lesion-destruction'],
  displayName: 'Lesion destruction',
  fields,
  codes: Object.values(LESION_DESTRUCTION_CODES),
  suggest: (facts) => {
    if (!facts.category) return missing('Lesion category');

    if (facts.category !== 'benign (excluding tags/vascular)')
      return coder('Use the code family for this lesion category.');

    const count = readNumber(facts, 'count');

    if (!count || !Number.isInteger(count)) return missing('Lesion count');

    // CMS MAC A57482, Coding Information §1 (link above): count selects the code; both use one unit.
    return buildEvaluation({
      suggestions: [
        {
          code:
            count < MULTIPLE_BENIGN_LESIONS_MIN_COUNT
              ? LESION_DESTRUCTION_CODES.UpTo14BenignLesions
              : LESION_DESTRUCTION_CODES.AtLeast15BenignLesions,
          display: 'Destruction of benign lesions',
          justification: `${count} benign lesions; one unit for the applicable count band.`,
          units: 1,
          modifiers: [],
        },
      ],
    });
  },
  dailyLimits: {
    [LESION_DESTRUCTION_CODES.UpTo14BenignLesions]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServicePolicy,
    },
    [LESION_DESTRUCTION_CODES.AtLeast15BenignLesions]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServicePolicy,
    },
  },
  // CMS MAC A57482: lesion type/count/site, destruction and medical necessity.
  // https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleid=57482
  documentationChecklist: () => [
    'Record lesion identity, exact count and sites, supporting the selected lesion category.',
    'Record treatment method, anesthesia if used, medical necessity (symptoms or functional impact), outcome and aftercare.',
  ],
};
