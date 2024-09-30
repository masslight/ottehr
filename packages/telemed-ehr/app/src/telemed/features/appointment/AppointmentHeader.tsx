import { AppBar, Box, Container, IconButton, Skeleton, Typography, useTheme } from '@mui/material';
import { DateTime } from 'luxon';
import { FC, useState } from 'react';
import { ERX_PATIENT_IDENTIFIER_SYSTEM, mapStatusToTelemed, getQuestionnaireResponseByLinkId } from 'ehr-utils';
import CustomBreadcrumbs from '../../../components/CustomBreadcrumbs';
import { getSelectors } from '../../../shared/store/getSelectors';
import CancelVisitDialog from '../../components/CancelVisitDialog';
import { useAppointmentStore } from '../../state';
import { getAppointmentStatusChip, getPatientName } from '../../utils';
import CloseIcon from '@mui/icons-material/Close';
import { useNavigate } from 'react-router-dom';
import { AppointmentTabsHeader } from './AppointmentTabsHeader';

export const AppointmentHeader: FC = () => {
  const theme = useTheme();

  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isERXOpen, setIsERXOpen] = useState(false);

  const { appointment, encounter, patient, location, isReadOnly, questionnaireResponse } = getSelectors(
    useAppointmentStore,
    ['appointment', 'patient', 'encounter', 'location', 'isReadOnly', 'questionnaireResponse'],
  );

  const patientPhotonId = patient?.identifier?.find((id) => id.system === ERX_PATIENT_IDENTIFIER_SYSTEM)?.value;
  const reasonForVisit = getQuestionnaireResponseByLinkId('reason-for-visit', questionnaireResponse)?.answer?.[0]
    .valueString;
  const navigate = useNavigate();

  return (
    <AppBar
      position="sticky"
      color="transparent"
      sx={{
        backgroundColor: theme.palette.background.paper,
        zIndex: (theme) => theme.zIndex.drawer + 1,
      }}
    >
      <Box sx={{ display: 'flex', mt: 1, mx: 3, justifyContent: 'space-between', alignItems: 'start' }}>
        <AppointmentTabsHeader />

        <IconButton onClick={() => navigate('/telemed/appointments')}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
    </AppBar>
  );
};
