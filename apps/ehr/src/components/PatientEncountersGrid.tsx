import AddIcon from '@mui/icons-material/Add';
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
import { DataGridPro, GridColDef } from '@mui/x-data-grid-pro';
import { useQuery } from '@tanstack/react-query';
import { Encounter } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { FC, useMemo, useState } from 'react';
import { VisitTypeToLabel, VisitTypeToLabelTelemed } from 'src/types/types';
import {
  EmployeeDetails,
  formatMinutes,
  getVisitStatus,
  mapStatusToTelemed,
  OTTEHR_MODULE,
  ServiceMode,
  TelemedCallStatusesArr,
  useSuccessQuery,
  Visit_Status_Array,
} from 'utils';
import { create } from 'zustand';
import { getEmployees } from '../api/api';
import { formatISOStringToDateAndTime } from '../helpers/formatDateTime';
import { useApiClients } from '../hooks/useAppClients';
import { AppointmentHistoryRow } from '../hooks/useGetPatient';
import { getAppointmentStatusChip as getTelemedAppointmentStatusChip } from '../telemed/utils';
import { RoundedButton } from './RoundedButton';

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
    renderCell: ({ row: { dateTime, officeTimeZone } }) =>
      dateTime ? formatISOStringToDateAndTime(dateTime, officeTimeZone) : '-',
  },
  {
    sortable: false,
    field: 'status',
    headerName: 'Status',
    width: 140,
    renderCell: ({ row: { appointment, serviceMode: serviceType, encounter } }) => {
      if (serviceType === ServiceMode.virtual) {
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
    renderCell: ({ row: { typeLabel: type } }) => type || '-',
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
    renderCell: ({ row: { id, appointment } }) => {
      // if it's a pre-booked telemed visit the text is just 'prebook' so use the TM tag instead to support both
      const isTelemed = !!appointment.meta?.tag?.find((tag) => tag.code === OTTEHR_MODULE.TM);

      return !isTelemed && <RoundedButton to={`/visit/${id}`}>Visit Info</RoundedButton>;
    },
  },
  {
    sortable: false,
    field: 'note',
    headerName: 'Progress Note',
    width: 150,
    renderCell: ({ row: { id, serviceMode: serviceType } }) => (
      <RoundedButton
        to={
          serviceType === ServiceMode.virtual
            ? `/telemed/appointments/${id}?tab=sign`
            : `/in-person/${id}/progress-note`
        }
      >
        Progress Note
      </RoundedButton>
    ),
  },
];

const emptyEmployeeList: EmployeeDetails[] = [];

export const PatientEncountersGrid: FC<PatientEncountersGridProps> = (props) => {
  const { appointments, loading } = props;

  const [type, setType] = useState('all');
  const [period, setPeriod] = useState(0);
  const [status, setStatus] = useState('all');
  const [hideCancelled, setHideCancelled] = useState(false);
  const [hideNoShow, setHideNoShow] = useState(false);

  const { oystehrZambda } = useApiClients();

  const { data: employeesData } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      if (!oystehrZambda) {
        return null;
      }
      const data = await getEmployees(oystehrZambda);
      if (!data.employees) {
        return null;
      }
      return data;
    },
    enabled: !!oystehrZambda,
  });

  useSuccessQuery(employeesData, (data) => {
    const employees = data?.employees || emptyEmployeeList;
    useEmployeesStore.setState({ employees });
  });

  const filtered = useMemo(() => {
    let filtered = appointments || [];

    if (type !== 'all') {
      filtered = filtered.filter((item) => item.typeLabel === type);
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
      filtered = filtered.filter(
        (item) => item.serviceMode === ServiceMode.virtual || !filterAppointmentForStatus(item, 'no show')
      );
    }

    return filtered;
  }, [appointments, period, type, status, hideCancelled, hideNoShow]);

  function filterAppointmentForStatus(appointmentHistory: AppointmentHistoryRow, filterStatus: string): boolean {
    if (!appointmentHistory.encounter) return false;
    const appointmentStatus =
      appointmentHistory.serviceMode === ServiceMode.virtual
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
          <Typography>
            Latest visit: {formatISOStringToDateAndTime(appointments[0].dateTime, appointments[0].officeTimeZone)}
          </Typography>
        )}
        <RoundedButton to="/visits/add" target="_blank" variant="contained" startIcon={<AddIcon fontSize="small" />}>
          New Visit
        </RoundedButton>
      </Box>

      <Box sx={{ display: 'flex', gap: 2 }}>
        <TextField size="small" fullWidth label="Type" select value={type} onChange={(e) => setType(e.target.value)}>
          <MenuItem value="all">All</MenuItem>
          <MenuItem value={VisitTypeToLabel['walk-in']}>{VisitTypeToLabel['walk-in']}</MenuItem>
          <MenuItem value={VisitTypeToLabel['post-telemed']}>{VisitTypeToLabel['post-telemed']}</MenuItem>
          <MenuItem value={VisitTypeToLabel['pre-booked']}>{VisitTypeToLabel['pre-booked']}</MenuItem>
          <MenuItem value={VisitTypeToLabelTelemed['pre-booked']}>{VisitTypeToLabelTelemed['pre-booked']}</MenuItem>
          <MenuItem value={VisitTypeToLabelTelemed['walk-in']}>{VisitTypeToLabelTelemed['walk-in']}</MenuItem>
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
            fontWeight: 500,
          },
        }}
      />
    </Paper>
  );
};
