import Oystehr from '@oystehr/sdk';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { ReportRefreshStatus } from 'utils/lib/types/data/billing/billing.types';
import { useApiClients } from './useAppClients';

// polling cadence while a refresh runs server-side
const POLL_INTERVAL_MS = 4000;
const MAX_POLLS = 200;

interface ReportEnvelope {
  generatedAt: string;
  status?: ReportRefreshStatus;
}

export interface UseBillingReportResult<T extends ReportEnvelope> {
  report: T | null;
  status: ReportRefreshStatus | undefined;
  loading: boolean;
  error: string | null;
  clearError: () => void;
  refresh: () => void;
}

// Shared fetch-and-poll loop: serves the cached report and polls while a server-side refresh runs.
export function useBillingReport<T extends ReportEnvelope>(options: {
  fetch: (client: Oystehr, refresh?: boolean) => Promise<T>;
  errorMessage: string;
  // when false, the initial load waits (e.g. until a date range resolves)
  enabled?: boolean;
}): UseBillingReportResult<T> {
  const { fetch, errorMessage, enabled = true } = options;
  const { oystehrZambda } = useApiClients();
  const [report, setReport] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // invalidates in-flight loops when params change or the component unmounts
  const generation = useRef(0);

  const run = useCallback(
    async (refresh?: boolean): Promise<void> => {
      if (!oystehrZambda) return;
      const myGeneration = ++generation.current;
      setLoading(true);
      setError(null);
      try {
        let current = await fetch(oystehrZambda, refresh);
        if (generation.current !== myGeneration) return;
        setReport(current);
        setLoading(false);
        let polls = 0;
        while (current.status?.state === 'running' && polls < MAX_POLLS) {
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
          if (generation.current !== myGeneration) return;
          current = await fetch(oystehrZambda);
          if (generation.current !== myGeneration) return;
          setReport(current);
          polls += 1;
        }
      } catch (err) {
        if (generation.current !== myGeneration) return;
        setError(getApiError({ error: err, defaultError: errorMessage }));
      } finally {
        if (generation.current === myGeneration) setLoading(false);
      }
    },
    [oystehrZambda, fetch, errorMessage]
  );

  useEffect(() => {
    if (!enabled) return;
    void run();
  }, [run, enabled]);

  useEffect(() => {
    return () => {
      generation.current += 1;
    };
  }, []);

  return {
    report,
    status: report?.status,
    loading,
    error,
    clearError: () => setError(null),
    refresh: () => void run(true),
  };
}
