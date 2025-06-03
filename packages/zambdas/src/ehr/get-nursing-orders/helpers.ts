import Oystehr, { SearchParam } from '@oystehr/sdk';
import { Practitioner, ServiceRequest, Task, Provenance } from 'fhir/r4b';
import {
  NursingOrder,
  NursingOrderDetailedDTO,
  NursingOrderHistoryRow,
  NursingOrdersSearchBy,
  NursingOrdersStatus,
  PRIVATE_EXTENSION_BASE_URL,
  PROVENANCE_ACTIVITY_CODING_ENTITY,
} from 'utils';
import { GetZambdaNursingOrdersParams } from './validateRequestParameters';
import { DateTime } from 'luxon';

export const mapResourcesNursingOrderDTOs = (
  serviceRequests: ServiceRequest[],
  tasks: Task[],
  practitioners: Practitioner[],
  provenances: Provenance[],
  searchBy?: NursingOrdersSearchBy
): NursingOrder[] => {
  const filteredServiceRequests =
    searchBy?.field === 'serviceRequestId'
      ? serviceRequests.filter((serviceRequest) => serviceRequest.id === searchBy.value)
      : serviceRequests;

  return filteredServiceRequests.map((serviceRequest) => {
    return parseOrderData({
      searchBy,
      serviceRequest,
      tasks,
      practitioners,
      provenances,
    });
  });
};

const parseOrderData = ({
  searchBy,
  serviceRequest,
  tasks,
  provenances,
  practitioners,
}: {
  searchBy?: NursingOrdersSearchBy;
  serviceRequest: ServiceRequest;
  tasks: Task[];
  provenances: Provenance[];
  practitioners: Practitioner[];
}): NursingOrder => {
  if (!serviceRequest.id) {
    throw new Error('ServiceRequest ID is required');
  }

  const relatedTask = tasks.find((t) => t.basedOn?.[0]?.reference === `ServiceRequest/${serviceRequest.id}`);
  const status = getStatusFromTask(relatedTask);
  const note = serviceRequest?.note?.[0]?.text;
  const createOrderProvenance = provenances.find(
    (provenance) =>
      provenance.activity?.coding?.some(
        (coding) =>
          coding.code === PROVENANCE_ACTIVITY_CODING_ENTITY.createOrder.code &&
          coding.display === PROVENANCE_ACTIVITY_CODING_ENTITY.createOrder.display &&
          coding.system === PROVENANCE_ACTIVITY_CODING_ENTITY.createOrder.system
      )
  );

  if (!createOrderProvenance) {
    throw new Error('Provenance with create order activity not found');
  }

  const orderingPhysician = parsePractitionerNameFromProvenance(createOrderProvenance, practitioners);

  const listDTO: NursingOrder = {
    serviceRequestId: serviceRequest.id,
    note: note ?? '',
    status,
    orderAddedDate: serviceRequest.authoredOn ?? '',
    orderingPhysician,
  };

  if (searchBy?.field === 'serviceRequestId') {
    const detailedDTO: NursingOrderDetailedDTO = {
      ...listDTO,
      history: parseNursingOrdersHistory(searchBy.value, practitioners, provenances),
    };

    return detailedDTO;
  }

  return listDTO;
};

export const getNoursingOrderResources = async (
  oystehr: Oystehr,
  params: GetZambdaNursingOrdersParams
): Promise<{
  serviceRequests: ServiceRequest[];
  tasks: Task[];
  practitioners: Practitioner[];
  provenances: Provenance[];
}> => {
  const nursingServiceRequestSearchParams = createNursingServiceRequestSearchParams(params);

  const nursingOrdersResponse = await oystehr.fhir.search({
    resourceType: 'ServiceRequest',
    params: nursingServiceRequestSearchParams,
  });

  const nursingOrdersResources =
    nursingOrdersResponse.entry
      ?.map((entry) => entry.resource)
      .filter((res): res is ServiceRequest | Task | Provenance | Practitioner => Boolean(res)) || [];

  const { serviceRequests, tasks, provenances, practitioners } = extractNursingOrdersResources(nursingOrdersResources);

  return {
    serviceRequests,
    tasks,
    practitioners,
    provenances,
  };
};

