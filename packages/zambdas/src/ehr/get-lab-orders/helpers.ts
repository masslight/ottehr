import Oystehr, { SearchParam } from '@oystehr/sdk';
import {
  ActivityDefinition,
  Appointment,
  BundleEntry,
  DiagnosticReport,
  Encounter,
  Observation,
  Resource,
  Practitioner,
  ServiceRequest,
  Task,
  Reference,
} from 'fhir/r4b';
import {
  DEFAULT_LABS_ITEMS_PER_PAGE,
  EMPTY_PAGINATION,
  isPositiveNumberOrZero,
  OYSTEHR_LAB_OI_CODE_SYSTEM,
  Pagination,
  ReflexLabStatus,
} from 'utils';
import { GetZambdaLabOrdersParams } from './validateRequestParameters';
import { DiagnosisDTO, LabOrderDTO, ExternalLabsStatus, LAB_ORDER_TASK, PSC_HOLD_CONFIG } from 'utils';
import { DateTime } from 'luxon';

export const mapResourcesToLabOrderDTOs = (
  serviceRequests: ServiceRequest[],
  tasks: Task[],
  results: DiagnosticReport[],
  practitioners: Practitioner[],
  encounters: Encounter[],
  appointments: Appointment[]
): LabOrderDTO[] => {
  return serviceRequests.map((serviceRequest) => {
    if (!serviceRequest.id) {
      throw new Error('ServiceRequest ID is required');
    }

    const { taskPST, tasksRFRT } = parseTasks({
      tasks,
      serviceRequestId: serviceRequest.id,
      results: results,
    });

    const orderedLabStatus = parseOrderedLabStatus(serviceRequest, tasks, results);

    const reflexLabStatus = parseReflexLabStatus(serviceRequest, tasks, results);

    const orderedResultsReceivedDate = tasksRFRT[0]?.authoredOn || '';

    const orderAddedDate = taskPST?.authoredOn || '';

    const appointmentId = parseAppointmentId(serviceRequest, encounters);

    const appointment = appointments.find((a) => a.id === appointmentId);

    const visitDate = appointment?.created || '';

    const { type: typeLab, location: locationLab } = parseLabInfo(serviceRequest);

    const isPSC = checkIsPSC(serviceRequest);

    const { orderedResults, reflexResults } = parseResults(serviceRequest, results);

    const reflexResultsCount = reflexResults.length;

    const diagnoses = parseDiagnoses(serviceRequest);

    const accessionNumber = parseAccessionNumber(orderedResults);

    const practitionerIdFromServiceRequest = parsePractitionerId(serviceRequest);

    const providerName = parsePractitionerName(practitionerIdFromServiceRequest, practitioners);

    const dx = parseDx(serviceRequest);

    return {
      orderId: serviceRequest.id,
      appointmentId,
      providerName,
      diagnoses,
      orderedLabStatus,
      reflexLabStatus,
      reflexResultsCount,
      isPSC,
      accessionNumber,
      dx,
      typeLab,
      locationLab,
      visitDate,
      orderAddedDate,
      orderedResultsReceivedDate,
    };
  });
};

export const getLabResources = async (
  oystehr: Oystehr,
  params: GetZambdaLabOrdersParams
): Promise<{
  serviceRequests: ServiceRequest[];
  tasks: Task[];
  diagnosticReports: DiagnosticReport[];
  practitioners: Practitioner[];
  pagination: Pagination;
  encounters: Encounter[];
  observations: Observation[];
  appointments: Appointment[];
}> => {
  const labOrdersSearchParams = createLabOrdersSearchParams(params);

  const labOrdersResponse = await oystehr.fhir.search({
    resourceType: 'ServiceRequest',
    params: labOrdersSearchParams,
  });

  const labResources =
    labOrdersResponse.entry
      ?.map((entry) => entry.resource)
      .filter((res): res is ServiceRequest | Task | Encounter | DiagnosticReport => Boolean(res)) || [];

  const {
    serviceRequests,
    tasks: PST_tasks,
    encounters,
    diagnosticReports,
    observations,
  } = extractLabResources(labResources);

  const [practitioners, appointments, RFRT_and_RPRT_tasks] = await Promise.all([
    fetchPractitionersForServiceRequests(oystehr, serviceRequests),
    fetchAppointmentsForServiceRequests(oystehr, serviceRequests, encounters),
    fetchRFRTAndRPRTTasks(oystehr, diagnosticReports),
  ]);

  const pagination = parsePaginationFromResponse(labOrdersResponse);

  return {
    serviceRequests,
    tasks: [...PST_tasks, ...RFRT_and_RPRT_tasks],
    diagnosticReports,
    practitioners,
    encounters,
    observations,
    appointments,
    pagination,
  };
};

