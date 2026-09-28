import { RefObject, useCallback, useEffect, useRef } from 'react';
import { lastSeenMessageIndex } from './employee-chat.utils';

export const SEEN_DWELL_MS = 1000;

function isAttending(): boolean {
  return document.visibilityState === 'visible' && document.hasFocus();
}

export function useSeenMessages(
  containerRef: RefObject<HTMLElement | null>,
  onSeen: (index: number) => void,
  enabledRef: RefObject<boolean>
): () => void {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const cancel = useCallback((): void => {
    clearTimeout(timer.current);
    timer.current = undefined;
  }, []);

  const evaluate = useCallback((): void => {
    timer.current = undefined;
    const container = containerRef.current;
    if (!container || !enabledRef.current || !isAttending()) return;
    const viewport = container.getBoundingClientRect();
    if (viewport.height === 0) return;
    const messages = Array.from(container.querySelectorAll<HTMLElement>('[data-message-index]'), (element) => ({
      index: Number(element.dataset.messageIndex),
      bottom: element.getBoundingClientRect().bottom,
    }));
    const index = lastSeenMessageIndex(viewport.bottom, messages);
    if (index !== undefined) onSeen(index);
  }, [containerRef, enabledRef, onSeen]);

  const schedule = useCallback((): void => {
    cancel();
    if (!enabledRef.current || !isAttending()) return;
    timer.current = setTimeout(evaluate, SEEN_DWELL_MS);
  }, [cancel, enabledRef, evaluate]);

  useEffect(() => {
    const handleVisibility = (): void => (document.visibilityState === 'visible' ? schedule() : cancel());
    window.addEventListener('focus', schedule);
    window.addEventListener('blur', cancel);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      cancel();
      window.removeEventListener('focus', schedule);
      window.removeEventListener('blur', cancel);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [schedule, cancel]);

  return schedule;
}
