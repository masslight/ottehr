import { Box, Typography } from '@mui/material';
import { Appointment } from 'fhir/r4b';
import { FC } from 'react';
import { hasReturningPatientTag } from 'utils/lib/helpers/screening-questions/new-patient.helper';
import {
  formatScreeningQuestionValue,
  getPaperworkScreeningAnswer,
} from 'utils/lib/helpers/screening-questions/screening-questions-formatting.helper';
import { patientScreeningQuestionsConfig } from 'utils/lib/ottehr-config/screening-questions';
import {
  PATIENT_SEEN_IN_LAST_THREE_YEARS_FIELD,
  SEEN_IN_LAST_THREE_YEARS_FIELD,
} from 'utils/lib/types/data/screening-questions/constants';
import { useChartData } from '../../hooks/useChartData';
import { ChartDataResponse, useAppointmentData } from '../../stores/appointment/appointment.store';
import { AdditionalQuestionView } from '../medical-history-tab/components/AdditionalQuestionRow';

function getReturningPatient(chartData: ChartDataResponse | undefined, appointment: Appointment | undefined): boolean {
  return hasReturningPatientTag(appointment) || chartData?.patientHasPreviousVisits || false;
}

export const AdditionalQuestionsPatientColumn: FC = () => {
  const { questionnaireResponse, isAppointmentLoading, appointment } = useAppointmentData();

  const { chartData, isLoading: chartDataLoading } = useChartData();

  // Filter fields that exist in questionnaire
  const questionnaireFields = patientScreeningQuestionsConfig.fields.filter((field) => field.existsInQuestionnaire);

  const isSeenInLastThreeYearsField = (fhirField: string): boolean =>
    fhirField === SEEN_IN_LAST_THREE_YEARS_FIELD || fhirField === PATIENT_SEEN_IN_LAST_THREE_YEARS_FIELD;

  const getQuestionnaireAnswer = (fhirField: string): string | null => {
    const paperworkAnswer = getPaperworkScreeningAnswer(fhirField, questionnaireResponse);

    // special case for "Have you been seen" question: use booking form answer if present,
    // otherwise derive from returning-patient tag or previous visits
    if (isSeenInLastThreeYearsField(fhirField) && paperworkAnswer === null) {
      const answer = getReturningPatient(chartData, appointment);
      return formatScreeningQuestionValue(fhirField, answer);
    }

    return paperworkAnswer;
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
