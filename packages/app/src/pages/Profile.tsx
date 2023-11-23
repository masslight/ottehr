import { t } from 'i18next';
import { CustomContainer, LoadingSpinner, ProviderFields } from '../components';
import { useForm } from 'react-hook-form';
import { usePractitioner } from '../store/Context';
import { FormData } from './Register';
import { createProviderName } from '../helpers';

export const Profile = (): JSX.Element => {
  const { provider } = usePractitioner();

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

  const onSubmit = (data: FormData): void => {
    console.log(data);
    // TODO: form submission structure || ''
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
    </CustomContainer>
  );
};
