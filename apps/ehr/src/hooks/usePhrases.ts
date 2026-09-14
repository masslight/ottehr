import { useMemo } from 'react';
import { getPhrasesForPractitioner, Phrase } from 'utils/lib/fhir/practitioners';
import useEvolveUser from './useEvolveUser';

/** The logged-in user's phrases, read from the cached Practitioner profile (same source as notification preferences). */
export function usePhrases(): Phrase[] {
  const profile = useEvolveUser()?.profileResource;
  return useMemo(() => getPhrasesForPractitioner(profile), [profile]);
}
