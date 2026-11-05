import {
  SendSupportChatMessageInput,
  SUPPORT_CHAT_TOPIC_LABEL,
  SupportChatMessageKind,
  SupportChatOption,
  SupportChatTopic,
} from 'utils/lib/types/api/support-chat.types';
import { PATIENT_REQUEST_TASK } from 'utils/lib/types/data/tasks/types';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { ThreadMessage } from './thread';

export const BOT_TEXT = {
  greeting:
    'Hello! Here you can create the support request to our team. Please select one of the topics below or send you own message to initiate the request.',
  visitPrompt: 'Please select related visit:',
  confirmation:
    'Your request has been registered. You can write additional details of your request below if required.\nWe will contact you shortly!',
  ack: 'Thank you! Our team received your message. We will contact you shortly!',
};

export type PatientRequestCode = SupportChatTopic | typeof PATIENT_REQUEST_TASK.code.followUp;

export interface MessageDraft {
  author: 'patient' | 'bot';
  kind: SupportChatMessageKind;
  text: string;
  topic?: SupportChatTopic;
  options?: SupportChatOption[];
}

export type TaskIntent =
  | { type: 'create'; code: PatientRequestCode; appointmentId?: string; text?: string; details?: string }
  | { type: 'set-visit'; appointmentId: string; text: string }
  | { type: 'attach'; text: string };

export interface BotStep {
  messages: MessageDraft[];
  task?: TaskIntent;
}

export interface ResolveStepInput {
  last: ThreadMessage | undefined;
  requestText?: string;
  action: SendSupportChatMessageInput;
  visits: SupportChatOption[];
  hasOpenTask: boolean;
}

interface PendingRequest {
  topic?: SupportChatTopic;
  text?: string;
}

const TOPIC_OPTIONS: SupportChatOption[] = Object.values(SupportChatTopic).map((topic) => ({
  id: topic,
  label: SUPPORT_CHAT_TOPIC_LABEL[topic],
}));

export const greetingMessage = (): MessageDraft => ({
  author: 'bot',
  kind: 'greeting',
  text: BOT_TEXT.greeting,
  options: TOPIC_OPTIONS,
});

const confirmation = (): MessageDraft => ({ author: 'bot', kind: 'confirmation', text: BOT_TEXT.confirmation });
const ack = (): MessageDraft => ({ author: 'bot', kind: 'text', text: BOT_TEXT.ack });
const recap = (text: string): MessageDraft => ({ author: 'patient', kind: 'recap', text });

const visitPrompt = (request: PendingRequest, visits: SupportChatOption[]): MessageDraft => ({
  author: 'bot',
  kind: 'visit-prompt',
  text: BOT_TEXT.visitPrompt,
  topic: request.topic,
  options: visits,
});

const requestCode = (request: PendingRequest): PatientRequestCode =>
  request.topic ?? PATIENT_REQUEST_TASK.code.followUp;

function createRequest(request: PendingRequest, visit?: SupportChatOption, details?: string): BotStep {
  const messages: MessageDraft[] = [];

  if (visit) {
    messages.push(
      recap(
        request.topic
          ? `Specified: ${SUPPORT_CHAT_TOPIC_LABEL[request.topic]} for the visit of ${visit.label}`
          : `Initiated request: ${request.text} for ${visit.label}`
      )
    );
  }

  messages.push(confirmation());

  return {
    messages,
    task: { type: 'create', code: requestCode(request), appointmentId: visit?.id, text: request.text, details },
  };
}

function startRequest(request: PendingRequest, visits: SupportChatOption[]): BotStep {
  if (visits.length <= 1) return createRequest(request, visits[0]);

  const messages = [visitPrompt(request, visits)];

  if (request.topic) return { messages };

  return { messages, task: { type: 'create', code: requestCode(request), text: request.text } };
}

export function resolveStep(input: ResolveStepInput): BotStep {
  if (!input.last && input.action.action !== 'new-request') {
    const first = greetingMessage();
    const step = resolveStep({ ...input, last: { kind: first.kind, options: first.options ?? [] } });
    return { ...step, messages: [first, ...step.messages] };
  }

  const { last, requestText, action, visits, hasOpenTask } = input;
  const pendingTopic = last?.kind === 'visit-prompt' ? last.topic : undefined;

  switch (action.action) {
    case 'new-request':
      return { messages: [greetingMessage()] };

    case 'select-topic': {
      if (last?.kind !== 'greeting') throw INVALID_INPUT_ERROR('A topic can be selected only after the greeting');

      const step = startRequest({ topic: action.topic }, visits);

      return {
        ...step,
        messages: [recap(`Initiated request: ${SUPPORT_CHAT_TOPIC_LABEL[action.topic]}`), ...step.messages],
      };
    }

    case 'select-visit': {
      const isOffered = last?.kind === 'visit-prompt' && last.options.some((o) => o.id === action.appointmentId);
      const visit = isOffered ? visits.find((o) => o.id === action.appointmentId) : undefined;
      if (!visit) throw INVALID_INPUT_ERROR('The visit is not available for selection');
      if (pendingTopic) return createRequest({ topic: pendingTopic }, visit);
      if (!requestText) throw INVALID_INPUT_ERROR('The visit is not available for selection');

      return {
        messages: [recap(`Initiated request: ${requestText} for ${visit.label}`), confirmation()],
        task: { type: 'set-visit', appointmentId: visit.id, text: requestText },
      };
    }

    case 'text': {
      const message: MessageDraft = { author: 'patient', kind: 'text', text: action.text };

      if (pendingTopic) {
        const step = createRequest({ topic: pendingTopic }, undefined, action.text);
        return { ...step, messages: [message, ...step.messages] };
      }

      if (hasOpenTask && last?.kind !== 'greeting') {
        const isFirstDetails = last?.kind === 'confirmation';
        return { messages: isFirstDetails ? [message, ack()] : [message], task: { type: 'attach', text: action.text } };
      }

      const step = startRequest({ text: action.text }, visits);
      return { ...step, messages: [message, ...step.messages] };
    }
  }
}
