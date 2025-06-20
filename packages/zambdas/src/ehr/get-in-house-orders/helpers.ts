import Oystehr, { SearchParam } from '@oystehr/sdk';
import {
  ActivityDefinition,
  Appointment,
  BundleEntry,
  Encounter,
  Resource,
  Practitioner,
  ServiceRequest,
  Task,
  Provenance,
  Location,
  FhirResource,
  Specimen,
  Observation,
  DiagnosticReport,
} from 'fhir/r4b';
import {
  compareDates,
  fetchDocumentReferencesForDiagnosticReports,
  LabResultPDF,
  getTimezone,
  DEFAULT_IN_HOUSE_LABS_ITEMS_PER_PAGE,
  Secrets,
  InHouseGetOrdersResponseDTO,
} from 'utils';
import { getMyPractitionerId, createOystehrClient, sendErrors, captureSentryException } from '../../shared';
import {
  EMPTY_PAGINATION,
  isPositiveNumberOrZero,
  InHouseOrderListPageItemDTO,
  InHouseOrdersSearchBy,
  Pagination,
  DiagnosisDTO,
  convertActivityDefinitionToTestItem,
  getFullestAvailableName,
  PRACTITIONER_CODINGS,
  TestStatus,
  IN_HOUSE_TEST_CODE_SYSTEM,
} from 'utils';
import { GetZambdaInHouseOrdersParams } from './validateRequestParameters';
import {
  getSpecimenDetails,
  taskIsBasedOnServiceRequest,
  determineOrderStatus,
  buildOrderHistory,
  getUrlAndVersionForADFromServiceRequest,
  getServiceRequestsRelatedViaRepeat,
  fetchResultResourcesForRepeatServiceRequest,
} from '../shared/inhouse-labs';
import { fetchLabOrderPDFsPresignedUrls } from '../shared/labs';

// cache for the service request context
type Cache = {
  parsedTasks?: ReturnType<typeof parseTasks>;
  activityDefinition?: ActivityDefinition;
};

export const mapResourcesToInHouseOrderDTOs = <SearchBy extends InHouseOrdersSearchBy>(
  searchBy: SearchBy,
  serviceRequests: ServiceRequest[],
  tasks: Task[],
  practitioners: Practitioner[],
  encounters: Encounter[],
  appointments: Appointment[],
  provenances: Provenance[],
  activityDefinitions: ActivityDefinition[],
  specimens: Specimen[],
  observations: Observation[],
  diagnosticReports: DiagnosticReport[],
  resultsPDFs: LabResultPDF[],
  secrets: Secrets | null,
  currentPractitioner?: Practitioner,
  timezone?: string
): InHouseGetOrdersResponseDTO<SearchBy>['data'] => {
  const result: InHouseGetOrdersResponseDTO<SearchBy>['data'] = [];

  for (const serviceRequest of serviceRequests) {
    try {
      const parsedTasks = parseTasks(tasks, serviceRequest);

      const activityDefinition = findActivityDefinitionForServiceRequest(serviceRequest, activityDefinitions);

      const cache: Cache = {
        parsedTasks,
        activityDefinition,
      };

      const relatedDiagnosticReports = diagnosticReports.filter(
        (dr) => dr.basedOn?.some((ref) => ref.reference === `ServiceRequest/${serviceRequest.id}`)
      );

      const resultsPDF = resultsPDFs.find((pdf) => pdf.diagnosticReportId === relatedDiagnosticReports[0]?.id);

      result.push(
        parseOrderData({
          searchBy,
          serviceRequest,
          tasks,
          practitioners,
          encounters,
          appointments,
          provenances,
          activityDefinitions,
          specimens,
          observations,
          cache,
          resultsPDF,
          currentPractitionerName: currentPractitioner ? getFullestAvailableName(currentPractitioner) || '' : '',
          currentPractitionerId: currentPractitioner?.id || '',
          timezone,
        })
      );
    } catch (error) {
      console.error(`Error parsing order data for service request ${serviceRequest.id}:`, error, JSON.stringify(error));
      void sendErrors('get-in-house-orders', error, secrets, captureSentryException);
    }
  }

  return result;
};

