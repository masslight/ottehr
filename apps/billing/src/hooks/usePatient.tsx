import { useCallback, useEffect, useState } from 'react';
import { getApiError, PatientDetailResponse } from 'utils';
import { getBillingPatientDetail } from '../api/api';
import { useApiClients } from './useAppClients';

export function usePatient({
  id,
  onLoading,
  onError,
}: {
  id: string;
  onLoading?: (loading: boolean) => void;
  onError?: (err: string | null) => void;
}): [PatientDetailResponse | null, () => Promise<void>] {
  const { oystehrZambda } = useApiClients();
  const [patient, setPatient] = useState<PatientDetailResponse | null>(null);
  const fetchDetail = useCallback(async () => {
    if (!oystehrZambda || !id) return;
    onLoading?.(true);
    onError?.(null);
    try {
      const data = await getBillingPatientDetail(oystehrZambda, { patientId: id });
      setPatient(data);
    } catch (err) {
      onError?.(getApiError({ error: err, defaultError: 'Failed to load patient' }));
    } finally {
      onLoading?.(false);
    }
  }, [oystehrZambda, id, onLoading, onError]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  return [patient, fetchDetail];
}
