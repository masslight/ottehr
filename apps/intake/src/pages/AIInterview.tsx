import { Send } from '@mui/icons-material';
import ArrowBack from '@mui/icons-material/ArrowBack';
import { Button, TextField, Typography } from '@mui/material';
import { Box, Stack } from '@mui/system';
import { Questionnaire, QuestionnaireResponse } from 'fhir/r4b';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/ottehrApi';
import { PageContainer } from '../components';
import { AiChatHistory } from '../components/AiChatHistory';
import { useUCZambdaClient } from '../hooks/useUCZambdaClient';
import { useVisitContext } from './ThankYou';

const AIInterview = (): JSX.Element => {
  const zambdaClient = useUCZambdaClient({ tokenless: true });

  const navigate = useNavigate();
  const { id: appointmentId } = useParams();
  const { appointmentData } = useVisitContext();
  const [questionnaireResponse, setQuestionnaireResponse] = useState<QuestionnaireResponse | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);
  const [answer, setAnswer] = useState<string>('');
  const [unprocessedUserAnswer, setUnprocessedUserAnswer] = useState<string>('');

  useEffect(() => {
    const startInterview = async (appointmentId: string): Promise<void> => {
      if (zambdaClient == null) return;
      const questionnaireResponse = await api.aIInterviewStart({ appointmentId }, zambdaClient);
      setQuestionnaireResponse(questionnaireResponse);
    };
    if (questionnaireResponse == null && appointmentId != null) {
      void startInterview(appointmentId);
    }
  }, [questionnaireResponse, setQuestionnaireResponse, zambdaClient, appointmentId]);

  const onSend = async (): Promise<void> => {
    if (zambdaClient == null || questionnaireResponse == null || answer.length === 0) return;
    setUnprocessedUserAnswer(answer);
    setAnswer('');
    setLoading(true);
    setQuestionnaireResponse(
      await api.aIInterviewHandleAnswer(
        {
          questionnaireResponseId: questionnaireResponse.id ?? '',
          linkId: getLastQuestionLinkId(questionnaireResponse),
          answer: answer,
        },
        zambdaClient
      )
    );
    setLoading(false);
  };

  const goToVisit = (): void => {
    if (appointmentData.appointment?.serviceMode === 'virtual') {
      navigate(`/waiting-room?appointment_id=${appointmentId}`);
    } else {
      navigate(`/visit/${appointmentId}`);
    }
  };

  const userInputEnabled = !loading && questionnaireResponse != null && questionnaireResponse.status !== 'completed';

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
          onClick={goToVisit}
        >
          <ArrowBack sx={{ color: '#B2DDFF' }} />
          <Typography sx={{ fontWeight: 500, fontSize: '14px', color: '#B2DDFF', marginLeft: '4px' }}>
            Return to visit page
          </Typography>
        </Stack>
      }
    >
      <Box style={{ overflowY: 'auto', height: 'calc(100vh - 400px)' }}>
        <AiChatHistory
          questionnaireResponse={questionnaireResponse}
          aiLoading={loading}
          unprocessedUserAnswer={unprocessedUserAnswer}
          scrollToBottomOnUpdate={true}
        />
      </Box>
      {questionnaireResponse?.status !== 'completed' ? (
        <Box
          style={{
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <TextField
            style={{ width: '100%' }}
            placeholder="Your message..."
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyUp={async (event) => {
              if (event.key === 'Enter' && userInputEnabled) {
                await onSend();
              }
            }}
            autoComplete="off"
          />
          <Button
            disabled={!userInputEnabled}
            onClick={onSend}
            size="large"
            type="button"
            color="secondary"
            variant="contained"
            startIcon={<Send />}
            style={{ height: '38px', marginLeft: '16px', fontWeight: 500 }}
          >
            Send
          </Button>
        </Box>
      ) : (
        <Box
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginTop: '16px',
          }}
        >
          <Button
            onClick={goToVisit}
            size="large"
            type="button"
            color="secondary"
            variant="contained"
            style={{ height: '38px', marginLeft: '16px', fontWeight: 500 }}
          >
            Return to visit page
          </Button>
        </Box>
      )}
    </PageContainer>
  );
};

function getLastQuestionLinkId(questionnaireResponse: QuestionnaireResponse): string {
  const questionLinkIds = (questionnaireResponse.contained?.[0] as Questionnaire).item
    ?.sort((itemA, itemB) => parseInt(itemA.linkId) - parseInt(itemB.linkId))
    ?.map((item) => item.linkId);
  if (questionLinkIds == null || questionLinkIds.length === 0) {
    return '';
  }
  return questionLinkIds[questionLinkIds.length - 1];
}

export default AIInterview;
