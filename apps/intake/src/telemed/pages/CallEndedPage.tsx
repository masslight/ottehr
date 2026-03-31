import { Button, Card, Typography, useTheme } from '@mui/material';
import { Box, Container } from '@mui/system';
import { useLocation, useNavigate } from 'react-router-dom';
import { BRANDING_CONFIG } from 'utils';
import { intakeFlowPageRoute } from '../../App';
import { primaryIcon } from '../../branding/assets';
import { getPrimaryIconSize, PRIMARY_ICON_PAGE, shouldShowPrimaryIcon } from '../../branding/primaryIconVisibility';
import { CustomContainer } from '../features/common';

const CallEndedPage = (): JSX.Element => {
  const navigate = useNavigate();
  const theme = useTheme();
  const location = useLocation();
  const isRegularParticipant =
    location.pathname === (intakeFlowPageRoute.CallEnded.path || intakeFlowPageRoute.IOSCallEnded.path);
  const showPrimaryIcon = shouldShowPrimaryIcon(PRIMARY_ICON_PAGE.CALL_ENDED);
  const primaryIconSize = getPrimaryIconSize();

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
            {showPrimaryIcon && (
              <img alt={BRANDING_CONFIG.intake.primaryIconAlt} src={primaryIcon} width={primaryIconSize} />
            )}

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
