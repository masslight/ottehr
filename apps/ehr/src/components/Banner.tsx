import { InfoOutlined, WarningAmberOutlined } from '@mui/icons-material';
import { Box, Typography } from '@mui/material';
import { ReactElement } from 'react';
import { BANNER_HEIGHT } from '../helpers/misc.helper';

interface Props {
  text: string;
  icon?: 'info' | 'warning';
  iconSize?: 'small' | 'medium' | 'large';
  height?: string;
  width?: string;
  bgcolor?: string;
  color?: string;
}

export default function Banner({ text, icon, iconSize, bgcolor, color }: Props): ReactElement {
  const iconElement =
    icon === 'info' ? (
      <InfoOutlined sx={{ marginRight: '5px' }} fontSize={iconSize} />
    ) : icon === 'warning' ? (
      <WarningAmberOutlined sx={{ marginRight: '5px' }} fontSize={iconSize} />
    ) : null;

  return (
    <Box
      sx={{
        bgcolor,
        color,
        height: BANNER_HEIGHT,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        display: 'flex',
        position: 'sticky',
        padding: '5px',
        top: 0,
        zIndex: (theme) => theme.zIndex.drawer + 1,
        opacity: 0.5,
        pointerEvents: 'none',
      }}
    >
      {iconElement}
      <Box>
        <Typography variant="h3">{text}</Typography>
      </Box>
    </Box>
  );
}
