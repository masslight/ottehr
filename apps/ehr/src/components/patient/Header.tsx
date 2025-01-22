import { Box, IconButton, useTheme } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { FC } from 'react';
import { showEnvironmentBanner } from '../../App';
import { BANNER_HEIGHT } from '../../constants';
import { Contacts, FullNameDisplay, IdentifiersRow, PatientAvatar, Summary } from './info';

type HeaderProps = {
  handleDiscard: () => void;
  id?: string;
};

export const Header: FC<HeaderProps> = ({ handleDiscard, id }) => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        position: 'sticky',
        top: showEnvironmentBanner ? BANNER_HEIGHT : 0,
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: theme.palette.background.paper,
        padding: theme.spacing(1, 3),
        borderBottom: `1px solid ${theme.palette.divider}`,
        boxShadow: '0px 2px 4px -1px rgba(0, 0, 0, 0.2)',
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <IdentifiersRow id={id} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ flex: '64px 0 0' }}>
            <PatientAvatar id={id} sx={{ width: 64, height: 64 }} />
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Box sx={{ display: 'flex', rowGap: 0.5, columnGap: 2, flexWrap: 'wrap' }}>
              <FullNameDisplay id={id} variant="h5" />
              <Summary id={id} />
            </Box>
            <Contacts id={id} />
          </Box>
        </Box>
      </Box>
      <Box>
        <IconButton onClick={handleDiscard} aria-label="Close">
          <CloseIcon />
        </IconButton>
      </Box>
    </Box>
  );
};
