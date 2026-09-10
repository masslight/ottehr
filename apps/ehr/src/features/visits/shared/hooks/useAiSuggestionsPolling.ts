import { useEffect, useRef } from 'react';
import { getSelectors } from 'utils/lib/store';
import { AiObservationField } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import { useVideoCallStore } from '../../telemed/state/video-call/video-call.store';
import { useChartData } from '../stores/appointment/appointment.store';
import { AI_SUGGESTIONS_REQUESTED_FIELDS } from './aiChartRequests';
import { useChartFields } from './useChartFields';

const POLL_INTERVAL_MS = 30_000;
const MAX_POLL_ATTEMPTS = 20; // ~10 minutes

const AI_OBSERVATION_FIELDS = Object.values(AiObservationField) as string[];

const countAiSuggestions = (observations: GetChartDataResponse['observations']): number =>
  (observations ?? []).filter((observation) => AI_OBSERVATION_FIELDS.includes(observation.field)).length;

// After the provider ends a telemed call (oystehr.telemed.endMeeting), the recording pipeline transcribes
// the audio and creates AI suggestion Observations within a few minutes. Poll for them until they appear
// so suggestions show up without a manual page reload. A visit can have multiple calls, so we re-poll on
// every call end (endedCallCount) and stop once this call's suggestions land (count grows past the baseline)
// rather than keying on "any suggestions exist" — otherwise a later call would never be polled for.
//
// Each tick fetches only the AI suggestion Observations; the unscoped chart, which is where the UI reads
// the suggestions from, is refetched once when they have arrived.
export const useAiSuggestionsPolling = (): void => {
  const { endedCallCount } = getSelectors(useVideoCallStore, ['endedCallCount']);
  const { chartData, refetch } = useChartData();
  const { refetch: refetchAiSuggestions } = useChartFields({
    requestedFields: AI_SUGGESTIONS_REQUESTED_FIELDS,
    enabled: false,
  });

  const aiSuggestionCount = countAiSuggestions(chartData?.observations);
  // Keep the latest count in a ref so the interval reads fresh values without re-running the effect
  // (which would reset the poll window on every chart refetch).
  const aiSuggestionCountRef = useRef(aiSuggestionCount);
  aiSuggestionCountRef.current = aiSuggestionCount;

  useEffect(() => {
    if (endedCallCount === 0) {
      return;
    }

    const baseline = aiSuggestionCountRef.current;
    let attempts = 0;
    const intervalId = setInterval(async () => {
      attempts += 1;
      if (attempts > MAX_POLL_ATTEMPTS) {
        clearInterval(intervalId);
        return;
      }
      const result = await refetchAiSuggestions();
      const latest = countAiSuggestions(
        (result.data as Pick<GetChartDataResponse, 'observations'> | undefined)?.observations
      );
      if (latest > baseline) {
        clearInterval(intervalId);
        void refetch();
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [endedCallCount, refetch, refetchAiSuggestions]);
};
