import { BatchInputPatchRequest } from '@zapehr/sdk';
import { Operation } from 'fast-json-patch';
import { Coding, Extension, Resource } from 'fhir/r4';

export interface GetPatchBinaryInput {
  resourceId: string;
  resourceType: string;
  patchOperations: Operation[];
}

export function getPatchBinary(input: GetPatchBinaryInput): BatchInputPatchRequest {
  const { resourceId, resourceType, patchOperations } = input;
  return {
    method: 'PATCH',
    url: `/${resourceType}/${resourceId}`,
    resource: {
      resourceType: 'Binary',
      // data is handled due to bug with non latin1 characters
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

export const getPatchOperationToRemoveMetaTags = (resource: Resource, tagsToRemove: Coding[]): Operation => {
  if (resource.meta == undefined) {
    return {
      op: 'add',
      path: '/meta',
      value: {
        tag: [],
      },
    };
  } else if (resource.meta?.tag == undefined) {
    return {
      op: 'add',
      path: '/meta/tag',
      value: [],
    };
  }
  const currentTags = resource.meta?.tag ?? [];
  const filtered = currentTags.filter((coding) => {
    return !tagsToRemove.some((ttr) => {
      return ttr.code === coding.code && ttr.system === coding.system;
    });
  });
  return {
    op: 'replace',
    path: '/meta/tag',
    value: filtered,
  };
};

export const getPatchOperationToUpdateExtension = (
  resource: { extension?: Extension[] },
  newExtension: { url: Extension['url']; valueString: Extension['valueString'] },
): Operation | undefined => {
  if (!resource.extension) {
    return {
      op: 'add',
      path: '/extension',
      value: [newExtension],
    };
  }

  const extension = resource.extension;
  let requiresUpdate = false;

  if (extension.length > 0) {
    const existingExtIndex = extension.findIndex((ext) => ext.url === newExtension.url);
    // check if formUser exists and needs to be updated and if so, update
    if (existingExtIndex >= 0 && extension[existingExtIndex].valueString !== newExtension.valueString) {
      extension[existingExtIndex] = newExtension;
      requiresUpdate = true;
    } else if (existingExtIndex < 0) {
      // if form user does not exist within the extension
      // push to patientExtension array
      extension.push(newExtension);
      requiresUpdate = true;
    }
  } else {
    // since no extensions exist, it must be added via patch operations
    extension.push(newExtension);
    requiresUpdate = true;
  }

  if (requiresUpdate) {
    return {
      op: 'replace',
      path: '/extension',
      value: extension,
    };
  }

  return undefined;
};

// todo:
export const getPatchOperationToRemoveExtension = (
  resource: { extension?: Extension[] },
  extensionToRemove: { url: Extension['url'] },
): Operation | undefined => {
  if (!resource.extension || resource.extension.length === 0) {
    return undefined;
  }

  const extension = resource.extension;

  const existingExtIndex = extension.findIndex((ext) => ext.url === extensionToRemove.url);
  // check if formUser exists and needs to be updated and if so, update
  if (existingExtIndex < 0) {
    return undefined;
  }

  if (extension.length > 1) {
    return {
      op: 'remove',
      path: `/extension/${existingExtIndex}`,
    };
  } else {
    return {
      op: 'remove',
      path: '/extension',
    };
  }
};
