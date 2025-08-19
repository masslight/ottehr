import { Autocomplete, TextField } from '@mui/material';
import React, { FC } from 'react';
import type { StateType } from 'utils';
import { AllStatesToVirtualLocationLabels, AllStatesValues, ClaimsQueueGetRequest } from 'utils';

type StateFilterProps = {
  value: ClaimsQueueGetRequest['state'];
  onChange: (state: ClaimsQueueGetRequest['state']) => void;
};

const EMPTY_STATE = { label: 'All states', value: '' } as const;
const stateOptions: (StateType | '')[] = [EMPTY_STATE.value, ...AllStatesValues];
const stateOptionToLabel: {
  [value in StateType | '']: string;
} = { ...AllStatesToVirtualLocationLabels, [EMPTY_STATE.value]: EMPTY_STATE.label };

export const StateFilter: FC<StateFilterProps> = (props) => {
  const { value, onChange } = props;

  return (
    <Autocomplete
      value={value}
      size="small"
      disableClearable
      onChange={(_, value) => onChange(value || undefined)}
      getOptionLabel={(option) => stateOptionToLabel[option] || 'Unknown'}
      options={stateOptions}
      renderOption={(props, option) => (
        <li {...props} key={option}>
          {stateOptionToLabel[option] || 'Unknown'}
        </li>
      )}
      fullWidth
      renderInput={(params) => <TextField name="state" {...params} label="State" />}
    />
  );
};
