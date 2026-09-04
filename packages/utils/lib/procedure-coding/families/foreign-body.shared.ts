import { joinWithOr, TO_DETAILS, whereClauseFor } from '../family-support';
import { WhereToDocument } from '../model.types';
import {
  EyeStructure,
  FOREIGN_BODY_COMPLICATION_ELEMENT_PATTERNS,
  ForeignBodyComplicationElement,
  ForeignBodyFacts,
  ForeignBodySite,
} from './foreign-body.extract';
import { FOREIGN_BODY_CODES, FOREIGN_BODY_OUT_OF_SCOPE_CODES } from './foreign-body.rules';

export type { EyeStructure, ForeignBodyComplicationElement, ForeignBodyFacts, ForeignBodySite };

export const COMPLICATION_ELEMENT_LABELS: Record<ForeignBodyComplicationElement, string> = {
  'deep-dissection': 'deep dissection',
  'multiple-foreign-bodies': 'multiple foreign bodies',
  'imaging-localization': 'imaging-assisted localization',
  'stated-complicated': 'an explicitly complicated removal',
};

export const COMPLICATION_ELEMENT_MENU = joinWithOr(
  FOREIGN_BODY_COMPLICATION_ELEMENT_PATTERNS.map(([element]) => COMPLICATION_ELEMENT_LABELS[element])
);

export const WHERE_TO_DOCUMENT = {
  site: { destination: 'in the Site/location field' },
  laterality: { destination: 'in the Side of body field' },
  incision: { destination: TO_DETAILS, example: '"#11 blade stab incision over the foreign body"' },
  complicated: {
    destination: TO_DETAILS,
    example:
      '"deep dissection through subcutaneous tissue to reach the fragment" or "multiple foreign bodies localized by ultrasound"',
  },
  slitLamp: { destination: TO_DETAILS, example: '"corneal foreign body removed at the slit lamp with a burr"' },
  eyeStructure: {
    destination: TO_DETAILS,
    example: '"foreign body on the cornea" or "foreign body on the conjunctiva"',
  },
  description: { destination: TO_DETAILS, example: '"3 mm wooden splinter"' },
  outcome: { destination: TO_DETAILS, example: '"foreign body removed completely intact"' },
  postSkin: { destination: TO_DETAILS, example: '"hemostasis achieved"' },
  postEye: { destination: TO_DETAILS, example: '"fluorescein exam: no residual uptake"' },
  postEar: { destination: TO_DETAILS, example: '"canal without abrasion; TM intact"' },
  size: { destination: 'in the Wound/lesion size (cm) field' },
  anesthesia: {
    destination: 'in the Anaesthesia / medication used field',
    example: '"1% lidocaine" or "topical tetracaine"',
  },
} satisfies Record<string, WhereToDocument>;

export const whereClause = whereClauseFor(WHERE_TO_DOCUMENT);

export const SITE_ASK_CLAUSE =
  'which foreign-body removal code applies depends on where the foreign body was (skin/soft tissue, nose, eye, or ear canal)';

export type GeneralAnesthesiaOfficeCode =
  | typeof FOREIGN_BODY_CODES.intranasalOffice
  | typeof FOREIGN_BODY_CODES.earCanalWithoutGeneralAnesthesia;

export const GENERAL_ANESTHESIA_CONTRADICTIONS = {
  [FOREIGN_BODY_CODES.intranasalOffice]:
    '30300 is the office-type intranasal foreign-body removal, but the note documents general anesthesia or procedural sedation — removal under general anesthesia is 30310, which this model does not assess. Topical or local anesthesia is expected with 30300 and does not affect it.',
  [FOREIGN_BODY_CODES.earCanalWithoutGeneralAnesthesia]:
    '69200 is removal of a foreign body from the ear canal without general anesthesia, but the note documents general anesthesia or procedural sedation — removal under general anesthesia is 69205, which this model does not assess. Topical or local anesthesia is expected with 69200 and does not affect it.',
} as const satisfies Record<GeneralAnesthesiaOfficeCode, string>;

export const GENERAL_ANESTHESIA_ALTERNATIVES = {
  [FOREIGN_BODY_CODES.intranasalOffice]: FOREIGN_BODY_OUT_OF_SCOPE_CODES.intranasalUnderGeneralAnesthesia,
  [FOREIGN_BODY_CODES.earCanalWithoutGeneralAnesthesia]: FOREIGN_BODY_OUT_OF_SCOPE_CODES.earCanalUnderGeneralAnesthesia,
} as const satisfies Record<GeneralAnesthesiaOfficeCode, string>;

export const NON_CORNEAL_EYE_CODING: Record<Exclude<EyeStructure, 'cornea'>, { label: string; codes: string }> = {
  conjunctiva: { label: 'conjunctival', codes: '65205/65210' },
  eyelid: { label: 'eyelid', codes: '67938 if it is embedded, otherwise 65205/65210' },
};

export function nonCornealEyeMessage(structure: Exclude<EyeStructure, 'cornea'>, subject = '65220 and 65222'): string {
  const { label, codes } = NON_CORNEAL_EYE_CODING[structure];
  const verb = subject.includes(' and ') ? 'cover' : 'covers';
  return `The note documents a ${label} foreign body, not a corneal one — ${subject} ${verb} corneal removal only, and ${label} removal (${codes}) is outside this model's scope; not assessed.`;
}

export const EYE_STRUCTURE_ASK_CLAUSE =
  '65220 and 65222 cover the cornea only, so which code applies depends first on which structure the foreign body was on — conjunctival (65205/65210) and eyelid (67938) removals are coded separately and are not assessed here';

export const EYE_SLIT_LAMP_ASK_CLAUSE =
  'whether a slit lamp was used selects 65222 (with slit lamp) or 65220 (without slit lamp)';
