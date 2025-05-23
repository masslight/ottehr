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
} from 'fhir/r4b';
import {
  DEFAULT_LABS_ITEMS_PER_PAGE,
  EMPTY_PAGINATION,
  isPositiveNumberOrZero,
  InHouseOrderDetailedPageDTO,
  InHouseOrderListPageDTO,
  InHouseOrdersSearchBy,
  Pagination,
  InHouseOrderDTO,
  DiagnosisDTO,
  convertActivityDefinitionToTestItem,
  getFullestAvailableName,
  PRACTITIONER_CODINGS,
  TestStatus,
  IN_HOUSE_TAG_DEFINITION,
  IN_HOUSE_TEST_CODE_SYSTEM,
} from 'utils';
import { GetZambdaInHouseOrdersParams } from './validateRequestParameters';
import { DateTime } from 'luxon';
import { determineOrderStatus, buildOrderHistory } from '../shared/inhouse-labs';

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
  locations: Location[],
  appointments: Appointment[],
  provenances: Provenance[],
  activityDefinitions: ActivityDefinition[],
  specimens: Specimen[],
  observations: Observation[]
): InHouseOrderDTO<SearchBy>[] => {
  return serviceRequests.map((serviceRequest) => {
    const parsedTasks = parseTasks(tasks, serviceRequest);
    const activityDefinition = findActivityDefinitionForServiceRequest(serviceRequest, activityDefinitions);

    const cache: Cache = {
      parsedTasks,
      activityDefinition,
    };

    return parseOrderData({
      searchBy,
      serviceRequest,
      tasks,
      practitioners,
      encounters,
      locations,
      appointments,
      provenances,
      activityDefinitions,
      specimens,
      observations,
      cache,
    });
  });
};

export const parseOrderData = <SearchBy extends InHouseOrdersSearchBy>({
  searchBy,
  serviceRequest,
  tasks,
  practitioners,
  encounters,
  locations: _locations,
  appointments,
  provenances,
  activityDefinitions,
  specimens,
  observations,
  cache,
}: {
  searchBy: SearchBy;
  serviceRequest: ServiceRequest;
  tasks: Task[];
  practitioners: Practitioner[];
  encounters: Encounter[];
  locations: Location[];
  appointments: Appointment[];
  provenances: Provenance[];
  activityDefinitions: ActivityDefinition[];
  specimens: Specimen[];
  observations: Observation[];
  cache?: Cache;
}): InHouseOrderDTO<SearchBy> => {
  if (!serviceRequest.id) {
    throw new Error('ServiceRequest ID is required');
  }

  const appointmentId = parseAppointmentId(serviceRequest, encounters);
  const appointment = appointments.find((a) => a.id === appointmentId);
  const encounter = encounters.find((e) => e.id === parseEncounterId(serviceRequest));

  const activityDefinition =
    cache?.activityDefinition || findActivityDefinitionForServiceRequest(serviceRequest, activityDefinitions);

  if (!activityDefinition) {
    throw new Error(`ActivityDefinition not found for ServiceRequest ${serviceRequest.id}`);
  }

  const testItem = convertActivityDefinitionToTestItem(activityDefinition, observations);
  const orderStatus = determineOrderStatus(serviceRequest, tasks);
  const attendingPractitioner = parseAttendingPractitioner(encounter, practitioners);
  const diagnosisDTO = parseDiagnoses(serviceRequest);

  const listPageDTO: InHouseOrderListPageDTO = {
    testItem: testItem.name,
    diagnosis: diagnosisDTO.map((d) => `${d.code} ${d.display}`).join(', '),
    orderDate: parseOrderAddedDate(serviceRequest, tasks),
    status: orderStatus,
    visitDate: parseVisitDate(appointment),
    providerName: attendingPractitioner ? getFullestAvailableName(attendingPractitioner) || '-' : '-',
    resultReceivedDate: parseResultsReceivedDate(serviceRequest, tasks),
    diagnosesDTO: [], // todo: implement
    encounterTimezone: undefined, // todo: implement
    lastResultReceivedDate: undefined, // todo: implement
    orderAddedDate: parseOrderAddedDate(serviceRequest, tasks),
    orderingPhysician: attendingPractitioner ? getFullestAvailableName(attendingPractitioner) || '-' : '-',
    serviceRequestId: serviceRequest.id,
  };

  if (searchBy.searchBy.field === 'serviceRequestId') {
    const orderHistory = buildOrderHistory(provenances);
    const relatedSpecimens = specimens.filter(
      (s) => s.request?.some((req) => req.reference === `ServiceRequest/${serviceRequest.id}`)
    );

    const detailedPageDTO: InHouseOrderDetailedPageDTO = {
      ...listPageDTO,
      sample: relatedSpecimens.map((specimen) => ({
        source: parseSpecimenSource(specimen),
        collectedBy: parseSpecimenCollectedBy(specimen),
        collectionDate: specimen.collection?.collectedDateTime || '',
      })),
      note: serviceRequest.note?.[0]?.text || '',
      history: orderHistory.map((h) => ({
        status: mapProvenanceStatusToTestStatus(h.status),
        providerName: h.providerName,
        date: h.date,
      })),
      showOnPatientPortal: false, // we don't have this yet
    };

    return detailedPageDTO as InHouseOrderDTO<SearchBy>;
  }

  return listPageDTO as InHouseOrderDTO<SearchBy>;
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
    .filter((task) => task.basedOn?.some((basedOn) => basedOn.reference === `ServiceRequest/${serviceRequest.id}`))
    .sort((a, b) => compareDates(a.authoredOn, b.authoredOn));

  return {
    allTasks: relatedTasks,
    latestTask: relatedTasks[0] || null,
  };
};

