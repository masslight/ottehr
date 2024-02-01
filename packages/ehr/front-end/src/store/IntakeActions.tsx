import { Dispatch } from 'react';
import { IntakeAction } from './types';
import { AppClient, FhirClient, User, Z3Client, ZambdaClient } from '@zapehr/sdk';

export const setFhirClient = (token: string | undefined, dispatch: Dispatch<IntakeAction>): void => {
  const fhirClient = new FhirClient({
    apiUrl: import.meta.env.VITE_APP_FHIR_API_URL,
    accessToken: token,
  });
  dispatch({
    type: 'SET_FHIR_CLIENT',
    fhirClient: fhirClient,
  });
};

export const setAppClient = (token: string | undefined, dispatch: Dispatch<IntakeAction>): void => {
  const appClient = new AppClient({
    apiUrl: import.meta.env.VITE_APP_PROJECT_API_URL,
    accessToken: token,
  });
  dispatch({
    type: 'SET_APP_CLIENT',
    appClient: appClient,
  });
};

export const setZambdaClient = (token: string | undefined, dispatch: Dispatch<IntakeAction>): void => {
  const zambdaClient = new ZambdaClient({
    apiUrl: import.meta.env.VITE_APP_PROJECT_API_ZAMBDA_URL,
    accessToken: token,
  });
  dispatch({
    type: 'SET_ZAMBDA_CLIENT',
    zambdaClient: zambdaClient,
  });
};

export const setIntakeZambdaClient = (token: string | undefined, dispatch: Dispatch<IntakeAction>): void => {
  const intakeZambdaClient = new ZambdaClient({
    apiUrl: import.meta.env.VITE_APP_INTAKE_ZAMBDAS_URL,
    accessToken: token,
  });
  dispatch({
    type: 'SET_INTAKE_ZAMBDA_CLIENT',
    intakeZambdaClient: intakeZambdaClient,
  });
};

export const setZ3Client = (token: string | undefined, dispatch: Dispatch<IntakeAction>): void => {
  const z3Client = new Z3Client({
    apiUrl: import.meta.env.VITE_APP_PROJECT_API_URL,
    accessToken: token,
  });
  dispatch({
    type: 'SET_Z3_CLIENT',
    z3Client: z3Client,
  });
};

export const setUser = (user: User, dispatch: Dispatch<IntakeAction>): void => {
  dispatch({
    type: 'SET_USER',
    user: user,
  });
};
