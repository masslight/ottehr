import {
  DocumentReference,
  Encounter,
  Questionnaire,
  QuestionnaireResponse,
  QuestionnaireResponseItem,
  Reference,
} from 'fhir/r4b';
import { DiagnosisDTO, Pagination } from '../..';

export interface OrderableItemSearchResult {
  item: OrderableItem;
  lab: OrderableItemLab;
}

export interface sampleDTO {
  specimen: { id: string; collectionDate?: string }; // collectionDate exists after order is submitted
  definition: OrderableItemSpecimen;
}

// todo: maybe rename to OrderableItemSpecimenDefinition to fit the FHIR terms
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
  prelim = 'prelim', // todo: this is not a status, need to refactor
  received = 'received',
  reviewed = 'reviewed',
  cancelled = 'cancelled',
  corrected = 'corrected',
  unknown = 'unknown', // for debugging purposes
}

export type LabOrderUnreceivedHistoryRow = {
  action: 'ordered' | 'performed';
  performer: string;
  date: string;
};

export type LabOrderReceivedHistoryRow = {
  action: 'received' | 'reviewed' | 'corrected';
  testType: 'reflex' | 'ordered';
  performer: string;
  date: string;
};

export type LabOrderHistoryRow = LabOrderUnreceivedHistoryRow | LabOrderReceivedHistoryRow;

export type LabOrderResultDetails = {
  testItem: string;
  testType: 'reflex' | 'ordered';
  resultType: 'final' | 'preliminary';
  labStatus: ExternalLabsStatus;
  diagnosticReportId: string;
  taskId: string;
  receivedDate: string;
  reviewedDate: string | null;
  resultPdfUrl: string | null;
};

export type QuestionnaireData = {
  questionnaire: Questionnaire;
  questionnaireResponse: QuestionnaireResponse;
  questionnaireResponseItems: QuestionnaireResponseItem[];
  serviceRequestId: string;
};

export type LabOrderListPageDTO = {
  serviceRequestId: string; // ServiceRequest.id
  testItem: string; // ServiceRequest.contained[0](ActivityDefinition).title
  fillerLab: string; // ServiceRequest.contained[0](ActivityDefinition).publisher
  orderAddedDate: string; // Task PST authoredOn
  orderingPhysician: string; // SR.requester name
  diagnosesDTO: DiagnosisDTO[]; // SR.reasonCode
  diagnoses: string; // SR.reasonCode joins
  orderStatus: ExternalLabsStatus; // Derived from SR, Tasks and DiagnosticReports based on the mapping table
  isPSC: boolean; // Derived from SR.orderDetail
  reflexResultsCount: number; // Number of DiagnosticReports with the same SR identifier but different test codes
  appointmentId: string;
  visitDate: string; // based on appointment
  lastResultReceivedDate: string; // the most recent Task RFRT.authoredOn
  accessionNumbers: string[]; // DiagnosticReport.identifier (identifier assigned to a sample when it arrives at a laboratory)
  encounterTimezone: string | undefined; // used to format dates correctly on the front end
};

export type LabOrderDetailedPageDTO = LabOrderListPageDTO & {
  accountNumber: string; // identifier.system === LAB_ACCOUNT_NUMBER_SYSTEM (organization identifier) [added if list requested by ServiceRequest id]
  history: LabOrderHistoryRow[];
  resultsDetails: LabOrderResultDetails[];
  questionnaire: QuestionnaireData[];
  samples: sampleDTO[];
  orderPdfUrl?: string; // will exist after order is submitted
};

export type LabOrderDTO<SearchBy extends LabOrdersSearchBy> = SearchBy extends {
  searchBy: { field: 'serviceRequestId' };
}
  ? LabOrderDetailedPageDTO
  : LabOrderListPageDTO;

export type PaginatedResponse<RequestParameters extends GetLabOrdersParameters = GetLabOrdersParameters> = {
  data: LabOrderDTO<RequestParameters>[];
  pagination: Pagination;
  patientLabItems?: PatientLabItem[];
};

export type LabOrdersSearchBy = {
  searchBy:
    | { field: 'encounterId'; value: string }
    | { field: 'encounterIds'; value: string[] }
    | { field: 'patientId'; value: string }
    | { field: 'serviceRequestId'; value: string };
};

export type LabOrdersSearchFilters = {
  orderableItemCode?: string;
  visitDate?: string;
};

export type LabOrdersPaginationOptions = {
  itemsPerPage?: number;
  pageIndex?: number;
};

export enum LabType {
  external = 'external',
  inHouse = 'in-house',
}

export type GetLabOrdersParameters = LabOrdersSearchBy & LabOrdersSearchFilters & LabOrdersPaginationOptions;

export interface DynamicAOEInput {
  [key: string]: any;
}

export type SubmitLabOrderInput = {
  serviceRequestID: string;
  accountNumber: string;
  data: DynamicAOEInput;
  specimens?: {
    [specimenId: string]: {
      date: string;
    };
  };
};

export type SubmitLabOrderDTO = {
  orderPdfUrl: string;
  labelPdfUrl?: string;
};

export type CreateLabOrderParameters = {
  dx: DiagnosisDTO[];
  encounter: Encounter;
  orderableItem: OrderableItemSearchResult;
  psc: boolean;
};

export type CreateLabOrderZambdaOutput = Record<string, never>;

export type GetCreateLabOrderResources = {
  patientId?: string;
  search?: string;
};

export type LabOrderResourcesRes = {
  coverageName?: string;
  labs: OrderableItemSearchResult[];
};

export type PatientLabItem = {
  code: string; // ActivityDefinition.code.coding[0].code
  display: string; // ActivityDefinition.code.coding[0].display
};

export const LAB_ORDER_UPDATE_RESOURCES_EVENTS = {
  reviewed: 'reviewed',
  specimenDateChanged: 'specimenDateChanged',
} as const;

export type TaskReviewedParameters = {
  serviceRequestId: string;
  taskId: string;
  diagnosticReportId: string;
};

export type SpecimenDateChangedParameters = {
  serviceRequestId: string;
  specimenId: string;
  date: string;
};

export type UpdateLabOrderResourcesParameters =
  | (TaskReviewedParameters & { event: typeof LAB_ORDER_UPDATE_RESOURCES_EVENTS.reviewed })
  | (SpecimenDateChangedParameters & { event: typeof LAB_ORDER_UPDATE_RESOURCES_EVENTS.specimenDateChanged });

export type DeleteLabOrderZambdaInput = {
  serviceRequestId: string;
};

export type DeleteLabOrderZambdaOutput = Record<string, never>;
export interface LabelConfig {
  heightInches: number;
  widthInches: number;
  marginTopInches: number;
  marginBottomInches: number;
  marginLeftInches: number;
  marginRightInches: number;
  printerDPI: number;
}
export interface GetLabelPdfParameters {
  contextRelatedReference: Reference;
  searchParams: { name: string; value: string }[];
}

export interface LabelPdf {
  documentReference: DocumentReference;
  presignedURL: string;
}

export type LabOrderPDF = {
  presignedURL: string;
  serviceRequestId: string;
  docRefId: string;
};

export type LabResultPDF = {
  presignedURL: string;
  diagnosticReportId: string;
};
