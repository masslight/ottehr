import { styled, TextField, TextFieldProps } from '@mui/material';

export const NumberInput = styled((props: TextFieldProps) => <TextField type="number" size="small" {...props} />)(
  () => ({
    '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': {
      display: 'none',
    },
    '& input[type=number]': {
      MozAppearance: 'textfield',
    },
    '& .MuiFormHelperText-root.Mui-error': {
      position: 'absolute',
      top: '100%',
      marginTop: 0,
    },
  }),
);
