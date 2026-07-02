import { useEffect, useRef } from 'react';
import { AiObservationField, getSelectors } from 'utils';
import { useVideoCallStore } from '../../telemed/state/video-call/video-call.store';
import { useChartData } from '../stores/appointment/appointment.store';

const POLL_INTERVAL_MS = 30_000;
const MAX_POLL_ATTEMPTS = 20; // ~10 minutes

const AI_OBSERVATION_FIELDS = Object.values(AiObservationField) as string[];

// After the provider permanently ends a telemed call (oystehr.telemed.endMeeting), the recording
// pipeline transcribes the audio and creates AI suggestion Observations within a few minutes.
// Poll chart data until they appear so suggestions show up without a manual page reload.
export const useAiSuggestionsPolling = (): void => {
  const { wasMeetingEnded } = getSelectors(useVideoCallStore, ['wasMeetingEnded']);
  const { chartData, refetch } = useChartData();
  const attemptsRef = useRef(0);

  const hasAiSuggestions = (chartData?.observations ?? []).some((observation) =>
    AI_OBSERVATION_FIELDS.includes(observation.field)
  );

  useEffect(() => {
    if (!wasMeetingEnded || hasAiSuggestions) {
      return;
    }

    const intervalId = setInterval(() => {
      attemptsRef.current += 1;
      if (attemptsRef.current > MAX_POLL_ATTEMPTS) {
        clearInterval(intervalId);
        return;
      }
      void refetch();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [wasMeetingEnded, hasAiSuggestions, refetch]);
};
