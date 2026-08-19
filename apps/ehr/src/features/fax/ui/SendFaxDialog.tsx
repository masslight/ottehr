import CloseIcon from '@mui/icons-material/Close';
import { Alert, Box, CircularProgress, Dialog, DialogContent, DialogTitle, IconButton, useTheme } from '@mui/material';
import { FC } from 'react';
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
  const theme = useTheme();
  const { preview } = controller;
  const nothingToSend = Boolean(preview) && hasNothingToSend(preview!.documents);
  // Sources without a document checklist have nothing to wait for, so the form mounts immediately.
  const showForm = preview ? !nothingToSend : !controller.isLoadingPreview && !controller.previewError;

  return (
    <>
      <Dialog
        open={controller.isOpen}
        onClose={controller.close}
        maxWidth="sm"
        fullWidth
        data-testid={dataTestIds.faxDialog.root}
      >
        <DialogTitle sx={{ color: theme.palette.primary.dark, fontWeight: 600, fontSize: '24px' }}>
          {title}
          <IconButton aria-label="Close" onClick={controller.close} sx={{ position: 'absolute', right: 8, top: 8 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        {controller.isLoadingPreview && (
          <DialogContent>
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          </DialogContent>
        )}

        {controller.previewError && (
          <DialogContent>
            <Alert severity="error">Could not load the documents for this visit. Close the dialog and try again.</Alert>
          </DialogContent>
        )}

        {preview && nothingToSend && (
          <DialogContent>
            <Alert severity="info">There are no documents to fax for this visit yet.</Alert>
          </DialogContent>
        )}

        {showForm && (
          <SendFaxForm
            preview={preview}
            visits={visits}
            isSending={controller.isSending}
            onSubmit={controller.send}
            onCancel={controller.close}
          />
        )}
      </Dialog>

      <FaxSendResultDialog failures={controller.failures} onClose={controller.dismissFailures} />
    </>
  );
};
