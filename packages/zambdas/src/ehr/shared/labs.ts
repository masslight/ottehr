import Oystehr from '@oystehr/sdk';
import { ServiceRequest, QuestionnaireResponse, Practitioner, Task, Account, Coverage } from 'fhir/r4b';

export type LabOrderResources = {
  serviceRequest: ServiceRequest;
  questionnaireResponse: QuestionnaireResponse;
  practitioner: Practitioner;
  task: Task;
};

export async function getLabOrderResources(oystehr: Oystehr, serviceRequestID: string): Promise<LabOrderResources> {
  const serviceRequestTemp = (
    await oystehr.fhir.search<ServiceRequest | QuestionnaireResponse | Practitioner | Task>({
      resourceType: 'ServiceRequest',
      params: [
        {
          name: '_id',
          value: serviceRequestID,
        },
        {
          name: '_revinclude',
          value: 'Task:based-on',
        },
        {
          name: '_revinclude',
          value: 'QuestionnaireResponse:based-on',
        },
        {
          name: '_include',
          value: 'ServiceRequest:requester',
        },
      ],
    })
  )?.unbundle();
  const serviceRequestsTemp: ServiceRequest[] | undefined = serviceRequestTemp?.filter(
    (resourceTemp) => resourceTemp.resourceType === 'ServiceRequest'
  );
  const practitionersTemp: Practitioner[] | undefined = serviceRequestTemp?.filter(
    (resourceTemp) => resourceTemp.resourceType === 'Practitioner'
  );
  const questionnaireResponsesTemp: QuestionnaireResponse[] | undefined = serviceRequestTemp?.filter(
    (resourceTemp) => resourceTemp.resourceType === 'QuestionnaireResponse'
  );
  const tasksTemp: Task[] | undefined = serviceRequestTemp?.filter(
    (resourceTemp) => resourceTemp.resourceType === 'Task'
  );

  if (serviceRequestsTemp?.length !== 1) {
    throw new Error('service request is not found');
  }

  if (practitionersTemp?.length !== 1) {
    throw new Error('practitioner is not found');
  }

  if (questionnaireResponsesTemp?.length !== 1) {
    throw new Error('questionnaire response is not found');
  }

  if (tasksTemp?.length !== 1) {
    throw new Error('task is not found');
  }

  const serviceRequest = serviceRequestsTemp?.[0];
  const practitioner = practitionersTemp?.[0];
  const questionnaireResponse = questionnaireResponsesTemp?.[0];
  const task = tasksTemp?.[0];

  return {
    serviceRequest: serviceRequest,
    practitioner,
    questionnaireResponse: questionnaireResponse,
    task,
  };
}

export const getPrimaryInsurance = (account: Account, coverages: Coverage[]): Coverage | undefined => {
  if (coverages.length === 0) return;
  const coverageMap: { [key: string]: Coverage } = {};
  coverages.forEach((c) => (coverageMap[`Coverage/${c.id}`] = c));

  const includedCoverages = account.coverage?.filter((c) => {
    const coverageRef = c.coverage.reference;
    if (coverageRef) return Object.keys(coverageMap).includes(coverageRef);
    return;
  });

  if (includedCoverages?.length) {
    includedCoverages.sort((a, b) => {
      const priorityA = a.priority ?? -Infinity;
      const priorityB = b.priority ?? -Infinity;
      return priorityA - priorityB;
    });
    const highestPriorityCoverageRef = includedCoverages[0].coverage.reference;
    if (highestPriorityCoverageRef) return coverageMap[highestPriorityCoverageRef];
  } else {
    console.log('no coverages were included on account.coverage, grabbing primary ins from list of patient coverages');
    coverages.sort((a, b) => {
      const orderA = a.order ?? -Infinity;
      const orderB = b.order ?? -Infinity;
      return orderA - orderB;
    });
    return coverages[0];
  }
  return;
};
