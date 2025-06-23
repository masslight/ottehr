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
  Location,
  Specimen,
  Bundle,
  DocumentReference,
} from 'fhir/r4b';
import {
  compareDates,
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
  getTimezone,
  sampleDTO,
  SPECIMEN_CODING_CONFIG,
  RELATED_SPECIMEN_DEFINITION_SYSTEM,
  LabResultPDF,
  LabOrderPDF,
  Secrets,
  PatientLabItem,
} from 'utils';
import { GetZambdaLabOrdersParams } from './validateRequestParameters';
import { DiagnosisDTO, LabOrderDTO, ExternalLabsStatus, LAB_ORDER_TASK, PSC_HOLD_CONFIG } from 'utils';
import { captureSentryException } from '../../shared';
import { sendErrors } from '../../shared';
import { fetchLabOrderPDFsPresignedUrls } from '../shared/labs';

// cache for the service request context: contains parsed tasks and results
type Cache = {
  parsedResults?: ReturnType<typeof parseResults>;
  parsedTasks?: ReturnType<typeof parseTasks>;
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
  resultPDFs: LabResultPDF[],
  orderPDF: LabOrderPDF | undefined,
  specimens: Specimen[],
  secrets: Secrets | null
): LabOrderDTO<SearchBy>[] => {
  console.log('mapResourcesToLabOrderDTOs');
  const result: LabOrderDTO<SearchBy>[] = [];

  for (const serviceRequest of serviceRequests) {
    try {
      const parsedResults = parseResults(serviceRequest, results);
      const parsedTasks = parseTasks({ tasks, serviceRequest, results, cache: { parsedResults } });

      // parseResults and parseTasks are called multiple times in inner functions, so we can cache the results to optimize performance
      const cache: Cache = {
        parsedResults,
        parsedTasks,
      };

      result.push(
        parseOrderData({
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
          resultPDFs,
          orderPDF,
          specimens,
          cache,
        })
      );
    } catch (error) {
      console.error(`Error parsing service request ${serviceRequest.id}:`, error);
      void sendErrors('get-lab-orders', error, secrets, captureSentryException);
    }
  }
  return result;
};

