import { Box, Divider, Typography, useTheme } from '@mui/material';
import { FC, useCallback, useMemo, useState } from 'react';
import { PatientSideListSkeleton } from 'src/components/PatientSideListSkeleton';
import { parseAiValue, useAiSuggestionMapping } from 'src/features/visits/shared/hooks/useAiSuggestionMapping';
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

  const expandedContent = useMemo(() => {
    if (!aiHospitalizations) return [];
    return aiHospitalizations.flatMap((item) =>
      parseAiValue(item.value, 'episodeOfCare').map((v) => ({
        ...item,
        value: v,
      }))
    );
  }, [aiHospitalizations]);

  const mappedSuggestions = useAiSuggestionMapping(aiHospitalizations, 'episodeOfCare');
  const { onSubmit, values: existingHospitalizations } = useChartDataArrayValue('episodeOfCare', undefined, {});
  const [appliedIndices, setAppliedIndices] = useState<Set<number>>(new Set());

  const effectiveAppliedIndices = useMemo(() => {
    const indices = new Set(appliedIndices);
    if (existingHospitalizations.length > 0 && mappedSuggestions.length > 0) {
      mappedSuggestions.forEach((mapped, idx) => {
        if (mapped.mappedData && mapped.mappedData.section === 'episodeOfCare') {
          const data = mapped.mappedData;
          const alreadyExists = existingHospitalizations.some(
            (h) => h.display?.toLowerCase() === data.display.toLowerCase()
          );
          if (alreadyExists) indices.add(idx);
        }
      });
    }
    return indices;
  }, [appliedIndices, existingHospitalizations, mappedSuggestions]);

  const handleSuggestionClick = useCallback(
    async (index: number) => {
      const mapped = mappedSuggestions[index];
      if (!mapped?.mappedData || mapped.mappedData.section !== 'episodeOfCare') return;

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
            onSuggestionClick={!isReadOnly ? handleSuggestionClick : undefined}
            appliedIndices={effectiveAppliedIndices}
            hintArea="hospitalizations"
          />
        </>
      )}
    </Box>
  );
};
