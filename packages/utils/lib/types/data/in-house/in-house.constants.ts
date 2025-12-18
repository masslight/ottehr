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
  category: 'in-house-lab',
  system: 'in-house-lab-task',
  code: {
    collectSampleTask: 'CST',
    inputResultsTask: 'IRT',
  },
  input: {
    testName: 'test-name',
    patientName: 'patient-name',
    providerName: 'provider-name',
    orderDate: 'order-date',
    appointmentId: 'appointment-id',
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

export type IN_HOUSE_LAB_DISPLAY_TYPES = 'Radio' | 'Select' | 'Numeric' | 'Free Text';
export const OD_DISPLAY_CONFIG = {
  url: IN_HOUSE_LAB_OD_DISPLAY_SYSTEM,
  valueString: {
    radio: 'Radio' as IN_HOUSE_LAB_DISPLAY_TYPES,
    select: 'Select' as IN_HOUSE_LAB_DISPLAY_TYPES,
    numeric: 'Numeric' as IN_HOUSE_LAB_DISPLAY_TYPES,
    freeText: 'Free Text' as IN_HOUSE_LAB_DISPLAY_TYPES,
  },
} as const;

const IN_HOUSE_LAB_OD_VALIDATION_SYSTEM =
  'http://ottehr.org/fhir/StructureDefinition/observation-definition-validation';

const IN_HOUSE_LAB_TEXT_VALIDATION_SYSTEM = 'http://ottehr.org/fhir/StructureDefinition/text-format-validation';

export const OD_VALUE_VALIDATION_CONFIG = {
  url: IN_HOUSE_LAB_OD_VALIDATION_SYSTEM,
  formatValidation: {
    url: IN_HOUSE_LAB_TEXT_VALIDATION_SYSTEM,
  },
};

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

const RESULT_RECORDING_DETAIL_SYSTEM = 'result-recording-detail';
export const ABNORMAL_RESULT_DR_TAG = {
  system: RESULT_RECORDING_DETAIL_SYSTEM,
  code: 'abnormal',
  display: 'At least one abnormal result was recorded',
};
export const INCONCLUSIVE_RESULT_DR_TAG = {
  system: RESULT_RECORDING_DETAIL_SYSTEM,
  code: 'inconclusive',
  display: 'At least one inconclusive result was recorded',
};
export const NEUTRAL_RESULT_DR_TAG = {
  system: RESULT_RECORDING_DETAIL_SYSTEM,
  code: 'neutral',
  display: 'Tests done should be displayed in neutral ui', // no colors, no indications positive/negative (example pregnancy)
};

export const REFLEX_TEST_LOGIC_URL = 'http://ottehr.org/fhir/StructureDefinition/reflex-test-logic';
export const REFLEX_TEST_TO_RUN_URL = 'http://ottehr.org/fhir/StructureDefinition/reflex-test-to-run';
export const REFLEX_TEST_TO_RUN_NAME_URL = 'http://ottehr.org/fhir/StructureDefinition/reflex-test-to-run-name';
export const REFLEX_TEST_ALERT_URL = 'http://ottehr.org/fhir/StructureDefinition/reflex-trigger-alert';
export const REFLEX_TEST_CONDITION_URL = 'http://ottehr.org/fhir/StructureDefinition/reflex-condition';
export const REFLEX_TEST_CONDITION_LANGUAGES = {
  fhirPath: 'text/fhirpath',
} as const;
export const REFLEX_TEST_TRIGGERED_URL = 'http://ottehr.org/fhir/StructureDefinition/reflex-test-triggered';

// tag needed to validating the progress note
// the display value for this tag will be the reflex test name
export const SERVICE_REQUEST_REFLEX_TRIGGERED_TAG_SYSTEM = 'reflex-test-triggered';
export const SERVICE_REQUEST_REFLEX_TRIGGERED_TAG_CODES = {
  pending: 'pending', // test is not created, you cannot sign
};

export const REFLEX_ARTIFACT_DISPLAY = 'reflex relationship'; // added to the depends-on relatedArtifact on reflex test activity definitions