export const createLabOrdersSearchParams = (params: GetZambdaLabOrdersParams): SearchParam[] => {
  const {
    encounterId,
    patientId,
    serviceRequestId,
    visitDate,
    itemsPerPage = DEFAULT_LABS_ITEMS_PER_PAGE,
    pageIndex = 0,
    orderableItemCode,
  } = params;

  const searchParams: SearchParam[] = [
    {
      name: '_total',
      value: 'accurate',
    },
    {
      name: '_offset',
      value: `${pageIndex * itemsPerPage}`,
    },
    {
      name: '_count',
      value: `${itemsPerPage}`,
    },
    {
      name: '_sort',
      value: '-_lastUpdated',
    },
    {
      name: 'code',
      // empty value will search any code value for given system
      value: `${OYSTEHR_LAB_OI_CODE_SYSTEM}|${orderableItemCode || ''}`,
    },
    {
      name: 'code:missing',
      value: 'false',
    },
    {
      name: '_include',
      value: 'ServiceRequest:encounter',
    },

    // it's only PST tasks, because RFRT and RPRT tasks are based on DiagnosticReport, they should be requested later
    {
      name: '_revinclude',
      value: 'Task:based-on',
    },
    {
      name: '_revinclude',
      value: 'DiagnosticReport:based-on',
    },

    // include Observations
    {
      name: '_include:iterate',
      value: 'DiagnosticReport:result',
    },
  ];

  if (encounterId) {
    searchParams.push({
      name: 'encounter',
      value: `Encounter/${encounterId}`,
    });
  }

  if (patientId) {
    searchParams.push({
      name: 'subject',
      value: `Patient/${patientId}`,
    });
  }

  if (serviceRequestId) {
    searchParams.push({
      name: '_id',
      value: serviceRequestId,
    });
  }

  if (visitDate) {
    searchParams.push({
      name: 'encounter.appointment.date',
      value: visitDate,
    });
  }

  return searchParams;
};

export const extractLabResources = (
  resources: (ServiceRequest | Task | DiagnosticReport | Encounter | Observation)[]
): {
  serviceRequests: ServiceRequest[];
  tasks: Task[];
  diagnosticReports: DiagnosticReport[];
  encounters: Encounter[];
  observations: Observation[];
} => {
  const serviceRequests: ServiceRequest[] = [];
  const tasks: Task[] = [];
  const results: DiagnosticReport[] = [];
  const encounters: Encounter[] = [];
  const observations: Observation[] = [];
  for (const resource of resources) {
    if (resource.resourceType === 'ServiceRequest') {
      const serviceRequest = resource as ServiceRequest;
      const withActivityDefinition = serviceRequest.contained?.some(
        (contained) => contained.resourceType === 'ActivityDefinition'
      );
      if (withActivityDefinition) {
        serviceRequests.push(serviceRequest);
      }
    } else if (resource.resourceType === 'Task') {
      tasks.push(resource as Task);
    } else if (resource.resourceType === 'DiagnosticReport') {
      results.push(resource as DiagnosticReport);
    } else if (resource.resourceType === 'Encounter') {
      encounters.push(resource as Encounter);
    } else if (resource.resourceType === 'Observation') {
      observations.push(resource as Observation);
    }
  }

  return { serviceRequests, tasks, diagnosticReports: results, encounters, observations };
};

