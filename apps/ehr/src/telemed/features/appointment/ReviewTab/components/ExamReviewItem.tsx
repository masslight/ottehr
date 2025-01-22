import React, { FC } from 'react';
import { Box, Typography, useTheme } from '@mui/material';

type ExamReviewItemProps = {
  label: string;
  abnormal: boolean;
} & (
  | {
      radio?: never;
      value?: never;
    }
  | {
      radio: boolean;
      value: boolean;
    }
);

export const ExamReviewItem: FC<ExamReviewItemProps> = (props) => {
  const { label, abnormal, radio, value } = props;

  const theme = useTheme();

  return radio ? (
    <Typography fontWeight={abnormal === value ? 700 : undefined}>
      {label} - {value ? 'Yes' : 'No'}
    </Typography>
  ) : (
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
