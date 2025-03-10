import Oystehr, { BatchInputRequest, SearchParam } from '@oystehr/sdk';
import {
  ActivityDefinition,
  Bundle,
  DiagnosticReport,
  FhirResource,
  Practitioner,
  ServiceRequest,
  Task,
} from 'fhir/r4b';
import { flattenBundleResources, OYSTEHR_LAB_OI_CODE_SYSTEM } from 'utils';
import { GetLabOrdersParams } from './validateRequestParameters';
import { DiagnosisDTO, LabOrderDTO, ExternalLabsStatus, LAB_ORDER_TASK, PSC_HOLD_CONFIG } from 'utils';

export const transformToLabOrderDTOs = (
  serviceRequests: ServiceRequest[],
  tasks: Task[],
  diagnosticReports: DiagnosticReport[],
  practitioners: Practitioner[]
): LabOrderDTO[] => {
  return serviceRequests.map((sr) => {
    // Extract practitioner ID from the reference
    const practitionerId = sr.requester?.reference?.split('/').pop();

    // Get lab information from the contained ActivityDefinition
    const { type, location } = extractLabInfoFromActivityDefinition(sr);

    // Determine the current status based on tasks and reports
    const status = determineLabStatus(sr, tasks, diagnosticReports);

    // Check if this is a PSC (Patient Service Center) hold
    const isPSC = checkIsPSC(sr);

    // Count the number of reflex tests
    const reflexTestsCount = countReflexTests(sr.id || '', diagnosticReports);

    // Get diagnoses
    const diagnoses = extractDiagnosesFromServiceRequest(sr);

    return {
      id: sr.id || '',
      type,
      location,
      orderAdded: sr.authoredOn || 'Unknown', // todo: by the design authoredOn should be here, but during testing it's not
      provider: getPractitionerName(practitionerId, practitioners),
      diagnoses,
      status,
      isPSC,
      reflexTestsCount,
    };
  });
};

export const getLabResources = async (
  oystehr: Oystehr,
  params: GetLabOrdersParams
): Promise<{
  serviceRequests: ServiceRequest[];
  tasks: Task[];
  diagnosticReports: DiagnosticReport[];
  practitioners: Practitioner[];
}> => {
  const { encounterId } = params;
  const labOrdersSearchParams = createLabOrdersSearchParams(encounterId);

  const labOrdersResponse = await oystehr.fhir.search<ServiceRequest | Task>({
    resourceType: 'ServiceRequest',
    params: labOrdersSearchParams,
  });

  const labResources =
    labOrdersResponse.entry
      ?.map((entry) => entry.resource)
      .filter((res): res is ServiceRequest | Task => Boolean(res)) || [];

  const diagnosticRequests = createDiagnosticReportBatchInput(labResources, encounterId);
  const { serviceRequests, tasks } = extractLabResources(labResources);

  const [reflexTestResources, practitioners] = await Promise.all([
    diagnosticRequests.length > 0 ? fetchReflexTestResources(oystehr, diagnosticRequests) : Promise.resolve([]),
    serviceRequests.length > 0 ? fetchPractitionersForServiceRequests(oystehr, serviceRequests) : Promise.resolve([]),
  ]);

  const { diagnosticReports } = extractLabResources(reflexTestResources);

  return {
    serviceRequests,
    tasks,
    diagnosticReports,
    practitioners,
  };
};

export const createLabOrdersSearchParams = (encounterId: string): SearchParam[] => [
  {
    name: 'encounter',
    value: `Encounter/${encounterId}`,
  },
  {
    name: 'code',
    // search any code value for given system
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
    name: '_revinclude',
    value: 'Task:based-on',
  },
  {
    name: '_revinclude',
    value: 'DiagnosticReport:based-on',
  },
];

export const createDiagnosticReportBatchInput = (
  mainResources: FhirResource[],
  encounterId: string
): BatchInputRequest<DiagnosticReport>[] => {
  return mainResources
    .filter((resource): resource is ServiceRequest => resource.resourceType === 'ServiceRequest')
    .flatMap((sr) => {
      // todo: check that the ServiceRequest get an identifier when it's submitted to Oystehr
      if (!sr.identifier || !sr.identifier.length) return [];
      return sr.identifier.map((id) => ({
        system: id.system,
        value: id.value,
      }));
    })
    .filter((id) => id.system && id.value)
    .map(
      (id) =>
        ({
          method: 'GET',
          url: `DiagnosticReport?identifier=${id.system}|${id.value}&encounter=${encounterId}`,
        }) as const
    );
};

