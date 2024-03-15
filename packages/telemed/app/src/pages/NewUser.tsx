import { Typography } from '@mui/material';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageForm } from 'ottehr-components';
import { IntakeFlowPageRoute } from '../App';
import { clockFullColor } from '../assets/icons';

import { CustomContainer } from '../features/common';

const NewUser = (): JSX.Element => {
  const navigate = useNavigate();

  const onSubmit = async (): Promise<void> => {
    navigate(IntakeFlowPageRoute.PatientInformation.path);
  };

  return (
    <CustomContainer
      title="Thanks for choosing Ottehr Urgent Care!"
      img={clockFullColor}
      imgAlt="Clock icon"
      imgWidth={100}
      bgVariant={IntakeFlowPageRoute.NewUser.path}
    >
      <Typography variant="body1">
        We&apos;re pleased to offer this new technology for accessing care. You will need to enter your information
        again just once. Next time you return, it will all be here for you!
      </Typography>
      <PageForm onSubmit={onSubmit} controlButtons={{ backButton: false }} />
    </CustomContainer>
  );
};

export default NewUser;
