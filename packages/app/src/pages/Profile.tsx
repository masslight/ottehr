import { t } from 'i18next';
import { CustomContainer, LoadingSpinner, ProviderFields } from '../components';
import { useForm } from 'react-hook-form';
import { usePractitioner } from '../store/Context';
import { FormData } from './Register';
import { createProviderName } from '../helpers';
import { Operation } from 'fast-json-patch';
import { updateProvider } from '../api';
import { useAuth0 } from '@auth0/auth0-react';

export const Profile = (): JSX.Element => {
  const { provider, practitionerProfile } = usePractitioner();
  const providerPatchOps: Operation[] = [];
  const { getAccessTokenSilently } = useAuth0();

  const {
    control,
    formState: { errors },
    handleSubmit,
  } = useForm<FormData>({
    defaultValues: {
      email: '',
      firstName: provider?.firstName,
      lastName: provider?.lastName,
      slug: provider?.slug,
      title: provider?.title.toLowerCase(),
    },
  });
  console.log(provider);
  console.log('practitionerProfile', practitionerProfile);

  const onSubmit = (data: FormData): void => {
    console.log('data', data);
    updatePractitioner(data).catch((error) => {
      console.log(error);
    });
  };

  async function updatePractitioner(data: FormData): Promise<void> {
    const accessToken = await getAccessTokenSilently();
    // TODO: ADD PATCH OPERATIONS FOR ALL FIELDS
    // providerPatchOps.push({
    //   op: practitionerProfile?.identifier?.[0].value ? 'replace' : 'add',
    //   path: '/identifier/0/value',
    //   value: data.slug,
    // });

    providerPatchOps.push({
      op: practitionerProfile?.name?.[0].family ? 'replace' : 'add',
      path: '/name/0/family',
      value: data.lastName,
    });

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
    </CustomContainer>
  );
};
