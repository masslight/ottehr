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
  Provenance,
} from 'fhir/r4b';
import {
  DEFAULT_LABS_ITEMS_PER_PAGE,
  EMPTY_PAGINATION,
  isPositiveNumberOrZero,
  LabOrderHistoryRow,
  LabOrderResultDetails,
  OYSTEHR_LAB_OI_CODE_SYSTEM,
  Pagination,
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
  // provenances: Provenance[] // todo: delete this from search query if it's not needed
): LabOrderDTO[] => {
  return serviceRequests.map((serviceRequest) => {
    const {
      orderId: serviceRequestId,
      accessionNumbers,
      orderAddedDate,
      lastResultReceivedDate,
      visitDate,
      typeLab,
      locationLab,
      isPSC,
      reflexResultsCount,
      diagnoses,
      providerName,
      dx,
      performedBy,
      appointmentId,
      history,
      orderStatus,
      resultsDetails, // todo: naming
    } = parseOrderDetails({ tasks, serviceRequest, results, appointments, encounters, practitioners });

    return {
      serviceRequestId,
      appointmentId,
      providerName, // ordered by
      diagnoses,
      orderStatus,
      reflexResultsCount,
      isPSC,
      dx,
      typeLab,
      locationLab,
      visitDate,
      orderAddedDate, // order date
      performedBy, // order performed
      lastResultReceivedDate,
      accessionNumbers,
      history,
      resultsDetails,
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
  provenances: Provenance[];
}> => {
  const labOrdersSearchParams = createLabOrdersSearchParams(params);

  const labOrdersResponse = await oystehr.fhir.search({
    resourceType: 'ServiceRequest',
    params: labOrdersSearchParams,
  });

  const labResources =
    labOrdersResponse.entry
      ?.map((entry) => entry.resource)
      .filter((res): res is ServiceRequest | Task | Encounter | DiagnosticReport | Provenance => Boolean(res)) || [];

  const {
    serviceRequests,
    tasks: preSubmissionTasks,
    encounters,
    diagnosticReports,
    observations,
    provenances,
  } = extractLabResources(labResources);

  const [practitioners, appointments, finalAndPrelimTasks] = await Promise.all([
    fetchPractitionersForServiceRequests(oystehr, serviceRequests),
    fetchAppointmentsForServiceRequests(oystehr, serviceRequests, encounters),
    fetchFinalAndPrelimTasks(oystehr, diagnosticReports),
  ]);

  const pagination = parsePaginationFromResponse(labOrdersResponse);

  return {
    serviceRequests,
    tasks: [...preSubmissionTasks, ...finalAndPrelimTasks],
    diagnosticReports,
    practitioners,
    encounters,
    observations,
    appointments,
    provenances,
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

    // include Provenance
    {
      name: '_revinclude',
      value: 'Provenance:target',
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
  resources: (ServiceRequest | Task | DiagnosticReport | Encounter | Observation | Provenance)[]
): {
  serviceRequests: ServiceRequest[];
  tasks: Task[];
  diagnosticReports: DiagnosticReport[];
  encounters: Encounter[];
  observations: Observation[];
  provenances: Provenance[];
} => {
  const serviceRequests: ServiceRequest[] = [];
  const tasks: Task[] = [];
  const results: DiagnosticReport[] = [];
  const encounters: Encounter[] = [];
  const observations: Observation[] = [];
  const provenances: Provenance[] = [];

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
    } else if (resource.resourceType === 'Provenance') {
      provenances.push(resource as Provenance);
    }
  }

  return { serviceRequests, tasks, diagnosticReports: results, encounters, observations, provenances };
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

export const fetchFinalAndPrelimTasks = async (oystehr: Oystehr, results: DiagnosticReport[]): Promise<Task[]> => {
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

export const parseLabOrderStatus = (
  serviceRequest: ServiceRequest,
  tasks: Task[],
  results: DiagnosticReport[]
): ExternalLabsStatus => {
  if (!serviceRequest.id) {
    console.error('ServiceRequest id is required to parse lab order status');
    return ExternalLabsStatus.unparsed;
  }

  const { orderedFinalResults, reflexFinalResults, orderedPrelimResults, reflexPrelimResults } = parseResults(
    serviceRequest,
    results
  );

  const { taskPST, orderedFinalTasks, reflexFinalTasks } = parseTasks({
    tasks,
    serviceRequest,
    results,
  });

  const finalTasks = [...orderedFinalTasks, ...reflexFinalTasks];
  const finalResults = [...orderedFinalResults, ...reflexFinalResults];
  const prelimResults = [...orderedPrelimResults, ...reflexPrelimResults];

  const hasCompletedPSTTask = taskPST?.status === 'completed';
  const isActiveServiceRequest = serviceRequest.status === 'active';

  // 'pending': If the SR.status == draft and a pre-submission task exists
  if (serviceRequest.status === 'draft' && taskPST?.status === 'ready') {
    return ExternalLabsStatus.pending;
  }

  // 'sent': If Task(PST).status == completed, SR.status == active, and there is no DR for the ordered test code
  const isSentStatus = hasCompletedPSTTask && isActiveServiceRequest && orderedFinalResults.length === 0;

  if (isSentStatus) {
    return ExternalLabsStatus.sent;
  }

  // 'prelim': DR.status == 'preliminary', Task(PST).status == completed, SR.status == active
  const hasPrelimResults = prelimResults.length > 0;
  const isPreliminaryStatus = hasPrelimResults && hasCompletedPSTTask && isActiveServiceRequest;

  if (isPreliminaryStatus) {
    return ExternalLabsStatus.prelim;
  }

  // received: Task(RFRT).status = 'ready' and DR the Task is basedOn have DR.status = ‘final’
  for (let i = 0; i < finalTasks.length; i++) {
    const task = finalTasks[i];

    if (task.status !== 'ready') {
      continue;
    }

    const relatedTasks = parseResultByTask(task, finalResults);
    const hasFinalResults = relatedTasks.some((result) => result.status === 'final');

    if (hasFinalResults) {
      return ExternalLabsStatus.received;
    }
  }

  //  reviewed: Task(RFRT).status = 'completed' and DR the Task is basedOn have DR.status = ‘final’
  for (let i = 0; i < finalTasks.length; i++) {
    const task = finalTasks[i];

    if (task.status !== 'completed') {
      continue;
    }

    const relatedResults = parseResultByTask(task, finalResults);
    const hasFinalResults = relatedResults.some((result) => result.status === 'final');

    if (hasFinalResults) {
      return ExternalLabsStatus.reviewed;
    }
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
  const NOT_FOUND = '-';

  if (!practitionerId) {
    return NOT_FOUND;
  }

  const practitioner = practitioners.find((p) => p.id === practitionerId);

  if (!practitioner) {
    return NOT_FOUND;
  }

  const name = practitioner.name?.[0];

  if (!name) {
    return NOT_FOUND;
  }

  return [name.prefix, name.given, name.family].flat().filter(Boolean).join(' ') || NOT_FOUND;
};

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

export const parsePerformed = (serviceRequest: ServiceRequest): string => {
  const NOT_FOUND = '';

  if (checkIsPSC(serviceRequest)) {
    return PSC_HOLD_CONFIG.display;
  }

  return NOT_FOUND;
};

/**
 * Returns results sorted by date, the most recent results are first
 * If Preliminary results are present, and there are Final results with the same code, the corresponding Preliminary results are filtered out
 */
export const parseResults = (
  serviceRequest: ServiceRequest,
  results: DiagnosticReport[]
): {
  orderedFinalResults: DiagnosticReport[];
  reflexFinalResults: DiagnosticReport[];
  orderedPrelimResults: DiagnosticReport[];
  reflexPrelimResults: DiagnosticReport[];
} => {
  if (!serviceRequest.id) {
    throw new Error('ServiceRequest ID is required');
  }

  const serviceRequestCodes = serviceRequest.code?.coding?.map((coding) => coding.code);

  if (!serviceRequestCodes?.length) {
    throw new Error('ServiceRequest code is required');
  }

  const relatedResults = filterResourcesBasedOnServiceRequest(results, serviceRequest.id);

  const orderedFinalResults = new Map<string, DiagnosticReport>();
  const reflexFinalResults = new Map<string, DiagnosticReport>();
  const orderedPrelimResults = new Map<string, DiagnosticReport>();
  const reflexPrelimResults = new Map<string, DiagnosticReport>();

  for (let i = 0; i < relatedResults.length; i++) {
    const result = relatedResults[i];

    if (!result.id) {
      continue;
    }

    const resultCodes = result.code?.coding?.map((coding) => coding.code);

    if (resultCodes?.some((code) => serviceRequestCodes?.includes(code))) {
      result.status === 'preliminary'
        ? orderedPrelimResults.set(result.id, result)
        : orderedFinalResults.set(result.id, result);
    } else {
      result.status === 'preliminary'
        ? reflexPrelimResults.set(result.id, result)
        : reflexFinalResults.set(result.id, result);
    }
  }

  const orderedFinalCodes = extractCodesFromResults(orderedFinalResults);
  const reflexFinalCodes = extractCodesFromResults(reflexFinalResults);

  deletePrelimResultsIfFinalExists(orderedPrelimResults, orderedFinalCodes);
  deletePrelimResultsIfFinalExists(reflexPrelimResults, reflexFinalCodes);

  // todo: check the sort approach is correct
  return {
    orderedFinalResults: Array.from(orderedFinalResults.values()).sort((a, b) =>
      compareDates(a.meta?.lastUpdated, b.meta?.lastUpdated)
    ),
    reflexFinalResults: Array.from(reflexFinalResults.values()).sort((a, b) =>
      compareDates(a.meta?.lastUpdated, b.meta?.lastUpdated)
    ),
    orderedPrelimResults: Array.from(orderedPrelimResults.values()).sort((a, b) =>
      compareDates(a.meta?.lastUpdated, b.meta?.lastUpdated)
    ),
    reflexPrelimResults: Array.from(reflexPrelimResults.values()).sort((a, b) =>
      compareDates(a.meta?.lastUpdated, b.meta?.lastUpdated)
    ),
  };
};

const extractCodesFromResults = (resultsMap: Map<string, DiagnosticReport>): Set<string> => {
  const codes = new Set<string>();
  resultsMap.forEach((result) => {
    result.code?.coding?.forEach((coding) => {
      if (coding.code) codes.add(coding.code);
    });
  });
  return codes;
};

const deletePrelimResultsIfFinalExists = (prelimMap: Map<string, DiagnosticReport>, finalCodes: Set<string>): void => {
  prelimMap.forEach((prelim, id) => {
    const hasFinal = prelim.code?.coding?.some((coding) => coding.code && finalCodes.has(coding.code));
    if (hasFinal) {
      prelimMap.delete(id);
    }
  });
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

export const parseOrderDetails = ({
  serviceRequest,
  tasks,
  results,
  appointments,
  encounters,
  practitioners,
}: {
  serviceRequest: ServiceRequest;
  tasks: Task[];
  results: DiagnosticReport[];
  appointments: Appointment[];
  encounters: Encounter[];
  practitioners: Practitioner[];
}): {
  orderId: string;
  orderStatus: ExternalLabsStatus;
  accessionNumbers: string[];
  orderAddedDate: string;
  lastResultReceivedDate: string;
  visitDate: string;
  typeLab: string;
  locationLab: string;
  isPSC: boolean;
  reflexResultsCount: number;
  diagnoses: DiagnosisDTO[];
  providerName: string;
  dx: string;
  performedBy: string;
  appointmentId: string;
  history: LabOrderHistoryRow[];
  resultsDetails: LabOrderResultDetails[];
} => {
  if (!serviceRequest.id) {
    throw new Error('ServiceRequest ID is required');
  }

  const { orderedFinalResults, reflexFinalResults, orderedPrelimResults, reflexPrelimResults } = parseResults(
    serviceRequest,
    results
  );

  const { orderedPrelimTasks, reflexPrelimTasks, orderedFinalTasks, reflexFinalTasks, taskPST } = parseTasks({
    tasks,
    serviceRequest,
    results,
  });

  const orderAddedDate = taskPST?.authoredOn || '';

  const accessionNumbers = [
    ...orderedFinalResults,
    ...reflexFinalResults,
    ...orderedPrelimResults,
    ...reflexPrelimResults,
  ]
    .map((result) => parseAccessionNumber([result]))
    .filter(Boolean)
    .filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates

  const lastResultReceivedDate =
    [
      orderedPrelimTasks[0]?.authoredOn,
      reflexPrelimTasks[0]?.authoredOn,
      orderedFinalTasks[0]?.authoredOn,
      reflexFinalTasks[0]?.authoredOn,
    ]
      .filter(Boolean)
      .sort((a, b) => compareDates(a, b))[0] || '';

  const orderStatus = parseLabOrderStatus(serviceRequest, tasks, results);

  const appointmentId = parseAppointmentId(serviceRequest, encounters);
  const appointment = appointments.find((a) => a.id === appointmentId);
  const visitDate = appointment?.created || '';

  const { type: typeLab, location: locationLab } = parseLabInfo(serviceRequest);

  const isPSC = checkIsPSC(serviceRequest);

  const reflexResultsCount = reflexFinalResults.length || reflexPrelimResults.length || 0;

  const diagnoses = parseDiagnoses(serviceRequest);

  const practitionerIdFromServiceRequest = parsePractitionerId(serviceRequest);
  const providerName = parsePractitionerName(practitionerIdFromServiceRequest, practitioners);

  const dx = parseDx(serviceRequest);

  const performedBy = parsePerformed(serviceRequest); // only PSC Hold currently

  const orderId = serviceRequest.id;

  const history: LabOrderHistoryRow[] = (() => {
    const history: LabOrderHistoryRow[] = [
      {
        action: 'ordered',
        performer: providerName,
        date: orderAddedDate,
      },
    ];

    if (performedBy) {
      history.push({
        action: 'performed',
        performer: providerName,
        date: '-',
      });
    }

    const finalTasks = [...reflexFinalTasks, ...reflexPrelimTasks].sort((a, b) =>
      compareDates(a.authoredOn, b.authoredOn)
    );

    finalTasks.forEach((task) => {
      const action = task.status === 'completed' ? 'reviewed' : 'received';
      const date = task.authoredOn || '';
      const performerId = task.owner?.reference?.split('/').pop() || '';
      const performer = parsePractitionerName(performerId, practitioners);

      history.push({
        action,
        performer,
        date,
      });
    });

    return history;
  })();

  const resultsDetails = parseLResultsDetails(serviceRequest, results, tasks);

  return {
    orderId,
    accessionNumbers,
    lastResultReceivedDate,
    orderAddedDate,
    orderStatus,
    visitDate,
    typeLab,
    locationLab,
    isPSC,
    reflexResultsCount,
    diagnoses,
    providerName,
    dx,
    performedBy,
    appointmentId,
    history,
    resultsDetails,
  };
};

/**
 * Parses and returns the results details sorted by received date.
 * The business logic depends on parseResults and parseTasks to filter the results and tasks.
 */
export const parseLResultsDetails = (
  serviceRequest: ServiceRequest,
  results: DiagnosticReport[],
  tasks: Task[]
): LabOrderResultDetails[] => {
  if (!serviceRequest.id) {
    return [];
  }

  const { orderedFinalResults, reflexFinalResults, orderedPrelimResults, reflexPrelimResults } = parseResults(
    serviceRequest,
    results
  );

  const { orderedFinalTasks, reflexFinalTasks, orderedPrelimTasks, reflexPrelimTasks } = parseTasks({
    tasks,
    serviceRequest,
    results: results,
  });

  const resultsDetails: LabOrderResultDetails[] = [];

  [
    { results: orderedFinalResults, tasks: orderedFinalTasks, type: 'Ordered test' as const },
    { results: reflexFinalResults, tasks: reflexFinalTasks, type: 'Reflex test' as const },
    { results: orderedPrelimResults, tasks: orderedPrelimTasks, type: 'Ordered test' as const },
    { results: reflexPrelimResults, tasks: reflexPrelimTasks, type: 'Reflex test' as const },
  ].forEach(({ results, tasks, type }) => {
    results.forEach((report) => {
      const details = parseResultDetails(report, tasks, serviceRequest);
      if (details) resultsDetails.push({ ...details, testType: type });
    });
  });

  return resultsDetails.sort((a, b) => compareDates(a.receivedDate, b.receivedDate));
};

export const parseResultDetails = (
  result: DiagnosticReport,
  tasks: Task[],
  serviceRequest: ServiceRequest
): Omit<LabOrderResultDetails, 'testType'> | null => {
  const task = filterResourcesBasedOnDiagnosticReports(tasks, [result])[0];

  if (!task?.id || !result?.id || !serviceRequest.id) {
    return null;
  }

  const PSTTask = parseTaskPST(tasks, serviceRequest.id);

  const details = {
    testName: result.code?.text || result.code?.coding?.[0]?.display || 'Unknown Test',
    labStatus:
      // todo: move status checkers to helper
      result.status === 'final' && task.status === 'ready'
        ? ExternalLabsStatus.received
        : result.status === 'final' && task.status === 'completed'
        ? ExternalLabsStatus.reviewed
        : result.status === 'preliminary'
        ? ExternalLabsStatus.prelim
        : serviceRequest.status === 'draft' && PSTTask?.status === 'ready'
        ? ExternalLabsStatus.pending
        : serviceRequest.status === 'active' && PSTTask?.status === 'completed'
        ? ExternalLabsStatus.sent
        : ExternalLabsStatus.unparsed,
    diagnosticReportId: result.id,
    taskId: task.id,
    receivedDate: task.authoredOn || '',
  };

  return details;
};

/**
 * Parses the tasks for a service request
 * Returns the PST, RFRT ordered, RPRT reflex, and RPRT tasks sorted by authoredOn date, and some useful data
 * The most recent tasks are first
 * Preliminary Tasks are filtered out if there are corresponding final results
 */
export const parseTasks = ({
  tasks,
  serviceRequest,
  results: results,
}: {
  tasks: Task[];
  serviceRequest: ServiceRequest;
  results: DiagnosticReport[];
}): {
  taskPST: Task | null;
  orderedPrelimTasks: Task[];
  reflexPrelimTasks: Task[];
  orderedFinalTasks: Task[];
  reflexFinalTasks: Task[];
} => {
  if (!serviceRequest.id) {
    return {
      taskPST: null,
      orderedFinalTasks: [],
      reflexFinalTasks: [],
      orderedPrelimTasks: [],
      reflexPrelimTasks: [],
    };
  }

  const PST = parseTaskPST(tasks, serviceRequest.id);

  // parseResults returns filtered prelim results if there are final results with the same code
  // so we can just use the results from parseResults as base for filtering tasks
  const { orderedFinalResults, reflexFinalResults, orderedPrelimResults, reflexPrelimResults } = parseResults(
    serviceRequest,
    results
  );

  const orderedPrelimTasks = filterPrelimTasks(tasks, orderedPrelimResults).sort((a, b) =>
    compareDates(a.authoredOn, b.authoredOn)
  );

  const reflexPrelimTasks = filterPrelimTasks(tasks, reflexPrelimResults).sort((a, b) =>
    compareDates(a.authoredOn, b.authoredOn)
  );

  const orderedFinalTasks = filterFinalTasks(tasks, orderedFinalResults).sort((a, b) =>
    compareDates(a.authoredOn, b.authoredOn)
  );

  const reflexFinalTasks = filterFinalTasks(tasks, reflexFinalResults).sort((a, b) =>
    compareDates(a.authoredOn, b.authoredOn)
  );

  return {
    taskPST: PST,
    orderedPrelimTasks,
    orderedFinalTasks,
    reflexPrelimTasks,
    reflexFinalTasks,
  };
};

export const parseTaskPST = (tasks: Task[], serviceRequestId: string): Task | null => {
  const relatedTasks = filterResourcesBasedOnServiceRequest(tasks, serviceRequestId);

  for (const task of relatedTasks) {
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

export const isTaskFinal = (task: Task): boolean => {
  return (
    task.code?.coding?.some(
      (coding) => coding.system === LAB_ORDER_TASK.system && coding.code === LAB_ORDER_TASK.code.reviewFinalResult
    ) || false
  );
};

export const isTaskPrelim = (task: Task): boolean => {
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

export const filterResourcesBasedOnTargetResource = <T extends Resource & { basedOn?: Reference[] }>({
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

export const filterResourcesBasedOnServiceRequest = <T extends Resource & { basedOn?: Reference[] }>(
  resources: T[],
  serviceRequestId: string
): T[] => {
  return filterResourcesBasedOnTargetResource({
    resources,
    targetResourceId: serviceRequestId,
    targetResourceType: 'ServiceRequest',
  });
};

export const filterResourcesBasedOnDiagnosticReports = <T extends Resource & { basedOn?: Reference[] }>(
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
    const relatedResources = filterResourcesBasedOnTargetResource<T>({
      resources,
      targetResourceId: resultId,
      targetResourceType: 'DiagnosticReport',
    });

    result.push(...relatedResources);
  }

  return result;
};

export const filterFinalTasks = (tasks: Task[], results: DiagnosticReport[]): Task[] => {
  const relatedTasks = filterResourcesBasedOnDiagnosticReports(tasks, results);
  return relatedTasks.filter(isTaskFinal);
};

export const filterPrelimTasks = (tasks: Task[], results: DiagnosticReport[]): Task[] => {
  const relatedTasks = filterResourcesBasedOnDiagnosticReports(tasks, results);
  return relatedTasks.filter(isTaskPrelim);
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
