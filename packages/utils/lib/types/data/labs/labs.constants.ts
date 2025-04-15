import { Pagination } from './labs.types';

export const PSC_HOLD_CONFIG = {
  system: 'psc-identifier',
  code: 'psc',
  display: 'psc',
};

export const LAB_ORDER_TASK = {
  system: 'external-lab-task',
  code: {
    presubmission: 'PST',
    reviewPreliminaryResult: 'RPRT',
    reviewFinalResult: 'RFRT',
  },
} as const;

export const LAB_ORDER_PLACER_ID_SYSTEM = 'https://identifiers.fhir.oystehr.com/lab-order-placer-id';

export const LAB_ORG_TYPE_CODING = { system: 'http://snomed.info/sct', code: '261904005', display: 'Laboratory' };

export const LAB_ACCOUNT_NUMBER_SYSTEM = 'https://identifiers.fhir.oystehr.com/lab-account-number';

export const ADDED_VIA_LAB_ORDER_SYSTEM = 'http://ottehr.org/fhir/StructureDefinition/added-via-lab-order';

// These are oystehr dependent
// meaning that there is logic in oystehr labs specifically looking for these systems
// so if we dont like any of them, we have to change there too
export const OYSTEHR_LAB_OI_CODE_SYSTEM = 'https://terminology.fhir.oystehr.com/CodeSystem/oystehr-oi-codes';
export const FHIR_IDC10_VALUESET_SYSTEM = 'http://hl7.org/fhir/valueset-icd-10.html';
('http://snomed.info/sct');
export const OYSTEHR_LAB_GUID_SYSTEM = 'https://identifiers.fhir.oystehr.com/lab-guid';

// Oystehr Labs APIs
export const OYSTEHR_LAB_API_BASE = 'https://labs-api.zapehr.com/v1';

export const OYSTEHR_LAB_ORDERABLE_ITEM_SEARCH_API = `${OYSTEHR_LAB_API_BASE}/orderableItem`;

export const DEFAULT_LABS_ITEMS_PER_PAGE = 10;

export const EMPTY_PAGINATION: Pagination = {
  currentPageIndex: 0,
  totalItems: 0,
  totalPages: 0,
};

export const PROVENANCE_ACTIVITY_TYPE_SYSTEM = 'https://identifiers.fhir.oystehr.com/provenance-activity-type';

export const PROVENANCE_ACTIVITY_CODES = {
  review: 'REVIEW',
  submit: 'SUBMIT',
} as const;

export const PROVENANCE_ACTIVITY_DISPLAY = {
  review: 'review',
  submit: 'submit',
} as const;

export const PROVENANCE_ACTIVITY_CODING_ENTITY = {
  submit: {
    code: PROVENANCE_ACTIVITY_CODES.submit,
    display: PROVENANCE_ACTIVITY_DISPLAY.submit,
    system: PROVENANCE_ACTIVITY_TYPE_SYSTEM,
  },
  review: {
    code: PROVENANCE_ACTIVITY_CODES.review,
    display: PROVENANCE_ACTIVITY_DISPLAY.review,
    system: PROVENANCE_ACTIVITY_TYPE_SYSTEM,
  },
} as const;
