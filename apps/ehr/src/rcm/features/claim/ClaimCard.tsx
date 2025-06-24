import { Box, Card, Typography } from '@mui/material';
import React, { FC, ReactNode } from 'react';
import { PropsWithChildren } from '../../../shared/types';

type ClaimCardProps = PropsWithChildren<{
  title: string;
  editButton?: ReactNode;
}>;

export const ClaimCard: FC<ClaimCardProps> = (props) => {
  const { title, children, editButton } = props;

  return (
    <Card sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h4" color="primary.dark">
          {title}
        </Typography>
        {editButton}
      </Box>

      {children}
    </Card>
  );
};
