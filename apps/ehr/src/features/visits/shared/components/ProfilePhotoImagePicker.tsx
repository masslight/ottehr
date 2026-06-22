import './ProfilePhotoImagePicker.css';
import CloseIcon from '@mui/icons-material/Close';
import PhotoLibraryOutlinedIcon from '@mui/icons-material/PhotoLibraryOutlined';
import { LoadingButton } from '@mui/lab';
import {
  Box,
  Button,
  ButtonBase,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material';
import { Attachment, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import React, { ChangeEvent, FC, ReactElement, useCallback, useState } from 'react';
import Cropper from 'react-easy-crop';
import { Area, Point } from 'react-easy-crop';
import { MIME_TYPES } from 'utils';
import { uploadPatientProfilePhoto } from '../../../../api/api';
import { getCroppedImg, ImageCropResult } from '../../../../helpers/canvasUtils';
import { useApiClients } from '../../../../hooks/useAppClients';
import { otherColors } from '../../../../themes/ottehr/colors';
import {
  useEditPatientProfilePhotoMutation,
  useGetSignedPatientProfilePhotoUrlQuery,
} from '../../in-person/queries/in-person.queries';
import { useAppointmentData } from '../stores/appointment/appointment.store';

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

const pillButtonSx = {
  borderRadius: '999px',
  textTransform: 'none',
  fontWeight: 'bold',
  py: 1.25,
} as const;

const ProfilePhotoImagePicker: FC<ProfilePhotoImageProps> = ({ open, setOpen, patient, onUpdate }) => {
  const { oystehrZambda } = useApiClients();
  const { appointmentRefetch } = useAppointmentData();

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
  const photoLastObtained = patient?.photo?.[0]?.creation
    ? DateTime.fromISO(patient.photo[0].creation).toFormat('M/d/yyyy')
    : undefined;

  const patientPhotoUrlUnsigned = patient?.photo?.at(0)?.url;

  const { isFetching: isPhotoLoading } = useGetSignedPatientProfilePhotoUrlQuery(
    patientPhotoUrlUnsigned,
    (profilePhotoResponse) => {
      if (!profilePhotoResponse) return;

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
                contentType: MIME_TYPES.JPEG,
                creation: DateTime.now().toISO(),
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
        appointmentRefetch();
      } catch (error) {
        setSavingError(true);
        console.error('Error while updating Patient fhir resource: ', error);
      }
    },
    [editPatientProfilePhotoMutation, onUpdate, patient, appointmentRefetch]
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
        patientId,
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

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const renderControlButtons = (): ReactElement | null => {
    if (!hasAttachedPhoto) {
      return null;
    }

    if (
      photoProcessingState === PhotoProcessingState.cropping ||
      photoProcessingState === PhotoProcessingState.uploading
    ) {
      return (
        <LoadingButton loading={isSavingImage} variant="contained" onClick={handlePhotoSaveClicked} sx={pillButtonSx}>
          Save
        </LoadingButton>
      );
    }

    return (
      <>
        <Button variant="outlined" component="label" color="primary" sx={pillButtonSx}>
          Update Photo
          <VisuallyHiddenInput onChange={handleInputChange} type="file" accept="image/*" />
        </Button>

        <Button variant="outlined" color="error" onClick={handleRemovePhotoClick} sx={pillButtonSx}>
          Remove photo
        </Button>
      </>
    );
  };

  const controlButtons = renderControlButtons();

  const handleClose = (): void => setOpen(false);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      PaperProps={{
        sx: {
          backgroundColor: 'white',
          boxShadow: '0px 20px 60px rgba(0, 0, 0, 0.18)',
          borderRadius: '8px',
          width: 'min(calc(100vw - 4rem), 30rem)',
          margin: 0,
        },
      }}
    >
      <DialogTitle sx={{ py: 1, pb: 0 }}>
        <Grid container alignItems="center" justifyContent="space-between">
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
            <IconButton onClick={handleClose} aria-label="Close">
              <CloseIcon sx={{ color: 'text.secondary' }} />
            </IconButton>
          </Grid>
        </Grid>
      </DialogTitle>

      <Box
        sx={{
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          px: 3,
          pb: hasAttachedPhoto ? 0 : 1,
        }}
      >
        {/* Show cropper to give ability to modify the image */}
        {currentProfileImage && photoProcessingState === PhotoProcessingState.cropping && (
          <Box
            sx={{
              width: '100%',
              height: 420,
              position: 'relative',
            }}
          >
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

        {!hasAttachedPhoto && isPhotoLoading && <CircularProgress />}

        {!hasAttachedPhoto && !isPhotoLoading && (
          <ButtonBase
            component="label"
            aria-label="Upload patient photo"
            sx={{
              width: '100%',
              aspectRatio: '3 / 4',
              border: '1px dashed',
              borderColor: 'primary.main',
              borderRadius: 2,
              backgroundColor: otherColors.cardBackground,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1.5,
              color: 'primary.main',
            }}
          >
            <VisuallyHiddenInput onChange={handleInputChange} type="file" accept="image/*" />
            <PhotoLibraryOutlinedIcon />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Upload Patient Photo
            </Typography>
          </ButtonBase>
        )}

        {/* Preview for the cropped image */}
        {croppedImageResult?.imageUrl && (
          <Box sx={{ width: '100%' }}>
            <Box
              sx={{
                aspectRatio: '3 / 4',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                '& img': {
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                },
              }}
            >
              <img src={croppedImageResult.imageUrl} alt={currentProfileImage?.alt} />
            </Box>
            {photoProcessingState !== PhotoProcessingState.cropping && photoLastObtained && (
              <Typography sx={{ mt: 2, color: 'text.secondary', fontSize: 16 }}>
                Photo last obtained: {photoLastObtained}
              </Typography>
            )}
          </Box>
        )}
      </Box>

      {controlButtons && (
        <DialogContent sx={{ overflow: 'hidden', pt: 1.5, pb: 2 }}>
          <Stack direction="row" spacing={2}>
            {controlButtons}
          </Stack>
        </DialogContent>
      )}
    </Dialog>
  );
};

export default ProfilePhotoImagePicker;
