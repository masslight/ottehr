import { DiagnosticReport, Encounter, Location, Patient, Practitioner, ServiceRequest, Task } from 'fhir/r4b';
import { CODE_SYSTEM_CPT, getFullestAvailableName, RADIOLOGY_TASK } from 'utils';
import { createTask } from '../../../shared/tasks';

export interface ResourcesForTask {
  diagnosticReport: DiagnosticReport;
  serviceRequest: ServiceRequest;
  patient: Patient;
  encounter: Encounter;
  requestingProvider: Practitioner;
  location: Location | undefined;
}

interface AllResources {
  diagnosticReports: DiagnosticReport[];
  serviceRequests: ServiceRequest[];
  patients: Patient[];
  encounters: Encounter[];
  practitioners: Practitioner[];
  locations: Location[];
}

export const parseRadiologyResourcesForTask = (
  resources: (DiagnosticReport | ServiceRequest | Patient | Encounter | Practitioner | Location)[]
): AllResources => {
  return resources.reduce(
    (acc: AllResources, resource) => {
      if (resource.resourceType === 'DiagnosticReport') acc.diagnosticReports.push(resource);
      if (resource.resourceType === 'ServiceRequest') acc.serviceRequests.push(resource);
      if (resource.resourceType === 'Patient') acc.patients.push(resource);
      if (resource.resourceType === 'Encounter') acc.encounters.push(resource);
      if (resource.resourceType === 'Practitioner') acc.practitioners.push(resource);
      if (resource.resourceType === 'Location') acc.locations.push(resource);
      return acc;
    },
    { diagnosticReports: [], serviceRequests: [], patients: [], encounters: [], practitioners: [], locations: [] }
  );
};

export const validateResourcesAgainstDR = (
  input: Omit<AllResources, 'diagnosticReports'> & {
    diagnosticReport: DiagnosticReport;
  }
): ResourcesForTask => {
  const { diagnosticReport, serviceRequests, patients, encounters, practitioners, locations } = input;

  if (serviceRequests.length !== 1) {
    throw new Error(
      `Unexpected number of serviceRequests found for diagnostic report: ${diagnosticReport.id}. SR Len: ${serviceRequests.length}`
    );
  }
  if (patients.length !== 1) {
    throw new Error(
      `Unexpected number of patients found for diagnostic report: ${diagnosticReport.id}. Patients Len: ${patients.length}`
    );
  }
  if (encounters.length !== 1) {
    throw new Error(
      `Unexpected number of encounters found for diagnostic report: ${diagnosticReport.id}. Encounters Len: ${encounters.length}`
    );
  }
  if (practitioners.length !== 1) {
    throw new Error(
      `Unexpected number of practitioners found for diagnostic report: ${diagnosticReport.id}. Practitioners Len: ${practitioners.length}`
    );
  }

  const encounter = encounters[0];
  const locationId = encounter?.location
    ?.find((loc) => loc.location.reference?.startsWith('Location/'))
    ?.location.reference?.replace('Location/', '');
  const locationFromEncounter = locations.find((loc) => loc.id === locationId);

  return {
    diagnosticReport,
    patient: patients[0],
    serviceRequest: serviceRequests[0],
    encounter,
    requestingProvider: practitioners[0],
    location: locationFromEncounter,
  };
};

export const configReviewResultTask = (resources: ResourcesForTask): Task => {
  const { diagnosticReport, encounter, serviceRequest, patient, requestingProvider, location } = resources;
  console.log('configuring review radiology final results task for', diagnosticReport.id);

  const serviceRequestRef = diagnosticReport.basedOn?.find((ref) => ref.reference?.startsWith('ServiceRequest/'))
    ?.reference;
  const appointmentId = encounter.appointment?.[0].reference?.replace('Appointment/', '');

  let locationInput:
    | {
        id: string;
        name?: string;
      }
    | undefined = undefined;
  if (location?.id) {
    locationInput = { id: location.id };
    if (location.name) locationInput.name = location.name;
  }

  const providerName = getFullestAvailableName(requestingProvider) ?? 'Provider Name Missing';

  const studyTypeCoding = serviceRequest.code?.coding?.find((c) => c.system === CODE_SYSTEM_CPT);
  const studyTypeCode = studyTypeCoding?.code;
  const studyTypeDisplay = studyTypeCoding?.display;

  return createTask({
    category: RADIOLOGY_TASK.category,
    title: 'Review Radiology Final Results',
    code: {
      system: RADIOLOGY_TASK.system,
      code: RADIOLOGY_TASK.code.reviewFinalResultTask,
    },
    encounterId: encounter.id,
    basedOn: [`DiagnosticReport/${diagnosticReport.id}`, ...(serviceRequestRef ? [serviceRequestRef] : [])],
    location: locationInput,
    input: [
      {
        type: RADIOLOGY_TASK.input.appointmentId,
        valueString: appointmentId,
      },
      {
        type: RADIOLOGY_TASK.input.orderDate,
        valueString: serviceRequest.authoredOn,
      },
      {
        type: RADIOLOGY_TASK.input.patientName,
        valueString: getFullestAvailableName(patient),
      },
      {
        type: RADIOLOGY_TASK.input.providerName,
        valueString: providerName,
      },
      {
        type: RADIOLOGY_TASK.input.studyTypeCode,
        valueString: studyTypeCode,
      },
      {
        type: RADIOLOGY_TASK.input.studyTypeDisplay,
        valueString: studyTypeDisplay,
      },
    ],
  });
};
