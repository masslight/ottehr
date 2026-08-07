import CloseIcon from '@mui/icons-material/Close';
import { Alert, Box, CircularProgress, Dialog, DialogContent, DialogTitle, IconButton, useTheme } from '@mui/material';
import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { UseSendFaxResult } from '../hooks/useSendFax';
import { hasNothingToSend } from '../model/faxDocuments';
import { FaxSendResultDialog } from './FaxSendResultDialog';
import { SendFaxForm } from './SendFaxForm';

interface SendFaxDialogProps {
  controller: UseSendFaxResult;
}

/** Dialog shell: shows the loading/error/empty states, and mounts the form once the preview has loaded. */
export const SendFaxDialog: FC<SendFaxDialogProps> = ({ controller }) => {
  const theme = useTheme();
  const { preview } = controller;
  const nothingToSend = Boolean(preview) && hasNothingToSend(preview!.documents);

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
          Send Fax
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

        {preview && !nothingToSend && (
          <SendFaxForm
            preview={preview}
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
