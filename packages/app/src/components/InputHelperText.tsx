import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Box, FormHelperText, Typography, useTheme } from '@mui/material';
import { FC } from 'react';
import { FieldErrors } from 'react-hook-form';

type InputHelperTextProps = {
  errors: FieldErrors;
  helperText?: string;
  name: string;
};

export const InputHelperText: FC<InputHelperTextProps> = ({ errors, helperText, name }) => {
  const theme = useTheme();

  return (
    <Box>
      <FormHelperText id={`${name}-helper-text`} sx={{ gap: 0, mt: 1 }}>
        {(errors[name]?.message as string) ?? ''}
      </FormHelperText>
      {helperText && (
        <Box display="flex">
          <InfoOutlinedIcon
            sx={{ color: theme.palette.info.main, fontSize: '18px', pr: '4px', verticalAlign: 'bottom' }}
          />
          <Typography color={theme.palette.text.primary} variant="caption">
            {helperText}
          </Typography>
        </Box>
      )}
    </Box>
  );
};
