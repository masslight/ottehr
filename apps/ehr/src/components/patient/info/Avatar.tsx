import { Avatar, SxProps, Theme } from '@mui/material';
import { FC, useMemo, useState } from 'react';
import { useGetSignedPatientProfilePhotoUrlQuery } from '../../../features/css-module/queries/css.queries';
import { useGetPatient } from '../../../hooks/useGetPatient';
import ProfilePhotoImagePicker from '../../ProfilePhotoImagePicker';

type Props = {
  id?: string;
  sx?: SxProps<Theme>;
};

export const PatientAvatar: FC<Props> = ({ id, sx }) => {
  const [isProfileImagePickerOpen, setProfileImagePickerOpen] = useState<boolean>(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | undefined>(undefined);

  const { patient, setPatient } = useGetPatient(id);

  const patientPhoto = useMemo(() => {
    return patient?.photo?.[0]?.url || '';
  }, [patient?.photo]);

  useGetSignedPatientProfilePhotoUrlQuery(patientPhoto, (profilePhotoResponse) => {
    const { presignedImageUrl } = profilePhotoResponse;
    setProfilePhotoUrl(presignedImageUrl);
  });

  return (
    <>
      <Avatar
        src={patientPhoto ? profilePhotoUrl : undefined}
        alt="Patient"
        sx={{ width: 150, height: 150, cursor: patient ? 'pointer' : 'inherit', ...sx }}
        onClick={() => patient && setProfileImagePickerOpen(true)}
      />
      {isProfileImagePickerOpen && (
        <ProfilePhotoImagePicker
          open={isProfileImagePickerOpen}
          setOpen={setProfileImagePickerOpen}
          patient={patient}
          onUpdate={setPatient}
        />
      )}
    </>
  );
};
