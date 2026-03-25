import { ProcedureModifier } from 'candidhealth/api';
import {
  CPTCodeDTO,
  DiagnosisDTO,
  InHouseLabListDTO,
  LabListsDTO,
  OBSERVATION_CODES,
  Pagination,
  REFLEX_TEST_CONDITION_LANGUAGES,
} from 'utils';

export const EntryMode = {
  Initial: 'initial',
  Edit: 'edit',
} as const;

export type EntryMode = (typeof EntryMode)[keyof typeof EntryMode];

export type ObservationCode = (typeof OBSERVATION_CODES)[keyof typeof OBSERVATION_CODES];
export interface LabComponentValueSetConfig {
  code: string; // this should remain constant, changing it could cause backward compatibility issues
  display: string;
}
export interface TestComponentResult {
  entry: string;
  interpretationCode: ObservationCode;
}

interface BaseDataEntryComponent {
  componentName: string;
  loincCode: string[];
  observationDefinitionId: string;
  result?: TestComponentResult;
}

export interface CodeableConceptDataEntryComponent extends BaseDataEntryComponent {
  dataType: 'CodeableConcept';
  valueSet: LabComponentValueSetConfig[];
  abnormalValues: LabComponentValueSetConfig[];
  displayType: 'Radio' | 'Select';
  nullOption?: {
    text: string;
    code: string;
  };
  unit?: string;
  referenceRangeValues?: LabComponentValueSetConfig[];
}

export interface QuantityDataEntryComponent extends BaseDataEntryComponent {
  dataType: 'Quantity';
  unit: string;
  normalRange: QuantityRange;
  displayType: 'Numeric';
}

interface ValidationValueAndDisplay {
  value: string | number;
  display?: string;
}
export interface Validation {
  format?: ValidationValueAndDisplay;
  // minLength?: number; // labs todo: can include these in the future but omitted now for sake of time
  // maxLength?: number;
}
export interface StringDataEntryComponent extends BaseDataEntryComponent {
  dataType: 'string';
  displayType: 'Free Text';
  validations?: Validation;
}

export type DataEntryComponent =
  | CodeableConceptDataEntryComponent
  | QuantityDataEntryComponent
  | StringDataEntryComponent;

export type DataEntryComponentType =
  | {
      type: 'grouped';
      components: DataEntryComponent[];
    }
  | {
      type: 'radio';
      components: CodeableConceptDataEntryComponent[];
    }
  | {
      type: 'empty';
      components: undefined;
    };

export interface DataEntryTestItem {
  name: string;
  methods: TestItemMethods;
  method: string;
  device: string;
  cptCode: CPTCodeDTO[];
  repeatable: boolean; // this test CAN be run as a repeat test
  orderMode: 'repeat' | 'reflex' | 'standard';
  // reflexAlert is only defined IF results have been inputted that triggered the reflex test be run
  // todo labs it might make more sense to break this up, have a "reflexTriggered" bool AND this alert can always be passed
  components: DataEntryComponentType;
  reflexAlert: { alert: string; testName: string; canonicalUrl: string } | undefined; // for now we are only ever expecting one alert but this might change in the future
  adUrl: string;
  adVersion: string;
  adId: string;
  note?: string;
}

export type InHouseOrderListPageItemDTO = {
  appointmentId: string;
  serviceRequestId: string;
  testItemName: string;
  diagnosesDTO: DiagnosisDTO[];
  status: TestStatus;
  visitDate: string;
  resultReceivedDate: string | null;
  timezone: string | undefined;
  orderAddedDate: string;
  orderingPhysicianFullName: string;
};

export type InHouseOrderDetailPageItemDTO = InHouseOrderListPageItemDTO & {
  orderingPhysicianId: string;
  currentUserId: string;
  currentUserFullName: string;
  resultsPDFUrl: string | undefined;
  labDetails: DataEntryTestItem;
  // ATHENA TODO: this is what it could have been
  // testItemFormConfig: TestItemFormConfig; //i.e. TestItem
  // labDetails: TestResult;
  orderHistory: {
    status: TestStatus;
    statusSubtitle: string | undefined;
    providerName: string;
    date: string;
  }[];
  specimen:
    | {
        source: string;
        collectedBy: string;
        collectionDate: string;
        collectionTime: string;
      }
    | undefined;
  notes: string;
};

export type InHouseGetOrdersResponseDTO<SearchBy extends InHouseOrdersSearchBy> = SearchBy extends {
  searchBy: { field: 'serviceRequestId' };
}
  ? InHouseOrderDetailPageItemDTO[]
  : {
      data: InHouseOrderListPageItemDTO[];
      pagination: Pagination;
    };

export type InHouseOrdersSearchBy = {
  searchBy:
    | { field: 'encounterId'; value: string }
    | { field: 'encounterIds'; value: string[] }
    | { field: 'patientId'; value: string }
    | { field: 'serviceRequestId'; value: string };
};

export type InHouseOrdersSearchFilters = {
  orderableItemCode?: string;
  visitDate?: string;
};

