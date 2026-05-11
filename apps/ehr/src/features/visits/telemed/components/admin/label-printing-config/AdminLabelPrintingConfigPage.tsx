import { Box, CircularProgress, Grid, Paper, Typography } from '@mui/material';
import { OystehrSdkError } from '@oystehr/sdk/dist/cjs/errors';
import { ReactElement, useCallback, useState } from 'react';
import PageContainer from 'src/layout/PageContainer';
import { APIError, LabelPrintingConfig } from 'utils';
import { useAdminGetLabelPrintingConfig, useAdminUpdateLabelPrintingConfig } from '../admin.queries';
import AdminLabelPrintingConfigForm from './AdminLabelPrintingConfigForm';

export default function AdminPrintingConfigPage(): ReactElement {
  // for the moment we're just going to return the single form since we aren't supporting multiple printing configs currently
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<OystehrSdkError | APIError | undefined>(undefined);

  const {
    data, // the data comes back with the detected deviceId for the printing config
    isPending,
    isError: isFetchDataError,
  } = useAdminGetLabelPrintingConfig({ deviceId: undefined }); // labs todo: in the future, we might have multiple printing configs by location, and we'll actually be passing in a deviceId here for a given config
  const existingConfig = data?.config;
  const deviceId = data?.deviceId;
  console.log('Printing config device id from the get', deviceId);
  const configToRender = existingConfig ?? { mode: 'manual' };

  const { mutateAsync: updatePrintingConfigMutateAsync } = useAdminUpdateLabelPrintingConfig(deviceId);

  const handleSubmit = useCallback(
    async (formData: LabelPrintingConfig): Promise<void> => {
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
    <PageContainer tabTitle={'Update Label Printing Config'} showEnvFooter={false}>
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
              <AdminLabelPrintingConfigForm
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
