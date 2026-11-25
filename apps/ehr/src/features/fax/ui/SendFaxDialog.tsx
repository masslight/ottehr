import { Alert, Box, CircularProgress } from '@mui/material';
import { FC, useId, useState } from 'react';
import { AppDialog } from 'src/components/dialogs/AppDialog';
import { dataTestIds } from 'src/constants/data-test-ids';
import { UseSendFaxResult } from '../hooks/useSendFax';
import { hasNothingToSend } from '../model/faxDocuments';
import { FaxVisitOption } from '../model/types';
import { FaxSendResultDialog } from './FaxSendResultDialog';
import { SendFaxForm } from './SendFaxForm';

interface SendFaxDialogProps {
  controller: UseSendFaxResult;
  /** Names what is being faxed, e.g. "Fax Medical Record". Defaults to the plain send title. */
  title?: string;
  /** When given, the user picks which of these visits to fax. */
  visits?: FaxVisitOption[];
}

/** Dialog shell: shows the loading/error/empty states, and mounts the form once the preview has loaded. */
export const SendFaxDialog: FC<SendFaxDialogProps> = ({ controller, title = 'Send Fax', visits }) => {
  const { preview } = controller;
  const nothingToSend = Boolean(preview) && hasNothingToSend(preview!.documents);
  // Sources without a document checklist have nothing to wait for, so the form mounts immediately.
  const showForm = preview ? !nothingToSend : !controller.isLoadingPreview && !controller.previewError;

  const formId = useId();
  const [canSend, setCanSend] = useState(false);

  return (
    <>
      <AppDialog
        variant="form"
        size="s"
        open={controller.isOpen}
        onClose={controller.close}
        title={title}
        data-testid={dataTestIds.faxDialog.root}
        // The buttons belong to the form, so the loading / error / empty states have none, only the ✕.
        dismiss={showForm ? { 'data-testid': dataTestIds.faxDialog.cancelButton } : undefined}
        primary={
          showForm
            ? {
                label: 'Send Fax',
                onClick: () => (document.getElementById(formId) as HTMLFormElement | null)?.requestSubmit(),
                // Not `loading`: that would lock the dialog, and closing it while the fax is still being
                // sent is allowed (the job carries on in the background).
                disabled: !canSend || controller.isSending,
                startIcon: controller.isSending ? <CircularProgress size={16} color="inherit" /> : undefined,
                'data-testid': dataTestIds.faxDialog.sendButton,
              }
            : undefined
        }
      >
        {controller.isLoadingPreview && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {controller.previewError && (
          <Alert severity="error">Could not load the documents for this visit. Close the dialog and try again.</Alert>
        )}

        {preview && nothingToSend && <Alert severity="info">There are no documents to fax for this visit yet.</Alert>}

        {showForm && (
          <SendFaxForm
            preview={preview}
            senderFaxNumber={controller.senderFaxNumber}
            visits={visits}
            isSending={controller.isSending}
            onSubmit={controller.send}
            formId={formId}
            onCanSendChange={setCanSend}
          />
        )}
      </AppDialog>

      <FaxSendResultDialog failures={controller.failures} onClose={controller.dismissFailures} />
    </>
  );
};
