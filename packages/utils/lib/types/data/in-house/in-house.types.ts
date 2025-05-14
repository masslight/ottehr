import { DiagnosisDTO } from '../..';
import { TestItem, TestItemsType } from '../../../fhir';
import { Pagination } from '../labs';

export type InHouseOrderStatus = 'ordered' | 'collected' | 'final';

export type InHouseOrderResultDetails = {
  status: InHouseOrderStatus;
  sample: {
    source: unknown;
    collectedBy: unknown;
    collectionDate: string;
  }[];
  note: string;
  history: {
    status: InHouseOrderStatus;
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
  status: InHouseOrderStatus;
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

// todo: check on duplicate types (they are moved from EHR app):

// Types of lab tests
export type TestType = 'QUALITATIVE' | 'QUANTITATIVE' | 'MIXED';

// Possible test statuses
export type TestStatus = 'ORDERED' | 'COLLECTED' | 'FINAL';

// todo: it's a draft, see a comment https://github.com/masslight/ottehr/pull/2166#discussion_r2085316003
export type TestResult = 'DETECTED' | 'NOT_DETECTED' | 'INDETERMINATE' | null;

// Urine analysis parameter type
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
