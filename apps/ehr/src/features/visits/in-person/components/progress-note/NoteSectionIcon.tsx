import { Box } from '@mui/material';
import { FC } from 'react';
import { sidebarMenuIcons } from 'src/features/visits/shared/components/sidebarMenuIcons';

export type NoteSectionIconKey = keyof typeof sidebarMenuIcons;

interface NoteSectionIconProps {
  iconKey?: NoteSectionIconKey;
}

// The icon shown next to a section title in the note section card header, sized to one
// h5 line so it lines up with the title text.
export const NoteSectionIcon: FC<NoteSectionIconProps> = ({ iconKey }) => (
  <Box
    aria-hidden
    sx={{
      flex: '0 0 24px',
      height: '25px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'primary.main',
    }}
  >
    {iconKey && sidebarMenuIcons[iconKey]}
  </Box>
);
