import { Box, Stack } from '@mui/material';
import React, { FC } from 'react';
import { IN_PERSON_EXAM_CARDS, InPersonExamCardsNames } from 'utils';
import { useGetAppointmentAccessibility } from '../../../telemed';
import { PageTitle } from '../../../telemed/components/PageTitle';
import {
  CollapsibleExamCardContainer,
  ExamCommentField,
  ExamFieldsFactory,
} from '../../../telemed/features/appointment';
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
        <Stack spacing={1}>
          <PageTitle label="Examination" showIntakeNotesButton={false} />
          {IN_PERSON_EXAM_CARDS.map((card) => (
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
          ))}
        </Stack>
      )}
    </Box>
  );
};
