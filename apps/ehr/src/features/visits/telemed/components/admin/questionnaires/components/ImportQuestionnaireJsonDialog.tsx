import UploadFileIcon from '@mui/icons-material/UploadFile';
import {
  Alert,
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  TextField,
  Typography,
} from '@mui/material';
import { ChangeEvent, FC, useRef, useState } from 'react';
import { RoundedButton } from 'src/components/RoundedButton';
import { PracticeManagedQuestionnaireImportJsonOutput } from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';
import { usePracticeManagedQuestionnaireImportJson } from '../../admin.queries';

interface ImportQuestionnaireJsonDialogProps {
  open: boolean;
  onClose: () => void;
  onImported: (result: PracticeManagedQuestionnaireImportJsonOutput) => void;
  // passed when opened from the detail page
  existingQuestionnaire?: { id: string; url: string; version?: string };
}

export const ImportQuestionnaireJsonDialog: FC<ImportQuestionnaireJsonDialogProps> = ({
  open,
  onClose,
  onImported,
  existingQuestionnaire,
}) => {
  const [fileName, setFileName] = useState<string | undefined>();
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState<string | undefined>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { mutateAsync: importJson, isPending } = usePracticeManagedQuestionnaireImportJson();

  const isNewVersion = Boolean(existingQuestionnaire);

  const reset = (): void => {
    setFileName(undefined);
    setJsonText('');
    setError(undefined);
  };

  const handleClose = (): void => {
    if (isPending) return;
    reset();
    onClose();
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    // allow re-selecting the same file after fixing it
    e.target.value = '';
    if (!file) return;

    setError(undefined);
    setFileName(file.name);
    try {
      // the file contents are loaded into the text field so they can be reviewed before importing
      setJsonText(await file.text());
    } catch {
      setFileName(undefined);
      setError(`Unable to read ${file.name}`);
    }
  };

  const handleSubmit = async (): Promise<void> => {
    setError(undefined);
    try {
      // the zambda validates the json, and its errors are surfaced via snackbar by the mutation
      const output = await importJson({
        questionnaireJson: jsonText,
        ...(existingQuestionnaire && { questionnaireId: existingQuestionnaire.id }),
      });
      reset();
      onImported(output);
    } catch {
      // already surfaced by the mutation
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>{isNewVersion ? 'Upload New Version' : 'Import Questionnaire JSON'}</DialogTitle>
      <DialogContent>
        {isNewVersion && existingQuestionnaire ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            The url in the JSON must be <b>{existingQuestionnaire.url}</b>. The current version is{' '}
            <b>{existingQuestionnaire.version ?? 'unknown'}</b>; if the JSON does not contain a higher version, the
            version will be bumped automatically.
          </Alert>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Upload or paste a FHIR Questionnaire. Imported questionnaires are read only in the admin portal; to make
            changes, upload a new version from the questionnaire's detail page.
          </Typography>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => void handleFileChange(e)}
          />
          <RoundedButton
            variant="outlined"
            startIcon={<UploadFileIcon />}
            onClick={() => fileInputRef.current?.click()}
            disabled={isPending}
          >
            Choose File
          </RoundedButton>
          <Typography variant="body2" color={fileName ? 'text.primary' : 'text.secondary'}>
            {fileName ?? 'No file selected'}
          </Typography>
        </Box>

        <Divider sx={{ my: 2 }}>
          <Typography variant="body2" color="text.secondary">
            or paste JSON
          </Typography>
        </Divider>

        <TextField
          value={jsonText}
          onChange={(e) => {
            setJsonText(e.target.value);
            setError(undefined);
          }}
          placeholder='{ "resourceType": "Questionnaire", ... }'
          multiline
          minRows={12}
          maxRows={24}
          fullWidth
          disabled={isPending}
          inputProps={{ style: { fontFamily: 'monospace', fontSize: 12 } }}
        />

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <RoundedButton variant="outlined" onClick={handleClose} disabled={isPending}>
          Cancel
        </RoundedButton>
        <RoundedButton variant="contained" onClick={() => void handleSubmit()} loading={isPending}>
          {isNewVersion ? 'Upload Version' : 'Import'}
        </RoundedButton>
      </DialogActions>
    </Dialog>
  );
};
