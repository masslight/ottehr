import { FC } from 'react';
import { Box, Typography } from '@mui/material';

type VisitNoteItemProps = {
  label: string;
  value?: string;
};

export const VisitNoteItem: FC<VisitNoteItemProps> = (props) => {
  const { label, value } = props;

  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', maxWidth: '550px' }}>
      <Typography color="primary.dark">{label}</Typography>
      <Typography>{value}</Typography>
    </Box>
  );
};
