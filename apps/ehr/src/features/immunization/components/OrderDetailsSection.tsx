import { Grid, Typography, useTheme } from '@mui/material';
import React from 'react';
import { AutocompleteInput } from 'src/components/input/AutocompleteInput';
import { EmployeeSelectInput, PROVIDERS_FILTER } from 'src/components/input/EmployeeSelectInput';
import { Option } from 'src/components/input/Option';
import { SelectInput } from 'src/components/input/SelectInput';
import { TextInput } from 'src/components/input/TextInput';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useGetVaccines } from 'src/features/visits/in-person/hooks/useImmunization';
import { LOCATION_OPTIONS, ROUTE_OPTIONS } from 'src/shared/utils/options';
import { UNIT_OPTIONS } from 'utils';

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
          options={UNIT_OPTIONS}
          required
          dataTestId={dataTestIds.orderVaccinePage.units}
        />
      </Grid>
      <Grid xs={6} item>
        <AutocompleteInput
          name="details.route"
          label="Route"
          options={ROUTE_OPTIONS}
          dataTestId={dataTestIds.orderVaccinePage.route}
        />
      </Grid>
      <Grid xs={6} item>
        <AutocompleteInput
          name="details.location"
          label="Location"
          options={LOCATION_OPTIONS}
          dataTestId={dataTestIds.orderVaccinePage.location}
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
