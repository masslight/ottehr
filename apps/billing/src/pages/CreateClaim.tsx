import { ArrowBack as ArrowBackIcon, Save as SaveIcon } from '@mui/icons-material';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormHelperText,
  IconButton,
  TextField,
  Typography,
} from '@mui/material';
import { ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { Controller, FormProvider, useFieldArray, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import {
  BillingCoverageOption,
  BillingLocationOption,
  BillingPatientOption,
  BillingProviderOption,
  ClaimStatusFieldKey,
  ClaimStatusValues,
  CreateBillingClaimInput,
  emptyClaimStatusValues,
  getApiError,
  REQUIRED_FIELD_ERROR_MESSAGE,
  withArStageInitialization,
} from 'utils';
import {
  createBillingClaim,
  getPatientCoverages,
  searchBillingLocations,
  searchBillingPatients,
  searchBillingProviders as searchBillingProvidersApi,
} from '../api/api';
import { ClaimStatusFields } from '../components/claim/ClaimStatusFields';
import { TextInput } from '../components/input/TextInput';
import { useApiClients } from '../hooks/useAppClients';

interface ServiceLine {
  cpt: string;
  modifiers: string;
  units: number;
  charges: number;
}

interface CreateClaimForm {
  dateOfService: string;
  pos: { value: string; label: string } | null;
  patient: BillingPatientOption | null;
  patientFirstName: string;
  patientLastName: string;
  patientDob: string;
  patientGender: string;
  coverage: BillingCoverageOption | null;
  renderingProvider: BillingProviderOption | null;
  practFirstName: string;
  practLastName: string;
  practNpi: string;
  facility: BillingLocationOption | null;
  facilityName: string;
  facilityNpi: string;
  facilityAddress: string;
  billingProvider: BillingProviderOption | null;
  billingName: string;
  billingNpi: string;
  billingTin: string;
  diagnoses: string[];
  serviceLines: ServiceLine[];
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

const defaultValues: CreateClaimForm = {
  dateOfService: '',
  pos: null,
  patient: null,
  patientFirstName: '',
  patientLastName: '',
  patientDob: '',
  patientGender: '',
  coverage: null,
  renderingProvider: null,
  practFirstName: '',
  practLastName: '',
  practNpi: '',
  facility: null,
  facilityName: '',
  facilityNpi: '',
  facilityAddress: '',
  billingProvider: null,
  billingName: '',
  billingNpi: '',
  billingTin: '',
  diagnoses: [],
  serviceLines: [{ ...emptyLine }],
};

export default function CreateClaim(): ReactElement {
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const renderingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const billingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const methods = useForm<CreateClaimForm>({ defaultValues });
  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = methods;

  // API-level error shown in the top alert (kept separate from field validation).
  const [error, setError] = useState<string | null>(null);
  // Claim status indicators live outside RHF (managed by the ClaimStatusFields component).
  const [statuses, setStatuses] = useState<ClaimStatusValues>(emptyClaimStatusValues);
  // AR Stage is required but isn't an RHF field, so we surface its error after a submit attempt.
  const [arStageError, setArStageError] = useState(false);

  // Autocomplete search results — UI state, not form values.
  const [patients, setPatients] = useState<BillingPatientOption[]>([]);
  const [coverages, setCoverages] = useState<BillingCoverageOption[]>([]);
  const [renderingProviders, setRenderingProviders] = useState<BillingProviderOption[]>([]);
  const [locations, setLocations] = useState<BillingLocationOption[]>([]);
  const [billingProviders, setBillingProviders] = useState<BillingProviderOption[]>([]);
  const [dxInput, setDxInput] = useState('');

  const {
    fields: serviceLineFields,
    append,
    remove,
  } = useFieldArray({
    control,
    name: 'serviceLines',
    // A claim needs at least one billable line; empty-CPT lines are dropped before submit, so require a real CPT.
    rules: {
      validate: (lines) => lines.some((l) => l.cpt.trim()) || 'At least one service line with a CPT code is required',
    },
  });

  // Watched values used to drive conditional sections / disabled states.
  const selectedPatient = watch('patient');
  const selectedCoverage = watch('coverage');
  const selectedRenderingProvider = watch('renderingProvider');
  const selectedFacility = watch('facility');
  const selectedBillingProvider = watch('billingProvider');

  useEffect(() => {
    return (): void => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
      if (renderingTimer.current) clearTimeout(renderingTimer.current);
      if (locTimer.current) clearTimeout(locTimer.current);
      if (billingTimer.current) clearTimeout(billingTimer.current);
    };
  }, []);

  // After a failed submit, smoothly scroll the first invalid field into view
  // (matches the clinical side, e.g. apps/ehr/src/components/EmployeeInformation/index.tsx).
  // Covers both RHF fields (Patient, Date of Service) and AR Stage, which render `.Mui-error`.
  useEffect(() => {
    if (Object.keys(errors).length > 0 || arStageError) {
      document.querySelector('.Mui-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [errors, arStageError]);

  const searchPatients = useCallback(
    async (query?: string): Promise<void> => {
      if (!oystehrZambda) return;
      const res = await searchBillingPatients(oystehrZambda, query ? { name: query } : {});
      setPatients(res.patients ?? []);
    },
    [oystehrZambda]
  );

  const fetchCoverages = useCallback(
    async (patientId: string): Promise<void> => {
      if (!oystehrZambda) return;
      const res = await getPatientCoverages(oystehrZambda, { patientId });
      setCoverages(res.coverages ?? []);
    },
    [oystehrZambda]
  );

  const searchRenderingProviders = useCallback(
    (query?: string): void => {
      if (!oystehrZambda) return;
      if (renderingTimer.current) clearTimeout(renderingTimer.current);
      renderingTimer.current = setTimeout(async () => {
        const res = await searchBillingProvidersApi(oystehrZambda, {
          providerType: 'rendering',
          ...(query ? { name: query } : {}),
        });
        setRenderingProviders(res.providers ?? []);
      }, 300);
    },
    [oystehrZambda]
  );

  const searchLocations = useCallback(
    (query?: string): void => {
      if (!oystehrZambda) return;
      if (locTimer.current) clearTimeout(locTimer.current);
      locTimer.current = setTimeout(async () => {
        const res = await searchBillingLocations(oystehrZambda, query ? { name: query } : {});
        setLocations(res.locations ?? []);
      }, 300);
    },
    [oystehrZambda]
  );

  const searchBillingProviders = useCallback(
    (query?: string): void => {
      if (!oystehrZambda) return;
      if (billingTimer.current) clearTimeout(billingTimer.current);
      billingTimer.current = setTimeout(async () => {
        const res = await searchBillingProvidersApi(oystehrZambda, {
          providerType: 'billing',
          ...(query ? { name: query } : {}),
        });
        setBillingProviders(res.providers ?? []);
      }, 300);
    },
    [oystehrZambda]
  );

  const handlePatientSearch = (query: string): void => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => void searchPatients(query || undefined), 300);
  };

  const handleStatusChange = (field: ClaimStatusFieldKey, value: string): void => {
    setStatuses((prev) => {
      const next = { ...prev, [field]: value };
      // Entering an AR Stage initializes that stage's progress status (mirrors the server rule).
      return field === 'arStage' ? { ...next, ...withArStageInitialization(next) } : next;
    });
    // Clear the AR Stage error as soon as a stage is chosen (never raise it outside a submit attempt).
    if (field === 'arStage' && value) setArStageError(false);
  };

  const onValid = async (data: CreateClaimForm): Promise<void> => {
    if (!oystehrZambda || !data.patient) return;
    if (!data.patient.id) {
      setError('Selected patient is missing an id');
      return;
    }
    setError(null);
    try {
      const payload: Record<string, unknown> = { patientId: data.patient.id };

      // Patient overrides — only send fields that differ from original
      const patOverrides: Record<string, string> = {};
      if (data.patientFirstName && data.patientFirstName !== data.patient.firstName)
        patOverrides.firstName = data.patientFirstName;
      if (data.patientLastName && data.patientLastName !== data.patient.lastName)
        patOverrides.lastName = data.patientLastName;
      if (data.patientDob && data.patientDob !== data.patient.dob) patOverrides.dob = data.patientDob;
      if (data.patientGender && data.patientGender !== data.patient.gender) patOverrides.gender = data.patientGender;
      if (Object.keys(patOverrides).length) payload.patientOverrides = patOverrides;

      if (data.coverage) {
        payload.coverageId = data.coverage.id;
      }

      if (data.renderingProvider) {
        const overrides: Record<string, string> = {};
        if (data.practFirstName && data.practFirstName !== data.renderingProvider.firstName)
          overrides.firstName = data.practFirstName;
        if (data.practLastName && data.practLastName !== data.renderingProvider.lastName)
          overrides.lastName = data.practLastName;
        if (data.practNpi && data.practNpi !== data.renderingProvider.npi) overrides.npi = data.practNpi;
        payload.renderingProvider = {
          id: data.renderingProvider.id,
          type: data.renderingProvider.kind === 'organization' ? 'Organization' : 'Practitioner',
          ...(Object.keys(overrides).length ? { overrides } : {}),
        };
      }

      if (data.facility) {
        payload.facilityId = data.facility.id;
        const facOverrides: Record<string, string> = {};
        if (data.facilityName && data.facilityName !== data.facility.name) facOverrides.name = data.facilityName;
        if (data.facilityNpi && data.facilityNpi !== data.facility.npi) facOverrides.npi = data.facilityNpi;
        if (data.facilityAddress && data.facilityAddress !== data.facility.address)
          facOverrides.address = data.facilityAddress;
        if (Object.keys(facOverrides).length) payload.facilityOverrides = facOverrides;
      }

      if (data.billingProvider) {
        const overrides: Record<string, string> = {};
        if (data.billingName && data.billingName !== data.billingProvider.name) overrides.name = data.billingName;
        if (data.billingNpi && data.billingNpi !== data.billingProvider.npi) overrides.npi = data.billingNpi;
        if (data.billingTin && data.billingTin !== data.billingProvider.taxId) overrides.tin = data.billingTin;
        payload.billingProvider = {
          id: data.billingProvider.id,
          type: data.billingProvider.kind === 'organization' ? 'Organization' : 'Practitioner',
          ...(Object.keys(overrides).length ? { overrides } : {}),
        };
      }

      if (data.diagnoses.length) payload.diagnoses = data.diagnoses.map((code) => ({ code }));

      const pos = data.pos?.value;
      const validLines = data.serviceLines.filter((l) => l.cpt.trim());
      if (validLines.length) {
        payload.serviceLines = validLines.map((l) => ({
          cptCode: l.cpt,
          units: l.units,
          charges: l.charges,
          serviceDate: data.dateOfService,
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

      const result = await createBillingClaim(oystehrZambda, payload as CreateBillingClaimInput);
      if (result.claimId) navigate(`/claims/${result.claimId}`);
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to create claim' }));
    }
  };

  // Always-enabled Create: RHF validates Patient + Date of Service; AR Stage is checked here since
  // it lives outside the form. On any failure the offending fields turn red and we scroll to the first.
  const handleCreate = handleSubmit(
    async (data) => {
      if (!statuses.arStage) {
        setArStageError(true);
        return;
      }
      setArStageError(false);
      await onValid(data);
    },
    () => {
      setArStageError(!statuses.arStage);
    }
  );

  return (
    <FormProvider {...methods}>
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
              startIcon={isSubmitting ? <CircularProgress size={14} /> : <SaveIcon fontSize="small" />}
              onClick={handleCreate}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create'}
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
            <TextInput
              name="dateOfService"
              type="date"
              label="Date of Service"
              required
              InputLabelProps={{ shrink: true }}
              sx={{ width: 200 }}
            />
            <Controller
              name="pos"
              control={control}
              render={({ field }) => (
                <Autocomplete
                  size="small"
                  options={POS_OPTIONS}
                  getOptionLabel={(o) => o.label}
                  value={field.value}
                  onChange={(_, v) => field.onChange(v)}
                  renderInput={(params) => <TextField {...params} label="Place of Service" />}
                  isOptionEqualToValue={(o, v) => o.value === v.value}
                  sx={{ width: 260 }}
                />
              )}
            />
          </Box>
        </FormSection>

        <Divider />

        <Box sx={{ py: 2.5 }}>
          <ClaimStatusFields
            values={statuses}
            onChange={handleStatusChange}
            requireArStage={arStageError}
            title="Claim Status"
          />
        </Box>

        <Divider />

        <FormSection label="Patient">
          <Controller
            name="patient"
            control={control}
            rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
            render={({ field, fieldState: { error: fieldError } }) => (
              <Autocomplete
                options={patients}
                value={field.value}
                onChange={(_, value) => {
                  field.onChange(value);
                  setValue('coverage', null);
                  setCoverages([]);
                  setValue('patientFirstName', value?.firstName ?? '');
                  setValue('patientLastName', value?.lastName ?? '');
                  setValue('patientDob', value?.dob ?? '');
                  setValue('patientGender', value?.gender ?? '');
                  if (value?.id) void fetchCoverages(value.id);
                }}
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
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Search Patient"
                    size="small"
                    error={!!fieldError}
                    helperText={fieldError?.message}
                  />
                )}
                isOptionEqualToValue={(o, v) => o.id === v.id}
                sx={{ mb: field.value ? 2 : 0 }}
              />
            )}
          />
          {selectedPatient && (
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextInput name="patientFirstName" label="First Name" sx={{ flex: 1, minWidth: 160 }} />
              <TextInput name="patientLastName" label="Last Name" sx={{ flex: 1, minWidth: 160 }} />
              <TextInput
                name="patientDob"
                type="date"
                label="Date of Birth"
                InputLabelProps={{ shrink: true }}
                sx={{ width: 160 }}
              />
              <TextInput name="patientGender" label="Gender" sx={{ width: 120 }} />
            </Box>
          )}
        </FormSection>

        <Divider />

        <FormSection label="Insurance / Coverage">
          <Controller
            name="coverage"
            control={control}
            render={({ field }) => (
              <Autocomplete
                options={coverages}
                value={field.value}
                onChange={(_, v) => field.onChange(v)}
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
            )}
          />
          {selectedCoverage && (
            <TextField
              label="Member / Subscriber ID"
              value={selectedCoverage.subscriberId}
              size="small"
              fullWidth
              InputProps={{ readOnly: true }}
            />
          )}
        </FormSection>

        <Divider />

        <FormSection label="Rendering Provider">
          <Controller
            name="renderingProvider"
            control={control}
            rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
            render={({ field, fieldState: { error: fieldError } }) => (
              <Autocomplete
                options={renderingProviders}
                value={field.value}
                onChange={(_, v) => {
                  field.onChange(v);
                  setValue('practFirstName', v?.firstName ?? '');
                  setValue('practLastName', v?.lastName ?? '');
                  setValue('practNpi', v?.npi ?? '');
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
                renderInput={(p) => (
                  <TextField
                    {...p}
                    size="small"
                    label="Choose Rendering Provider"
                    error={!!fieldError}
                    helperText={fieldError?.message}
                  />
                )}
                isOptionEqualToValue={(o, v) => o.id === v.id}
                sx={{ mb: field.value ? 2 : 0 }}
              />
            )}
          />
          {selectedRenderingProvider && (
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextInput name="practFirstName" label="First Name" sx={{ flex: 1 }} />
              <TextInput name="practLastName" label="Last Name" sx={{ flex: 1 }} />
              <TextInput name="practNpi" label="NPI" sx={{ width: 160 }} />
            </Box>
          )}
        </FormSection>

        <Divider />

        <FormSection label="Service Facility">
          <Controller
            name="facility"
            control={control}
            rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
            render={({ field, fieldState: { error: fieldError } }) => (
              <Autocomplete
                options={locations}
                value={field.value}
                onChange={(_, v) => {
                  field.onChange(v);
                  setValue('facilityName', v?.name ?? '');
                  setValue('facilityNpi', v?.npi ?? '');
                  setValue('facilityAddress', v?.address ?? '');
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
                renderInput={(p) => (
                  <TextField
                    {...p}
                    size="small"
                    label="Choose Service Facility"
                    error={!!fieldError}
                    helperText={fieldError?.message}
                  />
                )}
                isOptionEqualToValue={(o, v) => o.id === v.id}
                sx={{ mb: field.value ? 2 : 0 }}
              />
            )}
          />
          {selectedFacility && (
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextInput name="facilityName" label="Facility Name" sx={{ flex: 1 }} />
              <TextInput name="facilityNpi" label="NPI" sx={{ width: 160 }} />
              <TextInput name="facilityAddress" label="Address" sx={{ flex: 1 }} />
            </Box>
          )}
        </FormSection>

        <Divider />

        <FormSection label="Billing Provider">
          <Controller
            name="billingProvider"
            control={control}
            rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
            render={({ field, fieldState: { error: fieldError } }) => (
              <Autocomplete
                options={billingProviders}
                value={field.value}
                onChange={(_, v) => {
                  field.onChange(v);
                  setValue('billingName', v?.name ?? '');
                  setValue('billingNpi', v?.npi ?? '');
                  setValue('billingTin', v?.taxId ?? '');
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
                renderInput={(p) => (
                  <TextField
                    {...p}
                    size="small"
                    label="Choose Billing Provider"
                    error={!!fieldError}
                    helperText={fieldError?.message}
                  />
                )}
                isOptionEqualToValue={(o, v) => o.id === v.id}
                sx={{ mb: field.value ? 2 : 0 }}
              />
            )}
          />
          {selectedBillingProvider && (
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextInput name="billingName" label="Name" sx={{ flex: 1 }} />
              <TextInput name="billingNpi" label="NPI" sx={{ width: 160 }} />
              <TextInput name="billingTin" label="TIN" sx={{ width: 160 }} />
            </Box>
          )}
        </FormSection>

        <Divider />

        <FormSection label="Diagnoses">
          <Controller
            name="diagnoses"
            control={control}
            rules={{ validate: (v) => (v && v.length > 0) || 'At least one diagnosis is required' }}
            render={({ field, fieldState: { error: fieldError } }) => {
              const addDiagnosis = (): void => {
                const code = dxInput.trim().toUpperCase();
                if (code && !field.value.includes(code)) {
                  field.onChange([...field.value, code]);
                  setDxInput('');
                }
              };
              return (
                <>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                    {field.value.map((dx, i) => (
                      <Chip
                        key={i}
                        label={dx}
                        size="small"
                        onDelete={() => field.onChange(field.value.filter((_, j) => j !== i))}
                      />
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
                      error={!!fieldError}
                      helperText={fieldError?.message}
                      sx={{ width: 200 }}
                    />
                    <Button size="small" onClick={addDiagnosis}>
                      + Add
                    </Button>
                  </Box>
                </>
              );
            }}
          />
        </FormSection>

        <Divider />

        <FormSection label="Service Lines">
          {serviceLineFields.map((lineField, i) => (
            <Box key={lineField.id} sx={{ mb: 2 }}>
              {i > 0 && <Divider sx={{ mb: 2 }} />}
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Controller
                  name={`serviceLines.${i}.cpt`}
                  control={control}
                  render={({ field }) => <TextField {...field} size="small" label="CPT" sx={{ width: 100 }} />}
                />
                <Controller
                  name={`serviceLines.${i}.modifiers`}
                  control={control}
                  render={({ field }) => <TextField {...field} size="small" label="Mod" sx={{ width: 80 }} />}
                />
                <Controller
                  name={`serviceLines.${i}.units`}
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      size="small"
                      label="Units"
                      type="number"
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      sx={{ width: 70 }}
                    />
                  )}
                />
                <Controller
                  name={`serviceLines.${i}.charges`}
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      size="small"
                      label="Charges"
                      type="number"
                      value={field.value || ''}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      sx={{ width: 100 }}
                    />
                  )}
                />
                {serviceLineFields.length > 1 && (
                  <Button size="small" color="error" onClick={() => remove(i)}>
                    Remove
                  </Button>
                )}
              </Box>
            </Box>
          ))}
          <Button size="small" onClick={() => append({ ...emptyLine })}>
            + Add service line
          </Button>
          {errors.serviceLines?.root && <FormHelperText error>{errors.serviceLines.root.message}</FormHelperText>}
        </FormSection>
      </Box>
    </FormProvider>
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
