import { FC } from 'react';
import { FieldErrors } from 'react-hook-form';
import { Box, FormHelperText, Typography } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

type InputHelperTextProps = {
  name: string;
  errors: FieldErrors;
  helperText?: string;
};

export const InputHelperText: FC<InputHelperTextProps> = ({ name, errors, helperText }) => {
  return (
    <Box>
      <FormHelperText id={`${name}-helper-text`} sx={{ gap: 0, mt: 1 }}>
        {(errors[name]?.message as string) ?? ''}
      </FormHelperText>
      {helperText && (
        <Box display="flex">
          <InfoOutlinedIcon
            sx={{ fontSize: '18px', color: 'info.main', verticalAlign: 'bottom', paddingRight: '4px' }}
          />
          <Typography variant="caption" color="text.primary">
            {helperText}
          </Typography>
        </Box>
      )}
    </Box>
  );
};
