import UploadFileIcon from '@mui/icons-material/UploadFile';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  TextField,
  Typography,
} from '@mui/material';
import { Questionnaire } from 'fhir/r4b';
import { FC, useRef, useState } from 'react';
import { RoundedButton } from 'src/components/RoundedButton';
import { validateSystemManagedImport } from 'utils/lib/helpers/system-managed-questionnaires';

interface ImportVersionDialogProps {
  open: boolean;
  onClose: () => void;
  current: Questionnaire;
  onValidated: (draft: Questionnaire) => void;
}

export const ImportVersionDialog: FC<ImportVersionDialogProps> = ({ open, onClose, current, onValidated }) => {
  const [jsonText, setJsonText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = (): void => {
    setJsonText('');
    setErrors([]);
    setParseError(null);
  };

  const handleClose = (): void => {
    reset();
    onClose();
  };

  const handleFile = (file: File | undefined): void => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setJsonText(typeof reader.result === 'string' ? reader.result : '');
      setErrors([]);
      setParseError(null);
    };
    reader.readAsText(file);
  };

  const handleImport = (): void => {
    setErrors([]);
    setParseError(null);

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch (e) {
      setParseError(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }

    const result = validateSystemManagedImport({ imported: parsed, current });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }

    onValidated(result.imported);
    reset();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Import Next Version JSON</DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          <AlertTitle>How this works</AlertTitle>
          <Typography variant="body2" component="div">
            Paste or upload a FHIR <code>Questionnaire</code> that represents the next version of{' '}
            <strong>{current.title || current.url}</strong>. On import it is validated:
            <Box component="ul" sx={{ mt: 0.5, mb: 1, pl: 2.5 }}>
              <li>
                <code>resourceType</code> must be <code>"Questionnaire"</code> and <code>status</code> must be{' '}
                <code>"draft"</code>
              </li>
              <li>
                <code>url</code> must exactly match <code>{current.url}</code>; if an <code>id</code> is present it must
                match the current form's id
              </li>
              <li>
                <code>version</code> must be semver and a bump (major, minor, or patch) above the current version{' '}
                <code>{current.version}</code>
              </li>
              <li>
                the form is checked against the paperwork engine and the harvest module — anything that would break
                rendering or data harvesting <strong>blocks the import</strong> with a specific error
              </li>
            </Box>
            Once imported you can review the diff and save it as a draft. A draft must be reviewed before it can be made
            active.
          </Typography>
        </Alert>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
          <Button size="small" startIcon={<UploadFileIcon />} onClick={() => fileInputRef.current?.click()}>
            Upload .json file
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              handleFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </Box>

        <TextField
          label="Questionnaire JSON"
          placeholder="Paste the next-version FHIR Questionnaire JSON here…"
          value={jsonText}
          onChange={(e) => {
            setJsonText(e.target.value);
            setErrors([]);
            setParseError(null);
          }}
          multiline
          minRows={12}
          maxRows={24}
          fullWidth
          InputProps={{ sx: { fontFamily: 'monospace', fontSize: 12 } }}
        />

        {parseError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {parseError}
          </Alert>
        )}

        {errors.length > 0 && (
          <Alert severity="error" sx={{ mt: 2 }}>
            <AlertTitle>
              Import blocked — {errors.length} problem{errors.length === 1 ? '' : 's'} found
            </AlertTitle>
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              {errors.map((err, i) => (
                <li key={i}>
                  <Typography variant="body2" component="span">
                    {err}
                  </Typography>
                </li>
              ))}
            </Box>
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Link component="button" type="button" onClick={handleClose} sx={{ mr: 'auto' }}>
          Cancel
        </Link>
        <RoundedButton variant="contained" onClick={handleImport} disabled={!jsonText.trim()}>
          Import Draft JSON
        </RoundedButton>
      </DialogActions>
    </Dialog>
  );
};
