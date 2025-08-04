import { Grid, Paper, Stack } from '@mui/material';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { SelectInput } from 'src/components/input/SelectInput';
import { TextInput } from 'src/components/input/TextInput';
import { BreadcrumbsView } from 'src/features/css-module/components/breadcrumbs/BreadcrumbsView';
import { ButtonRounded } from 'src/features/css-module/components/RoundedButton';
import { WarningBlock } from 'src/features/css-module/components/WarningBlock';
import { medicationApplianceRoutes } from 'utils';
import { MedicationSelectInput } from '../components/input/MedicationSelectInput';
import { PageHeader } from '../features/css-module/components/medication-administration/PageHeader';

const UNITS_OPTIONS = [
  { value: 'mg', label: 'mg' },
  { value: 'ml', label: 'mL' },
  { value: 'g', label: 'g' },
  { value: 'cc', label: 'cc' },
  { value: 'unit', label: 'unit' },
  { value: 'application', label: 'application' },
];

const ROUTE_OPTIONS = Object.entries(medicationApplianceRoutes)
  .map(([_, value]) => ({
    value: value.code,
    label: value.display ?? '',
  }))
  ?.sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()));

const LOCATION_OPTIONS = [
  { value: 'location-a', label: 'Location A' },
  { value: 'location-b', label: 'Location B' },
];

const ORDER_BY_OPTIONS = [
  { value: 'order-by-a', label: 'Order by A' },
  { value: 'order-by-b', label: 'Order by B' },
];

const BREADCRUMBS = [
  {
    text: 'Immunization',
    link: '#',
  },
  {
    text: 'Order Vaccine',
    link: '#',
    isActive: true,
  },
];

export const VaccineOrderCreate: React.FC = () => {
  const methods = useForm();

  const onSubmit = (data: any): void => {
    console.log(data);
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        <Stack spacing={2}>
          <BreadcrumbsView items={BREADCRUMBS} />
          <PageHeader title="Order Vaccine" variant="h3" component="h1" />
          <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
            <Grid container spacing={2}>
              <Grid xs={6} item>
                <MedicationSelectInput name="vaccine" label="Vacine" required />
              </Grid>
              <Grid xs={3} item>
                <TextInput name="dose" label="Dose" required />
              </Grid>
              <Grid xs={3} item>
                <SelectInput name="units" label="Units" options={UNITS_OPTIONS} required />
              </Grid>
              <Grid xs={6} item>
                <SelectInput name="route" label="Route" options={ROUTE_OPTIONS} />
              </Grid>
              <Grid xs={6} item>
                <SelectInput name="location" label="Location" options={LOCATION_OPTIONS} />
              </Grid>
              <Grid xs={12} item>
                <TextInput name="instructions" label="Instructions" multiline />
              </Grid>
              <Grid xs={6} item>
                <SelectInput name="ordered" label="Ordered by" options={ORDER_BY_OPTIONS} required />
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
