import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { FC, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  createPracticeManagedQuestionnaire,
  listPracticeManagedQuestionnaires,
  updatePracticeManagedQuestionnaire,
} from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import PageContainer from 'src/layout/PageContainer';
import { FhirQuestionnaire, fromFhirResource, IntakeQuestionnaireOption } from './questionnaire.types';
import { QuestionnaireBuilder } from './QuestionnaireBuilder';

const QUERY_KEY = ['practice-managed-questionnaires'];

export const QuestionnaireBuilderPage: FC = () => {
  const { questionnaireId } = useParams();
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  const isNew = !questionnaireId || questionnaireId === 'new';

  const { data, isLoading } = useQuery({
    queryKey: [...QUERY_KEY, questionnaireId],
    queryFn: async () => {
      if (!oystehrZambda) return null;
      const result = await listPracticeManagedQuestionnaires(oystehrZambda);
      const questionnaires = (result.questionnaires || []).map((r: any) => fromFhirResource(r));
      const systemQuestionnaires: IntakeQuestionnaireOption[] = result.systemQuestionnaires || [];
      const editing = isNew ? undefined : questionnaires.find((q: FhirQuestionnaire) => q.id === questionnaireId);
      return { editing, systemQuestionnaires };
    },
    enabled: !!oystehrZambda,
  });

  const handleSave = useCallback(
    async (q: FhirQuestionnaire) => {
      if (!oystehrZambda) return;
      try {
        if (!isNew) {
          await updatePracticeManagedQuestionnaire(oystehrZambda, q as unknown as Record<string, unknown>);
        } else {
          await createPracticeManagedQuestionnaire(oystehrZambda, q as unknown as Record<string, unknown>);
        }
        void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        enqueueSnackbar('Questionnaire saved', { variant: 'success' });
        navigate('/admin/questionnaires');
      } catch (err) {
        console.error('Failed to save questionnaire:', err);
        enqueueSnackbar('Failed to save questionnaire', { variant: 'error' });
      }
    },
    [oystehrZambda, isNew, queryClient, navigate]
  );

  const handleCancel = useCallback(() => {
    navigate('/admin/questionnaires');
  }, [navigate]);

  if (isLoading) {
    return (
      <PageContainer>
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      </PageContainer>
    );
  }

  if (!isNew && !data?.editing) {
    return (
      <PageContainer>
        <Box sx={{ p: 3 }}>
          <Typography color="error" sx={{ mb: 2 }}>
            Questionnaire not found.
          </Typography>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/admin/questionnaires')}>
            Back to Questionnaires
          </Button>
        </Box>
      </PageContainer>
    );
  }

  return (
    <QuestionnaireBuilder
      initial={data?.editing}
      onSave={handleSave}
      onCancel={handleCancel}
      systemQuestionnaires={data?.systemQuestionnaires || []}
    />
  );
};
