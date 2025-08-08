import { Box, Grid, Paper, Stack, Typography, useTheme } from '@mui/material';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { CheckboxInput } from 'src/components/input/CheckboxInput';
import { DateInput } from 'src/components/input/DateInput';
import { TextInput } from 'src/components/input/TextInput';
import { TimeInput } from 'src/components/input/TimeInput';
import { ButtonRounded } from 'src/features/css-module/components/RoundedButton';
import { ImmunizationOrder } from '../ImmunizationOrder';
import { OrderDetailsSection } from './OrderDetailsSection';

interface Props {
  order: ImmunizationOrder;
}

export const VaccineDetailsCard: React.FC<Props> = ({ order }) => {
  const methods = useForm({
    defaultValues: {
      ...order,
      visGiven: order.administeringData?.visGivenDate != null,
    },
  });
  const theme = useTheme();

  const onSubmit = (data: any): void => {
    console.log(data);
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        <Stack spacing={2}>
          <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
            <Grid container spacing={2}>
              <Grid xs={12} item>
                <OrderDetailsSection />
              </Grid>
              <Grid xs={12} item>
                <Typography
                  variant="h5"
                  sx={{
                    color: theme.palette.primary.dark,
                  }}
                >
                  Administering vaccine
                </Typography>
              </Grid>
              <Grid xs={3} item>
                <TextInput name="administeringData.lot" label="LOT number" required />
              </Grid>
              <Grid xs={3} item>
                <DateInput name="administeringData.expDate" label="Exp. Date" required />
              </Grid>
              <Grid xs={3} item>
                <TextInput name="administeringData.mvx" label="MVX code" required />
              </Grid>
              <Grid xs={3} item>
                <TextInput name="administeringData.cvx" label="CVX code" required />
              </Grid>
              <Grid xs={3} item>
                <TextInput name="administeringData.cpt" label="CPT code" />
              </Grid>
              <Grid xs={3} item>
                <TextInput name="administeringData.ndc" label="NDC code" required />
              </Grid>
              <Grid xs={3} item>
                <DateInput name="administeringData.administeredDateTime" label="Administered date" required />
              </Grid>
              <Grid xs={3} item>
                <TimeInput name="administeringData.administeredDateTime" label="Administered time" required />
              </Grid>
              <Grid xs={6} item>
                <Box
                  style={{
                    background: '#2169F514',
                    borderRadius: '8px',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <CheckboxInput name="visGiven" label="VIS was given to the patient" />
                </Box>
              </Grid>
              <Grid xs={6} item>
                <DateInput name="administeringData.visGivenDate" label="VIS given date" required />
              </Grid>
              <Grid xs={12} item>
                <Typography
                  variant="h4"
                  sx={{
                    color: theme.palette.primary.dark,
                  }}
                >
                  Emergency contact
                </Typography>
              </Grid>
              <Grid xs={4} item>
                <TextInput name="emergencyContact.relationship" label="Relationship" />
              </Grid>
              <Grid xs={4} item>
                <TextInput name="emergencyContact.fullName" label="Full name" />
              </Grid>
              <Grid xs={4} item>
                <TextInput name="emergencyContact.mobile" label="Mobile" />
              </Grid>
              <Grid xs={12} item>
                <Stack direction="row" justifyContent="end" alignItems="center">
                  <ButtonRounded variant="outlined" color="primary" size="large">
                    Not Administered
                  </ButtonRounded>
                  <ButtonRounded variant="outlined" color="primary" size="large">
                    Partly Administered
                  </ButtonRounded>
                  <ButtonRounded type="submit" variant="contained" color="primary" size="large">
                    Administered
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
