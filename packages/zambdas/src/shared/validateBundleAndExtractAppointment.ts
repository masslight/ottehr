import {
  Appointment,
  Bundle,
  HealthcareService,
  Location,
  Patient,
  Practitioner,
  QuestionnaireResponse,
} from 'fhir/r4b';
import { SCHEDULE_NOT_FOUND_ERROR } from 'utils';

interface ValidateBundleOutput {
  appointment: Appointment;
  scheduleResource: Location | HealthcareService | Practitioner;
  questionnaireResponse: QuestionnaireResponse;
  patient: Patient;
}

export const validateBundleAndExtractAppointment = (bundle: Bundle): ValidateBundleOutput => {
  const entries = bundle.entry ?? [];
  // console.log('bundle', JSON.stringify(bundle));
  const searchBundle = entries.find((item) => {
    return item.resource && item.resource.resourceType === 'Bundle' && item.resource.type === 'searchset';
  })?.resource as Bundle;
  if (!searchBundle) {
    throw new Error('Transaction could not be completed');
  }

  const entry = searchBundle.entry ?? [];

  const appointment: Appointment = entry.find((appt) => {
    return appt.resource && appt.resource.resourceType === 'Appointment';
  })?.resource as Appointment;

  if (!appointment) {
    throw new Error('Appointment could not be found');
  }

  // get schedule resource
  const fhirLocation = entry.find((e) => e.resource?.resourceType === 'Location');
  const fhirHS = entry.find((e) => e.resource?.resourceType === 'HealthcareService');
  const fhirPractitioner = entry.find((e) => e.resource?.resourceType === 'Practitioner'); // todo is this right ?
  let scheduleResource: Location | HealthcareService | Practitioner | undefined;
  if (fhirLocation) {
    scheduleResource = fhirLocation.resource as Location;
  } else if (fhirHS) {
    scheduleResource = fhirHS.resource as HealthcareService;
  } else if (fhirPractitioner) {
    scheduleResource = fhirPractitioner.resource as Practitioner;
  }

  if (!scheduleResource) {
    throw SCHEDULE_NOT_FOUND_ERROR;
  }

  const patient: Patient = entry.find((appt) => {
    return appt.resource && appt.resource.resourceType === 'Patient';
  })?.resource as Patient;

  if (!patient) {
    throw new Error('Patient could not be found');
  }

  const questionnaireResponse: QuestionnaireResponse = entry.find((appt) => {
    return appt.resource && appt.resource.resourceType === 'QuestionnaireResponse';
  })?.resource as QuestionnaireResponse;
  // no validation for questionnaireResponse because a patient can check-in
  // to a prebook appointment without filling out paperwork so there is no
  // questionnaireResponse associated with the encounter, but it is still
  // valid for them to check-in.

  return { appointment, scheduleResource, questionnaireResponse, patient };
};
