import { Grid, Paper, Stack } from '@mui/material';
import React, { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { ButtonRounded } from 'src/features/css-module/components/RoundedButton';
import { WarningBlock } from 'src/features/css-module/components/WarningBlock';
import { AccordionCard } from 'src/telemed';
import { PageHeader } from '../../css-module/components/medication-administration/PageHeader';
import { HistoryTable } from '../components/HistoryTable';
import { VaccineOrderDetailsSection } from '../components/VaccineOrderDetailsSection';

export const ImmunizationOrderCreate: React.FC = () => {
  const methods = useForm();
  const [isImmunizationHistoryCollapsed, setIsImmunizationHistoryCollapsed] = useState(false);

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
          <AccordionCard
            label="Pre-visit immunization history"
            collapsed={isImmunizationHistoryCollapsed}
            onSwitch={() => setIsImmunizationHistoryCollapsed((prev) => !prev)}
            withBorder={false}
          >
            <HistoryTable showActions={false} />
          </AccordionCard>
        </Stack>
      </form>
    </FormProvider>
  );
};
