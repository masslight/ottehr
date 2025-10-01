import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { capitalize, IconButton, Stack, Typography } from '@mui/material';
import { FC, useState } from 'react';
import { ActionsList } from 'src/components/ActionsList';
import { VisitNoteItem } from 'src/components/VisitNoteItem';
import { useAppointmentData } from 'src/shared/hooks/appointment/appointment.store';
import { useGetAppointmentAccessibility } from 'src/shared/hooks/appointment/useGetAppointmentAccessibility';
import { getPatientName } from 'src/shared/utils';
import { calculatePatientAge, getPatientAddress, standardizePhoneNumber } from 'utils';
import { EditPatientDialog } from '../../../../components/dialogs';
import { formatDateUsingSlashes } from '../../../../helpers/formatDateTime';

export const PatientInformationContainer: FC = () => {
  const { patient } = useAppointmentData();
  const { isAppointmentReadOnly } = useGetAppointmentAccessibility();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const name = getPatientName(patient?.name).fullDisplayName;
  const dob =
    patient?.birthDate && `${formatDateUsingSlashes(patient.birthDate)} (${calculatePatientAge(patient.birthDate)})`;

  const sex = patient?.gender && capitalize(patient.gender);
  const phone = standardizePhoneNumber(patient?.telecom?.find((obj) => obj.system === 'phone')?.value);
  const address = getPatientAddress(patient?.address).zipStateCityLine;

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography fontSize={18} color="primary.dark" fontWeight={600}>
          Patient information
        </Typography>

        {!isAppointmentReadOnly && (
          <IconButton size="small" onClick={() => setIsEditDialogOpen(true)} sx={{ color: 'primary.main' }}>
            <EditOutlinedIcon />
          </IconButton>
        )}
      </Stack>

      <ActionsList
        data={[
          { label: 'Name', value: name },
          { label: 'Date of birth (Age)', value: dob },
          { label: 'Birth sex', value: sex },
          { label: 'Phone', value: phone },
          { label: 'Address', value: address },
        ]}
        getKey={(item) => item.label}
        renderItem={(item) => (
          <Stack width="100%">
            <VisitNoteItem label={item.label} value={item.value} noMaxWidth />
          </Stack>
        )}
        gap={0.75}
        divider
      />

      {isEditDialogOpen && (
        <EditPatientDialog modalOpen={isEditDialogOpen} onClose={() => setIsEditDialogOpen(false)} />
      )}
    </Stack>
  );
};
