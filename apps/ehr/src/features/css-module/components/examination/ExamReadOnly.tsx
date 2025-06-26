import { Box } from '@mui/material';
import React, { FC } from 'react';
import { IN_PERSON_EXAM_CARDS, inPersonExamObservationFieldsDetailsArray } from 'utils';
import { AccordionCard, useInPersonExamObservationsStore } from '../../../../telemed';
import { ExamReviewComment, ExamReviewGroup } from '../../../../telemed/features/appointment/ReviewTab';

export const ExamReadOnly: FC = () => {
  return (
    <AccordionCard label="Examination">
      <Box
        sx={{
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        <ExamReadOnlyBlock />
      </Box>
    </AccordionCard>
  );
};

export const ExamReadOnlyBlock: FC = () => {
  const examObservations = useInPersonExamObservationsStore();

  return (
    <>
      {IN_PERSON_EXAM_CARDS.map((card) => (
        <React.Fragment key={card}>
          <ExamReviewGroup
            label={`${String(card).charAt(0).toUpperCase() + String(card).slice(1)}:`}
            items={inPersonExamObservationFieldsDetailsArray
              .filter((details) => details.card === card)
              .filter((details) => examObservations[details.field].value)}
          />

          <ExamReviewComment item={examObservations[`${card}-comment`]} />
        </React.Fragment>
      ))}
    </>
  );
};
