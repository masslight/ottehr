import { Typography } from '@mui/material';
import { FC } from 'react';
import { ExamObservationDTO } from 'utils';

type ExamReviewCommentProps = {
  item: ExamObservationDTO;
};

export const ExamReviewComment: FC<ExamReviewCommentProps> = (props) => {
  const { item } = props;

  if (!item?.note) {
    return null;
  }

  return <Typography fontWeight={500}>{item.note}</Typography>;
};