export type InHouseOrdersPaginationOptions = {
  itemsPerPage?: number;
  pageIndex?: number;
};

export type GetInHouseOrdersParameters = InHouseOrdersSearchBy &
  InHouseOrdersSearchFilters &
  InHouseOrdersPaginationOptions;

export type CreateInHouseLabOrderParameters = {
  encounterId: string;
  testItems: DataEntryTestItem[];
  diagnosesAll: DiagnosisDTO[];
  diagnosesNew: DiagnosisDTO[];
  notes?: string;
};

export type CreateInHouseLabOrderResponse = {
  saveChartDataResponse: { output: { chartData: { diagnosis: (DiagnosisDTO & { resourceId: string })[] } } };
  serviceRequestIds: string[];
};

export type GetCreateInHouseLabOrderResourcesInput = { encounterId?: string; selectedLabSet?: InHouseLabListDTO };

export type GetCreateInHouseLabOrderResourcesOutput = {
  labs: DataEntryTestItem[];
  providerName?: string;
  labSets?: LabListsDTO[] | undefined;
};

export type CollectInHouseLabSpecimenParameters = {
  encounterId: string;
  serviceRequestId: string;
  data: MarkAsCollectedData;
};

export type CollectInHouseLabSpecimenZambdaOutput = Record<string, never>;

export interface ResultEntryInput {
  [observationDefinitionId: string]: any;
}

export type HandleInHouseLabResultsParameters = {
  serviceRequestId: string;
  data: ResultEntryInput;
};

export type HandleInHouseLabResultsZambdaOutput = Record<string, never>;

export type DeleteInHouseLabOrderParameters = {
  serviceRequestId: string;
};

export type DeleteInHouseLabOrderZambdaOutput = Record<string, never>;

export type TestStatus = 'ORDERED' | 'COLLECTED' | 'FINAL';

export type MarkAsCollectedData = {
  specimen: {
    source?: string;
    collectedBy: { id: string; name: string };
    collectionDate: string;
  };
};

// types - there are separated types and seed object which is used for the creation script only:
export interface QuantityRange {
  low: number;
  high: number;
  unit: string;
  precision?: number;
}
export interface TestItemMethods {
  manual?: { device: string };
  analyzer?: { device: string };
  machine?: { device: string };
}

/**
 * These types are for the Admin Config for In House Labs. There is some overlap with the DataEntry versions of these type
 * which are used to render the provider-facing test-result entry workflow forms.
 *
 * labs todo: consolidate these types to some degree
 */

interface ReflexLogic {
  // you may want to generate the AD for the reflex test first to be sure they match
  // these need to match the reflex test activity definition
  testToRun: {
    testName: string;
    testCanonicalUrl: string;
  };
  // this what will be shown on the front end when conditions are met
  triggerAlert: string;
  condition: {
    description: string; // human readable description of what is being evaluated, purely informational
    language: typeof REFLEX_TEST_CONDITION_LANGUAGES.fhirPath; // the only language we are set up to handle at the moment, code changes are needed if we want to handle something else
    expression: string; // should be something that fhirPath can accept
  };
}
export interface BaseComponent {
  componentName: string;
  loincCode: string[];
  reflexLogic?: ReflexLogic | { parentTestUrl: string };
}

export interface CodeableConceptComponent extends BaseComponent {
  dataType: 'CodeableConcept';
  valueSet: LabComponentValueSetConfig[];
  abnormalValues: LabComponentValueSetConfig[];
  display: {
    type: 'Radio' | 'Select';
    nullOption: boolean;
  };
  unit?: string;
  quantitativeReference?: Record<string, string>;
}
interface QuantityComponent extends BaseComponent {
  dataType: 'Quantity';
  normalRange: QuantityRange;
  display: {
    type: 'Numeric';
    nullOption: boolean;
  };
}

// labs todo: may want to add units or a reference range in the future
interface StringComponent extends BaseComponent {
  dataType: 'string';
  display: {
    type: 'Free Text';
    validations?: Validation;
  };
}

type TestItemComponent = CodeableConceptComponent | QuantityComponent | StringComponent;

// This could almost have matched the CPTCodeDTO if not for the ProcedureModifier
type CptCode = { code: string; modifier?: { code: ProcedureModifier; display: string }[] };
export interface TestItem {
  name: string;
  methods: TestItemMethods;
  method: string;
  device: string;
  cptCode: CptCode[];
  loincCode: string[];
  repeatTest: boolean;
  components: TestItemComponent[];
  note?: string;
}

// ATHENA TODO:
// Define type for simple list Admin config ADs -- name, status, version, canonical url, id
// Define zambda for the list page and get that working
// Then start working on the form building

export type InHouseLabAdminItemStatus = 'active' | 'retired';
export interface InHouseLabsAdminListItem {
  name: string;
  status: InHouseLabAdminItemStatus;
  canonicalUrl: string;
  version: string;
  activityDefinitionId: string;
}

export interface AdminListInHouseLabsInput {
  userId: string;
}

export interface AdminListInHouseLabsOutput {
  labs: InHouseLabsAdminListItem[];
}
