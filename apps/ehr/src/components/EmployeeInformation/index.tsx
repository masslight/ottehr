import { LoadingButton } from '@mui/lab';
import { Button, Grid, Paper, Skeleton, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { enqueueSnackbar } from 'notistack';
import { updateUser } from '../../api/api';
import { useApiClients } from '../../hooks/useAppClients';
import { BasicInformation } from './BasicInformation';
import { RoleSelection } from './RoleSelection';
import { ProviderDetails } from './ProviderDetails';
import { ProviderQualifications } from './ProviderQualifications';
import {
  User,
  PractitionerLicense,
  FHIR_IDENTIFIER_NPI,
  RoleType,
  PractitionerQualificationCode,
  isPhoneNumberValid,
  isNPIValid,
} from 'utils';
import { EditEmployeeInformationProps, EmployeeForm } from './types';
import { dataTestIds } from '../../constants/data-test-ids';

export default function EmployeeInformationForm({
  submitLabel,
  existingUser,
  isActive,
  licenses,
}: EditEmployeeInformationProps): JSX.Element {
  const { oystehrZambda } = useApiClients();
  const [loading, setLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState({
    submit: false,
    roles: false,
    qualification: false,
    state: false,
    duplicateLicense: false,
    npi: false,
    phoneNumber: false,
  });

  const [newLicenses, setNewLicenses] = useState<PractitionerLicense[]>(licenses);

  const [user, setUser] = useState<User>({
    name: '',
    email: '',
    id: '',
    profile: '',
    accessPolicy: { rule: [] },
    authenticationMethod: 'email',
    roles: [],
    phoneNumber: '',
    profileResource: undefined,
  });

  let photoSrc = '';
  if (existingUser?.profileResource?.photo) {
    const photo = existingUser.profileResource.photo[0];
    if (photo.url) {
      photoSrc = photo.url;
    } else if (photo.data) {
      photoSrc = `data:${photo.contentType};base64,${photo.data}`;
    }
  }

  const { control, handleSubmit, setValue, getValues } = useForm<EmployeeForm>();

  useWatch({ control, name: 'roles' });

  useEffect(() => {
    if (existingUser) {
      setUser(existingUser);
      setValue('roles', (existingUser as User).roles?.map((role) => role.name) || []);

      let firstName = '';
      let middleName = '';
      let lastName = '';
      let nameSuffix = '';
      if (existingUser.profileResource?.name && existingUser.profileResource?.name.length > 0) {
        const name = existingUser.profileResource?.name[0];
        firstName = name.given?.[0] ?? '';
        middleName = name.given?.length && name.given.length > 1 ? name.given.slice(1).join(' ') : '';
        lastName = name.family ?? '';
        nameSuffix = name.suffix?.join(' ') ?? '';
      }
      setValue('firstName', firstName);
      setValue('middleName', middleName);
      setValue('lastName', lastName);
      setValue('nameSuffix', nameSuffix);

      let phoneText = '';
      if (existingUser?.profileResource?.telecom) {
        const phone = existingUser.profileResource.telecom.find((tel) => tel.system === 'sms')?.value;
        if (phone) {
          phoneText = phone;
        }
      }
      setValue('phoneNumber', phoneText);

      let npiText = 'n/a';
      if (existingUser?.profileResource?.identifier) {
        const npi = existingUser.profileResource.identifier.find(
          (identifier) => identifier.system === FHIR_IDENTIFIER_NPI
        );
        if (npi && npi.value) {
          npiText = npi.value;
        }
      }
      setValue('npi', npiText);
    }
  }, [existingUser, setValue]);

  const isProviderRoleSelected = getValues('roles')?.includes(RoleType.Provider) ?? false;

  const updateUserRequest = async (data: EmployeeForm): Promise<void> => {
    console.log('updateUserRequest');
    if (!oystehrZambda) {
      throw new Error('Zambda Client not found');
    }

    if (data.roles.length < 1) {
      setErrors((prev) => ({ ...prev, submit: false, roles: true }));
      return;
    } else {
      setErrors((prev) => ({ ...prev, ...{ roles: false } }));
    }

    if (!isPhoneNumberValid(data.phoneNumber)) {
      setErrors((prev) => ({ ...prev, phoneNumber: true }));
      return;
    } else {
      setErrors((prev) => ({ ...prev, phoneNumber: false }));
    }

    if (!isNPIValid(data.npi)) {
      setErrors((prev) => ({ ...prev, npi: true }));
      return;
    } else {
      setErrors((prev) => ({ ...prev, npi: false }));
    }

    setLoading(true);

    try {
      await updateUser(oystehrZambda, {
        userId: user.id,
        firstName: data.firstName,
        middleName: data.middleName,
        lastName: data.lastName,
        nameSuffix: data.nameSuffix,
        selectedRoles: data.roles,
        licenses: newLicenses,
        phoneNumber: data.phoneNumber,
        npi: data.npi,
      });
      enqueueSnackbar(`User ${data.firstName} ${data.lastName} was updated successfully`, {
        variant: 'success',
        key: dataTestIds.employeesPage.snackbarSuccessKey,
      });
    } catch (error) {
      console.log(`Failed to update user: ${error}`);
      enqueueSnackbar('An error has occurred while updating user. Please try again.', {
        variant: 'error',
      });
      setErrors((prev) => ({ ...prev, submit: true }));
    } finally {
      setLoading(false);
    }
  };

  const handleAddLicense = async (): Promise<void> => {
    setErrors((prev) => ({ ...prev, state: false, qualification: false, duplicateLicense: false }));

    const formValues = getValues();

    if (
      newLicenses.find(
        (license) => license.state === formValues.newLicenseState && license.code === formValues.newLicenseCode
      )
    ) {
      setErrors((prev) => ({ ...prev, duplicateLicense: true }));
      return;
    }
    if (!formValues.newLicenseCode || !formValues.newLicenseState) {
      setErrors((prev) => ({
        ...prev,
        qualification: !formValues.newLicenseCode,
        state: !formValues.newLicenseState,
      }));
      return;
    }
    const updatedLicenses = [...newLicenses];
    updatedLicenses.push({
      state: formValues.newLicenseState,
      code: formValues.newLicenseCode as PractitionerQualificationCode,
      active: true,
    });
    setNewLicenses(updatedLicenses);
    setValue('newLicenseState', undefined);
    setValue('newLicenseCode', undefined);
  };

  return isActive === undefined ? (
    <Skeleton height={300} sx={{ marginY: -5 }} />
  ) : (
    <Paper sx={{ padding: 3 }}>
      <form onSubmit={handleSubmit(updateUserRequest)} data-testid={dataTestIds.employeesPage.informationForm}>
        <BasicInformation control={control} existingUser={existingUser} errors={errors} />

        <RoleSelection
          control={control}
          errors={errors}
          isActive={isActive}
          getValues={getValues}
          setValue={setValue}
        />

        {isProviderRoleSelected && (
          <>
            <ProviderDetails control={control} photoSrc={photoSrc} errors={errors} />

            <ProviderQualifications
              newLicenses={newLicenses}
              setNewLicenses={setNewLicenses}
              control={control}
              errors={errors}
              handleAddLicense={handleAddLicense}
            />
          </>
        )}

        {errors.submit && (
          <Typography color="error" variant="body2" mt={1}>
            Failed to update user. Please try again.
          </Typography>
        )}

        <Grid sx={{ marginTop: 4, marginBottom: 2 }}>
          <LoadingButton
            variant="contained"
            color="primary"
            data-testid={dataTestIds.employeesPage.submitButton}
            sx={{
              textTransform: 'none',
              borderRadius: 28,
              fontWeight: 'bold',
              marginRight: 1,
            }}
            type="submit"
            loading={loading}
            disabled={!isActive}
          >
            {submitLabel}
          </LoadingButton>

          <Link to="/employees">
            <Button
              variant="text"
              color="primary"
              sx={{
                textTransform: 'none',
                borderRadius: 28,
                fontWeight: 'bold',
              }}
            >
              Cancel
            </Button>
          </Link>
        </Grid>
      </form>
    </Paper>
  );
}
