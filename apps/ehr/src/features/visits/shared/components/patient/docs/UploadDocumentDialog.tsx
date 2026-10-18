import UploadFileIcon from '@mui/icons-material/UploadFile';
import { LoadingButton } from '@mui/lab';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  styled,
  TextField,
  Typography,
} from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { ChangeEvent, FC, useEffect, useMemo, useState } from 'react';
import { ScannerModal } from 'src/components/ScannerModal';
import {
  parsePatientDocsFolders,
  PatientDocumentsFolder,
  useGetPatientDocsFolders,
  usePatientDocsActions,
} from 'src/hooks/useGetPatientDocs';
import { safelyCaptureException } from 'utils/lib/frontend/sentry';

const FileAttachmentHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

const VALID_FILE_NAME_PATTERN = /^[a-zA-Z0-9+!\-_'()\\.@$ ]+$/;
const INVALID_FILE_NAME_MESSAGE =
  "Invalid file name. Only letters, numbers, spaces, and these characters are allowed: + ! - _ ' ( ) . @ $";

export type UploadDocumentMode = 'upload' | 'scan';

interface UploadDocumentDialogProps {
  open: boolean;
  /** Upload picks a file; scan opens the scanner. Both file into the folder chosen here. */
  mode: UploadDocumentMode;
  onClose: () => void;
  patientId: string;
  /** When given, the document is also filed against this visit. */
  encounterId?: string;
  /** The folder the user is looking at; the folder field starts empty without one. */
  defaultFolderId?: string;
  /** Called with the folder the document went into, after it is uploaded. */
  onUploaded?: (folder: PatientDocumentsFolder) => void;
}

/** Self-contained so it can be opened from anywhere that knows the patient (documents page, command palette). */
export const UploadDocumentDialog: FC<UploadDocumentDialogProps> = ({
  open,
  mode,
  onClose,
  patientId,
  encounterId,
  defaultFolderId,
  onUploaded,
}) => {
  const { data, isLoading: isLoadingFolders, isError: foldersFailed } = useGetPatientDocsFolders({ patientId });
  const folders = useMemo(
    () =>
      (data ? parsePatientDocsFolders(data, patientId) : []).sort((a, b) => a.folderName.localeCompare(b.folderName)),
    [data, patientId]
  );
  const { uploadDocumentAction, isUploading } = usePatientDocsActions({ patientId, encounterId });
  const [folderId, setFolderId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Each opening starts from the folder the user is in, with no file chosen.
  useEffect(() => {
    if (!open) return;
    setFolderId(defaultFolderId ?? '');
    setFile(null);
  }, [open, defaultFolderId]);

  const folder = folders.find((f) => f.id === folderId);
  const fileNameIsValid = !file || VALID_FILE_NAME_PATTERN.test(file.name);

  const upload = async (docFile: File): Promise<void> => {
    if (!folder) return;
    try {
      await uploadDocumentAction({
        docFile,
        fileName: docFile.name,
        fileFolderId: folder.id,
        internalName: folder.internalName,
      });
      enqueueSnackbar(`Uploaded to ${folder.folderName}`, { variant: 'success' });
      onUploaded?.(folder);
      onClose();
    } catch (error) {
      console.error('Error uploading document:', error);
      safelyCaptureException(error);
      enqueueSnackbar('Failed to upload document', { variant: 'error' });
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setFile(event.target.files?.[0] ?? null);
    // Clear the input, or choosing the same file again fires no change event.
    event.target.value = '';
  };

  const handleScanComplete = (fileBlob: Blob | Blob[], fileName: string): void => {
    // The scanner's default PDF output is a single Blob.
    if (Array.isArray(fileBlob)) {
      enqueueSnackbar('Failed to upload scanned document', { variant: 'error' });
      return;
    }
    const pdfName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
    void upload(new File([fileBlob], pdfName, { type: 'application/pdf' }));
  };

  return (
    <>
      <Dialog open={open && !isScannerOpen} onClose={isUploading ? undefined : onClose} maxWidth="xs" fullWidth>
        <DialogTitle>{mode === 'scan' ? 'Scan Document' : 'Upload Document'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              size="small"
              label="Folder"
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              disabled={isUploading || isLoadingFolders}
              error={foldersFailed}
              helperText={isLoadingFolders ? 'Loading folders…' : foldersFailed ? 'Could not load folders' : undefined}
            >
              {folders.map((f) => (
                <MenuItem key={f.id} value={f.id}>
                  {f.folderName}
                </MenuItem>
              ))}
            </TextField>
            {mode === 'upload' && (
              <Stack spacing={0.5}>
                <Button
                  component="label"
                  variant="outlined"
                  startIcon={<UploadFileIcon fontSize="small" />}
                  disabled={isUploading}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  Choose file
                  <FileAttachmentHiddenInput type="file" capture="environment" onChange={handleFileChange} />
                </Button>
                {file && <Typography variant="body2">{file.name}</Typography>}
                {!fileNameIsValid && (
                  <Typography variant="body2" color="error">
                    {INVALID_FILE_NAME_MESSAGE}
                  </Typography>
                )}
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isUploading}>
            Cancel
          </Button>
          {mode === 'upload' ? (
            <LoadingButton
              variant="contained"
              loading={isUploading}
              disabled={!folder || !file || !fileNameIsValid}
              onClick={() => file && void upload(file)}
            >
              Upload
            </LoadingButton>
          ) : (
            <LoadingButton
              variant="contained"
              loading={isUploading}
              disabled={!folder}
              onClick={() => setIsScannerOpen(true)}
            >
              Scan
            </LoadingButton>
          )}
        </DialogActions>
      </Dialog>
      <ScannerModal
        open={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanComplete={(fileBlob, fileName) => {
          setIsScannerOpen(false);
          handleScanComplete(fileBlob, fileName);
        }}
      />
    </>
  );
};