export const parseOrderData = <SearchBy extends InHouseOrdersSearchBy>({
  searchBy,
  serviceRequest,
  tasks,
  practitioners,
  encounters,
  appointments,
  provenances,
  activityDefinitions,
  specimens,
  observations,
  cache,
  resultsPDF,
  currentPractitionerName,
  currentPractitionerId,
  timezone,
}: {
  searchBy: SearchBy;
  serviceRequest: ServiceRequest;
  tasks: Task[];
  practitioners: Practitioner[];
  encounters: Encounter[];
  appointments: Appointment[];
  provenances: Provenance[];
  activityDefinitions: ActivityDefinition[];
  specimens: Specimen[];
  observations: Observation[];
  cache?: Cache;
  resultsPDF?: LabResultPDF;
  currentPractitionerName?: string;
  currentPractitionerId?: string;
  timezone?: string;
}): InHouseGetOrdersResponseDTO<SearchBy>['data'][number] => {
  console.log('parsing inhouse order data');
  if (!serviceRequest.id) {
    throw new Error('ServiceRequest ID is required');
  }

  const appointmentId = parseAppointmentId(serviceRequest, encounters);
  const appointment = appointments.find((a) => a.id === appointmentId);
  const encounter = encounters.find((e) => e.id === parseEncounterId(serviceRequest));

  const activityDefinition =
    cache?.activityDefinition || findActivityDefinitionForServiceRequest(serviceRequest, activityDefinitions);

  if (!activityDefinition) {
    console.error(`ActivityDefinition not found for ServiceRequest ${serviceRequest.id}`);
    throw new Error(`ActivityDefinition not found for ServiceRequest ${serviceRequest.id}`);
  }

  const testItem = convertActivityDefinitionToTestItem(activityDefinition, observations, serviceRequest);
  const orderStatus = determineOrderStatus(serviceRequest, tasks);
  console.log('orderStatus:', orderStatus);
  const attendingPractitioner = parseAttendingPractitioner(encounter, practitioners);
  const diagnosisDTO = parseDiagnoses(serviceRequest);

  console.log('formatting listPageDTO');
  const listPageDTO: InHouseOrderListPageItemDTO = {
    appointmentId: appointmentId,
    testItemName: testItem.name,
    status: orderStatus,
    visitDate: parseVisitDate(appointment),
    orderingPhysicianFullName: attendingPractitioner ? getFullestAvailableName(attendingPractitioner) || '' : '',
    resultReceivedDate: parseResultsReceivedDate(serviceRequest, tasks),
    diagnosesDTO: diagnosisDTO,
    timezone: timezone,
    orderAddedDate: parseOrderAddedDate(serviceRequest, tasks),
    serviceRequestId: serviceRequest.id,
  };

  if (searchBy.searchBy.field === 'serviceRequestId') {
    console.log('serchBy field === serviceRequestId - indicates request was triggered on detail page');
    const relatedSpecimen = specimens.find(
      (specimen) => specimen.request?.some((req) => req.reference === `ServiceRequest/${serviceRequest.id}`)
    );
    const orderHistory = buildOrderHistory(provenances, serviceRequest, relatedSpecimen); // Pass specimen if available
    const relatedSpecimens = specimens.filter(
      (s) => s.request?.some((req) => req.reference === `ServiceRequest/${serviceRequest.id}`)
    );

    const detailedPageDTO = {
      ...listPageDTO,
      labDetails: testItem,
      orderingPhysicianId: attendingPractitioner?.id || '',
      currentUserFullName: currentPractitionerName || '',
      currentUserId: currentPractitionerId || '',
      resultsPDFUrl: resultsPDF?.presignedURL,
      orderHistory,
      specimen: relatedSpecimens[0] ? getSpecimenDetails(relatedSpecimens[0]) : undefined,
      notes: serviceRequest.note?.[0]?.text || '',
    };

    return detailedPageDTO;
  }

  return listPageDTO;
};

export const parseTasks = (
  tasks: Task[],
  serviceRequest: ServiceRequest
): {
  allTasks: Task[];
  latestTask: Task | null;
} => {
  if (!serviceRequest.id) {
    return {
      allTasks: [],
      latestTask: null,
    };
  }

  const relatedTasks = tasks
    .filter((task) => taskIsBasedOnServiceRequest(task, serviceRequest))
    .sort((a, b) => compareDates(a.authoredOn, b.authoredOn));

  return {
    allTasks: relatedTasks,
    latestTask: relatedTasks[0] || null,
  };
};