export const fetchReflexTestResources = async (
  oystehr: Oystehr,
  diagnosticRequests: BatchInputRequest<FhirResource>[]
): Promise<DiagnosticReport[]> => {
  if (diagnosticRequests.length > 0) {
    try {
      const reflexResponse = await oystehr.fhir.batch({
        requests: diagnosticRequests,
      });
      if (reflexResponse.entry) {
        const reflexTestResources = reflexResponse.entry
          .filter((entry) => entry.resource && entry.resource.resourceType === 'Bundle')
          .flatMap((entry) => flattenBundleResources<DiagnosticReport>(entry.resource as Bundle<FhirResource>))
          .filter((resource): resource is DiagnosticReport => resource.resourceType === 'DiagnosticReport');

        return reflexTestResources;
      }
    } catch (error) {
      console.error('Error fetching reflex tests');
      throw error;
    }
  }
  return [];
};

export const extractLabResources = (
  resources: (ServiceRequest | Task | DiagnosticReport)[]
): {
  serviceRequests: ServiceRequest[];
  tasks: Task[];
  diagnosticReports: DiagnosticReport[];
} => {
  const serviceRequests: ServiceRequest[] = [];
  const tasks: Task[] = [];
  const diagnosticReports: DiagnosticReport[] = [];

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
    }
  }

  return { serviceRequests, tasks, diagnosticReports };
};

export const fetchPractitionersForServiceRequests = async (
  oystehr: Oystehr,
  serviceRequests: ServiceRequest[]
): Promise<Practitioner[]> => {
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

    return (practitionerResponse.entry || [])
      .filter((entry) => entry.response?.status?.startsWith('2')) // todo: should we filter out failed responses like this?
      .map((entry) => entry.resource)
      .filter((resource): resource is Practitioner => resource?.resourceType === 'Practitioner');
  } catch (error) {
    console.error(`Failed to fetch Practitioners`, JSON.stringify(error, null, 2));
    return [];
  }
};

export const determineLabStatus = (
  serviceRequest: ServiceRequest,
  tasks: Task[],
  diagnosticReports: DiagnosticReport[]
): ExternalLabsStatus => {
  // Find tasks related to this service request
  const relatedTasks = tasks.filter(
    (task) => task.basedOn?.some((basedOn) => basedOn.reference === `ServiceRequest/${serviceRequest.id}`)
  );

  // Find diagnostic reports related to this service request
  const relatedReports = diagnosticReports.filter(
    (report) => report.basedOn?.some((basedOn) => basedOn.reference === `ServiceRequest/${serviceRequest.id}`)
  );

  // Check if there are any review tasks that are completed
  const hasCompletedReviewTask = relatedTasks.some(
    (task) =>
      task.status === 'completed' &&
      task.code?.coding?.some(
        (coding) =>
          coding.system === LAB_ORDER_TASK.system &&
          (coding.code === LAB_ORDER_TASK.code.reviewPreliminaryResult ||
            coding.code === LAB_ORDER_TASK.code.reviewFinalResult)
      )
  );

  if (hasCompletedReviewTask) {
    return ExternalLabsStatus.reviewed;
  }

  // Check if there are any diagnostic reports (indicating results received)
  if (relatedReports.length > 0) {
    return ExternalLabsStatus.received;
  }

  // Check if the pre-submission task is completed (indicating the order was sent)
  const hasCompletedPreSubmissionTask = relatedTasks.some(
    (task) =>
      task.status === 'completed' &&
      task.code?.coding?.some(
        (coding) => coding.system === LAB_ORDER_TASK.system && coding.code === LAB_ORDER_TASK.code.presubmission
      )
  );

  if (hasCompletedPreSubmissionTask) {
    return ExternalLabsStatus.sent;
  }

  // Otherwise, it's still pending
  return ExternalLabsStatus.pending;
};

export const extractDiagnosesFromServiceRequest = (serviceRequest: ServiceRequest): DiagnosisDTO[] => {
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

export const getPractitionerName = (practitionerId: string | undefined, practitioners: Practitioner[]): string => {
  if (!practitionerId) return 'Unknown';

  const practitioner = practitioners.find((p) => p.id === practitionerId);
  if (!practitioner) return 'Unknown';

  const name = practitioner.name?.[0];
  if (!name) return 'Unknown';

  return [name.prefix, name.given, name.family].flat().filter(Boolean).join(' ') || 'Unknown';
};

export const extractLabInfoFromActivityDefinition = (
  serviceRequest: ServiceRequest
): { type: string; location: string } => {
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

export const countReflexTests = (serviceRequestId: string, diagnosticReports: DiagnosticReport[]): number => {
  const relatedReports = diagnosticReports.filter(
    (report) => report.basedOn?.some((basedOn) => basedOn.reference === `ServiceRequest/${serviceRequestId}`)
  );

  // Count reports with different codes (different tests from the same order)
  const uniqueCodes = new Set();

  relatedReports.forEach((report) => {
    const codeString = JSON.stringify(report.code);
    uniqueCodes.add(codeString);
  });

  return Math.max(0, uniqueCodes.size - 1); // Subtract 1 for the primary test, todo: check if this is correct
};
