import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Box, FormHelperText, Typography } from '@mui/material';
import { FC } from 'react';

type FieldHelperTextProps = {
  name: string;
  hasError: boolean;
  errorMessage?: string;
  helperText?: string;
  showHelperTextIcon?: boolean;
  textColor?: string;
};

export const FieldHelperText: FC<FieldHelperTextProps> = ({
  name,
  hasError,
  errorMessage,
  helperText,
  showHelperTextIcon = true,
  textColor,
}) => {
  return (
    <Box>
      <FormHelperText id={`${name}-helper-text`} sx={{ color: textColor, gap: 0, mt: 1 }}>
        {hasError ? errorMessage ?? '' : ''}
      </FormHelperText>
      {helperText && (
        <Box display="flex">
          {showHelperTextIcon && (
            <InfoOutlinedIcon
              sx={{ fontSize: '18px', color: 'info.main', verticalAlign: 'bottom', paddingRight: '4px' }}
            />
          )}
          <Typography variant="caption" color="text.primary">
            {helperText}
          </Typography>
        </Box>
      )}
    </Box>
  );
};
