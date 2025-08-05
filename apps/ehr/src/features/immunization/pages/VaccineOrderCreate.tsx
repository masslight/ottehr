import { Grid, Paper, Stack } from '@mui/material';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { ButtonRounded } from 'src/features/css-module/components/RoundedButton';
import { WarningBlock } from 'src/features/css-module/components/WarningBlock';
import { PageHeader } from '../../css-module/components/medication-administration/PageHeader';
import { VaccineOrderDetailsSection } from '../components/VaccineOrderDetailsSection';

export const VaccineOrderCreate: React.FC = () => {
  const methods = useForm();

  const onSubmit = (data: any): void => {
    console.log(data);
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        <Stack spacing={2}>
          <PageHeader title="Order Vaccine" variant="h3" component="h1" />
          <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
            <Grid container spacing={2}>
              <Grid xs={12} item>
                <VaccineOrderDetailsSection />
              </Grid>
              <Grid xs={12} item>
                <WarningBlock
                  title="Safety Alert"
                  text="Vaccine orders do not automatically check for patient allergies (unlike medication orders). Before proceeding, please manually review the patient's allergies and confirm there is no risk of allergy to the vaccine or its components."
                />
              </Grid>
              <Grid xs={12} item>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <ButtonRounded variant="outlined" color="primary" size="large">
                    Cancel
                  </ButtonRounded>
                  <ButtonRounded type="submit" variant="contained" color="primary" size="large">
                    Order Vaccine
                  </ButtonRounded>
                </Stack>
              </Grid>
            </Grid>
          </Paper>
        </Stack>
      </form>
    </FormProvider>
  );
};
