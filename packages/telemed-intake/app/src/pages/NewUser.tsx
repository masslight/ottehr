import { Typography } from '@mui/material';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageForm } from 'ottehr-components';
import { IntakeFlowPageRoute } from '../App';
import { clockFullColor } from '@theme/icons';

import { CustomContainer } from '../features/common';

const NewUser = (): JSX.Element => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    //mixpanel.track('New User');
  }, []);

  const onSubmit = async (): Promise<void> => {
    navigate(IntakeFlowPageRoute.PatientInformation.path);
  };

  return (
    <CustomContainer
      title={t('newUser.title')}
      img={t('newUser.imgAlt') ? clockFullColor : undefined}
      imgAlt={t('newUser.imgAlt')}
      imgWidth={100}
      bgVariant={IntakeFlowPageRoute.NewUser.path}
    >
      <Typography variant="body1">{t('newUser.message')}</Typography>
      <div dangerouslySetInnerHTML={{ __html: t('newUser.html') }} />
      <PageForm onSubmit={onSubmit} controlButtons={{ backButton: false }} />
    </CustomContainer>
  );
};

export default NewUser;
