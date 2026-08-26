import { otherColors } from '@ehrTheme/colors';
import ArrowDropDownCircleOutlinedIcon from '@mui/icons-material/ArrowDropDownCircleOutlined';
import { Box, IconButton, Typography } from '@mui/material';
import { FC, ReactNode } from 'react';
import { NoteSectionTitleInCardHeaderProvider } from 'src/features/visits/shared/components/NoteSectionHeading';
import { NoteSectionIcon, NoteSectionIconKey } from './NoteSectionIcon';

interface NoteSectionCardProps {
  // section name shown in the header — the containers inside suppress their own heading
  title: string;
  iconKey?: NoteSectionIconKey;
  // right-hand side of the header, e.g. the Edit button
  headerItem?: ReactNode;
  // when set, the header gets the expand/collapse control and clicking it (or the header)
  // runs this — the inline editor uses it to enter and leave editing
  onToggle?: () => void;
  // rotates the expand/collapse control; the section body itself is always visible
  expanded?: boolean;
  dataTestId?: string;
  headerTestId?: string;
  children: ReactNode;
}

// One section of the visit note: a bordered card with a shaded header (expand/collapse
// control, the sidebar icon of the screen it is edited on, and the section title).
export const NoteSectionCard: FC<NoteSectionCardProps> = ({
  title,
  iconKey,
  headerItem,
  onToggle,
  expanded,
  dataTestId,
  headerTestId,
  children,
}) => (
  <Box
    data-testid={dataTestId}
    sx={{
      border: `1px solid ${otherColors.solidLine}`,
      borderRadius: 1,
      overflow: 'hidden',
      backgroundColor: 'background.paper',
    }}
  >
    <Box
      data-testid={headerTestId}
      onClick={onToggle}
      role={onToggle ? 'button' : undefined}
      tabIndex={onToggle ? 0 : undefined}
      aria-expanded={onToggle ? !!expanded : undefined}
      onKeyDown={(event) => {
        if (!onToggle || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        onToggle();
      }}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 2,
        py: 0.5,
        backgroundColor: otherColors.apptHover,
        cursor: onToggle ? 'pointer' : 'default',
      }}
    >
      {onToggle && (
        <IconButton sx={{ p: 0 }} tabIndex={-1} aria-hidden>
          <ArrowDropDownCircleOutlinedIcon
            fontSize="small"
            sx={{ color: 'primary.main', rotate: expanded ? '180deg' : '' }}
          />
        </IconButton>
      )}
      <NoteSectionIcon iconKey={iconKey} />
      <Typography variant="h5" color="primary.dark" sx={{ minWidth: 0 }}>
        {title}
      </Typography>
      <Box sx={{ flexGrow: 1 }} />
      {headerItem}
    </Box>
    <NoteSectionTitleInCardHeaderProvider value={true}>
      <Box sx={{ p: 2 }}>{children}</Box>
    </NoteSectionTitleInCardHeaderProvider>
  </Box>
);
