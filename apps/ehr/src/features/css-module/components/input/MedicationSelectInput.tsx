import { Autocomplete, Skeleton, TextField } from '@mui/material';
import { RegisterOptions, useFormContext } from 'react-hook-form';
import { useGetMedicationList } from 'src/telemed';

export interface MedicationOption {
  id: string;
  label: string;
}

type Props = {
  name: string;
  label: string;
  initialOption?: MedicationOption;
  registerOptions?: RegisterOptions;
};

export const MedicationSelectInput: React.FC<Props> = ({ name, label, initialOption, registerOptions }) => {
  const { data: medications, isLoading: medicationsLoading } = useGetMedicationList();
  const options = Object.entries(medications || {}).map(([id, label]) => {
    return {
      id,
      label,
    };
  });
  const { register } = useFormContext();
  return !medicationsLoading ? (
    <Autocomplete
      options={options}
      disabled={medicationsLoading}
      isOptionEqualToValue={(option, value) => option.id === value.id}
      value={initialOption}
      getOptionLabel={(option) => option.label}
      renderInput={(params) => (
        <TextField
          {...params}
          {...register(name, registerOptions)}
          label={label}
          placeholder={`Select ${label}`}
          required={registerOptions?.required === true}
        />
      )}
    />
  ) : (
    <Skeleton variant="rectangular" width="100%" height={56} />
  );
};
