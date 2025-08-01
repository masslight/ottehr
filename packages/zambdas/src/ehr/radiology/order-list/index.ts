import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, DiagnosticReport, Encounter, Practitioner, ServiceRequest, Task } from 'fhir/r4b';
import {
  GetRadiologyOrderListZambdaInput,
  GetRadiologyOrderListZambdaOrder,
  GetRadiologyOrderListZambdaOutput,
  isPositiveNumberOrZero,
  Pagination,
  RadiologyOrderHistoryRow,
  RadiologyOrderStatus,
  RoleType,
  Secrets,
  User,
} from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import {
  DIAGNOSTIC_REPORT_PRELIMINARY_REVIEW_ON_EXTENSION_URL,
  ORDER_TYPE_CODE_SYSTEM,
  SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_CODE_URL,
  SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_URL,
  SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_VALUE_STRING_URL,
  SERVICE_REQUEST_ORDER_DETAIL_PRE_RELEASE_URL,
  SERVICE_REQUEST_PERFORMED_ON_EXTENSION_URL,
  SERVICE_REQUEST_REQUESTED_TIME_EXTENSION_URL,
} from '../shared';
import { validateInput, validateSecrets } from './validation';

// Types
export interface ValidatedInput {
  body: Omit<GetRadiologyOrderListZambdaInput, 'encounterIds'> & { encounterIds?: string[] };
  callerAccessToken: string;
}

export const DEFAULT_RADIOLOGY_ITEMS_PER_PAGE = 10;

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

const ZAMBDA_NAME = 'radiology-order-list';

export const index = wrapHandler(ZAMBDA_NAME, async (unsafeInput: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const secrets = validateSecrets(unsafeInput.secrets);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const validatedInput = await validateInput(unsafeInput);

    await accessCheck(validatedInput.callerAccessToken, secrets);

    const response = await performEffect(validatedInput, oystehr);

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
});

const accessCheck = async (callerAccessToken: string, secrets: Secrets): Promise<void> => {
  const callerUser = await getCallerUserWithAccessToken(callerAccessToken, secrets);

  if (callerUser.profile.indexOf('Practitioner/') === -1) {
    throw new Error('Caller does not have a practitioner profile');
  }
  if (callerUser.roles?.find((role) => role.name === RoleType.Provider) === undefined) {
    throw new Error('Caller does not have provider role');
  }
};

