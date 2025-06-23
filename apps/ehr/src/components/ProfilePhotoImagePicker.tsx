import CloseIcon from '@mui/icons-material/Close';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Typography,
} from '@mui/material';
import React, { ChangeEvent, FC, ReactElement, useCallback, useState } from 'react';
import AddAPhotoOutlinedIcon from '@mui/icons-material/AddAPhotoOutlined';
import DeleteForeverOutlinedIcon from '@mui/icons-material/DeleteForeverOutlined';
import { styled } from '@mui/material';
import Cropper from 'react-easy-crop';
import { Point, Area } from 'react-easy-crop/types';
import { getCroppedImg, ImageCropResult } from '../helpers/canvasUtils';
import { LoadingButton } from '@mui/lab';
import { useApiClients } from '../hooks/useAppClients';
import { uploadPatientProfilePhoto } from '../api/api';
import {
  useEditPatientProfilePhotoMutation,
  useGetSignedPatientProfilePhotoUrlQuery,
} from '../features/css-module/queries/css.queries';
import { Attachment, Patient } from 'fhir/r4b';
import './ProfilePhotoImagePicker.css';

export interface ProfileImageItem {
  alt: string;
  url: string;
}

interface ProfilePhotoImageProps {
  open: boolean; // if true the dialog is open
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  patient: Patient | undefined;
  onUpdate?: (updatedPatient: Patient) => void;
}

enum PhotoProcessingState {
  cropping, // photo has been selected and currently is under processing (cropping/scaling)
  cropped, // photo processing procedure has been finished
  uploading,
  uploaded,
}

const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

