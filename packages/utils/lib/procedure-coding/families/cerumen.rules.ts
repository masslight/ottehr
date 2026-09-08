import { createCodeCatalog } from '../family-support';

export type CerumenMethod = 'instrumentation' | 'irrigation';

interface CerumenCodeRule {
  code: string;
  display: string;
  method: CerumenMethod;
}

export const CERUMEN_CODE_RULES = {
  irrigation: {
    code: '69209',
    display: 'Removal impacted cerumen using irrigation and/or lavage, unilateral',
    method: 'irrigation',
  },
  instrumentation: {
    code: '69210',
    display: 'Removal impacted cerumen requiring instrumentation, unilateral',
    method: 'instrumentation',
  },
} as const satisfies Record<CerumenMethod, CerumenCodeRule>;

export const CERUMEN_CODE_CATALOG = createCodeCatalog(CERUMEN_CODE_RULES);

export type CerumenCode = (typeof CERUMEN_CODE_CATALOG.codes)[number];

export function isCerumenRemovalCode(code: string): code is CerumenCode {
  return CERUMEN_CODE_CATALOG.has(code);
}
