/** Implements the cited rules using explicit form answers. Target code set: CPT 2026.
 * CMS NCCI VIII §D.22 confirms ipsilateral eye bundling; it does not specify the complete site/code map.
 * CMS MPFS RVU26A corroborates code identities and bilateral indicators.
 * https://www.cms.gov/files/zip/rvu26a.zip
 * AAO guidance below could not be retrieved during the 2026-09-11 audit; it is not claimed as verified.
 * https://www.cms.gov/files/document/08-chapter8-ncci-medicare-policy-manual-2026-final.pdf
 * https://www.aao.org/practice-management/news-detail/office-visit-with-corneal-foreign-body-removal
 */
import { buildEvaluation, coder, lateralityModifiers, missing, MueAdjudication, noCode } from '../cpt';
import { FOREIGN_BODY_PTP_EDITS } from '../medicare-ptp';
import { LegacyProcedureFields, ProcedureFamilyModel } from '../model.types';
import { PROCEDURE_NAMES } from '../procedure-names';
import { CodingField, readNumber, selectedSide } from '../structured-fields';

const FOREIGN_BODY_CODES = {
  SimpleSubcutaneousRemoval: '10120',
  ComplicatedSubcutaneousRemoval: '10121',
  IntranasalRemoval: '30300',
  EarCanalRemoval: '69200',
  EarCanalRemovalUnderGeneralAnesthesia: '69205',
  SuperficialConjunctivalRemoval: '65205',
  EmbeddedConjunctivalRemoval: '65210',
  CornealRemovalWithoutSlitLamp: '65220',
  CornealRemovalWithSlitLamp: '65222',
} as const;

type ForeignBodyCode = (typeof FOREIGN_BODY_CODES)[keyof typeof FOREIGN_BODY_CODES];

const fields: CodingField[] = [
  {
    key: 'site',
    label: 'Foreign body location',
    kind: 'select',
    options: [
      'skin/subcutaneous',
      'nose',
      'ear',
      'cornea',
      'superficial conjunctiva',
      'embedded conjunctiva',
      'deeper tissue',
    ],
  },
  {
    key: 'incision',
    label: 'Incision required',
    kind: 'checkbox',
    defaultValue: false,
    visible: (facts) => facts.site === 'skin/subcutaneous',
  },
  {
    key: 'infected',
    label: 'Infected wound',
    kind: 'checkbox',
    defaultValue: false,
    visible: (facts) => facts.site === 'skin/subcutaneous',
  },
  {
    key: 'scarring',
    label: 'Delayed presentation with scarring/dissection',
    kind: 'checkbox',
    defaultValue: false,
    visible: (facts) => facts.site === 'skin/subcutaneous',
  },
  {
    key: 'exploration',
    label: 'Extended exploration or tissue removal',
    kind: 'checkbox',
    defaultValue: false,
    visible: (facts) => facts.site === 'skin/subcutaneous',
  },
  {
    key: 'generalAnesthesia',
    label: 'General anesthesia',
    kind: 'checkbox',
    defaultValue: false,
    visible: (facts) => facts.site === 'ear',
  },
  {
    key: 'slitLamp',
    label: 'Slit lamp used',
    kind: 'checkbox',
    defaultValue: false,
    visible: (facts) => facts.site === 'cornea',
  },
  { key: 'side', label: 'Side', kind: 'select', options: ['left', 'right', 'both'], defaultValue: undefined },
  {
    key: 'count',
    label: 'Distinct removals',
    kind: 'number',
    defaultValue: 1,
    min: 0,
    step: 1,
    visible: (facts) => facts.site === 'skin/subcutaneous',
  },
];

