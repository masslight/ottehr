import { useUCZambdaClient } from 'ui-components';
import { PageContainer } from '../components';
import { Questionnaire, QuestionnaireResponse } from 'fhir/r4b';
import { useEffect, useState } from 'react';
import api from '../api/zapehrApi';
import { assertDefined } from 'zambda-utils';
import { Box } from '@mui/system';
import { Button, TextField } from '@mui/material';

interface Message {
  linkId: string;
  author: 'user' | 'ai';
  text: string;
}

const AIInterview = (): JSX.Element => {
  const zambdaClient = useUCZambdaClient({ tokenless: true });

  const [questionnaireResponse, setQuestionnaireResponse] = useState<QuestionnaireResponse | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);
  const [answer, setAnswer] = useState<string>('');

  useEffect(() => {
    const startInterview = async (appointmentId: string): Promise<void> => {
      if (zambdaClient == null) return;
      const questionnaireResponse = await api.aIInterviewStart({ appointmentId }, zambdaClient);
      setQuestionnaireResponse(questionnaireResponse);
    };
    if (questionnaireResponse == null) {
      void startInterview('todo');
    }
  }, [questionnaireResponse, setQuestionnaireResponse, zambdaClient]);

  const messages = questionnaireResponse != null ? createMessages(questionnaireResponse) : [];

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
    <PageContainer title="Title">
      {messages.map((message) => (
        <Box key={message.linkId + '-' + message.author}>{message.text}</Box>
      ))}
      <TextField onChange={(e) => setAnswer(e.target.value)} />
      <Button
        disabled={loading || questionnaireResponse == null}
        onClick={onSend}
        size="large"
        type="button"
        color="secondary"
      >
        Send
      </Button>
    </PageContainer>
  );
};

function createMessages(questionnaireResponse: QuestionnaireResponse): Message[] {
  const questionnaire = questionnaireResponse.contained?.[0] as Questionnaire;
  return (
    questionnaire.item
      ?.sort((itemA, itemB) => parseInt(itemA.linkId) - parseInt(itemB.linkId))
      ?.flatMap<Message>((questionItem) => {
        const answerItem = assertDefined(
          questionnaireResponse.item?.find((answerItem) => answerItem.linkId === questionItem.linkId),
          `Answer for question "${questionItem.linkId}"`
        );
        const questionText = assertDefined(questionItem.text, `Text of question "${questionItem.linkId}"`);
        const answerText = assertDefined(
          answerItem.answer?.[0]?.valueString,
          `Text of answer to question "${questionItem.linkId}"`
        );
        if (questionItem.linkId == '0') {
          return [];
        }
        return [
          { linkId: questionItem.linkId, author: 'ai', text: questionText },
          { linkId: questionItem.linkId, author: 'user', text: answerText },
        ];
      }) ?? []
  );
}

export default AIInterview;
