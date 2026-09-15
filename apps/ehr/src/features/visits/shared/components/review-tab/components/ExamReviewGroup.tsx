import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { AssessmentTitle } from 'src/components/AssessmentTitle';
import { AiAddedMark } from '../../scribe-recommendations/AiAddedMark';
import { ScribeRecommendation } from '../../scribe-recommendations/types';
import { ExamReviewItem } from './ExamReviewItem';

type ExamReviewGroupProps = {
  label: string;
  /** `aiAdded` is the scribe recommendation that wrote the item, when one did. */
  items: { field: string; label: string; abnormal: boolean; aiAdded?: ScribeRecommendation }[];
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
            {items.map((details) =>
              details.aiAdded ? (
                <AiAddedMark key={details.field} recommendation={details.aiAdded} inline>
                  <ExamReviewItem label={details.label} abnormal={details.abnormal} />
                </AiAddedMark>
              ) : (
                <ExamReviewItem key={details.field} label={details.label} abnormal={details.abnormal} />
              )
            )}
          </Box>
        )}
      </Box>
      {comment && items.length > 0 && <Typography fontWeight={500}>{comment}</Typography>}
    </Box>
  );
};
