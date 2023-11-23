import { t } from 'i18next';
import { CustomContainer, LoadingSpinner, ProviderFields } from '../components';
import { useForm } from 'react-hook-form';
import { usePractitioner } from '../store/Context';
import { FormData } from './Register';
import { createProviderName } from '../helpers';
import { Operation } from 'fast-json-patch';
import { updateProvider } from '../api';
import { useAuth0 } from '@auth0/auth0-react';
import { useEffect, useState } from 'react';
import { Alert, Snackbar } from '@mui/material';

export const Profile = (): JSX.Element => {
  const { getAccessTokenSilently } = useAuth0();
  const { provider, practitionerProfile } = usePractitioner();
  const providerPatchOps: Operation[] = [];
  const [openSnackbar, setOpenSnackbar] = useState(false);

  const {
    control,
    formState: { errors },
    handleSubmit,
    reset,
  } = useForm<FormData>({
    defaultValues: {
      email: '',
      firstName: '',
      lastName: '',
      slug: '',
      title: '',
    },
  });

  useEffect(() => {
    reset({
      ...provider,
      title: provider?.title?.toLowerCase(),
    });
  }, [provider, reset]);

  const onSubmit = (data: FormData): void => {
    updatePractitioner(data)
      .then(() => {
        window.location.reload();
      })
      .catch((error) => {
        console.log(error);
        setOpenSnackbar(true);
      });
  };

  const handleCloseSnackbar = (): void => {
    setOpenSnackbar(false);
  };

  async function updatePractitioner(data: FormData): Promise<void> {
    const accessToken = await getAccessTokenSilently();
    providerPatchOps.push(
      {
        op: practitionerProfile?.identifier?.[0].value ? 'replace' : 'add',
        path: '/identifier/0/value',
        value: data.slug,
      },
      {
        op: practitionerProfile?.name?.[0].given?.[0] ? 'replace' : 'add',
        path: '/name/0/given/0',
        value: data.firstName,
      },
      {
        op: practitionerProfile?.name?.[0].family ? 'replace' : 'add',
        path: '/name/0/family',
        value: data.lastName,
      },
      {
        op: practitionerProfile?.name?.[0].prefix?.[0] ? 'replace' : 'add',
        path: '/name/0/prefix/0',
        value: data.title,
      }
    );

    updateProvider(accessToken, practitionerProfile?.id || '', providerPatchOps).catch((error) => {
      console.log(error);
    });
  }

  if (!provider) {
    return <LoadingSpinner transparent={false} />;
  }

  return (
    <CustomContainer isProvider={true} subtitle={createProviderName(provider)} title={t('profile.myProfile')}>
      <ProviderFields
        buttonText={t('profile.update')}
        control={control}
        errors={errors}
        onSubmit={handleSubmit(onSubmit)}
      />
      <Snackbar autoHideDuration={6000} onClose={handleCloseSnackbar} open={openSnackbar}>
        <Alert onClose={handleCloseSnackbar} severity="error" sx={{ width: '100%' }}>
          {t('errors.updateUserError')}
        </Alert>
      </Snackbar>
    </CustomContainer>
  );
};
