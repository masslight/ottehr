/** Implements the cited rules using explicit form answers. Target code set: CPT 2026.
 * CMS NCCI 2026 Chapter III §D; NGS A56766 documentation requirements:
 * https://www.cms.gov/files/document/03-chapter3-ncci-medicare-policy-manual-2026-final.pdf
 * https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleId=56766
 */
import { buildEvaluation, coder, missing, MueAdjudication, noCode } from '../cpt';
import { INCISION_DRAINAGE_PTP_EDITS } from '../medicare-ptp';
import { ProcedureFamilyModel } from '../model.types';
import { PROCEDURE_NAMES } from '../procedure-names';
import { CodingField, readNumber } from '../structured-fields';

const INCISION_DRAINAGE_CODES = {
  SimpleAbscess: '10060',
  ComplicatedOrMultipleAbscesses: '10061',
  HematomaOrSeroma: '10140',
  NeedleAspiration: '10160',
  ComplexPostoperativeInfection: '10180',
} as const;

type IncisionDrainageCode = (typeof INCISION_DRAINAGE_CODES)[keyof typeof INCISION_DRAINAGE_CODES];

const fields: readonly CodingField[] = [
  {
    key: 'collection',
    label: 'Collection type',
    kind: 'select',
    options: ['abscess', 'hematoma/seroma', 'postoperative infection', 'bulla', 'pilonidal cyst'],
  },
  { key: 'method', label: 'Drainage method', kind: 'select', options: ['incision', 'needle'], defaultValue: undefined },
  { key: 'count', label: 'Distinct collections', kind: 'number', defaultValue: 1, min: 0, step: 1 },
  {
    key: 'sameSiteProcedure',
    label: 'Drainage included in another same-site procedure',
    kind: 'checkbox',
    defaultValue: false,
  },
  {
    key: 'packing',
    label: 'Packing',
    kind: 'checkbox',
    defaultValue: false,
    visible: (facts) => facts.method === 'incision',
  },
  {
    key: 'drain',
    label: 'Drain placed',
    kind: 'checkbox',
    defaultValue: false,
    visible: (facts) => facts.method === 'incision',
  },
  {
    key: 'multipleIncisions',
    label: 'Multiple incisions',
    kind: 'checkbox',
    defaultValue: false,
    visible: (facts) => facts.method === 'incision',
  },
  {
    key: 'loculations',
    label: 'Loculation probing',
    kind: 'checkbox',
    defaultValue: false,
    visible: (facts) => facts.method === 'incision',
  },
  {
    key: 'excision',
    label: 'Tissue excision or closure',
    kind: 'checkbox',
    defaultValue: false,
    visible: (facts) => facts.method === 'incision',
  },
];

