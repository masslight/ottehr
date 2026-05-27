import { ArrowBack as ArrowBackIcon, Save as SaveIcon } from '@mui/icons-material';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  TextField,
  Typography,
} from '@mui/material';
import { ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { chooseJson } from 'utils';
import { useApiClients } from '../hooks/useAppClients';

interface PatientOption {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  dob: string;
  gender: string;
  address: string;
}

interface CoverageOption {
  id: string;
  subscriberId: string;
  payorName: string;
  payorId: string;
}

interface PractitionerOption {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  npi: string;
}

interface LocationOption {
  id: string;
  name: string;
  npi: string;
  address: string;
}

interface OrgOption {
  id: string;
  name: string;
  npi: string;
  tin: string;
}

interface ServiceLine {
  cpt: string;
  modifiers: string;
  units: number;
  charges: number;
}

const POS_OPTIONS = [
  { value: '11', label: '11 - Office' },
  { value: '20', label: '20 - Urgent Care' },
  { value: '21', label: '21 - Inpatient Hospital' },
  { value: '22', label: '22 - Outpatient Hospital' },
  { value: '23', label: '23 - Emergency Room' },
  { value: '02', label: '02 - Telehealth' },
];

const emptyLine: ServiceLine = { cpt: '', modifiers: '', units: 1, charges: 0 };

export default function CreateClaim(): ReactElement {
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const practTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const orgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [coverages, setCoverages] = useState<CoverageOption[]>([]);
  const [practitioners, setPractitioners] = useState<PractitionerOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [billingOrgs, setBillingOrgs] = useState<OrgOption[]>([]);

  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null);
  const [selectedCoverage, setSelectedCoverage] = useState<CoverageOption | null>(null);
  const [selectedPractitioner, setSelectedPractitioner] = useState<PractitionerOption | null>(null);
  const [selectedFacility, setSelectedFacility] = useState<LocationOption | null>(null);
  const [selectedBillingProvider, setSelectedBillingProvider] = useState<OrgOption | null>(null);

  const [subscriberId, setSubscriberId] = useState('');
  const [dateOfService, setDateOfService] = useState('');
  const [selectedPos, setSelectedPos] = useState<{ value: string; label: string } | null>(null);
  const [diagnoses, setDiagnoses] = useState<string[]>([]);
  const [dxInput, setDxInput] = useState('');
  const [serviceLines, setServiceLines] = useState<ServiceLine[]>([{ ...emptyLine }]);

  // Override fields — populated from selection, editable by user
  const [patientFirstName, setPatientFirstName] = useState('');
  const [patientLastName, setPatientLastName] = useState('');
  const [patientDob, setPatientDob] = useState('');
  const [patientGender, setPatientGender] = useState('');
  const [practFirstName, setPractFirstName] = useState('');
  const [practLastName, setPractLastName] = useState('');
  const [practNpi, setPractNpi] = useState('');
  const [facilityName, setFacilityName] = useState('');

  useEffect(() => {
    return (): void => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
      if (practTimer.current) clearTimeout(practTimer.current);
      if (locTimer.current) clearTimeout(locTimer.current);
      if (orgTimer.current) clearTimeout(orgTimer.current);
    };
  }, []);

  const searchPatients = useCallback(
    async (query?: string): Promise<void> => {
      if (!oystehrZambda) return;
      const res = await oystehrZambda.zambda.execute({
        id: 'search-billing-patients',
        ...(query ? { name: query } : {}),
      });
      setPatients(chooseJson(res).patients ?? []);
    },
    [oystehrZambda]
  );

  const fetchCoverages = useCallback(
    async (patientId: string): Promise<void> => {
      if (!oystehrZambda) return;
      const res = await oystehrZambda.zambda.execute({ id: 'get-patient-coverages', patientId });
      setCoverages(chooseJson(res).coverages ?? []);
    },
    [oystehrZambda]
  );

  const searchPractitioners = useCallback(
    (query?: string): void => {
      if (!oystehrZambda) return;
      if (practTimer.current) clearTimeout(practTimer.current);
      practTimer.current = setTimeout(async () => {
        const res = await oystehrZambda.zambda.execute({
          id: 'search-billing-practitioners',
          ...(query ? { name: query } : {}),
        });
        setPractitioners(chooseJson(res).practitioners ?? []);
      }, 300);
    },
    [oystehrZambda]
  );

  const searchLocations = useCallback(
    (query?: string): void => {
      if (!oystehrZambda) return;
      if (locTimer.current) clearTimeout(locTimer.current);
      locTimer.current = setTimeout(async () => {
        const res = await oystehrZambda.zambda.execute({
          id: 'search-billing-locations',
          ...(query ? { name: query } : {}),
        });
        setLocations(chooseJson(res).locations ?? []);
      }, 300);
    },
    [oystehrZambda]
  );

  const searchBillingOrgs = useCallback(
    (query?: string): void => {
      if (!oystehrZambda) return;
      if (orgTimer.current) clearTimeout(orgTimer.current);
      orgTimer.current = setTimeout(async () => {
        const res = await oystehrZambda.zambda.execute({
          id: 'search-billing-organizations',
          ...(query ? { name: query } : {}),
        });
        const allOrgs = chooseJson(res).organizations ?? [];
        setBillingOrgs(allOrgs.filter((o: OrgOption & { isPayer?: boolean }) => !o.isPayer));
      }, 300);
    },
    [oystehrZambda]
  );

  const handlePatientSearch = (query: string): void => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => void searchPatients(query || undefined), 300);
  };

  const handlePatientSelect = (_: unknown, value: PatientOption | null): void => {
    setSelectedPatient(value);
    setSelectedCoverage(null);
    setCoverages([]);
    setSubscriberId('');
    setPatientFirstName(value?.firstName ?? '');
    setPatientLastName(value?.lastName ?? '');
    setPatientDob(value?.dob ?? '');
    setPatientGender(value?.gender ?? '');
    if (value) void fetchCoverages(value.id);
  };

  const addDiagnosis = (): void => {
    const code = dxInput.trim().toUpperCase();
    if (code && !diagnoses.includes(code)) {
      setDiagnoses([...diagnoses, code]);
      setDxInput('');
    }
  };

  const updateLine = (i: number, field: keyof ServiceLine, value: string | number): void => {
    const updated = [...serviceLines];
    updated[i] = { ...updated[i], [field]: value };
    setServiceLines(updated);
  };

  const canSave = selectedPatient && dateOfService;

  const handleSave = async (): Promise<void> => {
    if (!oystehrZambda || !selectedPatient || !dateOfService) return;
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = { patientId: selectedPatient.id };

      // Patient overrides — only send fields that differ from original
      const patOverrides: Record<string, string> = {};
      if (patientFirstName && patientFirstName !== selectedPatient.firstName) patOverrides.firstName = patientFirstName;
      if (patientLastName && patientLastName !== selectedPatient.lastName) patOverrides.lastName = patientLastName;
      if (patientDob && patientDob !== selectedPatient.dob) patOverrides.dob = patientDob;
      if (patientGender && patientGender !== selectedPatient.gender) patOverrides.gender = patientGender;
      if (Object.keys(patOverrides).length) payload.patientOverrides = patOverrides;

      if (selectedCoverage) {
        payload.coverageId = selectedCoverage.id;
        if (subscriberId && subscriberId !== selectedCoverage.subscriberId) {
          payload.coverageOverrides = { subscriberId };
        }
      }

      if (selectedPractitioner) {
        payload.practitionerId = selectedPractitioner.id;
        const practOverrides: Record<string, string> = {};
        if (practFirstName && practFirstName !== selectedPractitioner.firstName) practOverrides.firstName = practFirstName;
        if (practLastName && practLastName !== selectedPractitioner.lastName) practOverrides.lastName = practLastName;
        if (practNpi && practNpi !== selectedPractitioner.npi) practOverrides.npi = practNpi;
        if (Object.keys(practOverrides).length) payload.practitionerOverrides = practOverrides;
      }

      if (selectedFacility) {
        payload.facilityId = selectedFacility.id;
        if (facilityName && facilityName !== selectedFacility.name) {
          payload.facilityOverrides = { name: facilityName };
        }
      }

      if (selectedBillingProvider) payload.billingProviderId = selectedBillingProvider.id;

      if (diagnoses.length) payload.diagnoses = diagnoses.map((code) => ({ code }));

      const pos = selectedPos?.value;
      const validLines = serviceLines.filter((l) => l.cpt.trim());
      if (validLines.length) {
        payload.serviceLines = validLines.map((l) => ({
          cptCode: l.cpt,
          units: l.units,
          charges: l.charges,
          serviceDate: dateOfService,
          placeOfService: pos || undefined,
          modifiers: l.modifiers
            ? l.modifiers
                .split(',')
                .map((m) => m.trim())
                .filter(Boolean)
            : undefined,
        }));
      }

      const res = await oystehrZambda.zambda.execute({ id: 'create-billing-claim', ...payload });
      const data = chooseJson(res);
      if (data?.claimId) navigate(`/claims/${data.claimId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton size="small" onClick={() => navigate('/claims')}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Typography variant="h6" color="primary.dark" fontWeight={600}>
            Create a Claim
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button size="small" onClick={() => navigate('/claims')}>
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            startIcon={saving ? <CircularProgress size={14} /> : <SaveIcon fontSize="small" />}
            onClick={handleSave}
            disabled={saving || !canSave}
          >
            {saving ? 'Creating...' : 'Create'}
          </Button>
        </Box>
      </Box>

      <Divider />
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      <FormSection label="Claim Information">
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            size="small"
            type="date"
            label="Date of Service"
            value={dateOfService}
            onChange={(e) => setDateOfService(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 200 }}
          />
          <Autocomplete
            size="small"
            options={POS_OPTIONS}
            getOptionLabel={(o) => o.label}
            value={selectedPos}
            onChange={(_, v) => setSelectedPos(v)}
            renderInput={(params) => <TextField {...params} label="Place of Service" />}
            isOptionEqualToValue={(o, v) => o.value === v.value}
            sx={{ width: 260 }}
          />
        </Box>
      </FormSection>

      <Divider />

      <FormSection label="Patient">
        <Autocomplete
          options={patients}
          value={selectedPatient}
          onChange={handlePatientSelect}
          onInputChange={(_, val, reason) => {
            if (reason === 'input') handlePatientSearch(val);
          }}
          onOpen={() => void searchPatients()}
          filterOptions={(x) => x}
          getOptionLabel={(o) => o.name || `${o.firstName} ${o.lastName}`}
          renderOption={(props, o) => (
            <Box component="li" {...props} key={o.id}>
              <Box>
                <Typography variant="body2" fontWeight={500}>
                  {o.name || `${o.firstName} ${o.lastName}`}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  DOB: {o.dob} | {o.gender}
                </Typography>
              </Box>
            </Box>
          )}
          renderInput={(params) => <TextField {...params} label="Search Patient" size="small" />}
          isOptionEqualToValue={(o, v) => o.id === v.id}
          sx={{ mb: selectedPatient ? 2 : 0 }}
        />
        {selectedPatient && (
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              size="small"
              label="First Name"
              value={patientFirstName}
              onChange={(e) => setPatientFirstName(e.target.value)}
              sx={{ flex: 1, minWidth: 160 }}
            />
            <TextField
              size="small"
              label="Last Name"
              value={patientLastName}
              onChange={(e) => setPatientLastName(e.target.value)}
              sx={{ flex: 1, minWidth: 160 }}
            />
            <TextField
              size="small"
              type="date"
              label="Date of Birth"
              value={patientDob}
              onChange={(e) => setPatientDob(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 160 }}
            />
            <TextField
              size="small"
              label="Gender"
              value={patientGender}
              onChange={(e) => setPatientGender(e.target.value)}
              sx={{ width: 120 }}
            />
          </Box>
        )}
      </FormSection>

      <Divider />

      <FormSection label="Insurance / Coverage">
        <Autocomplete
          options={coverages}
          value={selectedCoverage}
          onChange={(_, v) => {
            setSelectedCoverage(v);
            if (v) setSubscriberId(v.subscriberId);
          }}
          getOptionLabel={(o) => `${o.payorName} — ${o.subscriberId}`}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Select Coverage"
              size="small"
              placeholder={selectedPatient ? 'Choose coverage...' : 'Select a patient first'}
            />
          )}
          isOptionEqualToValue={(o, v) => o.id === v.id}
          disabled={!selectedPatient}
          sx={{ mb: 2 }}
        />
        <TextField
          label="Member / Subscriber ID"
          size="small"
          fullWidth
          value={subscriberId}
          onChange={(e) => setSubscriberId(e.target.value)}
        />
      </FormSection>

      <Divider />

      <FormSection label="Rendering Provider">
        <Autocomplete
          options={practitioners}
          value={selectedPractitioner}
          onChange={(_, v) => {
            setSelectedPractitioner(v);
            setPractFirstName(v?.firstName ?? '');
            setPractLastName(v?.lastName ?? '');
            setPractNpi(v?.npi ?? '');
          }}
          onInputChange={(_, val, reason) => {
            if (reason === 'input') searchPractitioners(val || undefined);
          }}
          onOpen={() => searchPractitioners()}
          filterOptions={(x) => x}
          getOptionLabel={(o) => o.name || `${o.firstName} ${o.lastName}`}
          renderOption={(props, o) => (
            <Box component="li" {...props} key={o.id}>
              <Box>
                <Typography variant="body2" fontWeight={500}>
                  {o.name || `${o.firstName} ${o.lastName}`}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  NPI: {o.npi}
                </Typography>
              </Box>
            </Box>
          )}
          renderInput={(p) => <TextField {...p} size="small" label="Choose Rendering Provider" />}
          isOptionEqualToValue={(o, v) => o.id === v.id}
          sx={{ mb: selectedPractitioner ? 2 : 0 }}
        />
        {selectedPractitioner && (
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              size="small"
              label="First Name"
              value={practFirstName}
              onChange={(e) => setPractFirstName(e.target.value)}
              sx={{ flex: 1 }}
            />
            <TextField
              size="small"
              label="Last Name"
              value={practLastName}
              onChange={(e) => setPractLastName(e.target.value)}
              sx={{ flex: 1 }}
            />
            <TextField
              size="small"
              label="NPI"
              value={practNpi}
              onChange={(e) => setPractNpi(e.target.value)}
              sx={{ width: 160 }}
            />
          </Box>
        )}
      </FormSection>

      <Divider />

      <FormSection label="Service Facility">
        <Autocomplete
          options={locations}
          value={selectedFacility}
          onChange={(_, v) => {
            setSelectedFacility(v);
            setFacilityName(v?.name ?? '');
          }}
          onInputChange={(_, val, reason) => {
            if (reason === 'input') searchLocations(val || undefined);
          }}
          onOpen={() => searchLocations()}
          filterOptions={(x) => x}
          getOptionLabel={(o) => o.name}
          renderOption={(props, o) => (
            <Box component="li" {...props} key={o.id}>
              <Box>
                <Typography variant="body2" fontWeight={500}>
                  {o.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  NPI: {o.npi} | {o.address}
                </Typography>
              </Box>
            </Box>
          )}
          renderInput={(p) => <TextField {...p} size="small" label="Choose Service Facility" />}
          isOptionEqualToValue={(o, v) => o.id === v.id}
          sx={{ mb: selectedFacility ? 2 : 0 }}
        />
        {selectedFacility && (
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              size="small"
              label="Facility Name"
              value={facilityName}
              onChange={(e) => setFacilityName(e.target.value)}
              sx={{ flex: 1 }}
            />
            <TextField size="small" label="NPI" value={selectedFacility.npi} disabled sx={{ width: 160 }} />
            <TextField size="small" label="Address" value={selectedFacility.address} disabled sx={{ flex: 1 }} />
          </Box>
        )}
      </FormSection>

      <Divider />

      <FormSection label="Billing Provider">
        <Autocomplete
          options={billingOrgs}
          value={selectedBillingProvider}
          onChange={(_, v) => setSelectedBillingProvider(v)}
          onInputChange={(_, val, reason) => {
            if (reason === 'input') searchBillingOrgs(val || undefined);
          }}
          onOpen={() => searchBillingOrgs()}
          filterOptions={(x) => x}
          getOptionLabel={(o) => o.name}
          renderOption={(props, o) => (
            <Box component="li" {...props} key={o.id}>
              <Box>
                <Typography variant="body2" fontWeight={500}>
                  {o.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  NPI: {o.npi} | TIN: {o.tin}
                </Typography>
              </Box>
            </Box>
          )}
          renderInput={(p) => <TextField {...p} size="small" label="Choose Billing Provider" />}
          isOptionEqualToValue={(o, v) => o.id === v.id}
        />
      </FormSection>

      <Divider />

      <FormSection label="Diagnoses">
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
          {diagnoses.map((dx, i) => (
            <Chip key={i} label={dx} size="small" onDelete={() => setDiagnoses(diagnoses.filter((_, j) => j !== i))} />
          ))}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            size="small"
            placeholder="ICD-10 (e.g. J06.9)"
            value={dxInput}
            onChange={(e) => setDxInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addDiagnosis();
              }
            }}
            sx={{ width: 200 }}
          />
          <Button size="small" onClick={addDiagnosis}>
            + Add
          </Button>
        </Box>
      </FormSection>

      <Divider />

      <FormSection label="Service Lines">
        {serviceLines.map((line, i) => (
          <Box key={i} sx={{ mb: 2 }}>
            {i > 0 && <Divider sx={{ mb: 2 }} />}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField
                size="small"
                label="CPT"
                value={line.cpt}
                onChange={(e) => updateLine(i, 'cpt', e.target.value)}
                sx={{ width: 100 }}
              />
              <TextField
                size="small"
                label="Mod"
                value={line.modifiers}
                onChange={(e) => updateLine(i, 'modifiers', e.target.value)}
                sx={{ width: 80 }}
              />
              <TextField
                size="small"
                label="Units"
                type="number"
                value={line.units}
                onChange={(e) => updateLine(i, 'units', Number(e.target.value))}
                sx={{ width: 70 }}
              />
              <TextField
                size="small"
                label="Charges"
                type="number"
                value={line.charges || ''}
                onChange={(e) => updateLine(i, 'charges', Number(e.target.value))}
                sx={{ width: 100 }}
              />
              {serviceLines.length > 1 && (
                <Button
                  size="small"
                  color="error"
                  onClick={() => setServiceLines(serviceLines.filter((_, j) => j !== i))}
                >
                  Remove
                </Button>
              )}
            </Box>
          </Box>
        ))}
        <Button size="small" onClick={() => setServiceLines([...serviceLines, { ...emptyLine }])}>
          + Add service line
        </Button>
      </FormSection>
    </Box>
  );
}

function FormSection({ label, children }: { label: string; children: React.ReactNode }): ReactElement {
  return (
    <Box sx={{ py: 2.5 }}>
      <Typography variant="overline" color="primary.dark" sx={{ fontWeight: 600, letterSpacing: 1, fontSize: 12 }}>
        {label}
      </Typography>
      <Box sx={{ mt: 1.5 }}>{children}</Box>
    </Box>
  );
}
