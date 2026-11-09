import { Typography } from '@mui/material';
import { Box } from '@mui/system';
import { ReactElement } from 'react';
import { formResponseLines, hasAnyAnswer } from 'utils/lib/helpers/practice-managed-questionnaires';
import { StandaloneFormDTO } from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';

export const QuestionnaireResponseViewer = ({ form }: { form: StandaloneFormDTO }): ReactElement => {
  if (!hasAnyAnswer(form)) {
    return (
      <Typography variant="body2" color="text.secondary">
        Not Started
      </Typography>
    );
  }

  return (
    <Box>
      {formResponseLines(form).map(({ linkId, question, answer }) => (
        <Box key={linkId} sx={{ py: 0.5 }}>
          <Typography variant="body2">
            <Box component="span" sx={{ color: 'primary.dark' }}>
              {question}:
            </Box>{' '}
            {answer}
          </Typography>
        </Box>
      ))}
    </Box>
  );
};
