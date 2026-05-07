import { Organization, Practitioner, QuestionnaireResponse } from 'fhir/r4b';
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
  pharmacy?: Organization;
}

export interface UpdatePatientAccountInput {
  questionnaireResponse: QuestionnaireResponse;
}

export interface UpdatePatientAccountResponse {
  result: 'success';
}

export interface MergePatientsInput {
  mainPatientId: string;
  otherPatientId: string;
  questionnaireResponse: QuestionnaireResponse;
}

export interface MergePatientsResponse {
  taskId: string;
  status: 'requested' | 'in-progress' | 'completed' | 'failed';
}

export interface GetMergePatientsTaskInput {
  patientId: string;
}

export interface GetMergePatientsTaskResponse {
  task: {
    id: string;
    status: 'requested' | 'in-progress' | 'completed' | 'failed' | 'rejected' | 'cancelled' | 'received' | 'ready';
    otherPatientId: string;
    statusReason?: string;
  } | null;
}
