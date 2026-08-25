import { Typography } from '@mui/material';
import { FC } from 'react';

// Placeholder for a Review & Sign section whose summary container is only rendered when it
// has data. Shown instead so the section is still visible (and clickable to add) when
// blank; the section title comes from the surrounding card header.
export const BlankSection: FC<{ message: string }> = ({ message }) => (
  <Typography color="text.secondary">{message}</Typography>
);
