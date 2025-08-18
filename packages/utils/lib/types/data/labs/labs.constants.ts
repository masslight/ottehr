// cSpell:ignore RCRT, RFRT, RPRT
import { Pagination } from '..';
import { LabelConfig } from './labs.types';

// for order form pdf (we might not want this idk)
export const ORDER_ITEM_UNKNOWN = 'UNKNOWN';

// recommended from Dorn as a good length (also matches the len currently used when oystehr sets the order number)
export const ORDER_NUMBER_LEN = 20;

export const PSC_HOLD_CONFIG = {
  system: 'psc-identifier',
  code: 'psc',
  display: 'psc',
};

export const LAB_ORDER_TASK = {
  system: 'external-lab-task',
  code: {
    preSubmission: 'PST',
    reviewPreliminaryResult: 'RPRT',
    reviewFinalResult: 'RFRT',
    reviewCorrectedResult: 'RCRT',
    reviewCancelledResult: 'RCANRT', // cancelled by the lab
  },
} as const;
export type LabOrderTaskCode = (typeof LAB_ORDER_TASK.code)[keyof typeof LAB_ORDER_TASK.code];

export const PSC_HOLD_LOCALE = 'PSC Hold';
export const PSC_LOCALE = 'PSC';

export const LAB_ORDER_DOC_REF_CODING_CODE = {
  system: 'http://loinc.org',
  code: '51991-8',
  display: 'Referral lab test panel',
};

export const LAB_RESULT_DOC_REF_CODING_CODE = {
  system: 'http://loinc.org',
  code: '11502-2',
  display: 'Laboratory report',
};

// there is no loinc code specifically for specimen labels or container labels, closest is 74384-9 "Specimen container [Type]"
// so opted for something custom her
export const EXTERNAL_LAB_LABEL_DOC_REF_DOCTYPE = {
  system: 'http://ottehr.org/fhir/StructureDefinition/specimen-collection-label',
  code: 'specimen-container-label',
  display: 'Specimen Container Label',
};

export const LAB_DR_TYPE_TAG = {
  system: 'result-type',
  display: {
    reflex: 'reflex',
  },
};

export const SPECIMEN_CODING_CONFIG = {
  collection: {
    system: 'http://ottehr.org/fhir/StructureDefinition/specimen-collection-details',
    code: {
      collectionInstructions: 'collectionInstructions',
      specimenVolume: 'specimenVolume',
    },
  },
};

export const LAB_ORG_TYPE_CODING = { system: 'http://snomed.info/sct', code: '261904005', display: 'Laboratory' };

export const LAB_ACCOUNT_NUMBER_SYSTEM = 'https://identifiers.fhir.oystehr.com/lab-account-number';

export const ADDED_VIA_LAB_ORDER_SYSTEM = 'http://ottehr.org/fhir/StructureDefinition/added-via-lab-order'; // used also for in-house labs

export const RELATED_SPECIMEN_DEFINITION_SYSTEM =
  'http://ottehr.org/fhir/StructureDefinition/related-specimen-definition';

export const IN_HOUSE_LAB_RESULT_PDF_BASE_NAME = 'LabsResultsForm';
export const EXTERNAL_LAB_RESULT_PDF_BASE_NAME = 'ExternalLabsResultsForm';

export const EXTERNAL_LAB_LABEL_PDF_BASE_NAME = 'ExternalLabsLabel';

export const DYMO_550_TURBO_DPI = 300;

export const DYMO_30334_LABEL_CONFIG: LabelConfig = {
  heightInches: 1.25,
  widthInches: 2.25,
  marginTopInches: 0.06,
  marginBottomInches: 0.06,
  marginLeftInches: 0.04,
  marginRightInches: 0.04,
  printerDPI: DYMO_550_TURBO_DPI,
};

// to identify manual orders (orders we could not submit electronically for some reason)
// mapped to SR.category.coding.system
export const MANUAL_EXTERNAL_LAB_ORDER_SYSTEM = 'https://fhir.ottehr.com/CodeSystem/manual-lab-order';
export const MANUAL_EXTERNAL_LAB_ORDER_CATEGORY_CODING = {
  system: MANUAL_EXTERNAL_LAB_ORDER_SYSTEM,
  code: 'manual-lab-order',
  display: 'manual-lab-order',
};

// These are oystehr dependent
// meaning that there is logic in oystehr labs specifically looking for these systems
// so if we don't like any of them, we have to change there too
export const OYSTEHR_LAB_OI_CODE_SYSTEM = 'https://terminology.fhir.oystehr.com/CodeSystem/oystehr-lab-local-codes';
export const FHIR_IDC10_VALUESET_SYSTEM = 'http://hl7.org/fhir/valueset-icd-10.html';
export const SNOMED_CODE_SYSTEM = 'http://snomed.info/sct';
export const OYSTEHR_LAB_GUID_SYSTEM = 'https://identifiers.fhir.oystehr.com/lab-guid';
export const OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM = 'https://identifiers.fhir.oystehr.com/lab-order-placer-id';
export const OYSTEHR_EXTERNAL_LABS_ATTACHMENT_EXT_SYSTEM =
  'https://extensions.fhir.oystehr.com/observation-value-attachment-pre-release';

export const OYSTEHR_OBS_CONTENT_TYPES = {
  pdf: 'AP',
  image: 'IM',
} as const;
export type ObsContentType = (typeof OYSTEHR_OBS_CONTENT_TYPES)[keyof typeof OYSTEHR_OBS_CONTENT_TYPES];
export type SupportedObsImgAttachmentTypes = 'PNG' | 'JPG' | 'JPEG';

export const OYSTEHR_LAB_DIAGNOSTIC_REPORT_CATEGORY = {
  system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
  code: 'OSL',
  display: 'Outside Lab',
};
export const OYSTEHR_OBR_NOTE_CODING_SYSTEM = 'https://identifiers.fhir.oystehr.com/obr-note';

// Oystehr Labs APIs
export const OYSTEHR_LAB_API_BASE = 'https://labs-api.zapehr.com/v1';

export const OYSTEHR_LAB_ORDERABLE_ITEM_SEARCH_API = `${OYSTEHR_LAB_API_BASE}/orderableItem`;
export const OYSTEHR_SUBMIT_LAB_API = `${OYSTEHR_LAB_API_BASE}/submit`;

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
  createOrder: 'CREATE ORDER',
  inputResults: 'INPUT RESULTS',
  completePstTask: 'COMPLETE PST TASK',
} as const;

export const PROVENANCE_ACTIVITY_DISPLAY = {
  review: 'review',
  submit: 'submit',
  createOrder: 'create order',
  inputResults: 'input results',
  completePstTask: 'complete pst task',
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
  createOrder: {
    code: PROVENANCE_ACTIVITY_CODES.createOrder,
    display: PROVENANCE_ACTIVITY_CODES.createOrder,
    system: PROVENANCE_ACTIVITY_TYPE_SYSTEM,
  },
  inputResults: {
    code: PROVENANCE_ACTIVITY_CODES.inputResults,
    display: PROVENANCE_ACTIVITY_CODES.inputResults,
    system: PROVENANCE_ACTIVITY_TYPE_SYSTEM,
  },
  // specimen collection & aoe entry if applicable
  completePstTask: {
    code: PROVENANCE_ACTIVITY_CODES.completePstTask,
    display: PROVENANCE_ACTIVITY_DISPLAY.completePstTask,
    system: PROVENANCE_ACTIVITY_TYPE_SYSTEM,
  },
} as const;
