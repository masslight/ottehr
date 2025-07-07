import { CodeableConcept } from 'fhir/r4b';
import { TestStatus } from './in-house.types';

export enum PageName {
  collectSample,
  performEnterResults,
  final,
}

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

export const IN_HOUSE_LAB_DOC_REF_CATEGORY = {
  system: 'in-house-lab-document-type',
  code: {
    sampleLabel: 'sample-label-form',
    resultForm: 'result-form',
  },
} as const;

export const OBSERVATION_INTERPRETATION_SYSTEM = 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation';

export const OBSERVATION_CODES = {
  ABNORMAL: 'A',
  NORMAL: 'N',
  INDETERMINATE: 'IND',
} as const;

export const ABNORMAL_OBSERVATION_INTERPRETATION: CodeableConcept = {
  coding: [
    {
      system: OBSERVATION_INTERPRETATION_SYSTEM,
      code: OBSERVATION_CODES.ABNORMAL,
      display: 'Abnormal',
    },
  ],
};

export const NORMAL_OBSERVATION_INTERPRETATION: CodeableConcept = {
  coding: [
    {
      system: OBSERVATION_INTERPRETATION_SYSTEM,
      code: OBSERVATION_CODES.NORMAL,
      display: 'Normal',
    },
  ],
};

export const INDETERMINATE_OBSERVATION_INTERPRETATION: CodeableConcept = {
  coding: [
    {
      system: OBSERVATION_INTERPRETATION_SYSTEM,
      code: OBSERVATION_CODES.INDETERMINATE,
      display: 'Indeterminate',
    },
  ],
};

export const IN_HOUSE_DIAGNOSTIC_REPORT_CATEGORY_CONFIG = {
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

// because we are storing the obs defs as contained resources on the in house labs activity definitions,
// there's no way to link them to the observations so will store their "id" in an extension
export const IN_HOUSE_OBS_DEF_ID_SYSTEM = 'http://ottehr.org/fhir/StructureDefinition/contained-obs-def-id';

// todo when we have a predefined list we can use this
export const SPECIMEN_COLLECTION_SOURCE_SYSTEM = 'https://hl7.org/fhir/R4B/valueset-body-site';

// todo we will use this while the entry is free text
export const SPECIMEN_COLLECTION_CUSTOM_SOURCE_SYSTEM = 'http://ottehr.org/fhir/StructureDefinition/specimen-source';

export const DEFAULT_IN_HOUSE_LABS_ITEMS_PER_PAGE = 10;

export const REPEATABLE_TEXT_EXTENSION_CONFIG = {
  url: 'http://ottehr.org/fhir/StructureDefinition/in-house-lab-repeatable-test',
  valueString: 'repeatable-test',
};
