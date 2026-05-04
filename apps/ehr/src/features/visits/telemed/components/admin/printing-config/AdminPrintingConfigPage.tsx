import { Grid, Paper } from '@mui/material';
import { ReactElement } from 'react';
import PageContainer from 'src/layout/PageContainer';
import { AdminPrintingConfig } from 'utils';
import AdminPrintingConfigForm from './AdminPrintingConfigForm';

export default function AdminPrintingConfigPage(): ReactElement {
  // for the moment we're just going to return the single form since we aren't supporting multiple printing configs for the moment

  const handleSubmit = (data: AdminPrintingConfig): void => {
    console.log('>>>data from handleSubmit', data);
    return;
  };

  return (
    <PageContainer tabTitle={'Update Printing Config'} showEnvFooter={false}>
      <Grid container direction="row" alignItems="center" justifyContent="center">
        <Grid item maxWidth={'584px'} width={'100%'}>
          <Paper sx={{ padding: 3, marginTop: 2, marginBottom: 2 }}>
            <AdminPrintingConfigForm formMode="edit" defaultValues={{ mode: 'manual' }} onSubmit={handleSubmit} />
          </Paper>
        </Grid>
      </Grid>
    </PageContainer>
  );
}
