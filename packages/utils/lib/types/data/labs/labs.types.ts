// cSpell:ignore RFRT
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
  ready = 'ready',
  sent = 'sent',
  prelim = 'prelim', // todo: this is not a status, need to refactor
  received = 'received',
  reviewed = 'reviewed',
  cancelled = 'cancelled',
  corrected = 'corrected',
  'cancelled by lab' = 'cancelled by lab',
  'sent manually' = 'sent manually',
  unknown = 'unknown', // for debugging purposes
}

export type LabOrderUnreceivedHistoryRow = {
  action: 'created' | 'performed' | 'ready' | 'ordered' | 'cancelled by lab';
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
  testType: 'reflex' | 'ordered' | 'unsolicited';
  resultType: 'final' | 'preliminary' | 'cancelled';
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

// todo maybe to improve - why do we have diagnosesDTO & diagnoses
export type LabOrderListPageDTO = {
  serviceRequestId: string; // ServiceRequest.id
  testItem: string; // ServiceRequest.contained[0](ActivityDefinition).title
  fillerLab: string; // ServiceRequest.contained[0](ActivityDefinition).publisher
  orderAddedDate: string; // Task PST authoredOn
  orderSubmittedDate: string | undefined; // Prov.recorded where activity.coding === PROVENANCE_ACTIVITY_CODING_ENTITY.submit
  orderingPhysician: string; // SR.requester name
  diagnosesDTO: DiagnosisDTO[]; // SR.reasonCode
  diagnoses: string; // SR.reasonCode joins
  orderStatus: ExternalLabsStatus; // Derived from SR, Tasks and DiagnosticReports based on the mapping table
  isPSC: boolean; // Derived from SR.orderDetail
  // todo sarah should probably kill this
  reflexResultsCount: number; // Number of DiagnosticReports with the same SR identifier but different test codes
  appointmentId: string;
  visitDate: string; // based on appointment
  lastResultReceivedDate: string; // the most recent Task RFRT.authoredOn
  accessionNumbers: string[]; // DiagnosticReport.identifier (identifier assigned to a sample when it arrives at a laboratory)
  encounterTimezone: string | undefined; // used to format dates correctly on the front end
  orderNumber: string | undefined; // ServiceRequest.identifier.value (system === OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM)
};

export type LabOrderDetailedPageDTO = LabOrderListPageDTO & {
  accountNumber: string; // identifier.system === LAB_ACCOUNT_NUMBER_SYSTEM (organization identifier) [added if list requested by ServiceRequest id]
  history: LabOrderHistoryRow[];
  resultsDetails: LabOrderResultDetails[];
  questionnaire: QuestionnaireData[];
  samples: sampleDTO[];
  labelPdfUrl?: string; // will exist after test is marked ready
  orderPdfUrl?: string; // will exist after order is submitted
};

export type DiagnosticReportLabDetailPageDTO = Omit<
  LabOrderDetailedPageDTO,
  | 'serviceRequestId'
  | 'orderAddedDate'
  | 'orderSubmittedDate'
  | 'orderingPhysician'
  | 'diagnosesDTO'
  | 'diagnoses'
  | 'reflexResultsCount'
  | 'appointmentId'
  | 'visitDate'
  | 'encounterTimezone'
  | 'orderNumber'
  | 'accountNumber'
  | 'labelPdfUrl'
  | 'orderPdfUrl'
>;

export type ReflexLabDTO = DiagnosticReportLabDetailPageDTO & {
  isReflex: true;
  orderNumber: string;
};

export type UnsolicitedLabDTO = DiagnosticReportLabDetailPageDTO & {
  isUnsolicited: true;
  patientId: string;
};

export type LabOrderDTO<SearchBy extends LabOrdersSearchBy> = SearchBy extends {
  searchBy: { field: 'serviceRequestId' | 'diagnosticReportId' };
}
  ? LabOrderDetailedPageDTO
  : LabOrderListPageDTO;

export type PaginatedResponse<RequestParameters extends GetLabOrdersParameters = GetLabOrdersParameters> = {
  data: LabOrderDTO<RequestParameters>[];
  pagination: Pagination;
  patientLabItems?: PatientLabItem[];
  reflexResults: ReflexLabDTO[];
};

export type LabOrdersSearchBy = {
  searchBy:
    | { field: 'encounterId'; value: string }
    | { field: 'encounterIds'; value: string[] }
    | { field: 'patientId'; value: string }
    | { field: 'serviceRequestId'; value: string }
    | { field: 'diagnosticReportId'; value: string };
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
  unsolicited = 'unsolicited', // external but has less fhir resources available since it did not originate from ottehr
  reflex = 'reflex', // external but has less fhir resources available since it did not originate from ottehr
}

export type GetLabOrdersParameters = LabOrdersSearchBy & LabOrdersSearchFilters & LabOrdersPaginationOptions;

export interface DynamicAOEInput {
  [key: string]: any;
}

export type SubmitLabOrderInput = {
  serviceRequestIDs: string[];
  manualOrder: boolean;
};

export type SubmitLabOrderOutput = {
  orderPdfUrls: string[];
  failedOrdersByOrderNumber?: string[];
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
  saveOrderCollectionData: 'saveOrderCollectionData',
  cancelUnsolicitedResultTask: 'cancelUnsolicitedResultTask', // match or review tasks
  matchUnsolicitedResult: 'matchUnsolicitedResult',
} as const;

export type TaskReviewedParameters = {
  serviceRequestId: string | undefined; // will be undefined for unsolicited results
  taskId: string;
  diagnosticReportId: string;
};

export type SpecimenDateChangedParameters = {
  serviceRequestId: string;
  specimenId: string;
  date: string;
};

export type SpecimenCollectionDateConfig = {
  [specimenId: string]: {
    date: string;
  };
};

export type SaveOrderCollectionData = {
  serviceRequestId: string;
  data: DynamicAOEInput;
  specimenCollectionDates?: SpecimenCollectionDateConfig;
};

export type CancelMatchUnsolicitedResultTask = {
  event: typeof LAB_ORDER_UPDATE_RESOURCES_EVENTS.cancelUnsolicitedResultTask;
  taskId: string;
};

export type FinalizeUnsolicitedResultMatch = {
  event: typeof LAB_ORDER_UPDATE_RESOURCES_EVENTS.matchUnsolicitedResult;
  taskId: string;
  diagnosticReportId: string;
  patientToMatchId: string;
  srToMatchId?: string;
};

export type UpdateLabOrderResourcesInput =
  | (TaskReviewedParameters & { event: typeof LAB_ORDER_UPDATE_RESOURCES_EVENTS.reviewed })
  | (SpecimenDateChangedParameters & { event: typeof LAB_ORDER_UPDATE_RESOURCES_EVENTS.specimenDateChanged })
  | (SaveOrderCollectionData & { event: typeof LAB_ORDER_UPDATE_RESOURCES_EVENTS.saveOrderCollectionData })
  | CancelMatchUnsolicitedResultTask
  | FinalizeUnsolicitedResultMatch;

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

export enum UnsolicitedResultsRequestType {
  UNSOLICITED_RESULTS_ICON = 'unsolicited-results-icon',
  GET_TABLE_ROWS = 'get-table-rows',
  MATCH_UNSOLICITED_RESULTS = 'match-unsolicited-result',
  GET_UNSOLICITED_RESULTS_RELATED_REQUESTS = 'get-unsolicited-results-related-requests',
  UNSOLICITED_RESULT_DETAIL = 'unsolicited-result-detail',
}

export type GetUnsolicitedResultsResourcesForIconInput = {
  requestType: UnsolicitedResultsRequestType.UNSOLICITED_RESULTS_ICON;
};
export type GetUnsolicitedResultsResourcesForTableInput = {
  requestType: UnsolicitedResultsRequestType.GET_TABLE_ROWS;
};
export type GetUnsolicitedResultsResourcesForMatchInput = {
  requestType: UnsolicitedResultsRequestType.MATCH_UNSOLICITED_RESULTS;
  diagnosticReportId: string;
};
export type GetUnsolicitedResultsRelatedRequests = {
  requestType: UnsolicitedResultsRequestType.GET_UNSOLICITED_RESULTS_RELATED_REQUESTS;
  diagnosticReportId: string;
  patientId: string;
};
export type GetUnsolicitedResultsResourcesForReview = {
  requestType: UnsolicitedResultsRequestType.UNSOLICITED_RESULT_DETAIL;
  diagnosticReportId: string;
};

export type GetUnsolicitedResultsResourcesInput =
  | GetUnsolicitedResultsResourcesForIconInput
  | GetUnsolicitedResultsResourcesForTableInput
  | GetUnsolicitedResultsResourcesForMatchInput
  | GetUnsolicitedResultsRelatedRequests
  | GetUnsolicitedResultsResourcesForReview;

export const UR_TASK_ACTION_TEXT = ['Match', 'Go to Lab Results'] as const;
export type UR_TASK_ACTION = (typeof UR_TASK_ACTION_TEXT)[number];

export type UnsolicitedResultTaskRowDTO = {
  diagnosticReportId: string;
  actionText: UR_TASK_ACTION;
  actionUrl: string;
  taskRowDescription: string;
  resultsReceivedDateTime: string;
};

export type GetUnsolicitedResultsResourcesForIcon = {
  tasksAreReady: boolean;
};
export type GetUnsolicitedResultsResourcesForTable = {
  unsolicitedResultRows: UnsolicitedResultTaskRowDTO[];
};
export type GetUnsolicitedResultsResourcesForMatch = {
  labInfo: {
    patientName?: string;
    patientDOB?: string;
    provider?: string;
    test?: string;
    labName?: string;
    resultsReceived?: string;
  };
  taskId: string;
};
export type RelatedRequestsToUnsolicitedResultOutput = {
  possibleRelatedSRsWithVisitDate:
    | {
        serviceRequestId: string;
        visitDate: string;
      }[]
    | null;
};

export type GetUnsolicitedResultsReviewResourcesOutput = {
  labOrder: UnsolicitedLabDTO;
};

export type GetUnsolicitedResultsResourcesOutput =
  | GetUnsolicitedResultsResourcesForIcon
  | GetUnsolicitedResultsResourcesForTable
  | GetUnsolicitedResultsResourcesForMatch
  | RelatedRequestsToUnsolicitedResultOutput
  | GetUnsolicitedResultsReviewResourcesOutput;
