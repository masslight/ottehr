import Oystehr from '@oystehr/sdk';
import { ServiceRequest, QuestionnaireResponse, Practitioner, Task, Patient } from 'fhir/r4b';

export type LabOrderResources = {
  serviceRequest: ServiceRequest;
  patient: Patient;
  questionnaireResponse: QuestionnaireResponse;
  practitioner: Practitioner;
  task: Task;
};

export async function getLabOrderResources(oystehr: Oystehr, serviceRequestID: string): Promise<LabOrderResources> {
  const serviceRequestTemp = (
    await oystehr.fhir.search<ServiceRequest | QuestionnaireResponse | Patient | Practitioner | Task>({
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
          name: '_include',
          value: 'ServiceRequest:subject',
        },
        {
          name: '_revinclude',
          value: 'QuestionnaireResponse:based-on',
        },
        {
          name: '_include',
          value: 'ServiceRequest:requester',
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
  const patientsTemp: Patient[] | undefined = serviceRequestTemp?.filter(
    (resourceTemp) => resourceTemp.resourceType === 'Patient'
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

  if (patientsTemp?.length !== 1) {
    throw new Error('patient is not found');
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
  const patient = patientsTemp?.[0];
  const practitioner = practitionersTemp?.[0];
  const questionnaireResponse = questionnaireResponsesTemp?.[0];
  const task = tasksTemp?.[0];

  return {
    serviceRequest: serviceRequest,
    patient,
    practitioner,
    questionnaireResponse: questionnaireResponse,
    task,
  };
}
