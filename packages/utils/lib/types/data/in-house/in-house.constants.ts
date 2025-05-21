import { CodeableConcept } from 'fhir/r4b';
import { TestStatus } from './in-house.types';

export enum LoadingState {
  initial,
  loading,
  loaded,
  loadedWithError,
}

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

const OBSERVATION_INTERPRETATION_SYSTEM = 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation';

export const ABNORMAL_OBSERVATION_INTERPRETATION: CodeableConcept = {
  coding: [
    {
      system: OBSERVATION_INTERPRETATION_SYSTEM,
      code: 'A',
      display: 'Abnormal',
    },
  ],
};

export const NORMAL_OBSERVATION_INTERPRETATION: CodeableConcept = {
  coding: [
    {
      system: OBSERVATION_INTERPRETATION_SYSTEM,
      code: 'N',
      display: 'Normal',
    },
  ],
};

export const INDETERMINATE_OBSERVATION_INTERPRETATION: CodeableConcept = {
  coding: [
    {
      system: OBSERVATION_INTERPRETATION_SYSTEM,
      code: 'IND',
      display: 'Indeterminate',
    },
  ],
};

export const DIAGNOSTIC_REPORT_CATEGORY_CONFIG = {
  system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
  code: 'LAB',
  display: 'Laboratory',
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

const IN_HOUSE_LAB_OD_DISPLAY_SYSTEM = 'http://ottehr.org/fhir/StructureDefinition/valueset-display';

export const OD_DISPLAY_CONFIG = {
  url: IN_HOUSE_LAB_OD_DISPLAY_SYSTEM,
  valueString: {
    radio: 'Radio',
    select: 'Select',
    numeric: 'Numeric',
  },
} as const;

export const IN_HOUSE_LAB_OD_NULL_OPTION_SYSTEM = 'http://ottehr.org/fhir/StructureDefinition/allow-null-value';

export const IN_HOUSE_LAB_OD_NULL_OPTION_CONFIG = {
  url: IN_HOUSE_LAB_OD_NULL_OPTION_SYSTEM,
  valueCode: 'Unknown',
  valueString: 'Indeterminate / inconclusive / error',
};
