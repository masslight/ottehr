import { Box, Paper, Typography, useTheme } from '@mui/material';
import { FC, ReactNode } from 'react';

interface SectionProps {
  title: string;
  children: ReactNode;
  dataTestId?: string;
}

export const Section: FC<SectionProps> = ({ title, children, dataTestId }) => {
  const theme = useTheme();

  return (
    <Paper sx={{ p: 3 }} data-testid={dataTestId}>
      <Typography variant="h4" color={theme.palette.primary.dark} sx={{ mb: 2 }}>
        {title}
      </Typography>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        {children}
      </Box>
    </Paper>
  );
};
