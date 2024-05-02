import { Typography } from '@mui/material';
import mixpanel from 'mixpanel-browser';
import { useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { IntakeFlowPageRoute } from '../App';
import { ottehrWelcome } from '../assets/icons';
import { CustomContainer } from '../components';
import { PageForm } from 'ottehr-components';
import { updatePatient } from '../store/IntakeActions';
import { IntakeDataContext } from '../store/IntakeContext';

const NewUser = (): JSX.Element => {
  const navigate = useNavigate();
  const { state, dispatch } = useContext(IntakeDataContext);

  useEffect(() => {
    mixpanel.track('New User');
  }, []);

  const onSubmit = async (): Promise<void> => {
    let patientTemp = state.patientInfo;
    if (!patientTemp) {
      patientTemp = {
        id: state.patientInfo?.id,
        newPatient: true,
        firstName: state.patientInfo?.firstName,
        lastName: state.patientInfo?.lastName,
        dateOfBirth: state.patientInfo?.dateOfBirth,
        sex: state.patientInfo?.sex,
        // If a patient is selected and reasonForVisit is already set,
        // don't change the reason for visit
        reasonForVisit: state.patientInfo?.reasonForVisit,
        email: state.patientInfo?.email,
        emailUser: state.patientInfo?.emailUser,
      };
    }
    updatePatient(patientTemp, dispatch);

    navigate(IntakeFlowPageRoute.PatientInformation.path);
  };

  return (
    <CustomContainer
      title="Thanks for choosing Ottehr Urgent Care!"
      img={ottehrWelcome}
      imgAlt="People icon"
      imgWidth={70}
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
