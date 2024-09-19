import { Appointment, Bundle, HealthcareService, Location, Practitioner, QuestionnaireResponse } from 'fhir/r4';

interface ValidateBundleOutput {
  appointment: Appointment;
  appointmentResource: Location | Practitioner | HealthcareService;
  questionnaireResponse: QuestionnaireResponse;
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
  console.log('entry', JSON.stringify(searchBundle));

  const appointment: Appointment = entry.find((appt) => {
    return appt.resource && appt.resource.resourceType === 'Appointment';
  })?.resource as Appointment;

  if (!appointment) {
    throw new Error('Appointment could not be found');
  }

  const appointmentResources = ['Location', 'Practitioner', 'HealthcareService'];
  let appointmentResource: Location | Practitioner | HealthcareService | undefined = undefined;
  for (const aptResource of appointmentResources) {
    appointmentResource = entry.find((appt) => {
      return appt.resource && appt.resource.resourceType === aptResource;
    })?.resource as Location | Practitioner | HealthcareService;

    if (appointmentResource) {
      break;
    }
  }
  if (!appointmentResource) {
    throw new Error('Resource could not be found');
  }

  const questionnaireResponse: QuestionnaireResponse = entry.find((appt) => {
    return appt.resource && appt.resource.resourceType === 'QuestionnaireResponse';
  })?.resource as QuestionnaireResponse;
  // no validation for questionnaireResponse because a patient can check-in
  // to a prebook appointment without filling out paperwork so there is no
  // questionnaireResponse associated with the encounter, but it is still
  // valid for them to check-in.

  return { appointment, appointmentResource, questionnaireResponse };
};
