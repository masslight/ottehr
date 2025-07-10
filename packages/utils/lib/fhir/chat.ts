import Oystehr, { BatchInputRequest, User } from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import { Communication, RelatedPerson } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  ConversationMessage,
  EvolvePatientMessageStatus,
  PATIENT_MESSAGE_CODE,
  PATIENT_MESSAGE_SYSTEM,
  RelatedPersonMaps,
  SMSModel,
  SMSRecipient,
} from '../types';
import { getPatchBinary, getPatchOperationForNewMetaTag, getSMSNumberForIndividual } from '.';

export const ZAP_SMS_MEDIUM_SYSTEM = 'http://terminology.hl7.org/CodeSystem/v3-ParticipationMode';
export const ZAP_SMS_MEDIUM_CODE = 'SMSWRIT';

export const getMessageFromComm = (communication: Communication): string => {
  if (communication.payload && communication.payload.length) {
    return communication.payload[0].contentString ?? '';
  }
  return '';
};

export const getMessageReadStatusFromComm = (communication: Communication): EvolvePatientMessageStatus | undefined => {
  return (
    (communication.meta?.tag?.find((tag) => {
      return tag.system === PATIENT_MESSAGE_SYSTEM && tag.code === 'read-by-staff';
    }) as EvolvePatientMessageStatus) || undefined
  );
};

export const getMessageHasBeenRead = (communication: Communication): boolean => {
  const sender = (communication.sender ?? { reference: 'Not/AnRP' }).reference;
  if (sender && sender.split('/')[0] === 'RelatedPerson') {
    return getMessageReadStatusFromComm(communication) !== undefined;
  }
  return true;
};

export const getChatContainsUnreadMessages = (chat: Communication[]): boolean => {
  // this should be defined but https://masslight.slack.com/archives/C065DM79L2H/p1711563326559649 says it might not be
  const readStatusList = (chat ?? []).map((comm) => getMessageHasBeenRead(comm));
  return readStatusList.find((stat) => stat === false) !== undefined;
};

export interface MakeEvolveMessageReadStatusInput {
  userId: string;
  timeRead: string;
}

export const makeMessageReadStatusTag = (input: MakeEvolveMessageReadStatusInput): EvolvePatientMessageStatus => {
  const { userId, timeRead } = input;
  return {
    system: PATIENT_MESSAGE_SYSTEM,
    code: PATIENT_MESSAGE_CODE,
    display: `${userId}-${timeRead}`,
  };
};

const makePatchOperationForReadMessage = (message: Communication, readBy: User, timeStamp?: string): Operation => {
  const timeRead = timeStamp ?? DateTime.now().toISO() ?? '';
  const userId = readBy.id;

  const metaTag = makeMessageReadStatusTag({
    timeRead,
    userId,
  });

  return getPatchOperationForNewMetaTag(message, metaTag);
};

export interface MarkChatReadInput {
  chat: ConversationMessage[];
  user: User;
  oystehr: Oystehr;
  timeStamp?: string;
}

// todo?: this could be done with AuditEvents and then we wouldn't need to query up the existing state of the
// Communication resource to make the batch requests to add the meta tags. the problem right now is this would
// require additional work mapping between zap Users and the fhir Practitioner resources associated with those users.
// if we eventually make changes to pull Practitioners (or at least references to those practitioners) on the front end
// it might be a good time to consider changing to using audit events. migrating from tags to AuditEvents should be
// fairly trivial
export const markAllMessagesRead = async (input: MarkChatReadInput): Promise<void> => {
  const { chat, user, oystehr, timeStamp } = input;
  const unreadChats = chat
    .filter((message) => {
      const { isRead, sender } = message;
      if (isRead) {
        return false;
      }
      const [senderResourceType] = sender;
      if (senderResourceType && senderResourceType !== 'Practitioner') {
        return true;
      }
      return false;
    })
    .map((c) => c.id);
  const commsToTag = (
    await oystehr.fhir.search<Communication>({
      resourceType: 'Communication',
      params: [
        {
          name: '_id',
          value: unreadChats.join(','),
        },
      ],
    })
  ).unbundle();

  const patchRequests: BatchInputRequest<Communication>[] = commsToTag.map((comm) => {
    const patchOp = makePatchOperationForReadMessage(comm, user, timeStamp);
    return getPatchBinary({
      resourceId: comm.id ?? '',
      resourceType: 'Communication',
      patchOperations: [patchOp],
    });
  });
  await oystehr.fhir.batch({ requests: patchRequests });
};

export const chunkThings = <T>(thingsToChunk: T[], chunkSize: number): T[][] => {
  const chunks: T[][] = [];

  for (let i = 0; i < thingsToChunk.length; i += chunkSize) {
    const chunk = thingsToChunk.slice(i, i + chunkSize);
    chunks.push(chunk);
  }

  return chunks;
};

export const initialsFromName = (name: string): string => {
  const parts = name.split(' ').flatMap((part) => {
    return (part.split('-') ?? []).map((subPart) => {
      return subPart.length ? subPart.charAt(0) : '';
    });
  });
  return parts.join('');
};

export function getUniquePhonesNumbers(allRps: RelatedPerson[]): string[] {
  const uniquePhoneNumbers: string[] = [];

  allRps.forEach((rp) => {
    const phone = getSMSNumberForIndividual(rp);
    if (phone && !uniquePhoneNumbers.includes(phone)) uniquePhoneNumbers.push(phone);
  });

  return uniquePhoneNumbers;
}

export const getCommunicationsAndSenders = async (
  oystehr: Oystehr,
  uniqueNumbers: string[]
): Promise<(Communication | RelatedPerson)[]> => {
  return (
    await oystehr.fhir.search<Communication | RelatedPerson>({
      resourceType: 'Communication',
      params: [
        { name: 'medium', value: ZAP_SMS_MEDIUM_CODE },
        { name: 'sender:RelatedPerson.telecom', value: uniqueNumbers.join(',') },
        { name: '_include', value: 'Communication:sender:RelatedPerson' },
      ],
    })
  ).unbundle();
};

export const createSmsModel = (patientId: string, allRelatedPersonMaps: RelatedPersonMaps): SMSModel | undefined => {
  let rps: RelatedPerson[] = [];
  try {
    rps = allRelatedPersonMaps.rpsToPatientIdMap[patientId];
    const recipients = filterValidRecipients(rps);
    if (recipients.length) {
      const allCommunications = recipients.flatMap((recipient) => {
        return allRelatedPersonMaps.commsToRpRefMap[recipient.recipientResourceUri] ?? [];
      });
      return {
        hasUnreadMessages: getChatContainsUnreadMessages(allCommunications),
        recipients,
      };
    }
  } catch (e) {
    console.log('error building sms model: ', e);
    console.log('related persons value prior to error: ', rps);
  }
  return undefined;
};

function filterValidRecipients(relatedPersons: RelatedPerson[]): SMSRecipient[] {
  // some slack alerts suggest this could be undefined, but that would mean there are patients with no RP
  // or some bug preventing rp from being returned with the query
  return relatedPersons
    .map((rp) => {
      return {
        recipientResourceUri: rp.id ? `RelatedPerson/${rp.id}` : undefined,
        smsNumber: getSMSNumberForIndividual(rp),
      };
    })
    .filter((rec) => rec.recipientResourceUri !== undefined && rec.smsNumber !== undefined) as SMSRecipient[];
}
