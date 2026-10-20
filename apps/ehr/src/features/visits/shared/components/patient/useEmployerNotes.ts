import { useQuery } from '@tanstack/react-query';
import { Organization, Reference } from 'fhir/r4b';
import { useApiClients } from 'src/hooks/useAppClients';
import { getEmployerNotes } from 'utils/lib/fhir/organization';
import { isNioReferenceUrl, removePrefix } from 'utils/lib/helpers/helpers';

const STALE_TIME_MS = 5 * 60 * 1000;

/**
 * Read-only notes staff captured for the employer in Billing Configurations -> Employers, resolved
 * from the employer Organization the given reference points at. Returns undefined while loading,
 * when no employer is selected, and when the employer has no notes.
 */
export const useEmployerNotes = (employer: Reference | null | undefined): string | undefined => {
  const { oystehr } = useApiClients();
  // An NIO employer lives in the billing app and exposes no notes to the clinical side; only a
  // legacy employer Organization is resolvable (and readable) here.
  const employerId =
    employer?.reference && !isNioReferenceUrl(employer.reference)
      ? removePrefix('Organization/', employer.reference)
      : undefined;

  const { data } = useQuery({
    // Keyed under 'employers' so saving an employer in the admin screen, which invalidates that
    // prefix, also refreshes the notes shown here.
    queryKey: ['employers', employerId],
    enabled: !!oystehr && !!employerId,
    staleTime: STALE_TIME_MS,
    queryFn: async () => {
      const organization = await oystehr!.fhir.get<Organization>({ resourceType: 'Organization', id: employerId! });
      // react-query rejects an undefined queryFn result, so a note-less employer resolves to null.
      return getEmployerNotes(organization) ?? null;
    },
  });

  return data ?? undefined;
};
