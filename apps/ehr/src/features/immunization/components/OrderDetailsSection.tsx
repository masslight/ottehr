import { Grid, Typography, useTheme } from '@mui/material';
import React from 'react';
import { AutocompleteInput } from 'src/components/input/AutocompleteInput';
import { EmployeeSelectInput, PROVIDERS_FILTER } from 'src/components/input/EmployeeSelectInput';
import { SelectInput } from 'src/components/input/SelectInput';
import { TextInput } from 'src/components/input/TextInput';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useGetVaccines } from 'src/features/visits/in-person/hooks/useImmunization';
import { LOCATION_OPTIONS, ROUTE_OPTIONS } from 'src/shared/utils/options';
import { UNIT_OPTIONS } from 'utils';

export const OrderDetailsSection: React.FC = () => {
  const theme = useTheme();
  const { data: vaccines, isLoading } = useGetVaccines();
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
          options={vaccines}
          loading={isLoading}
          getOptionLabel={(option) => option.name}
          getOptionKey={(option) => option.id}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          required
          dataTestId={dataTestIds.orderVaccinePage.vaccine}
        />
      </Grid>
      <Grid xs={3} item>
        <TextInput
          name="details.dose"
          label="Dose"
          type="number"
          validate={(value: string) => (!(parseFloat(value) > 0) ? 'Dose must be positive' : true)}
          required
          dataTestId={dataTestIds.orderVaccinePage.dose}
        />
      </Grid>
      <Grid xs={3} item>
        <SelectInput
          name="details.units"
          label="Units"
          options={UNIT_OPTIONS.map((option) => option.value)}
          getOptionLabel={(option) => UNIT_OPTIONS.find((opt) => opt.value === option) ?? option}
          required
          dataTestId={dataTestIds.orderVaccinePage.units}
        />
      </Grid>
      <Grid xs={6} item>
        <AutocompleteInput
          name="details.route"
          label="Route"
          options={ROUTE_OPTIONS}
          getOptionLabel={(option) => option.name}
          getOptionKey={(option) => option.code}
          isOptionEqualToValue={(option, value) => option.code === value.code}
          dataTestId={dataTestIds.orderVaccinePage.route}
        />
      </Grid>
      <Grid xs={6} item>
        <AutocompleteInput
          name="details.location"
          label="Location"
          options={LOCATION_OPTIONS}
          getOptionLabel={(option) => option.name}
          getOptionKey={(option) => option.code}
          isOptionEqualToValue={(option, value) => option.code === value.code}
          dataTestId={dataTestIds.orderVaccinePage.location}
        />
      </Grid>
      <Grid xs={12} item>
        <TextInput
          name="details.instructions"
          label="Instructions"
          multiline
          dataTestId={dataTestIds.orderVaccinePage.instructions}
        />
      </Grid>
      <Grid xs={6} item>
        <EmployeeSelectInput
          name="details.orderedProvider"
          label="Ordered by"
          required
          dataTestId={dataTestIds.orderVaccinePage.orderedBy}
          filter={PROVIDERS_FILTER}
        />
      </Grid>
    </Grid>
  );
};
