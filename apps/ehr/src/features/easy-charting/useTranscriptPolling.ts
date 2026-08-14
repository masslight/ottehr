import { captureException } from '@sentry/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AIChatDetails } from 'utils/lib/types/api/chart-data/chart-data.types';
import { useOystehrAPIClient } from '../visits/shared/hooks/useOystehrAPIClient';
import { hasNewTranscriptDocument, transcriptDocumentIds } from './transcript-docs';

const POLL_INTERVAL_MS = 12_000;
// Transcription runs asynchronously server-side and can take minutes — keep watching for ~5.
const POLL_WINDOW_MS = 5 * 60_000;

// After an ambient-scribe upload, the transcript DocumentReference is created asynchronously
// server-side; nothing on the easy-chart page would otherwise notice it until a full reload
// (unlike the in-person page, whose appointment-store refetch this page doesn't have). This hook
// polls the unscoped get-chart-data call (the only one that returns aiChat) until a transcript
// document that wasn't in the baseline snapshot appears, then hands the fresh aiChat to the page —
// the existing chips / prime-banner logic lights up through the normal chartData flow.
export function useTranscriptPolling({
  encounterId,
  aiChat,
  onNewAiChat,
}: {
  encounterId: string | undefined;
  aiChat: AIChatDetails | undefined;
  onNewAiChat: (aiChat: AIChatDetails) => void;
}): { transcriptPending: boolean; startTranscriptPolling: () => void } {
  const apiClient = useOystehrAPIClient();
  const [transcriptPending, setTranscriptPending] = useState(false);

  // Latest-value mirrors so start() and the interval callback never read stale props (they only
  // fire from event/async time, so assignment during render is safe).
  const aiChatRef = useRef(aiChat);
  aiChatRef.current = aiChat;
  const apiClientRef = useRef(apiClient);
  apiClientRef.current = apiClient;
  const onNewAiChatRef = useRef(onNewAiChat);
  onNewAiChatRef.current = onNewAiChat;

  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const deadlineRef = useRef(0);
  const baselineIdsRef = useRef<Set<string>>(new Set());
  const tickInFlightRef = useRef(false);

  const stop = useCallback((): void => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
    setTranscriptPending(false);
  }, []);

  // Cancel on unmount.
  useEffect(() => stop, [stop]);

  const startTranscriptPolling = useCallback((): void => {
    if (!encounterId) return;
    // Snapshot the transcripts we already know about — anything beyond these is "new". A second
    // recording while polling re-baselines and extends the window instead of stacking a loop.
    baselineIdsRef.current = transcriptDocumentIds(aiChatRef.current);
    deadlineRef.current = Date.now() + POLL_WINDOW_MS;
    setTranscriptPending(true);
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => {
      void (async (): Promise<void> => {
        if (tickInFlightRef.current) return;
        if (Date.now() > deadlineRef.current) {
          stop();
          return;
        }
        const client = apiClientRef.current;
        if (!client) return;
        tickInFlightRef.current = true;
        try {
          const fresh = await client.getChartData({ encounterId });
          if (fresh.aiChat && hasNewTranscriptDocument(fresh.aiChat, baselineIdsRef.current)) {
            onNewAiChatRef.current(fresh.aiChat);
            stop();
          }
        } catch (e) {
          // A transient fetch failure shouldn't end a minutes-long wait — report and keep polling.
          console.error('Transcript polling refetch failed:', e);
          captureException(e);
        } finally {
          tickInFlightRef.current = false;
        }
      })();
    }, POLL_INTERVAL_MS);
  }, [encounterId, stop]);

  return { transcriptPending, startTranscriptPolling };
}