export const getInHouseResources = async (
  oystehr: Oystehr,
  params: GetZambdaInHouseOrdersParams,
  searchBy: InHouseOrdersSearchBy
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
}> => {
  const searchParams = createInHouseServiceRequestSearchParams(params);

  const inHouseOrdersResponse = await oystehr.fhir.search({
    resourceType: 'ServiceRequest',
    params: searchParams,
  });

  const resources = inHouseOrdersResponse.unbundle().filter((res): res is FhirResource => Boolean(res)) || [];

  const { serviceRequests, tasks, encounters, locations, provenances, specimens, observations } =
    extractInHouseResources(resources);

  const _isDetailPageRequest = searchBy.searchBy.field === 'serviceRequestId'; // todo: use for adding detail page data

  const [practitioners, appointments, activityDefinitions] = await Promise.all([
    fetchPractitionersForServiceRequests(oystehr, serviceRequests, encounters),
    fetchAppointmentsForServiceRequests(oystehr, serviceRequests, encounters),
    fetchActivityDefinitions(oystehr),
  ]);

  const pagination = parsePaginationFromResponse(inHouseOrdersResponse);

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
  };
};

export const createInHouseServiceRequestSearchParams = (params: GetZambdaInHouseOrdersParams): SearchParam[] => {
  const { searchBy, visitDate, itemsPerPage = DEFAULT_LABS_ITEMS_PER_PAGE, pageIndex = 0 } = params;

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
  ];

  // Search by specific criteria
  if (searchBy.field === 'encounterId') {
    searchParams.push({
      name: 'encounter',
      value: `Encounter/${searchBy.value}`,
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
} => {
  const serviceRequests: ServiceRequest[] = [];
  const tasks: Task[] = [];
  const encounters: Encounter[] = [];
  const locations: Location[] = [];
  const provenances: Provenance[] = [];
  const specimens: Specimen[] = [];
  const observations: Observation[] = [];

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

export const fetchActivityDefinitions = async (oystehr: Oystehr): Promise<ActivityDefinition[]> => {
  return oystehr.fhir
    .search<ActivityDefinition>({
      resourceType: 'ActivityDefinition',
      params: [
        { name: '_tag', value: IN_HOUSE_TAG_DEFINITION.code },
        { name: 'status', value: 'active' },
      ],
    })
    .then((response) => response.unbundle());
};

export const findActivityDefinitionForServiceRequest = (
  serviceRequest: ServiceRequest,
  activityDefinitions: ActivityDefinition[]
): ActivityDefinition | undefined => {
  const canonicalUrl = serviceRequest.instantiatesCanonical?.[0];
  if (!canonicalUrl) return undefined;

  return activityDefinitions.find((ad) => ad.url === canonicalUrl);
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
  const relatedTasks = tasks.filter(
    (task) => task.basedOn?.some((basedOn) => basedOn.reference === `ServiceRequest/${serviceRequest.id}`)
  );

  const earliestTask = relatedTasks.sort(
    (a, b) => compareDates(b.authoredOn, a.authoredOn) // reverse to get earliest
  )[0];

  return earliestTask?.authoredOn || serviceRequest.authoredOn || '';
};

export const parseResultsReceivedDate = (serviceRequest: ServiceRequest, tasks: Task[]): string | null => {
  const relatedTasks = tasks.filter(
    (task) => task.basedOn?.some((basedOn) => basedOn.reference === `ServiceRequest/${serviceRequest.id}`)
  );

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
export const compareDates = (a: string | undefined, b: string | undefined): number => {
  const dateA = DateTime.fromISO(a || '');
  const dateB = DateTime.fromISO(b || '');
  const isDateAValid = dateA.isValid;
  const isDateBValid = dateB.isValid;

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

export const mapResourcesFromBundleEntry = <T = Resource>(bundleEntry: BundleEntry<T>[] | undefined): T[] => {
  return (bundleEntry || ([] as BundleEntry<T>[]))
    .filter((entry) => entry.response?.status?.startsWith('2'))
    .map((entry) => entry.resource)
    .filter(Boolean) as T[];
};
