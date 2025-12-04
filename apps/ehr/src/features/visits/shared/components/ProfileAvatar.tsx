import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { Avatar, Box, IconButton, useTheme } from '@mui/material';
import React, { FC, useEffect, useState } from 'react';
import { useGetSignedPatientProfilePhotoUrlQuery } from '../../in-person/queries/in-person.queries';
import { useAppointmentData } from '../stores/appointment/appointment.store';
import ProfilePhotoImagePicker from './ProfilePhotoImagePicker';

type ProfileAvatarProps = {
  appointmentID?: string;
  embracingSquareSize?: number;
  editBubbleSize?: number;
  showEditButton?: boolean;
};

export const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
  appointmentID,
  embracingSquareSize,
  editBubbleSize = 24,
  showEditButton = false,
}): JSX.Element => {
  const { mappedData } = useAppointmentData(appointmentID);
  const theme = useTheme();
  const [isProfileImagePickerOpen, setProfileImagePickerOpen] = useState<boolean>(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | undefined>(undefined);
  const patientPhoto = mappedData?.patientAvatarPhotoUrl;

  useEffect(() => {
    if (!patientPhoto) {
      setProfilePhotoUrl(undefined);
    }
  }, [patientPhoto]);

  useGetSignedPatientProfilePhotoUrlQuery(patientPhoto, (profilePhotoResponse) => {
    if (!profilePhotoResponse) return;

    const { presignedImageUrl } = profilePhotoResponse;
    setProfilePhotoUrl(presignedImageUrl);
  });

  const avatarSquareSize = embracingSquareSize ?? 50;

  return (
    <>
      {isProfileImagePickerOpen && (
        <ProfilePhotoImagePickerForCSS open={isProfileImagePickerOpen} setOpen={setProfileImagePickerOpen} />
      )}
      <Box sx={{ position: 'relative' }}>
        <Avatar
          src={profilePhotoUrl}
          sx={{ width: avatarSquareSize, height: avatarSquareSize }}
          alt="Patient"
          onClick={() => {
            setProfileImagePickerOpen(true);
          }}
        />
        {showEditButton && (
          <IconButton
            size="small"
            aria-label="edit"
            sx={{
              position: 'absolute',
              top: 12,
              right: 12,
              backgroundColor: theme.palette.primary.main,
              color: 'white',
              width: editBubbleSize,
              height: editBubbleSize,
              '&:hover': {
                backgroundColor: theme.palette.primary.dark,
              },
            }}
            onClick={() => {
              setProfileImagePickerOpen(true);
            }}
          >
            <EditOutlinedIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
    </>
  );
};

type ProfilePhotoImagePickerForCSSProps = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

const ProfilePhotoImagePickerForCSS: FC<ProfilePhotoImagePickerForCSSProps> = (props) => {
  const { open, setOpen } = props;
  const { patient, appointmentSetState } = useAppointmentData();

  return (
    <ProfilePhotoImagePicker
      open={open}
      setOpen={setOpen}
      patient={patient}
      onUpdate={(patientData) =>
        appointmentSetState({
          patient: { ...patientData },
        })
      }
    />
  );
};
