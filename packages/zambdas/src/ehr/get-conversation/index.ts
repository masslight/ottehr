import Oystehr, { BatchInputGetRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Bundle, Communication, Device, Patient, Practitioner, RelatedPerson } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  chunkThings,
  getFirstName,
  getFullestAvailableName,
  getLastName,
  getMessageFromComm,
  getMessageHasBeenRead,
} from 'utils';
import { getSecret, Secrets, SecretsKeys } from 'zambda-utils';
import { getAuth0Token } from '../shared';
import { topLevelCatch } from '../shared/errors';
import { createOystehrClient } from '../shared/helpers';
import { ZambdaInput } from 'zambda-utils';

export interface GetConversationInput {
  secrets: Secrets | null;
  smsNumbers: string[];
  timezone: string;
}

interface ProtoConversationItem {
  id: string;
  sender: string;
  sentWhen: string;
  content: string;
  isRead: boolean;
  isFromPatient: boolean;
}

interface ConversationItem {
  id: string;
  sender: string;
  sentDay: string;
  sentTime: string;
  content: string;
  isRead: boolean;
  isFromPatient: boolean;
}

let zapehrToken: string;
const CHUNK_SIZE = 100;
const MAX_MESSAGE_COUNT = '1000';

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { secrets, smsNumbers, timezone } = validatedParameters;
    console.groupEnd();
    if (!zapehrToken) {
      console.log('getting token');
      zapehrToken = await getAuth0Token(secrets);
    } else {
      console.log('already have token');
    }

    const oystehr = createOystehrClient(zapehrToken, secrets);
    const uniqueNumbers = Array.from(new Set(smsNumbers));
    const smsQuery = uniqueNumbers.map((number) => `${number}`).join(',');
    console.log('smsQuery', smsQuery);
    console.time('sms-query');
    const allRecipients = (
      await oystehr.fhir.search({
        resourceType: 'RelatedPerson',
        params: [{ name: 'telecom', value: smsQuery }],
      })
    )
      .unbundle()
      .map((recip) => `RelatedPerson/${recip.id}`);
    console.timeEnd('sms-query');
    console.log(
      `found ${allRecipients.length} related persons with the sms number ${smsQuery}; searching messages for all those recipients`
    );

    console.time('get_sent_and_received_messages');
    const [sentMessages, receivedMessages] = await Promise.all([
      // todo: use safe batch pattern here :(
      getSentMessages(allRecipients, oystehr),
      getReceivedMessages(allRecipients, oystehr),
    ]);
    console.timeEnd('get_sent_and_received_messages');

    console.time('structure_convo_data');
    const rpMap: Record<string, RelatedPerson> = {};
    const senderMap: Record<string, Device | Practitioner> = {};
    const patientMap: Record<string, Patient> = {};
    const sentCommunications: Communication[] = [];
    const receivedCommunications: Communication[] = [];

    sentMessages.forEach((resource) => {
      if (resource.resourceType === 'Communication') {
        sentCommunications.push(resource as Communication);
      } else if (resource.resourceType === 'Device' && resource.id) {
        senderMap[`Device/${resource.id}`] = resource as Device;
      } else if (resource.resourceType === 'Practitioner' && resource.id) {
        senderMap[`Practitioner/${resource.id}`] = resource as Practitioner;
      }
    });

    receivedMessages.forEach((resource) => {
      if (resource.resourceType === 'Communication') {
        receivedCommunications.push(resource as Communication);
      } else if (resource.resourceType === 'RelatedPerson' && resource.id) {
        rpMap[`RelatedPerson/${resource.id}`] = resource as RelatedPerson;
      } else if (resource.resourceType === 'Patient' && resource.id) {
        patientMap[`Patient/${resource.id}`] = resource as Patient;
      }
    });

    console.log('sent messages found: ', sentCommunications.length);
    console.log('received messages found: ', receivedCommunications.length);

    const sentMessagesToReturn: ProtoConversationItem[] = sentCommunications.map((comm: Communication) => {
      const content = getMessageFromComm(comm);

      return {
        id: comm.id ?? '',
        content,
        isRead: true,
        sentWhen: comm.sent ?? '',
        sender: getSenderNameFromComm(comm, senderMap),
        isFromPatient: false,
      };
    });

    const receivedMessagesToReturn: ProtoConversationItem[] = receivedCommunications.map((comm: Communication) => {
      const content = getMessageFromComm(comm);
      const sender = getPatientSenderNameFromComm(comm, rpMap, patientMap);
      return {
        id: comm.id ?? '',
        content,
        isRead: getMessageHasBeenRead(comm),
        sentWhen: comm.sent ?? '',
        sender,
        isFromPatient: true,
      };
    });

    const allMessages: ConversationItem[] = [...sentMessagesToReturn, ...receivedMessagesToReturn]
      .sort((m1, m2) => {
        const time1 = DateTime.fromISO(m1.sentWhen);
        const time2 = DateTime.fromISO(m2.sentWhen);

        if (time1.equals(time2)) {
          return 0;
        }
        return time1 < time2 ? -1 : 1;
      })
      .map((message) => {
        const { id, sentWhen, content, isRead, sender, isFromPatient } = message;
        const dateTime = DateTime.fromISO(sentWhen).setZone(timezone);
        const sentDay = dateTime.toLocaleString(
          { day: 'numeric', month: 'numeric', year: '2-digit' },
          { locale: 'en-us' }
        );
        const sentTime = dateTime.toLocaleString({ timeStyle: 'short' }, { locale: 'en-us' });
        return {
          id,
          content,
          isRead,
          sender,
          sentDay,
          sentTime,
          isFromPatient,
        };
      });
    console.time('structure_convo_data');

    console.log('messages to return: ', allMessages.length);

    return {
      statusCode: 200,
      body: JSON.stringify(allMessages),
    };
  } catch (error: any) {
    await topLevelCatch('get-conversation', error, input.secrets);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

function validateRequestParameters(input: ZambdaInput): GetConversationInput {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const secrets = input.secrets;
  const env = getSecret(SecretsKeys.ENVIRONMENT, secrets);
  const smsPhoneRegex = env === 'production' ? /^(\+1)\d{10}$/ : /^\+\d{1,3}\d{10}$/;
  const { smsNumbers, timezone } = JSON.parse(input.body);

  if (smsNumbers === undefined || smsNumbers.length === 0) {
    throw new Error('These fields are required: "smsNumbers"');
  }

  if (timezone === undefined) {
    throw new Error('These fields are required: "timezone"');
  }

  const now = DateTime.now().setZone(timezone);
  if (!now.isValid) {
    throw new Error(`Field "timezone" is invalid ${now.invalidExplanation ?? ''}`);
  }

  smsNumbers.forEach((smsNumber: any) => {
    if (typeof smsNumber !== 'string') {
      throw new Error('Field "smsNumbers" must be a list of strings');
    }
    if (!smsPhoneRegex.test(smsNumber)) {
      throw new Error('smsNumber must be of the form "+1", followed by 10 digits');
    }
  });

  return {
    smsNumbers: Array.from(new Set(smsNumbers)),
    timezone,
    secrets: input.secrets,
  };
}

const getPatientSenderNameFromComm = (
  communication: Communication,
  rpMap: Record<string, RelatedPerson>,
  patientMap: Record<string, Patient>
): string => {
  const senderRef = communication.sender?.reference;
  if (senderRef && rpMap[senderRef]) {
    const parent = rpMap[senderRef] as RelatedPerson;
    const patient = patientMap[parent.patient.reference ?? ''];

    let firstName = getFirstName(patient);
    let lastName = getLastName(patient);

    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    } else if (patient) {
      firstName = getFirstName(parent);
      lastName = getLastName(parent);
    }

    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    } else if (firstName) {
      return firstName;
    } else if (lastName) {
      return lastName;
    }
  }
  return 'Patient, Parent or Guardian';
};

