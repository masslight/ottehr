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

  const isSeenInLastThreeYearsField = (fhirField: string): boolean =>
    fhirField === 'seen-in-last-three-years' || fhirField === 'seen-in-last-3-years';

  const getQuestionnaireAnswer = (fhirField: string): string | null => {
    const response = getQuestionnaireResponseByLinkId(fhirField, questionnaireResponse);
    const stringAnswer = response?.answer?.[0]?.valueString;

    // special case for "Have you been seen" question: use booking form answer if present,
    // otherwise derive from returning-patient tag or previous visits
    if (isSeenInLastThreeYearsField(fhirField)) {
      if (shouldDisplayScreeningQuestion(stringAnswer)) {
        return formatScreeningQuestionValue(fhirField, stringAnswer);
      }
      const returningPatientFromAppointmentCreation = appointment?.meta?.tag?.some(
        (tag) =>
          tag.system === PATIENT_INFO_META_DATA_SYSTEM && tag.code === PATIENT_INFO_META_DATA_RETURNING_PATIENT_CODE
      );
      const patientHasPreviousVisits = chartData?.patientHasPreviousVisits;
      const answer = returningPatientFromAppointmentCreation || patientHasPreviousVisits || false;
      return formatScreeningQuestionValue(fhirField, answer);
    }

    if (!shouldDisplayScreeningQuestion(stringAnswer)) return null;

    return formatScreeningQuestionValue(fhirField, stringAnswer);
  };

  const renderQuestionAnswer = (field: any): React.ReactElement => {
    const answer = getQuestionnaireAnswer(field.fhirField);
    const isLoading = isAppointmentLoading || (isSeenInLastThreeYearsField(field.fhirField) ? chartDataLoading : false);

    return (
      <AdditionalQuestionView
        key={field.id}
        label={field.question}
        value={answer}
        isLoading={isLoading}
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
