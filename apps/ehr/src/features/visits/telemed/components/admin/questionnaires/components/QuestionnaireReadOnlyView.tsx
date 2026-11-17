import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { Alert, Box, Grid, Paper, TextField, Typography } from '@mui/material';
import { Questionnaire } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { FC, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RoundedButton } from 'src/components/RoundedButton';
import { ImportQuestionnaireJsonDialog } from './ImportQuestionnaireJsonDialog';
import { QuestionnaireJsonPreview } from './QuestionnaireJsonPreview';
import { QuestionnairePreview } from './QuestionnairePreview';
import { QuestionnaireTestDialog } from './QuestionnaireTestDialog';

interface QuestionnaireReadOnlyViewProps {
  questionnaire: Questionnaire;
  allowVersionUpload: boolean;
}

// used for json imported questionnaires: same layout as the builder, but without the item editor and nothing editable
export const QuestionnaireReadOnlyView: FC<QuestionnaireReadOnlyViewProps> = ({
  questionnaire,
  allowVersionUpload,
}) => {
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [currentPreviewPageIndex, setCurrentPreviewPageIndex] = useState(0);
  const [previewCompleted, setPreviewCompleted] = useState(false);

  const navigate = useNavigate();

  const readOnlyFields: { label: string; value: string | undefined; multiline?: boolean }[] = [
    { label: 'Title', value: questionnaire.title },
    { label: 'Description', value: questionnaire.description, multiline: true },
  ];

  return (
    <Box sx={{ display: 'flex', gap: 3, height: 'calc(100vh - 160px)' }}>
      <Box sx={{ flex: '1 1 50%', minWidth: 0, overflow: 'auto' }}>
        <Paper variant="outlined" sx={{ p: 3, mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography variant="h4" sx={{ color: '#0F347C' }}>
              Questionnaire Properties
            </Typography>
            {allowVersionUpload && (
              <RoundedButton
                size="medium"
                variant="contained"
                startIcon={<UploadFileIcon />}
                onClick={() => setImportDialogOpen(true)}
              >
                Upload New Version
              </RoundedButton>
            )}
          </Box>
          <Grid container spacing={1.5}>
            {readOnlyFields.map(({ label, value, multiline }) => (
              <Grid item xs={12} key={label}>
                <TextField
                  size="small"
                  label={label}
                  value={value ?? ''}
                  multiline={multiline}
                  minRows={multiline ? 2 : undefined}
                  fullWidth
                  InputProps={{ readOnly: true }}
                />
              </Grid>
            ))}
          </Grid>
        </Paper>
        <Alert severity="info">
          This questionnaire was imported via JSON and is read only. To make changes, upload a new version of the JSON.
        </Alert>
        <ImportQuestionnaireJsonDialog
          open={importDialogOpen}
          onClose={() => setImportDialogOpen(false)}
          existingQuestionnaire={{
            id: questionnaire.id ?? '',
            url: questionnaire.url ?? '',
            version: questionnaire.version,
          }}
          onImported={(result) => {
            setImportDialogOpen(false);
            enqueueSnackbar(`Version ${result.version} uploaded`, { variant: 'success' });
            // a new version is a new resource, so navigate to its id
            navigate(`/admin/questionnaires/${result.questionnaireId}`, { replace: true });
          }}
        />
      </Box>

      <Box sx={{ flex: '1 1 50%', overflow: 'auto' }}>
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography variant="h4" sx={{ color: '#0F347C' }}>
              Form Preview
            </Typography>
            <RoundedButton
              size="medium"
              variant="outlined"
              startIcon={<PlayArrowIcon />}
              onClick={() => setTestDialogOpen(true)}
              disabled={!questionnaire.item?.length}
            >
              Test Form
            </RoundedButton>
          </Box>
          <QuestionnairePreview
            questionnaire={questionnaire}
            setCurrentPageIndex={setCurrentPreviewPageIndex}
            currentPageIndex={currentPreviewPageIndex}
            completed={previewCompleted}
            setCompleted={setPreviewCompleted}
            previewMode={'ui-only'}
          />
        </Paper>
        <QuestionnaireTestDialog
          open={testDialogOpen}
          onClose={() => setTestDialogOpen(false)}
          questionnaire={questionnaire}
        />

        <QuestionnaireJsonPreview json={JSON.stringify(questionnaire, null, 2)} />
      </Box>
    </Box>
  );
};
