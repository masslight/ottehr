import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { FC, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  createPracticeManagedQuestionnaire,
  getPracticeManagedQuestionnaire,
  listPracticeManagedQuestionnaires,
  updatePracticeManagedQuestionnaire,
} from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import PageContainer from 'src/layout/PageContainer';
import { FhirQuestionnaire, fromFhirResource, IntakeQuestionnaireOption } from './questionnaire.types';
import { QuestionnaireBuilder } from './QuestionnaireBuilder';

const LIST_QUERY_KEY = ['practice-managed-questionnaires'];
const DETAIL_QUERY_KEY = 'practice-managed-questionnaire';
const SYSTEM_QUERY_KEY = ['practice-managed-questionnaires-system'];

interface ListCache {
  questionnaires: any[];
  systemQuestionnaires: IntakeQuestionnaireOption[];
}

export const QuestionnaireBuilderPage: FC = () => {
  const { questionnaireId } = useParams();
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  const isNew = !questionnaireId || questionnaireId === 'new';

  // Fetch the single questionnaire being edited. Uses list-cache placeholder for
  // instant paint when the user navigated here from the admin list, and falls
  // back to a lightweight single-resource fetch on deep link or stale cache.
  const { data: editing, isLoading: isEditingLoading } = useQuery({
    queryKey: [DETAIL_QUERY_KEY, questionnaireId],
    queryFn: async () => {
      if (!oystehrZambda || isNew || !questionnaireId) return null;
      const result = await getPracticeManagedQuestionnaire(oystehrZambda, questionnaireId);
      return result.questionnaire ? fromFhirResource(result.questionnaire) : null;
    },
    placeholderData: () => {
      // The list page already runs fromFhirResource on its cached entries, so
      // we can return the hit directly without re-converting.
      if (isNew || !questionnaireId) return undefined;
      const cached = queryClient.getQueryData<ListCache>(LIST_QUERY_KEY);
      return cached?.questionnaires.find((q: any) => q.id === questionnaireId);
    },
    enabled: !!oystehrZambda && !isNew,
  });

  // System questionnaires (for association dropdown) aren't per-Q — cache them
  // separately so the detail page doesn't need to re-fetch the full admin list.
  const { data: systemQuestionnaires } = useQuery({
    queryKey: SYSTEM_QUERY_KEY,
    queryFn: async (): Promise<IntakeQuestionnaireOption[]> => {
      if (!oystehrZambda) return [];
      const cached = queryClient.getQueryData<ListCache>(LIST_QUERY_KEY);
      if (cached?.systemQuestionnaires) return cached.systemQuestionnaires;
      const result = await listPracticeManagedQuestionnaires(oystehrZambda);
      return result.systemQuestionnaires || [];
    },
    enabled: !!oystehrZambda,
  });

  const data = { editing, systemQuestionnaires: systemQuestionnaires || [] };
  const isLoading = !isNew && isEditingLoading && editing === undefined;

  const handleSave = useCallback(
    async (q: FhirQuestionnaire) => {
      if (!oystehrZambda) return;
      try {
        if (!isNew) {
          await updatePracticeManagedQuestionnaire(oystehrZambda, q as unknown as Record<string, unknown>);
        } else {
          await createPracticeManagedQuestionnaire(oystehrZambda, q as unknown as Record<string, unknown>);
        }
        void queryClient.invalidateQueries({ queryKey: LIST_QUERY_KEY });
        void queryClient.invalidateQueries({ queryKey: [DETAIL_QUERY_KEY] });
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