export const fetchPractitionersForServiceRequests = async (
  oystehr: Oystehr,
  serviceRequests: ServiceRequest[]
): Promise<Practitioner[]> => {
  if (!serviceRequests.length) {
    return [] as Practitioner[];
  }

  const practitionerRefs = serviceRequests
    .map((sr) => sr.requester?.reference)
    .filter(Boolean)
    .filter((ref, index, self) => self.indexOf(ref) === index) as string[];

  const practitionerRequest =
    practitionerRefs?.map(
      (ref) =>
        ({
          method: 'GET',
          url: ref,
        }) as const
    ) || [];

  if (practitionerRequest.length === 0) {
    console.error('No practitioners found for service requests');
    return [];
  }

  try {
    const practitionerResponse = await oystehr.fhir.batch({
      requests: practitionerRequest,
    });

    return mapResourcesFromBundleEntry<Practitioner>(practitionerResponse.entry as BundleEntry<Practitioner>[]).filter(
      (resource): resource is Practitioner => resource?.resourceType === 'Practitioner'
    );
  } catch (error) {
    console.error(`Failed to fetch Practitioners`, JSON.stringify(error, null, 2));
    return [];
  }
};

export const fetchAppointmentsForServiceRequests = async (
  oystehr: Oystehr,
  serviceRequests: ServiceRequest[],
  encounters: Encounter[]
): Promise<Appointment[]> => {
  const appointmentsIds = serviceRequests.map((sr) => parseAppointmentId(sr, encounters)).filter(Boolean);

  if (!appointmentsIds.length) {
    return [] as Appointment[];
  }

  const appointmentsResponse = await oystehr.fhir.search<Appointment>({
    resourceType: 'Appointment',
    params: [
      {
        name: '_id',
        value: appointmentsIds.join(','),
      },
    ],
  });

  const appointments = appointmentsResponse.unbundle();

  return appointments;
};

export const fetchRFRTAndRPRTTasks = async (oystehr: Oystehr, results: DiagnosticReport[]): Promise<Task[]> => {
  const resultsIds = results.map((result) => result.id).filter(Boolean);

  if (!resultsIds.length) {
    return [];
  }

  const tasksResponse = await oystehr.fhir.search<Task>({
    resourceType: 'Task',
    params: [
      {
        name: 'based-on',
        value: resultsIds.join(','),
      },
    ],
  });

  return tasksResponse.unbundle();
};

export const parseOrderedLabStatus = (
  serviceRequest: ServiceRequest,
  tasks: Task[],
  results: DiagnosticReport[]
): ExternalLabsStatus => {
  if (!serviceRequest.id) {
    return ExternalLabsStatus.pending;
  }

  const { orderedResults } = parseResults(serviceRequest, results);

  const { taskPST, tasksRFRT } = parseTasks({
    tasks,
    serviceRequestId: serviceRequest.id,
    results: results,
  });

  //  reviewed: Task(RFRT).status = 'completed' and DR the Task is basedOn have DR.status = ‘final’
  const isReviewedStatus = tasksRFRT.some(
    (task) =>
      task.status === 'completed' && parseResultByTask(task, orderedResults).some((result) => result.status === 'final')
  );

  if (isReviewedStatus) {
    return ExternalLabsStatus.reviewed;
  }

  // received: Task(RFRT).status = 'ready' and DR the Task is basedOn have DR.status = ‘final’
  const hasReadyRFRTTask = tasksRFRT.some(
    (task) =>
      task.status === 'ready' && parseResultByTask(task, orderedResults).some((result) => result.status === 'final')
  );

  if (hasReadyRFRTTask) {
    return ExternalLabsStatus.received;
  }

  // 'prelim': DR.status == 'preliminary', Task(PST).status == completed, SR.status == active
  const hasPrelimReports = orderedResults.some((result) => result.status === 'preliminary');
  const hasCompletedPSTTask = taskPST?.status === 'completed';
  const isActiveServiceRequest = serviceRequest.status === 'active';
  const isPreliminaryStatus = hasPrelimReports && hasCompletedPSTTask && isActiveServiceRequest;

  if (isPreliminaryStatus) {
    return ExternalLabsStatus.prelim;
  }

  // 'sent': If Task(PST).status == completed, SR.status == active, and there is no DR for the ordered test code
  const isSentStatus = hasCompletedPSTTask && isActiveServiceRequest && orderedResults.length === 0;

  if (isSentStatus) {
    return ExternalLabsStatus.sent;
  }

  // 'pending': If the SR.status == draft and a pre-submission task exists
  if (serviceRequest.status === 'draft' && taskPST?.status === 'ready') {
    return ExternalLabsStatus.pending;
  }

  // unparsed status, for debugging purposes
  return ExternalLabsStatus.unparsed;
};

