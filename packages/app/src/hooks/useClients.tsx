import { useContext } from 'react';
import { IntakeDataContext } from '../store';
import { FhirClient, ZambdaClient } from '@zapehr/sdk';

export function useFhirClient(): FhirClient | null {
  const { state } = useContext(IntakeDataContext);
  return state.fhirClient || null;
}

export function useZambdaClient(): ZambdaClient | null {
  const { state } = useContext(IntakeDataContext);
  return state.zambdaClient || null;
}
