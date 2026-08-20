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
import { FHIR_EXTENSION, TASK_ASSIGNED_DATE_TIME_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { getExtension } from 'utils/lib/fhir/helpers';
import { getFullestAvailableName } from 'utils/lib/fhir/patient';
import {
  DIAGNOSTIC_REPORT_PRELIMINARY_REVIEW_ON_EXTENSION_URL,
  ORDER_TYPE_CODE_SYSTEM,
  SERVICE_REQUEST_NEEDS_TO_BE_SENT_TO_TELERADIOLOGY_EXTENSION_URL,
  SERVICE_REQUEST_PERFORMED_ON_EXTENSION_URL,
  SERVICE_REQUEST_REQUESTED_TIME_EXTENSION_URL,
  SERVICE_REQUEST_SENT_FOR_FINAL_READ_BY_EXTENSION_URL,
} from 'utils/lib/fhir/radiology';
import { Secrets } from 'utils/lib/secrets';
import {
  GetRadiologyOrderListZambdaInput,
  GetRadiologyOrderListZambdaOrder,
  GetRadiologyOrderListZambdaOutput,
  RadiologyOrderHistoryRow,
  RadiologyOrderStatus,
} from 'utils/lib/types/api/radiology';
import { Pagination } from 'utils/lib/types/data/pagination.types';
import { RADIOLOGY_TASK, Task as OttehrTask } from 'utils/lib/types/data/tasks/types';
import { formatDate } from 'utils/lib/utils/date';
import { isPositiveNumberOrZero } from 'utils/lib/validation/helper';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { getMyPractitionerId } from '../../../shared/practitioners';
import {
  findRadiologyFinalReviewTask,
  getOrderingProviderIds,
  getReportAuthor,
  getReportAuthorId,
  makeRadiologyDTO,
  resolveOrderingProvider,
  takeMostRecentPreliminaryReport,
  takeTheBestFinalDiagnosticReport,
} from '../../../shared/radiology';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
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

  const response = await performEffect(validatedInput, secrets, oystehr);

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

const performEffect = async (
  validatedInput: ValidatedInput,
  secrets: Secrets,
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
    callerPractitionerId: await resolveCallerPractitionerId(validatedInput.callerAccessToken, secrets),
  };

  return await getRadiologyOrders(oystehr, searchParams);
};

/**
 * Who is asking, for the edit affordances below. Users without a Practitioner profile (admins) must still be
 * able to read the list, so failing to resolve one costs them the affordance and nothing else.
 */
const resolveCallerPractitionerId = async (
  callerAccessToken: string,
  secrets: Secrets
): Promise<string | undefined> => {
  try {
    return await getMyPractitionerId(callerAccessToken, secrets);
  } catch (error) {
    console.warn('Could not resolve the calling user to a Practitioner; final reads will be read-only.', error);
    return undefined;
  }
};

