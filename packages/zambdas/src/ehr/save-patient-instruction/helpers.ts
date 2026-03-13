import Oystehr from '@oystehr/sdk';
import { Communication } from 'fhir/r4b';
import { PATIENT_INSTRUCTIONS_TEMPLATE_CODE } from 'utils';
import { fillMeta } from '../../shared/helpers';

export async function checkIfProvidersInstruction(
  communicationId: string,
  myUserProfile: string,
  oystehr: Oystehr
): Promise<void> {
  const resource: Communication = await oystehr.fhir.get({
    resourceType: 'Communication',
    id: communicationId,
  });
  const communicationSender = resource.sender?.reference;
  if (communicationSender) {
    if (myUserProfile !== communicationSender) throw new Error('This resource belongs to another practitioner');
  }
}

type CreateCommunicationResourceParams = {
  practitionerProfile: string;
  oystehr: Oystehr;
  text?: string;
  title?: string;
};

export async function createCommunicationResource({
  practitionerProfile,
  oystehr,
  text,
  title,
}: CreateCommunicationResourceParams): Promise<Communication> {
  const communicationResource: Communication = {
    resourceType: 'Communication',
    status: 'completed',
    sender: { reference: practitionerProfile },
    ...(title && {
      topic: {
        text: title,
      },
    }),

    ...(text && {
      payload: [
        {
          contentString: text,
        },
      ],
    }),
    meta: fillMeta(PATIENT_INSTRUCTIONS_TEMPLATE_CODE, PATIENT_INSTRUCTIONS_TEMPLATE_CODE),
  };
  return await oystehr.fhir.create(communicationResource);
}

type UpdateCommunicationResourceParams = {
  communicationId: string;
  oystehr: Oystehr;
  text?: string;
  title?: string;
};

export async function updateCommunicationResource({
  communicationId,
  oystehr,
  text,
  title,
}: UpdateCommunicationResourceParams): Promise<Communication> {
  const existing = await oystehr.fhir.get<Communication>({
    resourceType: 'Communication',
    id: communicationId,
  });

  const operations: any[] = [];

  if (text !== undefined) {
    const hasPayload = Array.isArray(existing.payload) && existing.payload.length > 0;
    const hasText = hasPayload && !!existing.payload?.[0]?.contentString;

    if (text && text.trim().length > 0) {
      if (hasText) {
        operations.push({
          op: 'replace',
          path: '/payload/0/contentString',
          value: text,
        });
      } else if (hasPayload) {
        operations.push({
          op: 'add',
          path: '/payload/0/contentString',
          value: text,
        });
      } else {
        operations.push({
          op: 'add',
          path: '/payload',
          value: [{ contentString: text }],
        });
      }
    } else {
      if (hasPayload) {
        operations.push({
          op: 'remove',
          path: '/payload',
        });
      }
    }
  }

  if (title !== undefined) {
    const hasTopic = !!existing.topic?.text;

    if (title && title.trim().length > 0) {
      if (hasTopic) {
        operations.push({
          op: 'replace',
          path: '/topic/text',
          value: title,
        });
      } else {
        operations.push({
          op: 'add',
          path: '/topic',
          value: { text: title },
        });
      }
    } else {
      if (existing.topic) {
        operations.push({
          op: 'remove',
          path: '/topic',
        });
      }
    }
  }

  if (operations.length === 0) {
    return existing;
  }

  return await oystehr.fhir.patch<Communication>({
    resourceType: 'Communication',
    id: communicationId,
    operations,
  });
}
