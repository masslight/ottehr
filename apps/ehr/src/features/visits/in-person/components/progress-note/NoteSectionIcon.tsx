import { Box } from '@mui/material';
import { FC, ReactNode } from 'react';
import { sidebarMenuIcons } from 'src/features/visits/shared/components/sidebarMenuIcons';

export type NoteSectionIconKey = keyof typeof sidebarMenuIcons;

interface NoteSectionIconProps {
  // sidebar menu key, so a Review & Sign section is labelled with the same icon as the
  // screen it is edited on
  iconKey?: NoteSectionIconKey;
}

// Icon gutter for a Review & Sign section. The section's own heading is always its first
// child, so a fixed-height box (one h5 line) lines the icon up with the heading text.
export const NoteSectionIcon: FC<NoteSectionIconProps> = ({ iconKey }) => (
  <Box
    aria-hidden
    sx={{
      flex: '0 0 24px',
      height: '25px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'primary.dark',
    }}
  >
    {iconKey && sidebarMenuIcons[iconKey]}
  </Box>
);

interface SectionWithIconProps extends NoteSectionIconProps {
  children: ReactNode;
}

// Used for sections that aren't wrapped in an InlineEditSection (which renders the gutter
// itself) so every section on the page keeps the same indentation.
export const SectionWithIcon: FC<SectionWithIconProps> = ({ iconKey, children }) => (
  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, width: '100%' }}>
    <NoteSectionIcon iconKey={iconKey} />
    <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
  </Box>
);
