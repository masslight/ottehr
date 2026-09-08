import { Typography } from '@mui/material';
import { FC } from 'react';

export const BlankSection: FC<{ message: string }> = ({ message }) => (
  <Typography color="text.secondary">{message}</Typography>
);
