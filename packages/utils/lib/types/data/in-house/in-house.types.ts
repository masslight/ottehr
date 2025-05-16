import { DiagnosisDTO } from '../..';
import { Pagination } from '../labs';

// base types for HL7 interpretation
export type ObservationInterpretationCode = 'N' | 'A' | 'H' | 'L';

export interface InterpretationCoding {
  system: string;
  code: ObservationInterpretationCode;
  display: string;
}

export interface QuantityRange {
  low: number;
  high: number;
  unit: string;
  precision?: number;
}

export interface CodeableConceptType {
  dataType: 'CodeableConcept';
  valueSet: string[];
  abnormalValues: string[];
}

export interface QuantityType {
  dataType: 'Quantity';
  unit: string;
  normalRange: QuantityRange;
}

export type ResultType = CodeableConceptType | QuantityType;

export interface MixedComponent {
  loincCode: string[];
  dataType: 'CodeableConcept' | 'Quantity'; // Using literal types instead of ResultType['dataType']
  valueSet?: string[];
  abnormalValues?: string[];
  normalRange?: QuantityRange;
  quantitativeReference?: Record<string, string>;
}

// base fields, common for all test types
interface BaseTestItem {
  name: string;
  methods: TestItemMethods;
  method: string;
  device: string;
  cptCode: string[];
  loincCode: string[];
  // repeatTest: boolean;
  note?: string;
  components?: Record<string, MixedComponent>;
}

export interface CodeableConceptTestItem extends BaseTestItem {
  dataType: 'CodeableConcept';
  valueSet: string[];
  abnormalValues: string[];
}

export interface QuantityTestItem extends BaseTestItem {
  dataType: 'Quantity';
  unit: string;
  normalRange: QuantityRange;
}

export interface TestItemMethods {
  manual?: { device: string };
  analyzer?: { device: string };
  machine?: { device: string };
}

export type TestItem = CodeableConceptTestItem | QuantityTestItem;

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

// todo: it's a draft, see a comment https://github.com/masslight/ottehr/pull/2166#discussion_r2085316003
export type TestResult = 'DETECTED' | 'NOT_DETECTED' | 'INDETERMINATE' | null;

export interface LabParameter {
  name: string;
  value: string | null;
  units?: string;
  referenceRange: string;
  isAbnormal?: boolean;
}

// Lab test details
export interface LabTest {
  id: string;
  type: TestType;
  name: string;
  status: TestStatus;
  result?: TestResult;
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
  parameters?: LabParameter[];
}
