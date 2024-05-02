import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import CloseSharpIcon from '@mui/icons-material/CloseSharp';
import { Box, Button, IconButton } from '@mui/material';
import React, { ChangeEvent, FC } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { otherColors } from '../IntakeThemeProvider';

interface PatientPhotoUploadProps {
  onNewImageAdded: (files: File[]) => void;
  onImageRemoved: (index: number) => void;
  images: string[];
  maxPhotos: number;
}

const PatientPhotoUpload: FC<PatientPhotoUploadProps> = ({ onNewImageAdded, onImageRemoved, images, maxPhotos }) => {
  const methods = useForm();

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const { files } = event.target;

    if (files) {
      const fileArr: File[] = Array.from(files).slice(0, maxPhotos - images.length);
      onNewImageAdded(fileArr);
    } else {
      console.log('No files selected!');
    }
  };

  const inputRef = React.useRef<HTMLInputElement | null>(null);

  return (
    <FormProvider {...methods}>
      <form>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
          {images.map((url, index) => (
            <Box sx={{}} key={index} position="relative" display="inline-block">
              <img
                key={index}
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }}
                src={url}
                alt={`image-${index.toString()}`}
                loading="lazy"
              />
              <IconButton
                aria-label="delete"
                size="small"
                style={{ position: 'absolute', top: -5, right: -5, backgroundColor: otherColors.clearImage }}
                onClick={() => onImageRemoved(index)}
              >
                <CloseSharpIcon fontSize="small" sx={{ color: otherColors.white }} />
              </IconButton>
            </Box>
          ))}
        </Box>
        {images.length < maxPhotos && (
          <Box>
            <Button
              variant="outlined"
              sx={{ textTransform: 'none', mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}
              onKeyDown={(event) => {
                if (['Enter', 'Space'].includes(event.code)) {
                  inputRef.current?.click();
                }
              }}
              onClick={() => inputRef.current?.click()}
            >
              <AddPhotoAlternateOutlinedIcon fontSize="small" />
              Upload from gallery
              <Controller
                name="photos"
                control={methods.control}
                render={({ field: { value, onChange, ...field } }) => {
                  return (
                    <input
                      {...field}
                      ref={inputRef}
                      multiple
                      value={value?.filename}
                      type="file"
                      accept="image/png, image/jpeg, image/jpg"
                      hidden
                      disabled={false}
                      onChange={(e) => onChange(handleInputChange(e))}
                    />
                  );
                }}
              />
            </Button>
          </Box>
        )}
      </form>
    </FormProvider>
  );
};

export default PatientPhotoUpload;
