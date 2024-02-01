import { AppClient, FhirClient, User, Z3Client, ZambdaClient } from '@zapehr/sdk';

export type IntakeAction = {
  type:
    | 'SET_FHIR_CLIENT'
    | 'SET_APP_CLIENT'
    | 'SET_ZAMBDA_CLIENT'
    | 'SET_INTAKE_ZAMBDA_CLIENT'
    | 'SET_Z3_CLIENT'
    | 'SET_USER';
  fhirClient?: FhirClient;
  appClient?: AppClient;
  zambdaClient?: ZambdaClient;
  intakeZambdaClient?: ZambdaClient;
  z3Client?: Z3Client;
  user?: User;
};

export type IntakeState = {
  fhirClient?: FhirClient;
  appClient?: AppClient;
  zambdaClient?: ZambdaClient;
  intakeZambdaClient?: ZambdaClient;
  z3Client?: Z3Client;
  user?: User;
};
