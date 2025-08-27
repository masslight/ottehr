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

  const updateVisitStatusToAwaitSupervisorApproval = useCallback(async (): Promise<void> => {
    if (!oystehrZambda) {
      console.error('oystehrZambda is not defined');
      return;
    }

    if (!encounterId) {
      console.error('encounterId is undefined — skipping update.');
      return;
    }

    if (!practitionerId) {
      console.error('practitionerId is undefined — skipping update.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      try {
        await pendingSupervisorApproval(oystehrZambda, { encounterId, practitionerId });
      } catch (err) {
        console.error('Error updating nursing order:', err);
        setError(err instanceof Error ? err : new Error('Unknown error occurred'));
      }
    } catch (error) {
      console.error('error with setting pending supervisor approval:', error);
      setError(error instanceof Error ? error : new Error('Unknown error occurred'));
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
