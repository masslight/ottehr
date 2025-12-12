import { Patient, RelatedPerson } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getPatientName } from 'src/shared/utils';
import { getPatientAddress, mapGenderToLabel } from 'utils';
import { PatientInformationModalFormValues } from './form-values.types';
import { getDateFromFormat, mapPersonInformationToResource } from './resources.helper';

export const getPatientData = (
  patient?: Patient | RelatedPerson
): ReturnType<typeof getPatientName> &
  ReturnType<typeof getPatientAddress> & { dob?: DateTime; gender?: string; genderLabel?: string; phone?: string } => {
  const patientName = getPatientName(patient?.name);
  const patientAddress = getPatientAddress(patient?.address);
  const dob = getDateFromFormat(patient?.birthDate);
  const gender = patient?.gender;
  const genderLabel = patient?.gender && mapGenderToLabel[patient.gender];
  const phone = patient?.telecom?.find((item) => item.system === 'phone')?.value;

  return { ...patientName, ...patientAddress, dob, gender, genderLabel, phone };
};

export const mapPatientInformationToPatientResource = (
  patient: Patient,
  patientInformation: PatientInformationModalFormValues
): Patient => {
  const patientCopy = structuredClone(patient) as Patient;

  mapPersonInformationToResource(patientCopy, patientInformation);

  return patientCopy;
};
