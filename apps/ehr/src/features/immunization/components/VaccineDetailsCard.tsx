import { Grid, Paper, Stack, Typography, useTheme } from '@mui/material';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { TextInput } from 'src/components/input/TextInput';
import { ButtonRounded } from 'src/features/css-module/components/RoundedButton';
import { VaccineOrderDetailsSection } from './VaccineOrderDetailsSection';

export const VaccineDetailsCard: React.FC = () => {
  const methods = useForm();
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
                <VaccineOrderDetailsSection />
              </Grid>
              <Grid xs={12} item>
                <Typography
                  variant="h4"
                  sx={{
                    color: theme.palette.primary.dark,
                  }}
                >
                  Administering vaccine
                </Typography>
              </Grid>
              <Grid xs={3} item>
                <TextInput name="lot" label="LOT number" required />
              </Grid>
              <Grid xs={3} item>
                <TextInput name="expDate" label="Exp. Date" required />
              </Grid>
              <Grid xs={3} item>
                <TextInput name="mvx" label="MVX code" required />
              </Grid>
              <Grid xs={3} item>
                <TextInput name="cvx" label="CVX code" required />
              </Grid>
              <Grid xs={3} item>
                <TextInput name="cpt" label="CPT code" />
              </Grid>
              <Grid xs={3} item>
                <TextInput name="ndc" label="NDC code" required />
              </Grid>
              <Grid xs={3} item>
                <TextInput name="administeredDate" label="Administered date" required />
              </Grid>
              <Grid xs={3} item>
                <TextInput name="administeredTime" label="Administered time" required />
              </Grid>
              <Grid xs={6} item>
                VIS was given to the patient
              </Grid>
              <Grid xs={6} item>
                <TextInput name="visGivenDate" label="VIS given date" required />
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
                <TextInput name="relationship" label="Relationship" />
              </Grid>
              <Grid xs={4} item>
                <TextInput name="fullName" label="Full name" />
              </Grid>
              <Grid xs={4} item>
                <TextInput name="mobile" label="Mobile" />
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
