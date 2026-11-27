import { VerifiedPhoneResolution } from '../../fhir/patient';

export interface CheckDuplicatePatientsInput {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  includeAccountPhone?: boolean;
}

export interface DuplicatePatientCandidate {
  patientId: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dateOfBirth?: string;
  sex?: string;
  phone?: VerifiedPhoneResolution | { status: 'error' };
}

export interface CheckDuplicatePatientsResponse {
  candidates: DuplicatePatientCandidate[];
}
