import { createCodeCatalog } from '../family-support';
import type { IncisionDrainageOutOfScopeSite } from './incision-drainage.extract';

export const OUT_OF_SCOPE_SITE_CODING: Record<IncisionDrainageOutOfScopeSite, { label: string; codes: string }> = {
  pilonidal: {
    label: 'a pilonidal cyst or abscess',
    codes: '10080/10081 (incision and drainage of pilonidal cyst, simple or complicated)',
  },
  perianal: {
    label: 'a perianal, perirectal, or ischiorectal abscess',
    codes: '46050 (perianal, superficial) or 46060 (ischiorectal or intramural)',
  },
  'external-ear': {
    label: 'an external-ear abscess or hematoma',
    codes: '69000/69005 (drainage of external ear abscess or hematoma, simple or complicated)',
  },
  finger: {
    label: 'a finger abscess (a felon or paronychia is coded here too)',
    codes: '26010/26011 (drainage of finger abscess, simple or complicated)',
  },
  'hematoma-seroma': {
    label: 'a hematoma, seroma, or other fluid collection rather than an abscess',
    codes: '10140 (incision and drainage of hematoma, seroma, or fluid collection)',
  },
};

export const INCISION_DRAINAGE_CODES = {
  simpleOrSingle: { code: '10060', display: 'Incision and drainage of abscess; simple or single' },
  complicatedOrMultiple: {
    code: '10061',
    display: 'Incision and drainage of abscess; complicated or multiple',
  },
} as const;

export const INCISION_DRAINAGE_CODE_CATALOG = createCodeCatalog(INCISION_DRAINAGE_CODES);

export type IncisionDrainageCode = (typeof INCISION_DRAINAGE_CODE_CATALOG.codes)[number];

export function isIncisionDrainageCode(code: string): code is IncisionDrainageCode {
  return INCISION_DRAINAGE_CODE_CATALOG.has(code);
}

export const codeCandidate = INCISION_DRAINAGE_CODE_CATALOG.candidate;
