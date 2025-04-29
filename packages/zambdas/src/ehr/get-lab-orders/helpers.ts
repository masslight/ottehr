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
  Organization,
  QuestionnaireResponse,
  Questionnaire,
  QuestionnaireResponseItem,
  DocumentReference,
  Location,
} from 'fhir/r4b';
import {
  DEFAULT_LABS_ITEMS_PER_PAGE,
  EMPTY_PAGINATION,
  isPositiveNumberOrZero,
  LAB_ACCOUNT_NUMBER_SYSTEM,
  LabOrderDetailedPageDTO,
  LabOrderHistoryRow,
  LabOrderListPageDTO,
  LabOrderResultDetails,
  LabOrdersSearchBy,
  OYSTEHR_LAB_OI_CODE_SYSTEM,
  Pagination,
  QuestionnaireData,
  PROVENANCE_ACTIVITY_CODES,
  PROVENANCE_ACTIVITY_TYPE_SYSTEM,
  getPresignedURL,
  getTimezone,
} from 'utils';
import { GetZambdaLabOrdersParams } from './validateRequestParameters';
import { DiagnosisDTO, LabOrderDTO, ExternalLabsStatus, LAB_ORDER_TASK, PSC_HOLD_CONFIG } from 'utils';
import { DateTime } from 'luxon';

// cache for the service request context: contains parsed tasks and results
type Cache = {
  parsedResults?: ReturnType<typeof parseResults>;
  parsedTasks?: ReturnType<typeof parseTasks>;
};

type LabOrderPDF = {
  url: string;
  diagnosticReportId: string;
};

export const mapResourcesToLabOrderDTOs = <SearchBy extends LabOrdersSearchBy>(
  searchBy: SearchBy,
  serviceRequests: ServiceRequest[],
  tasks: Task[],
  results: DiagnosticReport[],
  practitioners: Practitioner[],
  encounters: Encounter[],
  locations: Location[],
  appointments: Appointment[],
  provenances: Provenance[],
  organizations: Organization[],
  questionnaires: QuestionnaireData[],
  labPDFs: LabOrderPDF[]
): LabOrderDTO<SearchBy>[] => {
  return serviceRequests.map((serviceRequest) => {
    const parsedResults = parseResults(serviceRequest, results);
    const parsedTasks = parseTasks({ tasks, serviceRequest, results, cache: { parsedResults } });

    // parseResults and parseTasks are called multiple times in inner functions, so we can cache the results to optimize performance
    const cache: Cache = {
      parsedResults,
      parsedTasks,
    };

    return parseOrderDetails({
      searchBy,
      tasks,
      serviceRequest,
      results,
      appointments,
      encounters,
      locations,
      practitioners,
      provenances,
      organizations,
      questionnaires,
      labPDFs,
      cache,
    });
  });
};

