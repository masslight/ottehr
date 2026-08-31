import { Box, Typography } from '@mui/material';
import { FC } from 'react';

type VisitNoteItemProps = {
  label: string;
  value?: string;
  noMaxWidth?: boolean;
};

export const VisitNoteItem: FC<VisitNoteItemProps> = (props) => {
  const { label, value, noMaxWidth } = props;

  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', maxWidth: noMaxWidth ? 'auto' : '550px' }}>
      <Typography color="primary.dark">{label}</Typography>
      <Typography>{value}</Typography>
    </Box>
  );
};
