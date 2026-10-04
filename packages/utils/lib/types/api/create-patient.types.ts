import { PatientInfo } from '../data/telemed/appointments/create-appointment.types';

/** The details staff enter for a new patient on the Add Visit form. */
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
