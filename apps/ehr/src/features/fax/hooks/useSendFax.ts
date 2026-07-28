import { useCallback, useState } from 'react';
import { FaxSendResult, GetFaxPacketPreviewOutput } from 'utils';
import { toSendFaxPacketInput } from '../model/faxRecipients';
import { FaxFormValues } from '../model/types';
import { useFaxPacketPreview } from './useFaxPacketPreview';
import { failedResults, useSendFaxPacket } from './useSendFaxPacket';

export interface UseSendFaxResult {
  isOpen: boolean;
  open: () => void;
  close: () => void;

  isLoadingPreview: boolean;
  previewError: boolean;
  preview?: GetFaxPacketPreviewOutput;

  isSending: boolean;
  /** Sends the packet, then closes the dialog. Rejects on transport failure (toast is shown by the mutation). */
  send: (values: FaxFormValues) => Promise<void>;

  /** Recipients the fax could not be delivered to. Non-empty means the result dialog is shown. */
  failures: FaxSendResult[];
  dismissFailures: () => void;
}

/**
 * Owns the Send Fax dialog lifecycle: open/close, the availability preview and the send mutation. Holds no
 * form state — the form lives in `SendFaxForm`, which mounts only once the preview has loaded and seeds
 * itself from it.
 */
export const useSendFax = (appointmentId: string | undefined): UseSendFaxResult => {
  const [isOpen, setIsOpen] = useState(false);
  const [failures, setFailures] = useState<FaxSendResult[]>([]);

  const preview = useFaxPacketPreview(appointmentId, isOpen);
  const sendMutation = useSendFaxPacket(appointmentId);

  const open = useCallback(() => {
    setFailures([]);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  const send = useCallback(
    async (values: FaxFormValues): Promise<void> => {
      if (!appointmentId || !preview.data) return;
      const input = toSendFaxPacketInput(appointmentId, values, preview.data.documents);
      // A rejected mutation throws here; the toast is in useSendFaxPacket.onError and the dialog stays open.
      const output = await sendMutation.mutateAsync(input);
      // A resolved mutation always closes the dialog; partial failures then surface in the result dialog.
      setFailures(failedResults(output));
      setIsOpen(false);
    },
    [appointmentId, preview.data, sendMutation]
  );

  return {
    isOpen,
    open,
    close,
    isLoadingPreview: preview.isLoading,
    previewError: preview.isError,
    preview: preview.data,
    isSending: sendMutation.isPending,
    send,
    failures,
    dismissFailures: useCallback(() => setFailures([]), []),
  };
};
