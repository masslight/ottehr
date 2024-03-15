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
    <Grid container>
      <Grid item xs={6} sx={{ p: padding ? 2 : 0 }}>
        {leftColumn}
      </Grid>
      {divider && <Divider orientation="vertical" flexItem sx={{ mr: '-1px' }} />}
      <Grid item xs={6} sx={{ p: padding ? 2 : 0 }}>
        {rightColumn}
      </Grid>
    </Grid>
  );
};