export const parseOrderData = <SearchBy extends LabOrdersSearchBy>({
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
  resultPDFs,
  orderPDF,
  specimens,
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
  resultPDFs: LabResultPDF[];
  orderPDF: LabOrderPDF | undefined;
  specimens: Specimen[];
  cache?: Cache;
}): LabOrderDTO<SearchBy> => {
  console.log('parsing external lab order data');
  if (!serviceRequest.id) {
    throw new Error('ServiceRequest ID is required');
  }

  const appointmentId = parseAppointmentId(serviceRequest, encounters);
  const appointment = appointments.find((a) => a.id === appointmentId);
  const { testItem, fillerLab } = parseLabInfo(serviceRequest);
  const orderStatus = parseLabOrderStatus(serviceRequest, tasks, results, cache);
  console.log('external lab orderStatus parsed', orderStatus);

  console.log('formatting external lab listPageDTO');
  const listPageDTO: LabOrderListPageDTO = {
    appointmentId,
    testItem,
    fillerLab,
    serviceRequestId: serviceRequest.id,
    accessionNumbers: parseAccessionNumbers(serviceRequest, results),
    lastResultReceivedDate: parseLabOrderLastResultReceivedDate(serviceRequest, results, tasks, cache),
    orderAddedDate: parseLabOrderAddedDate(serviceRequest, tasks, results, cache),
    orderStatus: orderStatus,
    visitDate: parseVisitDate(appointment),
    isPSC: parseIsPSC(serviceRequest),
    reflexResultsCount: parseReflexTestsCount(serviceRequest, results),
    diagnosesDTO: parseDiagnoses(serviceRequest),
    orderingPhysician: parsePractitionerNameFromServiceRequest(serviceRequest, practitioners),
    diagnoses: parseDx(serviceRequest),
    encounterTimezone: parseLocationTimezoneForSR(serviceRequest, locations),
  };

  if (searchBy.searchBy.field === 'serviceRequestId') {
    console.log('formatting external lab detailedPageDTO for service request', serviceRequest.id);
    const detailedPageDTO: LabOrderDetailedPageDTO = {
      ...listPageDTO,
      history: parseLabOrdersHistory(
        serviceRequest,
        orderStatus,
        tasks,
        results,
        practitioners,
        provenances,
        specimens,
        cache
      ),
      accountNumber: parseAccountNumber(serviceRequest, organizations),
      resultsDetails: parseLResultsDetails(
        serviceRequest,
        results,
        tasks,
        practitioners,
        provenances,
        resultPDFs,
        cache
      ),
      questionnaire: questionnaires,
      samples: parseSamples(serviceRequest, specimens),
      orderPdfUrl: orderPDF?.presignedURL,
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
  orderedCorrectedTasks: Task[];
  reflexCorrectedTasks: Task[];
} => {
  if (!serviceRequest.id) {
    return {
      taskPST: null,
      orderedFinalTasks: [],
      reflexFinalTasks: [],
      orderedPrelimTasks: [],
      reflexPrelimTasks: [],
      orderedCorrectedTasks: [],
      reflexCorrectedTasks: [],
    };
  }

  console.log('parsing tasks for service request', serviceRequest.id);

  const PST = parseTaskPST(tasks, serviceRequest.id);

  // parseResults returns filtered prelim results if there are final results with the same code
  // so we can just use the results from parseResults as base for filtering tasks
  const { orderedFinalAndCorrectedResults, reflexFinalAndCorrectedResults, orderedPrelimResults, reflexPrelimResults } =
    cache?.parsedResults || parseResults(serviceRequest, results);

  const orderedPrelimTasks = filterPrelimTasks(tasks, orderedPrelimResults).sort((a, b) =>
    compareDates(a.authoredOn, b.authoredOn)
  );

  const reflexPrelimTasks = filterPrelimTasks(tasks, reflexPrelimResults).sort((a, b) =>
    compareDates(a.authoredOn, b.authoredOn)
  );

  const orderedFinalTasks = filterFinalTasks(tasks, orderedFinalAndCorrectedResults).sort((a, b) =>
    compareDates(a.authoredOn, b.authoredOn)
  );

  const reflexFinalTasks = filterFinalTasks(tasks, reflexFinalAndCorrectedResults).sort((a, b) =>
    compareDates(a.authoredOn, b.authoredOn)
  );

  const orderedCorrectedTasks = filterCorrectedTasks(tasks, orderedFinalAndCorrectedResults).sort((a, b) =>
    compareDates(a.authoredOn, b.authoredOn)
  );

  const reflexCorrectedTasks = filterCorrectedTasks(tasks, reflexFinalAndCorrectedResults).sort((a, b) =>
    compareDates(a.authoredOn, b.authoredOn)
  );

  console.log('successfully parsed tasks');

  return {
    taskPST: PST,
    orderedPrelimTasks,
    orderedFinalTasks,
    reflexPrelimTasks,
    reflexFinalTasks,
    orderedCorrectedTasks,
    reflexCorrectedTasks,
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
  orderedFinalAndCorrectedResults: DiagnosticReport[];
  reflexFinalAndCorrectedResults: DiagnosticReport[];
  orderedPrelimResults: DiagnosticReport[];
  reflexPrelimResults: DiagnosticReport[];
} => {
  console.log('parsing results for serviceRequest', serviceRequest.id);
  if (!serviceRequest.id) {
    throw new Error('ServiceRequest ID is required');
  }

  const serviceRequestCodes = serviceRequest.code?.coding?.map((coding) => coding.code);

  if (!serviceRequestCodes?.length) {
    throw new Error('ServiceRequest code is required');
  }

  const relatedResults = filterResourcesBasedOnServiceRequest(results, serviceRequest.id);

  const orderedFinalAndCorrectedResults = new Map<string, DiagnosticReport>();
  const reflexFinalAndCorrectedResults = new Map<string, DiagnosticReport>();
  const orderedPrelimResults = new Map<string, DiagnosticReport>();
  const reflexPrelimResults = new Map<string, DiagnosticReport>();

  const finalResultStatuses = ['final', 'corrected'];

  for (let i = 0; i < relatedResults.length; i++) {
    const result = relatedResults[i];

    if (!result.id) {
      console.log(`Error: result ${result} has no id`);
      continue;
    }

    const resultCodes = result.code?.coding?.map((coding) => coding.code);

    if (resultCodes?.some((code) => serviceRequestCodes?.includes(code))) {
      if (result.status === 'preliminary') {
        orderedPrelimResults.set(result.id, result);
      } else if (finalResultStatuses.includes(result.status)) {
        orderedFinalAndCorrectedResults.set(result.id, result);
      } else {
        console.log(`Error: unknown status "${result.status}" for ordered result ${result.id}`);
      }
    } else {
      if (result.status === 'preliminary') {
        reflexPrelimResults.set(result.id, result);
      } else if (finalResultStatuses.includes(result.status)) {
        reflexFinalAndCorrectedResults.set(result.id, result);
      } else {
        console.log(`Error: unknown status "${result.status}" for reflex result ${result.id}`);
      }
    }
  }

  const orderedFinalCodes = extractCodesFromResults(orderedFinalAndCorrectedResults);
  const reflexFinalCodes = extractCodesFromResults(reflexFinalAndCorrectedResults);

  deletePrelimResultsIfFinalExists(orderedPrelimResults, orderedFinalCodes);
  deletePrelimResultsIfFinalExists(reflexPrelimResults, reflexFinalCodes);

  // todo: check the sort approach is correct
  return {
    orderedFinalAndCorrectedResults: Array.from(orderedFinalAndCorrectedResults.values()).sort((a, b) =>
      compareDates(a.meta?.lastUpdated, b.meta?.lastUpdated)
    ),
    reflexFinalAndCorrectedResults: Array.from(reflexFinalAndCorrectedResults.values()).sort((a, b) =>
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
  resultPDFs: LabResultPDF[];
  orderPDF: LabOrderPDF | undefined;
  specimens: Specimen[];
  patientLabItems: PatientLabItem[];
}> => {
  const labServiceRequestSearchParams = createLabServiceRequestSearchParams(params);
  console.log('labServiceRequestSearchParams', JSON.stringify(labServiceRequestSearchParams));

  const labOrdersResponsePromise = oystehr.fhir.search({
    resourceType: 'ServiceRequest',
    params: labServiceRequestSearchParams,
  });

  const patientLabItemsPromise = (async (): Promise<PatientLabItem[]> => {
    if (searchBy.searchBy.field === 'patientId') {
      try {
        const allServiceRequestsForPatient = await getAllServiceRequestsForPatient(oystehr, searchBy.searchBy.value);
        return parsePatientLabItems(allServiceRequestsForPatient);
      } catch (error) {
        console.error('Error fetching all service requests for patient:', error);
        return [] as PatientLabItem[];
      }
    }
    return [] as PatientLabItem[];
  })();

  const [labOrdersResponse, patientLabItems] = await Promise.all([labOrdersResponsePromise, patientLabItemsPromise]);

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
          | QuestionnaireResponse
          | DocumentReference
          | Specimen => Boolean(res)
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
    specimens,
    practitioners,
    documentReferences,
  } = extractLabResources(labResources);

  const isDetailPageRequest = searchBy.searchBy.field === 'serviceRequestId';
  console.log('isDetailPageRequest', isDetailPageRequest);

  const [serviceRequsetPractitioners, appointments, finalAndPrelimAndCorrectedTasks, questionnaires] =
    await Promise.all([
      fetchPractitionersForServiceRequests(oystehr, serviceRequests),
      fetchAppointmentsForServiceRequests(oystehr, serviceRequests, encounters),
      fetchFinalAndPrelimAndCorrectedTasks(oystehr, diagnosticReports),
      executeByCondition(isDetailPageRequest, () =>
        fetchQuestionnaireForServiceRequests(m2mtoken, serviceRequests, questionnaireResponses)
      ),
    ]);

  const allPractitioners = [...practitioners, ...serviceRequsetPractitioners];

  let resultPDFs: LabResultPDF[] = [];
  let orderPDF: LabOrderPDF | undefined;
  if (isDetailPageRequest) {
    const pdfs = await fetchLabOrderPDFsPresignedUrls(documentReferences, m2mtoken);
    if (pdfs) {
      resultPDFs = pdfs.resultPDFs;
      orderPDF = pdfs.orderPDF;
    }
  }

  const pagination = parsePaginationFromResponse(labOrdersResponse);

  return {
    serviceRequests,
    tasks: [...preSubmissionTasks, ...finalAndPrelimAndCorrectedTasks],
    diagnosticReports,
    practitioners: allPractitioners,
    encounters,
    locations,
    observations,
    appointments,
    provenances,
    organizations,
    questionnaires,
    resultPDFs,
    orderPDF,
    specimens,
    pagination,
    patientLabItems,
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

  // tracking board case
  if (searchBy.field === 'encounterIds') {
    searchParams.push({
      name: 'encounter',
      value: searchBy.value.map((id) => `Encounter/${id}`).join(','),
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

    searchParams.push({
      name: '_include',
      value: 'ServiceRequest:specimen',
    });

    searchParams.push({
      name: '_include:iterate',
      value: 'Specimen:collector',
    });

    searchParams.push({
      name: '_revinclude:iterate',
      value: 'DocumentReference:related',
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
    | Specimen
    | Practitioner
    | DocumentReference
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
  specimens: Specimen[];
  practitioners: Practitioner[];
  documentReferences: DocumentReference[];
} => {
  console.log('extracting lab resources');
  console.log(`${resources.length} resources total`);

  const serviceRequests: ServiceRequest[] = [];
  const tasks: Task[] = [];
  const diagnosticReports: DiagnosticReport[] = [];
  const encounters: Encounter[] = [];
  const locations: Location[] = [];
  const observations: Observation[] = [];
  const provenances: Provenance[] = [];
  const organizations: Organization[] = [];
  const questionnaireResponses: QuestionnaireResponse[] = [];
  const specimens: Specimen[] = [];
  const practitioners: Practitioner[] = [];
  const documentReferences: DocumentReference[] = [];
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
      tasks.push(resource);
    } else if (resource.resourceType === 'DiagnosticReport') {
      diagnosticReports.push(resource);
    } else if (resource.resourceType === 'Encounter') {
      encounters.push(resource);
    } else if (resource.resourceType === 'Observation') {
      observations.push(resource);
    } else if (resource.resourceType === 'Provenance') {
      provenances.push(resource);
    } else if (resource.resourceType === 'Organization') {
      organizations.push(resource);
    } else if (resource.resourceType === 'QuestionnaireResponse') {
      questionnaireResponses.push(resource as QuestionnaireResponse);
    } else if (resource.resourceType === 'Location') {
      locations.push(resource);
    } else if (resource.resourceType === 'Specimen') {
      specimens.push(resource);
    } else if (resource.resourceType === 'Practitioner') {
      practitioners.push(resource);
    } else if (resource.resourceType === 'DocumentReference') {
      documentReferences.push(resource);
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
    specimens,
    practitioners,
    documentReferences,
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

export const fetchFinalAndPrelimAndCorrectedTasks = async (
  oystehr: Oystehr,
  results: DiagnosticReport[]
): Promise<Task[]> => {
  const resultsIds = results.map((result) => result.id).filter(Boolean);

  if (!resultsIds.length) {
    return [];
  }

  // We shouldn't filter out the cancelled tasks in this query
  // if there is a RCRT task, we still want to take the latest cancelled RFRT if it isn't completed
  // we need that cancelled RFRT to show in the history table as "Received"
  const tasksResponse = (
    await oystehr.fhir.search<Task>({
      resourceType: 'Task',
      params: [
        {
          name: 'based-on',
          value: resultsIds.join(','),
        },
      ],
    })
  ).unbundle();

  const getDrIdFromTask = (task: Task): string | undefined => {
    return task.basedOn
      ?.find((ref): ref is Reference => ref.reference?.startsWith('DiagnosticReport/') ?? false)
      ?.reference?.split('/')[1];
  };

  // actually have to find whether or not there is a corrected result for a given DR.id.
  // the edge case is if the ordered test gets a corrected result before the review, AND the reflex test gets a corrected result before the review,
  // you need to take both cancelled RFRTs to display in the history table
  const resultIdToHasReviewCorrectedResultMap = new Map<string, boolean>();
  const taskIdToResultIdMap = new Map<string, string>();

  tasksResponse.forEach((task) => {
    const drId = getDrIdFromTask(task);
    if (drId && task.id) {
      const drHasCorrectedResult = !!resultIdToHasReviewCorrectedResultMap.get(drId);
      resultIdToHasReviewCorrectedResultMap.set(
        drId,
        task.code?.coding?.some((coding) => coding.code === LAB_ORDER_TASK.code.reviewCorrectedResult) ||
          drHasCorrectedResult
      );
      taskIdToResultIdMap.set(task.id, drId);
    }
  });

  const tasksToReturn: Task[] = [];
  const drIdToLatestRFRTMap = new Map<string, Task>();

  tasksResponse.forEach((task) => {
    // easy case, we take all non-cancelled. identical to previous behavior
    // Note: this will only show the latest correction for a given result (so if there were multiple corrections sent,
    // you'd only see the latest one until it was reviewed)
    if (task.status !== 'cancelled') {
      tasksToReturn.push(task);
      return;
    }

    // if there is a corrected result, we may need to take a cancelled RFRT, but only the latest one for that result.
    // this happens in cases where a RCRT comes in and cancels the RFRT before a review has occurred
    if (task.id) {
      const drIdForTask = taskIdToResultIdMap.get(task.id);
      if (
        drIdForTask &&
        resultIdToHasReviewCorrectedResultMap.get(drIdForTask) &&
        task.code?.coding?.some((coding) => coding.code === LAB_ORDER_TASK.code.reviewFinalResult)
      ) {
        // compare it to the latest cancelled RFRT and take the later one
        const latestRFRT = drIdToLatestRFRTMap.get(drIdForTask);
        if (!latestRFRT) {
          drIdToLatestRFRTMap.set(drIdForTask, task);
          return;
        }

        if (compareDates(latestRFRT.authoredOn, task.authoredOn) > 0) {
          drIdToLatestRFRTMap.set(drIdForTask, task);
        }
      }
    }
  });

  tasksToReturn.push(...drIdToLatestRFRTMap.values());

  console.log(
    `>>> These are the tasks returned from fetchFinalAndPrelimAndCorrectedTasks`,
    JSON.stringify(tasksToReturn)
  );

  return tasksToReturn;
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
    return ExternalLabsStatus.unknown;
  }

  const { orderedFinalAndCorrectedResults, reflexFinalAndCorrectedResults, orderedPrelimResults, reflexPrelimResults } =
    cache?.parsedResults || parseResults(serviceRequest, results);

  const { taskPST, orderedFinalTasks, reflexFinalTasks, orderedCorrectedTasks, reflexCorrectedTasks } =
    cache?.parsedTasks ||
    parseTasks({
      tasks,
      serviceRequest,
      results,
    });

  const finalAndCorrectedTasks = [
    ...orderedFinalTasks,
    ...reflexFinalTasks,
    ...orderedCorrectedTasks,
    ...reflexCorrectedTasks,
  ];
  const finalResults = [...orderedFinalAndCorrectedResults, ...reflexFinalAndCorrectedResults];
  const prelimResults = [...orderedPrelimResults, ...reflexPrelimResults];

  const hasCompletedPSTTask = taskPST?.status === 'completed';
  const isActiveServiceRequest = serviceRequest.status === 'active';

  const hasAllConditions = (conditions: Record<string, boolean>): boolean =>
    Object.values(conditions).every((condition) => condition === true);

  // 'pending': If the SR.status == draft and a pre-submission task exists
  const pendingStatusConditions = {
    serviceRequestStatusIsDraft: serviceRequest.status === 'draft',
    pstTaskStatusIsReady: taskPST?.status === 'ready',
  };

  if (hasAllConditions(pendingStatusConditions)) {
    return ExternalLabsStatus.pending;
  }

  // 'sent': If Task(PST).status == completed, SR.status == active, and there is no DR for the ordered test code
  const sentStatusConditions = {
    hasCompletedPSTTask,
    isActiveServiceRequest,
    noFinalResults: orderedFinalAndCorrectedResults.length === 0,
    noPrelimResults: prelimResults.length === 0,
  };

  if (hasAllConditions(sentStatusConditions)) {
    return ExternalLabsStatus.sent;
  }

  const hasPrelimResults = prelimResults.length > 0;

  // 'prelim': DR.status == 'preliminary', Task(PST).status == completed, SR.status == active
  const prelimStatusConditions = {
    hasPrelimResults,
    hasCompletedPSTTask,
    isActiveServiceRequest,
  };

  if (hasAllConditions(prelimStatusConditions)) {
    return ExternalLabsStatus.prelim;
  }

  // 'corrected': DR.status == 'corrected', Task(RCT).status == 'ready'
  const hasReadyRCRTWithCorrectedResult = finalAndCorrectedTasks.some((task) => {
    if (
      !(
        task.code?.coding?.some((coding) => coding.code === LAB_ORDER_TASK.code.reviewCorrectedResult) &&
        task.status === 'ready'
      )
    )
      return false;

    const relatedFinalResults = parseResultByTask(task, finalResults);
    return relatedFinalResults.some((result) => result.status === 'corrected');
  });

  const correctedResultConditions = {
    hasReadyRCRTWithCorrectedResult,
  };

  if (hasAllConditions(correctedResultConditions)) {
    return ExternalLabsStatus.corrected;
  }

  // received: Task(RFRT).status = 'ready' and DR the Task is basedOn have DR.status = ‘final’
  const hasReadyTaskWithFinalResult = finalAndCorrectedTasks.some((task) => {
    if (task.status !== 'ready') {
      return false;
    }

    const relatedFinalResults = parseResultByTask(task, finalResults);
    return relatedFinalResults.length > 0;
  });

  const receivedStatusConditions = {
    hasReadyTaskWithFinalResult,
  };

  if (hasAllConditions(receivedStatusConditions)) {
    return ExternalLabsStatus.received;
  }

  //  reviewed: Task(RFRT).status = 'completed' and DR the Task is basedOn have DR.status = ‘final’
  const hasCompletedTaskWithFinalResult = finalAndCorrectedTasks.some((task) => {
    if (task.status !== 'completed') {
      return false;
    }

    const relatedFinalResults = parseResultByTask(task, finalResults);
    return relatedFinalResults.length > 0;
  });

  const reviewedStatusConditions = {
    hasCompletedTaskWithFinalResult,
  };

  if (hasAllConditions(reviewedStatusConditions)) {
    return ExternalLabsStatus.reviewed;
  }

  console.log(
    `Error: unknown status for ServiceRequest/${serviceRequest.id}. Here are the conditions for determining the status, all conditions must be true for picking the corresponding status:`,
    JSON.stringify(
      {
        pendingStatusConditions,
        sentStatusConditions,
        prelimStatusConditions,
        correctedResultConditions,
        receivedStatusConditions,
        reviewedStatusConditions,
      },
      null,
      2
    )
  );

  return ExternalLabsStatus.unknown;
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

export const parseReviewerNameFromTask = (task: Task, practitioners: Practitioner[]): string => {
  const performerId = task.owner?.reference?.split('/').pop() || '';
  return parsePractitionerName(performerId, practitioners);
};

export const parsePractitionerName = (practitionerId: string | undefined, practitioners: Practitioner[]): string => {
  const NOT_FOUND = '';

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
  const { reflexFinalAndCorrectedResults, reflexPrelimResults } =
    cache?.parsedResults || parseResults(serviceRequest, results);
  return (reflexFinalAndCorrectedResults.length || 0) + (reflexPrelimResults.length || 0);
};

export const parsePerformed = (specimen: Specimen, practitioners: Practitioner[]): string => {
  console.log('parsing performed by for specimen', specimen.id);
  const NOT_FOUND = '';

  const collectedById = specimen.collection?.collector?.reference?.replace('Practitioner/', '');
  if (collectedById) {
    return parsePractitionerName(collectedById, practitioners);
  }

  return NOT_FOUND;
};

export const parsePerformedDate = (specimen: Specimen): string => {
  console.log('parsing performed date for specimen', specimen.id);
  return specimen.collection?.collectedDateTime || '-';
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
  console.log('getting appointment id for service request', serviceRequest.id);
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

const parseLocationTimezoneForSR = (serviceRequest: ServiceRequest, locations: Location[]): string | undefined => {
  const location = locations.find((location) => {
    const locationRef = `Location/${location.id}`;
    return serviceRequest.locationReference?.find((srLocationRef) => srLocationRef.reference === locationRef);
  });

  return location ? getTimezone(location) : undefined;
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
  const { orderedFinalAndCorrectedResults, reflexFinalAndCorrectedResults, orderedPrelimResults, reflexPrelimResults } =
    cache?.parsedResults || parseResults(serviceRequest, results);

  const accessionNumbers = [
    ...orderedFinalAndCorrectedResults,
    ...reflexFinalAndCorrectedResults,
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

export const parseLabOrderAddedDate = (
  serviceRequest: ServiceRequest,
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

  return taskPST?.authoredOn || '';
};

export const parseLabOrderLastResultReceivedDate = (
  serviceRequest: ServiceRequest,
  results: DiagnosticReport[],
  tasks: Task[],
  cache?: Cache
): string => {
  const {
    orderedPrelimTasks,
    reflexPrelimTasks,
    orderedFinalTasks,
    reflexFinalTasks,
    orderedCorrectedTasks,
    reflexCorrectedTasks,
  } =
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
      orderedCorrectedTasks[0]?.authoredOn,
      reflexCorrectedTasks[0]?.authoredOn,
    ]
      .filter(Boolean)
      .sort((a, b) => compareDates(a, b))[0] || '';

  return lastResultReceivedDate;
};

export const parseLabOrdersHistory = (
  serviceRequest: ServiceRequest,
  orderStatus: ExternalLabsStatus,
  tasks: Task[],
  results: DiagnosticReport[],
  practitioners: Practitioner[],
  provenances: Provenance[],
  specimens: Specimen[],
  cache?: Cache
): LabOrderHistoryRow[] => {
  console.log('building order history for external lab service request', serviceRequest.id);
  const { orderedFinalTasks, reflexFinalTasks, orderedCorrectedTasks, reflexCorrectedTasks } =
    cache?.parsedTasks ||
    parseTasks({
      tasks,
      serviceRequest,
      results,
    });

  const orderedBy = parsePractitionerNameFromServiceRequest(serviceRequest, practitioners);
  const orderAddedDate = parseLabOrderAddedDate(serviceRequest, tasks, results, cache);

  const history: LabOrderHistoryRow[] = [
    {
      action: 'ordered',
      performer: orderedBy,
      date: orderAddedDate,
    },
  ];

  if (orderStatus === ExternalLabsStatus.pending) return history;

  const isPSC = parseIsPSC(serviceRequest);

  const pushPerformedHistory = (specimen: Specimen): void => {
    history.push({
      action: 'performed',
      performer: isPSC ? '' : parsePerformed(specimen, practitioners),
      date: isPSC ? '-' : parsePerformedDate(specimen),
    });
  };

  // only push performed to order history if this is a psc order or there is a specimen to parse data from
  // not having a specimen for a non psc order is probably an edge case but was causing issues for autolab
  (isPSC || specimens[0]) && pushPerformedHistory(specimens[0]);

  // todo: design is required https://github.com/masslight/ottehr/issues/2177
  // handle if there are multiple specimens (the first one is handled above)
  // specimens.slice(1).forEach((specimen) => {
  //   pushPerformedHistory(specimen);
  // });

  const taggedReflexTasks = [...reflexFinalTasks, ...reflexCorrectedTasks].map(
    (task) => ({ ...task, testType: 'reflex' }) as const
  );
  const taggedOrderedTasks = [...orderedFinalTasks, ...orderedCorrectedTasks].map(
    (task) => ({ ...task, testType: 'ordered' }) as const
  );

  const finalTasks = [...taggedReflexTasks, ...taggedOrderedTasks].sort((a, b) =>
    compareDates(a.authoredOn, b.authoredOn)
  );

  finalTasks.forEach((task) => {
    history.push(...parseTaskReceivedAndReviewedAndCorrectedHistory(task, practitioners, provenances));
  });

  return history.sort((a, b) => compareDates(b.date, a.date));
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

export const parseTaskReceivedAndReviewedAndCorrectedHistory = (
  task: Task & { testType: 'reflex' | 'ordered' },
  practitioners: Practitioner[],
  provenances: Provenance[]
): LabOrderHistoryRow[] => {
  const result: LabOrderHistoryRow[] = [];
  const receivedDate = parseTaskReceivedOrCorrectedInfo(task);

  if (receivedDate) {
    result.push({ ...receivedDate, testType: task.testType });
  }

  const status = `${
    task.status === 'completed'
      ? 'reviewed'
      : task.code?.coding?.some((coding) => coding.code === LAB_ORDER_TASK.code.reviewCorrectedResult)
      ? 'corrected'
      : 'received'
  }` as const;

  if (status !== 'reviewed') {
    return result;
  }

  const reviewedDate = parseTaskReviewedInfo(task, practitioners, provenances);

  if (reviewedDate) {
    result.push({ ...reviewedDate, testType: task.testType });
  }

  return result;
};

export const parseTaskReceivedOrCorrectedInfo = (task: Task): Omit<LabOrderHistoryRow, 'resultType'> | null => {
  return {
    action: task.code?.coding?.some((coding) => coding.code === LAB_ORDER_TASK.code.reviewCorrectedResult)
      ? 'corrected'
      : 'received',
    performer: '',
    date: task.authoredOn || '',
  };
};

export const parseTaskReviewedInfo = (
  task: Task,
  practitioners: Practitioner[],
  provenances: Provenance[]
): Omit<LabOrderHistoryRow, 'resultType'> | null => {
  const reviewProvenance = parseReviewProvenanceForTask(task, provenances);

  if (!reviewProvenance) {
    return null;
  }

  return {
    action: 'reviewed',
    performer: parseReviewerNameFromProvenance(reviewProvenance, practitioners), // also may be received with parseReviewerNameFromTask(task, practitioners);
    date: reviewProvenance.recorded || '',
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

export const parseReviewerNameFromProvenance = (provenance: Provenance, practitioners: Practitioner[]): string => {
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
  results: DiagnosticReport[],
  tasks: Task[],
  practitioners: Practitioner[],
  provenances: Provenance[],
  resultPDFs: LabResultPDF[],
  cache?: Cache
): LabOrderResultDetails[] => {
  console.log('parsing external lab order results for service request', serviceRequest.id);
  if (!serviceRequest.id) {
    return [];
  }

  const { orderedFinalAndCorrectedResults, reflexFinalAndCorrectedResults, orderedPrelimResults, reflexPrelimResults } =
    cache?.parsedResults || parseResults(serviceRequest, results);

  const {
    orderedFinalTasks,
    reflexFinalTasks,
    orderedPrelimTasks,
    reflexPrelimTasks,
    orderedCorrectedTasks,
    reflexCorrectedTasks,
  } =
    cache?.parsedTasks ||
    parseTasks({
      tasks,
      serviceRequest,
      results,
    });

  const resultsDetails: LabOrderResultDetails[] = [];

  [
    {
      results: orderedFinalAndCorrectedResults,
      tasks: [...orderedFinalTasks, ...orderedCorrectedTasks],
      testType: 'ordered' as const,
      resultType: 'final' as const,
    },
    {
      results: reflexFinalAndCorrectedResults,
      tasks: [...reflexFinalTasks, ...reflexCorrectedTasks],
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
      const task = filterResourcesBasedOnDiagnosticReports(tasks, [result]).sort((a, b) =>
        compareDates(a.authoredOn, b.authoredOn)
      )[0];
      const reviewedDate = parseTaskReviewedInfo(task, practitioners, provenances)?.date || null;
      const resultPdfUrl = resultPDFs.find((pdf) => pdf.diagnosticReportId === result.id)?.presignedURL || null;
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
  // possible to have multiple a RFRT with status completed and RCRT with status ready or completed. We really only want the latest task
  const task = filterResourcesBasedOnDiagnosticReports(tasks, [result]).sort((a, b) =>
    compareDates(a.authoredOn, b.authoredOn)
  )[0];

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
        : result.status === 'corrected' && task.status === 'ready'
        ? ExternalLabsStatus.corrected
        : (result.status === 'final' || result.status == 'corrected') && task.status === 'completed'
        ? ExternalLabsStatus.reviewed
        : result.status === 'preliminary'
        ? ExternalLabsStatus.prelim
        : serviceRequest.status === 'draft' && PSTTask?.status === 'ready'
        ? ExternalLabsStatus.pending
        : serviceRequest.status === 'active' && PSTTask?.status === 'completed'
        ? ExternalLabsStatus.sent
        : ExternalLabsStatus.unknown,
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

export const isTaskCorrected = (task: Task): boolean => {
  return (
    task.code?.coding?.some(
      (coding) => coding.system === LAB_ORDER_TASK.system && coding.code === LAB_ORDER_TASK.code.reviewCorrectedResult
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

export const filterCorrectedTasks = (tasks: Task[], results: DiagnosticReport[]): Task[] => {
  const relatedTasks = filterResourcesBasedOnDiagnosticReports(tasks, results);
  return relatedTasks.filter(isTaskCorrected);
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

// RPRT (Review Preliminary Result Task), RFRT (Review Final Results Tasks), and RCRT (Review Corrected Result Task) are based on DiagnosticReport
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

export const parseSamples = (serviceRequest: ServiceRequest, specimens: Specimen[]): sampleDTO[] => {
  console.log('parsing samples for service request & specimen', serviceRequest.id, specimens?.length);
  const NOT_FOUND = 'Not specified';

  if (!serviceRequest.contained || !serviceRequest.contained.length) {
    console.log('Error: No contained resources found in serviceRequest');
    return [];
  }

  const activityDefinition = serviceRequest.contained.find(
    (resource): resource is ActivityDefinition => resource.resourceType === 'ActivityDefinition'
  );

  if (!activityDefinition || !activityDefinition.specimenRequirement) {
    console.log('Error: No specimenRequirement found in activityDefinition');
    return [];
  }

  const specimenDefinitionRefs = activityDefinition.specimenRequirement.map((req) => req.reference);
  const result: sampleDTO[] = [];

  for (let i = 0; i < specimenDefinitionRefs.length; i++) {
    const ref = specimenDefinitionRefs[i];
    if (!ref) {
      console.log('Error: No reference found in specimenDefinitionRefs');
      continue;
    }

    const specDefId = ref.startsWith('#') ? ref.substring(1) : ref;
    const specimenDefinition = serviceRequest.contained.find(
      (resource) => resource.resourceType === 'SpecimenDefinition' && resource.id === specDefId
    );
    if (!specimenDefinition) {
      console.log(`Error: SpecimenDefinition with id ${specDefId} not found in contained resources`);
      continue;
    }

    if (!('typeTested' in specimenDefinition)) {
      console.log(`Error: SpecimenDefinition ${specDefId} has no typeTested.`);
      continue;
    }
    if (!Array.isArray(specimenDefinition.typeTested) || specimenDefinition.typeTested.length === 0) {
      console.log(`Error: SpecimenDefinition ${specDefId} is not array or empty.`);
      continue;
    }

    // by the dev design typeTestedInfo should have preferred preference
    const typeTestedInfo = specimenDefinition.typeTested.find((item) => item.preference === 'preferred');
    if (!typeTestedInfo) {
      console.log(`Error: SpecimenDefinition ${specDefId} has no typeTested with preference = 'preferred'`);
    }

    const container = typeTestedInfo?.container?.description;

    const minimumVolume = typeTestedInfo?.container?.minimumVolumeString;

    // by dev design for storage requirements handling[0].instruction should be used
    const storageRequirements = typeTestedInfo?.handling?.[0]?.instruction;

    const volumeInfo = specimenDefinition.collection?.find(
      (item) =>
        item.coding?.some(
          (code) =>
            code.system === SPECIMEN_CODING_CONFIG.collection.system &&
            code.code === SPECIMEN_CODING_CONFIG.collection.code.specimenVolume
        )
    );

    const volume = volumeInfo?.text;

    const instructionsInfo = specimenDefinition.collection?.find(
      (item: any) =>
        item.coding?.some(
          (code: any) =>
            code.system === SPECIMEN_CODING_CONFIG.collection.system &&
            code.code === SPECIMEN_CODING_CONFIG.collection.code.collectionInstructions
        )
    );

    const collectionInstructions = instructionsInfo?.text;

    const relatedSpecimens = specimens.filter((spec) => {
      const isMatchServiceRequest = spec.request?.some(
        (req) => req.reference === `ServiceRequest/${serviceRequest.id}`
      );

      if (!isMatchServiceRequest) {
        return false;
      }

      const relatedSdId = spec.extension?.find((ext) => ext.url === RELATED_SPECIMEN_DEFINITION_SYSTEM)?.valueString;
      if (!relatedSdId) {
        return false;
      }

      return relatedSdId === specimenDefinition.id;
    });

    if (relatedSpecimens.length > 1) {
      console.log(
        `Error: More than one specimen found for ServiceRequest/${serviceRequest.id} and SpecimenDefinition/${specDefId}`
      );
      continue;
    }

    const specimen = relatedSpecimens[0];

    if (!specimen?.id) {
      console.log(
        `Error: No matching specimen found for ServiceRequest/${serviceRequest.id} and SpecimenDefinition/${specDefId}`
      );
      continue;
    }

    const collectionDate = specimen.collection?.collectedDateTime;

    const logAboutMissingData = (info: string): void => console.log(`Warning: ${info} is undefined`);

    result.push({
      specimen: {
        id: specimen.id,
        collectionDate,
      },
      definition: {
        container: container || (logAboutMissingData('container'), NOT_FOUND),
        volume: volume || (logAboutMissingData('volume'), NOT_FOUND),
        minimumVolume: minimumVolume || (logAboutMissingData('minimumVolume'), NOT_FOUND),
        storageRequirements: storageRequirements || (logAboutMissingData('storageRequirements'), NOT_FOUND),
        collectionInstructions: collectionInstructions || (logAboutMissingData('collectionInstructions'), NOT_FOUND),
      },
    });
  }

  return result;
};

export const parsePatientLabItems = (serviceRequests: ServiceRequest[]): PatientLabItem[] => {
  const labItemsMap = new Map<string, PatientLabItem>();

  serviceRequests.forEach((serviceRequest) => {
    const activityDefinition = serviceRequest.contained?.find(
      (resource) => resource.resourceType === 'ActivityDefinition'
    ) as ActivityDefinition | undefined;

    if (activityDefinition?.code?.coding) {
      activityDefinition.code.coding.forEach((coding) => {
        if (coding.code && coding.display && coding.system === OYSTEHR_LAB_OI_CODE_SYSTEM) {
          labItemsMap.set(coding.code, {
            code: coding.code,
            display: coding.display,
          });
        }
      });
    }
  });

  return Array.from(labItemsMap.values()).sort((a, b) => a.display.localeCompare(b.display));
};

export const getAllServiceRequestsForPatient = async (
  oystehr: Oystehr,
  patientId: string
): Promise<ServiceRequest[]> => {
  console.log('Fetching ALL service requests for patient:', patientId);

  const baseSearchParams: SearchParam[] = [
    {
      name: 'subject',
      value: `Patient/${patientId}`,
    },
    {
      name: 'code',
      value: `${OYSTEHR_LAB_OI_CODE_SYSTEM}|`,
    },
    {
      name: 'code:missing',
      value: 'false',
    },
    {
      name: '_count',
      value: '100',
    },
    {
      name: '_sort',
      value: '-_lastUpdated',
    },
  ];

  let offset = 0;
  const serviceRequestsMap = new Map<string, ServiceRequest>();
  let bundle = await oystehr.fhir.search<ServiceRequest>({
    resourceType: 'ServiceRequest',
    params: [...baseSearchParams, { name: '_offset', value: offset.toString() }],
  });

  const processPageResults = (pageBundle: Bundle<ServiceRequest>): void => {
    pageBundle.entry
      ?.map((entry) => entry.resource as ServiceRequest)
      .filter((sr) => {
        return sr.contained?.some((contained) => contained.resourceType === 'ActivityDefinition');
      })
      .forEach((sr) => {
        if (sr.id) {
          serviceRequestsMap.set(sr.id, sr);
        }
      });
  };

  processPageResults(bundle);

  while (bundle.link?.find((link) => link.relation === 'next')) {
    offset += 100;

    bundle = await oystehr.fhir.search<ServiceRequest>({
      resourceType: 'ServiceRequest',
      params: [
        ...baseSearchParams.filter((param) => param.name !== '_offset'),
        { name: '_offset', value: offset.toString() },
      ],
    });

    processPageResults(bundle);
  }

  const allServiceRequests = Array.from(serviceRequestsMap.values());
  console.log(`Found ${allServiceRequests.length} unique service requests for patient`);
  return allServiceRequests;
};
