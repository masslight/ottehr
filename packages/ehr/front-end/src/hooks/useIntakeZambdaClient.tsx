import { useContext } from 'react';
import { IntakeDataContext } from '../store/IntakeContext';
import { ZambdaClient } from '@zapehr/sdk';

export function useIntakeZambdaClient(): ZambdaClient | undefined {
  const { state } = useContext(IntakeDataContext);
  return state.intakeZambdaClient;
}
