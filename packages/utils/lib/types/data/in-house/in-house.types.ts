import { Bundle, FhirResource } from 'fhir/r4b';
import { DiagnosisDTO, OBSERVATION_CODES, Pagination } from '../..';

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
export interface LabComponentValueSetConfig {
  code: string; // this should remain constant, changing it could cause backward compatibility issues
  display: string;
}
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
  repeatable: boolean;
  components: {
    groupedComponents: TestItemComponent[];
    radioComponents: CodeableConceptComponent[];
  };
  adUrl: string;
  adVersion: string;
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
  testItem: TestItem;
  cptCode: string;
  diagnosesAll: DiagnosisDTO[];
  diagnosesNew: DiagnosisDTO[];
  isRepeatTest: boolean;
  notes?: string;
};

export type CreateInHouseLabOrderResponse = {
  transactionResponse: { output: Bundle<FhirResource> };
  saveChartDataResponse: { output: { chartData: { diagnosis: (DiagnosisDTO & { resourceId: string })[] } } };
  serviceRequestId?: string | undefined;
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
    source: string;
    collectedBy: { id: string; name: string };
    collectionDate: string;
  };
};
