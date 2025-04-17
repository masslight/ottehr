import { Questionnaire, QuestionnaireResponse } from 'fhir/r4b';
import { FC, useEffect, useState } from 'react';
import { Box } from '@mui/system';
import { Avatar, Typography } from '@mui/material';
import { ottehrDarkBlue } from '../assets/icons';

const MESSAGES_CONTAINER_ID = 'messages-container';

export interface AiChatHistoryProps {
  questionnaireResponse?: QuestionnaireResponse;
  unprocessedUserAnswer?: string;
  aiLoading?: boolean;
}

interface Message {
  linkId: string;
  author: 'user' | 'ai';
  text: string;
}

export const AiChatHistory: FC<AiChatHistoryProps> = ({ questionnaireResponse, unprocessedUserAnswer, aiLoading }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  if (questionnaireResponse != null) {
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
    setMessages(messages);
  }

  useEffect(() => {
    if (messages.length) {
      scrollToBottom();
    }
  }, [messages]);
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
    </Box>
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

function scrollToBottom(): void {
  setTimeout(() => {
    const element = document.getElementById(MESSAGES_CONTAINER_ID);
    if (element) {
      element.scrollTop = element?.scrollHeight;
    }
  }, 0);
}
