import { Box, Paper, Typography, useTheme } from '@mui/material';
import { FC, ReactNode } from 'react';

interface SectionProps {
  title: string;
  children: ReactNode;
  dataTestId?: string;
  titleWidget?: ReactNode;
  id?: string;
}

export const Section: FC<SectionProps> = ({ title, children, dataTestId, titleWidget, id }) => {
  const theme = useTheme();

  return (
    <Paper sx={{ p: 3 }} data-testid={dataTestId} id={id}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography variant="h4" color={theme.palette.primary.dark} sx={{ mb: 2 }}>
          {title}
        </Typography>
        {titleWidget ? titleWidget : <></>}
      </Box>
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
