import { LoadingButton } from '@mui/lab';
import {
  Autocomplete,
  Box,
  Button,
  capitalize,
  Chip,
  FormControlLabel,
  FormLabel,
  Grid,
  Paper,
  Skeleton,
  Switch,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Address, ChargeItemDefinition, Identifier, List, Organization } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BILLING_URL, CHARGE_MASTERS_URL, FEE_SCHEDULES_URL, INSURANCES_URL } from 'src/App';
import CustomBreadcrumbs from 'src/components/CustomBreadcrumbs';
import { useApiClients } from 'src/hooks/useAppClients';
import PageContainer from 'src/layout/PageContainer';
import { useListChargeMastersQuery } from 'src/rcm/state/charge-masters/charge-master.queries';
import { useListFeeSchedulesQuery } from 'src/rcm/state/fee-schedules/fee-schedule.queries';
import { CASE_RATE_CODE, FHIR_EXTENSION, getPayerId, getPayerUrl, INSURANCE_SETTINGS_MAP, RCM_TAG_SYSTEM } from 'utils';
import { ottehrExtensionUrl } from 'utils/lib/fhir/systemUrls';
import { useInsuranceMutation, useInsurancesQuery } from './admin.queries';

// TODO: uncomment when insurance settings will be applied to patient paperwork step with filling insurance data
// const INSURANCE_SETTINGS_CHECKBOXES: Array<
//   Exclude<keyof typeof INSURANCE_SETTINGS_MAP, typeof ENABLE_ELIGIBILITY_CHECK_KEY>
// > = [
//   'requiresSubscriberId',
//   'requiresSubscriberName',
//   'requiresSubscriberDOB',
//   'requiresRelationshipToSubscriber',
//   'requiresInsuranceName',
//   'requiresInsuranceCardImage',
//   'requiresFacilityNPI',
//   'requiresStateUID',
// ];

type InsuranceSettingsBooleans = {
  [key in keyof typeof INSURANCE_SETTINGS_MAP]?: boolean;
};

interface PayorOrg {
  name?: string;
  id?: string;
}

export type InsuranceData = InsuranceSettingsBooleans & {
  id: Organization['id'];
  payor?: PayorOrg;
  displayName: string;
  active: Organization['active'];
  showInPaperwork: boolean;
  identifier?: Identifier[];
  address?: Address[];
  notes?: string;
};

type InsuranceForm = Omit<InsuranceData, 'id' | 'active'>;