const createNursingServiceRequestSearchParams = (params: GetZambdaNursingOrdersParams): SearchParam[] => {
  const searchParams: SearchParam[] = [
    {
      name: 'encounter',
      value: `Encounter/${params.encounterId}`,
    },
    {
      name: '_include',
      value: 'ServiceRequest:requester',
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
      value: 'Provenance:agent',
    },
  ];

  return searchParams;
};

const extractNursingOrdersResources = (
  resources: (ServiceRequest | Task | Provenance | Practitioner)[]
): {
  serviceRequests: ServiceRequest[];
  tasks: Task[];
  provenances: Provenance[];
  practitioners: Practitioner[];
} => {
  console.log('extracting nursing orders resources');
  console.log(`${resources.length} resources total`);

  const serviceRequests: ServiceRequest[] = [];
  const tasks: Task[] = [];
  const provenances: Provenance[] = [];
  const practitioners: Practitioner[] = [];
  for (const resource of resources) {
    if (resource.resourceType === 'ServiceRequest') {
      const serviceRequest = resource as ServiceRequest;
      const withNursingOrderTag = serviceRequest.meta?.tag?.some(
        (tag) => tag.system === `${PRIVATE_EXTENSION_BASE_URL}/order-type-tag` && tag.code === 'nursing order'
      );
      if (withNursingOrderTag) {
        serviceRequests.push(serviceRequest);
      }
    } else if (resource.resourceType === 'Task') {
      tasks.push(resource);
    } else if (resource.resourceType === 'Provenance') {
      provenances.push(resource);
    } else if (resource.resourceType === 'Practitioner') {
      practitioners.push(resource);
    }
  }

  return {
    serviceRequests,
    tasks,
    provenances,
    practitioners,
  };
};

const parsePractitionerNameFromProvenance = (provenance: Provenance, practitioners: Practitioner[]): string => {
  const practitionerIdFromServiceRequest = parsePractitionerIdFromProvenance(provenance);
  return parsePractitionerName(practitionerIdFromServiceRequest, practitioners);
};

const parsePractitionerName = (practitionerId: string | undefined, practitioners: Practitioner[]): string => {
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

const parsePractitionerIdFromProvenance = (provenance: Provenance): string => {
  const NOT_FOUND = '';
  return provenance.agent?.[0].who.reference?.split('/').pop() || NOT_FOUND;
};

const getStatusFromTask = (task?: Task): NursingOrdersStatus => {
  if (!task) return NursingOrdersStatus.unknown;
  if (task.status === 'requested') return NursingOrdersStatus.pending;
  if (task.status === 'completed') return NursingOrdersStatus.completed;
  if (task.status === 'cancelled') return NursingOrdersStatus.cancelled;
  return NursingOrdersStatus.unknown;
};

const parseNursingOrdersHistory = (
  serviceRequestId: string,
  practitioners: Practitioner[],
  provenances: Provenance[]
): NursingOrderHistoryRow[] => {
  const orderProvenances = provenances.filter((provenance) =>
    provenance.target.some((item) => item.reference === `ServiceRequest/${serviceRequestId}`)
  );

  console.log('provenances', JSON.stringify(orderProvenances, null, 2));

  const historyRows: NursingOrderHistoryRow[] = orderProvenances.map((provenance) => ({
    status: mapProvenanceActivityToOrderStatus(provenance.activity?.coding?.[0].code || ''),
    performer: parsePractitionerNameFromProvenance(provenance, practitioners),
    date: provenance.recorded || '',
  }));

  return historyRows.sort((a, b) => compareDates(b.date, a.date));
};

const mapProvenanceActivityToOrderStatus = (activity: string): NursingOrdersStatus => {
  switch (activity) {
    case 'CREATE ORDER':
      return NursingOrdersStatus.pending;
    case 'COMPLETE ORDER':
      return NursingOrdersStatus.completed;
    case 'CANCEL ORDER':
      return NursingOrdersStatus.cancelled;
    default:
      return NursingOrdersStatus.unknown;
  }
};

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
