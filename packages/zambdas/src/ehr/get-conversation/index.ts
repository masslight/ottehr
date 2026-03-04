import Oystehr, { BatchInputGetRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Bundle, Communication, Device, Patient, Practitioner, RelatedPerson } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  BRANDING_CONFIG,
  chunkThings,
  GetConversationInput,
  getFirstName,
  getFullestAvailableName,
  getLastName,
  getMessageFromComm,
  getMessageHasBeenRead,
  getSecret,
  Secrets,
  SecretsKeys,
} from 'utils';
import { getAuth0Token, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { createOystehrClient } from '../../shared/helpers';

export interface GetConversationInputValidated extends GetConversationInput {
  secrets: Secrets;
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

let oystehrToken: string;
const CHUNK_SIZE = 100;
const MAX_MESSAGE_COUNT = '1000';

export const index = wrapHandler('get-conversation', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { patientId, timezone, secrets } = validatedParameters;
    console.groupEnd();
    if (!oystehrToken) {
      console.log('getting token');
      oystehrToken = await getAuth0Token(secrets);
    } else {
      console.log('already have token');
    }

    const oystehr = createOystehrClient(oystehrToken, secrets);

    const relatedResults = (
      await oystehr.fhir.search<RelatedPerson>({
        resourceType: 'RelatedPerson',
        params: [{ name: 'patient', value: `Patient/${patientId}` }],
      })
    ).unbundle();

    const relatedPersonRefs = relatedResults.filter((r) => r.id).map((r) => `RelatedPerson/${r.id}`);

    if (relatedPersonRefs.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify([]),
      };
    }

    const [sentMessages, receivedMessages] = await Promise.all([
      getSentMessages(relatedPersonRefs, oystehr),
      getReceivedMessages(relatedPersonRefs, oystehr),
    ]);

    console.time('structure_conversation_data');
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

    const dedupedSentMessages = dedupeCommunications(sentCommunications);

    const sentItems: ProtoConversationItem[] = dedupedSentMessages.map((comm) => ({
      id: comm.id ?? '',
      content: getMessageFromComm(comm),
      isRead: true,
      sentWhen: comm.sent ?? '',
      sender: getSenderNameFromComm(comm, senderMap),
      isFromPatient: false,
    }));

    const receivedItems: ProtoConversationItem[] = receivedCommunications.map((comm) => ({
      id: comm.id ?? '',
      content: getMessageFromComm(comm),
      isRead: getMessageHasBeenRead(comm),
      sentWhen: comm.sent ?? '',
      sender: getPatientSenderNameFromComm(comm, rpMap, patientMap),
      isFromPatient: true,
    }));

    const allMessages: ConversationItem[] = [...sentItems, ...receivedItems]
      .sort((m1, m2) => {
        const t1 = DateTime.fromISO(m1.sentWhen);
        const t2 = DateTime.fromISO(m2.sentWhen);
        if (t1.equals(t2)) return 0;
        return t1 < t2 ? -1 : 1;
      })
      .map((m) => {
        const dt = DateTime.fromISO(m.sentWhen).setZone(timezone);

        return {
          id: m.id,
          content: m.content,
          isRead: m.isRead,
          sender: m.sender,
          isFromPatient: m.isFromPatient,
          sentDay: dt.toLocaleString({ day: 'numeric', month: 'numeric', year: '2-digit' }, { locale: 'en-us' }),
          sentTime: dt.toLocaleString({ timeStyle: 'short' }, { locale: 'en-us' }),
        };
      });
    console.time('structure_conversation_data');

    console.log('messages to return: ', allMessages.length);

    return {
      statusCode: 200,
      body: JSON.stringify(allMessages),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('get-conversation', error, ENVIRONMENT);
  }
});

function validateRequestParameters(input: ZambdaInput): GetConversationInputValidated {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  if (!input.secrets) {
    throw new Error('No secrets provided');
  }

  const { patientId, timezone } = JSON.parse(input.body);

  if (!patientId) {
    throw new Error('Field "patientId" is required');
  }

  if (!timezone) {
    throw new Error('Field "timezone" is required');
  }

  const now = DateTime.now().setZone(timezone);
  if (!now.isValid) {
    throw new Error(`Field "timezone" is invalid ${now.invalidExplanation ?? ''}`);
  }

  return {
    patientId,
    timezone,
    secrets: input.secrets,
  };
}

function dedupeCommunications(comms: Communication[], gapMs = 500): Communication[] {
  const sorted = [...comms].sort((a, b) => {
    const t1 = new Date(a.sent ?? 0).getTime();
    const t2 = new Date(b.sent ?? 0).getTime();
    return t1 - t2;
  });

  const groups = new Map<string, Communication[]>();

  for (const c of sorted) {
    const content = c.payload?.[0]?.contentString ?? '';
    const sender = c.sender?.reference ?? 'unknown';
    const key = `${content}_${sender}`;

    const currentTime = new Date(c.sent ?? 0).getTime();

    if (!groups.has(key)) {
      groups.set(key, [c]);
      continue;
    }

    const group = groups.get(key)!;
    const last = group[group.length - 1];
    const lastTime = new Date(last.sent ?? 0).getTime();

    if (Math.abs(currentTime - lastTime) > gapMs) {
      group.push(c);
    }
  }

  return Array.from(groups.values()).flat();
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
  return `${BRANDING_CONFIG.projectName} Team`;
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
