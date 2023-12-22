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
  const { provider, setUserProfile } = usePractitioner();
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

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
    setIsLoading(true);
    const input = {
      data: data,
      practitionerId: provider?.id,
    };
    updateProvider(input)
      .then(() => {
        setUpdateSuccess(true);
        setUserProfile();
      })
      .catch((error) => {
        console.log(error);
        setOpenSnackbar(true);
      })
      .finally(() => {
        setIsLoading(false);
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
      {isLoading && <LoadingSpinner transparent={false} />}
      <ProviderFields
        buttonText={t('profile.update')}
        control={control}
        errors={errors}
        onSubmit={handleSubmit(onSubmit)}
      />
      {updateSuccess && (
        <Snackbar
          anchorOrigin={{ horizontal: 'center', vertical: 'top' }}
          autoHideDuration={6000}
          onClose={() => setUpdateSuccess(false)}
          open={updateSuccess}
        >
          <Alert onClose={() => setUpdateSuccess(false)} severity="success" sx={{ width: '100%' }}>
            {t('profile.updateSuccess')}
          </Alert>
        </Snackbar>
      )}
      <Snackbar autoHideDuration={6000} onClose={handleCloseSnackbar} open={openSnackbar}>
        <Alert onClose={handleCloseSnackbar} severity="error" sx={{ width: '100%' }}>
          {t('errors.updateUser')}
        </Alert>
      </Snackbar>
    </CustomContainer>
  );
};
