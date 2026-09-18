import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Alert, Box, Button, Collapse, Paper, TextField, Typography } from '@mui/material';
import { FC, useEffect, useState } from 'react';
import { RoundedButton } from 'src/components/RoundedButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { wordCount } from './scribeSections';
import { roundedButtonSx, scaled } from './scribeTheme';

const testIds = dataTestIds.scribeRecommendations;

interface TranscriptEvidenceProps {
  /** The selected transcript's text, or '' when no transcript is selected. */
  transcript: string;
  /** The selected transcript document; absent when none is, and a save then adds a new one. */
  documentId?: string;
  disabled: boolean;
  /** Saves the text: over the selected document, or as a new one. Rejects with the server's error. */
  onSave: (text: string) => Promise<void>;
}

/**
 * The transcript, folded away: the narrative is what the provider works in, and this is what it was written
 * from. Opened, it shows the selected transcript, or nothing when none is selected, and can be edited. An
 * edited transcript is saved over its document ("Save changes"); text typed or pasted with none selected
 * becomes a new transcript on the visit ("Add transcript"). Either way the server processes it as it would a
 * recording's, and its narrative replaces the one below.
 */
export const TranscriptEvidence: FC<TranscriptEvidenceProps> = ({ transcript, documentId, disabled, onSave }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [draft, setDraft] = useState(transcript);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // Another transcript picked (or the same one saved and reloaded) replaces whatever was typed here.
  useEffect(() => {
    setDraft(transcript);
    setError(undefined);
  }, [transcript, documentId]);

  const isChanged = draft.trim() !== '' && draft.trim() !== transcript.trim();

  const save = async (): Promise<void> => {
    setIsSaving(true);
    setError(undefined);
    try {
      await onSave(draft);
    } catch (e) {
      setError(getApiError({ error: e, defaultError: 'The transcript could not be saved.' }));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Paper variant="outlined" data-testid={testIds.transcriptEvidence} sx={{ px: 1.5, py: 0.5 }}>
      <Button
        size="small"
        onClick={() => setIsExpanded((value) => !value)}
        endIcon={isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        aria-expanded={isExpanded}
        sx={{ textTransform: 'none', minWidth: 0, p: 0, fontSize: scaled(12), color: 'text.secondary' }}
        data-testid={testIds.transcriptToggle}
      >
        {isExpanded ? 'Transcript' : 'Show transcript'}
        {transcript ? ` · ${wordCount(transcript)} words` : ''}
      </Button>
      <Collapse in={isExpanded}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, pb: 1 }}>
          <TextField
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            multiline
            minRows={4}
            maxRows={14}
            fullWidth
            placeholder={'Paste or type the visit dialogue, e.g.\nProvider: What brings you in today?\nPatient: …'}
            disabled={disabled || isSaving}
            inputProps={{ 'data-testid': testIds.transcriptPreview, 'aria-label': 'Transcript' }}
            sx={{ '& .MuiInputBase-input': { fontSize: scaled(13), lineHeight: 1.6 } }}
          />
          {error && (
            <Alert severity="error" data-testid={testIds.transcriptSaveError}>
              {error}
            </Alert>
          )}
          {isChanged && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap' }}>
              {isSaving && (
                <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                  Processing the transcript — this takes about as long as a recording.
                </Typography>
              )}
              <Button
                size="small"
                onClick={() => setDraft(transcript)}
                disabled={isSaving}
                sx={{ textTransform: 'none' }}
              >
                {documentId ? 'Discard changes' : 'Clear'}
              </Button>
              <RoundedButton
                variant="contained"
                onClick={() => void save()}
                disabled={disabled}
                loading={isSaving}
                sx={roundedButtonSx}
                data-testid={testIds.transcriptSaveButton}
              >
                {documentId ? 'Save changes' : 'Add transcript'}
              </RoundedButton>
            </Box>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
};
