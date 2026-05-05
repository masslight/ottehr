import { Box, CircularProgress, Grid, Paper, Typography } from '@mui/material';
import { ReactElement } from 'react';
import PageContainer from 'src/layout/PageContainer';
import { PrintingConfig } from 'utils';
import { useAdminGetPrintingConfig } from '../admin.queries';
import AdminPrintingConfigForm from './AdminPrintingConfigForm';

export default function AdminPrintingConfigPage(): ReactElement {
  // for the moment we're just going to return the single form since we aren't supporting multiple printing configs currently

  const {
    data: existingConfig,
    isPending,
    isError: isFetchDataError,
  } = useAdminGetPrintingConfig({ deviceId: undefined });
  const configToRender = existingConfig ?? { mode: 'manual' };

  const handleSubmit = (data: PrintingConfig): void => {
    console.log('>>>data from handleSubmit', data);
    return;
  };

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
              <AdminPrintingConfigForm formMode="edit" defaultValues={configToRender} onSubmit={handleSubmit} />
            )}
          </Paper>
        </Grid>
      </Grid>
    </PageContainer>
  );
}
