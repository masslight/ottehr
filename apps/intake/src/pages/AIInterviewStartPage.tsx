import { ArrowBack } from '@mui/icons-material';
import { LoadingButton } from '@mui/lab';
import { Box, Button, Checkbox, Modal, Typography } from '@mui/material';
import { Stack } from '@mui/system';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from 'src/api/ottehrApi';
import { intakeFlowPageRoute } from 'src/App';
import { useUCZambdaClient } from 'src/hooks/useUCZambdaClient';
import { PageContainer } from '../components';

const MODAL_STYLE = {
  position: 'absolute' as const,
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '80%',
  maxWidth: '450px',
  border: 'none',
  bgcolor: 'background.paper',
  boxShadow: 24,
  p: 4,
  borderRadius: '8px',
};

const AIInterviewStartPage = (): JSX.Element => {
  const navigate = useNavigate();
  const { id: appointmentId } = useParams();
  const tokenlessZambdaClient = useUCZambdaClient({ tokenless: true });

  const [aiChatStartButtonEnabled, setAiChatStartButtonEnabled] = useState<boolean>(false);
  const [aiChatStartButtonLoading, setAiChatStartButtonLoading] = useState<boolean>(false);

  const saveAiChatConsentAndStartChat = async (): Promise<void> => {
    if (tokenlessZambdaClient == null || appointmentId == null) return;
    setAiChatStartButtonLoading(true);
    setAiChatStartButtonEnabled(false);
    await api.aIInterviewPersistConsent(
      {
        appointmentId,
      },
      tokenlessZambdaClient
    );
    navigate(intakeFlowPageRoute.AIInterview.path.replace(':id', appointmentId));
  };
  return (
    <PageContainer
      topOutsideCardComponent={
        <Stack
          direction="row"
          sx={{
            alignItems: 'center',
            marginBottom: '8px',
            cursor: 'pointer',
          }}
        >
          <ArrowBack sx={{ color: '#B2DDFF' }} />
          <Typography sx={{ fontWeight: 500, fontSize: '14px', color: '#B2DDFF', marginLeft: '4px' }}>
            Return to visit page
          </Typography>
        </Stack>
      }
    >
      <Box style={{ height: '540px' }} />
      <Modal open={true}>
        <Box sx={MODAL_STYLE}>
          <Typography variant={'h2'} color="primary.main" style={{ marginBottom: '16px' }}>
            Medical History Chatbot
          </Typography>
          <Typography color="text.primary" style={{ marginBottom: '8px' }}>
            Our AI medical assistant will ask about your symptoms and medical history. Your information is completely
            private, accessible only by your doctor, and the interview helps your doctor better prepare for your visit.
          </Typography>
          <Typography color="text.primary">
            You can pause the interview, and then complete later. Once interview is completed, you cannot start a new
            interview.
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', margin: '16px 0 16px 0' }}>
            <Checkbox color="secondary" onChange={(e) => setAiChatStartButtonEnabled(e.target.checked)} />
            <Typography color="text.primary">I consent</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button
              variant="outlined"
              color="secondary"
              onClick={() => {
                navigate(-1);
              }}
            >
              Cancel
            </Button>
            <LoadingButton
              loading={aiChatStartButtonLoading}
              variant="contained"
              color="secondary"
              disabled={!aiChatStartButtonEnabled}
              onClick={saveAiChatConsentAndStartChat}
            >
              Start chat
            </LoadingButton>
          </Box>
        </Box>
      </Modal>
    </PageContainer>
  );
};

export default AIInterviewStartPage;
