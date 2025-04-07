import { Practitioner, QuestionnaireResponse } from 'fhir/r4b';
import { PatientAccountAndCoverageResources } from '../../data';

export interface GetPatientAccountZambdaInput {
  patientId: string;
}

export interface RemoveCoverageZambdaInput {
  patientId: string;
  coverageId: string;
}

export interface UpdateCoverageZambdaInput {
  questionnaireResponse: QuestionnaireResponse;
}

export interface PatientAccountResponse extends PatientAccountAndCoverageResources {
  primaryCarePhysician?: Practitioner;
}
