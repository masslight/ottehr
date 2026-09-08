import { createCodeCatalog } from '../family-support';
import type { UrinaryCatheterType } from './urinary-catheterization.extract';

interface UrinaryCatheterCodeInfo {
  code: string;
  type: UrinaryCatheterType;
  display: string;
  coverage: string;
}

export const URINARY_CATHETER_RULES = {
  straight: {
    code: '51701',
    type: 'straight',
    display: 'Insertion of non-indwelling bladder catheter (eg, straight catheterization for residual urine)',
    coverage: 'a straight (in-and-out) catheterization',
  },
  indwelling: {
    code: '51702',
    type: 'indwelling',
    display: 'Insertion of temporary indwelling bladder catheter; simple (eg, Foley)',
    coverage: 'an indwelling (eg, Foley) catheter insertion',
  },
} as const satisfies Record<UrinaryCatheterType, UrinaryCatheterCodeInfo>;

export const URINARY_CATHETER_CODE_CATALOG = createCodeCatalog(URINARY_CATHETER_RULES);

export type UrinaryCatheterCode = (typeof URINARY_CATHETER_CODE_CATALOG.codes)[number];

export function isUrinaryCatheterizationCode(code: string): code is UrinaryCatheterCode {
  return URINARY_CATHETER_CODE_CATALOG.has(code);
}
