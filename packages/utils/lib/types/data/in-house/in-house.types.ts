import { CPTCodeDTO, DiagnosisDTO, InHouseLabListDTO, LabListsDTO, OBSERVATION_CODES, Pagination } from 'utils';

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

export interface TestItem {
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
  labDetails: TestItem;
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
  testItems: TestItem[];
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
  labs: TestItem[];
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
