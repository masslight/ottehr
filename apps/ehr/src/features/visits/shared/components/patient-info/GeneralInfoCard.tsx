import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { Box, IconButton, Paper } from '@mui/material';
import React, { useState } from 'react';
import { EditPatientDialog } from 'src/components/dialogs';
import { RoundedButton } from 'src/components/RoundedButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useGetAppointmentAccessibility } from '../../hooks/useGetAppointmentAccessibility';
import { useAppointmentData } from '../../stores/appointment/appointment.store';
import Contacts from '../patient/info/Contacts';
import { FullNameDisplay } from '../patient/info/FullNameDisplay';
import { IdentifiersRow } from '../patient/info/IdentifiersRow';
import Summary from '../patient/info/Summary';
import { ProfileAvatar } from '../ProfileAvatar';

const GeneralInfoCard: React.FC = (): JSX.Element => {
  const { visitState: appointmentData, isLoading } = useAppointmentData();
  const { patient: patientData } = appointmentData;
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  const [isEditDialogOpen, setIsEditDialogOpen] = useState<boolean>(false);

  return (
    <Paper elevation={3} sx={{ p: 2, boxShadow: '0px 2px 4px -1px rgba(0,0,0,0.1)' }}>
      <Box sx={{ display: 'flex', gap: 3 }}>
        <ProfileAvatar embracingSquareSize={150} showEditButton={true} />

        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <IdentifiersRow id={patientData?.id} />
          <FullNameDisplay patient={patientData} loading={isLoading} />
          <Summary patient={patientData} loading={isLoading} />
          <Contacts patient={patientData} loading={isLoading} />

          <Box sx={{ display: 'flex', gap: 1 }}>
            <RoundedButton
              to={`/patient/${patientData?.id}/info`}
              data-testid={dataTestIds.patientRecordPage.seeAllPatientInfoButton}
            >
              View Patient Profile
            </RoundedButton>
          </Box>
        </Box>

        {!isReadOnly && (
          <IconButton
            size="medium"
            sx={{ alignSelf: 'start' }}
            aria-label="edit"
            onClick={() => {
              setIsEditDialogOpen(true);
            }}
          >
            <EditOutlinedIcon fontSize="medium" color="primary" />
          </IconButton>
        )}
      </Box>
      {!isReadOnly && isEditDialogOpen && (
        <EditPatientDialog modalOpen={isEditDialogOpen} onClose={() => setIsEditDialogOpen(false)} />
      )}
    </Paper>
  );
};

export default GeneralInfoCard;