export const getInHouseResources = async (
  oystehr: Oystehr,
  params: GetZambdaInHouseOrdersParams,
  searchBy: InHouseOrdersSearchBy,
  userToken: string,
  m2mtoken: string
): Promise<{
  serviceRequests: ServiceRequest[];
  tasks: Task[];
  practitioners: Practitioner[];
  encounters: Encounter[];
  locations: Location[];
  appointments: Appointment[];
  provenances: Provenance[];
  activityDefinitions: ActivityDefinition[];
  specimens: Specimen[];
  observations: Observation[];
  pagination: Pagination;
  diagnosticReports: DiagnosticReport[];
  resultsPDFs: LabResultPDF[];
  currentPractitioner?: Practitioner;
  timezone: string | undefined;
}> => {
  const searchParams = createInHouseServiceRequestSearchParams(params);

  const inHouseOrdersResponse = await oystehr.fhir.search({
    resourceType: 'ServiceRequest',
    params: searchParams,
  });

  const resources = inHouseOrdersResponse.unbundle().filter((res): res is FhirResource => Boolean(res)) || [];

  const pagination = parsePaginationFromResponse(inHouseOrdersResponse);

  const {
    serviceRequests,
    tasks,
    encounters,
    locations,
    provenances,
    specimens,
    observations,
    diagnosticReports,
    activityDefinitions,
  } = extractInHouseResources(resources);

  const isDetailPageRequest = searchBy.searchBy.field === 'serviceRequestId';

  let currentPractitioner: Practitioner | undefined;
  let resultsPDFs: LabResultPDF[] = [];

  if (isDetailPageRequest && userToken) {
    // if more than one ServiceRequest is returned for when this is called from the detail page
    // we can assume that there are related tests via the repeat test workflow
    // either the service request id passed was the initial test (no basedOn)
    // or it was a repeat test (will have a baseOn property)
    if (serviceRequests.length > 1) {
      const repeatTestingSrs = getServiceRequestsRelatedViaRepeat(serviceRequests, searchBy.searchBy.value as string);
      // we need to grab additional resources for these additional SRs that will be rendered on the detail page
      const { repeatDiagnosticReports, repeatObservations, repeatProvenances, repeatTasks, repeatSpecimens } =
        await fetchResultResourcesForRepeatServiceRequest(oystehr, repeatTestingSrs);
      diagnosticReports.push(...repeatDiagnosticReports);
      observations.push(...repeatObservations);
      provenances.push(...repeatProvenances);
      tasks.push(...repeatTasks);
      specimens.push(...repeatSpecimens);
    }

    const oystehrCurrentUser = createOystehrClient(userToken, params.secrets);
    const myPractitionerId = await getMyPractitionerId(oystehrCurrentUser);

    if (myPractitionerId) {
      currentPractitioner = await oystehr.fhir.get<Practitioner>({
        resourceType: 'Practitioner',
        id: myPractitionerId,
      });
    }

    if (diagnosticReports.length > 0) {
      const resultsDocumentReferences = await fetchDocumentReferencesForDiagnosticReports(oystehr, diagnosticReports); // todo i think we can get this from the big query
      const pdfs = await fetchLabOrderPDFsPresignedUrls(resultsDocumentReferences, m2mtoken);
      if (pdfs) resultsPDFs = pdfs.resultPDFs;
    }
  }

  const timezone = locations[0] ? getTimezone(locations[0]) : undefined;

  const [practitioners, appointments] = await Promise.all([
    fetchPractitionersForServiceRequests(oystehr, serviceRequests, encounters),
    fetchAppointmentsForServiceRequests(oystehr, serviceRequests, encounters),
  ]);

  return {
    serviceRequests,
    tasks,
    practitioners,
    encounters,
    locations,
    appointments,
    provenances,
    activityDefinitions,
    specimens,
    observations,
    pagination,
    diagnosticReports,
    resultsPDFs,
    currentPractitioner,
    timezone,
  };
};

