import { useEffect, useRef } from 'react';
import { AiObservationField, getSelectors } from 'utils';
import { useVideoCallStore } from '../../telemed/state/video-call/video-call.store';
import { useChartData } from '../stores/appointment/appointment.store';

const POLL_INTERVAL_MS = 30_000;
const MAX_POLL_ATTEMPTS = 20; // ~10 minutes

const AI_OBSERVATION_FIELDS = Object.values(AiObservationField) as string[];

// After the provider ends a telemed call (oystehr.telemed.endMeeting), the recording pipeline transcribes
// the audio and creates AI suggestion Observations within a few minutes. Poll chart data until they appear
// so suggestions show up without a manual page reload. A visit can have multiple calls, so we re-poll on
// every call end (endedCallCount) and stop once this call's suggestions land (count grows past the baseline)
// rather than keying on "any suggestions exist" — otherwise a later call would never be polled for.
export const useAiSuggestionsPolling = (): void => {
  const { endedCallCount } = getSelectors(useVideoCallStore, ['endedCallCount']);
  const { chartData, refetch } = useChartData();

  const aiSuggestionCount = (chartData?.observations ?? []).filter((observation) =>
    AI_OBSERVATION_FIELDS.includes(observation.field)
  ).length;
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
    const intervalId = setInterval(() => {
      attempts += 1;
      if (aiSuggestionCountRef.current > baseline || attempts > MAX_POLL_ATTEMPTS) {
        clearInterval(intervalId);
        return;
      }
      void refetch();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [endedCallCount, refetch]);
};
