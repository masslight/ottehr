import React, { FC } from 'react';
import { Box, Typography } from '@mui/material';
import { AssessmentTitle } from '../../AssessmentTab';
import { ExamObservationFieldItem } from '../../../../../types/types';
import { ExamReviewItem } from './ExamReviewItem';

type ExamReviewGroupProps = {
  label: string;
  extraItems?: { label: string; abnormal: boolean }[];
} & (
  | { items: (ExamObservationFieldItem & { value?: never })[]; radio?: never }
  | { items: (ExamObservationFieldItem & { value: boolean })[]; radio: boolean }
);

export const ExamReviewGroup: FC<ExamReviewGroupProps> = (props) => {
  const { label, items, extraItems, radio = false } = props;

  return (
    <Box sx={{ display: 'flex', gap: 2 }}>
      <AssessmentTitle>{label}</AssessmentTitle>
      {items.length === 0 && (!extraItems || extraItems.length === 0) ? (
        <Typography color="secondary.light">No data</Typography>
      ) : (
        <Box sx={{ display: 'flex', columnGap: 4, rowGap: 0.5, flexWrap: 'wrap' }}>
          {items.map((details) => (
            <ExamReviewItem
              key={details.field}
              label={details.label}
              abnormal={details.abnormal}
              radio={radio}
              value={!!details.value}
            />
          ))}
          {extraItems &&
            extraItems.length > 0 &&
            extraItems.map((details) => (
              <ExamReviewItem key={details.label} label={details.label} abnormal={details.abnormal} />
            ))}
        </Box>
      )}
    </Box>
  );
};