export const parseOrderDetails = <SearchBy extends LabOrdersSearchBy>({
  searchBy,
  serviceRequest,
  tasks,
  results,
  appointments,
  encounters,
  locations,
  practitioners,
  provenances,
  organizations,
  questionnaires,
  labPDFs,
  cache,
}: {
  searchBy: SearchBy;
  serviceRequest: ServiceRequest;
  tasks: Task[];
  results: DiagnosticReport[];
  appointments: Appointment[];
  encounters: Encounter[];
  locations: Location[];
  practitioners: Practitioner[];
  provenances: Provenance[];
  organizations: Organization[];
  questionnaires: QuestionnaireData[];
  labPDFs: LabOrderPDF[];
  cache?: Cache;
}): LabOrderDTO<SearchBy> => {
  if (!serviceRequest.id) {
    throw new Error('ServiceRequest ID is required');
  }

  const appointmentId = parseAppointmentId(serviceRequest, encounters);
  const appointment = appointments.find((a) => a.id === appointmentId);
  const { testItem, fillerLab } = parseLabInfo(serviceRequest);
  const location = locations.find((location) => {
    const locationRef = `Location/${location.id}`;
    return serviceRequest.locationReference?.find((srLocationRef) => srLocationRef.reference === locationRef);
  });

  const timezone = location ? getTimezone(location) : undefined;

  const listPageDTO: LabOrderListPageDTO = {
    appointmentId,
    testItem,
    fillerLab,
    serviceRequestId: serviceRequest.id,
    accessionNumbers: parseAccessionNumbers(serviceRequest, results),
    lastResultReceivedDate: parseLabOrderLastResultReceivedDate(serviceRequest, timezone, results, tasks, cache),
    orderAddedDate: parseLabOrderAddedDate(serviceRequest, timezone, tasks, results, cache),
    orderStatus: parseLabOrderStatus(serviceRequest, tasks, results, cache),
    visitDate: formatDateForFrontEnd(parseVisitDate(appointment) || '', timezone),
    isPSC: parseIsPSC(serviceRequest),
    reflexResultsCount: parseReflexTestsCount(serviceRequest, results),
    diagnosesDTO: parseDiagnoses(serviceRequest),
    orderingPhysician: parsePractitionerNameFromServiceRequest(serviceRequest, practitioners),
    diagnoses: parseDx(serviceRequest),
  };

  if (searchBy.searchBy.field === 'serviceRequestId') {
    const detailedPageDTO: LabOrderDetailedPageDTO = {
      ...listPageDTO,
      orderSource: parsePerformed(serviceRequest),
      history: parseLabOrdersHistory(serviceRequest, timezone, tasks, results, practitioners, provenances, cache),
      accountNumber: parseAccountNumber(serviceRequest, organizations),
      resultsDetails: parseLResultsDetails(
        serviceRequest,
        timezone,
        results,
        tasks,
        practitioners,
        provenances,
        labPDFs,
        cache
      ),
      questionnaire: questionnaires,
    };

    return detailedPageDTO as LabOrderDTO<SearchBy>;
  }

  return listPageDTO as LabOrderDTO<SearchBy>;
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
  results,
  cache,
}: {
  tasks: Task[];
  serviceRequest: ServiceRequest;
  results: DiagnosticReport[];
  cache?: Cache;
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
  const { orderedFinalResults, reflexFinalResults, orderedPrelimResults, reflexPrelimResults } =
    cache?.parsedResults || parseResults(serviceRequest, results);

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

export const getLabResources = async (
  oystehr: Oystehr,
  params: GetZambdaLabOrdersParams,
  m2mtoken: string,
  searchBy: LabOrdersSearchBy
): Promise<{
  serviceRequests: ServiceRequest[];
  tasks: Task[];
  diagnosticReports: DiagnosticReport[];
  practitioners: Practitioner[];
  pagination: Pagination;
  encounters: Encounter[];
  locations: Location[];
  observations: Observation[];
  appointments: Appointment[];
  provenances: Provenance[];
  organizations: Organization[];
  questionnaires: QuestionnaireData[];
  labPDFs: LabOrderPDF[];
}> => {
  const labServiceRequestSearchParams = createLabServiceRequestSearchParams(params);

  const labOrdersResponse = await oystehr.fhir.search({
    resourceType: 'ServiceRequest',
    params: labServiceRequestSearchParams,
  });

  const labResources =
    labOrdersResponse.entry
      ?.map((entry) => entry.resource)
      .filter(
        (
          res
        ): res is
          | ServiceRequest
          | Task
          | Encounter
          | DiagnosticReport
          | Provenance
          | Organization
          | Location
          | QuestionnaireResponse => Boolean(res)
      ) || [];

  const {
    serviceRequests,
    tasks: preSubmissionTasks,
    encounters,
    locations,
    diagnosticReports,
    observations,
    provenances,
    organizations,
    questionnaireResponses,
  } = extractLabResources(labResources);

  const isDetailPageRequest = searchBy.searchBy.field === 'serviceRequestId';

  const [practitioners, appointments, finalAndPrelimTasks, questionnaires, documentReferences] = await Promise.all([
    fetchPractitionersForServiceRequests(oystehr, serviceRequests),
    fetchAppointmentsForServiceRequests(oystehr, serviceRequests, encounters),
    fetchFinalAndPrelimTasks(oystehr, diagnosticReports),
    executeByCondition(isDetailPageRequest, () =>
      fetchQuestionnaireForServiceRequests(m2mtoken, serviceRequests, questionnaireResponses)
    ),
    executeByCondition(isDetailPageRequest, () =>
      fetchDocumentReferencesForDiagnosticReports(oystehr, diagnosticReports)
    ),
  ]);

  const labPDFs = await executeByCondition(isDetailPageRequest, () => fetchLabOrderPDFs(documentReferences, m2mtoken));

  const pagination = parsePaginationFromResponse(labOrdersResponse);

  return {
    serviceRequests,
    tasks: [...preSubmissionTasks, ...finalAndPrelimTasks],
    diagnosticReports,
    practitioners,
    encounters,
    locations,
    observations,
    appointments,
    provenances,
    organizations,
    questionnaires,
    labPDFs,
    pagination,
  };
};

export const createLabServiceRequestSearchParams = (params: GetZambdaLabOrdersParams): SearchParam[] => {
  const { searchBy, visitDate, itemsPerPage = DEFAULT_LABS_ITEMS_PER_PAGE, pageIndex = 0, orderableItemCode } = params;

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

    // include encounter location
    {
      name: '_include:iterate',
      value: 'Encounter:location',
    },
  ];

  // chart data case
  if (searchBy.field === 'encounterId') {
    searchParams.push({
      name: 'encounter',
      value: `Encounter/${searchBy.value}`,
    });
  }

  // patient page case
  if (searchBy.field === 'patientId') {
    searchParams.push({
      name: 'subject',
      value: `Patient/${searchBy.value}`,
    });
  }

  // detailed page case
  if (searchBy.field === 'serviceRequestId') {
    searchParams.push({
      name: '_id',
      value: searchBy.value,
    });

    // for retrieving accountNumber (from Organization); used on Detailed Page
    searchParams.push({
      name: '_include',
      value: 'ServiceRequest:performer',
    });

    searchParams.push({
      name: '_revinclude',
      value: 'QuestionnaireResponse:based-on',
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
  resources: (
    | ServiceRequest
    | Task
    | DiagnosticReport
    | Encounter
    | Observation
    | Provenance
    | Organization
    | QuestionnaireResponse
    | Location
  )[]
): {
  serviceRequests: ServiceRequest[];
  tasks: Task[];
  diagnosticReports: DiagnosticReport[];
  encounters: Encounter[];
  locations: Location[];
  observations: Observation[];
  provenances: Provenance[];
  organizations: Organization[];
  questionnaireResponses: QuestionnaireResponse[];
} => {
  const serviceRequests: ServiceRequest[] = [];
  const tasks: Task[] = [];
  const diagnosticReports: DiagnosticReport[] = [];
  const encounters: Encounter[] = [];
  const locations: Location[] = [];
  const observations: Observation[] = [];
  const provenances: Provenance[] = [];
  const organizations: Organization[] = [];
  const questionnaireResponses: QuestionnaireResponse[] = [];

  for (const resource of resources) {
    if (resource.resourceType === 'ServiceRequest') {
      const serviceRequest = resource as ServiceRequest;
      const withActivityDefinition = serviceRequest.contained?.some(
        (contained) => contained.resourceType === 'ActivityDefinition'
      );
      if (withActivityDefinition) {
        serviceRequests.push(serviceRequest);
      }
    } else if (resource.resourceType === 'Task' && resource.status !== 'cancelled') {
      tasks.push(resource as Task);
    } else if (resource.resourceType === 'DiagnosticReport') {
      diagnosticReports.push(resource as DiagnosticReport);
    } else if (resource.resourceType === 'Encounter') {
      encounters.push(resource as Encounter);
    } else if (resource.resourceType === 'Observation') {
      observations.push(resource as Observation);
    } else if (resource.resourceType === 'Provenance') {
      provenances.push(resource as Provenance);
    } else if (resource.resourceType === 'Organization') {
      organizations.push(resource as Organization);
    } else if (resource.resourceType === 'QuestionnaireResponse') {
      questionnaireResponses.push(resource as QuestionnaireResponse);
    } else if (resource.resourceType === 'Location') {
      locations.push(resource as Location);
    }
  }

  return {
    serviceRequests,
    tasks,
    diagnosticReports,
    encounters,
    locations,
    observations,
    provenances,
    organizations,
    questionnaireResponses,
  };
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
      {
        name: 'status:not',
        value: 'cancelled',
      },
    ],
  });

  return tasksResponse.unbundle();
};

