import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Box, IconButton, Typography, useTheme } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FC, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PageContainer from 'src/layout/PageContainer';
import { ManagedQuestionnaire } from 'utils';
import { useManagedQuestionnaireCreate } from '../admin.queries';
import { QuestionnaireBuilder } from './components/QuestionnaireBuilder';

export const QuestionnaireNew: FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();

  const { mutateAsync: createQuestionnaire, isPending: isSaving } = useManagedQuestionnaireCreate();

  const handleSave = useCallback(
    async (managedQuestionnaire: ManagedQuestionnaire) => {
      const result = await createQuestionnaire({ managedQuestionnaire });
      const { questionnaireId } = result;
      enqueueSnackbar('Questionnaire saved', { variant: 'success' });
      navigate(`/admin/questionnaires/${questionnaireId}`);
    },
    [createQuestionnaire, navigate]
  );

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
            Create Questionnaire
          </Typography>
        </Box>
        <QuestionnaireBuilder initial={undefined} onSave={handleSave} isSaving={isSaving} />
      </>
    </PageContainer>
  );
};
