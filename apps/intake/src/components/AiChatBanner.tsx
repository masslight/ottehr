import { Button, Typography } from '@mui/material';
import { Box } from '@mui/system';
import { ottehrAiLogo } from '@theme/index';
import { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { intakeFlowPageRoute } from 'src/App';

interface Props {
  appointmentId: string;
}

export const AiChatBanner: FC<Props> = ({ appointmentId }) => {
  const navigate = useNavigate();
  const bannerEnabled = import.meta.env.VITE_APP_AI_INTERVIEW_BANNER_ENABLED === 'true';
  return (
    <>
      {bannerEnabled && (
        <Box style={{ background: '#FFF3E0', borderRadius: '8px', padding: '24px', display: 'flex' }}>
          <Box style={{ fontWeight: 600, fontSize: '18px' }}>
            <Typography variant="subtitle1" color="text.primary" style={{ paddingBottom: '16px', fontSize: '18px' }}>
              Save time and help us prepare for your visit. Our medical chatbot will ask you a few questions and
              securely present the information to your doctor before you arrive.
            </Typography>
            <Button
              type="button"
              variant="contained"
              style={{ backgroundColor: '#F57C00' }}
              onClick={() => navigate(intakeFlowPageRoute.AIInterviewStartPage.path.replace(':id', appointmentId))}
            >
              Start Chatting
            </Button>
          </Box>
          <img src={ottehrAiLogo} style={{ width: '80px', marginLeft: '8px' }} />
        </Box>
      )}
    </>
  );
};
