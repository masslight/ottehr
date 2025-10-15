import { PatientInfo } from 'utils';

export const PatientSexOptions: string[] = ['male', 'female', 'other'];

export interface PatientInfoInProgress extends Omit<PatientInfo, 'patientDateOfBirth'> {
  dobYear: string | undefined;
  dobMonth: string | undefined;
  dobDay: string | undefined;
}
