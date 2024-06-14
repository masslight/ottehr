import React, { FC } from 'react';
import { Box, Typography } from '@mui/material';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../state';
import { getQuestionnaireResponseByLinkId } from 'ehr-utils';

export const AdditionalQuestionsContainer: FC = () => {
  const { questionnaireResponse } = getSelectors(useAppointmentStore, ['questionnaireResponse']);

  const fluVaccine = getQuestionnaireResponseByLinkId('flu-vaccine', questionnaireResponse)?.answer[0].valueString;
  const vaccinesUpToDate = getQuestionnaireResponseByLinkId('vaccines-up-to-date', questionnaireResponse)?.answer[0]
    .valueString;
  const travelUsa = getQuestionnaireResponseByLinkId('travel-usa', questionnaireResponse)?.answer[0].valueString;
  const hospitalize = getQuestionnaireResponseByLinkId('hospitalize', questionnaireResponse)?.answer[0].valueString;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      <Typography variant="h5" color="primary.dark">
        Additional questions
      </Typography>
      <Typography>Have you or your child had your flu vaccine? - {fluVaccine || 'Not provided'}</Typography>
      <Typography>Are your or your child&apos;s vaccines up to date? - {vaccinesUpToDate || 'Not provided'}</Typography>
      <Typography>Have you traveled out of the USA in the last 2 weeks? - {travelUsa || 'Not provided'}</Typography>
      <Typography>Has the patient been hospitalized in the past 6 months? - {hospitalize || 'Not provided'}</Typography>
    </Box>
  );
};
