import { LoadingButton } from '@mui/lab';
import { Alert, Box, CircularProgress, Grid, Paper, Typography } from '@mui/material';
import { ReactElement, useEffect, useState } from 'react';
import { RichTextEditorField } from 'src/components/RichTextEditorField';
import PageContainer from 'src/layout/PageContainer';
import { useAdminGetSupportDialog, useAdminUpdateSupportDialog } from '../admin.queries';

export default function SupportDialogAdminPage(): ReactElement {
  const { data, isPending, isError } = useAdminGetSupportDialog();
  const { mutateAsync, isPending: isSubmitting } = useAdminUpdateSupportDialog();

  const [editedBodyHtml, setEditedBodyHtml] = useState<string | undefined>(undefined);

  // Sync from the server only when the saved content actually changes (e.g. after a save).
  // A background refetch (e.g. tabbing back into the window) that returns identical content
  // must NOT clobber the user's unsaved edits.
  useEffect(() => {
    setEditedBodyHtml(undefined);
  }, [data?.bodyHtml]);

  const bodyHtml = editedBodyHtml ?? data?.bodyHtml ?? '';
  const savedBodyHtml = data?.bodyHtml ?? '';

  const handleSave = async (): Promise<void> => {
    await mutateAsync({ bodyHtml });
  };

  return (
    <PageContainer tabTitle="Support Dialog Configuration" showEnvFooter={false}>
      <Grid container direction="row" alignItems="center" justifyContent="center">
        <Grid item maxWidth="800px" width="100%">
          <Paper sx={{ padding: 3, marginTop: 2, marginBottom: 2 }}>
            <Typography variant="h5" sx={{ mb: 1 }}>
              Patient Support Dialog
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              This text is shown to patients in the intake app when they click "Contact support". You can format the
              text with bold, italic, lists, and headings.
            </Typography>

            {isPending ? (
              <Box display="flex" justifyContent="center" alignItems="center" py={3}>
                <CircularProgress />
              </Box>
            ) : isError ? (
              <Alert severity="error">Failed to load the current support dialog content.</Alert>
            ) : (
              <>
                <RichTextEditorField
                  value={bodyHtml}
                  onChange={setEditedBodyHtml}
                  placeholder="Write the support text patients will see…"
                  minHeight={320}
                  disabled={isSubmitting}
                />
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                  <LoadingButton
                    variant="contained"
                    loading={isSubmitting}
                    onClick={handleSave}
                    disabled={bodyHtml === savedBodyHtml}
                  >
                    Save
                  </LoadingButton>
                </Box>
              </>
            )}
          </Paper>
        </Grid>
      </Grid>
    </PageContainer>
  );
}
