import { t } from 'i18next';
import { CustomContainer, ProviderFields } from '../components';
import { createProviderName } from '../helpers';
import { getProvider } from '../helpers/mockData';
import { useForm } from 'react-hook-form';

export const Profile = (): JSX.Element => {
  const {
    control,
    formState: { errors },
    handleSubmit,
  } = useForm<FormData>({
    defaultValues: {
      email: '',
      firstName: '',
      lastName: '',
      slug: '',
      title: '',
    },
  });
  const provider = getProvider();
  const onSubmit = (data: FormData): void => {
    console.log(data);
    // TODO: form submission structure
  };

  return (
    <CustomContainer isProvider={true} subtitle={createProviderName(provider)} title={t('profile.myProfile')}>
      <ProviderFields
        buttonText={t('profile.update')}
        control={control}
        errors={errors}
        oldSlug={provider.slug}
        onSubmit={handleSubmit(onSubmit)}
      />
    </CustomContainer>
  );
};
