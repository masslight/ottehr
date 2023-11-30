import { t } from 'i18next';
import { CustomContainer, LoadingSpinner, ProviderFields } from '../components';
import { useForm } from 'react-hook-form';
import { usePractitioner } from '../store/Context';
import { FormData } from '../store/types';
import { createProviderName } from '../helpers';
import { updateProvider } from '../api';
import { useEffect, useState } from 'react';
import { Alert, Snackbar } from '@mui/material';

export const Profile = (): JSX.Element => {
  const { provider, practitionerProfile } = usePractitioner();
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
    mode: 'onChange',
  });

  useEffect(() => {
    reset({
      ...provider,
    });
  }, [provider, reset]);

  const onSubmit = (data: FormData): void => {
    const input = {
      data: data,
      practitionerId: practitionerProfile?.id,
    };
    updateProvider(input).catch((error) => {
      console.log(error);
      setOpenSnackbar(true);
    });
  };

  const handleCloseSnackbar = (): void => {
    setOpenSnackbar(false);
  };

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
