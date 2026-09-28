import UploadFileIcon from '@mui/icons-material/UploadFile';
import {
  Alert,
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { Questionnaire } from 'fhir/r4b';
import { ChangeEvent, FC, useRef, useState } from 'react';
import { RoundedButton } from 'src/components/RoundedButton';
import { PracticeManagedQuestionnaireImportJsonOutput } from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';
import { usePracticeManagedQuestionnaireImportJson } from '../../admin.queries';

type ImportMode = 'upload' | 'paste';

interface ImportQuestionnaireJsonDialogProps {
  open: boolean;
  onClose: () => void;
  onImported: (result: PracticeManagedQuestionnaireImportJsonOutput) => void;
  // when passed, the json is uploaded as a new version of this questionnaire
  existingQuestionnaire?: { id: string; url: string; version?: string };
}

// light client side checks so obvious mistakes don't need a round trip, the zambda does the full validation
const parseQuestionnaireJson = (
  text: string,
  expectedUrl: string | undefined
): { questionnaire: Questionnaire; error?: undefined } | { questionnaire?: undefined; error: string } => {
  if (!text.trim()) return { error: 'Please upload a file or paste JSON' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { error: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}` };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { error: 'JSON must be a single FHIR Questionnaire object' };
  }

  const questionnaire = parsed as Questionnaire;
  if (questionnaire.resourceType !== 'Questionnaire') {
    return { error: `resourceType must be "Questionnaire", received "${questionnaire.resourceType}"` };
  }

  if (expectedUrl && questionnaire.url !== expectedUrl) {
    return {
      error: `The url in the JSON (${
        questionnaire.url ?? 'missing'
      }) must match this questionnaire's url (${expectedUrl})`,
    };
  }

  return { questionnaire };
};

export const ImportQuestionnaireJsonDialog: FC<ImportQuestionnaireJsonDialogProps> = ({
  open,
  onClose,
  onImported,
  existingQuestionnaire,
}) => {
  const [mode, setMode] = useState<ImportMode>('upload');
  const [fileName, setFileName] = useState<string | undefined>();
  const [fileText, setFileText] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [error, setError] = useState<string | undefined>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { mutateAsync: importJson, isPending } = usePracticeManagedQuestionnaireImportJson();

  const isNewVersion = Boolean(existingQuestionnaire);

  const reset = (): void => {
    setMode('upload');
    setFileName(undefined);
    setFileText('');
    setPastedText('');
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
      setFileText(await file.text());
    } catch {
      setFileText('');
      setError(`Unable to read ${file.name}`);
    }
  };

  const handleSubmit = async (): Promise<void> => {
    const text = mode === 'upload' ? fileText : pastedText;
    const result = parseQuestionnaireJson(text, existingQuestionnaire?.url);
    if (result.error !== undefined) {
      setError(result.error);
      return;
    }

    setError(undefined);
    try {
      const output = await importJson({
        questionnaire: result.questionnaire,
        ...(existingQuestionnaire && { questionnaireId: existingQuestionnaire.id }),
      });
      reset();
      onImported(output);
    } catch {
      // errors are surfaced via snackbar by the mutation
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

        <Tabs
          value={mode}
          onChange={(_e, value: ImportMode) => {
            setMode(value);
            setError(undefined);
          }}
          sx={{ mb: 2 }}
        >
          <Tab value="upload" label="Upload File" />
          <Tab value="paste" label="Paste JSON" />
        </Tabs>

        {mode === 'upload' ? (
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
        ) : (
          <TextField
            value={pastedText}
            onChange={(e) => {
              setPastedText(e.target.value);
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
        )}

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
