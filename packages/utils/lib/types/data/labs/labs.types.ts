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

export type ReflexLabStatus =
  | ExternalLabsStatus.received
  | ExternalLabsStatus.reviewed
  | ExternalLabsStatus.cancelled
  | null;

export interface LabOrderDTO {
  orderId: string; // ServiceRequest.id
  typeLab: string; // ServiceRequest.contained[0](ActivityDefinition).title
  locationLab: string; // ServiceRequest.contained[0](ActivityDefinition).publisher
  orderAddedDate: string; // Task PST authoredOn
  providerName: string; // SR.requester name
  diagnoses: DiagnosisDTO[]; // SR.reasonCode
  orderedLabStatus: ExternalLabsStatus; // Derived from SR, Tasks and DiagnosticReports based on the mapping table
  reflexLabStatus: ReflexLabStatus; // the status of the last reflex task
  isPSC: boolean; // Derived from SR.orderDetail
  reflexResultsCount: number; // Number of DiagnosticReports with the same SR identifier but different test codes
  appointmentId: string;
  accessionNumber: string; // ordered results have an corresponding DiagnosticReport.identifier
  visitDate: string; // based on appointment
  orderedResultsReceivedDate: string; // the most recent Task RFRT.authoredOn
  dx: string; // SR.reasonCode joins
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

export interface GetLabOrdersParameters {
  encounterId?: string; // is specified, then we will fetch orders for that encounter
  patientId?: string; // is specified, then we will fetch orders for that patient
  serviceRequestId?: string; // is specified, then we will fetch orders for that service request

  orderableItemCode?: string; // search filter by lab
  visitDate?: string; // search filter by visit date

  itemsPerPage?: number; // pagination option;
  pageIndex?: number; // pagination option;
}