export const fetchDocumentReferencesForDiagnosticReports = async (
  oystehr: Oystehr,
  diagnosticReports: DiagnosticReport[]
): Promise<DocumentReference[]> => {
  const reportIds = diagnosticReports.map((report) => report.id).filter(Boolean);

  if (!reportIds.length) {
    return [];
  }

  const documentReferencesResponse = await oystehr.fhir.search<DocumentReference>({
    resourceType: 'DocumentReference',
    params: [
      {
        name: 'related',
        value: reportIds.map((id) => `DiagnosticReport/${id}`).join(','),
      },
    ],
  });

  return documentReferencesResponse.unbundle();
};

export const fetchLabOrderPDFs = async (
  documentReferences: DocumentReference[],
  m2mtoken: string
): Promise<LabOrderPDF[]> => {
  if (!documentReferences.length) {
    return [];
  }

  const pdfPromises: Promise<LabOrderPDF | null>[] = [];

  for (const docRef of documentReferences) {
    const diagnosticReportReference = docRef.context?.related?.find(
      (rel) => rel.reference?.startsWith('DiagnosticReport/')
    )?.reference;

    const diagnosticReportId = diagnosticReportReference?.split('/')[1];

    if (!diagnosticReportId) {
      continue;
    }

    for (const content of docRef.content) {
      const z3Url = content.attachment?.url;
      if (z3Url) {
        pdfPromises.push(
          getPresignedURL(z3Url, m2mtoken)
            .then((url) => ({
              url,
              diagnosticReportId,
            }))
            .catch((error) => {
              console.error(`Failed to get presigned URL for document ${docRef.id}:`, error);
              return null;
            })
        );
      }
    }
  }

  const results = await Promise.allSettled(pdfPromises);

  return results
    .filter(
      (result): result is PromiseFulfilledResult<LabOrderPDF> => result.status === 'fulfilled' && result.value !== null
    )
    .map((result) => result.value as LabOrderPDF);
};

