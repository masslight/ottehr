import React, { FC } from 'react';
import { Box, Divider, Typography, useTheme } from '@mui/material';
import { getQuestionnaireResponseByLinkId, ObservationTextFieldDTO } from 'utils';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../state';
import { PatientSideListSkeleton } from '../PatientSideListSkeleton';
import { dataTestIds } from '../../../../../constants/data-test-ids';
import AiSuggestion from '../../../../../components/AiSuggestion';

export const KnownAllergiesPatientColumn: FC<{ noItemsMessage?: string }> = ({ noItemsMessage }) => {
  const theme = useTheme();

  const { questionnaireResponse, isAppointmentLoading, chartData } = getSelectors(useAppointmentStore, [
    'questionnaireResponse',
    'isAppointmentLoading',
    'chartData',
  ]);

  const knownAllergies = getQuestionnaireResponseByLinkId(
    'allergies',
    questionnaireResponse
  )?.answer?.[0]?.valueArray?.filter(
    (answer) => answer['allergies-form-agent-substance-medications'] || answer['allergies-form-agent-substance-other']
  );

  const aiAllergies = chartData?.observations?.find(
    (observation) => observation.field === 'allergies'
  ) as ObservationTextFieldDTO;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
      data-testid={dataTestIds.telemedEhrFlow.hpiKnownAllergiesPatientProvidedList}
    >
      {isAppointmentLoading ? (
        <PatientSideListSkeleton />
      ) : knownAllergies ? (
        knownAllergies.map((answer, index, arr) => (
          <Box key={index}>
            <Typography>
              {answer['allergies-form-agent-substance-medications'] || answer['allergies-form-agent-substance-other']} (
              {answer['allergies-form-agent-substance-medications'] ? 'medication' : 'other'})
            </Typography>
            {index + 1 !== arr.length && <Divider sx={{ pt: 1 }} />}
          </Box>
        ))
      ) : (
        <Typography color={theme.palette.text.secondary}>
          {noItemsMessage || 'Patient has no known allergies'}
        </Typography>
      )}
      {aiAllergies ? (
        <>
          <hr style={{ border: '0.5px solid #DFE5E9', margin: '0 -16px 0 -16px' }} />
          <AiSuggestion title={'Allergies'} content={aiAllergies.value} />
        </>
      ) : undefined}
    </Box>
  );
};
