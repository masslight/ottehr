import { Box, Divider, Typography, useTheme } from '@mui/material';
import { FC, useCallback, useMemo, useState } from 'react';
import { PatientSideListSkeleton } from 'src/components/PatientSideListSkeleton';
import { dataTestIds } from 'src/constants/data-test-ids';
import AiSuggestion from 'src/features/visits/in-person/components/AiSuggestion';
import { splitAiValue, useAiSuggestionMapping } from 'src/features/visits/shared/hooks/useAiSuggestionMapping';
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

  const expandedContent = useMemo(() => {
    if (!aiPastMedicalHistory) return [];
    return aiPastMedicalHistory.flatMap((item) =>
      splitAiValue(item.value).map((v) => ({
        ...item,
        value: v,
      }))
    );
  }, [aiPastMedicalHistory]);

  const mappedSuggestions = useAiSuggestionMapping(aiPastMedicalHistory, 'conditions');
  const { onSubmit, values: existingConditions } = useChartDataArrayValue('conditions');
  const [appliedIndices, setAppliedIndices] = useState<Set<number>>(new Set());

  const effectiveAppliedIndices = useMemo(() => {
    const indices = new Set(appliedIndices);
    if (existingConditions.length > 0 && mappedSuggestions.length > 0) {
      mappedSuggestions.forEach((mapped, idx) => {
        if (mapped.mappedData && mapped.mappedData.section === 'conditions') {
          const data = mapped.mappedData;
          const alreadyExists = existingConditions.some((c) => c.display?.toLowerCase() === data.display.toLowerCase());
          if (alreadyExists) indices.add(idx);
        }
      });
    }
    return indices;
  }, [appliedIndices, existingConditions, mappedSuggestions]);

  const handleSuggestionClick = useCallback(
    async (index: number) => {
      const mapped = mappedSuggestions[index];
      if (!mapped?.mappedData || mapped.mappedData.section !== 'conditions') return;

      setAppliedIndices((prev) => new Set(prev).add(index));
      try {
        await onSubmit({
          code: mapped.mappedData.code,
          display: mapped.mappedData.display,
          current: true,
          lastUpdated: new Date().toISOString(),
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
            onSuggestionClick={!isReadOnly ? handleSuggestionClick : undefined}
            appliedIndices={effectiveAppliedIndices}
            hintArea="medical conditions"
          />
        </>
      )}
    </Box>
  );
};
