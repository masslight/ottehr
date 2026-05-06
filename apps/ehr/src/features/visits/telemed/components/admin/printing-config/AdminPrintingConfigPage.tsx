import { Box, CircularProgress, Grid, Paper, Typography } from '@mui/material';
import { OystehrSdkError } from '@oystehr/sdk/dist/cjs/errors';
import { ReactElement, useCallback, useState } from 'react';
import PageContainer from 'src/layout/PageContainer';
import { APIError, PrintingConfig } from 'utils';
import { useAdminGetPrintingConfig, useAdminUpdatePrintingConfig } from '../admin.queries';
import AdminPrintingConfigForm from './AdminPrintingConfigForm';

export default function AdminPrintingConfigPage(): ReactElement {
  // for the moment we're just going to return the single form since we aren't supporting multiple printing configs currently
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<OystehrSdkError | APIError | undefined>(undefined);

  const {
    data, // athena todo: this should actually return the deviceId, which can be defined or not. That's how we will update it
    isPending,
    isError: isFetchDataError,
  } = useAdminGetPrintingConfig({ deviceId: undefined }); // labs todo: in the future, we might have multiple printing configs by location, and we'll actually be passing in a deviceId here for a given config
  const existingConfig = data?.config;
  const deviceId = data?.deviceId;
  console.log('>>>this is the device id from the get', deviceId);
  const configToRender = existingConfig ?? { mode: 'manual' };

  const { mutateAsync: updatePrintingConfigMutateAsync } = useAdminUpdatePrintingConfig('athena todo id');

  const handleSubmit = useCallback(
    async (formData: PrintingConfig): Promise<void> => {
      console.log('formData from handleSubmit', formData);
      setIsSubmitting(true);

      try {
        await updatePrintingConfigMutateAsync({ config: formData, deviceId });
        setSubmitError(undefined);
      } catch (e: unknown) {
        console.error('updating config failed', e);
        setSubmitError(e as OystehrSdkError | APIError);
      } finally {
        setIsSubmitting(false);
      }

      return;
    },
    [updatePrintingConfigMutateAsync, deviceId]
  );

  return (
    <PageContainer tabTitle={'Update Printing Config'} showEnvFooter={false}>
      <Grid container direction="row" alignItems="center" justifyContent="center">
        <Grid item maxWidth={'584px'} width={'100%'}>
          <Paper sx={{ padding: 3, marginTop: 2, marginBottom: 2 }}>
            {isPending ? (
              <Box display="flex" justifyContent="center" alignItems="center" py={3}>
                <CircularProgress />
              </Box>
            ) : isFetchDataError ? (
              <Typography>An error has occurred</Typography>
            ) : (
              <AdminPrintingConfigForm
                formMode="edit"
                defaultValues={configToRender}
                onSubmit={handleSubmit}
                isSubmitting={isSubmitting}
                submitError={submitError}
              />
            )}
          </Paper>
        </Grid>
      </Grid>
    </PageContainer>
  );
}
