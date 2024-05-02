import { Typography } from '@mui/material';
import { FC, useState } from 'react';
import { CustomDialog, PageForm } from 'ottehr-components';
import PatientPhotoUpload from './PatientPhotoUpload';

type PatientPhotosDialogProps = { onClose: () => void };

export const PatientPhotosDialog: FC<PatientPhotosDialogProps> = ({ onClose }) => {
  const [images, setImages] = useState<string[]>([]);
  const handleClose = (): void => {
    onClose();
  };

  const onNewImageAddedHandler = (files: File[]): string[] | null => {
    if (files.length > 0) {
      const fileNames: string[] = [];
      const tempURLs: string[] = [];
      files.forEach((file) => {
        tempURLs.push(URL.createObjectURL(file));
        fileNames.push(file.name);
      });
      setImages((prev) => [...prev, ...tempURLs]);
      return fileNames;
    } else {
      console.log('No files selected', files, files.length);
    }

    return null;
  };

  const onImageRemovedHandler = (index: number): void => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <CustomDialog open={true} onClose={handleClose}>
      <Typography variant="h2" color="primary.main" sx={{ pb: 3 }}>
        Patient condition photos
      </Typography>

      <PatientPhotoUpload
        onNewImageAdded={onNewImageAddedHandler}
        onImageRemoved={onImageRemovedHandler}
        images={images}
        maxPhotos={3}
      />
      <PageForm
        controlButtons={{
          submitLabel: 'Save',
          backButtonLabel: 'Close',
        }}
      />
    </CustomDialog>
  );
};
