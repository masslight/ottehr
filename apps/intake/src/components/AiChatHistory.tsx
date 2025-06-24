import { Avatar, Typography } from '@mui/material';
import { Box } from '@mui/system';
import { ottehrDarkBlue } from '@theme/icons';
import { Questionnaire, QuestionnaireResponse } from 'fhir/r4b';
import { FC, useEffect, useRef } from 'react';
const MESSAGES_CONTAINER_ID = 'messages-container';

export interface AiChatHistoryProps {
  questionnaireResponse?: QuestionnaireResponse;
  unprocessedUserAnswer?: string;
  aiLoading?: boolean;
  scrollToBottomOnUpdate?: boolean;
}

interface Message {
  linkId: string;
  author: 'user' | 'ai';
  text: string;
}

export const AiChatHistory: FC<AiChatHistoryProps> = ({
  questionnaireResponse,
  unprocessedUserAnswer,
  aiLoading,
  scrollToBottomOnUpdate,
}) => {
  const messages = createMessages(questionnaireResponse);
  if (aiLoading) {
    if (unprocessedUserAnswer != null) {
      messages.push({
        linkId: '1000000',
        author: 'user',
        text: unprocessedUserAnswer,
      });
    }
    messages.push({
      linkId: '1000001',
      author: 'ai',
      text: '...',
    });
  }

  const bottomRef = useRef<null | HTMLDivElement>(null);
  useEffect(() => {
    if (scrollToBottomOnUpdate === true) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  });

  return (
    <Box id={MESSAGES_CONTAINER_ID}>
      {messages.map((message) => (
        <Box
          key={message.author + ':' + message.linkId}
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
      <div ref={bottomRef} />
    </Box>
  );
};

function createMessages(questionnaireResponse: QuestionnaireResponse | undefined): Message[] {
  if (questionnaireResponse == null) {
    return [];
  }
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