export const incisionDrainageFamily: ProcedureFamilyModel<IncisionDrainageCode> = {
  codePairEdits: INCISION_DRAINAGE_PTP_EDITS,
  id: 'incision-drainage',
  procedureNames: PROCEDURE_NAMES['incision-drainage'],
  displayName: 'Incision and drainage',
  fields,
  codes: Object.values(INCISION_DRAINAGE_CODES),
  suggest: (facts) => {
    // Pilonidal disease has its own incision-and-drainage codes outside this family.
    if (facts.collection === 'pilonidal cyst') return coder('This collection type needs a different procedure code.');

    if (facts.sameSiteProcedure) return noCode('Drainage is included in the other same-site procedure.');

    const missingFields: string[] = [];

    if (!facts.collection) missingFields.push('Collection type');
    if (!facts.method) missingFields.push('Drainage method');
    if (missingFields.length) return missing(...missingFields);

    // CPT 10160 is "Puncture aspiration of abscess, hematoma, bulla, or cyst", so a needle-drained
    // bulla is coded by the aspiration branch below. Incision of a bulla has no code in this family.
    if (facts.collection === 'bulla' && facts.method !== 'needle')
      return coder('Incision of this collection type needs a different procedure code.');

    const count = readNumber(facts, 'count');

    if (!count || !Number.isInteger(count)) return missing('Distinct collections');

    // Per-collection quantity is an adopted product interpretation; CMS does not define this unit here.
    if (facts.method === 'needle')
      return buildEvaluation({
        suggestions: [
          {
            code: INCISION_DRAINAGE_CODES.NeedleAspiration,
            display: 'Puncture aspiration',
            justification: 'Needle aspiration of distinct collections.',
            units: count,
            modifiers: [],
          },
        ],
      });
    if (facts.collection === 'hematoma/seroma')
      return buildEvaluation({
        suggestions: [
          {
            code: INCISION_DRAINAGE_CODES.HematomaOrSeroma,
            display: 'Drainage of hematoma or seroma',
            justification: 'Incision and drainage of distinct collections.',
            units: count,
            modifiers: [],
          },
        ],
      });

    // Product policy, NOT a CMS definition: the five documented complexity criteria adopted by the owner.
    const complicated = facts.packing || facts.drain || facts.multipleIncisions || facts.loculations || facts.excision;

    if (facts.collection === 'postoperative infection')
      return complicated
        ? buildEvaluation({
            suggestions: [
              {
                code: INCISION_DRAINAGE_CODES.ComplexPostoperativeInfection,
                display: 'Complex drainage of postoperative wound infection',
                justification: 'Prior surgical wound infection with documented complex work.',
                units: count,
                modifiers: [],
              },
            ],
          })
        : coder('Complex drainage work is not documented for this postoperative wound infection.');
    return buildEvaluation({
      suggestions: [
        {
          code:
            complicated || count > 1
              ? INCISION_DRAINAGE_CODES.ComplicatedOrMultipleAbscesses
              : INCISION_DRAINAGE_CODES.SimpleAbscess,
          display: 'Incision and drainage of abscess',
          justification: complicated || count > 1 ? 'Multiple or complicated drainage.' : 'Single simple drainage.',
          units: 1,
          modifiers: [],
        },
      ],
    });
  },
  dailyLimits: {
    [INCISION_DRAINAGE_CODES.SimpleAbscess]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServicePolicy,
    },
    [INCISION_DRAINAGE_CODES.ComplicatedOrMultipleAbscesses]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServicePolicy,
    },
    [INCISION_DRAINAGE_CODES.HematomaOrSeroma]: {
      maxUnits: 2,
      adjudicationIndicator: MueAdjudication.DateOfServiceClinical,
    },
    [INCISION_DRAINAGE_CODES.NeedleAspiration]: {
      maxUnits: 3,
      adjudicationIndicator: MueAdjudication.DateOfServiceClinical,
    },
    [INCISION_DRAINAGE_CODES.ComplexPostoperativeInfection]: {
      maxUnits: 2,
      adjudicationIndicator: MueAdjudication.DateOfServiceClinical,
    },
  },
  // NGS A56766, Documentation Requirements: pretreatment lesion description, drainage amount/character and necessity.
  // https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleId=56766
  documentationChecklist: (facts) => {
    const checklist = [
      'Record each collection’s site, depth, size and appearance before drainage, and the amount/character of drained material.',
      'Record anesthesia, drainage technique, culture if obtained, wound disposition (open, packed, drain or closure), outcome and aftercare.',
    ];
    if (facts.method === 'needle')
      checklist.push(
        'Document the needle approach, aspirated volume and each distinct collection when billing multiple units.'
      );
    else if (facts.collection === 'hematoma/seroma')
      checklist.push(
        'State the reason drainage was necessary, such as pain, infection or unsuccessful conservative treatment.'
      );
    else
      checklist.push(
        'Describe each complicating step actually performed and each separate lesion, rather than only writing “complicated”.'
      );
    if (facts.collection === 'postoperative infection')
      checklist.push('Identify the prior surgical wound and date, postoperative infection, and complex drainage work.');
    checklist.push('For repeat drainage, document recurrence and the reason another procedure was necessary.');
    return checklist;
  },
};
