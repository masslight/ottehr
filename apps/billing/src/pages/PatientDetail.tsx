import { Add as AddIcon, ArrowBack as ArrowBackIcon, DeleteOutline as DeleteOutlineIcon } from '@mui/icons-material';
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
  MenuItem,
  Select,
  Tab,
  TextField,
  Typography,
} from '@mui/material';
import { DataGridPro, GridColDef } from '@mui/x-data-grid-pro';
import { ReactElement, useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BillingCoverageOption, getApiError, PatientDetailResponse, UpdateBillingPatientInput } from 'utils';
import {
  deleteBillingCoverage,
  getBillingPatientDetail,
  getPatientCoverages,
  updateBillingCoverage,
  updateBillingPatient,
} from '../api/api';
import {
  AddCoverageDialog,
  CoverageFormFields,
  coverageFormFromOption,
  CoverageFormState,
  coverageToUpdateInput,
  validateCoverageForm,
} from '../components/AddCoverageDialog';
import { dataGridSlots, dataGridSx } from '../components/BillingDataGrid';
import { EditableSection } from '../components/claim/EditableSection';
import { DetailRow } from '../components/DetailRow';
import { Field } from '../components/Field';
import { CLAIM_STATUS_COLORS, formatAntCaseString } from '../constants/claimStatus';
import { useApiClients } from '../hooks/useAppClients';
import { otherColors } from '../themes/ottehr/colors';
import { buildAddressInput, formatCurrency } from '../utils/format';

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
          label={formatAntCaseString(value as string)}
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
  // TODO: should be wired from ClaimResponse? showing placeholder until real data available
  {
    field: 'insurancePaid',
    headerName: 'Insurance Paid',
    width: 120,
    align: 'right',
    headerAlign: 'right',
    valueFormatter: () => '—',
  },
  {
    field: 'patientResp',
    headerName: 'Patient Resp',
    width: 120,
    align: 'right',
    headerAlign: 'right',
    valueFormatter: () => '—',
  },
  {
    field: 'patientPaid',
    headerName: 'Patient Paid',
    width: 110,
    align: 'right',
    headerAlign: 'right',
    valueFormatter: () => '—',
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
      const data = await getBillingPatientDetail(oystehrZambda, { patientId: id });
      setPatient(data);
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to load patient' }));
    } finally {
      setLoading(false);
    }
  }, [oystehrZambda, id]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  const savePatient = useCallback(
    async (payload: Record<string, unknown>): Promise<string | null> => {
      if (!oystehrZambda || !id) return 'Client not ready';
      try {
        await updateBillingPatient(oystehrZambda, { patientId: id, ...payload } as UpdateBillingPatientInput);
      } catch (err) {
        return getApiError({ error: err, defaultError: 'Failed to save changes' });
      }
      await fetchDetail();
      return null;
    },
    [oystehrZambda, id, fetchDetail]
  );

  if (loading && !patient) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !patient) {
    return (
      <Box sx={{ p: 0 }}>
        <Alert severity="error">{error ?? 'Patient not found'}</Alert>
        <Button sx={{ mt: 2 }} onClick={() => navigate('/patients')}>
          Back to Patients
        </Button>
      </Box>
    );
  }

  const patientName = `${patient.firstName} ${patient.lastName}`.trim() || 'Unknown';

  return (
    <Box sx={{ p: 0 }}>
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

      {/* TODO: wire real balance data from ClaimResponse/PaymentReconciliation */}
      <Card variant="outlined" sx={{ mb: 2, ml: 5 }}>
        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Box sx={{ display: 'flex', gap: 4 }}>
            <BalanceItem label="Current Balance" value="—" />
            <BalanceItem label="Claims with Patient Balance" value="—" />
            <BalanceItem label="Pending Payments" value="—" />
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
            <Tab label="Insurance" value="2" />
            <Tab label="Claims" value="3" />
          </TabList>

          <TabPanel value="1" sx={{ px: 0, pt: 2 }}>
            <DemographicsSection patient={patient} onSave={savePatient} />
          </TabPanel>

          <TabPanel value="2" sx={{ px: 0, pt: 2 }}>
            <InsuranceTab patientId={patient.id} />
          </TabPanel>

          <TabPanel value="3" sx={{ px: 0, pt: 2 }}>
            <DataGridPro
              rows={patient.claims}
              columns={claimColumns}
              onRowClick={(params) => navigate(`/claims/${params.id}`)}
              disableRowSelectionOnClick
              disableColumnMenu
              autoHeight
              pageSizeOptions={[25, 50]}
              initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
              slots={dataGridSlots}
              sx={{ ...dataGridSx }}
            />
          </TabPanel>
        </TabContext>
      </Box>
    </Box>
  );
}

