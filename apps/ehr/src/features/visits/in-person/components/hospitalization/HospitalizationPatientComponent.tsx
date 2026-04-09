import { Box, Divider, Typography, useTheme } from '@mui/material';
import { FC, useCallback } from 'react';
import { PatientSideListSkeleton } from 'src/components/PatientSideListSkeleton';
import { useAiSuggestionApply } from 'src/features/visits/shared/hooks/useAiSuggestionApply';
import { MappedItemData } from 'src/features/visits/shared/hooks/useAiSuggestionMapping';
import { useChartDataArrayValue } from 'src/features/visits/shared/hooks/useChartDataArrayValue';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useAppointmentData, useChartData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { AiObservationField, ObservationTextFieldDTO } from 'utils';
import AiSuggestion from '../AiSuggestion';

export const HospitalizationPatientComponent: FC = () => {
  const theme = useTheme();
  const { isAppointmentLoading, mappedData: questionnaire } = useAppointmentData();
  const { chartData } = useChartData();
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const hospitalizations = questionnaire.hospitalizations;

  const aiHospitalizations = chartData?.observations?.filter(
    (observation) => observation.field === AiObservationField.HospitalizationsHistory
  ) as ObservationTextFieldDTO[];

  const {
    onSubmit,
    values: existingHospitalizations,
    isDataReady,
  } = useChartDataArrayValue('episodeOfCare', undefined, {});

  const isAlreadyApplied = useCallback(
    (mappedData: MappedItemData) => {
      if (mappedData.section !== 'episodeOfCare') return false;
      return existingHospitalizations.some((h) => h.display?.toLowerCase() === mappedData.display.toLowerCase());
    },
    [existingHospitalizations]
  );

  const onApply = useCallback(
    async (mappedData: MappedItemData) => {
      if (mappedData.section !== 'episodeOfCare') return;
      await onSubmit({
        code: mappedData.code,
        display: mappedData.display,
      });
    },
    [onSubmit]
  );

  const { expandedContent, mappedSuggestions, effectiveAppliedIndices, handleSuggestionClick } = useAiSuggestionApply({
    aiObservations: aiHospitalizations,
    section: 'episodeOfCare',
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
    >
      {isAppointmentLoading ? (
        <PatientSideListSkeleton />
      ) : hospitalizations?.length ? (
        hospitalizations.map((answer, index, arr) => (
          <Box key={index}>
            <Typography>{answer}</Typography>
            {index + 1 !== arr.length && <Divider sx={{ pt: 1 }} />}
          </Box>
        ))
      ) : (
        <Typography color={theme.palette.text.secondary}>Patient has no hospitalization</Typography>
      )}
      {expandedContent?.length > 0 && (
        <>
          <hr style={{ border: '0.5px solid #DFE5E9', margin: '0 -16px 0 -16px' }} />
          <AiSuggestion
            title={'Hospitalization'}
            chartData={chartData}
            content={expandedContent}
            mappedSuggestions={mappedSuggestions}
            onSuggestionClick={!isReadOnly && isDataReady ? handleSuggestionClick : undefined}
            appliedIndices={effectiveAppliedIndices}
            hintArea="hospitalizations"
          />
        </>
      )}
    </Box>
  );
};
