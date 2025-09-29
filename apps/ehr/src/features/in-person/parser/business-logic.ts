import { DateTime } from 'luxon';
import { DATE_FORMAT, DISPLAY_DATE_FORMAT } from 'utils';
import { LBS_TO_KG_FACTOR, WEIGHT_ROUNDING_PRECISION } from './constants';
import { PatientValues, QuestionnaireResponseValues, VisitMappedData } from './types';

export const getPatientInfoWithFallback = (
  patient: PatientValues,
  questionnaire: QuestionnaireResponseValues
): Partial<VisitMappedData> => ({
  firstName: patient.firstName ?? questionnaire.firstName,
  lastName: patient.lastName ?? questionnaire.lastName,
  birthDate: patient.birthDate ?? questionnaire.birthDate,
  addressStreet1: patient.address?.street1 ?? questionnaire.addressStreet1,
  addressStreet2: patient.address?.street2 ?? questionnaire.addressStreet2,
  addressCity: patient.address?.city ?? questionnaire.addressCity,
  addressState: patient.address?.state ?? questionnaire.addressState,
  addressZip: patient.address?.postalCode ?? questionnaire.addressZip,
  race: patient.race ?? questionnaire.race,
  ethnicity: patient.ethnicity ?? questionnaire.ethnicity,
  email: patient.email ?? questionnaire.guardianEmail,
  phone: patient.phone ?? questionnaire.guardianNumber,
});

export const getPronouns = (questionnaire: QuestionnaireResponseValues): string | undefined => {
  const pronouns = questionnaire.pronouns;
  const customPronouns = questionnaire.customPronouns;
  const patientPronounsNotListedValues = ['My pronounces are not listed', 'My pronouns are not listed'];
  return patientPronounsNotListedValues.includes(pronouns ?? '') ? customPronouns : pronouns;
};

export const getWeight = (patientValues: PatientValues): string | undefined => {
  const { weight, weightLastUpdated } = patientValues;

  if (weight && weightLastUpdated) {
    const weightInKg =
      Math.round(Number(weight) * LBS_TO_KG_FACTOR * WEIGHT_ROUNDING_PRECISION) / WEIGHT_ROUNDING_PRECISION;

    const formattedDate = DateTime.fromFormat(weightLastUpdated, DATE_FORMAT).toFormat(DISPLAY_DATE_FORMAT);
    return `${weightInKg} kg (updated ${formattedDate})`;
  }

  return undefined;
};
