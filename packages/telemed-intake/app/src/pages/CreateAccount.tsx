import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageForm } from 'ottehr-components';
import { IntakeFlowPageRoute } from '../App';
import { CustomContainer } from '../features/common';

type AccountInfo = {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  email?: string;
};

const CreateAccount = (): JSX.Element => {
  const { t } = useTranslation();
  const [accountInfo] = useState<AccountInfo>({});

  const onSubmit = (data: AccountInfo): void => {
    console.log(data);
  };

  return (
    <CustomContainer
      title={t('createAccount.title')}
      description={t('createAccount.description')}
      bgVariant={IntakeFlowPageRoute.PatientPortal.path}
    >
      <PageForm
        formElements={[
          {
            type: 'Text',
            name: 'firstName',
            label: t('general.formElement.labels.firstName'),
            defaultValue: accountInfo?.firstName,
            required: true,
            width: 6,
          },
          {
            type: 'Text',
            name: 'lastName',
            label: t('general.formElement.labels.lastName'),
            defaultValue: accountInfo?.lastName,
            required: true,
            width: 6,
          },
          {
            type: 'Date',
            name: 'dateOfBirth',
            label: t('general.formElement.labels.dateOfBirth'),
            defaultValue: accountInfo?.dateOfBirth,
            required: true,
          },
          {
            type: 'Text',
            name: 'email',
            label: t('general.formElement.labels.email'),
            format: 'Email',
            defaultValue: accountInfo?.email,
            required: true,
          },
        ]}
        controlButtons={{
          loading: false,
          submitLabel: t('createAccount.title'),
          backButton: false,
        }}
        onSubmit={onSubmit}
      />
    </CustomContainer>
  );
};

export default CreateAccount;
