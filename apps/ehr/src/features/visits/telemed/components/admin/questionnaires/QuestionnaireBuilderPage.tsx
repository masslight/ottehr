import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Box, Button, CircularProgress, IconButton, Typography, useTheme } from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { FC, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  createPracticeManagedQuestionnaire,
  getPracticeManagedQuestionnaire,
  updatePracticeManagedQuestionnaire,
} from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import PageContainer from 'src/layout/PageContainer';
import { FhirQuestionnaire, fromFhirResource } from './questionnaire.types';
import { QuestionnaireBuilder } from './QuestionnaireBuilder';

const LIST_QUERY_KEY = ['practice-managed-questionnaires'];
const DETAIL_QUERY_KEY = 'practice-managed-questionnaire';

export const QuestionnaireBuilderPage: FC = () => {
  const { questionnaireId } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  const isNew = !questionnaireId || questionnaireId === 'new';

  // Fetch the single questionnaire being edited. No placeholderData: the builder
  // initializes its local state from `initial` exactly once (it isn't keyed), so
  // mounting it with a stale list-cache copy would silently edit — and on save,
  // overwrite — an outdated version. Wait for the authoritative fetch instead.
  const { data: editing, isLoading: isEditingLoading } = useQuery({
    queryKey: [DETAIL_QUERY_KEY, questionnaireId],
    queryFn: async () => {
      if (!oystehrZambda || isNew || !questionnaireId) return null;
      const result = await getPracticeManagedQuestionnaire(oystehrZambda, questionnaireId);
      return result.questionnaire ? fromFhirResource(result.questionnaire) : null;
    },
    enabled: !!oystehrZambda && !isNew,
  });

  const data = { editing };
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

  const headerTitle = isNew
    ? 'Create Questionnaire'
    : data?.editing?.title || data?.editing?.name || 'Edit Questionnaire';

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
            {headerTitle}
          </Typography>
        </Box>
        <QuestionnaireBuilder initial={data?.editing ?? undefined} onSave={handleSave} onCancel={handleCancel} />
      </>
    </PageContainer>
  );
};
