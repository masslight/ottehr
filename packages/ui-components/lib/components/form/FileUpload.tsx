import { FC, ChangeEvent, useState, useEffect } from 'react';
import { Box, CircularProgress, useTheme } from '@mui/material';
import { useFormContext } from 'react-hook-form';
import { FileUploadOptions } from '../../types';
import { BoldPurpleInputLabel } from './BoldPurpleInputLabel';
import UploadComponent from './UploadComponent';
import CardComponent from './CardComponent';
import { safelyCaptureException } from '../../helpers';

interface FileUploadProps {
  name: string;
  label: string;
  defaultValue?: string;
  options: FileUploadOptions;
}

const FileUpload: FC<FileUploadProps> = ({ name, label, defaultValue, options }) => {
  const { description, onUpload, uploadFile, uploadFailed, resetUploadFailed, onClear, fileType } = options;
  const theme = useTheme();

  const { setValue } = useFormContext();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [fileUrl, setFileUrl] = useState<string | undefined>(defaultValue);

  // If default value exists get a presignedUrl from the defaultValue and assign it to previewUrl
  useEffect(() => {
    async function getPreviewUrl(): Promise<void> {
      setLoading(true);
      if (fileUrl) {
        setPreviewUrl(fileUrl);
      }
    }
    getPreviewUrl().catch((error) => {
      console.log(error);
      safelyCaptureException(error);
    });
    setLoading(false);
  }, [fileUrl]);

  useEffect(() => {
    // If a default value was provided then UploadComponent isn't rendered and the form value never gets set so set it manually.
    // To test this try to log defaultValue in UploadComponent. It will always be undefined because the component is never
    // rendered when a default value exists. Instead a CardComponent is rendered and the form state of name will be undefined
    // unless you set its value because CardComponent does not render an <input />
    if (fileUrl && previewUrl !== 'Not Found' && previewUrl !== null && !loading) {
      setValue(name, defaultValue);
    }
  }, [defaultValue, fileUrl, loading, name, previewUrl, setValue]);

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>): string | null => {
    const { files } = event.target;

    if (files && files.length > 0) {
      // Even though files is an array we know there is always only one file because we don't set the `multiple` attribute on the file input
      const file = files[0];

      const tempURL = URL.createObjectURL(file);
      setPreviewUrl(tempURL); // Use this as a temporary image url until the insurance info form is submitted
      uploadFile(fileType, tempURL);
      onUpload((prev) => ({ ...prev, [fileType]: { ...prev[fileType], fileData: file } }));
      resetUploadFailed();
      return file.name;
    } else {
      console.log('something undefined', files, files?.length);
    }

    return null;
  };

  const showCard = (): JSX.Element => {
    // Prompt to re-upload file if upload fails
    if (uploadFailed) {
      return (
        <UploadComponent
          name={name}
          uploadDescription="Failed to upload card. Please try again"
          handleFileUpload={handleFileUpload}
        />
      );
    }

    // If no default value, check for a temporary previewUrl
    if (!fileUrl && previewUrl) {
      return (
        <CardComponent
          name={name}
          previewUrl={previewUrl}
          alt={fileType}
          setPreviewUrl={setPreviewUrl}
          setFileUrl={setFileUrl}
          onClear={onClear}
        />
      );
    }

    // Try to fetch if there is a default value
    if (fileUrl) {
      if (previewUrl === 'Not Found') {
        // Prompt to upload again if fetching the image fails
        return (
          <UploadComponent
            name={name}
            uploadDescription={`Failed to retrieve card. Please try again. ${description}`}
            handleFileUpload={handleFileUpload}
          />
        );
      }
      if (previewUrl !== 'Not Found' && previewUrl !== null && !loading) {
        // Show the image if the fetch succeeds
        return (
          <CardComponent
            name={name}
            previewUrl={previewUrl}
            alt={fileType}
            setPreviewUrl={setPreviewUrl}
            setFileUrl={setFileUrl}
            onClear={onClear}
          />
        );
      }
      // Otherwise show loading icon while fetching
      return (
        <Box sx={{ mb: 2 }}>
          <Box
            sx={{
              height: 260,
              border: `1px dashed ${theme.palette.primary.main}`,
              borderRadius: 2,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <CircularProgress />
          </Box>
        </Box>
      );
    }

    // Otherwise prompt to upload a file
    return <UploadComponent name={name} uploadDescription={description} handleFileUpload={handleFileUpload} />;
  };

  return (
    <>
      <BoldPurpleInputLabel id={`${name}-label`} htmlFor={name} shrink>
        {label}
      </BoldPurpleInputLabel>
      {showCard()}
    </>
  );
};

export default FileUpload;
