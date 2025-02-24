import { FC, useMemo, useState } from 'react';
import { AppointmentHistoryRow } from '../hooks/useGetPatient';
import { DataGridPro, GridColDef } from '@mui/x-data-grid-pro';
import { formatISOStringToDateAndTime } from '../helpers/formatDateTime';
import { RoundedButton } from './RoundedButton';
import {
  Box,
  capitalize,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { DateTime } from 'luxon';
import {
  Visit_Status_Array,
  EmployeeDetails,
  mapStatusToTelemed,
  TelemedCallStatusesArr,
  getVisitStatus,
  formatMinutes,
} from 'utils';
import { getAppointmentStatusChip as getTelemedAppointmentStatusChip } from '../telemed/utils';
import { create } from 'zustand';
import { useQuery } from 'react-query';
import { getEmployees } from '../api/api';
import { useApiClients } from '../hooks/useAppClients';
import { Encounter } from 'fhir/r4b';

type PatientEncountersGridProps = {
  appointments?: AppointmentHistoryRow[];
  loading: boolean;
};

const useEmployeesStore = create<{ employees: EmployeeDetails[] }>()(() => ({ employees: [] }));

const ProviderCell: FC<{ encounter?: Encounter }> = ({ encounter }) => {
  const { employees } = useEmployeesStore();

  const practitioner = encounter?.participant
    ?.find((participant) => participant.individual?.reference?.startsWith('Practitioner'))
    ?.individual?.reference?.split('/')?.[1];

  const employee = practitioner ? employees.find((employee) => employee.profile.endsWith(practitioner)) : undefined;

  return <Typography variant="body2">{employee ? `${employee.firstName} ${employee.lastName}` : '-'}</Typography>;
};

const columns: GridColDef<AppointmentHistoryRow>[] = [
  {
    sortComparator: (a, b) => {
      const createdA = DateTime.fromISO(a ?? '');
      const createdB = DateTime.fromISO(b ?? '');
      return createdA.diff(createdB).milliseconds;
    },
    field: 'dateTime',
    headerName: 'Date & Time',
    width: 150,
    renderCell: ({ row: { dateTime } }) => (dateTime ? formatISOStringToDateAndTime(dateTime) : '-'),
  },
  {
    sortable: false,
    field: 'status',
    headerName: 'Status',
    width: 140,
    renderCell: ({ row: { appointment, type, encounter } }) => {
      if (type === 'Telemed') {
        if (!encounter) {
          return;
        }
        const status = mapStatusToTelemed(encounter.status, appointment.status);
        return getTelemedAppointmentStatusChip(status);
      } else {
        if (!encounter) return;
        const encounterStatus = getVisitStatus(appointment, encounter);
        if (!encounterStatus) {
          return;
        }

        return encounterStatus;
      }
    },
  },
  {
    sortable: false,
    field: 'type',
    headerName: 'Type',
    width: 150,
    renderCell: ({ row: { type } }) => type || '-',
  },
  {
    sortable: false,
    field: 'reason',
    headerName: 'Reason for visit',
    width: 150,
    renderCell: ({ row: { appointment } }) => (
      <Typography variant="body2">
        {(appointment?.description ?? '')
          .split(',')
          .map((complaint) => complaint.trim())
          .join(', ') || '-'}
      </Typography>
    ),
  },
  {
    sortable: false,
    field: 'provider',
    headerName: 'Provider',
    width: 150,
    renderCell: ({ row: { encounter } }) => <ProviderCell encounter={encounter} />,
  },
  {
    sortable: false,
    field: 'office',
    headerName: 'Office',
    width: 150,
    renderCell: ({ row: { office } }) => office || '-',
  },
  {
    sortable: false,
    field: 'los',
    headerName: 'LOS',
    width: 100,
    renderCell: ({ row: { length } }) =>
      length !== undefined ? `${formatMinutes(length)} ${length === 1 ? 'min' : 'mins'}` : '-',
  },
  {
    sortable: false,
    field: 'info',
    headerName: 'Visit Info',
    headerAlign: 'center',
    width: 120,
    renderCell: ({ row: { encounter, id, appointment } }) =>
      appointment?.appointmentType?.text !== 'virtual' && (
        <RoundedButton
          target="_blank"
          to={`/patient/${encounter?.subject?.reference?.split('/')[1]}/details?appointment=${id}`}
        >
          Visit Info
        </RoundedButton>
      ),
  },
  {
    sortable: false,
    field: 'note',
    headerName: 'Progress Note',
    width: 150,
    renderCell: ({ row: { id, type } }) => (
      <RoundedButton
        target="_blank"
        to={type === 'Telemed' ? `/telemed/appointments/${id}?tab=sign` : `/in-person/${id}/progress-note`}
      >
        Progress Note
      </RoundedButton>
    ),
  },
];

export const PatientEncountersGrid: FC<PatientEncountersGridProps> = (props) => {
  const { appointments, loading } = props;

  const [type, setType] = useState('all');
  const [period, setPeriod] = useState(0);
  const [status, setStatus] = useState('all');
  const [hideCancelled, setHideCancelled] = useState(false);
  const [hideNoShow, setHideNoShow] = useState(false);

  const { oystehrZambda } = useApiClients();
  useQuery(
    ['patient-record-get-employees', { zambdaClient: oystehrZambda }],
    () => (oystehrZambda ? getEmployees(oystehrZambda) : null),
    {
      onSuccess: (response) => {
        useEmployeesStore.setState({ employees: response?.employees || [] });
      },
      enabled: !!oystehrZambda,
    }
  );

  const filtered = useMemo(() => {
    let filtered = appointments || [];

    if (type !== 'all') {
      filtered = filtered.filter((item) => item.type === type);
    }

    if (period) {
      filtered = filtered.filter((item) => {
        return -DateTime.fromISO(item.dateTime ?? '').diffNow('months').months < period;
      });
    }

    if (status !== 'all') {
      filtered = filtered.filter((item) => filterAppointmentForStatus(item, status));
    }

    if (hideCancelled) {
      filtered = filtered.filter((item) => !filterAppointmentForStatus(item, 'cancelled'));
    }

    if (hideNoShow) {
      filtered = filtered.filter((item) => item.type === 'Telemed' || !filterAppointmentForStatus(item, 'no show'));
    }

    return filtered;
  }, [appointments, period, type, status, hideCancelled, hideNoShow]);

  function filterAppointmentForStatus(appointmentHistory: AppointmentHistoryRow, filterStatus: string): boolean {
    if (!appointmentHistory.encounter) return false;
    const appointmentStatus =
      appointmentHistory.type === 'Telemed'
        ? mapStatusToTelemed(appointmentHistory.encounter.status, appointmentHistory.appointment.status)
        : getVisitStatus(appointmentHistory.appointment, appointmentHistory.encounter);
    return filterStatus === appointmentStatus;
  }

  return (
    <Paper sx={{ padding: 3 }} component={Stack} spacing={2}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography variant="h4" color="primary.dark" sx={{ flexGrow: 1 }}>
          Encounters - {appointments?.length || 0}
        </Typography>
        {appointments?.[0]?.dateTime && (
          <Typography>Latest visit: {formatISOStringToDateAndTime(appointments[0].dateTime)}</Typography>
        )}
        <RoundedButton to="/visits/add" target="_blank" variant="contained" startIcon={<AddIcon fontSize="small" />}>
          New Visit
        </RoundedButton>
      </Box>

      <Box sx={{ display: 'flex', gap: 2 }}>
        <TextField size="small" fullWidth label="Type" select value={type} onChange={(e) => setType(e.target.value)}>
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="Walk-in In-Person Visit">Walk-in In-Person Visit</MenuItem>
          <MenuItem value="Post Telemed Lab Only">Post Telemed Lab Only</MenuItem>
          <MenuItem value="Pre-booked In-Person Visit">Pre-booked In-Person Visit</MenuItem>
          <MenuItem value="Telemed">Telemed</MenuItem>
        </TextField>

        <TextField
          size="small"
          fullWidth
          label="Visit Period"
          select
          value={period}
          onChange={(e) => setPeriod(+e.target.value)}
        >
          <MenuItem value={0}>All</MenuItem>
          <MenuItem value={1}>Last month</MenuItem>
          <MenuItem value={3}>Last 3 months</MenuItem>
          <MenuItem value={6}>Last 6 months</MenuItem>
          <MenuItem value={12}>Last year</MenuItem>
        </TextField>

        <TextField
          size="small"
          fullWidth
          label="Visit Status"
          select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <MenuItem value="all">All</MenuItem>
          {[...new Set([...TelemedCallStatusesArr, ...Visit_Status_Array.filter((item) => item !== 'cancelled')])].map(
            (status) => (
              <MenuItem key={status} value={status}>
                {capitalize(status)}
              </MenuItem>
            )
          )}
        </TextField>

        <FormControlLabel
          sx={{
            whiteSpace: 'nowrap',
          }}
          control={<Checkbox value={hideCancelled} onChange={(e) => setHideCancelled(e.target.checked)} />}
          label="Hide “Cancelled”"
        />

        <FormControlLabel
          sx={{
            whiteSpace: 'nowrap',
          }}
          control={<Checkbox value={hideNoShow} onChange={(e) => setHideNoShow(e.target.checked)} />}
          label="Hide “No Show”"
        />
      </Box>

      <DataGridPro
        rows={filtered}
        columns={columns}
        initialState={{
          pagination: {
            paginationModel: {
              pageSize: 5,
            },
          },
          sorting: {
            sortModel: [{ field: 'dateTime', sort: 'desc' }],
          },
        }}
        autoHeight
        loading={loading}
        pagination
        disableColumnMenu
        pageSizeOptions={[5]}
        disableRowSelectionOnClick
        sx={{
          border: 0,
          '.MuiDataGrid-columnHeaderTitle': {
            fontWeight: 700,
          },
        }}
      />
    </Paper>
  );
};
