import { ReactElement } from 'react';
import { Autocomplete, TextField, capitalize } from '@mui/material';

interface GroupMembersProps {
  option: 'locations' | 'providers';
  options: { label: string; value: string }[];
  values: { label: string; value: string }[];
  onChange: (event: React.SyntheticEvent, value: any, field: string) => void;
}

{
  /* <Autocomplete
      disabled={renderInputProps?.disabled}
      value={
        location ? { label: `${location.address?.state?.toUpperCase()} - ${location.name}`, value: location?.id } : null
      }
      onChange={handleLocationChange}
      isOptionEqualToValue={(option, tempValue) => option.value === tempValue.value}
      options={options}
      renderOption={(props, option) => {
        return (
          <li {...props} key={option.value}>
            {option.label}
          </li>
        );
      }}
      fullWidth
      renderInput={(params) => (
        <TextField placeholder="Search office" name="location" {...params} label="Office" required={required} />
      )}
    />
  ); */
}

export default function GroupMembers({ option, options, values, onChange }: GroupMembersProps): ReactElement {
  return (
    <Autocomplete
      options={options}
      renderInput={(params) => (
        <TextField placeholder={capitalize(option)} name={option} {...params} label={capitalize(option)} />
      )}
      isOptionEqualToValue={(option, tempValue) => option.value === tempValue.value}
      value={values}
      onChange={onChange}
      multiple
    />
  );
}
