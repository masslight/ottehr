import { Questionnaire, Encounter } from 'fhir/r4b';
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
  unparsed = '-', // for debugging purposes
}

/* previous types description:
    export interface MockLabOrderData {
      type: string; // ServiceRequest.code (representing test)
      location: string; // Organization.name (representing lab company)
      orderAdded: DateTime; // Task(1).authoredOn (we’ll reserve SR.authoredOn for when the SR is finished and sent to Oystehr)
      provider: string; // SR.requester -> Practitioner - user filling out the request form
      diagnosis: DiagnosisDTO; // SR.reasonCode
      // isPSC: boolean; // SR.performerType = PSC - this is shown in the figma but docs mention it being rolled back for MVP
      status: ExternalLabsStatus; // Task.status
    }
*/
export interface LabOrderDTO {
  id: string; // ServiceRequest.id
  type: string; // ServiceRequest.contained[0](ActivityDefinition).title
  location: string; // ServiceRequest.contained[0](ActivityDefinition).publisher
  orderAdded: string; // Task PST authoredOn
  provider: string; // SR.requester
  diagnoses: DiagnosisDTO[]; // SR.reasonCode
  status: ExternalLabsStatus; // Derived from SR, Tasks and DiagnosticReports based on the mapping table
  isPSC: boolean; // Derived from SR.orderDetail
  reflexTestsCount: number; // Number of DiagnosticReports with the same SR identifier but different test codes
  appointmentId: string;
  accessionNumber: string;
  visitDate: string;
  resultsReceived: string; // the most recent Task RFRT.authoredOn
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
  encounterId?: string;
  patientId?: string;
  serviceRequestId?: string;
  testType?: string;
  visitDate?: string;
  itemsPerPage?: number;
  pageIndex?: number;
}

export interface CreateLabOrderParameters {
  dx: DiagnosisDTO[];
  encounter: Encounter;
  practitionerId: string;
  orderableItem: OrderableItemSearchResult;
  psc: boolean;
}
export interface GetCreateLabOrderResources {
  encounter: Encounter;
}

export interface LabOrderResourcesRes {
  coverageName: string;
  labs: OrderableItemSearchResult[];
}