export default function EditInsurance(): JSX.Element {
  const theme = useTheme();
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();
  const { insuranceTab, insurance: insuranceIdParam } = useParams();
  const isNew = insuranceIdParam === 'new';
  const insuranceId = isNew ? undefined : insuranceIdParam;
  const [error, setError] = useState('');

  const { control, getValues, reset, setValue, watch } = useForm<InsuranceForm>({
    defaultValues: {
      payor: undefined,
      displayName: '',
      showInPaperwork: false,

      // TODO: uncomment when insurance settings will be applied to patient paperwork step with filling insurance data
      // ...INSURANCE_SETTINGS_DEFAULTS,
    },
  });

  const {
    data: insuranceData,
    isFetching: insuranceDataLoading,
    refetch: refetchInsuranceData,
  } = useInsurancesQuery(insuranceId ? [insuranceId] : undefined, true);
  const insuranceDetails = insuranceData?.[0];
  const payerId = getPayerId(insuranceDetails) ?? ''; // CW TODO: default

  const { data: patientInsuranceOverrideList, refetch: refetchPatientOverrideList } = useQuery({
    queryKey: ['insurance-override-list', 'patient'],
    queryFn: async () => {
      if (!oystehrZambda) return undefined;
      const result = await oystehrZambda.zambda.execute({
        id: 'get-insurance-override-list',
        listName: 'patient',
      });
      return result.output as List;
    },
    enabled: !!oystehrZambda,
  });

  const patientOverrideListEntry = patientInsuranceOverrideList?.entry
    ?.find((e) => e.item.reference === getPayerUrl(payerId))
    ?.extension?.find((ext) => ext.url === ottehrExtensionUrl('insurance-override-name'));
  const nameOverride = patientOverrideListEntry?.valueString;
  const displayName = useMemo(() => {
    return nameOverride ?? insuranceDetails?.name;
  }, [nameOverride, insuranceDetails]);
  const [disableDisplayName, setDisableDisplayName] = useState(!patientOverrideListEntry);
  useEffect(() => {
    setDisableDisplayName(!patientOverrideListEntry);
  }, [patientOverrideListEntry]);

  const { data: ehrInsuranceOverrideList, refetch: refetchEhrOverrideList } = useQuery({
    queryKey: ['insurance-override-list', 'ehr'],
    queryFn: async () => {
      if (!oystehrZambda) return undefined;
      const result = await oystehrZambda.zambda.execute({
        id: 'get-insurance-override-list',
        listName: 'ehr',
      });
      return result.output as List;
    },
    enabled: !!oystehrZambda,
  });
  const note = useMemo(
    () =>
      ehrInsuranceOverrideList?.entry
        ?.find((e) => e.item.reference === getPayerUrl(payerId))
        ?.extension?.find((ext) => ext.url === ottehrExtensionUrl('insurance-override-note'))?.valueString,
    [ehrInsuranceOverrideList, payerId]
  );

  // No list, empty list, is on list
  const [payerNameInputValue, setPayerNameInputValue] = useState('');

  const { data: feeSchedules, isFetching: feeSchedulesFetching } = useListFeeSchedulesQuery();
  const { data: chargeMasters, isFetching: chargeMastersFetching } = useListChargeMastersQuery();

  const findApplicable = useCallback(
    (items: ChargeItemDefinition[] | undefined, orgId: string | undefined): ChargeItemDefinition | null => {
      if (!items || !orgId) return null;
      const today = new Date().toISOString().split('T')[0];
      const associated = items.filter(
        (item) =>
          item.status === 'active' &&
          item.useContext?.some((uc) => uc.valueReference?.reference === `Organization/${orgId}`)
      );
      const applicable = associated.filter((item) => !item.date || item.date <= today);
      applicable.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
      return applicable[0] ?? null;
    },
    []
  );

  const applicableFeeSchedule = useMemo(
    () => findApplicable(feeSchedules, insuranceId),
    [findApplicable, feeSchedules, insuranceId]
  );

  const applicableChargeMaster = useMemo(() => {
    if (!chargeMasters || !insuranceId) return { chargeMaster: null, source: null };

    // 1. Payer-specific
    const payerSpecific = findApplicable(chargeMasters, insuranceId);
    if (payerSpecific) return { chargeMaster: payerSpecific, source: 'payer-specific' as const };

    const today = new Date().toISOString().split('T')[0];

    // 2. Default-insurance fallback
    const defaultCMs = chargeMasters.filter(
      (cm) =>
        cm.status === 'active' &&
        cm.meta?.tag?.some((t) => t.system === RCM_TAG_SYSTEM && t.code === 'default-insurance')
    );
    const applicableDefaults = defaultCMs.filter((cm) => !cm.date || cm.date <= today);
    applicableDefaults.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
    if (applicableDefaults[0]) return { chargeMaster: applicableDefaults[0], source: 'default-insurance' as const };

    // 3. Self-pay fallback
    const selfPayCMs = chargeMasters.filter(
      (cm) => cm.status === 'active' && cm.meta?.tag?.some((t) => t.system === RCM_TAG_SYSTEM && t.code === 'self-pay')
    );
    const applicableSelfPay = selfPayCMs.filter((cm) => !cm.date || cm.date <= today);
    applicableSelfPay.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
    if (applicableSelfPay[0]) return { chargeMaster: applicableSelfPay[0], source: 'self-pay' as const };

    return { chargeMaster: null, source: null };
  }, [chargeMasters, insuranceId, findApplicable]);

  const settingsMap = Object.fromEntries(
    Object.entries(INSURANCE_SETTINGS_MAP).map(([key, _]) => [key as keyof typeof INSURANCE_SETTINGS_MAP, false])
  ) as InsuranceSettingsBooleans;

  insuranceDetails?.extension
    ?.find((ext) => ext.url === FHIR_EXTENSION.InsurancePlan.insuranceRequirements.url)
    ?.extension?.forEach((settingExt) => {
      settingsMap[settingExt.url as keyof typeof INSURANCE_SETTINGS_MAP] = settingExt.valueBoolean || false;
    });

  useEffect(() => {
    if (isNew) {
      return;
    }
    reset({
      payor: insuranceDetails,
      displayName,
      notes: note,
      showInPaperwork: !!patientOverrideListEntry,
      // TODO: uncomment when insurance settings will be applied to patient paperwork step with filling insurance data
      // ...settingsMap,
    });
  }, [insuranceDetails, displayName, note, reset, isNew, patientOverrideListEntry]);

  const mutationId = isNew ? watch('payor')?.id ?? '' : payerId;
  const { mutateAsync: mutateInsurance, isPending: mutationPending } = useInsuranceMutation(mutationId);

  const onSubmit = async (): Promise<void> => {
    setError('');
    const formData = getValues();
    const submitSnackbarText = `${formData.displayName} was updated successfully`;

    try {
      await mutateInsurance({
        existingName: isNew ? undefined : nameOverride,
        name: formData.displayName,
        existingNote: isNew ? undefined : note,
        note: formData.notes,
        showInPaperwork: formData.showInPaperwork,
      });
      enqueueSnackbar(`${submitSnackbarText}`, {
        variant: 'success',
      });
      void refetchPatientOverrideList();
      void refetchEhrOverrideList();
      enqueueSnackbar(`${insuranceDetails!.name || 'Insurance'} status was updated successfully`, {
        variant: 'success',
      });
      if (isNew) {
        navigate(`${INSURANCES_URL}${insuranceTab ? `/${insuranceTab}` : ''}/${mutationId}`);
      } else {
        await refetchInsuranceData();
      }
    } catch {
      const submitErrorString = 'Error trying to save insurance configuration. Please, try again';
      setError(`${submitErrorString}`);
      enqueueSnackbar(`${submitErrorString}`, {
        variant: 'error',
      });
    }
  };

  // CW TODO: handle no list / empty list note next to toggle
  return (
    <PageContainer tabTitle={'Edit State'}>
      <Grid container direction="row" alignItems="center" justifyContent="center">
        <Grid item maxWidth={'584px'} width={'100%'}>
          <CustomBreadcrumbs
            chain={[
              { link: '/admin', children: 'Admin' },
              { link: BILLING_URL, children: 'Billing Configuration' },
              { link: `${BILLING_URL}/insurance`, children: 'Insurance' },
              ...(insuranceTab
                ? [
                    {
                      link: `${BILLING_URL}/insurance/${insuranceTab}`,
                      children: `${capitalize(insuranceTab ?? '')} List`,
                    },
                  ]
                : []),
              {
                link: '#',
                children: isNew ? (
                  'Add list entry'
                ) : insuranceDataLoading ? (
                  <Skeleton width={150} />
                ) : (
                  insuranceDetails?.name || ''
                ),
              },
            ]}
          />
          <Typography
            variant="h3"
            color="primary.dark"
            marginTop={2}
            marginBottom={2}
            sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', fontWeight: '600 !important' }}
          >
            {isNew ? <></> : insuranceDataLoading ? <Skeleton width={250} /> : insuranceDetails?.name || ''}
          </Typography>
          {insuranceId && insuranceDataLoading ? (
            <Skeleton height={550} sx={{ marginY: -5 }} />
          ) : (
            <Paper sx={{ padding: 3 }}>
              {/* Breadcrumbs */}

              <form
                onSubmit={async (event) => {
                  event.preventDefault();
                  await onSubmit();
                }}
              >
                <FormLabel
                  sx={{
                    ...theme.typography.h4,
                    color: theme.palette.primary.dark,
                    mb: 2,
                    fontWeight: '600 !important',
                    display: 'block',
                  }}
                >
                  Insurance settings
                </FormLabel>
                <Controller
                  name="payor"
                  control={control}
                  render={({ field: { onChange, value } }) => {
                    return (
                      <Autocomplete
                        value={value || null}
                        disabled={!isNew || insuranceDataLoading}
                        getOptionLabel={(option) => option.name || ''}
                        loading={insuranceDataLoading}
                        isOptionEqualToValue={(option, value) => {
                          return option.id === value.id;
                        }}
                        onChange={(_, newValue) => {
                          onChange(newValue as PayorOrg);
                        }}
                        inputValue={payerNameInputValue}
                        onInputChange={(_, newValue) => setPayerNameInputValue(newValue)}
                        options={
                          isNew
                            ? insuranceData?.map((d) => ({ id: d.id, name: d.name })) ?? []
                            : [{ id: insuranceDetails?.id, name: insuranceDetails?.name }]
                        }
                        renderOption={(props, option) => {
                          return (
                            <li {...props} key={option.id}>
                              {option.name}
                            </li>
                          );
                        }}
                        fullWidth
                        renderInput={(params) => (
                          <TextField placeholder="Select payer name" {...params} label="Payer name" required />
                        )}
                      />
                    );
                  }}
                />
                <Controller
                  name="showInPaperwork"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={field.value}
                          disabled={insuranceDataLoading}
                          onChange={(_, newValue) => {
                            field.onChange(newValue);
                            setValue('displayName', getValues('payor')?.name ?? '');
                            setDisableDisplayName(!newValue);
                          }}
                        />
                      }
                      label="Show in Patient Paperwork"
                    />
                  )}
                />
                <Controller
                  name="displayName"
                  control={control}
                  render={({ field: { onChange, value } }) => (
                    <TextField
                      id="outlined-read-only-input"
                      label="Display name"
                      disabled={insuranceDataLoading || disableDisplayName}
                      value={value || ''}
                      onChange={onChange}
                      sx={{ marginTop: 2, marginBottom: 1, width: '100%' }}
                      margin="dense"
                    />
                  )}
                />

                <Controller
                  name="notes"
                  control={control}
                  render={({ field: { onChange, value } }) => (
                    <TextField
                      id="notes"
                      label="Notes"
                      value={value || ''}
                      onChange={onChange}
                      sx={{ marginTop: 1, marginBottom: 1, width: '100%' }}
                      multiline
                      minRows={2}
                      margin="dense"
                    />
                  )}
                />

                {/* TODO: uncomment when insurance settings will be applied to patient paperwork step with filling insurance data */}
                {/* <Controller
                  name={ENABLE_ELIGIBILITY_CHECK_KEY}
                  control={control}
                  render={({ field: { onChange, value } }) => (
                    <FormControlLabel
                      sx={{ width: '100%' }}
                      value={value}
                      checked={value}
                      control={<Switch checked={value || false} onChange={onChange} />}
                      label={INSURANCE_SETTINGS_MAP[ENABLE_ELIGIBILITY_CHECK_KEY]}
                    />
                  )}
                ></Controller> */}
                {/* {INSURANCE_SETTINGS_CHECKBOXES.map((settingName) => {
                  const name = settingName as keyof typeof INSURANCE_SETTINGS_MAP;
                  return (
                    <Controller
                      key={name}
                      name={name}
                      control={control}
                      render={({ field: { onChange, value } }) => (
                        <FormControlLabel
                          sx={{ width: '100%' }}
                          value={value}
                          disabled={INSURANCE_SETTINGS_DEFAULTS[name] === true}
                          checked={value}
                          control={<Checkbox onChange={onChange}></Checkbox>}
                          label={INSURANCE_SETTINGS_MAP[name]}
                        />
                      )}
                    ></Controller>
                  );
                })} */}
                {error && (
                  <Box color="error.main" width="100%" marginTop={2}>
                    {error}
                  </Box>
                )}
                <LoadingButton
                  variant="contained"
                  color="primary"
                  loading={mutationPending}
                  sx={{
                    textTransform: 'none',
                    borderRadius: 28,
                    marginTop: 3,
                    fontWeight: 'bold',
                    marginRight: 1,
                  }}
                  type="submit"
                  disabled={false}
                >
                  Save changes
                </LoadingButton>
                <Link to={`${BILLING_URL}/insurance`}>
                  <Button
                    variant="text"
                    color="primary"
                    sx={{
                      textTransform: 'none',
                      borderRadius: 28,
                      marginTop: 3,
                      fontWeight: 'bold',
                    }}
                  >
                    Cancel
                  </Button>
                </Link>
              </form>
            </Paper>
          )}
          {isNew ? (
            <></>
          ) : (
            <Paper sx={{ padding: 3, marginTop: 3 }}>
              <Typography variant="h4" color="primary.dark" sx={{ fontWeight: '600 !important' }}>
                Applicable Fee Schedule
              </Typography>
              <Typography variant="body1" marginTop={1}>
                The most recent fee schedule associated with this payer with an effective date on or before today.
              </Typography>
              {feeSchedulesFetching ? (
                <Skeleton height={80} sx={{ marginTop: -1 }} />
              ) : !applicableFeeSchedule ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  No applicable fee schedule found for this insurance.
                </Typography>
              ) : (
                <Box
                  sx={{
                    mt: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: 1.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                  }}
                >
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {applicableFeeSchedule.title}
                      </Typography>
                      {applicableFeeSchedule.meta?.tag?.some(
                        (t) => t.system === RCM_TAG_SYSTEM && t.code === CASE_RATE_CODE
                      ) ? (
                        <Chip
                          label="Case Rate"
                          size="small"
                          sx={{
                            fontSize: '0.65rem',
                            height: 20,
                            backgroundColor: '#E65100',
                            color: '#fff',
                          }}
                        />
                      ) : (
                        <Chip
                          label="Fee-for-Service"
                          size="small"
                          variant="outlined"
                          sx={{
                            fontSize: '0.65rem',
                            height: 20,
                            borderColor: '#2E7D32',
                            color: '#2E7D32',
                          }}
                        />
                      )}
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      Effective: {applicableFeeSchedule.date ?? 'N/A'} ·{' '}
                      {applicableFeeSchedule.propertyGroup?.length ?? 0} procedure codes
                    </Typography>
                  </Box>
                  <Link to={`${FEE_SCHEDULES_URL}/${applicableFeeSchedule.id}`}>
                    <Button size="small" sx={{ textTransform: 'none' }}>
                      View
                    </Button>
                  </Link>
                </Box>
              )}
            </Paper>
          )}
          {isNew ? (
            <></>
          ) : (
            <Paper sx={{ padding: 3, marginTop: 3 }}>
              <Typography variant="h4" color="primary.dark" sx={{ fontWeight: '600 !important' }}>
                Applicable Charge Master
              </Typography>
              <Typography variant="body1" marginTop={1}>
                The most recent charge master applicable to this payer, resolved by payer association then designation
                fallback.
              </Typography>
              {chargeMastersFetching ? (
                <Skeleton height={80} sx={{ marginTop: -1 }} />
              ) : !applicableChargeMaster.chargeMaster ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  No applicable charge master found for this insurance.
                </Typography>
              ) : (
                <Box
                  sx={{
                    mt: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: 1.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                  }}
                >
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {applicableChargeMaster.chargeMaster.title}
                      </Typography>
                      <Chip
                        label={
                          applicableChargeMaster.source === 'payer-specific'
                            ? 'Payer-Specific'
                            : applicableChargeMaster.source === 'default-insurance'
                            ? 'Default Insurance'
                            : 'Self-Pay'
                        }
                        size="small"
                        sx={{
                          fontSize: '0.65rem',
                          height: 20,
                          ...(applicableChargeMaster.source === 'payer-specific'
                            ? {}
                            : applicableChargeMaster.source === 'default-insurance'
                            ? { backgroundColor: '#6A1B9A', color: '#fff' }
                            : { backgroundColor: '#E91E90', color: '#fff' }),
                        }}
                        {...(applicableChargeMaster.source === 'payer-specific'
                          ? { color: 'primary', variant: 'outlined' }
                          : {})}
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      Effective: {applicableChargeMaster.chargeMaster.date ?? 'N/A'} ·{' '}
                      {applicableChargeMaster.chargeMaster.propertyGroup?.length ?? 0} procedure codes
                    </Typography>
                  </Box>
                  <Link to={`${CHARGE_MASTERS_URL}/${applicableChargeMaster.chargeMaster.id}`}>
                    <Button size="small" sx={{ textTransform: 'none' }}>
                      View
                    </Button>
                  </Link>
                </Box>
              )}
            </Paper>
          )}
        </Grid>
      </Grid>
    </PageContainer>
  );
}
