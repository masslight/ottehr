import ScannerIcon from '@mui/icons-material/Scanner';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { Box, Button, CircularProgress, useTheme } from '@mui/material';
import Oystehr from '@oystehr/sdk';
import imageCompression from 'browser-image-compression';
import { Attachment } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { ChangeEvent, FC, useEffect, useRef, useState } from 'react';
import { createZ3Object } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { otherColors } from 'src/themes/ottehr/colors';
import { GetPresignedFileURLInput, MIME_TYPES } from 'utils';

interface UploadComponentProps {
  fileName: string;
  appointmentId: string;
  aspectRatio: number;
  disabled?: boolean;
  isUploading?: boolean;
  submitAttachment: (attachment: Attachment) => Promise<void>;
  onScanClick?: () => void;
}

const FILE_TYPES_ACCEPTED = [MIME_TYPES.PNG, MIME_TYPES.JPEG, MIME_TYPES.JPG, MIME_TYPES.PDF].join(', ');

enum UploadState {
  initial,
  pending,
  complete,
}

const UploadComponent: FC<UploadComponentProps> = ({
  fileName,
  appointmentId,
  aspectRatio,
  disabled,
  isUploading,
  submitAttachment,
  onScanClick,
}): JSX.Element => {
  const theme = useTheme();
  const [pendingZ3Upload, setPendingZ3Upload] = useState<File | undefined>();
  const [z3UploadState, setZ3UploadState] = useState(UploadState.initial);
  const [compressingImage, setCompressingImage] = useState(false);
  const { oystehrZambda } = useApiClients();

  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>): Promise<string | null> => {
    try {
      const { files } = event.target;

      if (files && files.length > 0) {
        // Even though files is an array we know there is always only one file because we don't set the `multiple` attribute on the file input
        const file = files[0];
        let finalFile = file;
        const fileSizeInMb = file.size / (1024 * 1024);
        if (fileSizeInMb >= 5) {
          setCompressingImage(true);
          const options = {
            maxSizeMB: 4.9,
          };
          try {
            finalFile = await imageCompression(file, options);
            console.log(`compressedFile size ${finalFile.size / 1024 / 1024} MB`); // smaller than maxSizeMB
          } catch (error) {
            console.log('error compressing file', error);
          }
        }

        setPendingZ3Upload(finalFile);
        setZ3UploadState(UploadState.initial);
        setCompressingImage(false);
        return finalFile.name;
      } else {
        console.log('No files selected');
        return null;
      }
    } catch (error) {
      console.error('Error occurred during file upload:', error);
      return null;
    }
  };

  useEffect(() => {
    const saveObjectToZ3 = async (file: File, appointmentId: string, client: Oystehr): Promise<void> => {
      try {
        setZ3UploadState(UploadState.pending);
        const z3URL = await createZ3Object(
          {
            appointmentID: appointmentId,
            fileType: fileName as GetPresignedFileURLInput['fileType'],
            fileFormat: file.type.split('/')[1] as GetPresignedFileURLInput['fileFormat'],
            file,
          },
          client
        );

        const attachment: Attachment = {
          url: z3URL,
          title: fileName,
          creation: DateTime.now().toISO(),
        };
        await submitAttachment(attachment);
        setZ3UploadState(UploadState.complete);
        setPendingZ3Upload(undefined);
      } catch (e) {
        console.error(e);
        setPendingZ3Upload(undefined);
        setZ3UploadState(UploadState.initial);
        enqueueSnackbar('Error uploading file.', { variant: 'error' });
      }
    };
    if (pendingZ3Upload && appointmentId && z3UploadState === UploadState.initial && oystehrZambda) {
      void saveObjectToZ3(pendingZ3Upload, appointmentId, oystehrZambda);
    }
  }, [pendingZ3Upload, z3UploadState, fileName, appointmentId, oystehrZambda, submitAttachment]);

  const isLoading = z3UploadState === UploadState.pending || compressingImage || isUploading;

  return (
    <Box
      sx={{
        border: `1px dashed ${disabled ? otherColors.disabled : theme.palette.primary.main}`,
        borderRadius: 2,
        background: disabled ? otherColors.disabledBackground : otherColors.cardBackground,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        padding: 2,
        aspectRatio,
      }}
    >
      {compressingImage || isLoading ? (
        <CircularProgress size={24} />
      ) : (
        <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column', width: '100%' }}>
          <Button
            variant="outlined"
            size="medium"
            disabled={disabled}
            startIcon={<UploadFileIcon />}
            onClick={() => inputRef.current?.click()}
            sx={{
              borderRadius: '20px',
              textTransform: 'none',
            }}
          >
            Upload
          </Button>
          <Button
            variant="outlined"
            size="medium"
            disabled={disabled}
            startIcon={<ScannerIcon />}
            onClick={onScanClick}
            sx={{
              borderRadius: '20px',
              textTransform: 'none',
            }}
          >
            Scan
          </Button>
        </Box>
      )}
      <input
        type="file"
        accept={FILE_TYPES_ACCEPTED}
        hidden
        ref={inputRef}
        onChange={async (e) => {
          e.preventDefault();
          await handleFileUpload(e);
        }}
      />
    </Box>
  );
};

export default UploadComponent;
