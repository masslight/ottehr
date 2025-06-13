import { Box, SxProps, TextField, TextFieldProps, Theme } from '@mui/material';

interface InHouseLabsNotesCardProps {
  notes: string;
  notesLabel: string;
  readOnly: boolean;
  additionalBoxSxProps: SxProps<Theme>;
  additionalTextFieldProps?: TextFieldProps;
  handleNotesUpdate?: (note: string) => void;
}

export const InHouseLabsNotesCard: React.FC<InHouseLabsNotesCardProps> = ({
  notes,
  notesLabel,
  readOnly,
  additionalBoxSxProps,
  additionalTextFieldProps,
  handleNotesUpdate,
}) => {
  const sxStyling: SxProps = !readOnly
    ? {}
    : {
        '& .MuiInputLabel-root': {
          color: '#5F6368',
          '&.Mui-focused': {
            color: '#5F6368',
          },
        },
        '& .MuiOutlinedInput-root': {
          backgroundColor: '#FFFFFF',
          '& fieldset': {
            borderColor: '#DADCE0',
          },
          '&:hover fieldset': {
            borderColor: '#DADCE0',
          },
          '&.Mui-focused fieldset': {
            borderColor: '#DADCE0',
            borderWidth: '1px',
          },
          '& .MuiInputBase-input': {
            fontSize: '0.875rem',
          },
        },
        '& .MuiInputLabel-shrink': {
          backgroundColor: '#FFFFFF',
          px: 1,
        },
      };

  return (
    <Box sx={{ ...additionalBoxSxProps }}>
      <TextField
        {...additionalTextFieldProps}
        InputProps={{
          readOnly,
        }}
        fullWidth
        label={notesLabel}
        value={notes}
        onChange={(e) => handleNotesUpdate?.(e.target.value)}
        variant="outlined"
        multiline
        maxRows={4}
        sx={{ ...sxStyling }}
      />
    </Box>
  );
};
