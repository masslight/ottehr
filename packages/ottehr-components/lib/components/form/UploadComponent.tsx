import { Box, Button, Container, Typography, useTheme } from '@mui/material';
import React, { ChangeEvent, FC, useContext } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import Markdown from 'react-markdown';
import { IntakeThemeContext } from '../../contexts';
import { DescriptionRenderer } from './DescriptionRenderer';

interface UploadComponentProps {
  name: string;
  uploadDescription: string;
  handleFileUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  fileUploadType?: string;
}

const UploadComponent: FC<UploadComponentProps> = ({
  name,
  uploadDescription,
  handleFileUpload,
  fileUploadType,
}): JSX.Element => {
  const theme = useTheme();
  const { control } = useFormContext();
  const { otherColors } = useContext(IntakeThemeContext);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  // HTMLDivElement is here because I used a fragment to wrap uploadAndController.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement | HTMLButtonElement>): void => {
    try {
      if (['Enter', 'Space'].includes(event.code)) {
        inputRef.current?.click();
      }
    } catch (error) {
      console.error(error);
    }
  };
  const handleOnClick = (): void => {
    try {
      if (inputRef?.current) {
        inputRef?.current?.click();
      } else {
        throw new Error('inputRef is not defined');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const uploadAndController = (
    <>
      Upload
      <Controller
        name={name}
        control={control}
        render={({ field: { value, onChange, ...field } }) => {
          return (
            <input
              {...field}
              ref={inputRef}
              value={value?.filename}
              type="file"
              accept={fileUploadType ?? 'image/png, image/jpeg, image/jpg'}
              hidden
              disabled={false}
              onChange={(e) => onChange(handleFileUpload(e))}
            />
          );
        }}
      />
    </>
  );
  const buttonAndOrControllerComponent = fileUploadType ? (
    uploadAndController
  ) : (
    <Button
      id={name}
      // component="label"
      aria-labelledby={`${name}-label`}
      aria-describedby={`${name}-description`}
      variant="contained"
      sx={{ textTransform: 'none', mt: fileUploadType ? -1 : 2 }}
      onKeyDown={handleKeyDown}
      onClick={handleOnClick}
    >
      {uploadAndController}
    </Button>
  );

  return (
    <Box
      onKeyDown={fileUploadType ? handleKeyDown : undefined}
      onClick={fileUploadType ? handleOnClick : undefined}
      sx={{
        height: fileUploadType ? 40 : 260,
        border: `1px dashed ${theme.palette.primary.main}`,
        borderRadius: 2,
        display: 'flex',
        background: otherColors.cardBackground,
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        justifyContent: 'center',
        gap: fileUploadType ? undefined : 1,
        px: 4,
        mb: fileUploadType ? undefined : 2,
        ':hover': fileUploadType
          ? {
              cursor: 'pointer',
            }
          : undefined,
      }}
    >
      <Container style={{ width: '60%', margin: 0, padding: 0 }}>
        <Typography id={`${name}-description`}>
          <Markdown components={{ p: DescriptionRenderer }}>{uploadDescription}</Markdown>
        </Typography>
      </Container>
      {buttonAndOrControllerComponent}
    </Box>
  );
};

export default UploadComponent;
