import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { AssessmentTitle } from 'src/components/AssessmentTitle';
import { ExamReviewItem } from './ExamReviewItem';

type ExamReviewGroupProps = {
  label: string;
  items: { field: string; label: string; abnormal: boolean }[];
  comment?: string;
};

export const ExamReviewGroup: FC<ExamReviewGroupProps> = (props) => {
  const { label, items, comment } = props;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', gap: 2 }}>
        <AssessmentTitle>{label}</AssessmentTitle>
        {items.length === 0 ? (
          <Typography fontWeight={500}>{comment}</Typography>
        ) : (
          <Box sx={{ display: 'flex', columnGap: 4, rowGap: 0.5, flexWrap: 'wrap' }}>
            {items.map((details) => (
              <ExamReviewItem key={details.field} label={details.label} abnormal={details.abnormal} />
            ))}
          </Box>
        )}
      </Box>
      {comment && items.length > 0 && <Typography fontWeight={500}>{comment}</Typography>}
    </Box>
  );
};
