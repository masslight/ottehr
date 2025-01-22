import { isOlderThan18Years, isoStringFromDateComponents } from 'utils';
import { PatientInfoInProgress } from '../features/patients';
export const emailRegex = /^\S+@\S+\.\S+$/;
export const zipRegex = /^\d{5}$/;
export const phoneRegex = /^\(\d{3}\) \d{3}-\d{4}$/;
export const emojiRegex = /^(?:(?!\p{Extended_Pictographic}).)*$/u;

interface AgeDependentConfiguration {
  defaultEmail: string;
  patientOver18?: boolean;
}

export const getPatientAgeDependentData = (
  formValues: any,
  unconfirmedDateOfBirth: string | undefined,
  formDob: string | undefined
): AgeDependentConfiguration => {
  const dateOfBirth = formDob ?? unconfirmedDateOfBirth;

  // console.log('form dob', formDob);

  const patientOver18 = dateOfBirth ? isOlderThan18Years(dateOfBirth) : false;

  if (patientOver18) {
    return {
      defaultEmail: formValues['patient-email'] ?? '',
      patientOver18,
    };
  }

  return {
    defaultEmail: formValues['patient-email'],
    patientOver18,
  };
};

export const getPatientAgeDependentDataWithPatientData = (
  patientInfo: PatientInfoInProgress | undefined,
  unconfirmedDateOfBirth: string | undefined,
  formDob: string | undefined
): AgeDependentConfiguration => {
  let patientInfoDob: string | undefined;
  if (patientInfo?.dobDay && patientInfo?.dobMonth && patientInfo?.dobYear) {
    patientInfoDob = isoStringFromDateComponents({
      day: patientInfo?.dobDay,
      month: patientInfo?.dobMonth,
      year: patientInfo?.dobYear,
    });
  }
  const dateOfBirth = formDob ?? unconfirmedDateOfBirth ?? patientInfoDob;

  let patientOver18 = false;

  if (dateOfBirth) {
    patientOver18 = isOlderThan18Years(dateOfBirth);
  }

  return {
    defaultEmail: patientInfo?.email ?? '',
    patientOver18,
  };
};
