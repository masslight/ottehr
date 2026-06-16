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
import {
  BillingCoverageOption,
  BillingLocationOption,
  BillingPatientOption,
  BillingProviderOption,
  chooseJson,
  CLAIM_STATUS_FIELD_KEYS,
  CLAIM_STATUS_FIELDS_BY_KEY,
  ClaimStatusFieldKey,
  ClaimStatusValues,
  getActiveStatusGroup,
} from 'utils';
import { ClaimStatusFields } from '../components/claim/ClaimStatusFields';
import { useApiClients } from '../hooks/useAppClients';

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
  const renderingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const billingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [patients, setPatients] = useState<BillingPatientOption[]>([]);
  const [coverages, setCoverages] = useState<BillingCoverageOption[]>([]);
  const [renderingProviders, setRenderingProviders] = useState<BillingProviderOption[]>([]);
  const [locations, setLocations] = useState<BillingLocationOption[]>([]);
  const [billingProviders, setBillingProviders] = useState<BillingProviderOption[]>([]);

  const [selectedPatient, setSelectedPatient] = useState<BillingPatientOption | null>(null);
  const [selectedCoverage, setSelectedCoverage] = useState<BillingCoverageOption | null>(null);
  const [selectedRenderingProvider, setSelectedRenderingProvider] = useState<BillingProviderOption | null>(null);
  const [selectedFacility, setSelectedFacility] = useState<BillingLocationOption | null>(null);
  const [selectedBillingProvider, setSelectedBillingProvider] = useState<BillingProviderOption | null>(null);

  const [subscriberId, setSubscriberId] = useState('');
  const [dateOfService, setDateOfService] = useState('');
  const [selectedPos, setSelectedPos] = useState<{ value: string; label: string } | null>(null);
  const [diagnoses, setDiagnoses] = useState<string[]>([]);
  const [dxInput, setDxInput] = useState('');
  const [serviceLines, setServiceLines] = useState<ServiceLine[]>([{ ...emptyLine }]);
  const [statuses, setStatuses] = useState<ClaimStatusValues>(
    () => Object.fromEntries(CLAIM_STATUS_FIELD_KEYS.map((k) => [k, ''])) as ClaimStatusValues
  );

  // Override fields — populated from selection, editable by user
  const [patientFirstName, setPatientFirstName] = useState('');
  const [patientLastName, setPatientLastName] = useState('');
  const [patientDob, setPatientDob] = useState('');
  const [patientGender, setPatientGender] = useState('');
  const [practFirstName, setPractFirstName] = useState('');
  const [practLastName, setPractLastName] = useState('');
  const [practNpi, setPractNpi] = useState('');
  const [facilityName, setFacilityName] = useState('');
  const [facilityNpi, setFacilityNpi] = useState('');
  const [facilityAddress, setFacilityAddress] = useState('');
  const [billingName, setBillingName] = useState('');
  const [billingNpi, setBillingNpi] = useState('');
  const [billingTin, setBillingTin] = useState('');

  useEffect(() => {
    return (): void => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
      if (renderingTimer.current) clearTimeout(renderingTimer.current);
      if (locTimer.current) clearTimeout(locTimer.current);
      if (billingTimer.current) clearTimeout(billingTimer.current);
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

  const searchRenderingProviders = useCallback(
    (query?: string): void => {
      if (!oystehrZambda) return;
      if (renderingTimer.current) clearTimeout(renderingTimer.current);
      renderingTimer.current = setTimeout(async () => {
        const res = await oystehrZambda.zambda.execute({
          id: 'search-billing-providers',
          providerType: 'rendering',
          ...(query ? { name: query } : {}),
        });
        setRenderingProviders(chooseJson(res).providers ?? []);
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

  const searchBillingProviders = useCallback(
    (query?: string): void => {
      if (!oystehrZambda) return;
      if (billingTimer.current) clearTimeout(billingTimer.current);
      billingTimer.current = setTimeout(async () => {
        const res = await oystehrZambda.zambda.execute({
          id: 'search-billing-providers',
          providerType: 'billing',
          ...(query ? { name: query } : {}),
        });
        setBillingProviders(chooseJson(res).providers ?? []);
      }, 300);
    },
    [oystehrZambda]
  );

  const handlePatientSearch = (query: string): void => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => void searchPatients(query || undefined), 300);
  };

  const handlePatientSelect = (_: unknown, value: BillingPatientOption | null): void => {
    setSelectedPatient(value);
    setSelectedCoverage(null);
    setCoverages([]);
    setSubscriberId('');
    setPatientFirstName(value?.firstName ?? '');
    setPatientLastName(value?.lastName ?? '');
    setPatientDob(value?.dob ?? '');
    setPatientGender(value?.gender ?? '');
    if (value?.id) void fetchCoverages(value.id);
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

  const handleStatusChange = (field: ClaimStatusFieldKey, value: string): void => {
    setStatuses((prev) => {
      const next = { ...prev, [field]: value };
      // Mirror the server rule: entering an AR Stage initializes that stage's progress status.
      if (field === 'arStage' && value) {
        const group = getActiveStatusGroup(value);
        if (group && !next[group.primaryFieldKey]) {
          next[group.primaryFieldKey] = CLAIM_STATUS_FIELDS_BY_KEY[group.primaryFieldKey].options[0]?.code ?? '';
        }
      }
      return next;
    });
  };

  const canSave = selectedPatient && dateOfService && statuses.arStage;

  const handleSave = async (): Promise<void> => {
    if (!oystehrZambda || !selectedPatient || !dateOfService || !statuses.arStage) return;
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

      if (selectedRenderingProvider) {
        const overrides: Record<string, string> = {};
        if (practFirstName && practFirstName !== selectedRenderingProvider.firstName)
          overrides.firstName = practFirstName;
        if (practLastName && practLastName !== selectedRenderingProvider.lastName) overrides.lastName = practLastName;
        if (practNpi && practNpi !== selectedRenderingProvider.npi) overrides.npi = practNpi;
        payload.renderingProvider = {
          id: selectedRenderingProvider.id,
          type: selectedRenderingProvider.kind === 'organization' ? 'Organization' : 'Practitioner',
          ...(Object.keys(overrides).length ? { overrides } : {}),
        };
      }

      if (selectedFacility) {
        payload.facilityId = selectedFacility.id;
        const facOverrides: Record<string, string> = {};
        if (facilityName && facilityName !== selectedFacility.name) facOverrides.name = facilityName;
        if (facilityNpi && facilityNpi !== selectedFacility.npi) facOverrides.npi = facilityNpi;
        if (facilityAddress && facilityAddress !== selectedFacility.address) facOverrides.address = facilityAddress;
        if (Object.keys(facOverrides).length) payload.facilityOverrides = facOverrides;
      }

      if (selectedBillingProvider) {
        const overrides: Record<string, string> = {};
        if (billingName && billingName !== selectedBillingProvider.name) overrides.name = billingName;
        if (billingNpi && billingNpi !== selectedBillingProvider.npi) overrides.npi = billingNpi;
        if (billingTin && billingTin !== selectedBillingProvider.taxId) overrides.tin = billingTin;
        payload.billingProvider = {
          id: selectedBillingProvider.id,
          type: selectedBillingProvider.kind === 'organization' ? 'Organization' : 'Practitioner',
          ...(Object.keys(overrides).length ? { overrides } : {}),
        };
      }

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

      const statusEntries = Object.entries(statuses).filter(([, v]) => v);
      if (statusEntries.length) payload.statuses = Object.fromEntries(statusEntries);

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

      <Box sx={{ py: 2.5 }}>
        <ClaimStatusFields values={statuses} onChange={handleStatusChange} requireArStage title="Claim Status" />
      </Box>

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
          options={renderingProviders}
          value={selectedRenderingProvider}
          onChange={(_, v) => {
            setSelectedRenderingProvider(v);
            setPractFirstName(v?.firstName ?? '');
            setPractLastName(v?.lastName ?? '');
            setPractNpi(v?.npi ?? '');
          }}
          onInputChange={(_, val, reason) => {
            if (reason === 'input') searchRenderingProviders(val || undefined);
          }}
          onOpen={() => searchRenderingProviders()}
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
          sx={{ mb: selectedRenderingProvider ? 2 : 0 }}
        />
        {selectedRenderingProvider && (
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
            setFacilityNpi(v?.npi ?? '');
            setFacilityAddress(v?.address ?? '');
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
            <TextField
              size="small"
              label="NPI"
              value={facilityNpi}
              onChange={(e) => setFacilityNpi(e.target.value)}
              sx={{ width: 160 }}
            />
            <TextField
              size="small"
              label="Address"
              value={facilityAddress}
              onChange={(e) => setFacilityAddress(e.target.value)}
              sx={{ flex: 1 }}
            />
          </Box>
        )}
      </FormSection>

      <Divider />

      <FormSection label="Billing Provider">
        <Autocomplete
          options={billingProviders}
          value={selectedBillingProvider}
          onChange={(_, v) => {
            setSelectedBillingProvider(v);
            setBillingName(v?.name ?? '');
            setBillingNpi(v?.npi ?? '');
            setBillingTin(v?.taxId ?? '');
          }}
          onInputChange={(_, val, reason) => {
            if (reason === 'input') searchBillingProviders(val || undefined);
          }}
          onOpen={() => searchBillingProviders()}
          filterOptions={(x) => x}
          getOptionLabel={(o) => o.name}
          renderOption={(props, o) => (
            <Box component="li" {...props} key={o.id}>
              <Box>
                <Typography variant="body2" fontWeight={500}>
                  {o.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  NPI: {o.npi} | TIN: {o.taxId}
                </Typography>
              </Box>
            </Box>
          )}
          renderInput={(p) => <TextField {...p} size="small" label="Choose Billing Provider" />}
          isOptionEqualToValue={(o, v) => o.id === v.id}
          sx={{ mb: selectedBillingProvider ? 2 : 0 }}
        />
        {selectedBillingProvider && (
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              size="small"
              label="Name"
              value={billingName}
              onChange={(e) => setBillingName(e.target.value)}
              sx={{ flex: 1 }}
            />
            <TextField
              size="small"
              label="NPI"
              value={billingNpi}
              onChange={(e) => setBillingNpi(e.target.value)}
              sx={{ width: 160 }}
            />
            <TextField
              size="small"
              label="TIN"
              value={billingTin}
              onChange={(e) => setBillingTin(e.target.value)}
              sx={{ width: 160 }}
            />
          </Box>
        )}
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
