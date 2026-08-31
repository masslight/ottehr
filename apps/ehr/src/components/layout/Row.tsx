import { Box, Typography, useTheme } from '@mui/material';
import { FC, ReactElement } from 'react';

interface RowProps {
  label: string;
  children: ReactElement;
  inputId?: string;
  required?: boolean;
  dataTestId?: string;
}

export const Row: FC<RowProps> = ({ label, children, inputId, required, dataTestId }) => {
  const theme = useTheme();

  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: '5px' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', flex: '0 1 30%' }}>
        <Typography component="label" htmlFor={inputId} sx={{ color: theme.palette.primary.dark }}>
          {label}
          {required && ' *'}
        </Typography>
      </Box>
      <Box id={inputId} data-testid={dataTestId} sx={{ display: 'flex', alignItems: 'center', flex: '1 1 70%' }}>
        {children}
      </Box>
    </Box>
  );
};
