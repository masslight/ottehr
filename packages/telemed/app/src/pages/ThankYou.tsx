import { Link } from 'react-router-dom';
import { Button, Divider, Grid, Typography } from '@mui/material';
import { EventBusyOutlined } from '@mui/icons-material';
import { IntakeFlowPageRoute } from '../App';
import { CustomContainer } from '../features/common';
import { otherColors } from '../IntakeThemeProvider';

const ThankYou = (): JSX.Element => {
  return (
    <CustomContainer
      title="Thank you for choosing Ottehr Urgent Care"
      description="We look forward to helping you soon!"
      bgVariant={IntakeFlowPageRoute.Homepage.path}
    >
      <>
        <Divider />
        <Grid container alignItems="center" marginTop={2} marginBottom={2}>
          <Grid item xs={12} md={9.5}>
            <Typography variant="subtitle1" color="text.primary">
              Your check-in time is booked for:
            </Typography>
          </Grid>
        </Grid>
        <Divider sx={{ marginBottom: 2 }} />

        <Link to="cancellation-reason">
          <Button startIcon={<EventBusyOutlined />} sx={{ marginLeft: 1.5 }}>
            Cancel
          </Button>
        </Link>

        <Typography variant="body2" marginTop={2}>
          You will receive a confirmation email and SMS for your upcoming check-in time shortly. If you need to make any
          changes, please follow the instructions in the email.
        </Typography>
        <div
          style={{
            backgroundColor: otherColors.lightBlue,
            padding: 17,
            borderRadius: 8,
            marginTop: 25,
            marginBottom: 25,
          }}
        >
          <Typography variant="body2">
            Please click the &quot;Proceed to paperwork&quot; button below to complete your paperwork prior to your
            visit. If this is not completed in advance, your care may be delayed.
          </Typography>
          <Typography variant="body2" marginTop={2}>
            All patients that present with commercial insurance will be required to leave a credit card on file. More
            details on our financial policy can be found{' '}
            <a target="_blank" href="https://ottehr.com" rel="noreferrer">
              here
            </a>
            .
          </Typography>
        </div>

        <Typography variant="body2" marginTop={2}>
          If you have any questions or concerns, please call our team at: <strong>(888) 764-4161</strong>.
        </Typography>
      </>
    </CustomContainer>
  );
};

export default ThankYou;