export const parseReflexLabStatus = (
  serviceRequest: ServiceRequest,
  tasks: Task[],
  results: DiagnosticReport[]
): ReflexLabStatus => {
  if (!serviceRequest.id) {
    return null;
  }

  const { reflexResults } = parseResults(serviceRequest, results);

  const { tasksRPRT } = parseTasks({
    tasks,
    serviceRequestId: serviceRequest.id,
    results: reflexResults,
  });

  const lastTaskRPRT = tasksRPRT[0];

  if (!lastTaskRPRT) {
    return null;
  }

  const statusMap: Partial<Record<Task['status'], ReflexLabStatus>> = {
    received: ExternalLabsStatus.received,
    completed: ExternalLabsStatus.reviewed,

    // Indicates error state: Task was cancelled by subscription lambda but a new one wasn't created as expected. If the system is working correctly, this status should never be visible
    cancelled: ExternalLabsStatus.cancelled,
  };

  const reflexLabStatus = statusMap[lastTaskRPRT.status];

  if (reflexLabStatus === ExternalLabsStatus.cancelled) {
    console.error(
      `Reflex lab status is cancelled for service request ${serviceRequest.id} and task the new Task was not found. The last reflex task id is ${lastTaskRPRT.id}`
    );
  }

  if (!reflexLabStatus) {
    console.error(`Reflex lab status is unknown for service request ${serviceRequest.id} and task ${lastTaskRPRT.id}`);
    return null;
  }

  return reflexLabStatus;
};

export const parseDiagnoses = (serviceRequest: ServiceRequest): DiagnosisDTO[] => {
  if (!serviceRequest.reasonCode || serviceRequest.reasonCode.length === 0) {
    return [];
  }

  return serviceRequest.reasonCode.map((reasonCode) => {
    const coding = reasonCode.coding?.[0];
    return {
      code: coding?.code || '',
      display: coding?.display || reasonCode.text || '',
      system: coding?.system || '',
      isPrimary: false, // todo: how to determine if it's primary?
    };
  });
};

export const parsePractitionerName = (practitionerId: string | undefined, practitioners: Practitioner[]): string => {
  if (!practitionerId) return 'Unknown';

  const practitioner = practitioners.find((p) => p.id === practitionerId);
  if (!practitioner) return 'Unknown';

  const name = practitioner.name?.[0];
  if (!name) return 'Unknown';

  return [name.prefix, name.given, name.family].flat().filter(Boolean).join(' ') || 'Unknown';
};

// todo: check;
export const parseLabInfo = (serviceRequest: ServiceRequest): { type: string; location: string } => {
  const activityDefinition = serviceRequest.contained?.find(
    (resource) => resource.resourceType === 'ActivityDefinition'
  ) as ActivityDefinition | undefined;

  if (!activityDefinition) {
    return {
      type: 'Unknown Test',
      location: 'Unknown Lab',
    };
  }

  return {
    type: activityDefinition.title || 'Unknown Test',
    location: activityDefinition.publisher || 'Unknown Lab',
  };
};

export const checkIsPSC = (serviceRequest: ServiceRequest): boolean => {
  return !!serviceRequest.orderDetail?.some(
    (detail) =>
      detail.coding?.some((coding) => coding.system === PSC_HOLD_CONFIG.system && coding.code === PSC_HOLD_CONFIG.code)
  );
};

/**
 * Returns ordered and reflex results sorted by date, the most recent results are first
 */
