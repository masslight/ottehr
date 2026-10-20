import { PatientInfo } from '../data/telemed/appointments/create-appointment.types';

export type CreatePatientInfo = Pick<
  PatientInfo,
  'firstName' | 'middleName' | 'lastName' | 'dateOfBirth' | 'sex' | 'phoneNumber'
>;

export interface CreatePatientInput {
  patient: CreatePatientInfo;
}

export interface CreatePatientResponse {
  patientId: string;
}
