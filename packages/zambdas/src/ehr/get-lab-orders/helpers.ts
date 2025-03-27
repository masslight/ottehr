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
} from 'utils';
import { GetZambdaLabOrdersParams } from './validateRequestParameters';
import { DiagnosisDTO, LabOrderDTO, ExternalLabsStatus, LAB_ORDER_TASK, PSC_HOLD_CONFIG } from 'utils';

export const transformToLabOrderDTOs = (
  serviceRequests: ServiceRequest[],
  tasks: Task[],
  diagnosticReports: DiagnosticReport[],
  practitioners: Practitioner[],
  encounters: Encounter[],
  appointments: Appointment[]
): LabOrderDTO[] => {
  return serviceRequests.map((serviceRequest) => {
    if (!serviceRequest.id) {
      throw new Error('ServiceRequest ID is required');
    }

    const pstTask = parseTaskPST(tasks, serviceRequest.id);

    const orderAdded = pstTask?.authoredOn || '';

    const appointmentId = parseAppointmentId(serviceRequest, encounters);

    const appointment = appointments.find((a) => a.id === appointmentId);

    const visitDate = appointment?.created || '';

    const { type, location } = parseLabInfo(serviceRequest);

    const status = parseLabStatus(serviceRequest, tasks, diagnosticReports);

    const isPSC = checkIsPSC(serviceRequest);

    const { tests, reflexTests } = parseTests(serviceRequest, diagnosticReports);

    const reflexTestsCount = reflexTests.length;

    const diagnoses = parseDiagnoses(serviceRequest);

    const accessionNumber = parseAccessionNumber(tests);

    const resultsReceived = parseResultsReceivedDate(
      tasks,
      // todo: maybe use parseTests to consistent way, but double check if we can use it here for RFRT
      filterBasedOnServiceRequest(diagnosticReports, serviceRequest.id)
    );

    const practitionerIdFromServiceRequest = parsePractitionerId(serviceRequest);
    const provider = parsePractitionerName(practitionerIdFromServiceRequest, practitioners);

    const dx = parseDx(serviceRequest);

    return {
      id: serviceRequest.id,
      appointmentId,
      type,
      location,
      orderAdded,
      visitDate,
      provider,
      diagnoses,
      status,
      isPSC,
      reflexTestsCount,
      accessionNumber,
      resultsReceived,
      dx,
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
  // const { encounterId, testType } = params;
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
    tasks: PSTTasks,
    encounters,
    diagnosticReports,
    observations,
  } = extractLabResources(labResources);

  const [practitioners, appointments, rfrtAndRprtTasks] = await Promise.all([
    fetchPractitionersForServiceRequests(oystehr, serviceRequests),
    fetchAppointmentsForServiceRequests(oystehr, serviceRequests, encounters),
    fetchRFRTAndRPRTTasks(oystehr, diagnosticReports),
  ]);

  const pagination = parsePaginationFromResponse(labOrdersResponse);

  return {
    serviceRequests,
    tasks: [...PSTTasks, ...rfrtAndRprtTasks],
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
      name: 'encounter.date',
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
  const diagnosticReports: DiagnosticReport[] = [];
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
      diagnosticReports.push(resource as DiagnosticReport);
    } else if (resource.resourceType === 'Encounter') {
      encounters.push(resource as Encounter);
    } else if (resource.resourceType === 'Observation') {
      observations.push(resource as Observation);
    }
  }

  return { serviceRequests, tasks, diagnosticReports, encounters, observations };
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

export const fetchRFRTAndRPRTTasks = async (
  oystehr: Oystehr,
  diagnosticReports: DiagnosticReport[]
): Promise<Task[]> => {
  const diagnosticReportIds = diagnosticReports.map((report) => report.id).filter(Boolean);

  if (!diagnosticReportIds.length) {
    return [];
  }

  const tasksResponse = await oystehr.fhir.search<Task>({
    resourceType: 'Task',
    params: [
      {
        name: 'based-on',
        value: diagnosticReportIds.join(','),
      },
    ],
  });

  return tasksResponse.unbundle();
};

export const parseLabStatus = (
  serviceRequest: ServiceRequest,
  tasks: Task[],
  diagnosticReports: DiagnosticReport[]
): ExternalLabsStatus => {
  if (!serviceRequest.id) {
    return ExternalLabsStatus.pending;
  }

  const { tests: orderedDiagnosticReports } = parseTests(serviceRequest, diagnosticReports);
  const relatedPSTTasks = filterBasedOnServiceRequest(tasks, serviceRequest.id);
  const relatedFRRTAndRPRTTasks = filterBasedOnDiagnosticReports(tasks, orderedDiagnosticReports);
  const relatedRFRTTasks = relatedFRRTAndRPRTTasks.filter(isTaskRFRT);

  //  reviewed: Task(RFRT).status = 'completed' and DR the Task is basedOn have DR.status = ‘final’
  const isReviewedStatus = relatedRFRTTasks.some(
    (task) =>
      task.status === 'completed' &&
      parseDiagnosticReportByTask(task, orderedDiagnosticReports).some((report) => report.status === 'final')
  );

  if (isReviewedStatus) {
    return ExternalLabsStatus.reviewed;
  }

  // received: Task(RFRT).status = 'ready' and DR the Task is basedOn have DR.status = ‘final’
  const hasReadyRFRTTask = relatedRFRTTasks.some(
    (task) =>
      task.status === 'ready' &&
      parseDiagnosticReportByTask(task, orderedDiagnosticReports).some((report) => report.status === 'final')
  );

  if (hasReadyRFRTTask) {
    return ExternalLabsStatus.received;
  }

  // 'prelim': DR.status == 'preliminary', Task(PST).status == completed, SR.status == active
  const hasPrelimReports = orderedDiagnosticReports.some((report) => report.status === 'preliminary');
  const hasCompletedPSTTask = relatedPSTTasks.some((task) => task.status === 'completed');
  const isActiveServiceRequest = serviceRequest.status === 'active';
  const isPreliminaryStatus = hasPrelimReports && hasCompletedPSTTask && isActiveServiceRequest;

  if (isPreliminaryStatus) {
    return ExternalLabsStatus.prelim;
  }

  // 'sent': If Task(PST).status == completed, SR.status == active, and there is no DR for the ordered test code
  const isSentStatus = hasCompletedPSTTask && isActiveServiceRequest && orderedDiagnosticReports.length === 0;

  if (isSentStatus) {
    return ExternalLabsStatus.sent;
  }

  // 'pending': If the SR.status == draft and a pre-submission task exists
  if (
    serviceRequest.status === 'draft' &&
    relatedPSTTasks.length !== 0 &&
    relatedPSTTasks.some((task) => task.status === 'ready')
  ) {
    return ExternalLabsStatus.pending;
  }

  // unparsed status, for debugging purposes
  return ExternalLabsStatus.unparsed;
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

export const parseTests = (
  serviceRequest: ServiceRequest,
  diagnosticReports: DiagnosticReport[]
): {
  tests: DiagnosticReport[];
  reflexTests: DiagnosticReport[];
} => {
  if (!serviceRequest.id) {
    throw new Error('ServiceRequest ID is required');
  }

  const serviceRequestCodes = serviceRequest.code?.coding?.map((coding) => coding.code);

  if (!serviceRequestCodes?.length) {
    throw new Error('ServiceRequest code is required');
  }

  const relatedReports = filterBasedOnServiceRequest(diagnosticReports, serviceRequest.id);

  const diagnosticReportsOrdered = new Map<string, DiagnosticReport>();
  const diagnosticReportsReflex = new Map<string, DiagnosticReport>();

  for (let i = 0; i < relatedReports.length; i++) {
    const report = relatedReports[i];

    if (!report.id) {
      continue;
    }

    const reportCodes = report.code?.coding?.map((coding) => coding.code);
    if (reportCodes?.some((code) => serviceRequestCodes?.includes(code))) {
      diagnosticReportsOrdered.set(report.id, report);
    } else {
      diagnosticReportsReflex.set(report.id, report);
    }
  }

  return {
    tests: Array.from(diagnosticReportsOrdered.values()),
    reflexTests: Array.from(diagnosticReportsReflex.values()),
  };
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

export const parseAccessionNumber = (tests: DiagnosticReport[]): string => {
  const NOT_FOUND = '';

  if (tests.length > 0) {
    const report = tests[0];
    if (report.identifier) {
      const accessionIdentifier = report.identifier.find(
        (identifier) => identifier.type?.coding?.some((coding) => coding.code === 'FILL') && identifier.use === 'usual'
      );

      if (accessionIdentifier?.value) {
        return accessionIdentifier.value;
      }
    }
  }

  return NOT_FOUND;
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

export const filterTasksRFRT = (tasks: Task[]): Task[] => {
  return tasks.filter(isTaskRFRT);
};

export const filterTasksRPRT = (tasks: Task[]): Task[] => {
  return tasks.filter(isTaskRPRT);
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
  diagnosticReports: DiagnosticReport[]
): T[] => {
  const diagnosticReportIds: string[] = diagnosticReports
    .map((report) => report.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  if (!diagnosticReportIds.length) {
    return [];
  }

  const result: T[] = [];

  for (const diagnosticReportId of diagnosticReportIds) {
    const relatedResources = filterBasedOnResource<T>({
      resources,
      targetResourceId: diagnosticReportId,
      targetResourceType: 'DiagnosticReport',
    });

    result.push(...relatedResources);
  }

  return result;
};

/**
 * Gets the most recent RFRT task's authored date for a service request
 */
export const parseResultsReceivedDate = (tasks: Task[], orderedDiagnosticReports: DiagnosticReport[]): string => {
  const relatedFRRTAndRPRTTasks = filterBasedOnDiagnosticReports(tasks, orderedDiagnosticReports);
  const relatedRFRTTasks = relatedFRRTAndRPRTTasks.filter(isTaskRFRT);

  const sortedTasks = relatedRFRTTasks
    .filter((task) => Boolean(task.authoredOn))
    .sort((a, b) => {
      const dateA = new Date(a.authoredOn as string);
      const dateB = new Date(b.authoredOn as string);
      return dateB.getTime() - dateA.getTime();
    });

  return sortedTasks[0]?.authoredOn || '';
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
export const parseDiagnosticReportByTask = (task: Task, diagnosticReports: DiagnosticReport[]): DiagnosticReport[] => {
  const taskBasedOn = task.basedOn?.map((basedOn) => basedOn.reference).filter(Boolean) || [];

  return diagnosticReports.filter((report) => {
    const reportId = report.id;
    return taskBasedOn.includes(`DiagnosticReport/${reportId}`);
  });
};
