import { AiChatHistory, useUCZambdaClient } from 'ui-components';
import { PageContainer } from '../components';
import { Questionnaire, QuestionnaireResponse } from 'fhir/r4b';
import { useEffect, useState } from 'react';
import api from '../api/zapehrApi';
import { Box } from '@mui/system';
import { Button, TextField } from '@mui/material';
import { Send } from '@mui/icons-material';
import { useParams } from 'react-router-dom';

const AIInterview = (): JSX.Element => {
  const zambdaClient = useUCZambdaClient({ tokenless: true });

  const { id: appointmentId } = useParams();
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
    if (zambdaClient == null || questionnaireResponse == null) return;
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

  return (
    <PageContainer>
      <Box style={{ overflowY: 'auto', height: 'calc(100vh - 400px)' }}>
        <AiChatHistory
          questionnaireResponse={questionnaireResponse}
          aiLoading={loading}
          unprocessedUserAnswer={unprocessedUserAnswer}
        />
      </Box>
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
            if (event.key === 'Enter') {
              await onSend();
            }
          }}
        />
        <Button
          disabled={loading || questionnaireResponse == null || questionnaireResponse.status === 'completed'}
          onClick={onSend}
          size="large"
          type="button"
          color="secondary"
          variant="contained"
          startIcon={<Send />}
          style={{ height: '38px', marginLeft: '16px' }}
        >
          Send
        </Button>
      </Box>
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
