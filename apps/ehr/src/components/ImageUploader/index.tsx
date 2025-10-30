import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import { Box, Container, Typography, useTheme } from '@mui/material';
import Oystehr from '@oystehr/sdk';
import imageCompression from 'browser-image-compression';
import { Attachment } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { ChangeEvent, FC, ReactElement, useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import { createZ3Object } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { otherColors } from 'src/themes/ottehr/colors';
import { GetPresignedFileURLInput, MIME_TYPES } from 'utils';

interface UploadComponentProps {
  fileName: GetPresignedFileURLInput['fileType'];
  appointmentId: string | undefined;
  submitAttachment: (attachment: Attachment) => Promise<void>;
}

const FILE_TYPES_ACCEPTED = [MIME_TYPES.PNG, MIME_TYPES.JPEG, MIME_TYPES.JPG, MIME_TYPES.PDF].join(', ');

function DescriptionRenderer(props: any): ReactElement {
  return <span>{props.children}</span>;
}

enum UploadState {
  initial,
  pending,
  complete,
  failed,
}

const UploadComponent: FC<UploadComponentProps> = ({ fileName, appointmentId, submitAttachment }): JSX.Element => {
  const theme = useTheme();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
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

        const tempURL = URL.createObjectURL(finalFile);
        setPreviewUrl(tempURL); // Use this as a temporary image URL until the insurance info form is submitted
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
            fileType: fileName,
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
        console.log('z3 upload complete, attachment:', attachment);
        setZ3UploadState(UploadState.complete);
        await submitAttachment(attachment);
        setPendingZ3Upload(undefined);
      } catch (e) {
        console.error(e);
        setZ3UploadState(UploadState.failed);
      } finally {
        setPendingZ3Upload(undefined);
      }
    };
    if (pendingZ3Upload && appointmentId && z3UploadState === UploadState.initial && oystehrZambda) {
      void saveObjectToZ3(pendingZ3Upload, appointmentId, oystehrZambda);
    }
  }, [pendingZ3Upload, z3UploadState, fileName, appointmentId, oystehrZambda, submitAttachment]);

  return (
    <Box
      sx={{
        border: `1px dashed ${theme.palette.primary.main}`,
        borderRadius: 2,
        // display: 'flex',
        background: otherColors.cardBackground,
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        justifyContent: 'center',
        px: 4,
        cursor: 'pointer',
        height: '156px',
      }}
      onClick={() => {
        inputRef.current?.click();
      }}
    >
      <Container
        style={{
          margin: 0,
          padding: 0,
          minHeight: '100%',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {compressingImage ? (
          <Typography id={`${name}-description`}>
            <Markdown components={{ p: DescriptionRenderer }}>
              {"Hold tight!  \nThis image is a little too big, we're compressing it for you..."}
            </Markdown>
          </Typography>
        ) : (
          <Box height="100%" display={'flex'} gap={1} flexDirection="row" alignItems="center" justifyContent="center">
            <AddPhotoAlternateIcon fontSize="small" color="primary" />
            <Typography variant="body2" color="primary">
              Add Image
            </Typography>
          </Box>
        )}
      </Container>
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
