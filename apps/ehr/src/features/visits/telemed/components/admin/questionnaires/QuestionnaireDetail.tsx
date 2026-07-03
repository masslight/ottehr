import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Box, Button, CircularProgress, IconButton, Typography, useTheme } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FC, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageContainer from 'src/layout/PageContainer';
import { PracticeManagedQuestionnaire } from 'utils';
import { useGetPracticeManagedQuestionnaireDetail, usePracticeManagedQuestionnaireUpdate } from '../admin.queries';
import { QuestionnaireBuilder } from './components/QuestionnaireBuilder';

export const QuestionnaireDetail: FC = () => {
  const { questionnaireId } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();

  const {
    mutateAsync: updateQuestionnaire,
    isPending: isUpdating,
    // error: updateError,
  } = usePracticeManagedQuestionnaireUpdate(questionnaireId ?? '');

  const {
    data,
    isPending: isFetching,
    error: fetchError,
    // status,
  } = useGetPracticeManagedQuestionnaireDetail({
    questionnaireId: questionnaireId as string,
  });

  const questionnaire = data?.practiceManagedQuestionnaires;

  console.log('questionnaire', questionnaire);

  const handleSave = useCallback(
    async (questionnaire: PracticeManagedQuestionnaire) => {
      await updateQuestionnaire({
        updateType: 'update-questionnaire',
        data: questionnaire,
      });
      enqueueSnackbar('Questionnaire saved', { variant: 'success' });
    },
    [updateQuestionnaire]
  );

  if (isFetching) {
    return (
      <PageContainer>
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      </PageContainer>
    );
  }

  if (!questionnaire || fetchError) {
    return (
      <PageContainer>
        <Box sx={{ p: 3 }}>
          <Typography color="error" sx={{ mb: 2 }}>
            Questionnaire not found.
          </Typography>
          {fetchError?.message && (
            <Typography color="error" sx={{ mb: 2 }}>
              {`Error: ${fetchError?.message}`}
            </Typography>
          )}
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/admin/questionnaires')}>
            Back to Questionnaires
          </Button>
        </Box>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <IconButton
            onClick={() => navigate('/admin/questionnaires')}
            size="small"
            aria-label="Back to questionnaires"
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" color={theme.palette.primary.dark}>
            Edit Questionnaire
          </Typography>
        </Box>
        <QuestionnaireBuilder initial={questionnaire} onSave={handleSave} isSaving={isUpdating} />
      </>
    </PageContainer>
  );
};
