import { FhirResource } from 'fhir/r4b';
import { formatDOB, getQuestionnaireResponseByLinkId, PATIENT_PHOTO_CODE, SCHOOL_WORK_NOTE_TEMPLATE_CODE } from 'utils';
import { getPatientName } from '../../../telemed/utils';
import { getPatientInfoWithFallback, getPronouns, getWeight } from './business-logic';
import { Gender } from './constants';
import {
  extractUrlsFromAppointmentData,
  getAllergies,
  getAppointmentValues,
  getEncounterValues,
  getHospitalizations,
  getLocationValues,
  getPatientValues,
  getQuestionnaireResponseValues,
  getResources,
} from './extractors';
import { VisitDataAndMappedData, VisitMappedData } from './types';

// export const getVisitMappedData = ({
//   patient,
//   questionnaireResponse,
//   resources,
// }: AppointmentStore): Partial<VisitMappedData> => {
//   const patientName = getPatientName(patient?.name);

//   return {
//     patientName:
//       patientName?.lastFirstMiddleName || patientName?.lastFirstName || patientName?.lastName || patientName?.firstName,
//     patientAvatarPhotoUrl: patient?.photo?.at(0)?.url,
//     patientConditionalPhotosUrls: extractUrlsFromAppointmentData(resources, PATIENT_PHOTO_CODE),
//     schoolWorkNoteUrls: extractUrlsFromAppointmentData(resources, SCHOOL_WORK_NOTE_TEMPLATE_CODE),
//     pronouns: getPronouns(getQuestionnaireResponseValues(questionnaireResponse)),
//     gender: patient?.gender ? Gender[patient.gender as keyof typeof Gender] : undefined,
//     preferredLanguage: getQuestionnaireResponseByLinkId('preferred-language', questionnaireResponse)?.answer?.[0]
//       ?.valueString,
//     DOB: formatDOB(patient?.birthDate),
//     allergies: getAllergies(questionnaireResponse),
//     hospitalizations: getHospitalizations(questionnaireResponse),
//     weight: getWeight(getPatientValues(patient)),
//   };
// };

export const getVisitMappedData = (resourceBundle: FhirResource[]): Partial<VisitMappedData> => {
  const { patient, questionnaireResponse } = getResources(resourceBundle);
  const patientName = getPatientName(patient?.name);

  return {
    patientName:
      patientName?.lastFirstMiddleName || patientName?.lastFirstName || patientName?.lastName || patientName?.firstName,
    patientAvatarPhotoUrl: patient?.photo?.at(0)?.url,
    patientConditionalPhotosUrls: extractUrlsFromAppointmentData(resourceBundle, PATIENT_PHOTO_CODE),
    schoolWorkNoteUrls: extractUrlsFromAppointmentData(resourceBundle, SCHOOL_WORK_NOTE_TEMPLATE_CODE),
    pronouns: getPronouns(getQuestionnaireResponseValues(questionnaireResponse)),
    gender: patient?.gender ? Gender[patient.gender as keyof typeof Gender] : undefined,
    preferredLanguage: getQuestionnaireResponseByLinkId('preferred-language', questionnaireResponse)?.answer?.[0]
      ?.valueString,
    DOB: formatDOB(patient?.birthDate),
    allergies: getAllergies(questionnaireResponse),
    hospitalizations: getHospitalizations(questionnaireResponse),
    weight: getWeight(getPatientValues(patient)),
  };
};

export const parseBundle = (resourceBundle: FhirResource[]): VisitDataAndMappedData => {
  const {
    appointment: appointmentResource,
    patient: patientResource,
    location: locationResource,
    locationVirtual: locationVirtualResource,
    encounter: encounterResource,
    questionnaireResponse: questionnaireResponseResource,
  } = getResources(resourceBundle);

  const appointment = getAppointmentValues(appointmentResource);
  const patient = getPatientValues(patientResource);
  const location = getLocationValues(locationResource);
  const locationVirtual = getLocationValues(locationVirtualResource);
  const encounter = getEncounterValues(encounterResource);
  const questionnaire = getQuestionnaireResponseValues(questionnaireResponseResource);
  const patientInfoWithFallback = getPatientInfoWithFallback(patient, questionnaire);
  const parsedAppointmentData = getVisitMappedData(resourceBundle);

  return {
    resources: {
      appointment,
      location,
      locationVirtual,
      encounter,
      questionnaire,
      patient,
    },
    mappedData: {
      ...patientInfoWithFallback,
      ...parsedAppointmentData,
    },
  };
};

// export const parseBundle = (resources: AppointmentStore): VisitDataAndMappedData => {
//   const appointment = getAppointmentValues(resources.appointment);
//   const patient = getPatientValues(resources.patient);
//   const location = getLocationValues(resources.location);
//   const locationVirtual = getLocationValues(resources.locationVirtual);
//   const encounter = getEncounterValues(resources.encounter);
//   const questionnaire = getQuestionnaireResponseValues(resources.questionnaireResponse);
//   const patientInfoWithFallback = getPatientInfoWithFallback(patient, questionnaire);
//   const parsedAppointmentData = getVisitMappedData(resources);

//   return {
//     resources: {
//       appointment,
//       location,
//       locationVirtual,
//       encounter,
//       questionnaire,
//       patient,
//     },
//     mappedData: {
//       ...patientInfoWithFallback,
//       ...parsedAppointmentData,
//     },
//   };
// };
