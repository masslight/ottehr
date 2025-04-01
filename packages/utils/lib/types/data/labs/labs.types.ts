import { Questionnaire } from 'fhir/r4b';
import { DiagnosisDTO } from '../..';

export interface OrderableItemSearchResult {
  item: OrderableItem;
  lab: OrderableItemLab;
}

export interface OrderableItemSpecimen {
  container: string;
  volume: string;
  minimumVolume: string;
  storageRequirements: string;
  collectionInstructions: string;
}
export interface OrderableItemComponent {
  componentItemCode: string;
  name: string;
  loinc: string;
  uom: string;
  range: string;
  type: string;
}

export interface OrderableItemCptCode {
  cptCode: string;
  serviceUnitsCount: number;
}
export interface OrderableItem {
  itemCode: string;
  itemLoinc: string;
  itemType: string;
  itemName: string;
  uniqueName: string;
  specimens: OrderableItemSpecimen[];
  components: OrderableItemComponent[];
  cptCodes: OrderableItemCptCode[];
  aoe: Questionnaire;
}

export interface OrderableItemLab {
  labGuid: string;
  labName: string;
  labType: string;
  compendiumVersion: string;
}

export enum ExternalLabsStatus {
  pending = 'pending',
  sent = 'sent',
  prelim = 'prelim',
  received = 'received',
  reviewed = 'reviewed',
  cancelled = 'cancelled',
  unparsed = '-', // for debugging purposes
}

export type LabOrderHistoryRow = {
  action: 'ordered' | 'performed' | 'received' | 'reviewed' | 'received reflex' | 'reviewed reflex';
  performer: string;
  date: string;
};

export interface LabOrderDTO {
  orderId: string; // ServiceRequest.id
  typeLab: string; // ServiceRequest.contained[0](ActivityDefinition).title
  locationLab: string; // ServiceRequest.contained[0](ActivityDefinition).publisher
  orderAddedDate: string; // Task PST authoredOn
  providerName: string; // SR.requester name
  diagnoses: DiagnosisDTO[]; // SR.reasonCode
  orderedLabStatus: ExternalLabsStatus; // Derived from SR, Tasks and DiagnosticReports based on the mapping table
  isPSC: boolean; // Derived from SR.orderDetail
  reflexResultsCount: number; // Number of DiagnosticReports with the same SR identifier but different test codes
  appointmentId: string;
  visitDate: string; // based on appointment
  lastResultReceivedDate: string; // the most recent Task RFRT.authoredOn
  dx: string; // SR.reasonCode joins
  performedBy: string; // order performed (SR.orderDetail code.display)
  accessionNumbers: string[]; // DiagnosticReport.identifier
  history: LabOrderHistoryRow[];
}

export interface Pagination {
  currentPageIndex: number;
  totalItems: number;
  totalPages: number;
}

export interface PaginatedLabOrderResponse {
  data: LabOrderDTO[];
  pagination: Pagination;
}

interface GetLabOrdersSearchFilters {
  orderableItemCode?: string; // search filter by lab
  visitDate?: string; // search filter by visit date
}

interface GetLabOrdersPaginationOptions {
  itemsPerPage?: number;
  pageIndex?: number;
}

interface GetLabOrdersByEncounter {
  encounterId: string;
  patientId?: never;
  serviceRequestId?: never;
}

interface GetLabOrdersByPatient {
  encounterId?: never;
  patientId: string;
  serviceRequestId?: never;
}

interface GetLabOrdersByServiceRequest {
  encounterId?: never;
  patientId?: never;
  serviceRequestId: string;
}

type GetLabOrdersBaseParameters = GetLabOrdersSearchFilters & GetLabOrdersPaginationOptions;

type GetLabOrdersByEncounterParameters = GetLabOrdersByEncounter & GetLabOrdersBaseParameters;
type GetLabOrdersByPatientParameters = GetLabOrdersByPatient & GetLabOrdersBaseParameters;
type GetLabOrdersByServiceRequestParameters = GetLabOrdersByServiceRequest & GetLabOrdersBaseParameters;

export type GetLabOrdersParameters =
  | GetLabOrdersByEncounterParameters // use case: Patient Chart
  | GetLabOrdersByPatientParameters // use case: Patient Page
  | GetLabOrdersByServiceRequestParameters; // use case: Lab Order Detail Page
