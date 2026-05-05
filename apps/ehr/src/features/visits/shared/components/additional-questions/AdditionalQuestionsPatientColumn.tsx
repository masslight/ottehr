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

  // Fields participating in any flow (virtual or in-person).
  const questionnaireFields = patientScreeningQuestionsConfig.fields.filter((field) => field.flowConfig);

  const isSeenInLastThreeYearsField = (observationField: string): boolean =>
    observationField === 'seen-in-last-three-years' || observationField === 'seen-in-last-3-years';

  /**
   * Look up the patient's answer in the QR. The linkId differs per flow, so
   * we try both `flowConfig.<flow>.fhirField` values; only the flow that
   * produced this QR will match.
   */
  const getQuestionnaireAnswer = (field: { observationField: string; flowConfig?: any }): string | null => {
    const flowFhirFields = [field.flowConfig?.virtual?.fhirField, field.flowConfig?.inPerson?.fhirField].filter(
      (v): v is string => typeof v === 'string'
    );
    let stringAnswer: string | undefined;
    for (const linkId of flowFhirFields) {
      const response = getQuestionnaireResponseByLinkId(linkId, questionnaireResponse);
      stringAnswer = response?.answer?.[0]?.valueString;
      if (stringAnswer !== undefined) break;
    }

    // special case for "Have you been seen" question: use booking-form answer if
    // present, otherwise derive from returning-patient tag or previous visits.
    if (isSeenInLastThreeYearsField(field.observationField)) {
      if (shouldDisplayScreeningQuestion(stringAnswer)) {
        return formatScreeningQuestionValue(field.observationField, stringAnswer);
      }
      const returningPatientFromAppointmentCreation = appointment?.meta?.tag?.some(
        (tag) =>
          tag.system === PATIENT_INFO_META_DATA_SYSTEM && tag.code === PATIENT_INFO_META_DATA_RETURNING_PATIENT_CODE
      );
      const patientHasPreviousVisits = chartData?.patientHasPreviousVisits;
      const answer = returningPatientFromAppointmentCreation || patientHasPreviousVisits || false;
      return formatScreeningQuestionValue(field.observationField, answer);
    }

    if (!shouldDisplayScreeningQuestion(stringAnswer)) return null;
    return formatScreeningQuestionValue(field.observationField, stringAnswer);
  };

  const renderQuestionAnswer = (field: any): React.ReactElement => {
    const answer = getQuestionnaireAnswer(field);
    const isLoading =
      isAppointmentLoading || (isSeenInLastThreeYearsField(field.observationField) ? chartDataLoading : false);

    return (
      <AdditionalQuestionView
        key={field.id}
        label={field.question}
        value={answer}
        isLoading={isLoading}
        field={field.observationField as any}
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
