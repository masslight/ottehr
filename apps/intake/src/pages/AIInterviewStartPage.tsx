import { ArrowBack } from '@mui/icons-material';
import { LoadingButton } from '@mui/lab';
import { Box, Button, Checkbox, Modal, Typography } from '@mui/material';
import { Stack } from '@mui/system';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const client = useUCZambdaClient({ tokenless: false });
  const { t } = useTranslation();

  const [aiChatStartButtonEnabled, setAiChatStartButtonEnabled] = useState<boolean>(false);
  const [aiChatStartButtonLoading, setAiChatStartButtonLoading] = useState<boolean>(false);

  const saveAiChatConsentAndStartChat = async (): Promise<void> => {
    if (client == null || appointmentId == null) return;
    setAiChatStartButtonLoading(true);
    setAiChatStartButtonEnabled(false);
    await api.aIInterviewPersistConsent(
      {
        appointmentId,
      },
      client
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
            {t('aiInterview.returnToVisitPage')}
          </Typography>
        </Stack>
      }
    >
      <Box style={{ height: '540px' }} />
      <Modal open={true}>
        <Box sx={MODAL_STYLE}>
          <Typography variant={'h2'} color="primary.main" style={{ marginBottom: '16px' }}>
            {t('aiInterview.title')}
          </Typography>
          <Typography color="text.primary" style={{ marginBottom: '8px' }}>
            {t('aiInterview.body1')}
          </Typography>
          <Typography color="text.primary">{t('aiInterview.body2')}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', margin: '16px 0 16px 0' }}>
            <Checkbox color="secondary" onChange={(e) => setAiChatStartButtonEnabled(e.target.checked)} />
            <Typography color="text.primary">{t('aiInterview.consent')}</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button
              variant="outlined"
              color="secondary"
              onClick={() => {
                navigate(-1);
              }}
            >
              {t('aiInterview.cancel')}
            </Button>
            <LoadingButton
              loading={aiChatStartButtonLoading}
              variant="contained"
              color="secondary"
              disabled={!aiChatStartButtonEnabled}
              onClick={saveAiChatConsentAndStartChat}
            >
              {t('aiInterview.startChat')}
            </LoadingButton>
          </Box>
        </Box>
      </Modal>
    </PageContainer>
  );
};

export default AIInterviewStartPage;
