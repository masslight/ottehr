import { ArrowBack as ArrowBackIcon, Save as SaveIcon } from '@mui/icons-material';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Divider,
  FormHelperText,
  IconButton,
  TextField,
  Typography,
} from '@mui/material';
import { ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
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
import { DiagnosesEditor, DiagnosisRow } from '../components/claim/DiagnosesEditor';
import { emptyServiceLineRow, ServiceLineRow, ServiceLinesEditor } from '../components/claim/ServiceLinesEditor';
import { useApiClients } from '../hooks/useAppClients';

// The create screen only picks references — patient, coverage, and providers are chosen as-is.
// Tweaking their underlying details (names, NPIs, addresses, etc.) is done afterward in the claim
// editing UI, which keeps this screen focused on assembling a claim from existing resources.
interface CreateClaimForm {
  patient: BillingPatientOption | null;
  coverage: BillingCoverageOption | null;
  renderingProvider: BillingProviderOption | null;
  facility: BillingLocationOption | null;
  billingProvider: BillingProviderOption | null;
  // Diagnoses and service lines reuse the same editors as the claim-detail edit experience;
  // each service line points at diagnoses by their 1-based position in this list.
  diagnoses: DiagnosisRow[];
  serviceLines: ServiceLineRow[];
}

const defaultValues: CreateClaimForm = {
  patient: null,
  coverage: null,
  renderingProvider: null,
  facility: null,
  billingProvider: null,
  diagnoses: [],
  serviceLines: [emptyServiceLineRow()],
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
    getValues,
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

  // Watched values used to drive conditional sections / disabled states.
  const selectedPatient = watch('patient');
  const selectedCoverage = watch('coverage');
  // Diagnoses drive the service-line Dx pointer dropdown — pointers are the 1-based position here.
  const diagnoses = watch('diagnoses');
  const diagnosisOptions = diagnoses.map((dx, i) => ({ sequence: i + 1, code: dx.code }));

  useEffect(() => {
    return (): void => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
      if (renderingTimer.current) clearTimeout(renderingTimer.current);
      if (locTimer.current) clearTimeout(locTimer.current);
      if (billingTimer.current) clearTimeout(billingTimer.current);
    };
  }, []);

  // After a failed submit, smoothly scroll the first invalid field into view.
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
      // Reference-only: the claim is assembled from existing resources as-is. Any tweaks to their
      // details happen afterward in the claim editing UI, so no override fields are sent here.
      const payload: Record<string, unknown> = { patientId: data.patient.id };

      if (data.coverage) {
        payload.coverageId = data.coverage.id;
      }

      if (data.renderingProvider) {
        payload.renderingProvider = {
          id: data.renderingProvider.id,
          type: data.renderingProvider.kind === 'organization' ? 'Organization' : 'Practitioner',
        };
      }

      if (data.facility) {
        payload.facilityId = data.facility.id;
      }

      if (data.billingProvider) {
        payload.billingProvider = {
          id: data.billingProvider.id,
          type: data.billingProvider.kind === 'organization' ? 'Organization' : 'Practitioner',
        };
      }

      // Validation guarantees every diagnosis row has a code, so positions here line up with the
      // diagnosisPointers below (the backend assigns diagnosisSequence by array order).
      const diagnoses = data.diagnoses.filter((dx) => dx.code.trim());
      if (diagnoses.length) {
        payload.diagnoses = diagnoses.map((dx) => ({
          code: dx.code.trim(),
          ...(dx.display.trim() ? { display: dx.display.trim() } : {}),
        }));
      }

      const validLines = data.serviceLines.filter((l) => l.cptCode.trim());
      if (validLines.length) {
        payload.serviceLines = validLines.map((l) => {
          // Split the free-text modifiers field on any run of commas and/or whitespace
          // so "25, 59" and "25 59" both yield ["25", "59"].
          const modifiers = l.modifiers
            .split(/[,\s]+/)
            .map((m) => m.trim())
            .filter(Boolean);
          const pointers = l.diagnosisPointers.filter((p) => p >= 1 && p <= diagnoses.length);
          return {
            cptCode: l.cptCode.trim(),
            units: Number(l.units),
            charges: Number(l.charges),
            serviceDate: l.serviceDate,
            ...(l.placeOfService.trim() ? { placeOfService: l.placeOfService.trim() } : {}),
            ...(modifiers.length ? { modifiers } : {}),
            ...(pointers.length ? { diagnosisPointers: pointers } : {}),
          };
        });
      }

      const statusEntries = Object.entries(statuses).filter(([, v]) => v);
      if (statusEntries.length) payload.statuses = Object.fromEntries(statusEntries);

      const result = await createBillingClaim(oystehrZambda, payload as CreateBillingClaimInput);
      if (result.claimId) navigate(`/claims/${result.claimId}`);
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to create claim' }));
    }
  };

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
                  // Changing patient resets coverage, since coverages are patient-specific.
                  setValue('coverage', null);
                  setCoverages([]);
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
              />
            )}
          />
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
                onChange={(_, v) => field.onChange(v)}
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
              />
            )}
          />
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
                  // Default each service line's POS to the chosen facility's place of service (overridable).
                  const pos = v?.posCode;
                  if (pos) {
                    setValue(
                      'serviceLines',
                      getValues('serviceLines').map((l) => ({ ...l, placeOfService: pos }))
                    );
                  }
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
              />
            )}
          />
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
                onChange={(_, v) => field.onChange(v)}
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
              />
            )}
          />
        </FormSection>

        <Divider />

        <FormSection label="Diagnoses">
          <Controller
            name="diagnoses"
            control={control}
            rules={{
              validate: (rows) => {
                if (!rows.length) return 'At least one diagnosis is required';
                if (rows.some((dx) => !dx.code.trim())) return 'Each diagnosis needs an ICD-10 code';
                return true;
              },
            }}
            render={({ field, fieldState: { error: fieldError } }) => (
              <>
                <DiagnosesEditor value={field.value} onChange={field.onChange} />
                {fieldError && <FormHelperText error>{fieldError.message}</FormHelperText>}
              </>
            )}
          />
        </FormSection>

        <Divider />

        <FormSection label="Service Lines">
          <Controller
            name="serviceLines"
            control={control}
            rules={{
              validate: (rows) => {
                const withCpt = rows.filter((l) => l.cptCode.trim());
                if (!withCpt.length) return 'At least one service line with a CPT code is required';
                if (withCpt.some((l) => !l.serviceDate)) return 'Each service line needs a date of service';
                if (withCpt.some((l) => !(Number(l.units) > 0))) return 'Units must be a positive number';
                if (withCpt.some((l) => l.charges.trim() === '' || !Number.isFinite(Number(l.charges))))
                  return 'Charges must be a number';
                return true;
              },
            }}
            render={({ field, fieldState: { error: fieldError } }) => (
              <>
                <ServiceLinesEditor value={field.value} onChange={field.onChange} diagnoses={diagnosisOptions} />
                {fieldError && <FormHelperText error>{fieldError.message}</FormHelperText>}
              </>
            )}
          />
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
