import { LoadingButton } from '@mui/lab';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  FormLabel,
  Grid,
  Paper,
  Skeleton,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { Address, ChargeItemDefinition, Identifier, Organization } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BILLING_URL, CHARGE_MASTERS_URL, FEE_SCHEDULES_URL, INSURANCES_URL } from 'src/App';
import CustomBreadcrumbs from 'src/components/CustomBreadcrumbs';
import PageContainer from 'src/layout/PageContainer';
import { useListChargeMastersQuery } from 'src/rcm/state/charge-masters/charge-master.queries';
import { useListFeeSchedulesQuery } from 'src/rcm/state/fee-schedules/fee-schedule.queries';
import { CASE_RATE_CODE, FHIR_EXTENSION, INSURANCE_SETTINGS_MAP, RCM_TAG_SYSTEM } from 'utils';
import { useInsuranceMutation, useInsuranceOrganizationsQuery, useInsurancesQuery } from './admin.queries';

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
  identifier?: Identifier[];
  address?: Address[];
  notes?: string;
};

type InsuranceForm = Omit<InsuranceData, 'id' | 'active'>;

export default function EditInsurance(): JSX.Element {
  const theme = useTheme();
  const navigate = useNavigate();
  const { insurance: insuranceIdParam } = useParams();
  const isNew = insuranceIdParam === 'new';
  const insuranceId = isNew ? undefined : insuranceIdParam;
  const [error, setError] = useState('');
  const didSetInsuranceDetailsForm = useRef(false);

  const { control, getValues, reset } = useForm<InsuranceForm>({
    defaultValues: {
      payor: undefined,
      displayName: '',

      // TODO: uncomment when insurance settings will be applied to patient paperwork step with filling insurance data
      // ...INSURANCE_SETTINGS_DEFAULTS,
    },
  });

  const { isFetching: insuranceOrgsFetching, data: insuranceOrgsData } = useInsuranceOrganizationsQuery();
  const insurancePayorOrgs: PayorOrg[] = insuranceOrgsData?.map((org) => ({ name: org.name, id: org.id })) || [
    { id: '', name: '' },
  ];

  const {
    data: insuranceData,
    isFetching: insuranceDataLoading,
    refetch: refetchInsuranceData,
  } = useInsurancesQuery(insuranceId, insuranceId !== undefined);
  const insuranceDetails = isNew ? undefined : insuranceData?.[0];
  const isActive = insuranceDetails?.active ?? true;

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

  if (insuranceDetails && !didSetInsuranceDetailsForm.current) {
    const alias = insuranceDetails.alias?.[0];

    reset({
      payor: insuranceDetails,
      displayName: alias || insuranceDetails.name,
      notes: insuranceDetails.extension?.find((ext) => ext.url === FHIR_EXTENSION.InsurancePlan.notes.url)?.valueString,
      // TODO: uncomment when insurance settings will be applied to patient paperwork step with filling insurance data
      // ...settingsMap,
    });
    didSetInsuranceDetailsForm.current = true;
  }

  const { mutateAsync: mutateInsurance, isPending: mutationPending } = useInsuranceMutation(insuranceDetails);

  const onSubmit = async (event: any): Promise<void> => {
    setError('');
    event.preventDefault();
    const formData = getValues();
    const insurance = insuranceOrgsData?.find((org) => org.id === formData.payor?.id);
    const data: InsuranceData = {
      id: insuranceId,
      active: insuranceDetails?.active ?? true,
      ...formData,
      identifier: insurance?.identifier,
      address: insurance?.address,
    };
    const submitSnackbarText = isNew
      ? `${data.displayName} was successfully created`
      : `${data.displayName} was updated successfully`;

    try {
      const mutateResp = await mutateInsurance(data);
      enqueueSnackbar(`${submitSnackbarText}`, {
        variant: 'success',
      });
      const mutateInsuranceId = mutateResp.id ? mutateResp.id : '';
      navigate(INSURANCES_URL + `/${mutateInsuranceId}`);
    } catch {
      const submitErrorString = 'Error trying to save insurance configuration. Please, try again';
      setError(`${submitErrorString}`);
      enqueueSnackbar(`${submitErrorString}`, {
        variant: 'error',
      });
    }
  };

  const handleStatusChange = async (newStatus: InsuranceData['active']): Promise<void> => {
    try {
      await mutateInsurance({
        id: insuranceId,
        payor: insuranceDetails,
        displayName: insuranceDetails?.alias?.[0] || insuranceDetails?.name || '',
        ...settingsMap,
        active: newStatus,
      });
      await refetchInsuranceData();
      enqueueSnackbar(`${insuranceDetails!.name || 'Insurance'} status was updated successfully`, {
        variant: 'success',
      });
    } catch {
      const statusErrorString = 'Error trying to change insurance configuration status. Please, try again';
      setError(`${statusErrorString}`);
      enqueueSnackbar(`${statusErrorString}`, {
        variant: 'error',
      });
    }
  };

  return (
    <PageContainer tabTitle={'Edit State'}>
      <Grid container direction="row" alignItems="center" justifyContent="center">
        <Grid item maxWidth={'584px'} width={'100%'}>
          <CustomBreadcrumbs
            chain={[
              { link: '/admin', children: 'Admin' },
              { link: BILLING_URL, children: 'Billing Configuration' },
              { link: `${BILLING_URL}/insurance`, children: 'Insurance' },
              {
                link: '#',
                children: isNew ? (
                  'New insurance'
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
            {insuranceDataLoading ? <Skeleton width={250} /> : insuranceDetails?.name || (isNew ? 'New' : '')}
          </Typography>
          {insuranceId && insuranceDataLoading ? (
            <Skeleton height={550} sx={{ marginY: -5 }} />
          ) : (
            <Paper sx={{ padding: 3 }}>
              {/* Breadcrumbs */}

              <form onSubmit={onSubmit}>
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
                        disabled={insuranceOrgsFetching}
                        getOptionLabel={(option) => option.name || ''}
                        loading={insuranceOrgsFetching}
                        isOptionEqualToValue={(option, value) => {
                          return option.id === value.id;
                        }}
                        onChange={(_, newValue) => {
                          onChange(newValue as PayorOrg);
                        }}
                        inputValue={payerNameInputValue}
                        onInputChange={(_, newValue) => setPayerNameInputValue(newValue)}
                        options={insurancePayorOrgs}
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
                  name="displayName"
                  control={control}
                  render={({ field: { onChange, value } }) => (
                    <TextField
                      id="outlined-read-only-input"
                      label="Display name"
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
          {insuranceId !== 'new' &&
            (insuranceDataLoading ? (
              <Skeleton height={300} sx={{ marginTop: -8 }} />
            ) : (
              <Paper sx={{ padding: 3, marginTop: 3 }}>
                <Typography variant="h4" color="primary.dark" sx={{ fontWeight: '600 !important' }}>
                  {isActive ? 'Deactivate insurance' : 'Activate insurance'}
                </Typography>
                <Typography variant="body1" marginTop={1}>
                  {isActive
                    ? 'When you deactivate this insurance, patients will not be able to select it.'
                    : 'Activate this license.'}
                </Typography>

                <LoadingButton
                  variant="contained"
                  color={isActive ? 'error' : 'primary'}
                  sx={{
                    textTransform: 'none',
                    borderRadius: 28,
                    marginTop: 4,
                    fontWeight: 'bold',
                    marginRight: 1,
                  }}
                  loading={mutationPending}
                  onClick={() => handleStatusChange(!isActive)}
                >
                  {isActive ? 'Deactivate' : 'Activate'}
                </LoadingButton>
              </Paper>
            ))}
          {!isNew && (
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
          {!isNew && (
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
