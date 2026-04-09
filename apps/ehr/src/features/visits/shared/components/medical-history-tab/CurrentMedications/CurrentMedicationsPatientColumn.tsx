import { Box, Divider, Typography, useTheme } from '@mui/material';
import { FC, useCallback } from 'react';
import { PatientSideListSkeleton } from 'src/components/PatientSideListSkeleton';
import { dataTestIds } from 'src/constants/data-test-ids';
import AiSuggestion from 'src/features/visits/in-person/components/AiSuggestion';
import { useAiSuggestionApply } from 'src/features/visits/shared/hooks/useAiSuggestionApply';
import {
  extractDateFromValue,
  extractDoseFromValue,
  MappedItemData,
} from 'src/features/visits/shared/hooks/useAiSuggestionMapping';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useAiSuggestionPrefillStore } from 'src/features/visits/shared/stores/aiSuggestionPrefill.store';
import { AiObservationField, getQuestionnaireResponseByLinkId, MedicationDTO, ObservationTextFieldDTO } from 'utils';
import { useAppointmentData, useChartData } from '../../../stores/appointment/appointment.store';
import { ExternalMedicationSelection, ExternalRxSuggestions } from './ExternalRxSuggestions';

interface CurrentMedicationsPatientColumnProps {
  chartedMedications?: MedicationDTO[];
  onSelectMedication?: (selection: ExternalMedicationSelection) => void;
}

export const CurrentMedicationsPatientColumn: FC<CurrentMedicationsPatientColumnProps> = ({
  chartedMedications = [],
  onSelectMedication,
}) => {
  const theme = useTheme();
  const { questionnaireResponse, isAppointmentLoading } = useAppointmentData();
  const { chartData } = useChartData();
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const setMedicationPrefill = useAiSuggestionPrefillStore((s) => s.setMedicationPrefill);
  const medicationPrefill = useAiSuggestionPrefillStore((s) => s.medicationPrefill);

  const currentMedications = getQuestionnaireResponseByLinkId('current-medications', questionnaireResponse)?.answer?.[0]
    .valueArray;

  const aiMedicationsHistory = chartData?.observations?.filter(
    (observation) => observation.field === AiObservationField.MedicationsHistory
  ) as ObservationTextFieldDTO[];

  const isAlreadyApplied = useCallback(
    (mappedData: MappedItemData) => {
      if (mappedData.section !== 'medications') return false;
      const inChart = !!chartData?.medications?.some(
        (m) => m.name?.toLowerCase().includes(mappedData.name.toLowerCase())
      );
      const isPrefilled = !!medicationPrefill?.medication?.name?.toLowerCase().includes(mappedData.name.toLowerCase());
      return inChart || isPrefilled;
    },
    [chartData?.medications, medicationPrefill]
  );

  const onApply = useCallback(
    (_mappedData: MappedItemData, originalValue: string) => {
      if (_mappedData.section !== 'medications') return;
      const { section: _section, ...medicationData } = _mappedData;
      const dose = extractDoseFromValue(originalValue);
      const date = extractDateFromValue(originalValue);
      setMedicationPrefill({ medication: medicationData, dose, date });
    },
    [setMedicationPrefill]
  );

  const { expandedContent, mappedSuggestions, effectiveAppliedIndices, handleSuggestionClick } = useAiSuggestionApply({
    aiObservations: aiMedicationsHistory,
    section: 'medications',
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
      <hr style={{ border: '0.5px solid #DFE5E9', margin: '0 -16px 0 -16px' }} />
      <ExternalRxSuggestions chartedMedications={chartedMedications} onSelectMedication={onSelectMedication} />
    </Box>
  );
};
