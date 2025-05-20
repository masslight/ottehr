import { DiagnosisDTO } from '../..';
import { Pagination } from '../labs';

export interface QuantityRange {
  low: number;
  high: number;
  unit: string;
  precision?: number;
}
export interface BaseComponent {
  componentName: string;
  loincCode: string[];
  observationDefinitionId: string;
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
}

export interface QuantityComponent extends BaseComponent {
  dataType: 'Quantity';
  unit: string;
  normalRange: QuantityRange;
  displayType: 'Numeric';
}

export type TestItemComponent = CodeableConceptComponent | QuantityComponent;

// base fields, common for all test types
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
  result?: {
    entry: string;
    isAbnormal?: boolean;
  };
  note?: string;
}

export interface TestItemMethods {
  manual?: { device: string };
  analyzer?: { device: string };
  machine?: { device: string };
}

export type TestItemsType = Record<string, TestItem>;

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
  diagnoses: DiagnosisDTO[];
  notes?: string;
};

export type GetCreateInHouseLabOrderResourcesParameters = { encounterId: string };

export type GetCreateInHouseLabOrderResourcesResponse = {
  labs: TestItemsType;
  providerName: string;
};

export type CollectInHouseLabSpecimenParameters = {
  encounterId: string;
  patientId: string;
  serviceRequestId: string;
};

export type HandleInHouseLabResultsParameters = {
  encounterId: string;
  patientId: string;
  serviceRequestId: string;
};

export type DeleteInHouseLabOrderParameters = {
  encounterId: string;
  patientId: string;
  serviceRequestId: string;
};

export type TestType = 'QUALITATIVE' | 'QUANTITATIVE' | 'MIXED';

export type TestStatus = 'ORDERED' | 'COLLECTED' | 'FINAL';

// Lab test details
export interface LabTest {
  id: string;
  type: TestType;
  name: string;
  status: TestStatus;
  diagnosis: string;
  specimen?: {
    source: string;
    collectedBy: string;
    collectionDate: string;
    collectionTime: string;
  };
  notes?: string;
  orderDetails?: {
    orderedBy: string;
    orderedDate: string;
    collectedBy?: string;
    collectedDate?: string;
  };
  parameters?: TestItem[];
}