export const getRadiologyOrders = async (
  oystehr: Oystehr,
  {
    encounterIds,
    patientId,
    serviceRequestId,
    itemsPerPage = 100,
    pageIndex = 0,
    callerPractitionerId,
  }: {
    encounterIds?: string[];
    patientId?: string;
    serviceRequestId?: string;
    itemsPerPage?: number;
    pageIndex?: number;
    callerPractitionerId?: string;
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
    // The visit's attending provider is the ordering provider we display; see `resolveOrderingProvider`.
    { name: '_include:iterate', value: 'Encounter:participant:Practitioner' },
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
    parseResultsToOrder(
      serviceRequest,
      tasks,
      diagnosticReports,
      practitioners,
      encounters,
      documentReferences,
      callerPractitionerId
    )
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
  documentReferences: DocumentReference[],
  callerPractitionerId: string | undefined
): GetRadiologyOrderListZambdaOrder => {
  if (serviceRequest.id == null) {
    throw new Error('ServiceRequest ID is unexpectedly null');
  }

  const orderAddedDateTime = serviceRequest.authoredOn;
  if (!orderAddedDateTime) {
    throw new Error('Order added date time is unexpectedly null');
  }

  const encounter = encounters.find((enc) => enc.id === parseEncounterId(serviceRequest));

  const orderingProvider = resolveOrderingProvider(serviceRequest, encounter, practitioners);
  if (!orderingProvider) {
    throw new Error('Service Request has no requesting provider');
  }
  const providerName = getFullestAvailableName(orderingProvider);
  if (!providerName) {
    throw new Error('Provider name is unexpectedly null');
  }

  let status: RadiologyOrderStatus | undefined;

  const finalReviewTask = findRadiologyFinalReviewTask(tasks, serviceRequest.id);
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

  const radiologyDTO = makeRadiologyDTO(serviceRequest, preliminaryDiagnosticReport, bestFinalReport);

  const history = isExternal
    ? buildExternalHistory(serviceRequest, providerName, resultDocRefs)
    : buildHistory(
        serviceRequest,
        bestFinalReport,
        preliminaryDiagnosticReport,
        providerName,
        radiologyDTO.performedBy?.name,
        finalReviewTask
      );

  const consentObtained = !!getExtension(serviceRequest, FHIR_EXTENSION.ServiceRequest.consentObtained.url)
    ?.valueBoolean;

  return {
    ...radiologyDTO,
    serviceRequestId: serviceRequest.id,
    appointmentId,
    visitDateTime: '', // TODO
    orderAddedDateTime,
    providerName,
    providerId: orderingProvider.id ?? '',
    canEditPreliminaryReport: canCallerEditReport(
      serviceRequest,
      encounter,
      preliminaryDiagnosticReport,
      status,
      callerPractitionerId
    ),
    canEditFinalReport: canCallerEditReport(serviceRequest, encounter, bestFinalReport, status, callerPractitionerId),
    status,
    isStat: serviceRequest.priority === 'stat',
    history,
    task: formattedFinalReviewTask,
    consentObtained,
  };
};

/**
 * Whether the caller may correct a read — the same rule for both of them: they must have written it and have
 * ordered the study, and the order must not yet be signed off. One function rather than one per read, so the
 * two can't drift apart.
 *
 * "Ordered it" means either identity the order carries (see `getOrderingProviderIds`) — a nurse routinely
 * places the order on the provider's behalf, so requiring one specific one would lock out the author in
 * whichever case didn't match. A read with no author of ours (anything teleradiology issued, and any read
 * written before authorship was recorded) matches nobody and is therefore read-only.
 *
 * `radiology-update-report` enforces this on save; this is what tells the UI whether to offer the pencil.
 */
export const canCallerEditReport = (
  serviceRequest: ServiceRequest,
  encounter: Encounter | undefined,
  report: DiagnosticReport | undefined,
  status: RadiologyOrderStatus,
  callerPractitionerId: string | undefined
): boolean =>
  !!callerPractitionerId &&
  status !== RadiologyOrderStatus.reviewed &&
  getReportAuthorId(report) === callerPractitionerId &&
  getOrderingProviderIds(serviceRequest, encounter).includes(callerPractitionerId);

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

export const buildHistory = (
  serviceRequest: ServiceRequest,
  bestDiagnosticReport: DiagnosticReport | undefined,
  preliminaryDiagnosticReport: DiagnosticReport | undefined,
  orderingProviderName: string,
  performedByName: string | undefined,
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
      performer: performedByName ?? '',
      date: performedHistoryExtensionValue,
    });
  }

  const diagnosticReportPreliminaryReadTimeExtensionValueFromBest = bestDiagnosticReport?.extension?.find(
    (ext) => ext.url === DIAGNOSTIC_REPORT_PRELIMINARY_REVIEW_ON_EXTENSION_URL
  )?.valueDateTime;
  const diagnosticReportPreliminaryReadTimeExtensionValueFromPreliminary = preliminaryDiagnosticReport?.extension?.find(
    (ext) => ext.url === DIAGNOSTIC_REPORT_PRELIMINARY_REVIEW_ON_EXTENSION_URL
  )?.valueDateTime;
  // Prefer the preliminary report itself. The fallback covers orders finalized before the preliminary read
  // was kept as its own resource, and leaves the performer blank there: that report's `performer` is the
  // *final* read's author and must not stand in for this row.
  if (diagnosticReportPreliminaryReadTimeExtensionValueFromPreliminary) {
    history.push({
      status: RadiologyOrderStatus.preliminary,
      performer: getReportAuthor(preliminaryDiagnosticReport)?.display ?? '',
      date: diagnosticReportPreliminaryReadTimeExtensionValueFromPreliminary,
    });
  } else if (diagnosticReportPreliminaryReadTimeExtensionValueFromBest) {
    history.push({
      status: RadiologyOrderStatus.preliminary,
      performer: '',
      date: diagnosticReportPreliminaryReadTimeExtensionValueFromBest,
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
        // Who sent it for the final read, recorded by send-for-final-read alongside the timestamp.
        performer:
          existingExtensions?.find((ext) => ext.url === SERVICE_REQUEST_SENT_FOR_FINAL_READ_BY_EXTENSION_URL)
            ?.valueReference?.display ?? '',
        date: needsFinalReadExtensionValue,
      });
    }
  }

  if (bestDiagnosticReport) {
    history.push({
      status: RadiologyOrderStatus.final,
      // Blank for teleradiology's reads, which arrive from AdvaPACS with no name we can show.
      performer: getReportAuthor(bestDiagnosticReport)?.display ?? '',
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
