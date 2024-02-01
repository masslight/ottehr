import { useContext } from 'react';
import { IntakeDataContext } from '../store/IntakeContext';
import { FhirClient } from '@zapehr/sdk';

export default function useFhirClient(): FhirClient | undefined {
  const { state } = useContext(IntakeDataContext);
  return state.fhirClient;
}
