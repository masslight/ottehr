import { Appointment, Bundle, Location, Patient, QuestionnaireResponse } from 'fhir/r4';

interface ValidateBundleOutput {
  appointment: Appointment;
  location: Location;
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

  const location: Location = entry.find((appt) => {
    return appt.resource && appt.resource.resourceType === 'Location';
  })?.resource as Location;

  if (!location) {
    throw new Error('Location could not be found');
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

  return { appointment, location, questionnaireResponse, patient };
};
