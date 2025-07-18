import Oystehr from '@oystehr/sdk';
import {
  ActivityDefinition,
  Coding,
  DiagnosticReport,
  FhirResource,
  Observation,
  Provenance,
  ServiceRequest,
  Specimen,
  Task,
} from 'fhir/r4b';
import {
  IN_HOUSE_LAB_TASK,
  IN_HOUSE_TAG_DEFINITION,
  InHouseOrderDetailPageItemDTO,
  PROVENANCE_ACTIVITY_CODING_ENTITY,
  SPECIMEN_COLLECTION_CUSTOM_SOURCE_SYSTEM,
  SPECIMEN_COLLECTION_SOURCE_SYSTEM,
  TestStatus,
} from 'utils';

export function determineOrderStatus(serviceRequest: ServiceRequest, tasks: Task[]): TestStatus {
  if (!serviceRequest) return 'ORDERED';

  const collectSampleTask = tasks.find(
    (task) =>
      taskIsBasedOnServiceRequest(task, serviceRequest) &&
      task.code?.coding?.some(
        (coding: Coding) =>
          coding.system === IN_HOUSE_LAB_TASK.system && coding.code === IN_HOUSE_LAB_TASK.code.collectSampleTask
      )
  );
  console.log('collectSampleTask', collectSampleTask?.id, collectSampleTask?.status);

  const interpretResultsTask = tasks.find(
    (task) =>
      taskIsBasedOnServiceRequest(task, serviceRequest) &&
      task.code?.coding?.some(
        (coding: Coding) =>
          coding.system === IN_HOUSE_LAB_TASK.system && coding.code === IN_HOUSE_LAB_TASK.code.inputResultsTask // todo: is it valid?
      )
  );
  console.log('interpretResultsTask', interpretResultsTask?.id, interpretResultsTask?.status);

  // Status Derivation:
  // Ordered: SR.status = draft & Task(CST).status = ready
  if (serviceRequest.status === 'draft' && collectSampleTask?.status === 'ready') {
    return 'ORDERED';
  }

  // Collected: SR.status = active & Task(CST).status = completed & Task(IRT).status = ready
  if (
    serviceRequest.status === 'active' &&
    collectSampleTask?.status === 'completed' &&
    interpretResultsTask?.status === 'ready'
  ) {
    return 'COLLECTED';
  }

  // Final: SR.status = completed && DR.status = 'final'
  if (
    serviceRequest.status === 'completed'
    // todo commenting this out for now as its not needed but that may change when we allow edits
    // (documentReference?.status === 'final' || documentReference?.status === 'amended')
  ) {
    return 'FINAL';
  }

  return 'UNKNOWN' as 'ORDERED'; // todo: maybe add separate type for unknown status?
}

export function buildOrderHistory(
  provenances: Provenance[],
  serviceRequest: ServiceRequest,
  specimen?: Specimen
): {
  status: TestStatus;
  providerName: string;
  date: string;
}[] {
  const history: {
    status: TestStatus;
    providerName: string;
    date: string;
  }[] = [];
  console.log('building order history for sr', serviceRequest.id);
  // Add entries from provenances
  provenances.forEach((provenance) => {
    const relatedToSR = provenanceIsTargetOfServiceRequest(provenance, serviceRequest);
    if (relatedToSR) {
      const activityCode = provenance.activity?.coding?.[0]?.code;

      // Map activity codes to statuses
      let status: TestStatus | undefined;

      if (activityCode === PROVENANCE_ACTIVITY_CODING_ENTITY.createOrder.code) {
        status = 'ORDERED';
      } else if (activityCode === PROVENANCE_ACTIVITY_CODING_ENTITY.inputResults.code) {
        status = 'FINAL';
      }

      if (status && provenance.recorded) {
        const agentName = provenance.agent?.[0]?.who?.display || '';

        history.push({
          status,
          providerName: agentName,
          date: provenance.recorded,
        });
      }
    }
  });

  if (specimen) {
    const collectedByDisplay = specimen.collection?.collector?.display || '';
    const collectedByDate = specimen.collection?.collectedDateTime;

    if (collectedByDate) {
      history.push({
        status: 'COLLECTED',
        providerName: collectedByDisplay,
        date: collectedByDate,
      });
    }
  }

  history.sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  return history;
}

