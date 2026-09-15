import { useMemo } from 'react';
import { getPhrasesForPractitioner, Phrase } from 'utils/lib/fhir/practitioners';
import useEvolveUser from './useEvolveUser';

export function usePhrases(): Phrase[] {
  const profile = useEvolveUser()?.profileResource;
  return useMemo(() => getPhrasesForPractitioner(profile), [profile]);
}
