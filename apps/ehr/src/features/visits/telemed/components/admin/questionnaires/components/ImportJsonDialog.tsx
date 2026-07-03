import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import UploadIcon from '@mui/icons-material/Upload';
import { Box, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FC, SetStateAction, useCallback, useRef, useState } from 'react';
import { RoundedButton } from 'src/components/RoundedButton';
import { fhirQuestionnaireToManaged, ManagedQuestionnaire } from 'utils';
import { useManagedQuestionnaireCreate } from '../../admin.queries';

interface ImportJsonDialogProps {
  open: boolean;
  setOpen: (value: SetStateAction<boolean>) => void;
}

const FileUploadArea: FC<{ onFileLoaded: (content: string) => void; disabled?: boolean }> = ({
  onFileLoaded,
  disabled,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const readFile = useCallback(
    (file: File) => {
      if (!file.name.endsWith('.json')) {
        return;
      }
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (content) onFileLoaded(content);
      };
      reader.readAsText(file);
    },
    [onFileLoaded]
  );

  return (
    <Box
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) readFile(file);
      }}
      onClick={() => !disabled && fileInputRef.current?.click()}
      sx={{
        border: '2px dashed',
        borderColor: dragOver ? 'primary.main' : '#E0E0E0',
        borderRadius: '8px',
        p: 3,
        textAlign: 'center',
        cursor: disabled ? 'default' : 'pointer',
        bgcolor: dragOver ? 'action.hover' : 'transparent',
        transition: 'all 0.2s',
        '&:hover': disabled ? {} : { borderColor: 'primary.light', bgcolor: 'action.hover' },
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) readFile(file);
          e.target.value = '';
        }}
      />
      <CloudUploadIcon sx={{ fontSize: 36, color: 'text.secondary', mb: 0.5 }} />
      <Typography variant="body2" color="text.secondary">
        {fileName ? `Loaded: ${fileName}` : 'Drop a .json file here or click to browse'}
      </Typography>
    </Box>
  );
};

export const ImportJsonDialog: FC<ImportJsonDialogProps> = (props) => {
  const { open, setOpen } = props;
  const [importJson, setImportJson] = useState('');
  const [error, setError] = useState<string | null>(null);

  const {
    mutateAsync: createQuestionnaire,
    isPending: isImporting,
    error: importError,
  } = useManagedQuestionnaireCreate();

  const handleImport = useCallback(async () => {
    let parsed: any;
    let managedQuestionnaire: ManagedQuestionnaire | undefined;
    try {
      parsed = JSON.parse(importJson);
      if (parsed.id) {
        setError('Please remove the id property');
        return;
      }
      if (parsed.resourceType !== 'Questionnaire') {
        setError("ResourceType must be 'Questionnaire'");
        return;
      }

      // create questionnaire expects a managed questionnaire so we will format as such
      managedQuestionnaire = fhirQuestionnaireToManaged(parsed);
    } catch (e) {
      let errorMessage = 'Error validating the provided json';
      if ((e as any)?.message) errorMessage = (e as any)?.message;
      setError(errorMessage);
      return;
    }

    await createQuestionnaire({ managedQuestionnaire });
    enqueueSnackbar(`Imported "${managedQuestionnaire.title || managedQuestionnaire.name}"`, { variant: 'success' });
    setOpen(false);
    setImportJson('');
  }, [createQuestionnaire, importJson, setOpen]);

  return (
    <Dialog open={open} onClose={() => !isImporting && setOpen(false)} maxWidth="md" fullWidth>
      <DialogTitle sx={{ typography: 'h4', color: '#0F347C' }}>Import FHIR Questionnaire</DialogTitle>
      <DialogContent>
        <Typography variant="body1" color="text.primary" sx={{ mb: 2 }}>
          Upload a JSON file or paste a FHIR R4 Questionnaire resource. The questionnaire will be saved as-is.
        </Typography>
        <FileUploadArea
          onFileLoaded={(content) => {
            setImportJson(content);
            setError(null);
          }}
          disabled={isImporting}
        />
        <TextField
          value={importJson}
          onChange={(e) => {
            setImportJson(e.target.value);
            setError(null);
          }}
          multiline
          minRows={10}
          maxRows={18}
          fullWidth
          placeholder='{"resourceType": "Questionnaire", ...}'
          error={Boolean(importError || error)}
          helperText={importError?.message ?? error}
          sx={{ mt: 2, '& .MuiInputBase-root': { fontFamily: 'monospace', fontSize: 12 } }}
          disabled={isImporting}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <RoundedButton
          variant="outlined"
          size="medium"
          onClick={() => {
            setOpen(false);
            setImportJson('');
            setError(null);
          }}
          disabled={isImporting}
        >
          Cancel
        </RoundedButton>
        <RoundedButton
          variant="contained"
          size="medium"
          onClick={handleImport}
          disabled={!importJson.trim()}
          loading={isImporting}
          startIcon={<UploadIcon />}
          loadingPosition="start"
        >
          Import
        </RoundedButton>
      </DialogActions>
    </Dialog>
  );
};
