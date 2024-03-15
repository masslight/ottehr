import React, { FC } from 'react';
import { Box, Divider, Skeleton, Typography } from '@mui/material';
import { getQuestionnaireResponseByLinkId } from 'ehr-utils';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../state';

export const AdditionalQuestionsPatientColumn: FC = () => {
  const { questionnaireResponse, isAppointmentLoading } = getSelectors(useAppointmentStore, [
    'questionnaireResponse',
    'isAppointmentLoading',
  ]);

  const fluVaccine = getQuestionnaireResponseByLinkId('flu-vaccine', questionnaireResponse)?.answer[0].valueString;
  const vaccinesUpToDate = getQuestionnaireResponseByLinkId('vaccines-up-to-date', questionnaireResponse)?.answer[0]
    .valueString;
  const travelUsa = getQuestionnaireResponseByLinkId('travel-usa', questionnaireResponse)?.answer[0].valueString;
  const hospitalize = getQuestionnaireResponseByLinkId('hospitalize', questionnaireResponse)?.answer[0].valueString;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <Typography>Have you or your child had your flu vaccine?</Typography>
        {isAppointmentLoading ? (
          <Skeleton>
            <Typography>Yes</Typography>
          </Skeleton>
        ) : (
          <Typography>{fluVaccine}</Typography>
        )}
      </Box>
      <Divider />
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <Typography>Are your or your child&apos;s vaccines up to date?</Typography>
        {isAppointmentLoading ? (
          <Skeleton>
            <Typography>Yes</Typography>
          </Skeleton>
        ) : (
          <Typography>{vaccinesUpToDate}</Typography>
        )}
      </Box>
      <Divider />
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <Typography>Have you traveled out of the USA in the last 2 weeks?</Typography>
        {isAppointmentLoading ? (
          <Skeleton>
            <Typography>Yes</Typography>
          </Skeleton>
        ) : (
          <Typography>{travelUsa}</Typography>
        )}
      </Box>
      <Divider />
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <Typography>Has the patient been hospitalized in the past 6 months?</Typography>
        {isAppointmentLoading ? (
          <Skeleton>
            <Typography>Yes</Typography>
          </Skeleton>
        ) : (
          <Typography>{hospitalize}</Typography>
        )}
      </Box>
    </Box>
  );
};