const getSenderNameFromComm = (communication: Communication, map: Record<string, Device | Practitioner>): string => {
  const senderRef = communication.sender?.reference;
  if (senderRef && map[senderRef]) {
    const resource = map[senderRef];

    if (resource.resourceType === 'Device') {
      return 'Automated Message';
    } else {
      const practitioner = resource as Practitioner;

      const name = getFullestAvailableName(practitioner);
      if (name) {
        return name;
      }
    }
  }
  return 'Ottehr Team';
};

const getReceivedMessages = async (
  relatedPersonRefs: string[],
  oystehr: Oystehr
): Promise<(Communication | RelatedPerson | Patient)[]> => {
  if (relatedPersonRefs.length <= CHUNK_SIZE) {
    return (
      await oystehr.fhir.search<Communication | RelatedPerson | Patient>({
        resourceType: 'Communication',
        params: [
          { name: 'sender', value: relatedPersonRefs.join(',') },
          { name: '_sort', value: '-sent' },
          { name: '_count', value: MAX_MESSAGE_COUNT },
          { name: 'sent:missing', value: 'false' },
          { name: '_include', value: 'Communication:sender:RelatedPerson' },
          { name: '_include:iterate', value: 'RelatedPerson:patient' },
          { name: 'medium', value: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationMode|SMSWRIT' },
        ],
      })
    ).unbundle();
  }
  const batchGroups = chunkThings(relatedPersonRefs, CHUNK_SIZE);
  const searchRequests: BatchInputGetRequest[] = batchGroups.map((ids) => {
    return {
      url: `Communication?sender=${ids.join(
        ','
      )}&medium=http://terminology.hl7.org/CodeSystem/v3-ParticipationMode|SMSWRIT&_sort=-sent&_count=${MAX_MESSAGE_COUNT}&sent:missing=false&_include=Communication:sender:RelatedPerson&_include:iterate=RelatedPerson:patient`,
      method: 'GET',
    };
  });
  const batchResults = await oystehr.fhir.batch({
    requests: searchRequests,
  });
  const entries = (batchResults.entry ?? []).flatMap((be) => {
    if (
      be.response?.outcome?.id === 'ok' &&
      be.resource &&
      be.resource.resourceType === 'Bundle' &&
      be.resource.type === 'searchset'
    ) {
      const innerBundle = be.resource as Bundle;
      const innerEntry = innerBundle.entry;
      if (!innerEntry) {
        return [];
      } else {
        return (innerBundle.entry ?? []).map((ibe) => ibe.resource as Communication | RelatedPerson | Patient);
      }
    } else {
      return [];
    }
  });
  const idSet = new Set<string>();

  return entries.filter((entry) => {
    const { id, resourceType } = entry;
    if (!id) {
      return false;
    }
    if (idSet.has(`${resourceType}/${id}`)) {
      return false;
    } else {
      idSet.add(`${resourceType}/${id}`);
      return true;
    }
  });
};

const getSentMessages = async (
  relatedPersonRefs: string[],
  oystehr: Oystehr
): Promise<(Communication | Device | Practitioner)[]> => {
  console.time('get_sent_messages');
  if (relatedPersonRefs.length <= CHUNK_SIZE) {
    const results = (
      await oystehr.fhir.search<Communication | Device | Practitioner>({
        resourceType: 'Communication',
        params: [
          { name: 'recipient', value: relatedPersonRefs.join(',') },
          { name: '_sort', value: '-sent' },
          { name: '_count', value: MAX_MESSAGE_COUNT },
          { name: 'sent:missing', value: 'false' },
          { name: '_include', value: 'Communication:sender:Practitioner' },
          { name: '_include', value: 'Communication:sender:Device' },
          { name: 'medium', value: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationMode|SMSWRIT' },
        ],
      })
    ).unbundle();
    console.timeEnd('get_sent_messages');
    return results;
  }
  const batchGroups = chunkThings(relatedPersonRefs, CHUNK_SIZE);
  const searchRequests: BatchInputGetRequest[] = batchGroups.map((ids) => {
    return {
      url: `Communication?recipient=${ids.join(
        ','
      )}&medium=http://terminology.hl7.org/CodeSystem/v3-ParticipationMode|SMSWRIT&_sort=-sent&_count=${MAX_MESSAGE_COUNT}&sent:missing=false&_include=Communication:sender:Practitioner&_include=Communication:sender:Device`,
      method: 'GET',
    };
  });
  const batchResults = await oystehr.fhir.batch({
    requests: searchRequests,
  });
  const entries = (batchResults.entry ?? []).flatMap((be) => {
    if (
      be.response?.outcome?.id === 'ok' &&
      be.resource &&
      be.resource.resourceType === 'Bundle' &&
      be.resource.type === 'searchset'
    ) {
      const innerBundle = be.resource as Bundle;
      const innerEntry = innerBundle.entry;
      if (!innerEntry) {
        return [];
      } else {
        return (innerBundle.entry ?? []).map((ibe) => ibe.resource as Communication | Device | Practitioner);
      }
    } else {
      return [];
    }
  });
  const idSet = new Set<string>();
  console.timeEnd('get_sent_messages');
  return entries.filter((entry) => {
    const { id, resourceType } = entry;
    if (!id) {
      return false;
    }
    if (idSet.has(`${resourceType}/${id}`)) {
      return false;
    } else {
      idSet.add(`${resourceType}/${id}`);
      return true;
    }
  });
};
