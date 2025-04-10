import CloseIcon from '@mui/icons-material/Close';
import { AppBar, Box, IconButton, useTheme } from '@mui/material';
import { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { adjustTopForBannerHeight } from '../../../helpers/misc.helper';
import { AppointmentTabsHeader } from './AppointmentTabsHeader';

export const AppointmentHeader: FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  return (
    <AppBar
      position="sticky"
      color="transparent"
      sx={{
        backgroundColor: theme.palette.background.paper,
        zIndex: (theme) => theme.zIndex.drawer + 1,
        top: adjustTopForBannerHeight(0),
      }}
    >
      <Box sx={{ display: 'flex', mt: 1, mx: 3, justifyContent: 'space-between', alignItems: 'start' }}>
        <AppointmentTabsHeader />

        <IconButton onClick={() => navigate('/telemed/appointments')}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
    </AppBar>
  );
};
