import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { IconButton, SxProps } from '@mui/material';
import { ReactElement } from 'react';

interface PencilIconProps {
  onClick: () => void;
  size: string;
  sx: SxProps;
}

export function PencilIconButton({ onClick, size, sx }: PencilIconProps): ReactElement {
  return (
    <IconButton sx={{ color: 'primary.main', width: size, height: size, ...sx }} onClick={onClick}>
      <EditOutlinedIcon sx={{ width: size, height: size }} />
    </IconButton>
  );
}