export const parseResults = (
  serviceRequest: ServiceRequest,
  results: DiagnosticReport[]
): {
  orderedResults: DiagnosticReport[];
  reflexResults: DiagnosticReport[];
} => {
  if (!serviceRequest.id) {
    throw new Error('ServiceRequest ID is required');
  }

  const serviceRequestCodes = serviceRequest.code?.coding?.map((coding) => coding.code);

  if (!serviceRequestCodes?.length) {
    throw new Error('ServiceRequest code is required');
  }

  const relatedReports = filterBasedOnServiceRequest(results, serviceRequest.id);

  const orderedResults = new Map<string, DiagnosticReport>();
  const reflexResults = new Map<string, DiagnosticReport>();

  for (let i = 0; i < relatedReports.length; i++) {
    const result = relatedReports[i];

    if (!result.id) {
      continue;
    }

    const resultCodes = result.code?.coding?.map((coding) => coding.code);
    if (resultCodes?.some((code) => serviceRequestCodes?.includes(code))) {
      orderedResults.set(result.id, result);
    } else {
      reflexResults.set(result.id, result);
    }
  }

  console.log({ diagnosticReportsOrdered: JSON.stringify(orderedResults, null, 2) });

  return {
    orderedResults: Array.from(orderedResults.values()).sort((a, b) =>
      compareDates(a.meta?.lastUpdated, b.meta?.lastUpdated)
    ),
    reflexResults: Array.from(reflexResults.values()).sort((a, b) =>
      compareDates(a.meta?.lastUpdated, b.meta?.lastUpdated)
    ),
  };
};

/**
 * Compares two dates.
 * The most recent date will be first,
 * invalid dates will be last
 */