export const fetchQuestionnaireForServiceRequests = async (
  m2mtoken: string,
  serviceRequests: ServiceRequest[],
  questionnaireResponses: QuestionnaireResponse[]
): Promise<QuestionnaireData[]> => {
  const results: {
    questionnaireUrl: string;
    serviceRequestId: string;
    questionnaireResponse: QuestionnaireResponse;
  }[] = [];

  for (const serviceRequest of serviceRequests) {
    for (const questionnaireResponse of questionnaireResponses) {
      if (
        questionnaireResponse.basedOn?.some((b) => b.reference === `ServiceRequest/${serviceRequest.id}`) &&
        !results.some((q) => q.serviceRequestId === serviceRequest.id) &&
        questionnaireResponse.questionnaire &&
        serviceRequest.id
      ) {
        results.push({
          questionnaireUrl: questionnaireResponse.questionnaire,
          serviceRequestId: serviceRequest.id,
          questionnaireResponse,
        });
      }
    }
  }

  return Promise.all(
    results.map(async (result) => {
      const questionnaireRequest = await fetch(result.questionnaireUrl, {
        headers: {
          Authorization: `Bearer ${m2mtoken}`,
        },
      });

      const { questionnaireResponse, serviceRequestId } = result;

      const questionnaire = (await questionnaireRequest.json()) as Questionnaire;

      return {
        questionnaire,
        questionnaireResponse,
        questionnaireResponseItems: parseQuestionnaireResponseItems(questionnaireResponse, questionnaire),
        serviceRequestId,
      };
    })
  );
};

