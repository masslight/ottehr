import { TestStatus } from './in-house.types';

export const inHouseLabsTestStatuses: Record<TestStatus, TestStatus> = {
  ORDERED: 'ORDERED',
  COLLECTED: 'COLLECTED',
  FINAL: 'FINAL',
};

export const IN_HOUSE_LAB_TASK = {
  system: 'in-house-lab-task',
  code: {
    collectSampleTask: 'CST',
    inputResultsTask: 'IRT',
  },
} as const;

export const IN_HOUSE_LAB_DOCREF_CATEGORY = {
  system: 'in-house-lab-document-type',
  code: {
    sampleLabel: 'sample-label-form',
    resultForm: 'result-form',
  },
} as const;

export const IN_HOUSE_TEST_CODE_SYSTEM = 'http://ottehr.org/fhir/StructureDefinition/in-house-lab-test-code';

export const IN_HOUSE_PARTICIPANT_ROLE_SYSTEM =
  'http://ottehr.org/fhir/StructureDefinition/in-house-test-participant-role';

export const IN_HOUSE_TAG_DEFINITION = {
  system: 'http://ottehr.org/fhir/StructureDefinition/in-house-lab-codes',
  code: 'in-house-lab-test-definition',
};

export const IN_HOUSE_UNIT_OF_MEASURE_SYSTEM = 'http://unitsofmeasure.org/';

export const IN_HOUSE_RESULTS_VALUESET_SYSTEM =
  'http://ottehr.org/fhir/StructureDefinition/in-house-lab-result-valueSet';
