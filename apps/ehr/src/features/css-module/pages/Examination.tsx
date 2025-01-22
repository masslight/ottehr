import React, { FC } from 'react';
import { Box } from '@mui/material';
import { InPersonExamCardsNames, IN_PERSON_EXAM_CARDS } from 'utils';
import {
  CollapsibleExamCardContainer,
  ExamCommentField,
  ExamFieldsFactory,
} from '../../../telemed/features/appointment';
import { useGetAppointmentAccessibility } from '../../../telemed';
import { ExamReadOnly } from '../components/examination/ExamReadOnly';

export const Examination: FC = () => {
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      {isReadOnly ? (
        <ExamReadOnly />
      ) : (
        IN_PERSON_EXAM_CARDS.map((card) => (
          <CollapsibleExamCardContainer
            key={card}
            label={String(card).charAt(0).toUpperCase() + String(card).slice(1)}
            cardName={card}
            rightComponent={
              <ExamCommentField<InPersonExamCardsNames> name={`${card}-comment` as InPersonExamCardsNames} />
            }
            grid={[
              {
                Normal: <ExamFieldsFactory card={card} group="normal" />,
                Abnormal: <ExamFieldsFactory card={card} group="abnormal" />,
              },
            ]}
          />
        ))
      )}
    </Box>
  );
};
