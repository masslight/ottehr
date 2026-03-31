import { Box, Divider, Typography, useTheme } from '@mui/material';
import { FC, useCallback, useMemo, useState } from 'react';
import { PatientSideListSkeleton } from 'src/components/PatientSideListSkeleton';
import { dataTestIds } from 'src/constants/data-test-ids';
import AiSuggestion from 'src/features/visits/in-person/components/AiSuggestion';
import { parseAiValue, useAiSuggestionMapping } from 'src/features/visits/shared/hooks/useAiSuggestionMapping';
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

  const expandedContent = useMemo(() => {
    if (!aiPastSurgicalHistory) return [];
    return aiPastSurgicalHistory.flatMap((item) =>
      parseAiValue(item.value, 'surgicalHistory').map((v) => ({
        ...item,
        value: v,
      }))
    );
  }, [aiPastSurgicalHistory]);

  const mappedSuggestions = useAiSuggestionMapping(aiPastSurgicalHistory, 'surgicalHistory');
  const { onSubmit, values: existingSurgicalHistory } = useChartDataArrayValue('surgicalHistory', undefined, {});
  const [appliedIndices, setAppliedIndices] = useState<Set<number>>(new Set());

  const effectiveAppliedIndices = useMemo(() => {
    const indices = new Set(appliedIndices);
    if (existingSurgicalHistory.length > 0 && mappedSuggestions.length > 0) {
      mappedSuggestions.forEach((mapped, idx) => {
        if (mapped.mappedData && mapped.mappedData.section === 'surgicalHistory') {
          const data = mapped.mappedData;
          const alreadyExists = existingSurgicalHistory.some(
            (s) => s.display?.toLowerCase() === data.display.toLowerCase()
          );
          if (alreadyExists) indices.add(idx);
        }
      });
    }
    return indices;
  }, [appliedIndices, existingSurgicalHistory, mappedSuggestions]);

  const handleSuggestionClick = useCallback(
    async (index: number) => {
      const mapped = mappedSuggestions[index];
      if (!mapped?.mappedData || mapped.mappedData.section !== 'surgicalHistory') return;

      setAppliedIndices((prev) => new Set(prev).add(index));
      try {
        await onSubmit({
          code: mapped.mappedData.code,
          display: mapped.mappedData.display,
        });
      } catch {
        setAppliedIndices((prev) => {
          const next = new Set(prev);
          next.delete(index);
          return next;
        });
      }
    },
    [mappedSuggestions, onSubmit]
  );

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
            onSuggestionClick={!isReadOnly ? handleSuggestionClick : undefined}
            appliedIndices={effectiveAppliedIndices}
            hintArea="surgical history"
          />
        </>
      )}
    </Box>
  );
};
