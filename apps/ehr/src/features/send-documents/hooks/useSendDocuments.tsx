import { Button } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { closeSnackbar, enqueueSnackbar } from 'notistack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { formatPhoneNumberDisplay } from 'utils/lib/helpers/helpers';
import {
  DOCUMENT_PACKET_MAX_BYTES,
  DocumentPacketRecipientResult,
  DocumentPacketSource,
  GetDocumentPacketPreviewOutput,
  GetDocumentPacketStatusOutput,
} from 'utils/lib/types/api/document-packet.types';
import { faxHistoryQueryKey, PACKET_STATUS_POLL_TIMEOUT_MS, packetStatusTimeoutMessage } from '../model/polling';
import { toSendDocumentPacketInput } from '../model/recipients';
import { SendDocumentsFormValues } from '../model/types';
import { useDocumentPacketPreview } from './useDocumentPacketPreview';
import { useDocumentPacketStatuses } from './useDocumentPacketStatus';
import { useFaxSenderFaxNumber } from './useFaxSender';
import { useSendDocumentPacket } from './useSendDocumentPacket';

export interface UseSendDocumentsResult {
  isOpen: boolean;
  open: () => void;
  close: () => void;

  isLoadingPreview: boolean;
  previewError: boolean;
  preview?: GetDocumentPacketPreviewOutput;
  /** The number the packet is sent from, so the user can see which number the recipient will call back. */
  senderFaxNumber?: string;

  /** True while the send is being queued. */
  isSending: boolean;
  /** Queues the send and closes the dialog; the outcome arrives later as a snackbar. */
  send: (values: SendDocumentsFormValues) => Promise<void>;
}

export const useSendDocuments = (source: DocumentPacketSource | undefined): UseSendDocumentsResult => {
  // Only a single-visit packet has a document checklist to preview; the other sources send a fixed set.
  const previewAppointmentId = source?.type === 'visit' ? source.appointmentId : undefined;
  const [isOpen, setIsOpen] = useState(false);
  // Every queued send is tracked independently, so sending a second packet for the same visit never abandons
  // the first. Jobs keep polling in the background after the dialog closes.
  const [activeTaskIds, setActiveTaskIds] = useState<string[]>([]);

  const handled = useRef<Set<string>>(new Set());
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const taskSources = useRef<Map<string, DocumentPacketSource>>(new Map());

  const queryClient = useQueryClient();
  const preview = useDocumentPacketPreview(previewAppointmentId, isOpen);
  // Only for the preview-less sources: a visit preview already carries the sender's number, so asking
  // for it separately would be a second request for a value this dialog is about to receive anyway.
  const sender = useFaxSenderFaxNumber(isOpen && !previewAppointmentId);
  const sendMutation = useSendDocumentPacket();
  const statuses = useDocumentPacketStatuses(activeTaskIds);

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
    async (values: SendDocumentsFormValues): Promise<void> => {
      if (!source) return;
      const { taskId } = await sendMutation.mutateAsync(toSendDocumentPacketInput(source, values));
      taskSources.current.set(taskId, source);

      timers.current.set(
        taskId,
        setTimeout(() => {
          if (handled.current.has(taskId)) return;
          handled.current.add(taskId);
          enqueueSnackbar(packetStatusTimeoutMessage(source), { variant: 'warning' });
          finishJob(taskId);
        }, PACKET_STATUS_POLL_TIMEOUT_MS)
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
function resolveTerminal(data: GetDocumentPacketStatusOutput): void {
  if (data.jobStatus === 'failed') {
    const message =
      data.failureReason === 'too-large'
        ? `The documents exceed the maximum size of ${DOCUMENT_PACKET_MAX_BYTES / (1024 * 1024)} MB. ` +
          'Please send fewer documents or reduce their size and try again.'
        : 'The documents could not be sent. Please try again.';
    enqueueSnackbar(message, { variant: 'error' });
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
    action: (snackbarId) => (
      <Button color="inherit" size="small" onClick={() => closeSnackbar(snackbarId)}>
        Dismiss
      </Button>
    ),
  });
}

const describeRecipient = (recipient: DocumentPacketRecipientResult): string => {
  const address = recipient.email ?? (recipient.faxNumber ? formatPhoneNumberDisplay(recipient.faxNumber) : '');
  const name = recipient.name || 'Unnamed recipient';
  return address ? `${name} (${address})` : name;
};
