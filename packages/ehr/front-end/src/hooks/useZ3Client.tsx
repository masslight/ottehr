import { useContext } from 'react';
import { IntakeDataContext } from '../store/IntakeContext';
import { Z3Client } from '@zapehr/sdk';

export function useZ3Client(): Z3Client | undefined {
  const { state } = useContext(IntakeDataContext);
  return state.z3Client;
}
