import { DiagnosisDTO, OBSERVATION_CODES } from '../..';
import { Pagination } from '../labs';

export interface TestItemMethods {
  manual?: { device: string };
  analyzer?: { device: string };
  machine?: { device: string };
}
export interface QuantityRange {
  low: number;
  high: number;
  unit: string;
  precision?: number;
}

export type ObservationCode = (typeof OBSERVATION_CODES)[keyof typeof OBSERVATION_CODES];

export interface TestComponentResult {
  entry: string;
  interpretationCode: ObservationCode;
}
export interface BaseComponent {
  componentName: string;
  loincCode: string[];
  observationDefinitionId: string;
  result?: TestComponentResult;
}

export interface CodeableConceptComponent extends BaseComponent {
  dataType: 'CodeableConcept';
  valueSet: string[];
  abnormalValues: string[];
  displayType: 'Radio' | 'Select';
  nullOption?: {
    text: string;
    code: string;
  };
  unit?: string;
  referenceRangeValues?: string[];
}

export interface QuantityComponent extends BaseComponent {
  dataType: 'Quantity';
  unit: string;
  normalRange: QuantityRange;
  displayType: 'Numeric';
}

export type TestItemComponent = CodeableConceptComponent | QuantityComponent;

export interface TestItem {
  name: string;
  methods: TestItemMethods;
  method: string;
  device: string;
  cptCode: string[];
  components: {
    groupedComponents: TestItemComponent[];
    radioComponents: CodeableConceptComponent[];
  };
  note?: string;
}

export type InHouseOrderResultDetails = {
  status: TestStatus;
  sample: {
    source: unknown;
    collectedBy: unknown;
    collectionDate: string;
  }[];
  note: string;
  history: {
    status: TestStatus;
    providerName: string;
    date: string;
  }[];
  showOnPatientPortal: boolean;
  templateTypes: unknown[];
  submittedValues: unknown[];
};

export type InHouseOrderListPageDTO = {
  testItem: string;
  diagnosis: string;
  orderDate: string;
  status: TestStatus;
  visitDate: string;
  providerName: string;
  resultReceivedDate: string | null;
};

export type InHouseOrderDetailedPageDTO = InHouseOrderListPageDTO & InHouseOrderResultDetails;

export type InHouseOrderDTO<SearchBy extends InHouseOrdersSearchBy> = SearchBy extends {
  searchBy: { field: 'serviceRequestId' };
}
  ? InHouseOrderDetailedPageDTO
  : InHouseOrderListPageDTO;

export type PaginatedInHouseOrderResponse<
  RequestParameters extends GetInHouseOrdersParameters = GetInHouseOrdersParameters,
> = {
  data: InHouseOrderDTO<RequestParameters>[];
  pagination: Pagination;
};

export type InHouseOrdersSearchBy = {
  searchBy:
    | { field: 'encounterId'; value: string }
    | { field: 'patientId'; value: string }
    | { field: 'serviceRequestId'; value: string };
};

export type InHouseOrdersSearchFilters = {
  testItem: unknown;
  visitDate: string;
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
  testItem: TestItem;
  cptCode: string;
  diagnosesAll: DiagnosisDTO[];
  diagnosesNew: DiagnosisDTO[];
  notes?: string;
};

export type GetCreateInHouseLabOrderResourcesParameters = { encounterId: string };

export type GetCreateInHouseLabOrderResourcesResponse = {
  labs: TestItem[];
  providerName: string;
};

export type InHouseLabDTO = {
  serviceRequestId: string;
  name: string;
  status: TestStatus;
  diagnosis: string;
  diagnosisDTO: DiagnosisDTO[];
  notes: string;
  labDetails: TestItem;
  timezone: string | undefined;
  specimen?: {
    source: string;
    collectedBy: string;
    collectionDate: string;
    collectionTime: string;
  };
  providerName: string;
  providerId: string;
  currentUserName: string;
  currentUserId: string;
  resultsPDFUrl?: string;
  orderInfo: {
    diagnosis: DiagnosisDTO[];
    testName: string;
    notes: string | undefined;
    status: TestStatus;
  };
  orderHistory: {
    status: TestStatus;
    providerName: string;
    date: string;
  }[];
};

export type CollectInHouseLabSpecimenParameters = {
  encounterId: string;
  serviceRequestId: string;
  data: MarkAsCollectedData;
};

export interface ResultEntryInput {
  [observationDefinitionId: string]: any;
}

export type HandleInHouseLabResultsParameters = {
  serviceRequestId: string;
  data: ResultEntryInput;
};

export type DeleteInHouseLabOrderParameters = {
  encounterId: string;
  patientId: string;
  serviceRequestId: string;
};

export type TestStatus = 'ORDERED' | 'COLLECTED' | 'FINAL';

export type MarkAsCollectedData = {
  specimen: {
    source: string;
    collectedBy: { id: string; name: string };
    collectionDate: string;
  };
  notes: string;
};
