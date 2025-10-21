import { TextField } from '@mui/material';
import React from 'react';

export const TextFieldStyled: React.FC<React.ComponentProps<typeof TextField>> = (props) => (
  <TextField
    variant="outlined"
    fullWidth
    autoComplete="off"
    sx={{
      pr: 2,
      height: '100%',
      '& .MuiOutlinedInput-root': {
        height: '100%',
      },
      '& .MuiInputLabel-root': {
        color: 'text.secondary',
      },
    }}
    {...props}
  />
);
