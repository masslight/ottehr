import { styled, SxProps, TextField, TextFieldProps } from '@mui/material';

export const VitalsTextInputFiled = styled(
  ({ isInputError, extraSx, ...props }: TextFieldProps & { extraSx?: SxProps; isInputError?: boolean }) => (
    <TextField
      variant="outlined"
      fullWidth
      autoComplete="off"
      size="small"
      error={!!isInputError}
      helperText={isInputError ? 'Invalid value' : undefined}
      FormHelperTextProps={{
        sx: {
          backgroundColor: '#F7F8F9',
          mx: 0,
          fontWeight: 500,
          fontSize: '11px',
          position: 'absolute',
          bottom: '-15px',
          left: 0,
        },
      }}
      sx={{
        backgroundColor: 'white',
        maxHeight: '40px',
        position: 'relative',
        '& .MuiOutlinedInput-root': {
          height: '100%',
          maxHeight: '40px',
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
        ...extraSx,
      }}
      type="number"
      {...props}
    />
  )
)(() => ({}));

export const VitalsTextFreeInputField = styled(
  ({ isInputError, extraSx, ...props }: TextFieldProps & { extraSx?: SxProps; isInputError?: boolean }) => (
    <TextField
      variant="outlined"
      fullWidth
      autoComplete="off"
      size="small"
      error={!!isInputError}
      helperText={isInputError ? 'Invalid value' : undefined}
      FormHelperTextProps={{
        sx: {
          backgroundColor: '#F7F8F9',
          mx: 0,
          fontWeight: 500,
          fontSize: '11px',
          position: 'absolute',
          bottom: '-15px',
          left: 0,
        },
      }}
      sx={{
        backgroundColor: 'white',
        maxHeight: '40px',
        position: 'relative',
        '& .MuiOutlinedInput-root': {
          height: '100%',
          maxHeight: '40px',
        },
        '& .MuiInputLabel-root': {
          color: 'text.secondary',
        },
        ...extraSx,
      }}
      type="text"
      {...props}
    />
  )
)(() => ({}));
