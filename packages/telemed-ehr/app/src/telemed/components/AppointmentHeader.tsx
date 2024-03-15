import React, { FC } from 'react';
import { AppBar, Box, Container, Skeleton, Typography, useTheme } from '@mui/material';
import CustomBreadcrumbs from '../../components/CustomBreadcrumbs';
import { getAppointmentStatusChip, mapStatusToTelemed } from '../utils';
import { DateTime } from 'luxon';
import { IconButtonWithLabel } from './IconButtonWithLabel';
import AssignmentIndOutlinedIcon from '@mui/icons-material/AssignmentIndOutlined';
import ChatOutlineIcon from '@mui/icons-material/ChatOutlined';
import MedicationOutlinedIcon from '@mui/icons-material/MedicationOutlined';
import DateRangeOutlinedIcon from '@mui/icons-material/DateRangeOutlined';
import { getSelectors } from '../../shared/store/getSelectors';
import { useAppointmentStore } from '../state';

enum Gender {
  'male' = 'Male',
  'female' = 'Female',
  'other' = 'Other',
  'unknown' = 'Unknown',
}

export const AppointmentHeader: FC = () => {
  const theme = useTheme();

  const { appointment, encounter, patient, location } = getSelectors(useAppointmentStore, [
    'appointment',
    'patient',
    'encounter',
    'location',
  ]);

  return (
    <AppBar
      position="sticky"
      color="transparent"
      sx={{
        backgroundColor: theme.palette.background.paper,
      }}
    >
      <Container maxWidth="xl" sx={{ my: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                {patient.name?.[0]?.family}, {patient.name?.[0]?.given?.[0]}
              </Typography>
              {getAppointmentStatusChip(mapStatusToTelemed(encounter.status, appointment?.status))}
            </Box>
          )}
          {!patient || !location || !appointment ? (
            <Skeleton aria-busy="true" width={300} />
          ) : (
            <Typography variant="body2" color="secondary.light">
              New patient | {Gender[patient.gender!]} | Age:{' '}
              {Math.floor(DateTime.now().diff(DateTime.fromFormat(patient.birthDate!, 'yyyy-MM-dd'), 'years').years)} |
              DOB: {DateTime.fromFormat(patient.birthDate!, 'yyyy-MM-dd').toFormat('dd.MM.yyyy')} | Wt: 41 kg (updated
              11/19/2023) | Location: {location.address?.state} | {appointment.description}
            </Typography>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <IconButtonWithLabel SvgIcon={AssignmentIndOutlinedIcon} label="Patient Record" />
          <IconButtonWithLabel SvgIcon={ChatOutlineIcon} label="Chat" />
          <IconButtonWithLabel SvgIcon={MedicationOutlinedIcon} label="Pharmacy" />
          <IconButtonWithLabel SvgIcon={DateRangeOutlinedIcon} label="Book visit" />
        </Box>
      </Container>
    </AppBar>
  );
};
