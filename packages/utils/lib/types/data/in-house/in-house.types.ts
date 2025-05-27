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

export type InHouseOrderDetailPageDTO = InHouseOrderListPageDTO & {
  name: string;
  labDetails: TestItem;
  providerId: string;
  currentUserId: string;
  currentUserName: string;
  resultsPDFUrl: string | undefined;
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

export type InHouseOrderListPageDTO = {
  serviceRequestId: string;
  testItem: string;
  diagnosis: string;
  orderDate: string;
  status: TestStatus;
  visitDate: string;
  providerName: string;
  resultReceivedDate: string | null;
  diagnosisDTO: DiagnosisDTO[];
  timezone: string | undefined;
  orderAddedDate: string;
  orderingPhysician: string;
  lastResultReceivedDate: string | undefined;
};

export type InHouseOrderDetailedPageDTO = InHouseOrderListPageDTO & InHouseOrderDetailPageDTO;

export type InHouseOrderDTO<SearchBy extends InHouseOrdersSearchBy> = SearchBy extends {
  searchBy: { field: 'serviceRequestId' };
}
  ? InHouseOrderDetailedPageDTO
  : InHouseOrderListPageDTO;

export type InHouseOrdersListResponse<
  RequestParameters extends GetInHouseOrdersParameters = GetInHouseOrdersParameters,
> = RequestParameters extends { searchBy: { field: 'serviceRequestId' } }
  ? InHouseOrderDetailedPageDTO
  : {
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
  testItem: TestItem;
  cptCode: string;
  diagnosesAll: DiagnosisDTO[];
  diagnosesNew: DiagnosisDTO[];
  notes?: string;
};

export type GetCreateInHouseLabOrderResourcesParameters = { encounterId?: string };

export type GetCreateInHouseLabOrderResourcesResponse = {
  labs: TestItem[];
  providerName: string;
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
