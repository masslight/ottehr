import { Patient } from 'fhir/r4b';
import type { AddVisitPatientInfo } from 'src/pages/AddPatient';
import { getFirstName, getLastName, getMiddleName } from 'utils/lib/fhir/patient';
import { getPhoneNumberDigits } from 'utils/lib/helpers/helpers';

export const fhirPatientToAddVisitInfo = (patient: Patient): AddVisitPatientInfo => ({
  id: patient.id,
  newPatient: false,
  firstName: getFirstName(patient),
  middleName: getMiddleName(patient),
  lastName: getLastName(patient),
  dateOfBirth: patient.birthDate,
  sex: patient.gender,
  phoneNumber: getPhoneNumberDigits(patient.telecom?.find((t) => t.system === 'phone')?.value),
});
