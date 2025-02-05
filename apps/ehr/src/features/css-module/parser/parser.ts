import { FhirResource } from 'fhir/r4b';
import { getQuestionnaireResponseByLinkId, PATIENT_PHOTO_CODE, SCHOOL_WORK_NOTE_TEMPLATE_CODE, formatDOB } from 'utils';
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
import { AppointmentProcessedSourceData, ProcessedData } from './types';

export const getParsedAppointmentData = (resourceBundle: FhirResource[]): Partial<ProcessedData> => {
  const { patient, questionnaireResponse } = getResources(resourceBundle);
  const patientName = getPatientName(patient?.name);

  return {
    patientName: patientName?.lastFirstName || patientName?.lastName || patientName?.firstName,
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

export const parseBundle = (resourceBundle: FhirResource[]): AppointmentProcessedSourceData => {
  const {
    appointment: appointmentResource,
    patient: patientResource,
    location: locationResource,
    encounter: encounterResource,
    questionnaireResponse: questionnaireResponseResource,
  } = getResources(resourceBundle);

  const appointment = getAppointmentValues(appointmentResource);
  const patient = getPatientValues(patientResource);
  const location = getLocationValues(locationResource);
  const encounter = getEncounterValues(encounterResource);
  const questionnaire = getQuestionnaireResponseValues(questionnaireResponseResource);
  const patientInfoWithFallback = getPatientInfoWithFallback(patient, questionnaire);
  const parsedAppointmentData = getParsedAppointmentData(resourceBundle);

  return {
    sourceData: {
      appointment,
      location,
      encounter,
      questionnaire,
      patient,
    },
    processedData: {
      ...patientInfoWithFallback,
      ...parsedAppointmentData,
    },
  };
};
