import { Box, Divider, Typography, useTheme } from '@mui/material';
import { FC, ReactElement } from 'react';
import { AiObservationField, getQuestionnaireResponseByLinkId, ObservationTextFieldDTO } from 'utils';
import AiSuggestion from '../../../../../components/AiSuggestion';
import { dataTestIds } from '../../../../../constants/data-test-ids';
import { useAppointmentData, useChartData } from '../../../../state';
import { PatientSideListSkeleton } from '../PatientSideListSkeleton';

export const KnownAllergiesPatientColumn: FC = () => {
  const theme = useTheme();
  const { questionnaireResponse, isAppointmentLoading } = useAppointmentData();
  const { chartData } = useChartData();

  const knownAllergies = getQuestionnaireResponseByLinkId(
    'allergies',
    questionnaireResponse
  )?.answer?.[0]?.valueArray?.filter(
    (answer) => answer['allergies-form-agent-substance-medications'] || answer['allergies-form-agent-substance-other']
  );

  const aiAllergies = chartData?.observations?.find(
    (observation) => observation.field === AiObservationField.Allergies
  ) as ObservationTextFieldDTO;

  const isInPersonPaperwork = questionnaireResponse?.questionnaire?.startsWith(
    'https://ottehr.com/FHIR/Questionnaire/intake-paperwork-inperson'
  );

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
      data-testid={dataTestIds.telemedEhrFlow.hpiKnownAllergiesPatientProvidedList}
    >
      {renderAllergies()}
      {aiAllergies ? (
        <>
          <hr style={{ border: '0.5px solid #DFE5E9', margin: '0 -16px 0 -16px' }} />
          <AiSuggestion title={'Allergies'} content={aiAllergies.value} />
        </>
      ) : undefined}
    </Box>
  );
};
