import { useUCZambdaClient } from 'ui-components';
import { PageContainer } from '../components';
import { Questionnaire, QuestionnaireResponse } from 'fhir/r4b';
import { useEffect, useState } from 'react';
import api from '../api/zapehrApi';
import { Box } from '@mui/system';
import { Avatar, Button, TextField, Typography } from '@mui/material';
import { ottehrDarkBlue } from '../assets/icons';
import { Send } from '@mui/icons-material';
import { useParams } from 'react-router-dom';

interface Message {
  linkId: string;
  author: 'user' | 'ai';
  text: string;
}

const AIInterview = (): JSX.Element => {
  const zambdaClient = useUCZambdaClient({ tokenless: true });

  const { id: appointmentId } = useParams();
  const [questionnaireResponse, setQuestionnaireResponse] = useState<QuestionnaireResponse | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);
  const [answer, setAnswer] = useState<string>('');

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

  const messages = questionnaireResponse != null ? createMessages(questionnaireResponse) : [];
  if (loading) {
    messages.push({
      linkId: '1000000',
      author: 'ai',
      text: '...',
    });
  }

  const onSend = async (): Promise<void> => {
    if (zambdaClient == null) return;
    setLoading(true);
    setQuestionnaireResponse(
      await api.aIInterviewHandleAnswer(
        {
          questionnaireResponseId: questionnaireResponse?.id ?? '',
          linkId: messages.findLast((message) => message.author === 'ai')?.linkId ?? '',
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
        {messages.map((message) => (
          <Box
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: message.author === 'ai' ? 'flex-start' : 'flex-end',
              marginBottom: message.author === 'ai' ? '10px' : '18px',
            }}
          >
            {message.author === 'ai' && <img src={ottehrDarkBlue} style={{ width: '24px', marginRight: '10px' }} />}
            <Typography
              variant="body1"
              key={message.linkId + '-' + message.author}
              style={{
                background: message.author === 'user' ? 'rgba(244, 246, 248, 1)' : 'none',
                borderRadius: '4px',
                padding: '8px',
                paddingTop: message.author === 'ai' ? '0' : '8px',
                paddingLeft: message.author === 'ai' ? '0' : '8px',
                width: 'fit-content',
              }}
            >
              {message.text}
            </Typography>
            {message.author === 'user' && <Avatar style={{ width: '24px', height: '24px', marginLeft: '10px' }} />}
          </Box>
        ))}
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
          onChange={(e) => setAnswer(e.target.value)}
        />
        <Button
          disabled={loading || questionnaireResponse == null}
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

function createMessages(questionnaireResponse: QuestionnaireResponse): Message[] {
  const questionnaire = questionnaireResponse.contained?.[0] as Questionnaire;
  return (
    questionnaire.item
      ?.sort((itemA, itemB) => parseInt(itemA.linkId) - parseInt(itemB.linkId))
      ?.flatMap<Message>((questionItem) => {
        const answerItem = questionnaireResponse.item?.find((answerItem) => answerItem.linkId === questionItem.linkId);
        if (questionItem.linkId == '0') {
          return [];
        }
        const result: Message[] = [{ linkId: questionItem.linkId, author: 'ai', text: questionItem.text ?? '' }];
        const answerText = answerItem?.answer?.[0]?.valueString;
        if (answerText != null) {
          result.push({
            linkId: questionItem.linkId,
            author: 'user',
            text: answerItem?.answer?.[0]?.valueString ?? '',
          });
        }
        return result;
      }) ?? []
  );
}

export default AIInterview;
