import { Box, Divider, Typography, useTheme } from '@mui/material';
import { FC, useCallback, useMemo, useState } from 'react';
import { PatientSideListSkeleton } from 'src/components/PatientSideListSkeleton';
import { dataTestIds } from 'src/constants/data-test-ids';
import AiSuggestion from 'src/features/visits/in-person/components/AiSuggestion';
import { splitAiValue, useAiSuggestionMapping } from 'src/features/visits/shared/hooks/useAiSuggestionMapping';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useAiSuggestionPrefillStore } from 'src/features/visits/shared/stores/aiSuggestionPrefill.store';
import { AiObservationField, getQuestionnaireResponseByLinkId, ObservationTextFieldDTO } from 'utils';
import { useAppointmentData, useChartData } from '../../../stores/appointment/appointment.store';

export const CurrentMedicationsPatientColumn: FC = () => {
  const theme = useTheme();
  const { questionnaireResponse, isAppointmentLoading } = useAppointmentData();
  const { chartData } = useChartData();
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const setMedicationPrefill = useAiSuggestionPrefillStore((s) => s.setMedicationPrefill);

  const currentMedications = getQuestionnaireResponseByLinkId('current-medications', questionnaireResponse)?.answer?.[0]
    .valueArray;

  const aiMedicationsHistory = chartData?.observations?.filter(
    (observation) => observation.field === AiObservationField.MedicationsHistory
  ) as ObservationTextFieldDTO[];

  const mappedSuggestions = useAiSuggestionMapping(aiMedicationsHistory, 'medications');
  const [appliedIndices, setAppliedIndices] = useState<Set<number>>(new Set());

  // Pre-populate applied indices for medications already in chart
  const effectiveAppliedIndices = useMemo(() => {
    const indices = new Set(appliedIndices);
    if (chartData?.medications && mappedSuggestions.length > 0) {
      mappedSuggestions.forEach((mapped, idx) => {
        if (mapped.mappedData && mapped.mappedData.section === 'medications') {
          const data = mapped.mappedData;
          const alreadyExists = chartData.medications?.some(
            (m) => m.name?.toLowerCase().includes(data.name.toLowerCase())
          );
          if (alreadyExists) indices.add(idx);
        }
      });
    }
    return indices;
  }, [appliedIndices, chartData?.medications, mappedSuggestions]);

  const handleSuggestionClick = useCallback(
    (index: number) => {
      const mapped = mappedSuggestions[index];
      if (!mapped?.mappedData || mapped.mappedData.section !== 'medications') return;

      const { section: _section, ...medicationData } = mapped.mappedData;
      setMedicationPrefill(medicationData);
      setAppliedIndices((prev) => new Set(prev).add(index));
    },
    [mappedSuggestions, setMedicationPrefill]
  );

  const expandedContent = useMemo(() => {
    return aiMedicationsHistory.flatMap((item) =>
      splitAiValue(item.value).map((v) => ({
        ...item,
        value: v,
      }))
    );
  }, [aiMedicationsHistory]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
      data-testid={dataTestIds.telemedEhrFlow.hpiCurrentMedicationsPatientProvidedList}
    >
      {isAppointmentLoading ? (
        <PatientSideListSkeleton />
      ) : currentMedications ? (
        currentMedications.map((answer, index, arr) => (
          <Box key={index}>
            <Typography>{answer['current-medications-form-medication']}</Typography>
            {index + 1 !== arr.length && <Divider sx={{ pt: 1 }} />}
          </Box>
        ))
      ) : (
        <Typography color={theme.palette.text.secondary}>Patient has no current medications</Typography>
      )}
      {expandedContent?.length > 0 && (
        <>
          <hr style={{ border: '0.5px solid #DFE5E9', margin: '0 -16px 0 -16px' }} />
          <AiSuggestion
            title={'Medications'}
            chartData={chartData}
            content={expandedContent}
            mappedSuggestions={mappedSuggestions}
            onSuggestionClick={!isReadOnly ? handleSuggestionClick : undefined}
            appliedIndices={effectiveAppliedIndices}
            hintArea="medications"
          />
        </>
      )}
    </Box>
  );
};
