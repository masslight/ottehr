import { Grid, Typography, useTheme } from '@mui/material';
import React from 'react';
import { MedicationSelectInput } from 'src/components/input/MedicationSelectInput';
import { ProviderSelectInput } from 'src/components/input/ProviderSelectInput';
import { SelectInput } from 'src/components/input/SelectInput';
import { TextInput } from 'src/components/input/TextInput';
import { ROUTE_OPTIONS, UNIT_OPTIONS } from 'src/shared/utils';

const LOCATION_OPTIONS = [
  { value: 'location-a', label: 'Location A' },
  { value: 'location-b', label: 'Location B' },
];

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
        <MedicationSelectInput name="vaccineId" label="Vaccine" required />
      </Grid>
      <Grid xs={3} item>
        <TextInput name="dose" label="Dose" required />
      </Grid>
      <Grid xs={3} item>
        <SelectInput name="units" label="Units" options={UNIT_OPTIONS} required />
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
        <ProviderSelectInput name="orderedBy.providerId" label="Ordered by" required />
      </Grid>
    </Grid>
  );
};
