import { DateTime } from 'luxon';
import { PatientInfo, TelemedAppointmentInformationIntake, yupDateTransform } from 'utils';

export const findActiveAppointment = (
  appointments?: TelemedAppointmentInformationIntake[]
): TelemedAppointmentInformationIntake | undefined => {
  return appointments?.reduce<TelemedAppointmentInformationIntake | undefined>?.((latest, current) => {
    if (!['ready', 'pre-video', 'on-video'].includes(current.telemedStatus)) {
      return latest;
    }
    if (!latest?.start || !current.start) {
      return latest || current;
    }
    return new Date(current.start) > new Date(latest.start) ? current : latest;
  }, undefined);
};

const UPDATABLE_PATIENT_INFO_FIELDS: (keyof Omit<PatientInfo, 'id'>)[] = [
  'firstName',
  'lastName',
  'middleName',
  'chosenName',
  'dateOfBirth',
  'sex',
  'weight',
  'email',
  'reasonForVisit',
];

export const createPatientInfoWithChangedFields = (
  source: PatientInfo,
  newInfo: Omit<PatientInfo, 'id'>
): PatientInfo => {
  const newPatientInfo = { ...source };
  for (const key of UPDATABLE_PATIENT_INFO_FIELDS) {
    newPatientInfo[key] = newInfo[key] as any;
  }
  return newPatientInfo;
};

export const isPatientInfoEqual = (firstInfo: PatientInfo, newInfo: PatientInfo): boolean => {
  for (const key of UPDATABLE_PATIENT_INFO_FIELDS) {
    if (key === 'dateOfBirth' || key === 'weightLastUpdated') {
      const firstDate = DateTime.fromFormat(yupDateTransform(firstInfo[key]) || '', 'yyyy-MM-dd');
      const secondDate = DateTime.fromFormat(yupDateTransform(newInfo[key]) || '', 'yyyy-MM-dd');
      if (!firstDate.equals(secondDate)) return false;
    } else if (key === 'weight' && firstInfo[key] && newInfo[key]) {
      const isWeightEqual = `${firstInfo[key]}` === `${newInfo[key]}`;
      if (!isWeightEqual) return false;
      if (isWeightEqual) continue;
    } else {
      // Optional fields might be undefined and compared with empty strings.
      if (firstInfo[key] === undefined && newInfo[key] === '') continue;
      if (firstInfo[key] !== newInfo[key]) return false;
    }
  }

  return true;
};