const getCallerUserWithAccessToken = async (token: string, secrets: Secrets): Promise<User> => {
  const oystehr = createOystehrClient(token, secrets);
  return await oystehr.user.me();
};

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
    { name: '_include', value: 'ServiceRequest:requester' },
    { name: '_include', value: 'ServiceRequest:encounter' },
    { name: '_tag', value: `${ORDER_TYPE_CODE_SYSTEM}|radiology` },
    { name: 'status:not', value: 'revoked' },
  ];

  if (patientId) {
    searchParams.push({ name: 'subject', value: `Patient/${patientId}` });
  } else if (serviceRequestId) {
    searchParams.push({ name: '_id', value: serviceRequestId });
  } else if (encounterIds?.length) {
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
    .filter((res): res is ServiceRequest | Task | Practitioner | DiagnosticReport | Encounter => Boolean(res));

  const { serviceRequests, tasks, diagnosticReports, practitioners, encounters } = extractResources(resources);

  if (!serviceRequests.length) {
    return {
      orders: [],
      pagination: EMPTY_PAGINATION,
    };
  }

  const orders = serviceRequests.map((serviceRequest) =>
    parseResultsToOrder(serviceRequest, tasks, diagnosticReports, practitioners, encounters)
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
  encounters: Encounter[]
): GetRadiologyOrderListZambdaOrder => {
  if (serviceRequest.id == null) {
    throw new Error('ServiceRequest ID is unexpectedly null');
  }

  const cptCode = serviceRequest.code?.coding?.[0]?.code;
  if (!cptCode) {
    throw new Error('cptCode is unexpectedly null');
  }

  const diagnosisCode = serviceRequest.reasonCode?.[0]?.coding?.[0]?.code;
  if (!diagnosisCode) {
    throw new Error('diagnosisCode is unexpectedly null');
  }

  const diagnosisDisplay = serviceRequest.reasonCode?.[0]?.coding?.[0]?.display;
  if (!diagnosisDisplay) {
    throw new Error('diagnosisDisplay is unexpectedly null');
  }

  const cptCodeDisplay = serviceRequest.code?.coding?.[0]?.display;
  if (!cptCodeDisplay) {
    throw new Error('cptCodeDisplay is unexpectedly null');
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
  const providerFirstName = myRequestingProvider?.name?.[0]?.given?.[0];
  const providerLastName = myRequestingProvider?.name?.[0]?.family;
  if (!providerFirstName || !providerLastName) {
    throw new Error('Provider name is unexpectedly null');
  }
  const providerName = `${providerLastName}, ${providerFirstName}`;

  // TODO can we do provider requesting provider qualifications to render "MD"?

  let status: RadiologyOrderStatus | undefined;

  // TODO add task for 'reviewed' feature.
  // const myReviewTask = tasks.find((task) => {
  //   task.basedOn?.some((basedOn) => basedOn.reference === `ServiceRequest/${serviceRequest.id}`);
  // });

  // Get all diagnostic reports related to this service request
  const relatedDiagnosticReports = diagnosticReports.filter(
    (report) => report.basedOn?.some((basedOn) => basedOn.reference === `ServiceRequest/${serviceRequest.id}`)
  );

  // Find the best diagnostic report using our priority logic
  const preliminaryDiagnosticReport = relatedDiagnosticReports.find((report) => report.status === 'preliminary');
  const bestDiagnosticReport = takeTheBestDiagnosticReport(relatedDiagnosticReports);

  const result = bestDiagnosticReport?.presentedForm?.find((attachment) => attachment.contentType === 'text/html')
    ?.data;

  if (serviceRequest.status === 'active') {
    status = RadiologyOrderStatus.pending;
  } else if (serviceRequest.status === 'completed' && !bestDiagnosticReport) {
    status = RadiologyOrderStatus.performed;
  } else if (bestDiagnosticReport?.status === 'preliminary') {
    status = RadiologyOrderStatus.preliminary;
  } else if (bestDiagnosticReport?.status === 'final') {
    // && myReviewTask?.status === 'ready') {
    status = RadiologyOrderStatus.final;
    // } else if (myReviewTask?.status === 'completed') {
    //   status = RadiologyOrderStatus.reviewed;
  } else {
    throw new Error('Order is in an invalid state, could not determine status.');
  }

  const appointmentId = parseAppointmentId(serviceRequest, encounters);

  const history = buildHistory(serviceRequest, bestDiagnosticReport, preliminaryDiagnosticReport, providerName);

  const clinicalHistory = extractClinicalHistory(serviceRequest);

  return {
    serviceRequestId: serviceRequest.id,
    appointmentId,
    studyType: `${cptCode} — ${cptCodeDisplay}`,
    visitDateTime: '', // TODO
    orderAddedDateTime,
    providerName,
    diagnosis: `${diagnosisCode} — ${diagnosisDisplay}`,
    status,
    isStat: serviceRequest.priority === 'stat',
    result,
    clinicalHistory,
    history,
  };
};

const takeTheBestDiagnosticReport = (diagnosticReports: DiagnosticReport[]): DiagnosticReport | undefined => {
  if (!diagnosticReports.length) {
    return undefined;
  }

  // Filter reports by status priority
  const amendedCorrectedAppended = diagnosticReports.filter(
    (report) => report.status === 'amended' || report.status === 'corrected' || report.status === 'appended'
  );

  const finalReports = diagnosticReports.filter((report) => report.status === 'final');
  const preliminaryReports = diagnosticReports.filter((report) => report.status === 'preliminary');

  // Helper function to get the most recent report by issued datetime
  const getMostRecent = (reports: DiagnosticReport[]): DiagnosticReport | undefined => {
    if (!reports.length) return undefined;

    return reports.reduce((mostRecent, current) => {
      if (!current.issued) return mostRecent;
      if (!mostRecent.issued) return current;

      return new Date(current.issued) > new Date(mostRecent.issued) ? current : mostRecent;
    });
  };

  // Apply priority logic
  if (amendedCorrectedAppended.length > 0) {
    return getMostRecent(amendedCorrectedAppended);
  } else if (finalReports.length > 0) {
    return getMostRecent(finalReports);
  } else if (preliminaryReports.length > 0) {
    return getMostRecent(preliminaryReports);
  }

  // If no reports match the expected statuses, return the first one
  return diagnosticReports[0];
};

const buildHistory = (
  serviceRequest: ServiceRequest,
  bestDiagnosticReport: DiagnosticReport | undefined,
  preliminaryDiagnosticReport: DiagnosticReport | undefined,
  orderingProviderName: string
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
      performer: 'See AdvaPACS',
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
      performer: 'See AdvaPACS',
      date: diagnosticReportPreliminaryReadTimeExtensionValueFromBest,
    });
  } else if (diagnosticReportPreliminaryReadTimeExtensionValueFromPreliminary) {
    history.push({
      status: RadiologyOrderStatus.preliminary,
      performer: 'See AdvaPACS',
      date: diagnosticReportPreliminaryReadTimeExtensionValueFromPreliminary,
    });
  }

  if (bestDiagnosticReport?.issued) {
    history.push({
      status: RadiologyOrderStatus.final,
      performer: 'See AdvaPACS',
      date: bestDiagnosticReport.issued,
    });
  }

  return history;
};

const extractClinicalHistory = (serviceRequest: ServiceRequest): string | undefined => {
  // Find the clinical history extension within the service request
  const clinicalHistoryExtension = serviceRequest.extension
    ?.filter((ext) => ext.url === SERVICE_REQUEST_ORDER_DETAIL_PRE_RELEASE_URL)
    ?.find((orderDetailExt) => {
      const parameterExt = orderDetailExt.extension?.find(
        (ext) => ext.url === SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_URL
      );
      const codeExt = parameterExt?.extension?.find(
        (ext) => ext.url === SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_CODE_URL
      );
      return codeExt?.valueCodeableConcept?.coding?.[0]?.code === 'clinical-history';
    });

  // Extract the clinical history value
  const parameterExt = clinicalHistoryExtension?.extension?.find(
    (ext) => ext.url === SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_URL
  );
  const valueStringExt = parameterExt?.extension?.find(
    (ext) => ext.url === SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_VALUE_STRING_URL
  );

  return valueStringExt?.valueString;
};

const extractResources = (
  resources: (ServiceRequest | Task | Practitioner | DiagnosticReport | Encounter | Appointment)[]
): {
  serviceRequests: ServiceRequest[];
  tasks: Task[];
  diagnosticReports: DiagnosticReport[];
  practitioners: Practitioner[];
  encounters: Encounter[];
} => {
  const serviceRequests: ServiceRequest[] = [];
  const tasks: Task[] = [];
  const results: DiagnosticReport[] = [];
  const practitioners: Practitioner[] = [];
  const encounters: Encounter[] = [];

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
    }
  }

  return {
    serviceRequests,
    tasks,
    diagnosticReports: results,
    practitioners,
    encounters,
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
