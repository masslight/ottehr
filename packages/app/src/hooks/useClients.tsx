import { FhirClient, ZambdaClient } from '@zapehr/sdk';
import { useContext } from 'react';
import { DataContext } from '../store';

export function useFhirClient(): FhirClient | null {
  const { state } = useContext(DataContext);
  return state.fhirClient || null;
}

export function useZambdaClient(): ZambdaClient | null {
  const { state } = useContext(DataContext);
  return state.zambdaClient || null;
}
