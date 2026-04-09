import { Box, Divider, Typography, useTheme } from '@mui/material';
import { FC, ReactElement, useCallback } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import AiSuggestion from 'src/features/visits/in-person/components/AiSuggestion';
import { useAiSuggestionApply } from 'src/features/visits/shared/hooks/useAiSuggestionApply';
import { MappedItemData } from 'src/features/visits/shared/hooks/useAiSuggestionMapping';
import { useChartDataArrayValue } from 'src/features/visits/shared/hooks/useChartDataArrayValue';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { AiObservationField, getQuestionnaireResponseByLinkId, ObservationTextFieldDTO } from 'utils';
import { PatientSideListSkeleton } from '../../../../../components/PatientSideListSkeleton';
import { useAppointmentData, useChartData } from '../../stores/appointment/appointment.store';

export const KnownAllergiesPatientColumn: FC = () => {
  const theme = useTheme();
  const { questionnaireResponse, isAppointmentLoading } = useAppointmentData();
  const { chartData } = useChartData();
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  const knownAllergies = getQuestionnaireResponseByLinkId(
    'allergies',
    questionnaireResponse
  )?.answer?.[0]?.valueArray?.filter(
    (answer) => answer['allergies-form-agent-substance-medications'] || answer['allergies-form-agent-substance-other']
  );

  const aiAllergies = chartData?.observations?.filter(
    (observation) => observation.field === AiObservationField.Allergies
  ) as ObservationTextFieldDTO[];

  const isInPersonPaperwork = questionnaireResponse?.questionnaire?.startsWith(
    'https://ottehr.com/FHIR/Questionnaire/intake-paperwork-inperson'
  );

  const { onSubmit, values: existingAllergies, isDataReady } = useChartDataArrayValue('allergies');

  const isAlreadyApplied = useCallback(
    (mappedData: MappedItemData) => {
      if (mappedData.section !== 'allergies') return false;
      return existingAllergies.some((a) => a.name?.toLowerCase() === mappedData.name.toLowerCase());
    },
    [existingAllergies]
  );

  const onApply = useCallback(
    async (mappedData: MappedItemData) => {
      if (mappedData.section !== 'allergies') return;
      await onSubmit({
        name: mappedData.name,
        id: mappedData.id,
        current: true,
        lastUpdated: new Date().toISOString(),
      });
    },
    [onSubmit]
  );

  const { expandedContent, mappedSuggestions, effectiveAppliedIndices, handleSuggestionClick } = useAiSuggestionApply({
    aiObservations: aiAllergies,
    section: 'allergies',
    isAlreadyApplied,
    onApply,
  });

  const renderAllergies = (): ReactElement | ReactElement[] => {
    if (isAppointmentLoading) {
      return <PatientSideListSkeleton />;
    }
    if (questionnaireResponse == null || questionnaireResponse.status === 'in-progress' || isInPersonPaperwork) {
      return <Typography color={theme.palette.text.secondary}>No answer</Typography>;
    }
    if (knownAllergies == null || knownAllergies?.length === 0) {
      return <Typography color={theme.palette.text.secondary}>Patient has no known allergies</Typography>;
    }
    return knownAllergies.map((answer, index, arr) => (
      <Box key={index}>
        <Typography>
          {answer['allergies-form-agent-substance-medications'] || answer['allergies-form-agent-substance-other']} (
          {answer['allergies-form-agent-substance-medications'] ? 'medication' : 'other'})
        </Typography>
        {index + 1 !== arr.length && <Divider sx={{ pt: 1 }} />}
      </Box>
    ));
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
      data-testid={dataTestIds.allergies.knownAllergiesPatientProvidedList}
    >
      {renderAllergies()}

      {expandedContent?.length > 0 && (
        <>
          <hr style={{ border: '0.5px solid #DFE5E9', margin: '0 -16px 0 -16px' }} />
          <AiSuggestion
            title={'Allergies'}
            chartData={chartData}
            content={expandedContent}
            mappedSuggestions={mappedSuggestions}
            onSuggestionClick={!isReadOnly && isDataReady ? handleSuggestionClick : undefined}
            appliedIndices={effectiveAppliedIndices}
            hintArea="allergies"
          />
        </>
      )}
    </Box>
  );
};
