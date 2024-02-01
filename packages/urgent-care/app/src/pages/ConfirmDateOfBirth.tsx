import { CustomContainer } from '../components';
import { IntakeFlowPageRoute } from '../App';
import { PageForm } from 'ui-components';
import React from 'react';
import { IntakeDataContext } from '../store';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Dialog, Paper, Typography } from '@mui/material';
import mixpanel from 'mixpanel-browser';
import { useEffect } from 'react';
import { mdyStringFromISOString } from '../helpers';

const REACT_APP_MIXPANEL_TOKEN = import.meta.env.REACT_APP_MIXPANEL_TOKEN;

const ConfirmDateOfBirth = (): JSX.Element => {
  const navigate = useNavigate();
  const { state } = React.useContext(IntakeDataContext);
  const [openModal, setOpenModal] = React.useState<boolean>(false);

  useEffect(() => {
    if (REACT_APP_MIXPANEL_TOKEN) {
      mixpanel.track('Confirm Date of Birth');
    }
  });

  const handleSubmit = (data: { dateOfBirth: string }): void => {
    // if the date's of birth match, send the patient to PatientInformation
    if (data.dateOfBirth === state.patientInfo?.dateOfBirth?.split('T')[0]) {
      // in case the user initially set the wrong birthday, but then clicked 'back' and fixed it
      state.unconfirmedDateOfBirth = undefined;
      // route to PatientInformation
      navigate(IntakeFlowPageRoute.PatientInformation.path);
    } else {
      state.unconfirmedDateOfBirth = data.dateOfBirth;
      setOpenModal(true);
    }
  };

  const handleWrongDateOfBirthSubmit = (): void => {
    navigate(IntakeFlowPageRoute.PatientInformation.path);
  };

  let formattedDOB: string | undefined;
  if (state.unconfirmedDateOfBirth) {
    formattedDOB = mdyStringFromISOString(state.unconfirmedDateOfBirth);
  }

  return (
    <CustomContainer
      title={`Confirm ${
        state.patientInfo?.firstName ? `${state.patientInfo?.firstName}'s` : 'patient’s'
      } date of birth`}
      bgVariant={IntakeFlowPageRoute.ConfirmDateOfBirth.path}
    >
      <PageForm
        formElements={[
          {
            type: 'Date',
            name: 'dateOfBirth',
            label: 'Date of birth',
            required: true,
          },
        ]}
        controlButtons={{
          submitLabel: 'Continue',
        }}
        onSubmit={handleSubmit}
      />
      {/* Modal for incorrect birthday input */}
      <Dialog
        open={openModal}
        onClose={() => setOpenModal(false)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Paper>
          <Box margin={5} maxWidth="sm">
            <Typography sx={{ width: '100%' }} variant="h2" color="primary.main">
              Unfortunately, this patient record is not confirmed.
            </Typography>
            <Typography marginTop={2}>
              This date of birth{formattedDOB ? ` (${formattedDOB})` : ''} doesn’t match selected patient profile (
              {state.patientInfo?.firstName} {state.patientInfo?.lastName}).
            </Typography>
            <Typography marginTop={2}>You can try again or continue and verify DOB at check-in.</Typography>
            <Box
              display="flex"
              flexDirection={{ xs: 'column', md: 'row' }}
              sx={{ justifyContent: 'space-between', mt: 4.125 }}
            >
              <Button
                variant="outlined"
                onClick={handleWrongDateOfBirthSubmit}
                color="primary"
                size="large"
                type="submit"
              >
                Continue anyway
              </Button>
              <Button variant="contained" onClick={() => setOpenModal(false)} size="large" type="button">
                Try again
              </Button>
            </Box>
          </Box>
        </Paper>
      </Dialog>
    </CustomContainer>
  );
};

export default ConfirmDateOfBirth;
