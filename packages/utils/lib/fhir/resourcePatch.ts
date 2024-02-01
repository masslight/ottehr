import { BatchInputRequest } from '@zapehr/sdk';
import { Operation } from 'fast-json-patch';
import { Coding, Resource } from 'fhir/r4';

export interface GetPatchBinaryInput {
  resourceId: string;
  resourceType: string;
  patchOperations: Operation[];
}

export function getPatchBinary(input: GetPatchBinaryInput): BatchInputRequest {
  const { resourceId, resourceType, patchOperations } = input;
  return {
    method: 'PATCH',
    url: `/${resourceType}/${resourceId}`,
    resource: {
      resourceType: 'Binary',
      data: btoa(unescape(encodeURIComponent(JSON.stringify(patchOperations)))),
      contentType: 'application/json-patch+json',
    },
  };
}

export const getPatchOperationForNewMetaTag = (resource: Resource, newTag: Coding): Operation => {
  if (resource.meta == undefined) {
    return {
      op: 'add',
      path: '/meta',
      value: {
        tag: [
          {
            ...newTag,
          },
        ],
      },
    };
  } else if (resource.meta?.tag == undefined) {
    return {
      op: 'add',
      path: '/meta/tag',
      value: [
        {
          ...newTag,
        },
      ],
    };
  }
  const currentTags = resource.meta?.tag ?? [];
  const existingTagIdx = currentTags.findIndex((coding) => {
    return coding.system === newTag.system;
  });
  if (existingTagIdx >= 0) {
    return {
      op: 'replace',
      path: `/meta/tag/${existingTagIdx}/code`,
      value: newTag.code,
    };
  } else {
    return {
      op: 'add',
      path: '/meta/tag/-',
      value: newTag,
    };
  }
};
