import { styled, SxProps, TextField, TextFieldProps } from '@mui/material';

export const VitalsTextInputFiled = styled((props: TextFieldProps & { extraSx?: SxProps; isInputError: boolean }) => (
  <TextField
    variant="outlined"
    fullWidth
    autoComplete="off"
    size="small"
    error={props.isInputError}
    helperText={props.isInputError ? 'Invalid value' : ''}
    FormHelperTextProps={{
      sx: { backgroundColor: '#F7F8F9', mx: 0, fontWeight: 500, fontSize: '14px' },
    }}
    sx={{
      backgroundColor: 'white',
      '& .MuiOutlinedInput-root': {
        height: '100%',
      },
      '& .MuiInputLabel-root': {
        color: 'text.secondary',
      },
      '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': {
        display: 'none',
      },
      '& input[type=number]': {
        MozAppearance: 'textfield',
      },
      ...props.extraSx,
    }}
    type="number"
    {...props}
  />
))(() => ({}));