export const createInHouseServiceRequestSearchParams = (params: GetZambdaInHouseOrdersParams): SearchParam[] => {
  const { searchBy, visitDate, itemsPerPage = DEFAULT_IN_HOUSE_LABS_ITEMS_PER_PAGE, pageIndex = 0 } = params;

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
      name: 'code:missing',
      value: 'false',
    },
    {
      name: 'code',
      // empty value will search any code value for given system
      value: `${IN_HOUSE_TEST_CODE_SYSTEM}|${params.orderableItemCode || ''}`,
    },
    {
      name: '_include',
      value: 'ServiceRequest:encounter',
    },
    {
      name: '_revinclude',
      value: 'Task:based-on',
    },
    {
      name: '_revinclude',
      value: 'Provenance:target',
    },
    {
      name: '_include:iterate',
      value: 'Encounter:location',
    },
    {
      name: '_include',
      value: 'ServiceRequest:instantiates-canonical',
    },
  ];

  // Search by specific criteria
  if (searchBy.field === 'encounterId') {
    searchParams.push({
      name: 'encounter',
      value: `Encounter/${searchBy.value}`,
    });
  }

  if (searchBy.field === 'encounterIds') {
    searchParams.push({
      name: 'encounter',
      value: searchBy.value.map((id) => `Encounter/${id}`).join(','),
    });
  }

  if (searchBy.field === 'patientId') {
    searchParams.push({
      name: 'subject',
      value: `Patient/${searchBy.value}`,
    });
  }

  if (searchBy.field === 'serviceRequestId') {
    searchParams.push({
      name: '_id',
      value: searchBy.value,
    });

    // Include specimens for detailed view
    searchParams.push({
      name: '_include',
      value: 'ServiceRequest:specimen',
    });

    // Include observations for lab details
    searchParams.push({
      name: '_revinclude',
      value: 'Observation:based-on',
    });

    // Include the DR for grabbing pdf url
    searchParams.push({
      name: '_revinclude',
      value: 'DiagnosticReport:based-on',
    });

    // Include any related repeat test SRs
    searchParams.push({
      name: '_include:iterate',
      value: 'ServiceRequest:based-on',
    });
    searchParams.push({
      name: '_revinclude:iterate',
      value: 'ServiceRequest:based-on',
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

export const extractInHouseResources = (
  resources: FhirResource[]
): {
  serviceRequests: ServiceRequest[];
  tasks: Task[];
  encounters: Encounter[];
  locations: Location[];
  provenances: Provenance[];
  specimens: Specimen[];
  observations: Observation[];
  diagnosticReports: DiagnosticReport[];
  activityDefinitions: ActivityDefinition[];
} => {
  const serviceRequests: ServiceRequest[] = [];
  const tasks: Task[] = [];
  const encounters: Encounter[] = [];
  const locations: Location[] = [];
  const provenances: Provenance[] = [];
  const specimens: Specimen[] = [];
  const observations: Observation[] = [];
  const diagnosticReports: DiagnosticReport[] = [];
  const activityDefinitions: ActivityDefinition[] = [];

  for (const resource of resources) {
    if (resource.resourceType === 'ServiceRequest') {
      serviceRequests.push(resource);
    } else if (resource.resourceType === 'Task' && resource.status !== 'cancelled') {
      tasks.push(resource);
    } else if (resource.resourceType === 'Encounter') {
      encounters.push(resource);
    } else if (resource.resourceType === 'Location') {
      locations.push(resource);
    } else if (resource.resourceType === 'Provenance') {
      provenances.push(resource);
    } else if (resource.resourceType === 'Specimen') {
      specimens.push(resource);
    } else if (resource.resourceType === 'Observation') {
      observations.push(resource);
    } else if (resource.resourceType === 'DiagnosticReport') {
      diagnosticReports.push(resource);
    } else if (resource.resourceType === 'ActivityDefinition') {
      activityDefinitions.push(resource);
    }
  }

  return {
    serviceRequests,
    tasks,
    encounters,
    locations,
    provenances,
    specimens,
    observations,
    diagnosticReports,
    activityDefinitions,
  };
};

export const fetchPractitionersForServiceRequests = async (
  oystehr: Oystehr,
  serviceRequests: ServiceRequest[],
  encounters: Encounter[]
): Promise<Practitioner[]> => {
  const practitionerIds = new Set<string>();

  serviceRequests.forEach((sr) => {
    const practitionerId = sr.requester?.reference?.replace('Practitioner/', '');
    if (practitionerId) practitionerIds.add(practitionerId);
  });

  encounters.forEach((encounter) => {
    const attendingPractitionerId = encounter.participant
      ?.find(
        (participant) =>
          participant.type?.find(
            (type) => type.coding?.some((c) => c.system === PRACTITIONER_CODINGS.Attender[0].system)
          )
      )
      ?.individual?.reference?.replace('Practitioner/', '');

    if (attendingPractitionerId) practitionerIds.add(attendingPractitionerId);
  });

  if (practitionerIds.size === 0) {
    return [];
  }

  const practitionerRequests = Array.from(practitionerIds).map((id) => ({
    method: 'GET' as const,
    url: `Practitioner/${id}`,
  }));

  try {
    const practitionerResponse = await oystehr.fhir.batch({
      requests: practitionerRequests,
    });

    return mapResourcesFromBundleEntry<Practitioner>(practitionerResponse.entry as BundleEntry<Practitioner>[]).filter(
      (resource): resource is Practitioner => resource?.resourceType === 'Practitioner'
    );
  } catch (error) {
    console.error('Failed to fetch Practitioners', JSON.stringify(error, null, 2));
    return [];
  }
};

export const fetchAppointmentsForServiceRequests = async (
  oystehr: Oystehr,
  serviceRequests: ServiceRequest[],
  encounters: Encounter[]
): Promise<Appointment[]> => {
  const appointmentIds = serviceRequests.map((sr) => parseAppointmentId(sr, encounters)).filter(Boolean);

  if (!appointmentIds.length) {
    return [];
  }

  const appointmentsResponse = await oystehr.fhir.search<Appointment>({
    resourceType: 'Appointment',
    params: [
      {
        name: '_id',
        value: appointmentIds.join(','),
      },
    ],
  });

  return appointmentsResponse.unbundle();
};

export const findActivityDefinitionForServiceRequest = (
  serviceRequest: ServiceRequest,
  activityDefinitions: ActivityDefinition[]
): ActivityDefinition | undefined => {
  const { url, version } = getUrlAndVersionForADFromServiceRequest(serviceRequest);

  return activityDefinitions.find((ad) => {
    const versionMatch = ad.version === version;
    const urlMatch = ad.url === url;
    return versionMatch && urlMatch;
  });
};

export const parseAppointmentId = (serviceRequest: ServiceRequest, encounters: Encounter[]): string => {
  const encounterId = parseEncounterId(serviceRequest);
  if (!encounterId) return '';

  const encounter = encounters.find((e) => e.id === encounterId);
  return encounter?.appointment?.[0]?.reference?.split('/').pop() || '';
};

export const parseEncounterId = (serviceRequest: ServiceRequest): string => {
  return serviceRequest.encounter?.reference?.split('/').pop() || '';
};

export const parseVisitDate = (appointment: Appointment | undefined): string => {
  return appointment?.start || '';
};

export const parseOrderAddedDate = (serviceRequest: ServiceRequest, tasks: Task[]): string => {
  // Use the first task's authoredOn date, or service request's authoredOn
  const relatedTasks = tasks.filter((task) => taskIsBasedOnServiceRequest(task, serviceRequest));

  const earliestTask = relatedTasks.sort(
    (a, b) => compareDates(b.authoredOn, a.authoredOn) // reverse to get earliest
  )[0];

  return earliestTask?.authoredOn || serviceRequest.authoredOn || '';
};

export const parseResultsReceivedDate = (serviceRequest: ServiceRequest, tasks: Task[]): string | null => {
  const relatedTasks = tasks.filter((task) => taskIsBasedOnServiceRequest(task, serviceRequest));

  const latestTask = relatedTasks.sort((a, b) => compareDates(a.authoredOn, b.authoredOn))[0];

  return latestTask?.authoredOn || null;
};

export const parseAttendingPractitioner = (
  encounter: Encounter | undefined,
  practitioners: Practitioner[]
): Practitioner | undefined => {
  if (!encounter) return undefined;

  const practitionerId = encounter.participant
    ?.find(
      (participant) =>
        participant.type?.find((type) => type.coding?.some((c) => c.system === PRACTITIONER_CODINGS.Attender[0].system))
    )
    ?.individual?.reference?.replace('Practitioner/', '');

  if (!practitionerId) return undefined;

  return practitioners.find((p) => p.id === practitionerId);
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
      isPrimary: false,
    };
  });
};

export const parseSpecimenSource = (specimen: Specimen): unknown => {
  return (
    specimen.collection?.bodySite?.coding?.find((c) => c.system === 'https://hl7.org/fhir/R4B/valueset-body-site')
      ?.display || 'Unknown'
  );
};

export const parseSpecimenCollectedBy = (_specimen: Specimen): unknown => {
  // todo: This would need to be implemented
  return 'Staff';
};

export const mapProvenanceStatusToTestStatus = (provenanceStatus: any): TestStatus => {
  // This mapping would depend on how provenance statuses map to TestStatus
  // This is a placeholder implementation
  switch (provenanceStatus) {
    case 'ordered':
      return 'ORDERED';
    case 'collected':
      return 'COLLECTED';
    case 'final':
      return 'FINAL';
    default:
      return 'ORDERED';
  }
};

// Utility functions
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

export const mapResourcesFromBundleEntry = <T = Resource>(bundleEntry: BundleEntry<T>[] | undefined): T[] => {
  return (bundleEntry || ([] as BundleEntry<T>[]))
    .filter((entry) => entry.response?.status?.startsWith('2'))
    .map((entry) => entry.resource)
    .filter(Boolean) as T[];
};
