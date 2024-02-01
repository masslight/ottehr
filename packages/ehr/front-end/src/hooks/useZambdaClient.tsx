import { useContext } from 'react';
import { IntakeDataContext } from '../store/IntakeContext';
import { ZambdaClient } from '@zapehr/sdk';

export function useZambdaClient(): ZambdaClient | undefined {
  const { state } = useContext(IntakeDataContext);
  return state.zambdaClient;
}
