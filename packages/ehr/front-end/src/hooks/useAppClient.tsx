import { useContext } from 'react';
import { IntakeDataContext } from '../store/IntakeContext';
import { AppClient } from '@zapehr/sdk';

export default function useAppClient(): AppClient | undefined {
  const { state } = useContext(IntakeDataContext);
  return state.appClient;
}
