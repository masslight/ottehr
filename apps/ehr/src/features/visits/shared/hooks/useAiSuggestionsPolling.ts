import { useEffect, useRef } from 'react';
import { getSelectors } from 'utils/lib/store';
import { AiObservationField } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { ObservationDTO } from 'utils/lib/types/data/screening-questions/types';
import { useVideoCallStore } from '../../telemed/state/video-call/video-call.store';
import { useChartSection } from './useChartSection';

const POLL_INTERVAL_MS = 30_000;
const MAX_POLL_ATTEMPTS = 20; // ~10 minutes

const AI_OBSERVATION_FIELDS = Object.values(AiObservationField) as string[];

const countAiSuggestions = (observations: ObservationDTO[] | undefined): number =>
  (observations ?? []).filter((observation) => AI_OBSERVATION_FIELDS.includes(observation.field)).length;

// After the provider ends a telemed call (oystehr.telemed.endMeeting), the recording pipeline transcribes
// the audio and creates AI suggestion Observations within a few minutes. Poll for them until they appear
// so suggestions show up without a manual page reload. A visit can have multiple calls, so we re-poll on
// every call end (endedCallCount) and stop once this call's suggestions land (count grows past the baseline)
// rather than keying on "any suggestions exist" — otherwise a later call would never be polled for.
//
// Each tick re-reads only the aiChat section; every screen that shows the suggestions reads them from
// that same cache entry, so nothing else needs refetching once they have arrived.
export const useAiSuggestionsPolling = (): void => {
  const { endedCallCount } = getSelectors(useVideoCallStore, ['endedCallCount']);
  const { data: aiChat, refetch: refetchAiChat } = useChartSection('aiChat', { enabled: false });

  const aiSuggestionCount = countAiSuggestions(aiChat?.observations);
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
    let inFlight = false;
    let stopped = false;
    const intervalId = setInterval(async () => {
      // One request at a time: a slow response skips ticks instead of stacking requests.
      if (inFlight) {
        return;
      }
      attempts += 1;
      if (attempts > MAX_POLL_ATTEMPTS) {
        stopped = true;
        clearInterval(intervalId);
        return;
      }
      inFlight = true;
      try {
        const result = await refetchAiChat();
        if (stopped) {
          return;
        }
        if (countAiSuggestions(result.data?.observations) > baseline) {
          stopped = true;
          clearInterval(intervalId);
        }
      } finally {
        inFlight = false;
      }
    }, POLL_INTERVAL_MS);

    return () => {
      stopped = true;
      clearInterval(intervalId);
    };
  }, [endedCallCount, refetchAiChat]);
};
