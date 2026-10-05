import { Autocomplete, Box, CircularProgress, TextField, Typography } from '@mui/material';
import { FC, useState } from 'react';
import { EmployeeAvatar } from './EmployeeAvatar';
import { ChatEmployeeOption } from './useChatEmployees';

interface EmployeeSearchProps {
  employees: ChatEmployeeOption[];
  loading: boolean;
  disabled: boolean;
  onSelect: (employee: ChatEmployeeOption) => void;
}

export const EmployeeSearch: FC<EmployeeSearchProps> = ({ employees, loading, disabled, onSelect }) => {
  const [inputValue, setInputValue] = useState('');

  return (
    <Autocomplete<ChatEmployeeOption>
      options={employees}
      value={null}
      inputValue={inputValue}
      onInputChange={(_event, value, reason) => setInputValue(reason === 'reset' ? '' : value)}
      onChange={(_event, employee) => {
        if (employee) {
          setInputValue('');
          onSelect(employee);
        }
      }}
      getOptionLabel={(employee) => employee.name}
      isOptionEqualToValue={(option, value) => option.profile === value.profile}
      loading={loading}
      disabled={disabled}
      noOptionsText="No employees found"
      renderOption={(props, employee) => (
        <Box component="li" {...props} key={employee.profile} sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <EmployeeAvatar employee={employee} size={28} />
          <Typography>{employee.name}</Typography>
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          size="small"
          placeholder="Find an employee"
          inputProps={{ ...params.inputProps, 'data-testid': 'employee-chat-search' }}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading && <CircularProgress size={16} />}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
};
