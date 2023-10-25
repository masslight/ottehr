import { Box, CircularProgress, Typography, useTheme } from '@mui/material';
import { ChangeEvent, FC, ReactNode, useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { zapehrApi } from '../api';
import { BoldPrimaryInputLabel } from './BoldPrimaryInputLabel';
import { CardComponent } from './CardComponent';
import { UploadComponent } from './UploadComponent';

export interface FileUploadOptions {
  bucketName: string;
  description: ReactNode;
  objectFolder: string | undefined;
  objectName: string;
  onClear: () => void;
  onUpload: (file: File | null) => void;
  resetUploadFailed: () => void;
  token: string | null;
  uploadFailed: boolean;
}

interface FileUploadProps {
  defaultValue?: string;
  label: string;
  name: string;
  options: FileUploadOptions;
}

export const FileUpload: FC<FileUploadProps> = ({ defaultValue, label, name, options }) => {
  const {
    bucketName,
    description,
    objectFolder,
    objectName,
    onClear,
    onUpload,
    resetUploadFailed,
    token,
    uploadFailed,
  } = options;
  const theme = useTheme();
  const { setValue } = useFormContext();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | undefined>(defaultValue);

  // If default value exists get a presignedUrl from the defaultValue and assign it to previewUrl
  useEffect(() => {
    async function getPreviewUrl(): Promise<void> {
      setLoading(true);
      if (fileUrl && token) {
        const imageUrl = await zapehrApi.getZ3Object(fileUrl, token).catch((error) => console.log(error));
        setPreviewUrl(imageUrl || 'Not Found');
      }
    }
    getPreviewUrl().catch((error) => console.log(error));
    setLoading(false);
  }, [fileUrl, token]);

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>): string | null => {
    const { files } = event.target;

    if (files && files.length > 0) {
      // Even though files is an array we know there is always only one file because we don't set the `multiple` attribute on the file input
      const file = files[0];

      if (objectFolder) {
        onUpload(file);
        setPreviewUrl(URL.createObjectURL(file)); // Use this as a temporary image url until the insurance info form is submitted
        resetUploadFailed();

        // Return an endpoint to the file input to create the object
        const fileType = file.type.split('/')[1];
        return `${import.meta.env.VITE_UPLOAD_URL}/z3/object/${bucketName}/${objectFolder}/${objectName}.${fileType}`;
      } else {
        console.error('Error uploading file: No patient id found');
        return null;
      }
    }

    return null;
  };

  const showCard = (): JSX.Element => {
    // Prompt to re-upload file if upload fails
    if (uploadFailed) {
      return (
        <UploadComponent
          defaultValue={defaultValue}
          handleFileUpload={handleFileUpload}
          name={name}
          uploadDescription={
            <>
              <Typography>Failed to upload card. Please try again.</Typography>
              {description}
            </>
          }
        />
      );
    }

    // If no default value, check for a temporary previewUrl
    if (!fileUrl && previewUrl) {
      return (
        <CardComponent
          name={name}
          objectName={objectName}
          onClear={onClear}
          previewUrl={previewUrl}
          setFileUrl={setFileUrl}
          setPreviewUrl={setPreviewUrl}
        />
      );
    }

    // Try to fetch if there is a default value
    if (fileUrl) {
      if (previewUrl === 'Not Found') {
        // Prompt to upload again if fetching the image fails
        return (
          <UploadComponent
            defaultValue={defaultValue}
            handleFileUpload={handleFileUpload}
            name={name}
            uploadDescription={
              <>
                <Typography>Failed to retrieve card. Please try again.</Typography>
                {description}
              </>
            }
          />
        );
      }
      if (previewUrl !== 'Not Found' && previewUrl !== null && !loading) {
        // Show the image if the fetch succeeds. If a default value was provided then UploadComponent isn't rendered and
        // the form value never gets set so set it manually. To test this try to log defaultValue in UploadComponent. It
        // will always be undefined because the component is never rendered when a default value exists. Instead a
        // CardComponent is rendered and the form state of name will be undefined unless you set its value because
        // CardComponent does not render an <input />.
        setValue(name, defaultValue);
        return (
          <CardComponent
            name={name}
            objectName={objectName}
            onClear={onClear}
            previewUrl={previewUrl}
            setFileUrl={setFileUrl}
            setPreviewUrl={setPreviewUrl}
          />
        );
      }
      // Otherwise show loading icon while fetching
      return (
        <Box sx={{ mb: 2 }}>
          <Box
            sx={{
              alignItems: 'center',
              border: `1px dashed ${theme.palette.primary.main}`,
              borderRadius: 2,
              display: 'flex',
              height: 260,
              justifyContent: 'center',
            }}
          >
            <CircularProgress />
          </Box>
        </Box>
      );
    }

    // Otherwise prompt to upload a file
    return (
      <UploadComponent
        defaultValue={defaultValue}
        handleFileUpload={handleFileUpload}
        name={name}
        uploadDescription={description}
      />
    );
  };

  return (
    <>
      <BoldPrimaryInputLabel htmlFor={`${name}-label`} shrink>
        {label}
      </BoldPrimaryInputLabel>
      {showCard()}
    </>
  );
};
