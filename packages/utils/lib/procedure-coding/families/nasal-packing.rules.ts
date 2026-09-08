import { codeCandidateFrom } from '../family-support';

export const NASAL_PACKING_CODES = {
  anteriorSimple: '30901',
  anteriorComplex: '30903',
  posteriorInitial: '30905',
} as const;

export type NasalPackingCode = (typeof NASAL_PACKING_CODES)[keyof typeof NASAL_PACKING_CODES];

export const NASAL_PACKING_CODE_DISPLAYS = {
  [NASAL_PACKING_CODES.anteriorSimple]:
    'Control nasal hemorrhage, anterior, simple (limited cautery and/or packing) any method',
  [NASAL_PACKING_CODES.anteriorComplex]:
    'Control nasal hemorrhage, anterior, complex (extensive cautery and/or packing) any method',
  [NASAL_PACKING_CODES.posteriorInitial]:
    'Control nasal hemorrhage, posterior, with posterior nasal packs and/or cautery, any method; initial',
} as const satisfies Record<NasalPackingCode, string>;

export function isNasalPackingCode(code: string): code is NasalPackingCode {
  return code in NASAL_PACKING_CODE_DISPLAYS;
}

export const codeCandidate = codeCandidateFrom(NASAL_PACKING_CODE_DISPLAYS);
