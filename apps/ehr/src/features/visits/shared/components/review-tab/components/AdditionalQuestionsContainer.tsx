import { Box, Typography } from '@mui/material';
import React, { FC } from 'react';
import { AssessmentTitle } from 'src/components/AssessmentTitle';
import { dataTestIds } from 'src/constants/data-test-ids';
import {
  ASQ_FIELD,
  ASQKeys,
  asqLabels,
  Field,
  formatScreeningQuestionWithNote,
  NoteDTO,
  patientScreeningQuestionsConfig,
  shouldDisplayScreeningQuestion,
} from 'utils';
import { useChartData } from '../../../stores/appointment/appointment.store';

type AdditionalQuestionsContainerProps = {
  notes?: NoteDTO[];
};

export const AdditionalQuestionsContainer: FC<AdditionalQuestionsContainerProps> = ({ notes }) => {
  const { chartData } = useChartData();

  const getObservationByField = (field: string): any => {
    return chartData?.observations?.find((obs) => obs.field === field);
  };

  const renderFieldValue = (field: Field): React.ReactElement | null => {
    const observation = getObservationByField(field.fhirField);
    if (!shouldDisplayScreeningQuestion(observation?.value)) return null;

    const formattedValue = formatScreeningQuestionWithNote(field.fhirField, observation);
    if (!formattedValue) return null;

    return (
      <Box key={field.id} data-testid={dataTestIds.telemedEhrFlow.reviewTabAdditionalQuestion(field.fhirField)}>
        <Typography>{`${field.question} - ${formattedValue}`}</Typography>
      </Box>
    );
  };

  const currentASQObs = chartData?.observations?.find((obs) => obs.field === ASQ_FIELD);

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}
      data-testid={dataTestIds.progressNotePage.additionalQuestions}
    >
      <Typography variant="h5" color="primary.dark">
        Additional questions
      </Typography>

      {/* Render all fields from config */}
      {patientScreeningQuestionsConfig.fields.map((field) => renderFieldValue(field))}

      {/* Keep ASQ as it's not part of the screening config yet */}
      {currentASQObs && <Typography>{`ASQ - ${asqLabels[currentASQObs.value as ASQKeys]}`}</Typography>}

      {notes && notes.length > 0 && (
        <>
          <AssessmentTitle>Screening notes</AssessmentTitle>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {notes?.map((note) => <Typography key={note.resourceId}>{note.text}</Typography>)}
          </Box>
        </>
      )}
    </Box>
  );
};
