import { LoadingButton } from '@mui/lab';
import { Alert, Box, CircularProgress, Grid, Paper, Typography } from '@mui/material';
import { ReactElement, useEffect, useState } from 'react';
import { RichTextEditorField } from 'src/components/RichTextEditorField';
import PageContainer from 'src/layout/PageContainer';
import { useAdminGetSupportDialog, useAdminUpdateSupportDialog } from '../admin.queries';

export default function SupportDialogAdminPage(): ReactElement {
  const { data, isPending, isError, dataUpdatedAt } = useAdminGetSupportDialog();
  const { mutateAsync, isPending: isSubmitting } = useAdminUpdateSupportDialog();

  const [bodyHtml, setBodyHtml] = useState('');

  useEffect(() => {
    setBodyHtml(data?.bodyHtml ?? '');
  }, [data?.bodyHtml, dataUpdatedAt]);

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
              text with bold, italic, lists, headings, and links.
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
                  onChange={setBodyHtml}
                  placeholder="Write the support text patients will see…"
                  minHeight={320}
                  disabled={isSubmitting}
                />
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                  <LoadingButton
                    variant="contained"
                    loading={isSubmitting}
                    onClick={handleSave}
                    disabled={bodyHtml === (data?.bodyHtml ?? '')}
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
