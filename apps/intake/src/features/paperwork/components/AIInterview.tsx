import { Send } from '@mui/icons-material';
import { Button, TextField } from '@mui/material';
import { Box } from '@mui/system';
import { Questionnaire, QuestionnaireResponse } from 'fhir/r4b';
import { FC, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AiChatHistory } from 'src/components/AiChatHistory';
import { useUCZambdaClient } from 'src/hooks/useUCZambdaClient';
import api from '../../../api/ottehrApi';

interface AIInterviewProps {
  onChange: (event: { target: { value: boolean } }) => void;
  aiInterviewQuestionnaireResponse: QuestionnaireResponse | undefined;
  setAiInterviewQuestionnaireResponse: (questionnaireResponse: QuestionnaireResponse | undefined) => void;
}

const AIInterview: FC<AIInterviewProps> = ({
  onChange,
  aiInterviewQuestionnaireResponse,
  setAiInterviewQuestionnaireResponse,
}): JSX.Element => {
  const zambdaClient = useUCZambdaClient({ tokenless: false });

  const { id: appointmentId } = useParams();
  const [loading, setLoading] = useState<boolean>(false);
  const [answer, setAnswer] = useState<string>('');
  const [unprocessedUserAnswer, setUnprocessedUserAnswer] = useState<string>('');

  useEffect(() => {
    const startInterview = async (appointmentId: string): Promise<void> => {
      if (zambdaClient == null) return;
      const questionnaireResponse = await api.aIInterviewStart({ appointmentId }, zambdaClient);
      setAiInterviewQuestionnaireResponse(questionnaireResponse);
    };
    if (aiInterviewQuestionnaireResponse == null && appointmentId != null) {
      void startInterview(appointmentId);
    }
  }, [aiInterviewQuestionnaireResponse, setAiInterviewQuestionnaireResponse, zambdaClient, appointmentId]);

  useEffect(() => {
    if (aiInterviewQuestionnaireResponse?.status === 'completed') {
      onChange({ target: { value: true } });
    }
  }, [onChange, aiInterviewQuestionnaireResponse?.status]);

  const onSend = async (): Promise<void> => {
    const trimmedAnswer = answer.trim();
    if (trimmedAnswer.length === 0) {
      setAnswer('');
      return;
    }
    if (zambdaClient == null || aiInterviewQuestionnaireResponse == null) return;
    setUnprocessedUserAnswer(trimmedAnswer);
    setAnswer('');
    setLoading(true);
    setAiInterviewQuestionnaireResponse(
      await api.aIInterviewHandleAnswer(
        {
          questionnaireResponseId: aiInterviewQuestionnaireResponse.id ?? '',
          linkId: getLastQuestionLinkId(aiInterviewQuestionnaireResponse),
          answer: trimmedAnswer,
        },
        zambdaClient
      )
    );
    setLoading(false);
  };

  const userInputEnabled =
    !loading && aiInterviewQuestionnaireResponse != null && aiInterviewQuestionnaireResponse.status !== 'completed';

  return (
    <>
      <Box style={{ overflowY: 'auto', height: 'calc(100vh - 400px)' }}>
        <AiChatHistory
          questionnaireResponse={aiInterviewQuestionnaireResponse}
          aiLoading={loading}
          unprocessedUserAnswer={unprocessedUserAnswer}
          scrollToBottomOnUpdate={true}
        />
      </Box>
      {aiInterviewQuestionnaireResponse?.status !== 'completed' && (
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
            type="submit"
            color="secondary"
            variant="outlined"
            startIcon={<Send />}
            style={{ height: '38px', marginLeft: '16px', fontWeight: 500 }}
          >
            Send
          </Button>
        </Box>
      )}
    </>
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
