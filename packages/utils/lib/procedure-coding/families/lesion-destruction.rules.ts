import { codeCandidateFrom } from '../family-support';

export const LESION_COUNT_BOUNDARY = 14;

export const LESION_DESTRUCTION_CODES = {
  upToBoundary: '17110',
  overBoundary: '17111',
} as const;

export type LesionDestructionCode = (typeof LESION_DESTRUCTION_CODES)[keyof typeof LESION_DESTRUCTION_CODES];

export const LESION_DESTRUCTION_CODE_DISPLAYS = {
  [LESION_DESTRUCTION_CODES.upToBoundary]:
    'Destruction (eg, laser surgery, electrosurgery, cryosurgery, chemosurgery, surgical curettement), of benign lesions other than skin tags or cutaneous vascular proliferative lesions; up to 14 lesions',
  [LESION_DESTRUCTION_CODES.overBoundary]:
    'Destruction (eg, laser surgery, electrosurgery, cryosurgery, chemosurgery, surgical curettement), of benign lesions other than skin tags or cutaneous vascular proliferative lesions; 15 or more lesions',
} as const satisfies Record<LesionDestructionCode, string>;

export function isLesionDestructionCode(code: string): code is LesionDestructionCode {
  return code in LESION_DESTRUCTION_CODE_DISPLAYS;
}

export const codeCandidate = codeCandidateFrom(LESION_DESTRUCTION_CODE_DISPLAYS);

export function codeForCount(count: number): LesionDestructionCode {
  return count <= LESION_COUNT_BOUNDARY ? LESION_DESTRUCTION_CODES.upToBoundary : LESION_DESTRUCTION_CODES.overBoundary;
}
