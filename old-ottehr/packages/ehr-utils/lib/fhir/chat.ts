import { Communication, Patient, Person, Practitioner, RelatedPerson } from 'fhir/r4';
import {
  ConversationMessage,
  OTTEHR_PATIENT_MESSAGE_CODE,
  OTTEHR_PATIENT_MESSAGE_SYSTEM,
  OttehrPatientMessageStatus,
  RelatedPersonMaps,
  SMSModel,
  SMSRecipient,
} from '../types';
import { BatchInputRequest, FhirClient, User } from '@zapehr/sdk';
import { DateTime } from 'luxon';
import { Operation } from 'fast-json-patch';
import { getPatchBinary, getPatchOperationForNewMetaTag } from '.';

export const ZAP_SMS_MEDIUM_SYSTEM = 'http://terminology.hl7.org/CodeSystem/v3-ParticipationMode';
export const ZAP_SMS_MEDIUM_CODE = 'SMSWRIT';

export const getMessageFromComm = (communication: Communication): string => {
  if (communication.payload && communication.payload.length) {
    return communication.payload[0].contentString ?? '';
  }
  return '';
};

export const getMessageReadStatusFromComm = (communication: Communication): OttehrPatientMessageStatus | undefined => {
  return (
    (communication.meta?.tag?.find((tag) => {
      return tag.system === OTTEHR_PATIENT_MESSAGE_SYSTEM && tag.code === 'read-by-ottehr';
    }) as OttehrPatientMessageStatus) || undefined
  );
};

export const getMessageHasBeenReadByOttehr = (communication: Communication): boolean => {
  const sender = (communication.sender ?? { reference: 'Not/AnRP' }).reference;
  if (sender && sender.split('/')[0] === 'RelatedPerson') {
    return getMessageReadStatusFromComm(communication) !== undefined;
  }
  return true;
};

export const getChatContainsUnreadMessages = (chat: Communication[]): boolean => {
  const readStatusList = (chat ?? []).map((comm) => getMessageHasBeenReadByOttehr(comm));
  return readStatusList.find((stat) => stat === false) !== undefined;
};

export const getCommunicationsAndSenders = async (
  fhirClient: FhirClient,
  uniqueNumbers: string[],
): Promise<(Communication | RelatedPerson)[]> => {
  return await fhirClient.searchResources<Communication | RelatedPerson>({
    resourceType: 'Communication',
    searchParams: [
      { name: 'medium', value: ZAP_SMS_MEDIUM_CODE },
      { name: 'sender:RelatedPerson.telecom', value: uniqueNumbers.join(',') },
      { name: '_include', value: 'Communication:sender:RelatedPerson' },
    ],
  });
};

export function getUniquePhonesNumbers(allRps: RelatedPerson[]): string[] {
  const uniquePhoneNumbers: string[] = [];

  allRps.forEach((rp) => {
    const phone = getSMSNumberForIndividual(rp);
    if (phone && !uniquePhoneNumbers.includes(phone)) uniquePhoneNumbers.push(phone);
  });

  return uniquePhoneNumbers;
}

export const createSmsModel = (patientId: string, allRelatedPersonMaps: RelatedPersonMaps): SMSModel | undefined => {
  let rps: RelatedPerson[] = [];
  try {
    rps = allRelatedPersonMaps.rpsToPatientIdMap[patientId];
    const recipients = filterValidRecipients(rps);
    if (recipients.length) {
      const allComs = recipients.flatMap((recip) => {
        return allRelatedPersonMaps.commsToRpRefMap[recip.relatedPersonId] ?? [];
      });
      return {
        hasUnreadMessages: getChatContainsUnreadMessages(allComs),
        recipients,
      };
    }
  } catch (e) {
    console.log('error building sms model: ', e);
    console.log('related persons value prior to error: ', rps);
  }
  return undefined;
};

export interface MakeOttehrMessageReadStatusInput {
  userId: string;
  timeRead: string;
}

export const makeMessageReadStatusTag = (input: MakeOttehrMessageReadStatusInput): OttehrPatientMessageStatus => {
  const { userId, timeRead } = input;
  return {
    system: OTTEHR_PATIENT_MESSAGE_SYSTEM,
    code: OTTEHR_PATIENT_MESSAGE_CODE,
    display: `${userId}-${timeRead}`,
  };
};

type MightReceiveTexts = RelatedPerson | Patient | Person | Practitioner;
export const getSMSNumberForIndividual = (individual: MightReceiveTexts): string | undefined => {
  const { telecom } = individual;
  return (telecom ?? []).find((cp) => {
    // format starts with +1; this is some lazy but probably good enough validation
    return cp.system === 'sms' && cp.value?.startsWith('+');
  })?.value;
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
  fhirClient: FhirClient;
  timeStamp?: string;
}

// todo?: this could be done with AuditEvents and then we wouldn't need to query up the existing state of the
// Communication resource to make the batch requests to add the meta tags. the problem right now is this would
// require additional work mapping between zap Users and the fhir Pracitioner resources associated with those users.
// if we eventually make changes to pull Practitioners (or at least references to those practitioners) on the front end
// it might be a good time to consider changing to using audit events. migrating from tags to AuditEvents should be
// fairly trivial
export const markAllMessagesRead = async (input: MarkChatReadInput): Promise<void> => {
  const { chat, user, fhirClient, timeStamp } = input;
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
  const commsToTag = await fhirClient.searchResources<Communication>({
    resourceType: 'Communication',
    searchParams: [
      {
        name: '_id',
        value: unreadChats.join(','),
      },
    ],
  });

  const patchRequests: BatchInputRequest[] = commsToTag.map((comm) => {
    const patchOp = makePatchOperationForReadMessage(comm, user, timeStamp);
    return getPatchBinary({
      resourceId: comm.id ?? '',
      resourceType: 'Communication',
      patchOperations: [patchOp],
    });
  });
  await fhirClient?.batchRequest({ requests: patchRequests });
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
  if (name === 'Ottehr Staff' || name === 'Ottehr Team') {
    return 'Ottehr';
  }

  const parts = name.split(' ').flatMap((part) => {
    return (part.split('-') ?? []).map((subPart) => {
      return subPart.length ? subPart.charAt(0) : '';
    });
  });
  return parts.join('');
};

function filterValidRecipients(relatedPersons: RelatedPerson[]): SMSRecipient[] {
  // some slack alerts suggest this could be undefined, but that would mean there are patients with no RP
  // or some bug preventing rp from being returned with the query
  return relatedPersons
    .map((rp) => {
      return {
        recipientResourceUri: rp.id ? `RelatedPerson/${rp.id}` : undefined,
        smsNumber: getSMSNumberForIndividual(rp),
        relatedPersonId: rp.id,
      };
    })
    .filter((rec) => rec.recipientResourceUri !== undefined && rec.smsNumber !== undefined) as SMSRecipient[];
}
