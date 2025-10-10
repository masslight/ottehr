import { Box, Typography } from '@mui/material';
import React from 'react';

export const TASK_CATEGORY_LABEL: Record<string, string> = {
  'external-labs': 'External Labs',
  'in-house-labs': 'In-house Labs',
};

interface Props {
  category: string;
}

export const CategoryChip: React.FC<Props> = ({ category }) => {
  return (
    <Box
      style={{
        background: '#2169F51F',
        borderRadius: '16px',
        height: '24px',
        padding: '0 12px 0 12px',
      }}
      display="inline-flex"
      alignItems="center"
      justifyContent="center"
    >
      <Typography variant="body2" display="inline" style={{ color: '#2169F5', fontSize: '13px' }}>
        {TASK_CATEGORY_LABEL[category] ?? 'Unknown'}
      </Typography>
    </Box>
  );
};