const ProfilePhotoImagePicker: FC<ProfilePhotoImageProps> = ({ open, setOpen, patient, onUpdate }) => {
  const { oystehrZambda } = useApiClients();

  const [photoProcessingState, setPhotoProcessingState] = useState<PhotoProcessingState | undefined>(undefined);
  const [currentProfileImage, setCurrentProfileImage] = useState<ProfileImageItem | undefined>(undefined);

  const [croppedImageResult, setCroppedImageResult] = useState<ImageCropResult | undefined>(undefined);
  // react-easy-crop computes the cropping area and updates this state
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  // Zoom level for cropping
  const [zoom, setZoom] = useState<number>(1);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });

  const [isSavingImage, setIsSavingImage] = useState<boolean>(false);
  const [isSavingError, setSavingError] = useState(false);

  const hasAttachedPhoto = !!currentProfileImage;

  const patientPhotoUrlUnsigned = patient?.photo?.at(0)?.url;
  const { isFetching: isPhotoLoading } = useGetSignedPatientProfilePhotoUrlQuery(
    patientPhotoUrlUnsigned,
    (profilePhotoResponse) => {
      const { presignedImageUrl } = profilePhotoResponse;

      clearPickedPhotoState();
      setCurrentProfileImage({
        alt: 'Profile photo',
        url: presignedImageUrl,
      });
      setCroppedImageResult({ imageUrl: presignedImageUrl });
      setPhotoProcessingState(PhotoProcessingState.cropped);
    }
  );

  const editPatientProfilePhotoMutation = useEditPatientProfilePhotoMutation();

  const updatePatientRecordWithPhotoUrl = useCallback(
    async (profilePhotoUrl: string | undefined): Promise<void> => {
      try {
        if (!patient?.id) {
          throw new Error('Patient reference not available');
        }

        const photoAttachments: Attachment[] | undefined = profilePhotoUrl
          ? [
              {
                contentType: 'image/jpeg',
                url: profilePhotoUrl,
              },
            ]
          : undefined;

        const patientData: Patient = {
          ...patient,
          resourceType: 'Patient',
          id: patient.id,
          photo: photoAttachments,
        };

        await editPatientProfilePhotoMutation.mutateAsync({
          originalPatient: patient,
          newPatientData: patientData,
        });

        onUpdate?.(patientData);
      } catch (error) {
        setSavingError(true);
        console.error('Error while updating Patient fhir resource: ', error);
      }
    },
    [editPatientProfilePhotoMutation, onUpdate, patient]
  );

  const clearPickedPhotoState = (): void => {
    setCurrentProfileImage(undefined);
    setPhotoProcessingState(undefined);
    setCroppedImageResult(undefined);
    setSavingError(false);
  };

  const handleRemovePhotoClick = useCallback(async () => {
    clearPickedPhotoState();
    await updatePatientRecordWithPhotoUrl(undefined);
  }, [updatePatientRecordWithPhotoUrl]);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const { files } = event.target;

    const allFiles = (files && Array.from(files)) ?? [];
    const capturedPhotoFile = allFiles.at(0);

    if (!capturedPhotoFile) {
      console.warn('No photo file selected/available - earlier skip!');
      return;
    }

    const photoFileUrl = URL.createObjectURL(capturedPhotoFile);

    setCurrentProfileImage({
      alt: 'Profile photo',
      url: photoFileUrl,
    });
    setPhotoProcessingState(PhotoProcessingState.cropping);
    setCroppedImageResult(undefined);
    setSavingError(false);
  };

  const handlePhotoSaveClicked = useCallback(async () => {
    try {
      setIsSavingImage(true);

      if (!oystehrZambda) {
        console.warn('zambdaClient not available - skip uploading');
        return;
      }

      const photoUrl = currentProfileImage?.url;
      if (!photoUrl) {
        console.warn('No photoUrl to process - skip processing');
        return;
      }
      if (!croppedAreaPixels) {
        console.warn('No croppedAreaPixels to process - skip processing');
        return;
      }

      const imageCroppingResult = await getCroppedImg(photoUrl, croppedAreaPixels);
      if (!imageCroppingResult) {
        console.warn(`Can not crop a given photo - skip saving`);
        return;
      }

      const { imageFile } = imageCroppingResult;

      setCroppedImageResult(imageCroppingResult);
      setPhotoProcessingState(PhotoProcessingState.cropped);

      if (!imageFile) {
        console.warn(`imageFile is undefined - skip saving`);
        return;
      }

      setPhotoProcessingState(PhotoProcessingState.uploading);

      const patientId = patient?.id;
      if (!patientId) {
        console.warn('patientId not available - skip uploading');
        return;
      }

      // TODO: useMutation for it ?
      const uploadResponse = await uploadPatientProfilePhoto(oystehrZambda, {
        patientID: patientId,
        patientPhotoFile: imageFile,
      });

      if (!uploadResponse) {
        console.warn(`uploading patient profile photo failed - skip saving`);
        return;
      }

      await updatePatientRecordWithPhotoUrl(uploadResponse.z3ImageUrl);
      setPhotoProcessingState(PhotoProcessingState.uploaded);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingImage(false);
    }
  }, [currentProfileImage, croppedAreaPixels, updatePatientRecordWithPhotoUrl, patient, oystehrZambda]);

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  // Dialog's control buttons bar
  const renderControlButtons = (): ReactElement => {
    if (!hasAttachedPhoto) {
      return (
        <Button
          variant="outlined"
          component="label"
          disabled={false}
          color="primary"
          sx={{
            borderRadius: '16px',
            textTransform: 'none',
            mt: 2,
            fontWeight: 'bold',
          }}
          startIcon={<AddAPhotoOutlinedIcon fontSize="small" />}
        >
          Take photo
          <VisuallyHiddenInput
            onChange={(e) => handleInputChange(e)}
            type="file"
            capture="environment"
            accept="image/*"
          />
        </Button>
      );
    }

    if (
      photoProcessingState === PhotoProcessingState.cropping ||
      photoProcessingState === PhotoProcessingState.uploading
    ) {
      return (
        <LoadingButton
          loading={isSavingImage}
          variant="contained"
          onClick={() => handlePhotoSaveClicked()}
          sx={{
            fontWeight: 'bold',
            borderRadius: '16px',
            textTransform: 'none',
          }}
        >
          Save
        </LoadingButton>
      );
    }

    return (
      <>
        <Button
          variant="outlined"
          component="label"
          disabled={false}
          color="primary"
          sx={{
            borderRadius: '16px',
            textTransform: 'none',
            mt: 2,
            fontWeight: 'bold',
          }}
          startIcon={<AddAPhotoOutlinedIcon fontSize="small" />}
        >
          Retake photo
          <VisuallyHiddenInput
            onChange={(e) => handleInputChange(e)}
            type="file"
            capture="environment"
            accept="image/*"
          />
        </Button>

        <Button
          onClick={handleRemovePhotoClick}
          variant="outlined"
          component="label"
          disabled={false}
          color="error"
          sx={{
            borderRadius: '16px',
            textTransform: 'none',
            mt: 2,
            ml: 3,
            fontWeight: 'bold',
          }}
          startIcon={<DeleteForeverOutlinedIcon fontSize="small" />}
        >
          Remove photo
        </Button>
      </>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        setOpen(false);
      }}
      PaperProps={{
        style: {
          backgroundColor: 'white',
          boxShadow: 'none',
          maxWidth: '900px',
        },
      }}
    >
      <DialogTitle marginBottom={0}>
        <Grid
          container
          alignItems="center"
          justifyContent="space-between"
          sx={{ width: '100%', border: 1, borderColor: 'white' }}
        >
          <Grid item xs />
          <Grid item>
            {photoProcessingState === PhotoProcessingState.cropping && (
              <Typography variant="h6" align="center">
                Please crop the image
              </Typography>
            )}
            {isSavingError && (
              <Typography color="error" variant="h6" align="center">
                There was an error updating photo, please try again.
              </Typography>
            )}
          </Grid>
          <Grid item xs container justifyContent="flex-end">
            <IconButton
              onClick={() => {
                setOpen(false);
              }}
            >
              <CloseIcon sx={{ color: '#938B7D' }} />
            </IconButton>
          </Grid>
        </Grid>
      </DialogTitle>

      <Box
        sx={{
          minWidth: '500px',
          width: '100%',
          height: '50vh',
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          '& img': {
            paddingX: '32px',
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          },
        }}
      >
        {/* Show cropper to give ability to modify the image */}
        {currentProfileImage && photoProcessingState === PhotoProcessingState.cropping && (
          <Box mt={2} textAlign="center">
            <Cropper
              image={currentProfileImage?.url}
              crop={crop}
              zoom={zoom}
              aspect={3 / 4}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              onCropChange={setCrop}
            />
          </Box>
        )}

        {!hasAttachedPhoto && isPhotoLoading && (
          <Box sx={{ justifyContent: 'center', display: 'flex' }}>
            <CircularProgress />
          </Box>
        )}

        {!hasAttachedPhoto && !isPhotoLoading && (
          <Typography
            variant="h6"
            color="primary.dark"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            Please take the photo
          </Typography>
        )}

        {/* Preview for the cropped image */}
        {croppedImageResult?.imageUrl && <img src={croppedImageResult.imageUrl} alt={currentProfileImage?.alt} />}
      </Box>

      <DialogContent style={{ overflow: 'hidden' }}>
        <Box alignItems="center" display="flex" sx={{ mb: 1 }}>
          {renderControlButtons()}
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default ProfilePhotoImagePicker;
