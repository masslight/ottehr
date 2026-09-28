import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Box, Button, CircularProgress, IconButton, Typography, useTheme } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FC, useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useEvolveUser from 'src/hooks/useEvolveUser';
import PageContainer from 'src/layout/PageContainer';
import { RoleType } from 'utils/lib/types/api/user.types';
import { PracticeManagedQuestionnaire } from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';
import { useGetPracticeManagedQuestionnaireGet, usePracticeManagedQuestionnaireUpdate } from '../admin.queries';
import { ImportQuestionnaireJsonDialog } from './components/ImportQuestionnaireJsonDialog';
import { QuestionnaireBuilder } from './components/QuestionnaireBuilder';
import { QuestionnaireReadOnlyView } from './components/QuestionnaireReadOnlyView';

export const QuestionnaireDetail: FC = () => {
  const { questionnaireId } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // only customer support can import json questionnaires (including new versions of them)
  const isCustomerSupport = useEvolveUser()?.hasRole([RoleType.CustomerSupport]) ?? false;

  const { mutateAsync: updateQuestionnaire, isPending: isUpdating } = usePracticeManagedQuestionnaireUpdate(
    questionnaireId ?? ''
  );

  const {
    data,
    isPending: isFetching,
    error: fetchError,
  } = useGetPracticeManagedQuestionnaireGet({
    questionnaireId: questionnaireId as string,
  });

  // json imported questionnaires are returned as raw fhir and rendered read only
  const jsonImportedQuestionnaire = data?.isJsonImport ? data.questionnaire : undefined;
  const questionnaire = data && !data.isJsonImport ? data.practiceManagedQuestionnaire : undefined;

  const handleSave = useCallback(
    async (questionnaire: PracticeManagedQuestionnaire) => {
      const { questionnaireId: updatedQuestionnaireId } = await updateQuestionnaire({
        updateType: 'update-questionnaire',
        data: questionnaire,
      });
      enqueueSnackbar('Questionnaire saved', { variant: 'success' });

      // editing creates a new versioned resource, so navigate to its id
      if (updatedQuestionnaireId && updatedQuestionnaireId !== questionnaireId) {
        navigate(`/admin/questionnaires/${updatedQuestionnaireId}`, { replace: true });
      }
    },
    [updateQuestionnaire, navigate, questionnaireId]
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

  if ((!questionnaire && !jsonImportedQuestionnaire) || fetchError) {
    return (
      <PageContainer>
        <Box sx={{ p: 3 }}>
          <Typography color="error" sx={{ mb: 2 }}>
            Questionnaire could not be loaded.
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
            {jsonImportedQuestionnaire ? 'View Questionnaire' : 'Edit Questionnaire'}
          </Typography>
        </Box>
        {jsonImportedQuestionnaire ? (
          <>
            <QuestionnaireReadOnlyView
              questionnaire={jsonImportedQuestionnaire}
              onUploadNewVersion={isCustomerSupport ? () => setImportDialogOpen(true) : undefined}
            />
            <ImportQuestionnaireJsonDialog
              open={importDialogOpen}
              onClose={() => setImportDialogOpen(false)}
              existingQuestionnaire={{
                id: questionnaireId ?? '',
                url: jsonImportedQuestionnaire.url ?? '',
                version: jsonImportedQuestionnaire.version,
              }}
              onImported={({ questionnaireId: newQuestionnaireId, version }) => {
                setImportDialogOpen(false);
                enqueueSnackbar(`Version ${version} uploaded`, { variant: 'success' });
                // a new version is a new resource, so navigate to its id
                navigate(`/admin/questionnaires/${newQuestionnaireId}`, { replace: true });
              }}
            />
          </>
        ) : (
          questionnaire && <QuestionnaireBuilder initial={questionnaire} onSave={handleSave} isSaving={isUpdating} />
        )}
      </>
    </PageContainer>
  );
};
