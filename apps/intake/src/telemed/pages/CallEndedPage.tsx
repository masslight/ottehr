import { Button, Card, Typography, useTheme } from '@mui/material';
import { Box, Container } from '@mui/system';
import { ottehrLightBlue } from '@theme/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { intakeFlowPageRoute } from '../../App';
import { CustomContainer } from '../features/common';

const CallEndedPage = (): JSX.Element => {
  const navigate = useNavigate();
  const theme = useTheme();
  const location = useLocation();
  const isRegularParticipant =
    location.pathname === (intakeFlowPageRoute.CallEnded.path || intakeFlowPageRoute.IOSCallEnded.path);

  return (
    <CustomContainer title="" useEmptyBody>
      <Container maxWidth="md" sx={{ mb: 5 }}>
        <Card
          variant="outlined"
          sx={{ boxShadow: 1, mt: 0, mb: 3, pt: 0, borderRadius: 2, [theme.breakpoints.down('md')]: { mx: 2 } }}
        >
          <Box
            sx={{
              m: 0,
              p: {
                xs: 3,
                md: 5,
              },
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <img alt="ottehr icon" src={ottehrLightBlue} width={120} />

            <Box>
              <Typography variant="h2" color="primary.main" textAlign="center">
                The call has ended
              </Typography>
            </Box>

            {isRegularParticipant && (
              <Button variant="contained" onClick={() => navigate(intakeFlowPageRoute.Homepage.path)}>
                Back to patient page
              </Button>
            )}
          </Box>
        </Card>
      </Container>
    </CustomContainer>
  );
};

export default CallEndedPage;
