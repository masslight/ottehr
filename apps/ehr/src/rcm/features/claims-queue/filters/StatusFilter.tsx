import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import React, { FC } from 'react';
import { ClaimsQueueGetRequest } from 'utils';
import { claimStatusOptions } from '../../../utils';

type StatusFilterProps = {
  value: ClaimsQueueGetRequest['status'];
  onChange: (state: ClaimsQueueGetRequest['status']) => void;
};

const statusOptions: { [value in Exclude<ClaimsQueueGetRequest['status'] | '', undefined>]: string } = {
  '': 'All statuses',
  ...claimStatusOptions,
};

export const StatusFilter: FC<StatusFilterProps> = (props) => {
  const { value, onChange } = props;

  return (
    <FormControl size="small" fullWidth>
      <InputLabel>Status</InputLabel>
      <Select
        value={value || 'all'}
        onChange={(e) =>
          onChange(e.target.value === 'all' ? undefined : (e.target.value as ClaimsQueueGetRequest['status']))
        }
        label="Status"
      >
        {Object.keys(statusOptions).map((option) => (
          <MenuItem key={option || 'all'} value={option || 'all'}>
            {statusOptions[option as keyof typeof statusOptions]}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};
