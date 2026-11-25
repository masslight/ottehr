import './ProfilePhotoImagePicker.css';
import PhotoLibraryOutlinedIcon from '@mui/icons-material/PhotoLibraryOutlined';
import { Box, ButtonBase, CircularProgress, Typography } from '@mui/material';
import { styled } from '@mui/material';
import { Attachment, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import React, { ChangeEvent, FC, useCallback, useRef, useState } from 'react';
import Cropper from 'react-easy-crop';
import { Area, Point } from 'react-easy-crop';
import { AppDialog, AppDialogAction, AppDialogPrimary } from 'src/components/dialogs/AppDialog';
import { MIME_TYPES } from 'utils/lib/utils/file';
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

// The dialog is wider than the photo needs; the body keeps the width it had before.
const BODY_MAX_WIDTH = 432;

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

  const updatePhotoInputRef = useRef<HTMLInputElement>(null);

  const isCropping = photoProcessingState === PhotoProcessingState.cropping;
  const isSaveStep = isCropping || photoProcessingState === PhotoProcessingState.uploading;

  // No photo: nothing to act on, ✕ closes. Picked photo: Save. Stored photo: update or remove it.
  let primary: AppDialogPrimary | undefined;
  let actions: AppDialogAction[] | undefined;
  if (hasAttachedPhoto && isSaveStep) {
    primary = { label: 'Save', onClick: () => void handlePhotoSaveClicked(), loading: isSavingImage };
  } else if (hasAttachedPhoto) {
    actions = [
      { label: 'Update Photo', onClick: () => updatePhotoInputRef.current?.click() },
      { label: 'Remove Photo', tone: 'error', onClick: () => void handleRemovePhotoClick() },
    ];
  }

  const handleClose = (): void => setOpen(false);

  return (
    <AppDialog
      variant="form"
      size={isSaveStep ? 's' : 'm'}
      open={open}
      onClose={handleClose}
      title={isCropping ? 'Please Crop the Image' : 'Patient Photo'}
      primary={primary}
      actions={actions}
      dismiss={primary ? {} : actions ? { label: 'Close' } : undefined}
    >
      <VisuallyHiddenInput ref={updatePhotoInputRef} onChange={handleInputChange} type="file" accept="image/*" />

      {isSavingError && (
        <Typography color="error" sx={{ mb: 2 }}>
          There was an error updating photo, please try again.
        </Typography>
      )}

      <Box
        sx={{
          width: '100%',
          maxWidth: BODY_MAX_WIDTH,
          mx: 'auto',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
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
    </AppDialog>
  );
};

export default ProfilePhotoImagePicker;
