import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Chip,
  Divider,
  IconButton,
  Paper,
  Typography,
  useTheme,
} from '@mui/material';
import { Questionnaire } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { FC, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RoundedButton } from 'src/components/RoundedButton';
import PageContainer from 'src/layout/PageContainer';
import { useClearSystemManagedDraft, useSaveSystemManagedDraft } from '../admin.queries';
import { ImportVersionDialog } from './components/ImportVersionDialog';
import { JsonDiffView } from './components/JsonDiffView';
import { ReadOnlyPagesView } from './components/ReadOnlyPagesView';

interface SystemManagedQuestionnaireDetailProps {
  questionnaire: Questionnaire;
  draft: Questionnaire | null;
}

const PropertyRow: FC<{ label: string; value?: string }> = ({ label, value }) => (
  <Box sx={{ display: 'flex', gap: 1, py: 0.5 }}>
    <Typography variant="body2" sx={{ minWidth: 110, color: 'text.secondary', fontWeight: 500 }}>
      {label}
    </Typography>
    <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
      {value || '—'}
    </Typography>
  </Box>
);

export const SystemManagedQuestionnaireDetail: FC<SystemManagedQuestionnaireDetailProps> = ({
  questionnaire,
  draft,
}) => {
  const navigate = useNavigate();
  const theme = useTheme();

  const [importedDraft, setImportedDraft] = useState<Questionnaire | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { mutateAsync: saveDraft, isPending: isSaving } = useSaveSystemManagedDraft(questionnaire.id);
  const { mutateAsync: clearDraft, isPending: isClearing } = useClearSystemManagedDraft(questionnaire.id);

  // in-memory imported (unsaved) draft takes precedence over a previously-saved one for review
  const reviewDraft = importedDraft ?? draft;
  const isUnsaved = importedDraft !== null;

  const handleValidated = (validated: Questionnaire): void => {
    setImportedDraft(validated);
    setDialogOpen(false);
  };

  const handleSave = async (): Promise<void> => {
    if (!importedDraft) return;
    await saveDraft({ questionnaire: importedDraft });
    setImportedDraft(null);
    enqueueSnackbar('Draft saved', { variant: 'success' });
  };

  const handleClear = async (): Promise<void> => {
    if (!questionnaire.url) return;
    await clearDraft({ url: questionnaire.url });
    setImportedDraft(null);
    enqueueSnackbar('Draft cleared', { variant: 'success' });
  };

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
            {questionnaire.title || 'System Managed Questionnaire'}
          </Typography>
          <Chip
            label="System Managed"
            size="small"
            sx={{
              borderRadius: '4px',
              height: '20px',
              fontSize: 12,
              fontWeight: 500,
              backgroundColor: 'rgba(15, 52, 124, 0.12)',
              color: '#0F347C',
            }}
          />
        </Box>

        <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
          {/* Left: read-only properties + pages */}
          <Box sx={{ flex: '1 1 50%', minWidth: 0 }}>
            <Paper variant="outlined" sx={{ p: 3, mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="h4" sx={{ color: '#0F347C' }}>
                  Questionnaire Properties
                </Typography>
                <Chip label="Read only" size="small" variant="outlined" />
              </Box>
              <PropertyRow label="Title" value={questionnaire.title} />
              <PropertyRow label="Description" value={questionnaire.description} />
              <PropertyRow label="Version" value={questionnaire.version} />
              <PropertyRow label="Status" value={questionnaire.status} />
              <PropertyRow label="URL" value={questionnaire.url} />
              <PropertyRow label="Name" value={questionnaire.name} />
            </Paper>

            <Paper variant="outlined" sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="h4" sx={{ color: '#0F347C' }}>
                  Pages ({questionnaire.item?.length ?? 0})
                </Typography>
                <RoundedButton
                  size="medium"
                  variant="contained"
                  startIcon={<UploadFileIcon />}
                  onClick={() => setDialogOpen(true)}
                >
                  Import Next Version JSON
                </RoundedButton>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                System-managed forms are read-only here. To change one, import its next version as JSON.
              </Typography>

              {draft && (
                <Alert severity="info" sx={{ mb: 1.5 }}>
                  A draft{draft.version ? ` (v${draft.version})` : ''} is saved for this form. Importing a new version
                  will replace it.
                </Alert>
              )}

              <ReadOnlyPagesView items={questionnaire.item ?? []} />
            </Paper>
          </Box>

          {/* Right: draft review + active JSON */}
          <Box sx={{ flex: '1 1 50%', minWidth: 0 }}>
            {reviewDraft && (
              <Paper variant="outlined" sx={{ p: 3, mb: 2, borderColor: theme.palette.primary.main }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Typography variant="h4" sx={{ color: '#0F347C' }}>
                    Draft Review
                  </Typography>
                  <Chip
                    label={isUnsaved ? 'Unsaved' : 'Saved'}
                    size="small"
                    color={isUnsaved ? 'warning' : 'success'}
                    sx={{ height: 20, fontSize: 12 }}
                  />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  {questionnaire.version} → <strong>{reviewDraft.version}</strong>
                  {isUnsaved
                    ? ' — imported and validated. Review the changes below, then save the draft.'
                    : ' — saved draft. Review the changes below.'}
                </Typography>

                <JsonDiffView current={questionnaire} draft={reviewDraft} />

                <Divider sx={{ my: 2 }} />
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                  {isUnsaved ? (
                    <>
                      <RoundedButton variant="outlined" onClick={() => setImportedDraft(null)} disabled={isSaving}>
                        Discard
                      </RoundedButton>
                      <RoundedButton variant="contained" loading={isSaving} onClick={() => void handleSave()}>
                        Save Draft
                      </RoundedButton>
                    </>
                  ) : (
                    <RoundedButton
                      variant="outlined"
                      color="error"
                      loading={isClearing}
                      onClick={() => void handleClear()}
                    >
                      Clear Draft
                    </RoundedButton>
                  )}
                </Box>
              </Paper>
            )}

            <Accordion variant="outlined" defaultExpanded={!reviewDraft} sx={{ '&:before': { display: 'none' } }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h4" sx={{ color: '#0F347C' }}>
                  Active Version JSON
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box
                  component="pre"
                  sx={{
                    fontSize: 12,
                    fontFamily: 'monospace',
                    bgcolor: '#f5f5f5',
                    p: 1.5,
                    borderRadius: 1,
                    overflow: 'auto',
                    maxHeight: 500,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    m: 0,
                  }}
                >
                  {JSON.stringify(questionnaire, null, 2)}
                </Box>
              </AccordionDetails>
            </Accordion>
          </Box>
        </Box>

        <ImportVersionDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          current={questionnaire}
          onValidated={handleValidated}
        />
      </>
    </PageContainer>
  );
};
