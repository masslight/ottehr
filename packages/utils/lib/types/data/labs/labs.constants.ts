export const PSC_HOLD_CONFIG = {
  system: 'psc-hold-identifier',
  code: 'psc-hold',
  display: 'psc hold',
};

export const LAB_ORDER_TASK = {
  system: 'external-lab-task',
  code: {
    presubmission: 'PST',
    reviewPreliminaryResult: 'RPRT',
    reviewFinalResult: 'RFRT',
  },
};

export const LAB_ORG_TYPE_CODING = { system: 'http://snomed.info/sct', code: '261904005', display: 'Laboratory' };

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
