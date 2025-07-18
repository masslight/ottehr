import { LoadingButton } from '@mui/lab';
import { Button, Grid, Paper, Skeleton, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { FHIR_IDENTIFIER_NPI, PractitionerLicense, PractitionerQualificationCode, RoleType, User } from 'utils';
import { updateUser } from '../../api/api';
import { dataTestIds } from '../../constants/data-test-ids';
import { useApiClients } from '../../hooks/useAppClients';
import useEvolveUser from '../../hooks/useEvolveUser';
import { BasicInformation } from './BasicInformation';
import { ProviderDetails } from './ProviderDetails';
import { ProviderQualifications } from './ProviderQualifications';
import { RoleSelection } from './RoleSelection';
import { EditEmployeeInformationProps, EmployeeForm } from './types';

export default function EmployeeInformationForm({
  submitLabel,
  existingUser,
  isActive,
  licenses,
  getUserAndUpdatePage,
}: EditEmployeeInformationProps): JSX.Element {
  const { oystehrZambda } = useApiClients();
  const evolveUser = useEvolveUser();
  const [loading, setLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState({
    submit: false,
    roles: false,
    qualification: false,
    state: false,
    number: false,
    date: false,
    duplicateLicense: false,
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
    faxNumber: '',
    addressLine1: '',
    addressLine2: '',
    addressCity: '',
    addressState: '',
    addressZip: '',
    birthDate: '',
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

  const {
    control,
    handleSubmit,
    setValue,
    getValues,
    setError,
    formState: { errors: formErrors },
  } = useForm<EmployeeForm>();

  useWatch({ control, name: 'roles' });

  const scrollToFirstError = (): void => {
    const firstErrorElement = document.querySelector('.Mui-error');
    if (firstErrorElement) {
      firstErrorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  useEffect(() => {
    if (Object.keys(formErrors).length > 0) {
      scrollToFirstError();
    }
  }, [formErrors]);

  console.log(5, formErrors);

  useEffect(() => {
    if (existingUser) {
      setUser(existingUser);
      setValue('roles', (existingUser as User).roles?.map((role) => role.name as RoleType) || []);

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

      if (existingUser?.profileResource?.telecom) {
        const phone = existingUser.profileResource.telecom.find((tel) => tel.system === 'phone')?.value;
        if (phone) {
          setValue('phoneNumber', phone || '');
        }
      }

      if (existingUser?.profileResource?.telecom) {
        const fax = existingUser.profileResource.telecom.find((tel) => tel.system === 'fax')?.value;
        if (fax) {
          setValue('faxNumber', fax || '');
        }
      }

      if (existingUser?.profileResource?.birthDate) {
        setValue('birthDate', DateTime.fromISO(existingUser.profileResource.birthDate) || '');
      }

      if (existingUser?.profileResource?.address) {
        const address = existingUser.profileResource.address[0];
        if (address) {
          setValue('addressLine1', address.line?.[0] ?? '');
          setValue('addressLine2', address.line?.[1] ?? '');
          setValue('addressCity', address.city ?? '');
          setValue('addressState', address.state ?? '');
          setValue('addressZip', address.postalCode ?? '');
        }
      }

      if (existingUser?.profileResource?.identifier) {
        const npi = existingUser.profileResource.identifier.find(
          (identifier) => identifier.system === FHIR_IDENTIFIER_NPI
        );
        if (npi && npi.value) {
          setValue('npi', npi.value || 'n/a');
        }
      }
    }
  }, [existingUser, setValue]);

  const isProviderRoleSelected = getValues('roles')?.includes(RoleType.Provider) ?? false;

  const updateUserRequest = async (data: EmployeeForm): Promise<void> => {
    console.log('updateUserRequest');
    if (!oystehrZambda) {
      throw new Error('Zambda Client not found');
    }
    let isError = false;

    if (data.roles.length < 1) {
      setError('roles', { message: 'Roles are required' });
      isError = true;
    }

    if (data.addressLine2 && !data.addressLine1) {
      setError('addressLine2', { message: 'Address line 2 cannot be filled without address line 1' });
      isError = true;
    }

    if (isError) {
      scrollToFirstError();
      return;
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
        birthDate: data.birthDate ? data.birthDate.toISODate() || '' : undefined,
        faxNumber: data.faxNumber,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2,
        addressCity: data.addressCity,
        addressState: data.addressState,
        addressZip: data.addressZip,
      });
      await getUserAndUpdatePage();
      const successMessage = `User ${data.firstName} ${data.lastName} was updated successfully.`;
      if (evolveUser?.id === user.id) {
        enqueueSnackbar(`${successMessage} The page will be refreshed in 3 seconds.`, {
          variant: 'success',
        });
        // wait 3 seconds for the snackbar to be seen before reloading
        await new Promise((resolve) => setTimeout(resolve, 3000));
        window.location.reload();
      }
      enqueueSnackbar(successMessage, { variant: 'success' });
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
    setErrors((prev) => ({
      ...prev,
      state: false,
      qualification: false,
      number: false,
      date: false,
      duplicateLicense: false,
    }));

    const formValues = getValues();

    if (
      newLicenses.find(
        (license) => license.state === formValues.newLicenseState && license.code === formValues.newLicenseCode
      )
    ) {
      setErrors((prev) => ({ ...prev, duplicateLicense: true }));
      return;
    }
    if (
      !formValues.newLicenseCode ||
      !formValues.newLicenseState ||
      !formValues.newLicenseNumber ||
      !formValues.newLicenseExpirationDate
    ) {
      setErrors((prev) => ({
        ...prev,
        qualification: !formValues.newLicenseCode,
        state: !formValues.newLicenseState,
        number: !formValues.newLicenseNumber,
        date: !formValues.newLicenseExpirationDate,
      }));
      return;
    }

    const updatedLicenses = [...newLicenses];
    updatedLicenses.push({
      state: formValues.newLicenseState,
      code: formValues.newLicenseCode as PractitionerQualificationCode,
      number: formValues.newLicenseNumber,
      date: formValues.newLicenseExpirationDate.toISODate() || undefined,
      active: true,
    });
    setNewLicenses(updatedLicenses);
    setValue('newLicenseState', undefined);
    setValue('newLicenseCode', undefined);
    setValue('newLicenseNumber', undefined);
    setValue('newLicenseExpirationDate', undefined);
  };

  return isActive === undefined ? (
    <Skeleton height={300} sx={{ marginY: -5 }} />
  ) : (
    <Paper sx={{ padding: 3 }}>
      <form onSubmit={handleSubmit(updateUserRequest)} data-testid={dataTestIds.employeesPage.informationForm}>
        <BasicInformation control={control} existingUser={existingUser} errors={errors} isActive={isActive} />

        <RoleSelection
          control={control}
          errors={errors}
          isActive={isActive}
          getValues={getValues}
          setValue={setValue}
        />

        {isProviderRoleSelected && (
          <>
            <ProviderDetails control={control} photoSrc={photoSrc} roles={getValues('roles')} />

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
              type="submit"
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
