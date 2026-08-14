import { useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FaxPacketSource,
  FaxRecipientResult,
  GetFaxPacketPreviewOutput,
  GetFaxPacketStatusOutput,
} from 'utils/lib/types/api/fax.types';
import { FAX_STATUS_POLL_TIMEOUT_MS, faxHistoryQueryKey, faxStatusTimeoutMessage } from '../model/faxPolling';
import { toSendFaxPacketInput } from '../model/faxRecipients';
import { FaxFormValues } from '../model/types';
import { useFaxPacketPreview } from './useFaxPacketPreview';
import { useFaxPacketStatuses } from './useFaxPacketStatus';
import { useSendFaxPacket } from './useSendFaxPacket';

export interface UseSendFaxResult {
  isOpen: boolean;
  open: () => void;
  close: () => void;

  isLoadingPreview: boolean;
  previewError: boolean;
  preview?: GetFaxPacketPreviewOutput;

  /** True while the currently open dialog's submission is still in flight. */
  isSending: boolean;
  /** Queues the send; the dialog stays open showing a sending state until that job resolves. */
  send: (values: FaxFormValues) => Promise<void>;

  /** Recipients any queued send could not be delivered to. Non-empty means the result dialog is shown. */
  failures: FaxRecipientResult[];
  dismissFailures: () => void;
}

export const useSendFax = (source: FaxPacketSource | undefined): UseSendFaxResult => {
  // Only a single-visit packet has a document checklist to preview; the other sources send a fixed set.
  const previewAppointmentId = source?.type === 'visit' ? source.appointmentId : undefined;
  const [isOpen, setIsOpen] = useState(false);
  // Every queued send is tracked independently, so sending a second fax for the same visit never abandons
  // the first. Jobs stay here (and keep polling) regardless of whether the dialog is open.
  const [activeTaskIds, setActiveTaskIds] = useState<string[]>([]);
  // The one job the open dialog is waiting on, for its spinner and auto-close. Background jobs don't set it.
  const [pendingTaskId, setPendingTaskId] = useState<string | undefined>(undefined);
  const [failures, setFailures] = useState<FaxRecipientResult[]>([]);

  const handled = useRef<Set<string>>(new Set());
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const taskSources = useRef<Map<string, FaxPacketSource>>(new Map());
  const pendingTaskIdRef = useRef<string | undefined>(undefined);
  pendingTaskIdRef.current = pendingTaskId;

  const queryClient = useQueryClient();
  const preview = useFaxPacketPreview(previewAppointmentId, isOpen);
  const sendMutation = useSendFaxPacket();
  const statuses = useFaxPacketStatuses(activeTaskIds);

  // Resolve a job exactly once: stop tracking it, drop the dialog if it was waiting on it, and refresh the
  // visit's fax history. `handled` guards against a lingering status re-triggering this before the id is
  // dropped from `activeTaskIds`.
  const finishJob = useCallback(
    (taskId: string): void => {
      const timer = timers.current.get(taskId);
      if (timer) {
        clearTimeout(timer);
        timers.current.delete(taskId);
      }
      if (pendingTaskIdRef.current === taskId) {
        setPendingTaskId(undefined);
        setIsOpen(false);
      }
      setActiveTaskIds((prev) => prev.filter((id) => id !== taskId));
      const taskSource = taskSources.current.get(taskId);
      taskSources.current.delete(taskId);
      if (taskSource) void queryClient.invalidateQueries({ queryKey: faxHistoryQueryKey(taskSource) });
    },
    [queryClient]
  );

  const open = useCallback(() => {
    // A fresh compose dialog: it isn't waiting on any prior job, and any earlier failure dialog is cleared.
    // In-flight background jobs are intentionally left running.
    setFailures([]);
    setPendingTaskId(undefined);
    setIsOpen(true);
  }, []);

  // Closing leaves the job running in the background; it will resolve to a snackbar / failure dialog.
  const close = useCallback(() => {
    setPendingTaskId(undefined);
    setIsOpen(false);
  }, []);

  const send = useCallback(
    async (values: FaxFormValues): Promise<void> => {
      if (!source) return;
      const { taskId } = await sendMutation.mutateAsync(toSendFaxPacketInput(source, values));
      taskSources.current.set(taskId, source);

      timers.current.set(
        taskId,
        setTimeout(() => {
          if (handled.current.has(taskId)) return;
          handled.current.add(taskId);
          enqueueSnackbar(faxStatusTimeoutMessage(source), { variant: 'warning' });
          finishJob(taskId);
        }, FAX_STATUS_POLL_TIMEOUT_MS)
      );

      setActiveTaskIds((prev) => [...prev, taskId]);
      setPendingTaskId(taskId);
    },
    [source, sendMutation, finishJob]
  );

  // React to each polled Task reaching a terminal state.
  useEffect(() => {
    for (const { taskId, data } of statuses) {
      if (!data || data.jobStatus === 'pending' || handled.current.has(taskId)) continue;
      handled.current.add(taskId);
      resolveTerminal(data, setFailures);
      finishJob(taskId);
    }
  }, [statuses, finishJob]);

  // Clear any outstanding timeout timers on unmount.
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => clearTimeout(timer));
  }, []);

  return {
    isOpen,
    open,
    close,
    isLoadingPreview: Boolean(previewAppointmentId) && preview.isLoading,
    previewError: Boolean(previewAppointmentId) && preview.isError,
    preview: preview.data,
    isSending: sendMutation.isPending || Boolean(pendingTaskId),
    send,
    failures,
    dismissFailures: useCallback(() => setFailures([]), []),
  };
};

/** Surfaces a job's outcome: a snackbar for a whole-job failure or a clean success, and appends any
 * per-recipient failures to the result dialog's list (so concurrent jobs' failures accumulate). */
function resolveTerminal(
  data: GetFaxPacketStatusOutput,
  setFailures: (updater: (prev: FaxRecipientResult[]) => FaxRecipientResult[]) => void
): void {
  if (data.jobStatus === 'failed') {
    enqueueSnackbar('The fax could not be processed. Please try again.', { variant: 'error' });
    return;
  }

  const failed = data.recipients.filter((recipient) => recipient.status === 'failed');
  if (failed.length === 0) {
    const count = data.recipients.length;
    enqueueSnackbar(`Fax sent to ${count} recipient${count === 1 ? '' : 's'}`, { variant: 'success' });
    return;
  }

  setFailures((prev) => [...prev, ...failed]);
}
