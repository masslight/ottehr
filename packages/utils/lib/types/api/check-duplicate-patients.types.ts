import { VerifiedPhoneResolution } from '../../fhir/patient';

export interface CheckDuplicatePatientsInput {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  /**
   * Also resolve each match's login account and verified phone (what a visit booked for the patient
   * would use as its contact). Needed by Add Visit; opening a patient record needs no account.
   */
  includeAccountPhone?: boolean;
}

export interface DuplicatePatientCandidate {
  patientId: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dateOfBirth?: string;
  sex?: string;
  /** Only set when `includeAccountPhone` was requested. 'error' means the account lookup failed. */
  phone?: VerifiedPhoneResolution | { status: 'error' };
}

export interface CheckDuplicatePatientsResponse {
  candidates: DuplicatePatientCandidate[];
}