function DemographicsSection({
  patient,
  onSave,
}: {
  patient: PatientDetailResponse;
  onSave: (payload: Record<string, unknown>) => Promise<string | null>;
}): ReactElement {
  const [firstName, setFirstName] = useState(patient.firstName);
  const [lastName, setLastName] = useState(patient.lastName);
  const [dob, setDob] = useState(patient.dob);
  const [gender, setGender] = useState(patient.gender);
  const [phone, setPhone] = useState(patient.phone);
  const [email, setEmail] = useState(patient.email);
  const [line1, setLine1] = useState(patient.addressParts.line1);
  const [line2, setLine2] = useState(patient.addressParts.line2);
  const [city, setCity] = useState(patient.addressParts.city);
  const [state, setState] = useState(patient.addressParts.state);
  const [zip, setZip] = useState(patient.addressParts.postalCode);

  const resetFields = useCallback((): void => {
    setFirstName(patient.firstName);
    setLastName(patient.lastName);
    setDob(patient.dob);
    setGender(patient.gender);
    setPhone(patient.phone);
    setEmail(patient.email);
    setLine1(patient.addressParts.line1);
    setLine2(patient.addressParts.line2);
    setCity(patient.addressParts.city);
    setState(patient.addressParts.state);
    setZip(patient.addressParts.postalCode);
  }, [patient]);

  useEffect(() => {
    resetFields();
  }, [resetFields]);

  const handleSave = async (): Promise<string | null> => {
    if (!firstName.trim() || !lastName.trim()) return 'First and last name are required';
    const address = buildAddressInput(line1, line2, city, state, zip);
    return onSave({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      ...(dob ? { dob } : {}),
      ...(gender ? { gender } : {}),
      ...(phone.trim() ? { phone: phone.trim() } : {}),
      ...(email.trim() ? { email: email.trim() } : {}),
      ...(address ? { address } : {}),
    });
  };

  const patientName = `${patient.firstName} ${patient.lastName}`.trim() || 'Unknown';

  return (
    <EditableSection
      title="Demographics"
      onSave={handleSave}
      onCancel={resetFields}
      editForm={
        <Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2.25, maxWidth: 680 }}>
            <Field label="First name">
              <TextField size="small" fullWidth value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </Field>
            <Field label="Last name">
              <TextField size="small" fullWidth value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </Field>
            <Field label="Date of birth">
              <TextField size="small" fullWidth type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            </Field>
            <Field label="Gender">
              <Select
                size="small"
                fullWidth
                displayEmpty
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                renderValue={
                  gender
                    ? undefined
                    : () => (
                        <Box component="span" sx={{ color: 'text.disabled' }}>
                          Select...
                        </Box>
                      )
                }
              >
                <MenuItem value="male">Male</MenuItem>
                <MenuItem value="female">Female</MenuItem>
                <MenuItem value="other">Other</MenuItem>
                <MenuItem value="unknown">Unknown</MenuItem>
              </Select>
            </Field>
            <Field label="Phone" optional>
              <TextField size="small" fullWidth value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <Field label="Email" optional>
              <TextField size="small" fullWidth value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Address line 1">
              <TextField size="small" fullWidth value={line1} onChange={(e) => setLine1(e.target.value)} />
            </Field>
            <Field label="Address line 2" optional>
              <TextField size="small" fullWidth value={line2} onChange={(e) => setLine2(e.target.value)} />
            </Field>
            <Field label="City">
              <TextField size="small" fullWidth value={city} onChange={(e) => setCity(e.target.value)} />
            </Field>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <Field label="State">
                <TextField
                  size="small"
                  fullWidth
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  inputProps={{ maxLength: 2, style: { textTransform: 'uppercase' } }}
                />
              </Field>
              <Field label="ZIP">
                <TextField size="small" fullWidth value={zip} onChange={(e) => setZip(e.target.value)} />
              </Field>
            </Box>
          </Box>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 12.5, mt: 2.5 }}>
            MRN and Friendly ID are system-assigned and cannot be edited.
          </Typography>
        </Box>
      }
    >
      <DetailRow label="Patient" value={patientName} labelWidth={120} />
      <DetailRow label="MRN" value={patient.id} labelWidth={120} />
      <DetailRow label="Friendly ID" value={patient.friendlyId} labelWidth={120} />
      <DetailRow label="DOB" value={patient.dob} labelWidth={120} />
      <DetailRow label="Gender" value={patient.gender} labelWidth={120} />
      <DetailRow label="Phone" value={patient.phone} labelWidth={120} />
      <DetailRow label="Email" value={patient.email} labelWidth={120} />
      <DetailRow label="Address" value={patient.address} labelWidth={120} />
    </EditableSection>
  );
}

