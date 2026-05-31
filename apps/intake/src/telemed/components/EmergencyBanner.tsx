import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { Box, CardContent, Typography, useTheme } from '@mui/material';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { otherColors } from '../../IntakeThemeProvider';

export const EmergencyBanner: FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { sm: 'row', xs: 'column' },
        alignItems: 'center',
        gap: 2.5,
        borderRadius: 2,
        backgroundColor: otherColors.emergencyBanner,
        p: 2,
        mt: 3,
        [theme.breakpoints.down('md')]: { mx: 2 },
      }}
    >
      <CardContent sx={{ p: 0 }}>
        <ErrorOutlineIcon sx={{ color: theme.palette.warning.main }} fontSize="large" />
      </CardContent>
      <Typography
        sx={{
          color: otherColors.white,
        }}
      >
        {t('general.footer')}
      </Typography>
    </Box>
  );
};
