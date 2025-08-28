import { Box, Link, Tooltip, Typography } from '@mui/material';
import { GridColDef } from '@mui/x-data-grid-pro';
import { DateTime } from 'luxon';
import { useMemo } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { ClaimsQueueItem, ClaimsQueueItemStatus, ClaimsQueueType } from 'utils';
import { getSelectors } from '../../shared/store/getSelectors';
import { getPatientName } from '../../telemed/utils';
import { ClaimStatusChip, EligibilityStatusChip } from '../features';
import { useClaimsQueueStore } from '../state';
import { getDateFromFormat } from './resources.helper';

export const ClaimsQueueColumns: Record<string, GridColDef<ClaimsQueueItem, any, any>> = {
  queue: {
    sortable: false,
    field: 'id',
    headerName: 'Queue',
    width: 60,
    renderCell: (params) => (params.row.appointment.appointmentType?.text === 'virtual' ? 'TM' : 'IP'),
  },
  cid: {
    sortable: false,
    field: 'cid',
    headerName: 'Claim ID',
    width: 100,
    renderCell: (params) => (
      <Box>
        <Tooltip title={params.row.claim.id}>
          <Link component={RouterLink} to={`/rcm/claims/${params.row.claim.id}`} target="_blank">
            {params.row.claim.id}
          </Link>
        </Tooltip>
        <Typography fontSize={12} color="text.secondary">
          {calculateTimeSince(params.row.claim.created)}
        </Typography>
      </Box>
    ),
  },
  vid: {
    sortable: false,
    field: 'vid',
    headerName: 'Visit ID',
    width: 120,
    renderCell: (params) => {
      // const {} = params.row;
      //
      // const statuses = useMemo(
      //   () =>
      //     encounter.statusHistory && appointment?.status
      //       ? mapEncounterStatusHistory(encounter.statusHistory, appointment.status)
      //       : undefined,
      //   [encounter.statusHistory, appointment?.status]
      // );
      // const dateOfService = formatDateTimeToEDT(statuses?.find((item) => item.status === 'on-video')?.start);

      return (
        <Box>
          <Tooltip title={params.row.appointment.id}>
            <Link
              component={RouterLink}
              to={`${
                params.row.appointment.appointmentType?.text === 'virtual' ? '/telemed/appointments/' : '/visit/'
              }${params.row.appointment.id}`}
              target="_blank"
            >
              {params.row.appointment.id}
            </Link>
          </Tooltip>
          <Typography fontSize={12} color="text.secondary">
            DOS: {DateTime.fromISO(params.row.claim?.item?.[0]?.servicedPeriod?.end || '').toFormat('MM/dd/yyyy')}
          </Typography>
        </Box>
      );
    },
  },
  patient: {
    sortable: false,
    field: 'patient',
    headerName: 'Patient',
    renderCell: (params) => (
      <Box>
        <Tooltip title={params.row.patient.id}>
          <Link component={RouterLink} to={`/patient/${params.row.patient.id}`} target="_blank">
            {getPatientName(params.row.patient.name).firstLastName}
          </Link>
        </Tooltip>
        <Typography fontSize={12} color="text.secondary">
          DOB: {getDateFromFormat(params.row.patient.birthDate)?.toFormat('MM/dd/yyyy')}
        </Typography>
      </Box>
    ),
  },
  member: {
    sortable: false,
    field: 'member',
    headerName: 'Team member',
    width: 120,
    renderCell: (params) => {
      const assigned = params.row.claim.enterer?.reference;
      const { employees } = getSelectors(useClaimsQueueStore, ['employees']);

      // eslint-disable-next-line react-hooks/rules-of-hooks
      const employee = useMemo(
        () => employees.find((employee) => employee.profile === assigned),
        [assigned, employees]
      );

      if (!assigned || !employee) {
        return (
          <Typography variant="body2" color="text.secondary">
            Not assigned
          </Typography>
        );
      } else {
        return (
          <Typography variant="body2">
            {employee.firstName && employee.lastName
              ? [employee.lastName, employee.firstName].join(', ')
              : employee.name
              ? employee.name
              : '-'}
          </Typography>
        );
      }
    },
  },
  state: {
    sortable: false,
    field: 'state',
    headerName: 'Visit state',
    width: 90,
    renderCell: (params) => params.row.location.address?.state,
  },
  insurance: {
    sortable: false,
    field: 'insurance',
    headerName: 'Insurance',
    renderCell: (params) => <Typography variant="body2">{params.row.insurancePlan?.name}</Typography>,
  },
  tos: {
    sortable: false,
    field: 'tos',
    headerName: 'TOS $',
    width: 110,
    renderCell: () => <Typography variant="body2"></Typography>,
  },
  eligibility: {
    sortable: false,
    field: 'eligibility',
    headerName: 'Initial Eligibility',
    width: 130,
    renderCell: (params) => (
      <EligibilityStatusChip
        appointment={params.row.appointment}
        eligibilityResponse={params.row.eligibilityResponse}
      />
    ),
  },
  payment: { sortable: false, field: 'payment', headerName: 'TOS Payment', width: 130 },
  status: {
    sortable: false,
    field: 'status',
    // cSpell:disable-next Registr.(ation)
    headerName: 'Registr. Status',
    width: 130,
    renderCell: (params) => <ClaimStatusChip status={params.row.status} />,
  },
};

export const mapClaimTypeToColumnNames: { [field in ClaimsQueueType]: string[] } = {
  registration: [
    'queue',
    'cid',
    'vid',
    'patient',
    'member',
    'state',
    'insurance',
    'tos',
    'eligibility',
    'payment',
    'status',
  ],
  coding: [],
  billing: [],
  'credentialing-hold': [],
  credits: [],
};

export const claimStatusOptions: { [value in ClaimsQueueItemStatus]: string } = {
  open: 'Open',
  locked: 'Locked',
  'returned-billing': 'Returned (billing)',
  'returned-coding': 'Returned (coding)',
  sent: 'Sent',
  'partly-paid': 'Partly paid',
  denied: 'Denied',
  'returned-credentialing-hold': 'Returned (cred.hold)',
  'credential-hold': 'Credential Hold',
};

const calculateTimeSince = (targetDate: string): string => {
  const now = DateTime.now();
  const target = DateTime.fromISO(targetDate);

  const diff = now.diff(target, ['years', 'months', 'days', 'hours', 'minutes', 'seconds']).toObject();

  let differenceString = '';

  if (diff.years) {
    differenceString = `${diff.years} years ago`;
  } else if (diff.months) {
    differenceString = `${diff.months} months ago`;
  } else if (diff.days) {
    differenceString = `${diff.days} days ago`;
  } else if (diff.hours) {
    differenceString = `${diff.hours} hours ago`;
  } else if (diff.minutes) {
    differenceString = `${diff.minutes} minutes ago`;
  } else {
    differenceString = 'just now';
  }

  return differenceString;
};
