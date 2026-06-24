import { DeleteOutlined as DeleteIcon, InsertDriveFileOutlined as FileIcon } from '@mui/icons-material';
import { Box, IconButton, Link, Typography } from '@mui/material';
import { Attachment } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { FC, useState } from 'react';
import { createZ3Object } from 'src/api/api';
import ImageUploader from 'src/components/ImageUploader';
import { ScannerModal } from 'src/components/ScannerModal';
import { useApiClients } from 'src/hooks/useAppClients';
import { GetPresignedFileURLInput, VitalsDotVisionScreeningDocument } from 'utils';

// Reuses the patient-photo presigned-URL flow purely for the Z3 byte upload. The file bytes are
// uploaded to Z3 here, but the DocumentReference is created lazily (only when the DOT screening
// entry is saved) by the upload-dot-vision-document zambda, so a discarded attachment never leaves
// an orphaned DocumentReference behind.
const DOT_VISION_FILE_TYPE: GetPresignedFileURLInput['fileType'] = 'patient-photo-dot-vision';

interface DotVisionDocumentUploaderProps {
  appointmentId: string;
  document?: VitalsDotVisionScreeningDocument;
  disabled?: boolean;
  onUploaded: (document: VitalsDotVisionScreeningDocument) => void;
  onRemove: () => void;
}

export const DotVisionDocumentUploader: FC<DotVisionDocumentUploaderProps> = ({
  appointmentId,
  document,
  disabled,
  onUploaded,
  onRemove,
}) => {
  const { oystehrZambda } = useApiClients();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // No documentReferenceId yet: the file lives in Z3, but the DocumentReference is created on save.
  const attachDocument = (z3URL: string, title: string): void => {
    onUploaded({ url: z3URL, title });
  };

  const handleSubmitAttachment = async (attachment: Attachment): Promise<void> => {
    if (!attachment.url) return;
    attachDocument(attachment.url, attachment.title ?? 'DOT vision document');
    enqueueSnackbar('Documentation attached', { variant: 'success' });
  };

  const handleScanComplete = async (fileBlob: Blob | Blob[], fileName: string): Promise<void> => {
    if (!oystehrZambda) return;
    try {
      setIsUploading(true);
      const blob = Array.isArray(fileBlob) ? fileBlob[0] : fileBlob;
      const pdfFileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
      const z3URL = await createZ3Object(
        {
          appointmentID: appointmentId,
          fileType: DOT_VISION_FILE_TYPE,
          fileFormat: 'pdf',
          file: new File([blob], pdfFileName, { type: 'application/pdf' }),
        },
        oystehrZambda
      );
      attachDocument(z3URL, pdfFileName);
      setScannerOpen(false);
      enqueueSnackbar('Scanned documentation attached', { variant: 'success' });
    } catch (error) {
      console.error('Error attaching scanned DOT vision document', error);
      enqueueSnackbar('Error attaching scanned documentation', { variant: 'error' });
    } finally {
      setIsUploading(false);
    }
  };

  if (document) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          mt: 1,
          p: 1,
          borderRadius: 2,
          backgroundColor: '#EBEFF4',
        }}
      >
        <FileIcon fontSize="small" color="primary" />
        <Link href={document.url} target="_blank" rel="noopener" sx={{ flexGrow: 1, fontWeight: 500 }}>
          {document.title}
        </Link>
        {!disabled && (
          <IconButton size="small" aria-label="remove document" onClick={onRemove}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 1 }}>
      <ImageUploader
        fileName={DOT_VISION_FILE_TYPE}
        appointmentId={appointmentId}
        aspectRatio={6}
        disabled={disabled}
        isUploading={isUploading}
        submitAttachment={handleSubmitAttachment}
        onScanClick={() => setScannerOpen(true)}
      />
      <ScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} onScanComplete={handleScanComplete} />
      {isUploading && (
        <Typography sx={{ mt: 0.5, fontSize: 12, color: 'text.secondary' }}>Attaching documentation…</Typography>
      )}
    </Box>
  );
};

export default DotVisionDocumentUploader;