export const getSpecimenDetails = (specimen: Specimen): InHouseOrderDetailPageItemDTO['specimen'] => {
  const specimenCollection = specimen.collection;
  if (specimenCollection) {
    const standardizedSource = specimenCollection.bodySite?.coding?.find(
      (c) => c.system === SPECIMEN_COLLECTION_SOURCE_SYSTEM
    )?.display;
    const customSource = specimenCollection.bodySite?.coding?.find(
      (c) => c.system === SPECIMEN_COLLECTION_CUSTOM_SOURCE_SYSTEM
    )?.display;
    const sources = [];
    if (standardizedSource) sources.push(standardizedSource);
    if (customSource) sources.push(customSource);

    // todo not sure if we want to split like this, think it might cause issues with timezones
    const collectedDateTimeIso = specimen.collection?.collectedDateTime;
    const collectedDate = collectedDateTimeIso?.split('T')[0];
    const collectedTime = collectedDateTimeIso?.split('T')[1].split('.')[0];

    const specimenDetails = {
      source: sources.join(', '),
      collectedBy: specimen.collection?.collector?.display || '',
      collectionDate: collectedDate || '',
      collectionTime: collectedTime || '',
    };
    return specimenDetails;
  }
  throw new Error(`missing specimen details for specimen ${specimen.id}`);
};

export const taskIsBasedOnServiceRequest = (task: Task, serviceRequest: ServiceRequest): boolean => {
  return !!task.basedOn?.some((basedOn) => basedOn.reference === `ServiceRequest/${serviceRequest.id}`);
};

export const provenanceIsTargetOfServiceRequest = (provenance: Provenance, serviceRequest: ServiceRequest): boolean => {
  return !!provenance.target?.some((target) => target.reference === `ServiceRequest/${serviceRequest.id}`);
};

export const getServiceRequestsRelatedViaRepeat = (
  serviceRequests: ServiceRequest[],
  serviceRequestSearchId: string
): ServiceRequest[] => {
  let serviceRequestSearched: ServiceRequest | undefined;
  const additionalServiceRequests = serviceRequests.reduce((acc: ServiceRequest[], sr) => {
    if (sr.id) {
      if (sr.id !== serviceRequestSearchId) {
        acc.push(sr);
      } else {
        serviceRequestSearched = sr;
      }
    }
    return acc;
  }, []);

  const serviceRequestsRelatedViaRepeat: ServiceRequest[] = [];
  if (additionalServiceRequests.length > 0 && serviceRequestSearched) {
    // was the service request passed as the search param the initial test or ran as repeat?
    const initialServiceRequestId = serviceRequestSearched?.basedOn
      ? serviceRequestSearched.basedOn[0].reference?.replace('ServiceRequest/', '')
      : serviceRequestSearched?.id;
    console.log('initialServiceRequestId,', initialServiceRequestId);
    additionalServiceRequests.forEach((sr) => {
      // confirm its indeed related to the repeat testing group
      // tbh this check might be overkill
      const basedOn = sr.basedOn?.[0].reference?.replace('ServiceRequest/', '');
      if (sr.id === initialServiceRequestId || (basedOn && basedOn === initialServiceRequestId)) {
        serviceRequestsRelatedViaRepeat.push(sr);
      }
    });
  }
  return serviceRequestsRelatedViaRepeat;
};