export const compareDates = (a: string | undefined, b: string | undefined): number => {
  const dateA = DateTime.fromISO(a || '');
  const dateB = DateTime.fromISO(b || '');
  const isDateAValid = dateA.isValid;
  const isDateBValid = dateB.isValid;

  // if one date is valid and the other is not, the valid date should be first
  if (isDateAValid && !isDateBValid) return -1;
  if (!isDateAValid && isDateBValid) return 1;
  if (!isDateAValid && !isDateBValid) return 0;

  return dateB.toMillis() - dateA.toMillis();
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

export const parsePractitionerId = (serviceRequest: ServiceRequest): string => {
  const NOT_FOUND = '';
  return serviceRequest.requester?.reference?.split('/').pop() || NOT_FOUND;
};

export const parseAccessionNumber = (results: DiagnosticReport[]): string => {
  const NOT_FOUND = '';

  if (results.length > 0) {
    const result = results[0];
    if (result.identifier) {
      const accessionIdentifier = result.identifier.find(
        (identifier) => identifier.type?.coding?.some((coding) => coding.code === 'FILL') && identifier.use === 'usual'
      );

      if (accessionIdentifier?.value) {
        return accessionIdentifier.value;
      }
    }
  }

  return NOT_FOUND;
};

/**
 * Parses the tasks for a service request
 * Returns the PST, RFRT, and RPRT tasks, sorted by authoredOn date. The most recent tasks are first.
 */
export const parseTasks = ({
  tasks,
  serviceRequestId,
  results: results,
}: {
  tasks: Task[];
  serviceRequestId: string;
  results: DiagnosticReport[];
}): {
  taskPST: Task | null;
  tasksRFRT: Task[];
  tasksRPRT: Task[];
} => {
  const PST = parseTaskPST(tasks, serviceRequestId);
  const relatedReports = filterBasedOnServiceRequest(results, serviceRequestId);
  const RFRT = filterRFRTTasks(tasks, relatedReports);
  const RPRT = filterRPRTTasks(tasks, relatedReports);

  return {
    taskPST: PST,
    tasksRFRT: RFRT.sort((a, b) => compareDates(a.authoredOn, b.authoredOn)),
    tasksRPRT: RPRT.sort((a, b) => compareDates(a.authoredOn, b.authoredOn)),
  };
};

export const parseTaskPST = (tasks: Task[], serviceRequestId: string): Task | null => {
  const serviceRequestTasks = filterBasedOnServiceRequest(tasks, serviceRequestId);

  for (const task of serviceRequestTasks) {
    if (isTaskPST(task)) {
      return task;
    }
  }

  return null;
};

export const isTaskPST = (task: Task): boolean => {
  return (
    task.code?.coding?.some(
      (coding) => coding.system === LAB_ORDER_TASK.system && coding.code === LAB_ORDER_TASK.code.presubmission
    ) || false
  );
};

export const isTaskRFRT = (task: Task): boolean => {
  return (
    task.code?.coding?.some(
      (coding) => coding.system === LAB_ORDER_TASK.system && coding.code === LAB_ORDER_TASK.code.reviewFinalResult
    ) || false
  );
};

export const isTaskRPRT = (task: Task): boolean => {
  return (
    task.code?.coding?.some(
      (coding) => coding.system === LAB_ORDER_TASK.system && coding.code === LAB_ORDER_TASK.code.reviewPreliminaryResult
    ) || false
  );
};

export const mapResourcesFromBundleEntry = <T = Resource>(bundleEntry: BundleEntry<T>[] | undefined): T[] => {
  return (bundleEntry || ([] as BundleEntry<T>[]))
    .filter((entry) => entry.response?.status?.startsWith('2')) // todo: should we filter out failed responses like this?
    .map((entry) => entry.resource)
    .filter(Boolean) as T[];
};

export const filterBasedOnResource = <T extends Resource & { basedOn?: Reference[] }>({
  resources,
  targetResourceId,
  targetResourceType,
}: {
  resources: T[];
  targetResourceId: string;
  targetResourceType: string;
}): T[] => {
  return resources.filter(
    (resource) => resource.basedOn?.some((basedOn) => basedOn.reference === `${targetResourceType}/${targetResourceId}`)
  );
};

export const filterBasedOnServiceRequest = <T extends Resource & { basedOn?: Reference[] }>(
  resources: T[],
  serviceRequestId: string
): T[] => {
  return filterBasedOnResource({ resources, targetResourceId: serviceRequestId, targetResourceType: 'ServiceRequest' });
};

export const filterBasedOnDiagnosticReports = <T extends Resource & { basedOn?: Reference[] }>(
  resources: T[],
  results: DiagnosticReport[]
): T[] => {
  const resultsIds: string[] = results
    .map((result) => result.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  if (!resultsIds.length) {
    return [];
  }

  const result: T[] = [];

  for (const resultId of resultsIds) {
    const relatedResources = filterBasedOnResource<T>({
      resources,
      targetResourceId: resultId,
      targetResourceType: 'DiagnosticReport',
    });

    result.push(...relatedResources);
  }

  return result;
};

export const filterRFRTTasks = (tasks: Task[], results: DiagnosticReport[]): Task[] => {
  const relatedFRRTAndRPRTTasks = filterBasedOnDiagnosticReports(tasks, results);
  return relatedFRRTAndRPRTTasks.filter(isTaskRFRT);
};

export const filterRPRTTasks = (tasks: Task[], results: DiagnosticReport[]): Task[] => {
  const relatedFRRTAndRPRTTasks = filterBasedOnDiagnosticReports(tasks, results);
  return relatedFRRTAndRPRTTasks.filter(isTaskRPRT);
};

export const parseDx = (serviceRequest: ServiceRequest): string => {
  return (
    serviceRequest.reasonCode
      ?.map(
        (reasonCode) =>
          reasonCode?.text ||
          reasonCode.coding
            ?.map((coding) => coding.display)
            .filter(Boolean)
            .join(',') ||
          ''
      )
      .filter(Boolean)
      .join(',') || ''
  );
};

// RPRT (Review Preliminary Result Task) and RFRT (Review Final Results Tasks) are based on DiagnosticReport
export const parseResultByTask = (task: Task, results: DiagnosticReport[]): DiagnosticReport[] => {
  const taskBasedOn = task.basedOn?.map((basedOn) => basedOn.reference).filter(Boolean) || [];

  return results.filter((result) => {
    const resultId = result.id;
    return taskBasedOn.includes(`DiagnosticReport/${resultId}`);
  });
};
