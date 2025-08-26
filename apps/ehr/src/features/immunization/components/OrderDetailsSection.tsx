import { Grid, Typography, useTheme } from '@mui/material';
import React from 'react';
import { MedicationSelectInput } from 'src/components/input/MedicationSelectInput';
import { ProviderSelectInput } from 'src/components/input/ProviderSelectInput';
import { SelectInput } from 'src/components/input/SelectInput';
import { TextInput } from 'src/components/input/TextInput';
import { LOCATION_OPTIONS, ROUTE_OPTIONS, UNIT_OPTIONS } from 'src/shared/utils';

export const OrderDetailsSection: React.FC = () => {
  const theme = useTheme();
  return (
    <Grid container spacing={2}>
      <Grid xs={12} item>
        <Typography
          variant="h5"
          sx={{
            color: theme.palette.primary.dark,
          }}
        >
          Order details
        </Typography>
      </Grid>
      <Grid xs={6} item>
        <MedicationSelectInput name="details.medicationId" label="Vaccine" required />
      </Grid>
      <Grid xs={3} item>
        <TextInput name="details.dose" label="Dose" type="number" required />
      </Grid>
      <Grid xs={3} item>
        <SelectInput name="details.units" label="Units" options={UNIT_OPTIONS} required />
      </Grid>
      <Grid xs={6} item>
        <SelectInput name="details.route" label="Route" options={ROUTE_OPTIONS} />
      </Grid>
      <Grid xs={6} item>
        <SelectInput name="details.location" label="Location" options={LOCATION_OPTIONS} />
      </Grid>
      <Grid xs={12} item>
        <TextInput name="details.instructions" label="Instructions" multiline />
      </Grid>
      <Grid xs={6} item>
        <ProviderSelectInput name="details.orderedProviderId" label="Ordered by" required />
      </Grid>
    </Grid>
  );
};
