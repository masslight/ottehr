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

export const SurgicalHistoryPatientColumn: FC = () => {
  const theme = useTheme();
  const { questionnaireResponse, isAppointmentLoading } = useAppointmentData();
  const { chartData } = useChartData();
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  const surgicalHistory = getQuestionnaireResponseByLinkId('surgical-history', questionnaireResponse)?.answer?.[0]
    ?.valueArray;

  const aiPastSurgicalHistory = chartData?.observations?.filter(
    (observation) => observation.field === AiObservationField.PastSurgicalHistory
  ) as ObservationTextFieldDTO[];

  const {
    onSubmit,
    values: existingSurgicalHistory,
    isDataReady,
  } = useChartDataArrayValue('surgicalHistory', undefined, {});

  const isAlreadyApplied = useCallback(
    (mappedData: MappedItemData) => {
      if (mappedData.section !== 'surgicalHistory') return false;
      return existingSurgicalHistory.some((s) => s.display?.toLowerCase() === mappedData.display.toLowerCase());
    },
    [existingSurgicalHistory]
  );

  const onApply = useCallback(
    async (mappedData: MappedItemData) => {
      if (mappedData.section !== 'surgicalHistory') return;
      await onSubmit({
        code: mappedData.code,
        display: mappedData.display,
      });
    },
    [onSubmit]
  );

  const { expandedContent, mappedSuggestions, effectiveAppliedIndices, handleSuggestionClick } = useAiSuggestionApply({
    aiObservations: aiPastSurgicalHistory,
    section: 'surgicalHistory',
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
      data-testid={dataTestIds.telemedEhrFlow.hpiSurgicalHistoryPatientProvidedList}
    >
      {isAppointmentLoading ? (
        <PatientSideListSkeleton />
      ) : surgicalHistory ? (
        surgicalHistory.map((answer, index, arr) => (
          <Box key={index}>
            <Typography>{answer['surgical-history-form-type']}</Typography>
            {index + 1 !== arr.length && <Divider sx={{ pt: 1 }} />}
          </Box>
        ))
      ) : (
        <Typography color={theme.palette.text.secondary}>Patient has no surgical history</Typography>
      )}
      {expandedContent?.length > 0 && (
        <>
          <hr style={{ border: '0.5px solid #DFE5E9', margin: '0 -16px 0 -16px' }} />
          <AiSuggestion
            title={'Past Surgical History (PSH)'}
            chartData={chartData}
            content={expandedContent}
            mappedSuggestions={mappedSuggestions}
            onSuggestionClick={!isReadOnly && isDataReady ? handleSuggestionClick : undefined}
            appliedIndices={effectiveAppliedIndices}
            hintArea="surgical history"
          />
        </>
      )}
    </Box>
  );
};
