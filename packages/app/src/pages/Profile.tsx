import { t } from 'i18next';
import { CustomContainer, ProviderFields } from '../components';
import { useForm } from 'react-hook-form';
import { usePractitioner } from '../store/Context';
import { FormData } from './Register';

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
  const { practitionerProfile } = usePractitioner();
  const onSubmit = (data: FormData): void => {
    console.log(data);
    // TODO: form submission structure
  };

  return (
    <CustomContainer isProvider={true} subtitle={practitionerProfile?.name[0].text} title={t('profile.myProfile')}>
      <ProviderFields
        buttonText={t('profile.update')}
        control={control}
        errors={errors}
        onSubmit={handleSubmit(onSubmit)}
      />
    </CustomContainer>
  );
};
