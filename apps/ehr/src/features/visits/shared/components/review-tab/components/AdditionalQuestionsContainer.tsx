import { Box, Typography, useTheme } from '@mui/material';
import React, { FC } from 'react';
import { AssessmentTitle } from 'src/components/AssessmentTitle';
import { dataTestIds } from 'src/constants/data-test-ids';
import {
  SectionHeading,
  useNoteSectionTitleInCardHeader,
} from 'src/features/visits/shared/components/NoteSectionHeading';
import {
  formatScreeningQuestionWithNote,
  shouldDisplayScreeningQuestion,
} from 'utils/lib/helpers/screening-questions/screening-questions-formatting.helper';
import { patientScreeningQuestionsConfig } from 'utils/lib/ottehr-config/screening-questions';
import { ASQ_FIELD, ASQKeys, asqLabels } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { NoteDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { Field } from 'utils/lib/types/data/screening-questions/types';
import { useChartData } from '../../../stores/appointment/appointment.store';

type AdditionalQuestionsContainerProps = {
  notes?: NoteDTO[];
  emptyMessage?: string;
};

export const AdditionalQuestionsContainer: FC<AdditionalQuestionsContainerProps> = ({ notes, emptyMessage }) => {
  const titleInCardHeader = useNoteSectionTitleInCardHeader();
  const { chartData } = useChartData();
  const theme = useTheme();

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
      {!titleInCardHeader && <SectionHeading>Screening questions</SectionHeading>}

      {emptyMessage && !chartData?.observations?.length && !notes?.length && (
        <Typography color={theme.palette.text.secondary}>{emptyMessage}</Typography>
      )}

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
