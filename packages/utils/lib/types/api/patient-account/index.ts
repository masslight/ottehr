import { Practitioner, QuestionnaireResponse } from 'fhir/r4b';
import { InsuranceCheckStatusWithDate, PatientAccountAndCoverageResources } from '../../data';

export interface GetPatientAccountZambdaInput {
  patientId: string;
}

export interface RemoveCoverageZambdaInput {
  patientId: string;
  coverageId: string;
}

export interface RemoveCoverageResponse {
  message: 'Successfully removed coverage';
}

export interface CoverageCheckCoverageDetails {
  subscriberId: string;
  payorRef: string;
  planId?: string;
}

export type CoverageCheckWithDetails = InsuranceCheckStatusWithDate & CoverageCheckCoverageDetails;

export interface PatientAccountResponse extends PatientAccountAndCoverageResources {
  primaryCarePhysician?: Practitioner;
  coverageChecks: CoverageCheckWithDetails[];
}

export interface UpdatePatientAccountInput {
  questionnaireResponse: QuestionnaireResponse;
}

export interface UpdatePatientAccountResponse {
  result: 'success';
}
