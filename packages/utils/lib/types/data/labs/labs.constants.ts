// todo review and agree upon the below

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

// These are oystehr dependent
// meaning that there is logic in oystehr labs specifically looking for these systems
// so if we dont like any of them, we have to change there too
export const OYSTEHR_LAB_OI_CODE_SYSTEM = 'https://terminology.fhir.oystehr.com/CodeSystem/oystehr-oi-codes';
export const FHIR_IDC10_VALUESET_SYSTEM = 'http://hl7.org/fhir/valueset-icd-10.html';
