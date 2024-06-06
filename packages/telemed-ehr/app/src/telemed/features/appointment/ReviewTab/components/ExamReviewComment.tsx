import React, { FC } from 'react';
import { Typography } from '@mui/material';
import { ExamObservationDTO } from 'ehr-utils';

type ExamReviewCommentProps = {
  item: ExamObservationDTO;
};

export const ExamReviewComment: FC<ExamReviewCommentProps> = (props) => {
  const { item } = props;

  if (!item.note) {
    return null;
  }

  return <Typography fontWeight={700}>{item.note}</Typography>;
};
