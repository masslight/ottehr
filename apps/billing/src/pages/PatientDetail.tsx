import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { TabContext, TabList, TabPanel } from '@mui/lab';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  Tab,
  Typography,
} from '@mui/material';
import { DataGridPro, GridColDef } from '@mui/x-data-grid-pro';
import { ReactElement, useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { chooseJson, PatientDetailResponse } from 'utils';
import { CLAIM_STATUS_COLORS, formatClaimStatus } from '../constants/claimStatus';
import { useApiClients } from '../hooks/useAppClients';
import { otherColors } from '../themes/ottehr/colors';
import { formatCurrency } from '../utils/format';

const claimColumns: GridColDef[] = [
  { field: 'serviceDate', headerName: 'Date of Service', width: 130 },
  {
    field: 'status',
    headerName: 'Status',
    width: 130,
    renderCell: ({ value }) => {
      const color = CLAIM_STATUS_COLORS[value as string] ?? 'default';
      return (
        <Chip
          label={formatClaimStatus(value as string)}
          color={color}
          variant="outlined"
          size="small"
          sx={{ borderRadius: '4px', fontSize: 12 }}
        />
      );
    },
  },
  { field: 'payerName', headerName: 'Payer Name', flex: 1, minWidth: 160 },
  {
    field: 'billed',
    headerName: 'Billed',
    width: 110,
    align: 'right',
    headerAlign: 'right',
    valueFormatter: (params: { value: number }) => formatCurrency(params.value),
  },
  {
    field: 'insurancePaid',
    headerName: 'Insurance Paid',
    width: 120,
    align: 'right',
    headerAlign: 'right',
    valueFormatter: (params: { value: number }) => formatCurrency(params.value),
  },
  {
    field: 'patientResp',
    headerName: 'Patient Resp',
    width: 120,
    align: 'right',
    headerAlign: 'right',
    valueFormatter: (params: { value: number }) => formatCurrency(params.value),
  },
  {
    field: 'patientPaid',
    headerName: 'Patient Paid',
    width: 110,
    align: 'right',
    headerAlign: 'right',
    valueFormatter: (params: { value: number }) => formatCurrency(params.value),
  },
];

export default function PatientDetail(): ReactElement {
  const { id } = useParams();
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();

  const [patient, setPatient] = useState<PatientDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState('1');

  const fetchDetail = useCallback(async () => {
    if (!oystehrZambda || !id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await oystehrZambda.zambda.execute({ id: 'get-billing-patient-detail', patientId: id });
      setPatient(chooseJson(response));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [oystehrZambda, id]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !patient) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error ?? 'Patient not found'}</Alert>
        <Button sx={{ mt: 2 }} onClick={() => navigate('/patients')}>
          Back to Patients
        </Button>
      </Box>
    );
  }

  const patientName = `${patient.firstName} ${patient.lastName}`.trim() || 'Unknown';

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
        <IconButton onClick={() => navigate('/patients')} size="small" sx={{ mt: 0.5 }}>
          <ArrowBackIcon />
        </IconButton>
        <Box>
          <Typography variant="h5" color="primary.dark" fontWeight={600}>
            {patientName}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            DOB {patient.dob} | {patient.id}
          </Typography>
        </Box>
      </Box>

      <Card variant="outlined" sx={{ mb: 2, ml: 5 }}>
        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Box sx={{ display: 'flex', gap: 4 }}>
            <BalanceItem label="Current Balance" value={patient.balance.currentBalance} />
            <BalanceItem label="Claims with Patient Balance" value={patient.balance.claimsWithPatientBalance} />
            <BalanceItem label="Pending Payments" value={patient.balance.pendingPayments} />
          </Box>
        </CardContent>
      </Card>

      <Box sx={{ ml: 5 }}>
        <TabContext value={tab}>
          <TabList
            onChange={(_, v) => setTab(v)}
            sx={{
              borderBottom: `1px solid ${otherColors.lightDivider}`,
              '& .MuiTab-root': { textTransform: 'none', fontWeight: 500, fontSize: 14 },
            }}
          >
            <Tab label="Demographics" value="1" />
            <Tab label="Claims" value="2" />
            <Tab label="Payments" value="3" />
          </TabList>

          <TabPanel value="1" sx={{ px: 0, pt: 2 }}>
            <Card variant="outlined">
              <CardContent>
                <Row label="Patient" value={patientName} />
                <Row label="MRN" value={patient.mrn} />
                <Row label="Friendly ID" value={patient.friendlyId} />
                <Row label="DOB" value={patient.dob} />
                <Row label="Gender" value={patient.gender} />
                <Row label="Phone" value={patient.phone} />
                <Row label="Email" value={patient.email} />
                <Row label="Address" value={patient.address} />
              </CardContent>
            </Card>
          </TabPanel>

          <TabPanel value="2" sx={{ px: 0, pt: 2 }}>
            <DataGridPro
              rows={patient.claims}
              columns={claimColumns}
              onRowClick={(params) => navigate(`/claims/${params.id}`)}
              disableRowSelectionOnClick
              disableColumnMenu
              autoHeight
              pageSizeOptions={[25, 50]}
              initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
              sx={{
                bgcolor: 'background.paper',
                border: 'none',
                borderRadius: 1,
                fontSize: 14,
                '& .MuiDataGrid-columnHeaders': {
                  backgroundColor: '#FAFAFA',
                  borderBottom: `1px solid ${otherColors.lightDivider}`,
                },
                '& .MuiDataGrid-columnHeaderTitle': { fontWeight: 600, fontSize: 13, color: 'primary.dark' },
                '& .MuiDataGrid-cell': {
                  borderBottom: `1px solid ${otherColors.lightDivider}`,
                  fontSize: 14,
                  color: otherColors.tableRow,
                },
                '& .MuiDataGrid-row': { cursor: 'pointer' },
                '& .MuiDataGrid-row:hover': { bgcolor: otherColors.apptHover },
              }}
            />
          </TabPanel>

          <TabPanel value="3" sx={{ px: 0, pt: 2 }}>
            <Typography color="text.secondary">No payments found</Typography>
          </TabPanel>
        </TabContext>
      </Box>
    </Box>
  );
}

function BalanceItem({ label, value }: { label: string; value: number }): ReactElement {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body1" fontWeight={600}>
        {formatCurrency(value)}
      </Typography>
    </Box>
  );
}

function Row({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <Box sx={{ display: 'flex', py: 0.75 }}>
      <Typography variant="body2" color="text.secondary" sx={{ width: 120, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="body2">{value || '—'}</Typography>
    </Box>
  );
}
