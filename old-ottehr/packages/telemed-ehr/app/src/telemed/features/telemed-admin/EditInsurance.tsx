import { LoadingButton } from '@mui/lab';
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  FormLabel,
  Grid,
  Paper,
  Skeleton,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { InsurancePlan } from 'fhir/r4';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PUBLIC_EXTENSION_BASE_URL } from 'ehr-utils';
import { INSURANCES_PATH } from '../../../App';
import CustomBreadcrumbs from '../../../components/CustomBreadcrumbs';
import PageContainer from '../../../layout/PageContainer';
import { useInsuranceMutation, useInsuranceOrganizationsQuery, useInsurancesQuery } from './telemed-admin.queries';

export const INSURANCE_SETTINGS_MAP = {
  requiresSubscriberId: 'Requires subscriber Id',
  requiresSubscriberName: 'Requires subscriber name',
  requiresSubscriberDOB: 'Requires subscriber date of birth',
  requiresRelationshipToSubscriber: 'Requires relationship to subscriber',
  requiresInsuranceName: 'Requires insurance name',
  requiresInsuranceCardImage: 'Requires insurance card image',
};

type InsuranceSettingsBooleans = {
  [key in keyof typeof INSURANCE_SETTINGS_MAP]: boolean;
};

interface PayorOrg {
  name?: string;
  id?: string;
}

export type InsuranceData = InsuranceSettingsBooleans & {
  id: InsurancePlan['id'];
  payor?: PayorOrg;
  displayName: string;
  status: Extract<InsurancePlan['status'], 'active' | 'retired'>;
};

type InsuranceForm = Omit<InsuranceData, 'id' | 'status'>;

function getInsurancePayor(insuranceDetails: InsurancePlan, orgs: PayorOrg[]): PayorOrg | undefined {
  if (!insuranceDetails.ownedBy?.reference) {
    return undefined;
  }
  return orgs.find((org) => org.id === insuranceDetails.ownedBy?.reference?.replace('Organization/', ''));
}

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
      requiresSubscriberId: false,
      requiresSubscriberName: false,
      requiresSubscriberDOB: false,
      requiresRelationshipToSubscriber: false,
      requiresInsuranceName: false,
      requiresInsuranceCardImage: false,
    },
  });

  const {
    data: insuranceData,
    isFetching: insuranceDataLoading,
    refetch: refetchInsuranceData,
  } = useInsurancesQuery(insuranceId, insuranceId !== undefined);
  const insuranceDetails = isNew ? undefined : insuranceData?.[0];
  const isActive = insuranceDetails?.status === 'active';

  const { isFetching: insuranceOrgsFetching, data: insuranceOrgsData } = useInsuranceOrganizationsQuery();
  const insurancePayorOrgs: PayorOrg[] = insuranceOrgsData?.map((org) => ({ name: org.name, id: org.id })) || [
    { id: '', name: '' },
  ];

  const insuranceRelatedDataFetching = insuranceDataLoading || insuranceOrgsFetching;

  const insurancePayor =
    insuranceId && insuranceDetails && insurancePayorOrgs
      ? getInsurancePayor(insuranceDetails, insurancePayorOrgs)
      : undefined;

  const [payerNameInputValue, setPayerNameInputValue] = useState('');

  const settingsMap = Object.fromEntries(
    Object.entries(INSURANCE_SETTINGS_MAP).map(([key, _]) => [key as keyof typeof INSURANCE_SETTINGS_MAP, false]),
  ) as InsuranceSettingsBooleans;

  insuranceDetails?.extension
    ?.find((ext) => ext.url === `${PUBLIC_EXTENSION_BASE_URL}/insurance-requirements`)
    ?.extension?.forEach((settingExt) => {
      settingsMap[settingExt.url as keyof typeof INSURANCE_SETTINGS_MAP] = settingExt.valueBoolean || false;
    });

  if (insuranceDetails && insuranceOrgsData && !didSetInsuranceDetailsForm.current) {
    reset({
      payor: insurancePayor,
      displayName: insuranceDetails.name,
      ...settingsMap,
    });
    didSetInsuranceDetailsForm.current = true;
  }

  const { mutateAsync: mutateInsurance, isLoading: mutationPending } = useInsuranceMutation(insuranceId);

  const onSubmit = async (event: any): Promise<void> => {
    setError('');
    event.preventDefault();
    const formData = getValues();
    const data: InsuranceData = {
      id: insuranceId,
      status: insuranceDetails?.status === 'active' ? 'active' : 'retired',
      ...formData,
    };
    try {
      await mutateInsurance(data);
      navigate(INSURANCES_PATH);
    } catch {
      setError('Error trying to save insurance configuration. Please, try again');
    }
  };

  const handleStatusChange = async (newStatus: InsuranceData['status']): Promise<void> => {
    try {
      await mutateInsurance({
        id: insuranceId,
        payor: insurancePayor!,
        displayName: insuranceDetails!.name || '',
        ...settingsMap,
        status: newStatus,
      });
      await refetchInsuranceData();
    } catch {
      setError('Error trying to change insurance configuration status. Please, try again');
    }
  };

  return (
    <PageContainer tabTitle={'Edit State'}>
      <Grid container direction="row" alignItems="center" justifyContent="center">
        <Grid item maxWidth={'584px'} width={'100%'}>
          <CustomBreadcrumbs
            chain={[
              { link: INSURANCES_PATH, children: 'Insurance' },
              {
                link: '#',
                children: isNew ? (
                  'New insurance'
                ) : insuranceRelatedDataFetching ? (
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
            {insuranceRelatedDataFetching ? <Skeleton width={250} /> : insuranceDetails?.name || isNew ? 'New' : ''}
          </Typography>
          {insuranceId && insuranceRelatedDataFetching ? (
            <Skeleton height={550} sx={{ marginY: -5 }} />
          ) : (
            <Paper sx={{ padding: 3 }}>
              {/* Breadcrumbs */}

              <form onSubmit={onSubmit}>
                <FormLabel
                  sx={{
                    ...theme.typography.h4,
                    color: theme.palette.primary.main,
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
                  render={({ field: { onChange, value, disabled } }) => {
                    return (
                      <Autocomplete
                        value={value}
                        disabled={disabled || insuranceOrgsFetching}
                        getOptionLabel={(option) => option.name || ''}
                        loading={insuranceOrgsFetching}
                        isOptionEqualToValue={(option, value) => {
                          return option.id === value.id;
                        }}
                        onChange={(_, newValue) => {
                          onChange(newValue);
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

                {Object.keys(INSURANCE_SETTINGS_MAP).map((settingName) => {
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
                          checked={value}
                          control={<Checkbox onChange={onChange}></Checkbox>}
                          label={INSURANCE_SETTINGS_MAP[name]}
                        />
                      )}
                    ></Controller>
                  );
                })}

                {error && (
                  <Box color="error.main" width="100%" marginTop={2}>
                    {error}
                  </Box>
                )}

                <LoadingButton
                  variant="contained"
                  color="secondary"
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

                <Link to={INSURANCES_PATH}>
                  <Button
                    variant="text"
                    color="secondary"
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
            (insuranceRelatedDataFetching ? (
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
                  onClick={() => handleStatusChange(isActive ? 'retired' : 'active')}
                >
                  {isActive ? 'Deactivate' : 'Activate'}
                </LoadingButton>
              </Paper>
            ))}
        </Grid>
      </Grid>
    </PageContainer>
  );
}
