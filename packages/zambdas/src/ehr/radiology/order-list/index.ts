import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Appointment,
  DiagnosticReport,
  DocumentReference,
  Encounter,
  Practitioner,
  ServiceRequest,
  Task,
} from 'fhir/r4b';
import {
  DIAGNOSTIC_REPORT_PRELIMINARY_REVIEW_ON_EXTENSION_URL,
  FHIR_EXTENSION,
  formatDate,
  getExtension,
  getFullestAvailableName,
  GetRadiologyOrderListZambdaInput,
  GetRadiologyOrderListZambdaOrder,
  GetRadiologyOrderListZambdaOutput,
  isPositiveNumberOrZero,
  ORDER_TYPE_CODE_SYSTEM,
  Pagination,
  RADIOLOGY_TASK,
  RadiologyOrderHistoryRow,
  RadiologyOrderStatus,
  SERVICE_REQUEST_NEEDS_TO_BE_SENT_TO_TELERADIOLOGY_EXTENSION_URL,
  SERVICE_REQUEST_PERFORMED_ON_EXTENSION_URL,
  SERVICE_REQUEST_REQUESTED_TIME_EXTENSION_URL,
  Task as OttehrTask,
  TASK_ASSIGNED_DATE_TIME_EXTENSION_URL,
} from 'utils';
import { checkOrCreateM2MClientToken, createClinicalOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import {
  makeRadiologyDTO,
  takeMostRecentPreliminaryReport,
  takeTheBestFinalDiagnosticReport,
} from '../../../shared/radiology';
import { isCurrentRadiologyResultDocRef } from '../shared/result-doc-refs';
import { validateInput, validateSecrets } from './validation';

// Types
export interface ValidatedInput {
  body: Omit<GetRadiologyOrderListZambdaInput, 'encounterIds'> & { encounterIds?: string[] };
  callerAccessToken: string;
}

export const DEFAULT_RADIOLOGY_ITEMS_PER_PAGE = 20;

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

const ZAMBDA_NAME = 'radiology-order-list';

export const index = wrapHandler(ZAMBDA_NAME, async (unsafeInput: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log('input body, ', JSON.stringify(unsafeInput.body));

  const secrets = validateSecrets(unsafeInput.secrets);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const validatedInput = await validateInput(unsafeInput);

  const response = await performEffect(validatedInput, oystehr);

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

const performEffect = async (
  validatedInput: ValidatedInput,
  oystehr: Oystehr
): Promise<GetRadiologyOrderListZambdaOutput> => {
  const {
    encounterIds,
    patientId,
    serviceRequestId,
    itemsPerPage = DEFAULT_RADIOLOGY_ITEMS_PER_PAGE,
    pageIndex = 0,
  } = validatedInput.body;

  const searchParams = {
    patientId,
    encounterIds,
    serviceRequestId,
    itemsPerPage,
    pageIndex,
  };

  return await getRadiologyOrders(oystehr, searchParams);
};

export const getRadiologyOrders = async (
  oystehr: Oystehr,
  {
    encounterIds,
    patientId,
    serviceRequestId,
    itemsPerPage = 100,
    pageIndex = 0,
  }: {
    encounterIds?: string[];
    patientId?: string;
    serviceRequestId?: string;
    itemsPerPage?: number;
    pageIndex?: number;
  }
): Promise<GetRadiologyOrderListZambdaOutput> => {
  const searchParams = [
    { name: '_total', value: 'accurate' },
    { name: '_offset', value: `${pageIndex * itemsPerPage}` },
    { name: '_count', value: `${itemsPerPage}` },
    { name: '_sort', value: '-_lastUpdated' },
    { name: '_revinclude', value: 'Task:based-on' },
    { name: '_revinclude', value: 'DiagnosticReport:based-on' },
    { name: '_revinclude', value: 'DocumentReference:related' },
    { name: '_include', value: 'ServiceRequest:requester' },
    { name: '_include', value: 'ServiceRequest:encounter' },
    { name: '_tag', value: `${ORDER_TYPE_CODE_SYSTEM}|radiology` },
    { name: 'status:not', value: 'revoked' },
  ];

  if (patientId) {
    searchParams.push({ name: 'subject', value: `Patient/${patientId}` });
  } else if (serviceRequestId) {
    searchParams.push({ name: '_id', value: serviceRequestId });
  } else if (encounterIds) {
    searchParams.push({
      name: 'encounter',
      value: encounterIds.map((id) => `Encounter/${id}`).join(','),
    });
  } else {
    throw new Error('Either encounterId or patientId must be provided, should not happen if validation step worked');
  }

  const searchResponse = await oystehr.fhir.search({
    resourceType: 'ServiceRequest',
    params: searchParams,
  });

  console.log('searchResponse', JSON.stringify(searchResponse, null, 2));

  const resources = (searchResponse.entry || [])
    .map((entry) => entry.resource)
    .filter((res): res is ServiceRequest | Task | Practitioner | DiagnosticReport | Encounter | DocumentReference =>
      Boolean(res)
    );

  const { serviceRequests, tasks, diagnosticReports, practitioners, encounters, documentReferences } =
    extractResources(resources);

  if (!serviceRequests.length) {
    return {
      orders: [],
      pagination: EMPTY_PAGINATION,
    };
  }

  const orders = serviceRequests.map((serviceRequest) =>
    parseResultsToOrder(serviceRequest, tasks, diagnosticReports, practitioners, encounters, documentReferences)
  );

  return {
    orders,
    pagination: parsePaginationFromResponse(searchResponse),
  };
};

const parseResultsToOrder = (
  serviceRequest: ServiceRequest,
  tasks: Task[],
  diagnosticReports: DiagnosticReport[],
  practitioners: Practitioner[],
  encounters: Encounter[],
  documentReferences: DocumentReference[]
): GetRadiologyOrderListZambdaOrder => {
  if (serviceRequest.id == null) {
    throw new Error('ServiceRequest ID is unexpectedly null');
  }

  const orderAddedDateTime = serviceRequest.authoredOn;
  if (!orderAddedDateTime) {
    throw new Error('Order added date time is unexpectedly null');
  }

  const myRequestingProvider = practitioners.find(
    (practitioner) => practitioner.id === serviceRequest.requester?.reference?.split('/')[1]
  );
  if (!myRequestingProvider) {
    throw new Error('Service Request has no requesting provider');
  }
  const providerName = getFullestAvailableName(myRequestingProvider);
  if (!providerName) {
    throw new Error('Provider name is unexpectedly null');
  }

  let status: RadiologyOrderStatus | undefined;

  const finalReviewTask = tasks.find((task) => {
    const basedOnSr = task.basedOn?.some((basedOn) => basedOn.reference === `ServiceRequest/${serviceRequest.id}`);
    const isRadiologyTask = task.groupIdentifier?.value === RADIOLOGY_TASK.category;
    const isFinalReview = task.code?.coding?.some(
      (c) => c.system === RADIOLOGY_TASK.system && c.code === RADIOLOGY_TASK.code.reviewFinalResultTask
    );
    return basedOnSr && isRadiologyTask && isFinalReview && task.status !== 'cancelled';
  });
  console.log('finalReviewTask found: ', finalReviewTask?.id);
  let formattedFinalReviewTask: OttehrTask | undefined;

  // Get all diagnostic reports related to this service request
  const relatedDiagnosticReports = diagnosticReports.filter(
    (report) => report.basedOn?.some((basedOn) => basedOn.reference === `ServiceRequest/${serviceRequest.id}`)
  );

  const preliminaryDiagnosticReport = takeMostRecentPreliminaryReport(relatedDiagnosticReports);

  const bestFinalReport = takeTheBestFinalDiagnosticReport(relatedDiagnosticReports);

  // Check if order is being or was sent for final read and we are awaiting the final read.
  const existingExtensions = serviceRequest.extension;
  const hasNeedsFinalReadExtension = existingExtensions?.some(
    (ext) => ext.url === SERVICE_REQUEST_NEEDS_TO_BE_SENT_TO_TELERADIOLOGY_EXTENSION_URL
  );

  if (serviceRequest.status === 'active') {
    status = RadiologyOrderStatus.pending;
  } else if (serviceRequest.status === 'completed' && !preliminaryDiagnosticReport && !bestFinalReport) {
    status = RadiologyOrderStatus.performed;
  } else if (preliminaryDiagnosticReport && !hasNeedsFinalReadExtension && !bestFinalReport) {
    status = RadiologyOrderStatus.preliminary;
  } else if (preliminaryDiagnosticReport && hasNeedsFinalReadExtension && !bestFinalReport) {
    status = RadiologyOrderStatus.pendingFinal;
  } else if (bestFinalReport?.status === 'final') {
    if (finalReviewTask?.status === 'completed') {
      status = RadiologyOrderStatus.reviewed;
    } else {
      status = RadiologyOrderStatus.final;
      if (finalReviewTask) {
        const orderDate = serviceRequest.extension?.find(
          (ext) => ext.url === SERVICE_REQUEST_REQUESTED_TIME_EXTENSION_URL
        )?.valueDateTime;
        let taskSubtitle = `Ordered by ${providerName} on ${formatDate(orderDate ?? '', 'MM/dd/yyyy h:mm a')}`;
        if (finalReviewTask?.location?.display) {
          taskSubtitle += ` | ${finalReviewTask?.location?.display}`;
        }
        formattedFinalReviewTask = {
          id: finalReviewTask?.id || '',
          category: RADIOLOGY_TASK.category,
          createdDate: finalReviewTask?.authoredOn ?? '',
          title: 'Review Radiology Final Results',
          subtitle: taskSubtitle,
          status: finalReviewTask?.status || 'unknown',
          assignee: finalReviewTask?.owner
            ? {
                id: finalReviewTask.owner?.reference?.split('/')?.[1] ?? '',
                name: finalReviewTask.owner?.display ?? '',
                date: getExtension(finalReviewTask.owner, TASK_ASSIGNED_DATE_TIME_EXTENSION_URL)?.valueDateTime ?? '',
              }
            : undefined,
          completable: true,
        };
      }
    }
  } else {
    throw new Error('Order is in an invalid state, could not determine status.');
  }

  // External (print-only) orders never flow through AdvaPACS; they use a simplified lifecycle driven by
  // manually-attached result DocumentReferences: `ordered` until a result exists, then `reviewed`. Deriving
  // it here (rather than persisting on the SR) keeps the status and history in sync as results are added
  // or deleted. The AdvaPACS-derived status/history above is overridden entirely for these orders.
  const isExternal = !!getExtension(serviceRequest, FHIR_EXTENSION.ServiceRequest.externalRadiologyOrder.url)
    ?.valueBoolean;
  const resultDocRefs = documentReferences.filter((docRef) =>
    isCurrentRadiologyResultDocRef(docRef, serviceRequest.id ?? '')
  );
  if (isExternal) {
    status = resultDocRefs.length > 0 ? RadiologyOrderStatus.reviewed : RadiologyOrderStatus.ordered;
  }

  const appointmentId = parseAppointmentId(serviceRequest, encounters);

  const history = isExternal
    ? buildExternalHistory(serviceRequest, providerName, resultDocRefs)
    : buildHistory(serviceRequest, bestFinalReport, preliminaryDiagnosticReport, providerName, finalReviewTask);

  const consentObtained = !!getExtension(serviceRequest, FHIR_EXTENSION.ServiceRequest.consentObtained.url)
    ?.valueBoolean;

  const radiologyDTO = makeRadiologyDTO(serviceRequest, preliminaryDiagnosticReport, bestFinalReport);

  return {
    ...radiologyDTO,
    serviceRequestId: serviceRequest.id,
    appointmentId,
    visitDateTime: '', // TODO
    orderAddedDateTime,
    providerName,
    status,
    isStat: serviceRequest.priority === 'stat',
    history,
    task: formattedFinalReviewTask,
    consentObtained,
  };
};

// External (print-only) orders: a two-row history mirroring the ordered -> reviewed lifecycle.
const buildExternalHistory = (
  serviceRequest: ServiceRequest,
  orderingProviderName: string,
  resultDocRefs: DocumentReference[]
): RadiologyOrderHistoryRow[] => {
  const history: RadiologyOrderHistoryRow[] = [];

  const orderedDate =
    serviceRequest.extension?.find((ext) => ext.url === SERVICE_REQUEST_REQUESTED_TIME_EXTENSION_URL)?.valueDateTime ??
    serviceRequest.authoredOn ??
    '';
  history.push({ status: RadiologyOrderStatus.ordered, performer: orderingProviderName, date: orderedDate });

  const latestResultDocRef = resultDocRefs
    .filter((docRef) => docRef.date ?? docRef.meta?.lastUpdated)
    .sort((a, b) => (a.date ?? a.meta?.lastUpdated ?? '').localeCompare(b.date ?? b.meta?.lastUpdated ?? ''))
    .pop();
  if (latestResultDocRef) {
    history.push({
      status: RadiologyOrderStatus.reviewed,
      // The provider reviews and signs the result before uploading it, so the uploader
      // (recorded as the DocumentReference author) is the reviewer.
      performer: latestResultDocRef.author?.[0]?.display ?? '',
      date: latestResultDocRef.date ?? latestResultDocRef.meta?.lastUpdated ?? '',
    });
  }

  return history;
};

const buildHistory = (
  serviceRequest: ServiceRequest,
  bestDiagnosticReport: DiagnosticReport | undefined,
  preliminaryDiagnosticReport: DiagnosticReport | undefined,
  orderingProviderName: string,
  finalReviewTask?: Task
): RadiologyOrderHistoryRow[] => {
  const history: RadiologyOrderHistoryRow[] = [];

  const requestedTimeExtensionValue = serviceRequest.extension?.find(
    (ext) => ext.url === SERVICE_REQUEST_REQUESTED_TIME_EXTENSION_URL
  )?.valueDateTime;
  if (requestedTimeExtensionValue) {
    history.push({
      status: RadiologyOrderStatus.pending,
      performer: orderingProviderName,
      date: requestedTimeExtensionValue,
    });
  }

  const performedHistoryExtensionValue = serviceRequest.extension?.find(
    (ext) => ext.url === SERVICE_REQUEST_PERFORMED_ON_EXTENSION_URL
  )?.valueDateTime;
  if (performedHistoryExtensionValue) {
    history.push({
      status: RadiologyOrderStatus.performed,
      performer: '',
      date: performedHistoryExtensionValue,
    });
  }

  const diagnosticReportPreliminaryReadTimeExtensionValueFromBest = bestDiagnosticReport?.extension?.find(
    (ext) => ext.url === DIAGNOSTIC_REPORT_PRELIMINARY_REVIEW_ON_EXTENSION_URL
  )?.valueDateTime;
  const diagnosticReportPreliminaryReadTimeExtensionValueFromPreliminary = preliminaryDiagnosticReport?.extension?.find(
    (ext) => ext.url === DIAGNOSTIC_REPORT_PRELIMINARY_REVIEW_ON_EXTENSION_URL
  )?.valueDateTime;
  if (diagnosticReportPreliminaryReadTimeExtensionValueFromBest) {
    history.push({
      status: RadiologyOrderStatus.preliminary,
      performer: '',
      date: diagnosticReportPreliminaryReadTimeExtensionValueFromBest,
    });
  } else if (diagnosticReportPreliminaryReadTimeExtensionValueFromPreliminary) {
    history.push({
      status: RadiologyOrderStatus.preliminary,
      performer: '',
      date: diagnosticReportPreliminaryReadTimeExtensionValueFromPreliminary,
    });
  }

  // Check if order is being or was sent for final read and we are awaiting the final read.
  const existingExtensions = serviceRequest.extension;
  const hasNeedsFinalReadExtension = existingExtensions?.some(
    (ext) => ext.url === SERVICE_REQUEST_NEEDS_TO_BE_SENT_TO_TELERADIOLOGY_EXTENSION_URL
  );
  if (hasNeedsFinalReadExtension) {
    const needsFinalReadExtensionValue = existingExtensions?.find(
      (ext) => ext.url === SERVICE_REQUEST_NEEDS_TO_BE_SENT_TO_TELERADIOLOGY_EXTENSION_URL
    )?.valueDateTime;
    if (needsFinalReadExtensionValue) {
      history.push({
        status: RadiologyOrderStatus.pendingFinal,
        performer: '',
        date: needsFinalReadExtensionValue,
      });
    }
  }

  if (bestDiagnosticReport) {
    history.push({
      status: RadiologyOrderStatus.final,
      performer: '',
      date: bestDiagnosticReport.issued || bestDiagnosticReport.meta?.lastUpdated || '',
    });
  }

  if (finalReviewTask && finalReviewTask.status === 'completed') {
    const date =
      finalReviewTask.owner?.extension?.find((ext) => ext.url === TASK_ASSIGNED_DATE_TIME_EXTENSION_URL)
        ?.valueDateTime ?? '';
    history.push({
      status: RadiologyOrderStatus.reviewed,
      performer: finalReviewTask.owner?.display ?? '',
      date,
    });
  }

  return history;
};

const extractResources = (
  resources: (ServiceRequest | Task | Practitioner | DiagnosticReport | Encounter | Appointment | DocumentReference)[]
): {
  serviceRequests: ServiceRequest[];
  tasks: Task[];
  diagnosticReports: DiagnosticReport[];
  practitioners: Practitioner[];
  encounters: Encounter[];
  documentReferences: DocumentReference[];
} => {
  const serviceRequests: ServiceRequest[] = [];
  const tasks: Task[] = [];
  const results: DiagnosticReport[] = [];
  const practitioners: Practitioner[] = [];
  const encounters: Encounter[] = [];
  const documentReferences: DocumentReference[] = [];

  for (const resource of resources) {
    if (resource.resourceType === 'ServiceRequest') {
      serviceRequests.push(resource as ServiceRequest);
    } else if (resource.resourceType === 'Task') {
      tasks.push(resource as Task);
    } else if (resource.resourceType === 'DiagnosticReport') {
      results.push(resource as DiagnosticReport);
    } else if (resource.resourceType === 'Practitioner') {
      practitioners.push(resource as Practitioner);
    } else if (resource.resourceType === 'Encounter') {
      encounters.push(resource as Encounter);
    } else if (resource.resourceType === 'DocumentReference') {
      documentReferences.push(resource as DocumentReference);
    }
  }

  return {
    serviceRequests,
    tasks,
    diagnosticReports: results,
    practitioners,
    encounters,
    documentReferences,
  };
};

export const EMPTY_PAGINATION: Pagination = {
  currentPageIndex: 0,
  totalItems: 0,
  totalPages: 0,
};

export const parsePaginationFromResponse = (data: {
  total?: number;
  link?: Array<{ relation: string; url: string }>;
}): Pagination => {
  if (!data || typeof data.total !== 'number' || !Array.isArray(data.link)) {
    return EMPTY_PAGINATION;
  }

  const selfLink = data.link.find((link) => link && link.relation === 'self');

  if (!selfLink || !selfLink.url) {
    return EMPTY_PAGINATION;
  }

  const totalItems = data.total;
  const selfUrl = new URL(selfLink.url);
  const itemsPerPageStr = selfUrl.searchParams.get('_count');

  if (!itemsPerPageStr) {
    return EMPTY_PAGINATION;
  }

  const itemsPerPage = parseInt(itemsPerPageStr, 10);

  if (!isPositiveNumberOrZero(itemsPerPage)) {
    return EMPTY_PAGINATION;
  }

  const selfOffsetStr = selfUrl.searchParams.get('_offset');
  const selfOffset = selfOffsetStr ? parseInt(selfOffsetStr, 10) : 0;
  const currentPageIndex = !isNaN(selfOffset) ? Math.floor(selfOffset / itemsPerPage) : 0;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  return {
    currentPageIndex,
    totalItems,
    totalPages,
  };
};

export const parseAppointmentId = (serviceRequest: ServiceRequest, encounters: Encounter[]): string => {
  const encounterId = parseEncounterId(serviceRequest);
  const NOT_FOUND = '';

  if (!encounterId) {
    return NOT_FOUND;
  }

  const relatedEncounter = encounters.find((encounter) => encounter.id === encounterId);

  if (relatedEncounter?.appointment?.length) {
    return relatedEncounter.appointment[0]?.reference?.split('/').pop() || NOT_FOUND;
  }

  return NOT_FOUND;
};

const parseEncounterId = (serviceRequest: ServiceRequest): string => {
  const NOT_FOUND = '';
  return serviceRequest.encounter?.reference?.split('/').pop() || NOT_FOUND;
};
