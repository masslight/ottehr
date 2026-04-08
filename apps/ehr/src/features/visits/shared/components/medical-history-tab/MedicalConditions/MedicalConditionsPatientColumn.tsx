import { Box, Divider, Typography, useTheme } from '@mui/material';
import { FC, useCallback } from 'react';
import { PatientSideListSkeleton } from 'src/components/PatientSideListSkeleton';
import { dataTestIds } from 'src/constants/data-test-ids';
import AiSuggestion from 'src/features/visits/in-person/components/AiSuggestion';
import { useAiSuggestionApply } from 'src/features/visits/shared/hooks/useAiSuggestionApply';
import { MappedItemData } from 'src/features/visits/shared/hooks/useAiSuggestionMapping';
import { useChartDataArrayValue } from 'src/features/visits/shared/hooks/useChartDataArrayValue';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { AiObservationField, getQuestionnaireResponseByLinkId, ObservationTextFieldDTO } from 'utils';
import { useAppointmentData, useChartData } from '../../../stores/appointment/appointment.store';

export const MedicalConditionsPatientColumn: FC = () => {
  const theme = useTheme();
  const { questionnaireResponse, isAppointmentLoading } = useAppointmentData();
  const { chartData } = useChartData();
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  const medicalConditions = getQuestionnaireResponseByLinkId('medical-history', questionnaireResponse)?.answer?.[0]
    ?.valueArray;

  const aiPastMedicalHistory = chartData?.observations?.filter(
    (observation) => observation.field === AiObservationField.PastMedicalHistory
  ) as ObservationTextFieldDTO[];

  const { onSubmit, values: existingConditions, isDataReady } = useChartDataArrayValue('conditions');

  const isAlreadyApplied = useCallback(
    (mappedData: MappedItemData) => {
      if (mappedData.section !== 'conditions') return false;
      return existingConditions.some((c) => c.display?.toLowerCase() === mappedData.display.toLowerCase());
    },
    [existingConditions]
  );

  const onApply = useCallback(
    async (mappedData: MappedItemData) => {
      if (mappedData.section !== 'conditions') return;
      await onSubmit({
        code: mappedData.code,
        display: mappedData.display,
        current: true,
        lastUpdated: new Date().toISOString(),
      });
    },
    [onSubmit]
  );

  const { expandedContent, mappedSuggestions, effectiveAppliedIndices, handleSuggestionClick } = useAiSuggestionApply({
    aiObservations: aiPastMedicalHistory,
    section: 'conditions',
    isAlreadyApplied,
    onApply,
  });

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
      data-testid={dataTestIds.medicalConditions.medicalConditionPatientProvidedList}
    >
      {isAppointmentLoading ? (
        <PatientSideListSkeleton />
      ) : medicalConditions ? (
        medicalConditions.map((answer, index, arr) => (
          <Box key={index}>
            <Typography>{answer['medical-history-form-medical-condition']}</Typography>
            {index + 1 !== arr.length && <Divider sx={{ pt: 1 }} />}
          </Box>
        ))
      ) : (
        <Typography color={theme.palette.text.secondary}>Patient has no medical conditions</Typography>
      )}
      {expandedContent?.length > 0 && (
        <>
          <hr style={{ border: '0.5px solid #DFE5E9', margin: '0 -16px 0 -16px' }} />
          <AiSuggestion
            title={'Past Medical History (PMH)'}
            chartData={chartData}
            content={expandedContent}
            mappedSuggestions={mappedSuggestions}
            onSuggestionClick={!isReadOnly && isDataReady ? handleSuggestionClick : undefined}
            appliedIndices={effectiveAppliedIndices}
            hintArea="medical conditions"
          />
        </>
      )}
    </Box>
  );
};
