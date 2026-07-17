import { DeleteOutlined as DeleteIcon, InsertDriveFileOutlined as FileIcon } from '@mui/icons-material';
import { Box, IconButton, Link, Typography } from '@mui/material';
import { Attachment } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { FC, useState } from 'react';
import { createZ3Object } from 'src/api/api';
import ImageUploader from 'src/components/ImageUploader';
import { ScannerModal } from 'src/components/ScannerModal';
import { useApiClients } from 'src/hooks/useAppClients';
import { GetPresignedFileURLInput, MIME_TYPES, VitalsDotVisionScreeningDocument } from 'utils';
import { useOpenDotVisionDocument } from './useOpenDotVisionDocument';

// Reuses the patient-photo presigned-URL flow purely for the Z3 byte upload. The file bytes are
// uploaded to Z3 here, but the DocumentReference is created lazily (only when the DOT screening
// entry is saved) by the upload-dot-vision-document zambda, so a discarded attachment never leaves
// an orphaned DocumentReference behind.
const DOT_VISION_FILE_TYPE: GetPresignedFileURLInput['fileType'] = 'patient-photo-dot-vision';

// Referral documentation is commonly a PDF, so allow it alongside the default image types.
const DOT_VISION_ACCEPTED_FILE_TYPES = [MIME_TYPES.PDF, MIME_TYPES.PNG, MIME_TYPES.JPEG, MIME_TYPES.JPG].join(', ');

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
  const { openDocument, isOpening } = useOpenDotVisionDocument();
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
        <Link
          component="button"
          type="button"
          onClick={() => void openDocument(document)}
          disabled={isOpening}
          sx={{ flexGrow: 1, fontWeight: 500, textAlign: 'left' }}
        >
          {document.title}
        </Link>
        {!disabled && (
          <IconButton size="small" color="error" aria-label="remove document" onClick={onRemove}>
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
        acceptedFileTypes={DOT_VISION_ACCEPTED_FILE_TYPES}
      />
      <ScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} onScanComplete={handleScanComplete} />
      {isUploading && (
        <Typography sx={{ mt: 0.5, fontSize: 12, color: 'text.secondary' }}>Attaching documentation…</Typography>
      )}
    </Box>
  );
};

export default DotVisionDocumentUploader;
