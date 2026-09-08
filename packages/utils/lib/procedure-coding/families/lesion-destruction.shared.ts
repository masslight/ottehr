import { TO_DETAILS, whereClauseFor } from '../family-support';
import { WhereToDocument } from '../model.types';
import { EXCLUDED_LESION_INFO, ExcludedLesionType, LesionDestructionFacts } from './lesion-destruction.extract';

export type { ExcludedLesionType, LesionDestructionFacts };

export const COUNT_ASK_CLAUSE =
  'the number of lesions treated selects the code (17110 covers up to 14 lesions; 17111 is 15 or more)';

export const BOTH_CODES = '17110/17111';

export const WHERE_TO_DOCUMENT = {
  count: { destination: TO_DETAILS, example: '"12 warts treated with liquid nitrogen"' },
  method: { destination: TO_DETAILS, example: '"liquid nitrogen applied to each lesion, two freeze-thaw cycles"' },
  locations: { destination: 'in the Site/location field, or describe the treated locations in Procedure details' },
  laterality: { destination: 'in the Side of body field' },
  lesionType: { destination: TO_DETAILS, example: '"6 verrucae destroyed with liquid nitrogen"' },
  anesthesia: { destination: 'in the Anaesthesia / medication used field', example: '"topical lidocaine"' },
} satisfies Record<string, WhereToDocument>;

export const whereClause = whereClauseFor(WHERE_TO_DOCUMENT);

export function excludedLesionMessage(type: ExcludedLesionType, subject: string): string {
  const info = EXCLUDED_LESION_INFO[type];
  return `${subject} — ${BOTH_CODES} cover destruction of benign lesions other than skin tags or cutaneous vascular proliferative lesions, and the note documents ${
    info.label
  }, which is reported with ${info.codes} (outside this model's scope; not assessed). ${whereClause(
    'lesionType',
    'If other benign lesions were also destroyed, record them and their own count'
  )}`;
}

export function implausibleCountMessage(subject: string, count: number): string {
  return `The documented lesion count (${count})${subject} is not a plausible number of lesions destroyed in one session, so it is not read as the count — ${COUNT_ASK_CLAUSE}. ${whereClause(
    'count',
    'Re-record the count'
  )}`;
}

export function countAskMessage(subject: string): string {
  return `The number of lesions treated is not documented${subject} — ${COUNT_ASK_CLAUSE}. ${whereClause('count')}`;
}
