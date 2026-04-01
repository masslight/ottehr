import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import {
  formatScreeningQuestionValue,
  getQuestionnaireResponseByLinkId,
  PATIENT_INFO_META_DATA_RETURNING_PATIENT_CODE,
  PATIENT_INFO_META_DATA_SYSTEM,
  patientScreeningQuestionsConfig,
  shouldDisplayScreeningQuestion,
} from 'utils';
import { useAppointmentData, useChartData } from '../../stores/appointment/appointment.store';
import { AdditionalQuestionView } from '../medical-history-tab/components/AdditionalQuestionRow';

export const AdditionalQuestionsPatientColumn: FC = () => {
  const { questionnaireResponse, isAppointmentLoading, appointment } = useAppointmentData();

  const { chartData, isLoading: chartDataLoading } = useChartData();

  // Filter fields that exist in questionnaire
  const questionnaireFields = patientScreeningQuestionsConfig.fields.filter((field) => field.existsInQuestionnaire);

  const getQuestionnaireAnswer = (fhirField: string): string | null => {
    const response = getQuestionnaireResponseByLinkId(fhirField, questionnaireResponse);
    const stringAnswer = response?.answer?.[0]?.valueString;

    if (!shouldDisplayScreeningQuestion(stringAnswer)) return null;

    // special case for "Have you been seen" question to show answer from booking form or "Yes" for returning patients
    if (fhirField === 'seen-in-last-three-years' || fhirField === 'seen-in-last-3-years') {
      if (chartDataLoading) return 'Loading...';
      const newPatientFromAppointmentCreation = appointment?.meta?.tag?.some(
        (tag) =>
          tag.system === PATIENT_INFO_META_DATA_SYSTEM && tag.code !== PATIENT_INFO_META_DATA_RETURNING_PATIENT_CODE
      );

      const patientHasPreviousVisits = chartData?.patientHasPreviousVisits;

      let answer = false;
      if (newPatientFromAppointmentCreation || patientHasPreviousVisits) {
        answer = true;
      }
      return formatScreeningQuestionValue(fhirField, answer);
    }

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
