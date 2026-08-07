import { useEffect, useRef } from 'react';
import { audioRecordingActions } from '../stores/audioRecording.store';

interface UseStopAmbientScribeOnLeaveOptions {
  hostKey: string;
}

/**
 * Keeps an active recording alive across phone rotation (which changes neither the host route nor the
 * mount) while stopping and uploading it on real navigation away. On tab close/reload the flush is
 * best-effort — the async upload chain usually can't finish before the page unloads (see
 * flushActiveSession). Call once in each recorder host (the appointments page and the in-person layout).
 */
export function useStopAmbientScribeOnLeave({ hostKey }: UseStopAmbientScribeOnLeaveOptions): void {
  const hostKeyRef = useRef(hostKey);

  // Covers navigations that keep the host mounted but change identity (e.g. switching patients under
  // the in-person layout).
  useEffect(() => {
    if (hostKey !== hostKeyRef.current) {
      audioRecordingActions.flushActiveSession();
      hostKeyRef.current = hostKey;
    }
  }, [hostKey]);

  // Covers navigations that unmount the host (e.g. leaving the appointments page) and, best-effort, tab
  // close/reload — pagehide fires but the async upload usually won't complete before the page unloads.
  useEffect(() => {
    const flush = (): void => audioRecordingActions.flushActiveSession();
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);
}
