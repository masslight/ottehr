import React, { FC, ReactNode } from 'react';
import { Divider, Grid } from '@mui/material';

type DoubleColumnContainerProps = {
  leftColumn: ReactNode;
  rightColumn: ReactNode;
  divider?: boolean;
  padding?: boolean;
};

export const DoubleColumnContainer: FC<DoubleColumnContainerProps> = (props) => {
  const { leftColumn, rightColumn, divider, padding } = props;

  return (
    <Grid container sx={{ position: 'relative' }}>
      <Grid item xs={6} sx={{ p: padding ? 2 : 0 }}>
        {leftColumn}
      </Grid>
      {divider && (
        <Divider
          orientation="vertical"
          flexItem
          sx={{ position: 'absolute', height: '100%', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
        />
      )}
      <Grid item xs={6} sx={{ p: padding ? 2 : 0 }}>
        {rightColumn}
      </Grid>
    </Grid>
  );
};
