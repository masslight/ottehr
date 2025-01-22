import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { Box, CardContent, Typography, useTheme } from '@mui/material';
import { FC } from 'react';
import { otherColors } from '../../IntakeThemeProvider';

export const EmergencyBanner: FC = () => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { sm: 'row', xs: 'column' },
        alignItems: 'center',
        gap: 2.5,
        borderRadius: 2,
        backgroundColor: otherColors.brightPurple,
        p: 2,
        mt: 3,
        [theme.breakpoints.down('md')]: { mx: 2 },
      }}
    >
      <CardContent sx={{ p: 0 }}>
        <Box
          sx={{
            backgroundColor: theme.palette.destructive.main,
            borderRadius: '50%',
            width: 40,
            height: 40,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <ErrorOutlineIcon sx={{ color: otherColors.white }} />
        </Box>
      </CardContent>
      <Typography
        sx={{
          color: otherColors.white,
        }}
      >
        If you believe that you are having a medical emergency, please dial 911 or go to the nearest emergency room.
      </Typography>
    </Box>
  );
};
