import React, { FC } from 'react';
import { Box, Divider } from '@mui/material';
import { convertToBoolean, getQuestionnaireResponseByLinkId } from 'utils';
import { AdditionalQuestionView } from '../components';
import { ADDITIONAL_QUESTIONS } from '../../../../../constants';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../state';

export const AdditionalQuestionsPatientColumn: FC = () => {
  const { questionnaireResponse, isAppointmentLoading } = getSelectors(useAppointmentStore, [
    'questionnaireResponse',
    'isAppointmentLoading',
  ]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      {ADDITIONAL_QUESTIONS.map((question, index) => {
        const value = getQuestionnaireResponseByLinkId(question.field, questionnaireResponse)?.answer?.[0]?.valueString;

        return (
          <React.Fragment key={question.field}>
            <AdditionalQuestionView
              label={question.label}
              value={convertToBoolean(value)}
              isLoading={isAppointmentLoading}
            />
            {index < ADDITIONAL_QUESTIONS.length - 1 && <Divider />}
          </React.Fragment>
        );
      })}
    </Box>
  );
};
