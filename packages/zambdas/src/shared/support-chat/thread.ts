import Oystehr, { BatchInputRequest, SearchParam, User } from '@oystehr/sdk';
import { Coding, Communication, Extension, Reference, Task } from 'fhir/r4b';
import { getAccountForUser, UserAccount } from 'utils/lib/auth/user-auth.helper';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { getPatchBinary } from 'utils/lib/fhir/resourcePatch';
import {
  GetSupportChatResponse,
  SUPPORT_CHAT_BOT_NAME,
  SUPPORT_CHAT_CATEGORY,
  SUPPORT_CHAT_MESSAGE_KIND_EXTENSION_URL,
  SUPPORT_CHAT_OPTION_EXTENSION_URL,
  SUPPORT_CHAT_STAFF_NAME,
  SUPPORT_CHAT_THREAD_SYSTEM,
  SUPPORT_CHAT_TOPIC_EXTENSION_URL,
  SupportChatAuthor,
  SupportChatMessageDto,
  SupportChatMessageKind,
  SupportChatOption,
  SupportChatTopic,
} from 'utils/lib/types/api/support-chat.types';
import { INVALID_INPUT_ERROR, NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { checkIsEHRUser } from '../auth';

export type SupportChatViewer = 'patient' | 'staff';

export interface ThreadMessage {
  kind: SupportChatMessageKind;
  topic?: SupportChatTopic;
  options: SupportChatOption[];
}

export interface NewThreadMessage {
  threadId: string;
  kind: SupportChatMessageKind;
  text: string;
  sent: string;
  sender?: Reference;
  patientId?: string;
  taskReference?: string;
  taskTitle?: string;
  topic?: SupportChatTopic;
  options?: SupportChatOption[];
}

export const makeThreadTag = (threadId: string): Coding => ({ system: SUPPORT_CHAT_THREAD_SYSTEM, code: threadId });

export const threadTagSearchParam = (threadId: string): SearchParam => ({
  name: '_tag',
  value: `${SUPPORT_CHAT_THREAD_SYSTEM}|${threadId}`,
});

export const getThreadIdFromTask = (task: Task): string | undefined =>
  task.meta?.tag?.find((tag) => tag.system === SUPPORT_CHAT_THREAD_SYSTEM)?.code;

export async function resolveThread(
  user: User,
  taskId: string | undefined,
  oystehr: Oystehr
): Promise<{ threadId: string | undefined; viewer: SupportChatViewer; isAvailable: boolean }> {
  if (!isStaffUser(user)) {
    if (taskId) throw NOT_AUTHORIZED;

    const account = await getAccountForUser(user, oystehr);
    const isAvailable = isAccountReadyForChat(account);

    return { threadId: isAvailable ? account.person?.id : undefined, viewer: 'patient', isAvailable };
  }

  if (!taskId) throw INVALID_INPUT_ERROR('"taskId" is required');

  const threadId = getThreadIdFromTask(await oystehr.fhir.get<Task>({ resourceType: 'Task', id: taskId }));

  if (!threadId) throw INVALID_INPUT_ERROR('The task has no support chat');

  return { threadId, viewer: 'staff', isAvailable: true };
}

export const isStaffUser = (user: User): boolean =>
  checkIsEHRUser(user) && Boolean(user.profile?.startsWith('Practitioner/'));

export const isAccountReadyForChat = (account: UserAccount): boolean =>
  Boolean(account.person) && account.patients.length > 0 && account.relatedPersons.length > 0;

const MAX_THREAD_MESSAGES = 1000;

export async function searchThread(oystehr: Oystehr, threadId: string): Promise<Communication[]> {
  const messages = (
    await oystehr.fhir.search<Communication>({
      resourceType: 'Communication',
      params: [
        threadTagSearchParam(threadId),
        { name: '_sort', value: '-sent' },
        { name: '_count', value: MAX_THREAD_MESSAGES },
      ],
    })
  ).unbundle();

  return messages.reverse();
}

export async function searchUnread(oystehr: Oystehr, threadId: string): Promise<Communication[]> {
  return getAllFhirSearchPages<Communication>(
    {
      resourceType: 'Communication',
      params: [threadTagSearchParam(threadId), { name: 'status', value: 'in-progress' }],
    },
    oystehr
  );
}

export function buildThreadMessage(message: NewThreadMessage): Communication {
  const author = message.sender ? getAuthorFromReference(message.sender) : 'bot';
  const extension: Extension[] = [{ url: SUPPORT_CHAT_MESSAGE_KIND_EXTENSION_URL, valueCode: message.kind }];

  if (message.topic) {
    extension.push({ url: SUPPORT_CHAT_TOPIC_EXTENSION_URL, valueCode: message.topic });
  }

  message.options?.forEach((option) =>
    extension.push({ url: SUPPORT_CHAT_OPTION_EXTENSION_URL, valueCoding: { code: option.id, display: option.label } })
  );

  return {
    resourceType: 'Communication',
    status: author === 'bot' ? 'completed' : 'in-progress',
    meta: { tag: [makeThreadTag(message.threadId)] },
    category: [{ coding: [SUPPORT_CHAT_CATEGORY] }],
    sent: message.sent,
    sender: message.sender,
    subject: message.patientId ? { reference: `Patient/${message.patientId}` } : undefined,
    about: message.taskReference ? [{ reference: message.taskReference, display: message.taskTitle }] : undefined,
    payload: [{ contentString: message.text }],
    extension,
  };
}

export function toThreadMessage(communication: Communication): ThreadMessage {
  return {
    kind: getExtension(communication, SUPPORT_CHAT_MESSAGE_KIND_EXTENSION_URL)?.valueCode as SupportChatMessageKind,
    topic: getExtension(communication, SUPPORT_CHAT_TOPIC_EXTENSION_URL)?.valueCode as SupportChatTopic | undefined,
    options: getOptions(communication),
  };
}

export function toMessageDto(communication: Communication, viewer: SupportChatViewer): SupportChatMessageDto {
  const author = getAuthor(communication);
  const { kind, options } = toThreadMessage(communication);

  return {
    id: communication.id ?? '',
    author,
    authorName: getAuthorName(communication, author, viewer),
    kind,
    text: communication.payload?.[0]?.contentString ?? '',
    sentAt: communication.sent ?? '',
    isRead: communication.status === 'completed',
    options: options.length ? options : undefined,
    requestTitle: author === 'staff' && viewer === 'patient' ? communication.about?.[0]?.display : undefined,
  };
}

export function isUnreadFor(communication: Communication, viewer: SupportChatViewer): boolean {
  if (communication.status !== 'in-progress') return false;

  const isFromPatient = getAuthor(communication) === 'patient';

  return viewer === 'staff' ? isFromPatient : !isFromPatient;
}

export const toChatResponse = (messages: Communication[], viewer: SupportChatViewer): GetSupportChatResponse => ({
  isAvailable: true,
  messages: messages.map((message) => toMessageDto(message, viewer)),
  unreadCount: messages.filter((message) => isUnreadFor(message, viewer)).length,
});

export async function markThreadRead(
  oystehr: Oystehr,
  messages: Communication[],
  viewer: SupportChatViewer
): Promise<void> {
  const requests: BatchInputRequest<Communication>[] = messages
    .filter((message) => isUnreadFor(message, viewer))
    .map((message) =>
      getPatchBinary({
        resourceType: 'Communication',
        resourceId: message.id ?? '',
        patchOperations: [{ op: 'replace', path: '/status', value: 'completed' }],
      })
    );

  if (requests.length) {
    await oystehr.fhir.batch({ requests });
  }
}

const getAuthor = (communication: Communication): SupportChatAuthor =>
  communication.sender ? getAuthorFromReference(communication.sender) : 'bot';

const getAuthorFromReference = (reference: Reference): SupportChatAuthor =>
  reference.reference?.startsWith('Practitioner/') ? 'staff' : 'patient';

function getAuthorName(communication: Communication, author: SupportChatAuthor, viewer: SupportChatViewer): string {
  if (author === 'bot') return SUPPORT_CHAT_BOT_NAME;
  if (author === 'staff' && viewer === 'patient') return SUPPORT_CHAT_STAFF_NAME;
  return communication.sender?.display ?? '';
}

const getExtension = (communication: Communication, url: string): Extension | undefined =>
  communication.extension?.find((extension) => extension.url === url);

const getOptions = (communication: Communication): SupportChatOption[] =>
  (communication.extension ?? [])
    .filter((extension) => extension.url === SUPPORT_CHAT_OPTION_EXTENSION_URL)
    .map((extension) => ({ id: extension.valueCoding?.code ?? '', label: extension.valueCoding?.display ?? '' }));
