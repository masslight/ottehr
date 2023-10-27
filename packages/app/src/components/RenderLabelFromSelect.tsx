import { Typography } from '@mui/material';
import { FC, ReactNode } from 'react';

interface RenderLabelFromSelectProps {
  children: ReactNode;
  styles?: object;
}

export const RenderLabelFromSelect: FC<RenderLabelFromSelectProps> = ({ children, styles }) => {
  return (
    <Typography sx={{ p: 0, ...styles }} variant="inherit">
      {children}
    </Typography>
  );
};
