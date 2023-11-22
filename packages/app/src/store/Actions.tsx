import { FhirClient, ZambdaClient } from '@zapehr/sdk';
import { Dispatch } from 'react';
import { Action, PatientInfo } from './types';

export const setFhirClient = (token: string, dispatch: Dispatch<Action>): void => {
  const fhirClient = new FhirClient({
    accessToken: token,
    apiUrl: import.meta.env.VITE_FHIR_API_URL,
  });
  dispatch({
    fhirClient,
    type: 'SET_FHIR_CLIENT',
  });
};

export const setZambdaClient = (token: string | undefined, dispatch: Dispatch<Action>): void => {
  const zambdaClient = new ZambdaClient({
    accessToken: token,
    apiUrl: import.meta.env.VITE_PROJECT_API_URL,
  });
  dispatch({
    type: 'SET_ZAMBDA_CLIENT',
    zambdaClient,
  });
};

export const updatePatient = (patientInfo: PatientInfo | undefined, dispatch: Dispatch<Action>): void => {
  dispatch({
    patientInfo,
    type: 'UPDATE_PATIENT',
  });
};
