import { Box, Typography, useTheme } from '@mui/material';
import React, { FC } from 'react';

type ExamReviewItemProps = {
  label: string;
  abnormal: boolean;
};

export const ExamReviewItem: FC<ExamReviewItemProps> = (props) => {
  const { label, abnormal } = props;

  const theme = useTheme();

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
      <Box
        component="span"
        sx={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: abnormal ? theme.palette.error.main : theme.palette.success.main,
        }}
      />
      <Typography fontWeight={abnormal ? 700 : undefined}>{label}</Typography>
    </Box>
  );
};
