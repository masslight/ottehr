import { Grid, Typography, useTheme } from '@mui/material';
import React from 'react';
import { AutocompleteInput } from 'src/components/input/AutocompleteInput';
import { Option } from 'src/components/input/Option';
import { ProviderSelectInput } from 'src/components/input/ProviderSelectInput';
import { SelectInput } from 'src/components/input/SelectInput';
import { TextInput } from 'src/components/input/TextInput';
import { useGetVaccines } from 'src/features/visits/in-person/hooks/useImmunization';
import { LOCATION_OPTIONS, ROUTE_OPTIONS, UNIT_OPTIONS } from 'src/shared/utils/options';

export const OrderDetailsSection: React.FC = () => {
  const theme = useTheme();
  const { data: vaccines, isLoading } = useGetVaccines();
  const vaccineOptions = vaccines?.map((vaccine) => {
    return {
      value: vaccine.id,
      label: vaccine.name,
    };
  });
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
        <AutocompleteInput
          name="details.medication"
          label="Vaccine"
          options={vaccineOptions}
          loading={isLoading}
          valueToOption={(value: any) => {
            return {
              label: value.name,
              value: value.id,
            };
          }}
          optionToValue={(option: Option) => {
            return {
              name: option.label,
              id: option.value,
            };
          }}
          required
        />
      </Grid>
      <Grid xs={3} item>
        <TextInput
          name="details.dose"
          label="Dose"
          type="number"
          validate={(value: string) => (!(parseFloat(value) > 0) ? 'Dose must be positive' : true)}
          required
        />
      </Grid>
      <Grid xs={3} item>
        <SelectInput name="details.units" label="Units" options={UNIT_OPTIONS} required />
      </Grid>
      <Grid xs={6} item>
        <AutocompleteInput name="details.route" label="Route" options={ROUTE_OPTIONS} />
      </Grid>
      <Grid xs={6} item>
        <AutocompleteInput
          name="details.location"
          label="Location"
          options={LOCATION_OPTIONS}
          valueToOption={(value: any) => {
            return {
              label: value.name,
              value: value.code,
            };
          }}
          optionToValue={(option: Option) => {
            return {
              name: option.label,
              code: option.value,
            };
          }}
        />
      </Grid>
      <Grid xs={12} item>
        <TextInput name="details.instructions" label="Instructions" multiline />
      </Grid>
      <Grid xs={6} item>
        <ProviderSelectInput name="details.orderedProvider" label="Ordered by" required />
      </Grid>
    </Grid>
  );
};
