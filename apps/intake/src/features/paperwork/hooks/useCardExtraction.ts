import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { CardExtractionFieldsFor, CardExtractionStatus, ExtractableCardDocumentFileType } from 'utils';
import { ottehrApi } from '../../../api';
import { useUCZambdaClient } from '../../../hooks/useUCZambdaClient';

// The OCR extraction lands on the card DocumentReference asynchronously, typically within a few
// seconds of upload — poll every 1.5s, giving up after 20s (a late extraction is still picked up
// on the next trigger change or remount).
const POLL_INTERVAL_MS = 1500;
const POLL_CAP_MS = 20_000;

export interface UseCardExtractionOptions {
  /**
   * Caller-provided token identifying the CURRENT image for this card slot in this session —
   * e.g. the uploaded z3 url or an upload counter. Changing it restarts polling for the new
   * image; null/undefined disables the hook entirely (no image uploaded yet).
   */
  trigger: string | number | null | undefined;
}

export interface UseCardExtractionResult<T extends ExtractableCardDocumentFileType> {
  /**
   * The extraction status from get-card-extraction, or null before the first response
   * (hook disabled, or the first fetch is still in flight):
   * - 'pending' — OCR still in flight (or the poll cap expired while pending)
   * - 'ready' — `fields` is populated
   * - 'not-a-card' / 'unreadable' — terminal; nothing to auto-fill
   */
  status: CardExtractionStatus | null;
  /** The parsed extraction fields for this card slot when status === 'ready', else null. */
  fields: CardExtractionFieldsFor<T> | null;
  /** True while the hook is still fetching / re-polling (no terminal status yet, cap not hit). */
  isPolling: boolean;
}

/**
 * Polls the tokenless get-card-extraction zambda for the OCR extraction of one card image slot
 * of the appointment, every 1.5s while the extraction is 'pending', stopping on any terminal
 * status ('ready' / 'not-a-card' / 'unreadable') or after a 20s cap. Read-only — OCR is never
 * invoked here; the extract-* subscriptions already ran (or will run) on the DocumentReference
 * that createCardDocumentReference made at upload time.
 *
 * The query is keyed to (appointmentID, cardType, trigger): pass a new `trigger` when a NEW
 * image finishes uploading this session to re-poll for that image's extraction.
 */
export const useCardExtraction = <T extends ExtractableCardDocumentFileType>(
  appointmentID: string | undefined,
  cardType: T,
  { trigger }: UseCardExtractionOptions
): UseCardExtractionResult<T> => {
  const zambdaClient = useUCZambdaClient({ tokenless: true });
  const enabled = Boolean(zambdaClient && appointmentID && trigger != null);

  // the poll cap clock restarts whenever the polled image (appointment/slot/trigger) changes
  const pollKey = `${appointmentID}|${cardType}|${String(trigger)}`;
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    setTimedOut(false);
    if (!enabled) return;
    const timer = setTimeout(() => setTimedOut(true), POLL_CAP_MS);
    return () => clearTimeout(timer);
  }, [pollKey, enabled]);

  const { data } = useQuery({
    queryKey: ['card-extraction', appointmentID, cardType, trigger],
    queryFn: () => ottehrApi.getCardExtraction({ appointmentID: appointmentID!, cardType }, zambdaClient!),
    enabled,
    // re-poll only while the extraction is still pending and the cap has not expired; the
    // timedOut state flip re-renders, so the interval re-evaluates and shuts off
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status && status !== 'pending') return false;
      if (timedOut) return false;
      return POLL_INTERVAL_MS;
    },
    refetchOnWindowFocus: false,
  });

  const status: CardExtractionStatus | null = data?.status ?? null;
  const isTerminal = status !== null && status !== 'pending';
  const fields = status === 'ready' ? (data?.fields as CardExtractionFieldsFor<T> | undefined) ?? null : null;

  return {
    status,
    fields,
    isPolling: enabled && !isTerminal && !timedOut,
  };
};
