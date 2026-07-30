import { useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FaxRecipientResult, GetFaxPacketPreviewOutput } from 'utils';
import { toSendFaxPacketInput } from '../model/faxRecipients';
import { FaxFormValues } from '../model/types';
import { useFaxPacketPreview } from './useFaxPacketPreview';
import { useFaxPacketStatus } from './useFaxPacketStatus';
import { useSendFaxPacket } from './useSendFaxPacket';

export interface UseSendFaxResult {
  isOpen: boolean;
  open: () => void;
  close: () => void;

  isLoadingPreview: boolean;
  previewError: boolean;
  preview?: GetFaxPacketPreviewOutput;

  /** True from submit until the queued Task reaches a terminal state. */
  isSending: boolean;
  /** Queues the send; the dialog stays open showing a sending state until the poll resolves. */
  send: (values: FaxFormValues) => Promise<void>;

  /** Recipients the fax could not be delivered to. Non-empty means the result dialog is shown. */
  failures: FaxRecipientResult[];
  dismissFailures: () => void;
}

export const useSendFax = (appointmentId: string | undefined): UseSendFaxResult => {
  const [isOpen, setIsOpen] = useState(false);
  const [taskId, setTaskId] = useState<string | undefined>(undefined);
  const [failures, setFailures] = useState<FaxRecipientResult[]>([]);
  const handledTaskId = useRef<string | undefined>(undefined);

  const queryClient = useQueryClient();
  const preview = useFaxPacketPreview(appointmentId, isOpen);
  const sendMutation = useSendFaxPacket();
  const status = useFaxPacketStatus(taskId);

  const open = useCallback(() => {
    setFailures([]);
    setTaskId(undefined);
    handledTaskId.current = undefined;
    setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  const send = useCallback(
    async (values: FaxFormValues): Promise<void> => {
      if (!appointmentId) return;
      const output = await sendMutation.mutateAsync(toSendFaxPacketInput(appointmentId, values));
      handledTaskId.current = undefined;
      setTaskId(output.taskId);
    },
    [appointmentId, sendMutation]
  );

  // React to the polled Task reaching a terminal state. Guarded by
  // handledTaskId so each queued job is resolved exactly once.
  useEffect(() => {
    const data = status.data;

    if (!taskId || !data || data.jobStatus === 'pending') return;

    if (handledTaskId.current === taskId) return;

    handledTaskId.current = taskId;

    if (data.jobStatus === 'failed') {
      enqueueSnackbar('The fax could not be processed. Please try again.', { variant: 'error' });
      setIsOpen(false);
    } else {
      const failed = data.recipients.filter((recipient) => recipient.status === 'failed');

      if (failed.length === 0) {
        const count = data.recipients.length;
        enqueueSnackbar(`Fax sent to ${count} recipient${count === 1 ? '' : 's'}`, { variant: 'success' });
      }

      setFailures(failed);
      setIsOpen(false);
    }

    setTaskId(undefined);
    void queryClient.invalidateQueries({ queryKey: ['get-visit-fax-history', appointmentId] });
  }, [status.data, taskId, appointmentId, queryClient]);

  return {
    isOpen,
    open,
    close,
    isLoadingPreview: preview.isLoading,
    previewError: preview.isError,
    preview: preview.data,
    isSending: sendMutation.isPending || Boolean(taskId),
    send,
    failures,
    dismissFailures: useCallback(() => setFailures([]), []),
  };
};
