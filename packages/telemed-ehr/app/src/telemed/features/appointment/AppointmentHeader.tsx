import AssignmentIndOutlinedIcon from '@mui/icons-material/AssignmentIndOutlined';
import ChatOutlineIcon from '@mui/icons-material/ChatOutlined';
import DateRangeOutlinedIcon from '@mui/icons-material/DateRangeOutlined';
import DisabledByDefaultOutlinedIcon from '@mui/icons-material/DisabledByDefaultOutlined';
import MedicationOutlinedIcon from '@mui/icons-material/MedicationOutlined';
import { AppBar, Box, Container, IconButton, Skeleton, Typography, useTheme } from '@mui/material';
import { DateTime } from 'luxon';
import { FC, useState } from 'react';
import { PHOTON_PATIENT_IDENTIFIER_SYSTEM, mapStatusToTelemed, getQuestionnaireResponseByLinkId } from 'ehr-utils';
import CustomBreadcrumbs from '../../../components/CustomBreadcrumbs';
import { getSelectors } from '../../../shared/store/getSelectors';
import { IconButtonWithLabel } from '../../components';
import CancelVisitDialog from '../../components/CancelVisitDialog';
import { useAppointmentStore } from '../../state';
import { getAppointmentStatusChip, getPatientName } from '../../utils';
import { AppointmentTabsHeader } from './AppointmentTabsHeader';
import { ERXDialog } from './ERXDialog';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import EditPatientDialog from '../../components/EditPatientDialog';

enum Gender {
  'male' = 'Male',
  'female' = 'Female',
  'other' = 'Other',
  'unknown' = 'Unknown',
}

export const AppointmentHeader: FC = () => {
  const theme = useTheme();

  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isERXOpen, setIsERXOpen] = useState(false);

  const { appointment, encounter, patient, location, isReadOnly, questionnaireResponse } = getSelectors(
    useAppointmentStore,
    ['appointment', 'patient', 'encounter', 'location', 'isReadOnly', 'questionnaireResponse'],
  );

  const patientPhotonId = patient?.identifier?.find((id) => id.system === PHOTON_PATIENT_IDENTIFIER_SYSTEM)?.value;
  const reasonForVisit = getQuestionnaireResponseByLinkId('reason-for-visit', questionnaireResponse)?.answer?.[0]
    .valueString;

  return (
    <AppBar
      position="sticky"
      color="transparent"
      sx={{
        backgroundColor: theme.palette.background.paper,
      }}
    >
      <Container maxWidth="xl" sx={{ display: 'flex', flexDirection: 'column', mt: 2, gap: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <CustomBreadcrumbs
              chain={[
                { link: '/telemed/appointments', children: 'Tracking Board' },
                { link: '#', children: appointment?.id || <Skeleton width={150} /> },
              ]}
            />
            {!patient ? (
              <Skeleton aria-busy="true" width={200} />
            ) : (
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <Typography variant="h4" color="primary.dark">
                  {getPatientName(patient.name).lastFirstName}

                  {!isReadOnly && (
                    <IconButton onClick={() => setIsEditDialogOpen(true)}>
                      <EditOutlinedIcon sx={{ color: theme.palette.primary.main }} />
                    </IconButton>
                  )}
                </Typography>

                {getAppointmentStatusChip(mapStatusToTelemed(encounter.status, appointment?.status))}
              </Box>
            )}
            {!patient || !location || !appointment ? (
              <Skeleton aria-busy="true" width={300} />
            ) : (
              <Typography variant="body2" color="secondary.light">
                New patient | {Gender[patient.gender!]} | Age:{' '}
                {Math.floor(DateTime.now().diff(DateTime.fromFormat(patient.birthDate!, 'yyyy-MM-dd'), 'years').years)}{' '}
                | DOB: {DateTime.fromFormat(patient.birthDate!, 'yyyy-MM-dd').toFormat('MM.dd.yyyy')} | Wt: 41 kg
                (updated 11/19/2023) | Location: {location.address?.state} | {reasonForVisit}
              </Typography>
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <IconButtonWithLabel SvgIcon={AssignmentIndOutlinedIcon} label="Patient Record" />
            <IconButtonWithLabel SvgIcon={ChatOutlineIcon} label="Chat" />
            <IconButtonWithLabel SvgIcon={MedicationOutlinedIcon} label="Pharmacy" onClick={() => setIsERXOpen(true)} />
            <IconButtonWithLabel SvgIcon={DateRangeOutlinedIcon} label="Book visit" />
            <IconButtonWithLabel
              SvgIcon={DisabledByDefaultOutlinedIcon}
              label="Cancel"
              variant="error"
              onClick={() => setIsCancelDialogOpen(true)}
            />
          </Box>
        </Box>
        <AppointmentTabsHeader />
        {isCancelDialogOpen && <CancelVisitDialog onClose={() => setIsCancelDialogOpen(false)} />}
        {isERXOpen && <ERXDialog patientPhotonId={patientPhotonId} onClose={() => setIsERXOpen(false)} />}
        {isEditDialogOpen && (
          <EditPatientDialog modalOpen={isEditDialogOpen} onClose={() => setIsEditDialogOpen(false)} />
        )}
      </Container>
    </AppBar>
  );
};
