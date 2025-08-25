import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { Avatar, Box, IconButton, useTheme } from '@mui/material';
import React, { FC, useEffect, useState } from 'react';
import { useAppointmentData } from 'src/telemed';
import { EditPatientDialog } from '../../../components/dialogs';
import ProfilePhotoImagePicker from '../../../components/ProfilePhotoImagePicker';
import { useGetSignedPatientProfilePhotoUrlQuery } from '../queries/css.queries';

type ProfileAvatarProps = {
  appointmentID?: string;
  embracingSquareSize?: number;
  hasEditableInfo?: boolean;
};

export const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
  appointmentID,
  embracingSquareSize,
  hasEditableInfo,
}): JSX.Element => {
  const { mappedData } = useAppointmentData(appointmentID);
  const theme = useTheme();
  const [isProfileImagePickerOpen, setProfileImagePickerOpen] = useState<boolean>(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState<boolean>(false);
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
  const editBubbleSize = Math.floor(0.3 * avatarSquareSize);

  return (
    <>
      {isProfileImagePickerOpen && (
        <ProfilePhotoImagePickerForCSS open={isProfileImagePickerOpen} setOpen={setProfileImagePickerOpen} />
      )}
      {hasEditableInfo && isEditDialogOpen && (
        <EditPatientDialog modalOpen={isEditDialogOpen} onClose={() => setIsEditDialogOpen(false)} />
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
        {hasEditableInfo && (
          <IconButton
            size="small"
            aria-label="edit"
            sx={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              backgroundColor: theme.palette.primary.main,
              color: 'white',
              width: editBubbleSize,
              height: editBubbleSize,
              '&:hover': {
                backgroundColor: theme.palette.primary.dark,
              },
            }}
            onClick={() => {
              setIsEditDialogOpen(true);
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
