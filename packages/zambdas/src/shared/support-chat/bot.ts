import {
  SendSupportChatMessageInput,
  SUPPORT_CHAT_NO_VISIT_OPTION_ID,
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
  patientPrompt: 'Who is this request for?',
  visitPrompt: 'Please select related visit:',
  noVisit: 'Not about a specific visit',
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
  requestText?: string;
  options?: SupportChatOption[];
}

export type TaskIntent =
  | {
      type: 'create';
      code: PatientRequestCode;
      patientId: string;
      appointmentId?: string;
      text?: string;
      details?: string;
    }
  | { type: 'update'; patientId: string; appointmentId?: string; text: string }
  | { type: 'attach'; text: string; taskId?: string };

export interface BotStep {
  messages: MessageDraft[];
  task?: TaskIntent;
  patientId?: string;
}

export interface BotVisit {
  id: string;
  patientId: string;
  label: string;
  date: string;
}

export interface ResolveStepInput {
  last: ThreadMessage | undefined;
  action: SendSupportChatMessageInput;
  patients: SupportChatOption[];
  visits: BotVisit[];
  defaultPatientId?: string;
  hasOpenTask: boolean;
}

interface PendingRequest {
  topic?: SupportChatTopic;
  text?: string;
  patientId?: string;
  taskId?: string;
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

const patientPrompt = (request: PendingRequest, patients: SupportChatOption[]): MessageDraft => ({
  author: 'bot',
  kind: 'patient-prompt',
  text: BOT_TEXT.patientPrompt,
  topic: request.topic,
  requestText: request.text,
  options: patients,
});

const visitPrompt = (request: PendingRequest, visits: BotVisit[]): MessageDraft => ({
  author: 'bot',
  kind: 'visit-prompt',
  text: BOT_TEXT.visitPrompt,
  topic: request.topic,
  requestText: request.text,
  options: [
    ...visits.map((visit) => ({ id: visit.id, label: visit.date })),
    { id: SUPPORT_CHAT_NO_VISIT_OPTION_ID, label: BOT_TEXT.noVisit },
  ],
});

const findPatient = (patientId: string | undefined, patients: SupportChatOption[]): SupportChatOption | undefined =>
  patientId ? patients.find((patient) => patient.id === patientId) : patients.length === 1 ? patients[0] : undefined;

function getPendingRequest(last: ThreadMessage | undefined): PendingRequest | undefined {
  if (last?.kind !== 'patient-prompt' && last?.kind !== 'visit-prompt') return undefined;
  if (!last.topic && !last.requestText) return undefined;

  return {
    topic: last.topic,
    text: last.requestText,
    patientId: last.kind === 'visit-prompt' ? last.patientId : undefined,
    taskId: last.taskId,
  };
}

function finishRequest(
  request: PendingRequest,
  patient: SupportChatOption,
  options: { visit?: BotVisit; details?: string; recapText?: string } = {}
): BotStep {
  const messages = [...(options.recapText ? [recap(options.recapText)] : []), confirmation()];
  const appointmentId = options.visit?.id;

  if (request.taskId) {
    return {
      patientId: patient.id,
      messages,
      task: { type: 'update', patientId: patient.id, appointmentId, text: request.text ?? '' },
    };
  }

  return {
    patientId: patient.id,
    messages,
    task: {
      type: 'create',
      code: request.topic ?? PATIENT_REQUEST_TASK.code.followUp,
      patientId: patient.id,
      appointmentId,
      text: request.text,
      details: options.details,
    },
  };
}

function continueRequest(request: PendingRequest, { patients, visits }: ResolveStepInput): BotStep {
  const patient = findPatient(request.patientId, patients);

  if (!patient) return { messages: [patientPrompt(request, patients)] };

  const patientVisits = visits.filter((visit) => visit.patientId === patient.id);

  if (!patientVisits.length) return finishRequest(request, patient);

  return { patientId: patient.id, messages: [visitPrompt(request, patientVisits)] };
}

function startFreeText(text: string, input: ResolveStepInput): BotStep {
  const step = continueRequest({ text }, input);

  if (step.task) return step;

  const patient =
    findPatient(undefined, input.patients) ?? findPatient(input.defaultPatientId, input.patients) ?? input.patients[0];

  return {
    ...step,
    patientId: patient.id,
    task: { type: 'create', code: PATIENT_REQUEST_TASK.code.followUp, patientId: patient.id, text },
  };
}

export function resolveStep(input: ResolveStepInput): BotStep {
  if (!input.last && input.action.action !== 'new-request') {
    const first = greetingMessage();
    const step = resolveStep({ ...input, last: { kind: first.kind, options: first.options ?? [] } });
    return { ...step, messages: [first, ...step.messages] };
  }

  const { last, action, patients, visits, hasOpenTask } = input;
  const request = getPendingRequest(last);

  switch (action.action) {
    case 'new-request':
      return { messages: [greetingMessage()] };

    case 'select-topic': {
      if (last?.kind !== 'greeting') throw INVALID_INPUT_ERROR('A topic can be selected only after the greeting');

      const step = continueRequest({ topic: action.topic }, input);

      return {
        ...step,
        messages: [recap(`Initiated request: ${SUPPORT_CHAT_TOPIC_LABEL[action.topic]}`), ...step.messages],
      };
    }

    case 'select-patient': {
      const isOffered = last?.kind === 'patient-prompt' && last.options.some((o) => o.id === action.patientId);
      const patient = isOffered ? patients.find((p) => p.id === action.patientId) : undefined;

      if (!request || !patient) throw INVALID_INPUT_ERROR('The patient is not available for selection');

      const step = continueRequest({ ...request, patientId: patient.id }, input);

      const recapText = request.topic
        ? `Specified: ${SUPPORT_CHAT_TOPIC_LABEL[request.topic]} for ${patient.label}`
        : `Selected: ${patient.label}`;

      const task: TaskIntent | undefined =
        step.task ?? (request.taskId ? { type: 'update', patientId: patient.id, text: request.text ?? '' } : undefined);

      return { ...step, task, patientId: patient.id, messages: [recap(recapText), ...step.messages] };
    }

    case 'select-visit': {
      const isOffered = last?.kind === 'visit-prompt' && last.options.some((o) => o.id === action.appointmentId);

      if (!request || !isOffered) throw INVALID_INPUT_ERROR('The visit is not available for selection');

      if (action.appointmentId === SUPPORT_CHAT_NO_VISIT_OPTION_ID) {
        const patient = findPatient(request.patientId, patients);

        if (!patient) throw INVALID_INPUT_ERROR('The visit is not available for selection');

        return finishRequest(request, patient, {
          recapText: request.topic
            ? `Specified: ${BOT_TEXT.noVisit}`
            : `Initiated request: ${request.text} for ${patient.label}`,
        });
      }

      const visit = visits.find((v) => v.id === action.appointmentId);
      const patient = visit ? patients.find((p) => p.id === visit.patientId) : undefined;

      if (!visit || !patient) throw INVALID_INPUT_ERROR('The visit is not available for selection');

      return finishRequest(request, patient, {
        visit,
        recapText: request.topic
          ? `Specified: ${SUPPORT_CHAT_TOPIC_LABEL[request.topic]} for the visit of ${visit.label}`
          : `Initiated request: ${request.text} for ${visit.label}`,
      });
    }

    case 'text': {
      const message: MessageDraft = { author: 'patient', kind: 'text', text: action.text };

      if (request?.taskId)
        return { messages: [message], task: { type: 'attach', text: action.text, taskId: request.taskId } };

      if (request && last?.kind === 'visit-prompt') {
        const patient = findPatient(request.patientId, patients);

        if (patient) {
          const step = finishRequest(request, patient, { details: action.text });
          return { ...step, messages: [message, ...step.messages] };
        }
      }

      if (request) return { messages: [message] };

      if (hasOpenTask && last?.kind !== 'greeting') {
        const isFirstDetails = last?.kind === 'confirmation';
        return { messages: isFirstDetails ? [message, ack()] : [message], task: { type: 'attach', text: action.text } };
      }

      const step = startFreeText(action.text, input);
      return { ...step, messages: [message, ...step.messages] };
    }
  }
}