export const foreignBodyFamily: ProcedureFamilyModel<ForeignBodyCode> = {
  codePairEdits: FOREIGN_BODY_PTP_EDITS,
  capturesSite: true,
  capturesSide: true,
  id: 'foreign-body',
  procedureNames: PROCEDURE_NAMES['foreign-body'],
  displayName: 'Foreign body removal',
  fields,
  codes: Object.values(FOREIGN_BODY_CODES),
  suggest: (facts) => {
    if (!facts.site) return missing('Foreign body location');
    if (facts.site === 'deeper tissue') return coder('Removal from deeper tissues uses a different code family.');

    let cpt: ForeignBodyCode;

    if (facts.site === 'skin/subcutaneous') {
      if (!facts.incision)
        return noCode('Non-incisional skin foreign-body removal has no separate code in this family.');

      // Adopted product interpretation: these complexity criteria are not defined by a CMS national rule.
      cpt =
        facts.infected || facts.scarring || facts.exploration
          ? FOREIGN_BODY_CODES.ComplicatedSubcutaneousRemoval
          : FOREIGN_BODY_CODES.SimpleSubcutaneousRemoval;
    } else if (facts.site === 'nose') cpt = FOREIGN_BODY_CODES.IntranasalRemoval;
    // CPT 69205 describes removal from the external auditory canal with general anesthesia.
    else if (facts.site === 'ear')
      cpt = facts.generalAnesthesia
        ? FOREIGN_BODY_CODES.EarCanalRemovalUnderGeneralAnesthesia
        : FOREIGN_BODY_CODES.EarCanalRemoval;
    else if (facts.site === 'cornea')
      cpt = facts.slitLamp
        ? FOREIGN_BODY_CODES.CornealRemovalWithSlitLamp
        : FOREIGN_BODY_CODES.CornealRemovalWithoutSlitLamp;
    else
      cpt =
        facts.site === 'superficial conjunctiva'
          ? FOREIGN_BODY_CODES.SuperficialConjunctivalRemoval
          : FOREIGN_BODY_CODES.EmbeddedConjunctivalRemoval;

    // CPT site codes count the treated organ, not objects within it; skin codes count separate incisions.
    const count = facts.site === 'skin/subcutaneous' ? readNumber(facts, 'count') : 1;
    if (!count || !Number.isInteger(count)) return missing('Distinct removals');
    if (!['skin/subcutaneous', 'nose', 'deeper tissue'].includes(String(facts.site)) && !facts.side)
      return missing('Side');

    return buildEvaluation({
      suggestions: [
        {
          code: cpt,
          display: 'Removal of foreign body',
          justification: 'Location, approach and complexity documented.',
          units: count,
          modifiers: ['skin/subcutaneous', 'nose'].includes(String(facts.site)) ? [] : lateralityModifiers(facts.side),
        },
      ],
    });
  },
  dailyLimits: {
    [FOREIGN_BODY_CODES.SimpleSubcutaneousRemoval]: {
      maxUnits: 3,
      adjudicationIndicator: MueAdjudication.DateOfServiceClinical,
    },
    [FOREIGN_BODY_CODES.ComplicatedSubcutaneousRemoval]: {
      maxUnits: 2,
      adjudicationIndicator: MueAdjudication.DateOfServiceClinical,
    },
    [FOREIGN_BODY_CODES.IntranasalRemoval]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServiceClinical,
    },
    [FOREIGN_BODY_CODES.SuperficialConjunctivalRemoval]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServiceClinical,
    },
    [FOREIGN_BODY_CODES.EmbeddedConjunctivalRemoval]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServiceClinical,
    },
    [FOREIGN_BODY_CODES.CornealRemovalWithoutSlitLamp]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServiceClinical,
    },
    [FOREIGN_BODY_CODES.CornealRemovalWithSlitLamp]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServiceClinical,
    },
    [FOREIGN_BODY_CODES.EarCanalRemoval]: { maxUnits: 1, adjudicationIndicator: MueAdjudication.DateOfServicePolicy },
    [FOREIGN_BODY_CODES.EarCanalRemovalUnderGeneralAnesthesia]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServiceClinical,
    },
  },
  documentationChecklist: (facts) => {
    const checklist = [
      'Record object, site/side, visualization, instruments, anesthesia, removal result and post-removal examination.',
    ];
    if (facts.site === 'skin/subcutaneous')
      checklist.push(
        'Describe the incision and subcutaneous depth, retrieval and wound disposition; document each separate incision when billing multiple removals.',
        'Describe infection, scar-related difficulty or extended exploration/tissue removal when present.'
      );
    if (facts.site === 'cornea' || facts.site === 'superficial conjunctiva' || facts.site === 'embedded conjunctiva')
      checklist.push(
        'Record visual acuity, anterior-segment findings and post-removal examination; name slit-lamp use when applicable.'
      );
    if (facts.site === 'ear') checklist.push('Record the post-removal ear-canal and tympanic-membrane examination.');
    checklist.push('Review tetanus status in the immunization record when relevant to the wound.');
    return checklist;
  },
  readLegacyFacts: (input: LegacyProcedureFields) => ({
    site: input.bodySite === 'Ear' ? 'ear' : input.bodySite === 'Nose' ? 'nose' : undefined,
    side: selectedSide(input),
    slitLamp: input.technique?.includes('Slit Lamp') ?? false,
  }),
};
