import { Box, Button, Container, Typography, useTheme } from '@mui/material';
import { ChangeEvent, FC, useContext, RefObject } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import Markdown from 'react-markdown';
import { IntakeThemeContext, DescriptionRenderer } from 'ui-components';
import { AttachmentType } from '.';

interface UploadComponentProps {
  name: string;
  attachmentType: AttachmentType;
  uploadDescription: string | JSX.Element;
  isCompressing: boolean;
  handleFileUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  inputRef: RefObject<HTMLInputElement>;
  showUploadButton: boolean;
}

const UploadComponent: FC<UploadComponentProps> = ({
  name,
  uploadDescription,
  handleFileUpload,
  inputRef,
  showUploadButton,
  isCompressing,
  attachmentType,
}): JSX.Element => {
  const theme = useTheme();
  const { control } = useFormContext();
  const { otherColors } = useContext(IntakeThemeContext);

  const fileTypesAccepted = (() => {
    if (attachmentType === 'image') {
      return 'image/png, image/jpeg, image/jpg';
    } else {
      return 'application/pdf';
    }
  })();

  return (
    <Box sx={{ mb: 2 }}>
      <Box
        sx={{
          height: attachmentType === 'image' ? 260 : 45,
          border: `1px dashed ${theme.palette.primary.main}`,
          borderRadius: 2,
          display: 'flex',
          background: otherColors.cardBackground,
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          justifyContent: 'center',
          px: 4,
          mb: 2,
        }}
      >
        <Container style={{ width: '60%', margin: 0, padding: 0 }}>
          <Typography id={`${name}-description`}>
            {isCompressing ? (
              <Markdown components={{ p: DescriptionRenderer }}>
                {"Hold tight!  \nThis image is a little too big, we're compressing it for you..."}
              </Markdown>
            ) : typeof uploadDescription === 'string' ? (
              <Markdown components={{ p: DescriptionRenderer }}>{uploadDescription}</Markdown>
            ) : (
              uploadDescription
            )}
          </Typography>
        </Container>
        <Controller
          name={name}
          control={control}
          render={({ field: { value, ...field } }) => (
            <input
              {...field}
              name={`name.valueAttachment.url`}
              ref={inputRef}
              value={value?.filename}
              type="file"
              accept={fileTypesAccepted}
              hidden
              onChange={async (e) => {
                e.preventDefault();
                handleFileUpload(e);
              }}
            />
          )}
        />

        {showUploadButton && !isCompressing && (
          <Button
            id={name}
            // component="label"
            aria-labelledby={`${name}-label`}
            aria-describedby={`${name}-description`}
            variant="contained"
            sx={{ textTransform: 'none' }}
            onKeyDown={(event) => {
              try {
                if (['Enter', 'Space'].includes(event.code)) {
                  inputRef.current?.click();
                }
              } catch (error) {
                console.error(error);
              }
            }}
            onClick={() => {
              try {
                if (inputRef.current) {
                  inputRef.current.click();
                } else {
                  throw new Error('inputRef is not defined');
                }
              } catch (error) {
                console.error(error);
              }
            }}
          >
            Upload
          </Button>
        )}
      </Box>
    </Box>
  );
};

export default UploadComponent;
