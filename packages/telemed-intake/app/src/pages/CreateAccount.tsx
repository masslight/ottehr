import { useState } from 'react';
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
  const [accountInfo] = useState<AccountInfo>({});

  const onSubmit = (data: AccountInfo): void => {
    console.log(data);
  };

  return (
    <CustomContainer title="Create account" description="" bgVariant={IntakeFlowPageRoute.Homepage.path}>
      <PageForm
        formElements={[
          {
            type: 'Text',
            name: 'firstName',
            label: 'First name',
            defaultValue: accountInfo?.firstName,
            required: true,
            width: 6,
          },
          {
            type: 'Text',
            name: 'lastName',
            label: 'Last name',
            defaultValue: accountInfo?.lastName,
            required: true,
            width: 6,
          },
          {
            type: 'Date',
            name: 'dateOfBirth',
            label: 'Date of birth',
            defaultValue: accountInfo?.dateOfBirth,
            required: true,
          },
          {
            type: 'Text',
            name: 'email',
            label: 'Email Address',
            format: 'Email',
            defaultValue: accountInfo?.email,
            required: true,
          },
        ]}
        controlButtons={{
          loading: false,
          submitLabel: 'Create account',
          backButton: false,
        }}
        onSubmit={onSubmit}
      />
    </CustomContainer>
  );
};

export default CreateAccount;