interface RepeatSrResourceConfig {
  [srId: string]: {
    diagnosticReports: DiagnosticReport[];
    observations: Observation[];
    provenances: Provenance[];
    tasks: Task[];
    specimens: Specimen[];
  };
}
export const fetchResultResourcesForRepeatServiceRequest = async (
  oystehr: Oystehr,
  serviceRequests: ServiceRequest[]
): Promise<{
  repeatDiagnosticReports: DiagnosticReport[];
  repeatObservations: Observation[];
  repeatProvenances: Provenance[];
  repeatTasks: Task[];
  repeatSpecimens: Specimen[];
  srResourceMap: RepeatSrResourceConfig;
}> => {
  console.log('making requests for additional service requests representing related repeat tests');
  let srResourceMap: RepeatSrResourceConfig = makeSrResourceMap(serviceRequests);
  const resources = (
    await oystehr.fhir.search<ServiceRequest | DiagnosticReport | Observation | Provenance | Task | Specimen>({
      resourceType: 'ServiceRequest',
      params: [
        {
          name: '_id',
          value: serviceRequests.map((sr) => sr.id).join(','),
        },
        {
          name: '_revinclude',
          value: 'DiagnosticReport:based-on',
        },
        {
          name: '_revinclude',
          value: 'Observation:based-on',
        },
        {
          name: '_revinclude',
          value: 'Provenance:target',
        },
        {
          name: '_revinclude',
          value: 'Task:based-on',
        },
        {
          name: '_include',
          value: 'ServiceRequest:specimen',
        },
      ],
    })
  ).unbundle();
  const repeatDiagnosticReports: DiagnosticReport[] = [];
  const repeatObservations: Observation[] = [];
  const repeatProvenances: Provenance[] = [];
  const repeatTasks: Task[] = [];
  const repeatSpecimens: Specimen[] = [];
  resources.forEach((r) => {
    if (r.resourceType === 'DiagnosticReport') {
      repeatDiagnosticReports.push(r);
      srResourceMap = addToSrResourceMap(r, 'diagnosticReports', srResourceMap);
    }
    if (r.resourceType === 'Observation') {
      repeatObservations.push(r);
      srResourceMap = addToSrResourceMap(r, 'observations', srResourceMap);
    }
    if (r.resourceType === 'Provenance') {
      repeatProvenances.push(r);
      srResourceMap = addToSrResourceMap(r, 'provenances', srResourceMap);
    }
    if (r.resourceType === 'Task') {
      repeatTasks.push(r);
      srResourceMap = addToSrResourceMap(r, 'tasks', srResourceMap);
    }
    if (r.resourceType === 'Specimen') {
      repeatSpecimens.push(r);
      srResourceMap = addToSrResourceMap(r, 'specimens', srResourceMap);
    }
  });
  console.log('srResourceMap', JSON.stringify(srResourceMap));
  return {
    repeatDiagnosticReports,
    repeatObservations,
    repeatProvenances,
    repeatTasks,
    repeatSpecimens,
    srResourceMap,
  };
};

const makeSrResourceMap = (serviceRequests: ServiceRequest[]): RepeatSrResourceConfig => {
  const config = serviceRequests.reduce((acc: RepeatSrResourceConfig, sr) => {
    if (sr.id) {
      acc[sr.id] = {
        diagnosticReports: [],
        observations: [],
        provenances: [],
        tasks: [],
        specimens: [],
      };
    }
    return acc;
  }, {});
  return config;
};

const getSrIdFromResource = (resource: FhirResource): string | undefined => {
  switch (resource.resourceType) {
    case 'DiagnosticReport':
    case 'Observation':
    case 'Task':
      return resource.basedOn
        ?.find((based) => based.reference?.startsWith('ServiceRequest/'))
        ?.reference?.replace('ServiceRequest/', '');
    case 'Provenance':
      return resource.target
        ?.find((tar) => tar.reference?.startsWith('ServiceRequest/'))
        ?.reference?.replace('ServiceRequest/', '');
    case 'Specimen':
      return resource.request
        ?.find((tar) => tar.reference?.startsWith('ServiceRequest/'))
        ?.reference?.replace('ServiceRequest/', '');
    default:
      return undefined;
  }
};

const addToSrResourceMap = (
  resource: FhirResource,
  addTo: keyof RepeatSrResourceConfig[string],
  srResourceMap: RepeatSrResourceConfig
): RepeatSrResourceConfig => {
  const srId = getSrIdFromResource(resource);
  if (!srId || !srResourceMap[srId]) return srResourceMap;

  return {
    ...srResourceMap,
    [srId]: {
      ...srResourceMap[srId],
      [addTo]: [...(srResourceMap[srId][addTo] as any[]), resource],
    },
  };
};

export const fetchActiveInHouseLabActivityDefinitions = async (oystehr: Oystehr): Promise<ActivityDefinition[]> => {
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

export const getUrlAndVersionForADFromServiceRequest = (
  serviceRequest: ServiceRequest
): { url: string; version: string } => {
  const adUrl = serviceRequest.instantiatesCanonical?.[0].split('|')[0];
  const version = serviceRequest.instantiatesCanonical?.[0].split('|')[1];
  if (!adUrl || !version)
    throw new Error(
      `error parsing instantiatesCanonical url for SR ${serviceRequest.id}, either the url or the version could not be parsed: ${adUrl} ${version}`
    );
  console.log('AD url and version parsed:', adUrl, version);
  return { url: adUrl, version };
};
