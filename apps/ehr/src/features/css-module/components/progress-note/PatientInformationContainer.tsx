import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { capitalize, IconButton, Stack, Typography } from '@mui/material';
import React, { FC, useState } from 'react';
import { calculatePatientAge, getPatientAddress, getSelectors, standardizePhoneNumber } from 'utils';
import { EditPatientDialog } from '../../../../components/dialogs';
import { formatDateUsingSlashes } from '../../../../helpers/formatDateTime';
import { ActionsList, useAppointmentStore } from '../../../../telemed';
import { VisitNoteItem } from '../../../../telemed/features/appointment/ReviewTab';
import { getPatientName } from '../../../../telemed/utils';

export const PatientInformationContainer: FC = () => {
  const { patient } = getSelectors(useAppointmentStore, ['patient']);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const name = getPatientName(patient?.name).firstMiddleLastName;
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

        <IconButton size="small" onClick={() => setIsEditDialogOpen(true)} sx={{ color: 'primary.main' }}>
          <EditOutlinedIcon />
        </IconButton>
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
