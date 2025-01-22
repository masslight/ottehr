import { FC } from 'react';
import { Box, Typography } from '@mui/material';

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