export function executeByCondition<T>(
  condition: boolean,
  fetchFunction: () => Promise<T[]>,
  emptyResultType: T[] = [] as T[]
): Promise<T[]> {
  return condition ? fetchFunction() : Promise.resolve(emptyResultType);
}

export const parseLabOrderStatus = (
  serviceRequest: ServiceRequest,
  tasks: Task[],
  results: DiagnosticReport[],
  cache?: Cache
): ExternalLabsStatus => {
  if (!serviceRequest.id) {
    console.error('ServiceRequest id is required to parse lab order status');
    return ExternalLabsStatus.unparsed;
  }

  const { orderedFinalResults, reflexFinalResults, orderedPrelimResults, reflexPrelimResults } =
    cache?.parsedResults || parseResults(serviceRequest, results);

  const { taskPST, orderedFinalTasks, reflexFinalTasks } =
    cache?.parsedTasks ||
    parseTasks({
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
  const isSentStatus =
    hasCompletedPSTTask && isActiveServiceRequest && orderedFinalResults.length === 0 && prelimResults.length === 0;

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

export const parsePractitionerNameFromServiceRequest = (
  serviceRequest: ServiceRequest,
  practitioners: Practitioner[]
): string => {
  const practitionerIdFromServiceRequest = parsePractitionerIdFromServiceRequest(serviceRequest);
  return parsePractitionerName(practitionerIdFromServiceRequest, practitioners);
};

export const parsePractitionerNameFromTask = (task: Task, practitioners: Practitioner[]): string => {
  const performerId = task.owner?.reference?.split('/').pop() || '';
  return parsePractitionerName(performerId, practitioners);
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

export const parseLabInfo = (serviceRequest: ServiceRequest): { testItem: string; fillerLab: string } => {
  const activityDefinition = serviceRequest.contained?.find(
    (resource) => resource.resourceType === 'ActivityDefinition'
  ) as ActivityDefinition | undefined;

  if (!activityDefinition) {
    return {
      testItem: 'Unknown Test',
      fillerLab: 'Unknown Lab',
    };
  }

  return {
    testItem: activityDefinition.title || 'Unknown Test',
    fillerLab: activityDefinition.publisher || 'Unknown Lab',
  };
};

export const parseIsPSC = (serviceRequest: ServiceRequest): boolean => {
  return !!serviceRequest.orderDetail?.some(
    (detail) =>
      detail.coding?.some((coding) => coding.system === PSC_HOLD_CONFIG.system && coding.code === PSC_HOLD_CONFIG.code)
  );
};

export const parseReflexTestsCount = (
  serviceRequest: ServiceRequest,
  results: DiagnosticReport[],
  cache?: Cache
): number => {
  const { reflexFinalResults, reflexPrelimResults } = cache?.parsedResults || parseResults(serviceRequest, results);
  return (reflexFinalResults.length || 0) + (reflexPrelimResults.length || 0);
};

export const parsePerformed = (serviceRequest: ServiceRequest): string => {
  const NOT_FOUND = '';

  if (parseIsPSC(serviceRequest)) {
    return PSC_HOLD_CONFIG.display;
  }

  return NOT_FOUND;
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

export const parseVisitDate = (appointment: Appointment | undefined): string => {
  return appointment?.created || '';
};

const parseEncounterId = (serviceRequest: ServiceRequest): string => {
  const NOT_FOUND = '';
  return serviceRequest.encounter?.reference?.split('/').pop() || NOT_FOUND;
};

export const parsePractitionerIdFromServiceRequest = (serviceRequest: ServiceRequest): string => {
  const NOT_FOUND = '';
  return serviceRequest.requester?.reference?.split('/').pop() || NOT_FOUND;
};

export const parsePractitionerIdFromTask = (task: Task): string => {
  const NOT_FOUND = '';
  return task.owner?.reference?.split('/').pop() || NOT_FOUND;
};

export const parseAccessionNumbers = (
  serviceRequest: ServiceRequest,
  results: DiagnosticReport[],
  cache?: Cache
): string[] => {
  const { orderedFinalResults, reflexFinalResults, orderedPrelimResults, reflexPrelimResults } =
    cache?.parsedResults || parseResults(serviceRequest, results);

  const accessionNumbers = [
    ...orderedFinalResults,
    ...reflexFinalResults,
    ...orderedPrelimResults,
    ...reflexPrelimResults,
  ]
    .map((result) => parseAccessionNumber([result]))
    .filter(Boolean)
    .filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates

  return accessionNumbers;
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

const formatDateForFrontEnd = (date: string, timezone: string | undefined): string => {
  if (!date) return '';
  return DateTime.fromISO(date).setZone(timezone).toFormat('MM/dd/yyyy hh:mm a');
};

export const parseLabOrderAddedDate = (
  serviceRequest: ServiceRequest,
  timezone: string | undefined,
  tasks: Task[],
  results: DiagnosticReport[],
  cache?: Cache
): string => {
  const { taskPST } =
    cache?.parsedTasks ||
    parseTasks({
      tasks,
      serviceRequest,
      results,
    });

  return formatDateForFrontEnd(taskPST?.authoredOn || '', timezone);
};

export const parseLabOrderLastResultReceivedDate = (
  serviceRequest: ServiceRequest,
  timezone: string | undefined,
  results: DiagnosticReport[],
  tasks: Task[],
  cache?: Cache
): string => {
  const { orderedPrelimTasks, reflexPrelimTasks, orderedFinalTasks, reflexFinalTasks } =
    cache?.parsedTasks ||
    parseTasks({
      tasks,
      serviceRequest,
      results,
    });

  const lastResultReceivedDate =
    [
      orderedPrelimTasks[0]?.authoredOn,
      reflexPrelimTasks[0]?.authoredOn,
      orderedFinalTasks[0]?.authoredOn,
      reflexFinalTasks[0]?.authoredOn,
    ]
      .filter(Boolean)
      .sort((a, b) => compareDates(a, b))[0] || '';

  return formatDateForFrontEnd(lastResultReceivedDate, timezone);
};

export const parseLabOrdersHistory = (
  serviceRequest: ServiceRequest,
  timezone: string | undefined,
  tasks: Task[],
  results: DiagnosticReport[],
  practitioners: Practitioner[],
  provenances: Provenance[],
  cache?: Cache
): LabOrderHistoryRow[] => {
  const { orderedFinalTasks, reflexFinalTasks } =
    cache?.parsedTasks ||
    parseTasks({
      tasks,
      serviceRequest,
      results,
    });

  const orderedBy = parsePractitionerNameFromServiceRequest(serviceRequest, practitioners);
  const orderAddedDate = parseLabOrderAddedDate(serviceRequest, timezone, tasks, results, cache);
  const performedBy = parsePerformed(serviceRequest);

  const history: LabOrderHistoryRow[] = [
    {
      action: 'ordered',
      performer: orderedBy,
      date: orderAddedDate,
    },
  ];

  if (performedBy) {
    history.push({
      action: 'performed',
      performer: performedBy,
      date: '-',
    });
  }

  const taggedReflexTasks = reflexFinalTasks.map((task) => ({ ...task, testType: 'reflex' }) as const);
  const taggedOrderedTasks = orderedFinalTasks.map((task) => ({ ...task, testType: 'ordered' }) as const);

  const finalTasks = [...taggedReflexTasks, ...taggedOrderedTasks].sort((a, b) =>
    compareDates(a.authoredOn, b.authoredOn)
  );

  finalTasks.forEach((task) => {
    history.push(...parseTaskReceivedAndReviewedHistory(task, timezone, practitioners, provenances));
  });

  return history;
};

export const parseAccountNumber = (serviceRequest: ServiceRequest, organizations: Organization[]): string => {
  const NOT_FOUND = '';

  if (!serviceRequest.performer || !serviceRequest.performer.length) {
    return NOT_FOUND;
  }

  for (const performer of serviceRequest.performer) {
    if (performer.reference && performer.reference.includes('Organization/')) {
      const organizationId = performer.reference.split('Organization/')[1];
      const matchingOrg = organizations.find((org) => org.id === organizationId);

      if (matchingOrg) {
        const accountNumber = matchingOrg.identifier?.find(
          (identifier) => identifier.system === LAB_ACCOUNT_NUMBER_SYSTEM
        )?.value;

        return accountNumber || NOT_FOUND;
      }
    }
  }

  return NOT_FOUND;
};

export const parseTaskReceivedAndReviewedHistory = (
  task: Task & { testType: 'reflex' | 'ordered' },
  timezone: string | undefined,
  practitioners: Practitioner[],
  provenances: Provenance[]
): LabOrderHistoryRow[] => {
  const result: LabOrderHistoryRow[] = [];
  const receivedDate = parseTaskReceivedInfo(task, timezone, practitioners);

  if (receivedDate) {
    result.push({ ...receivedDate, testType: task.testType });
  }

  const status = `${task.status === 'completed' ? 'reviewed' : 'received'}` as const;

  if (status !== 'reviewed') {
    return result;
  }

  const reviewedDate = parseTaskReviewedInfo(task, timezone, practitioners, provenances);

  if (reviewedDate) {
    result.push({ ...reviewedDate, testType: task.testType });
  }

  return result;
};

export const parseTaskReceivedInfo = (
  task: Task,
  timezone: string | undefined,
  practitioners: Practitioner[]
): Omit<LabOrderHistoryRow, 'resultType'> | null => {
  return {
    action: 'received',
    performer: parsePractitionerNameFromTask(task, practitioners),
    date: formatDateForFrontEnd(task.authoredOn || '', timezone),
  };
};

export const parseTaskReviewedInfo = (
  task: Task,
  timezone: string | undefined,
  practitioners: Practitioner[],
  provenances: Provenance[]
): Omit<LabOrderHistoryRow, 'resultType'> | null => {
  const reviewProvenance = parseReviewProvenanceForTask(task, provenances);

  if (!reviewProvenance) {
    return null;
  }

  return {
    action: 'reviewed',
    performer: extractPerformerFromProvenance(reviewProvenance, practitioners),
    date: formatDateForFrontEnd(reviewProvenance.recorded || '', timezone),
  };
};

export const parseReviewProvenanceForTask = (task: Task, provenances: Provenance[]): Provenance | undefined => {
  return provenances.find((provenance) => {
    const isRelatedToTask = task?.relevantHistory?.some((history) => {
      return history.reference?.includes(`Provenance/${provenance.id}`);
    });

    const isReviewActivity = isProvenanceReviewActivity(provenance);

    return isRelatedToTask && isReviewActivity;
  });
};

export const isProvenanceReviewActivity = (provenance: Provenance): boolean => {
  return (
    provenance.activity?.coding?.some(
      (coding) => coding.code === PROVENANCE_ACTIVITY_CODES.review && coding.system === PROVENANCE_ACTIVITY_TYPE_SYSTEM
    ) || false
  );
};

export const extractPerformerFromProvenance = (provenance: Provenance, practitioners: Practitioner[]): string => {
  if (!provenance.agent || provenance.agent.length === 0) {
    return '';
  }

  const agentReference = provenance.agent[0].who?.reference;

  if (!agentReference || !agentReference.startsWith('Practitioner/')) {
    return '';
  }

  const practitionerId = agentReference.replace('Practitioner/', '');
  return parsePractitionerName(practitionerId, practitioners);
};

/**
 * Parses and returns the results details sorted by received date.
 * The business logic depends on parseResults and parseTasks to filter the results and tasks.
 */
export const parseLResultsDetails = (
  serviceRequest: ServiceRequest,
  timezone: string | undefined,
  results: DiagnosticReport[],
  tasks: Task[],
  practitioners: Practitioner[],
  provenances: Provenance[],
  labPDFs: LabOrderPDF[],
  cache?: Cache
): LabOrderResultDetails[] => {
  if (!serviceRequest.id) {
    return [];
  }

  const { orderedFinalResults, reflexFinalResults, orderedPrelimResults, reflexPrelimResults } =
    cache?.parsedResults || parseResults(serviceRequest, results);

  const { orderedFinalTasks, reflexFinalTasks, orderedPrelimTasks, reflexPrelimTasks } =
    cache?.parsedTasks ||
    parseTasks({
      tasks,
      serviceRequest,
      results,
    });

  const resultsDetails: LabOrderResultDetails[] = [];

  [
    {
      results: orderedFinalResults,
      tasks: orderedFinalTasks,
      testType: 'ordered' as const,
      resultType: 'final' as const,
    },
    {
      results: reflexFinalResults,
      tasks: reflexFinalTasks,
      testType: 'reflex' as const,
      resultType: 'final' as const,
    },
    {
      results: orderedPrelimResults,
      tasks: orderedPrelimTasks,
      testType: 'ordered' as const,
      resultType: 'preliminary' as const,
    },
    {
      results: reflexPrelimResults,
      tasks: reflexPrelimTasks,
      testType: 'reflex' as const,
      resultType: 'preliminary' as const,
    },
  ].forEach(({ results, tasks, testType, resultType }) => {
    results.forEach((result) => {
      const details = parseResultDetails(result, tasks, serviceRequest);
      const task = filterResourcesBasedOnDiagnosticReports(tasks, [result])[0];
      const reviewedDate = parseTaskReviewedInfo(task, timezone, practitioners, provenances)?.date || null;
      const resultPdfUrl = labPDFs.find((pdf) => pdf.diagnosticReportId === result.id)?.url || null;
      if (details) resultsDetails.push({ ...details, testType, resultType, reviewedDate, resultPdfUrl });
    });
  });

  return resultsDetails.sort((a, b) => compareDates(a.receivedDate, b.receivedDate));
};

export const parseResultDetails = (
  result: DiagnosticReport,
  tasks: Task[],
  serviceRequest: ServiceRequest
): Omit<LabOrderResultDetails, 'testType' | 'resultType' | 'reviewedDate' | 'resultPdfUrl'> | null => {
  const task = filterResourcesBasedOnDiagnosticReports(tasks, [result])[0];

  if (!task?.id || !result?.id || !serviceRequest.id) {
    console.log(`Task not found for result: ${result.id}, if Task exists check if it has valid status and code.`);
    return null;
  }

  const PSTTask = parseTaskPST(tasks, serviceRequest.id);

  const details = {
    testItem: result.code?.text || result.code?.coding?.[0]?.display || 'Unknown Test',
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
            ?.map((coding) => `${coding.code} ${coding.display}`.trim())
            .filter(Boolean)
            .join('; ') ||
          ''
      )
      .filter(Boolean)
      .join('; ') || ''
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

export const parseQuestionnaireResponseItems = (
  questionnaireResponse: QuestionnaireResponse,
  questionnaire: Questionnaire
): QuestionnaireResponseItem[] => {
  const questionnaireResponseItems = questionnaireResponse.item?.map((item) => {
    const question = questionnaire.item?.find((q) => q.linkId === item.linkId);

    if (!question) {
      throw new Error(`question ${item.linkId} is not found`);
    }

    return {
      linkId: item.linkId,
      type: question.type,
      response: item.answer?.map((answer) => {
        if (question.type === 'text') {
          return answer.valueString;
        } else if (question.type === 'boolean') {
          return answer.valueBoolean;
        } else if (question.type === 'date') {
          return answer.valueDate;
        } else if (question.type === 'decimal') {
          return answer.valueDecimal;
        } else if (question.type === 'integer') {
          return answer.valueInteger;
        } else if (question.type === 'choice') {
          return answer.valueString;
        } else {
          throw new Error(`Unknown question type: ${question.type}`);
        }
      }),
    };
  });

  return questionnaireResponseItems || [];
};
