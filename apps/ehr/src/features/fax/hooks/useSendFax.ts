import { useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { formatPhoneNumberDisplay } from 'utils/lib/helpers/helpers';
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
import { useFaxSenderFaxNumber } from './useFaxSender';
import { useSendFaxPacket } from './useSendFaxPacket';

export interface UseSendFaxResult {
  isOpen: boolean;
  open: () => void;
  close: () => void;

  isLoadingPreview: boolean;
  previewError: boolean;
  preview?: GetFaxPacketPreviewOutput;
  /** The number the packet is sent from, so the user can see which number the recipient will call back. */
  senderFaxNumber?: string;

  /** True while the send is being queued. */
  isSending: boolean;
  /** Queues the send and closes the dialog; the outcome arrives later as a snackbar. */
  send: (values: FaxFormValues) => Promise<void>;
}

export const useSendFax = (source: FaxPacketSource | undefined): UseSendFaxResult => {
  // Only a single-visit packet has a document checklist to preview; the other sources send a fixed set.
  const previewAppointmentId = source?.type === 'visit' ? source.appointmentId : undefined;
  const [isOpen, setIsOpen] = useState(false);
  // Every queued send is tracked independently, so sending a second packet for the same visit never abandons
  // the first. Jobs keep polling in the background after the dialog closes.
  const [activeTaskIds, setActiveTaskIds] = useState<string[]>([]);

  const handled = useRef<Set<string>>(new Set());
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const taskSources = useRef<Map<string, FaxPacketSource>>(new Map());

  const queryClient = useQueryClient();
  const preview = useFaxPacketPreview(previewAppointmentId, isOpen);
  // Only for the preview-less sources: a visit preview already carries the sender's number, so asking
  // for it separately would be a second request for a value this dialog is about to receive anyway.
  const sender = useFaxSenderFaxNumber(isOpen && !previewAppointmentId);
  const sendMutation = useSendFaxPacket();
  const statuses = useFaxPacketStatuses(activeTaskIds);

  // Resolve a job exactly once: stop tracking it and refresh the visit's fax history. `handled` guards against a lingering status re-triggering this before the id is
  // dropped from `activeTaskIds`.
  const finishJob = useCallback(
    (taskId: string): void => {
      const timer = timers.current.get(taskId);
      if (timer) {
        clearTimeout(timer);
        timers.current.delete(taskId);
      }
      setActiveTaskIds((prev) => prev.filter((id) => id !== taskId));
      const taskSource = taskSources.current.get(taskId);
      taskSources.current.delete(taskId);
      if (taskSource) void queryClient.invalidateQueries({ queryKey: faxHistoryQueryKey(taskSource) });
    },
    [queryClient]
  );

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

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
      setIsOpen(false);
      enqueueSnackbar('Sending documents…', { variant: 'info' });
    },
    [source, sendMutation, finishJob]
  );

  // React to each polled Task reaching a terminal state.
  useEffect(() => {
    for (const { taskId, data } of statuses) {
      if (!data || data.jobStatus === 'pending' || handled.current.has(taskId)) continue;
      handled.current.add(taskId);
      resolveTerminal(data);
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
    senderFaxNumber: preview.data?.senderFaxNumber ?? sender.data ?? undefined,
    isSending: sendMutation.isPending,
    send,
  };
};

/** Surfaces a job's outcome as a snackbar: a whole-job failure, the recipients it could not reach, or success. */
function resolveTerminal(data: GetFaxPacketStatusOutput): void {
  if (data.jobStatus === 'failed') {
    enqueueSnackbar('The documents could not be sent. Please try again.', { variant: 'error' });
    return;
  }

  const failed = data.recipients.filter((recipient) => recipient.status === 'failed');
  if (failed.length === 0) {
    const count = data.recipients.length;
    enqueueSnackbar(`Documents sent to ${count} recipient${count === 1 ? '' : 's'}`, { variant: 'success' });
    return;
  }

  enqueueSnackbar(`Could not send to ${failed.map(describeRecipient).join(', ')}`, {
    variant: 'error',
    persist: true,
  });
}

const describeRecipient = (recipient: FaxRecipientResult): string => {
  const address = recipient.email ?? (recipient.faxNumber ? formatPhoneNumberDisplay(recipient.faxNumber) : '');
  const name = recipient.name || 'Unnamed recipient';
  return address ? `${name} (${address})` : name;
};
