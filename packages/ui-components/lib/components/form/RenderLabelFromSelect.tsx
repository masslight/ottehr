import { Typography } from '@mui/material';
import { FC, ReactNode } from 'react';

interface RenderLabelFromSelectProps {
  children: ReactNode;
  styles?: object;
}

const RenderLabelFromSelect: FC<RenderLabelFromSelectProps> = ({ children, styles }) => {
  return (
    <Typography variant="inherit" sx={{ p: 0, ...styles }}>
      {children}
    </Typography>
  );
};

export default RenderLabelFromSelect;
