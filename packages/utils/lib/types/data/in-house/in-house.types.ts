import { TestItemsType } from '../../../fhir';
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
  patientId: string;
  serviceRequestId: string;
};

export type GetCreateInHouseLabOrderResourcesParameters = { serviceRequestId: string };

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
