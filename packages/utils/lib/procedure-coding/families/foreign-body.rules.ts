import { codeCandidateFromInfo } from '../family-support';
import { CodeCandidate } from '../model.types';
import type { ForeignBodySite } from './foreign-body.extract';

export interface ForeignBodyCodeInfo {
  site: ForeignBodySite;
  display: string;
  coverage: string;
}

export const FOREIGN_BODY_CODES = {
  skinSimple: '10120',
  skinComplicated: '10121',
  intranasalOffice: '30300',
  cornealWithoutSlitLamp: '65220',
  cornealWithSlitLamp: '65222',
  earCanalWithoutGeneralAnesthesia: '69200',
} as const;

export const FOREIGN_BODY_OUT_OF_SCOPE_CODES = {
  intranasalUnderGeneralAnesthesia: '30310',
  earCanalUnderGeneralAnesthesia: '69205',
} as const;

export type ForeignBodyCode = (typeof FOREIGN_BODY_CODES)[keyof typeof FOREIGN_BODY_CODES];

export const FOREIGN_BODY_CODE_INFO = {
  [FOREIGN_BODY_CODES.skinSimple]: {
    site: 'skin',
    display: 'Incision and removal of foreign body, subcutaneous tissues; simple',
    coverage: 'removal of a foreign body from the skin/subcutaneous tissues by incision',
  },
  [FOREIGN_BODY_CODES.skinComplicated]: {
    site: 'skin',
    display: 'Incision and removal of foreign body, subcutaneous tissues; complicated',
    coverage: 'removal of a foreign body from the skin/subcutaneous tissues by incision',
  },
  [FOREIGN_BODY_CODES.intranasalOffice]: {
    site: 'nose',
    display: 'Removal foreign body, intranasal; office type procedure',
    coverage: 'removal of an intranasal foreign body',
  },
  [FOREIGN_BODY_CODES.cornealWithoutSlitLamp]: {
    site: 'eye',
    display: 'Removal of foreign body, external eye; corneal, without slit lamp',
    coverage: 'removal of a corneal foreign body without a slit lamp',
  },
  [FOREIGN_BODY_CODES.cornealWithSlitLamp]: {
    site: 'eye',
    display: 'Removal of foreign body, external eye; corneal, with slit lamp',
    coverage: 'removal of a corneal foreign body',
  },
  [FOREIGN_BODY_CODES.earCanalWithoutGeneralAnesthesia]: {
    site: 'ear',
    display: 'Removal foreign body from external auditory canal; without general anesthesia',
    coverage: 'removal of a foreign body from the external ear canal',
  },
} as const satisfies Record<ForeignBodyCode, ForeignBodyCodeInfo>;

export function isForeignBodyRemovalCode(code: string): code is ForeignBodyCode {
  return code in FOREIGN_BODY_CODE_INFO;
}

export const codeCandidate = codeCandidateFromInfo(FOREIGN_BODY_CODE_INFO);

export const NO_PROCEDURE_CODE_CANDIDATE: CodeCandidate = {
  code: 'none',
  display: 'No separate procedure code — a removal without an incision is part of the visit (E/M) charge',
};

export const SITE_BRANCH_LABELS: Record<ForeignBodySite, string> = {
  skin: 'skin/soft tissue',
  nose: 'nose',
  eye: 'eye',
  ear: 'ear canal',
};