function InsuranceTab({ patientId }: { patientId: string }): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [coverages, setCoverages] = useState<BillingCoverageOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const fetchCoverages = useCallback(async (): Promise<void> => {
    if (!oystehrZambda) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getPatientCoverages(oystehrZambda, { patientId });
      // Order primary (1) before secondary (2); coverages without a priority sort last.
      const sorted = [...res.coverages].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
      setCoverages(sorted);
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to load coverages' }));
    } finally {
      setLoading(false);
    }
  }, [oystehrZambda, patientId]);

  useEffect(() => {
    void fetchCoverages();
  }, [fetchCoverages]);

  // Default a new coverage to primary unless one already exists, then secondary.
  const defaultOrder: 1 | 2 = coverages.some((c) => c.order === 1) ? 2 : 1;

  if (loading && coverages.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>
          Add coverage
        </Button>
      </Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {coverages.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No insurance coverages on file.
        </Typography>
      ) : (
        coverages.map((coverage) => <CoverageCard key={coverage.id} coverage={coverage} onChanged={fetchCoverages} />)
      )}
      <AddCoverageDialog
        open={addOpen}
        patientId={patientId}
        defaultOrder={defaultOrder}
        onClose={() => setAddOpen(false)}
        onCreated={() => void fetchCoverages()}
      />
    </Box>
  );
}

function CoverageCard({
  coverage,
  onChanged,
}: {
  coverage: BillingCoverageOption;
  onChanged: () => Promise<void>;
}): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [form, setForm] = useState<CoverageFormState>(() => coverageFormFromOption(coverage));
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const resetForm = useCallback((): void => {
    setForm(coverageFormFromOption(coverage));
    setConfirming(false);
    setDeleteError(null);
  }, [coverage]);

  useEffect(() => {
    resetForm();
  }, [resetForm]);

  const handleSave = async (): Promise<string | null> => {
    if (!oystehrZambda || !coverage.id) return 'Client not ready';
    const validationError = validateCoverageForm(form, false);
    if (validationError) return validationError;
    try {
      await updateBillingCoverage(oystehrZambda, coverageToUpdateInput(form, coverage.id));
    } catch (err) {
      return getApiError({ error: err, defaultError: 'Failed to save coverage' });
    }
    await onChanged();
    return null;
  };

  const handleDelete = async (): Promise<void> => {
    if (!oystehrZambda || !coverage.id) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteBillingCoverage(oystehrZambda, { coverageId: coverage.id });
    } catch (err) {
      setDeleteError(getApiError({ error: err, defaultError: 'Failed to remove coverage' }));
      setDeleting(false);
      return;
    }
    await onChanged();
  };

  const title = coverage.order === 2 ? 'Secondary Insurance' : coverage.order === 1 ? 'Primary Insurance' : 'Insurance';
  const policyHolderName = coverage.policyHolder
    ? `${coverage.policyHolder.firstName} ${coverage.policyHolder.lastName}`.trim()
    : '';

  return (
    <EditableSection
      title={title}
      onSave={handleSave}
      onCancel={resetForm}
      editForm={<CoverageFormFields value={form} onChange={setForm} payerPlaceholder={coverage.payorName} />}
    >
      <DetailRow label="Payer" value={coverage.payorName} labelWidth={170} />
      <DetailRow label="Payer ID" value={coverage.payorId} labelWidth={170} />
      <DetailRow label="Member ID" value={coverage.memberId ?? coverage.subscriberId} labelWidth={170} />
      <DetailRow label="Relationship to insured" value={coverage.relationship ?? ''} labelWidth={170} />
      {policyHolderName && <DetailRow label="Policy holder" value={policyHolderName} labelWidth={170} />}
      <DetailRow label="Status" value={coverage.status} labelWidth={170} />
      <Box sx={{ mt: 1.5 }}>
        {deleteError && (
          <Alert severity="error" sx={{ mb: 1 }}>
            {deleteError}
          </Alert>
        )}
        {confirming ? (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Remove this coverage? It will be cancelled and unlinked from the patient account.
            </Typography>
            <Button size="small" onClick={() => setConfirming(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              size="small"
              color="error"
              variant="contained"
              onClick={() => void handleDelete()}
              disabled={deleting}
            >
              {deleting ? 'Removing...' : 'Confirm remove'}
            </Button>
          </Box>
        ) : (
          <Button
            size="small"
            color="error"
            startIcon={<DeleteOutlineIcon fontSize="small" />}
            onClick={() => setConfirming(true)}
          >
            Remove coverage
          </Button>
        )}
      </Box>
    </EditableSection>
  );
}

function BalanceItem({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body1" fontWeight={600}>
        {value}
      </Typography>
    </Box>
  );
}
