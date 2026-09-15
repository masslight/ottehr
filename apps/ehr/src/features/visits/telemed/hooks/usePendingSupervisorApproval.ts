import { useCallback, useState } from 'react';
import { pendingSupervisorApproval } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';

export const usePendingSupervisorApproval = ({
  encounterId,
  practitionerId,
}: {
  encounterId: string;
  practitionerId: string;
}): {
  loading: boolean;
  error: Error | null;
  updateVisitStatusToAwaitSupervisorApproval: () => Promise<void>;
} => {
  const { oystehrZambda } = useApiClients();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Throws on every failure path. Callers treat a resolved promise as "the visit is now waiting for
  // a supervisor" and report success to the user on the strength of it, so swallowing a failure here
  // would tell a provider their note had been routed for approval when it had not.
  const updateVisitStatusToAwaitSupervisorApproval = useCallback(async (): Promise<void> => {
    if (!oystehrZambda) {
      throw new Error('Oystehr Zambda client is not available when requesting supervisor approval');
    }

    if (!encounterId) {
      throw new Error('Encounter ID is required to request supervisor approval');
    }

    if (!practitionerId) {
      throw new Error('Practitioner ID is required to request supervisor approval');
    }

    setLoading(true);
    setError(null);

    try {
      await pendingSupervisorApproval(oystehrZambda, { encounterId, practitionerId });
    } catch (err) {
      const failure = err instanceof Error ? err : new Error('Unknown error occurred');
      console.error('error with setting pending supervisor approval:', failure);
      setError(failure);
      throw failure;
    } finally {
      setLoading(false);
    }
  }, [oystehrZambda, encounterId, practitionerId]);

  return {
    loading,
    error,
    updateVisitStatusToAwaitSupervisorApproval,
  };
};
