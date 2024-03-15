import { Box, MenuItem, Select, Typography } from '@mui/material';
import { PageForm } from 'ottehr-components';
import { IntakeFlowPageRoute } from '../App';
import { useNavigate } from 'react-router-dom';
import { CustomContainer, useIntakeCommonStore } from '../features/common';
import { AllStates, ValuePair } from 'ottehr-utils/lib/types';
import { otherColors } from '../IntakeThemeProvider';
import { BoldPurpleInputLabel } from 'ottehr-components/lib/components/form';

const Welcome = (): JSX.Element => {
  const navigate = useNavigate();
  const currentState = useIntakeCommonStore((state) => state.selectedLocationState);
  const onSubmit = (): void => {
    navigate(IntakeFlowPageRoute.AuthPage.path);
  };

  return (
    <CustomContainer
      title="Welcome to Ottehr Telemedicine"
      description=""
      bgVariant={IntakeFlowPageRoute.Homepage.path}
    >
      <Typography variant="body1" marginTop={2}>
        We look forward to helping you soon!
      </Typography>
      <Typography variant="body1" marginTop={1}>
        Please click on Continue to proceed to a page where you will enter your phone number. We&apos;ll verify if we
        your information already. If we do, we will pre-fill your past information for a faster booking. If you already
        have a reservation, please select the Check-in option after login.
      </Typography>
      <Typography variant="body1" marginTop={1}>
        Please note that your family&apos;s information may be registered under a phone number owned by your partner,
        spouse, or child&apos;s guardian.
      </Typography>
      <Typography variant="body1" marginTop={1}>
        Parents of children under the age of 18, please register as account holders. Children 18 and above must create
        their own account.
      </Typography>
      <Box marginTop={5}>
        <BoldPurpleInputLabel required shrink>
          State you are currently in
        </BoldPurpleInputLabel>
        <Select
          displayEmpty
          labelId="multiple-checkbox-label"
          id="multiple-checkbox"
          required
          value={currentState}
          onChange={(e) => {
            useIntakeCommonStore.setState({ selectedLocationState: e.target.value });
          }}
          renderValue={(selected) => {
            if (selected === String()) {
              return <div>Select</div>;
            }

            return selected;
          }}
          sx={{
            width: '100%',
            height: '40px',
            borderRadius: '8px',
            color: !currentState ? otherColors.lightGray : otherColors.black,
          }}
        >
          <MenuItem disabled value="">
            <div>Select</div>
          </MenuItem>
          {AllStates.map((state: ValuePair, idx: number) => (
            <MenuItem key={idx} value={state.value}>
              {state.label}
            </MenuItem>
          ))}
        </Select>
      </Box>

      <PageForm onSubmit={onSubmit} controlButtons={{ backButton: false, submitDisabled: !currentState }} />
    </CustomContainer>
  );
};

export default Welcome;
