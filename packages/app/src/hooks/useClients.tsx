import { FhirClient, ZambdaClient } from '@zapehr/sdk';
import { useContext } from 'react';
import { IntakeDataContext } from '../store';

export function useFhirClient(): FhirClient | null {
  const { state } = useContext(IntakeDataContext);
  return state.fhirClient || null;
}

export function useZambdaClient(): ZambdaClient | null {
  const { state } = useContext(IntakeDataContext);
  return state.zambdaClient || null;
}
