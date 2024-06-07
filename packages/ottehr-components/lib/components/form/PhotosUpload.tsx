import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import CloseSharpIcon from '@mui/icons-material/CloseSharp';
import { Box, Button, IconButton, Typography } from '@mui/material';
import { ChangeEvent, FC, useContext, useState } from 'react';
import { FileURLs, PATIENT_PHOTOS_MAX_COUNT_TELEMED } from 'ottehr-utils';
import { IntakeThemeContext } from '../../contexts';
import { filterObject, findMissingNumber } from '../../helpers';
import { MultipleFileUploadOptions } from '../../types';
import { BoldPurpleInputLabel } from './BoldPurpleInputLabel';
import { VisuallyHiddenInput } from './VisuallyHiddenInput';

interface PatientPhotoUploadProps {
  name: string;
  label: string;
  defaultValue?: FileURLs;
  options: MultipleFileUploadOptions;
}

export const PhotosUpload: FC<PatientPhotoUploadProps> = ({ name, label, defaultValue = {}, options }) => {
  const { otherColors } = useContext(IntakeThemeContext);

  const maxPhotos = PATIENT_PHOTOS_MAX_COUNT_TELEMED;
  const [images, setImages] = useState(() => {
    return Object.keys(defaultValue).reduce(
      (prev, curr) => {
        const url = defaultValue?.[curr]?.presignedUrl || defaultValue?.[curr]?.z3Url || defaultValue?.[curr]?.localUrl;
        if (url) {
          prev[curr] = url;
        }
        return prev;
      },
      {} as Record<string, string>
    );
  });

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const { files } = event.target;

    if (files) {
      const fileArr: File[] = Array.from(files).slice(0, maxPhotos - Object.keys(images).length);
      const indexes = Object.keys(images)
        .map((str) => str.split('-').at(-1))
        .filter((str) => !!str)
        .map((str) => +(str as string));

      fileArr.forEach((file) => {
        const index = findMissingNumber(indexes);
        const tempURL = URL.createObjectURL(file);
        const fileType = `${options.fileType}-${index}`;

        options.uploadFile(fileType, tempURL);
        options.onUpload((prev) => ({
          ...prev,
          [fileType]: { ...prev[fileType], fileData: file },
        }));
        options.resetUploadFailed(fileType);

        setImages((prevState) => ({ ...prevState, [fileType]: tempURL }));
        indexes.push(index);
      });
    } else {
      console.log('No files selected!');
    }
  };

  const handleImageRemove = (name: string): void => {
    options.onClear(name);
    setImages((prevState) => filterObject(prevState, (id) => id !== name) as Record<string, string>);
  };

  return (
    <>
      <BoldPurpleInputLabel id={`${name}-label`} htmlFor={name} shrink>
        {label}
      </BoldPurpleInputLabel>

      {Object.keys(images).length > 0 ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
          {Object.keys(images).map((name) => (
            <Box key={name} position="relative" display="inline-block">
              <img
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }}
                src={images[name]}
                alt={name}
                loading="lazy"
              />
              {!options.loading && (
                <IconButton
                  aria-label="delete"
                  size="small"
                  style={{
                    position: 'absolute',
                    top: -5,
                    right: -5,
                    backgroundColor: otherColors.clearImage,
                    padding: '5px',
                  }}
                  onClick={() => handleImageRemove(name)}
                >
                  <CloseSharpIcon sx={{ color: otherColors.white, fontSize: '12px' }} />
                </IconButton>
              )}
            </Box>
          ))}
        </Box>
      ) : (
        <Typography color={otherColors.scheduleBorder}>No files attached</Typography>
      )}

      {Object.keys(images).length < maxPhotos && (
        <Box>
          <Button
            variant="outlined"
            component="label"
            disabled={options.loading}
            sx={{
              textTransform: 'none',
              mt: 2,
            }}
            startIcon={<AddPhotoAlternateOutlinedIcon fontSize="small" />}
          >
            Upload new photo
            <VisuallyHiddenInput
              onChange={(e) => handleInputChange(e)}
              multiple
              type="file"
              accept="image/png, image/jpeg, image/jpg"
            />
          </Button>
        </Box>
      )}
    </>
  );
};
