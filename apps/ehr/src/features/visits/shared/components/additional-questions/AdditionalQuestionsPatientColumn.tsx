import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import {
  formatScreeningQuestionValue,
  getQuestionnaireResponseByLinkId,
  patientScreeningQuestionsConfig,
  shouldDisplayScreeningQuestion,
} from 'utils';
import { useAppointmentData } from '../../stores/appointment/appointment.store';
import { AdditionalQuestionView } from '../medical-history-tab/components/AdditionalQuestionRow';

export const AdditionalQuestionsPatientColumn: FC = () => {
  const { questionnaireResponse, isAppointmentLoading } = useAppointmentData();

  // Filter fields that exist in questionnaire
  const questionnaireFields = patientScreeningQuestionsConfig.fields.filter((field) => field.existsInQuestionnaire);

  const getQuestionnaireAnswer = (fhirField: string): string | null => {
    const response = getQuestionnaireResponseByLinkId(fhirField, questionnaireResponse);
    const stringAnswer = response?.answer?.[0]?.valueString;

    if (!shouldDisplayScreeningQuestion(stringAnswer)) return null;

    return formatScreeningQuestionValue(fhirField, stringAnswer);
  };

  const renderQuestionAnswer = (field: any): React.ReactElement => {
    const answer = getQuestionnaireAnswer(field.fhirField);

    return (
      <AdditionalQuestionView
        key={field.id}
        label={field.question}
        value={answer}
        isLoading={isAppointmentLoading}
        field={field.fhirField as any}
      />
    );
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      {questionnaireFields.length > 0 ? (
        questionnaireFields.map((field) => renderQuestionAnswer(field))
      ) : (
        <Typography variant="body2" color="text.secondary">
          No additional questions configured
        </Typography>
      )}
    </Box>
  );
};
