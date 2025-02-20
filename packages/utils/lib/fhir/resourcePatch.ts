import { BatchInputPatchRequest } from '@oystehr/sdk';
import { Operation, AddOperation, RemoveOperation, ReplaceOperation } from 'fast-json-patch';
import { Coding, Extension, FhirResource, Period, Resource } from 'fhir/r4b';
import { get as lodashGet } from 'lodash-es';

export interface GetPatchBinaryInput {
  resourceId: string;
  resourceType: string;
  patchOperations: Operation[];
}

export function getPatchBinary(input: GetPatchBinaryInput): BatchInputPatchRequest<FhirResource> {
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

export const getPatchOperationsForNewMetaTags = (resource: Resource, newTags: Coding[]): Operation[] => {
  if (resource.meta == undefined) {
    return [
      {
        op: 'add',
        path: '/meta',
        value: {
          tag: [...newTags],
        },
      },
    ];
  } else if (resource.meta?.tag == undefined) {
    return [
      {
        op: 'add',
        path: '/meta/tag',
        value: [...newTags],
      },
    ];
  }
  const currentTags = (resource.meta?.tag ?? []).filter((currentTag) => {
    const replaced = newTags.some((newTag) => {
      return currentTag.system === newTag.system;
    });
    return !replaced;
  });
  return [
    {
      op: 'replace',
      path: '/meta/tag',
      value: [...currentTags, ...newTags],
    },
  ];
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
  newExtension: { url: Extension['url'] } & (
    | { valueString: Extension['valueString'] }
    | { valueDate: Extension['valueDate'] }
    | { valueBoolean: Extension['valueBoolean'] }
  )
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

  const existingExtIndex = extension.findIndex((ext) => ext.url === newExtension.url);

  if (existingExtIndex >= 0) {
    // check if formUser exists and needs to be updated and if so, update
    const existingExt = extension[existingExtIndex];
    if ('valueString' in newExtension && 'valueString' in existingExt) {
      if (existingExt.valueString !== newExtension.valueString) {
        extension[existingExtIndex] = newExtension;
        requiresUpdate = true;
      }
    } else if ('valueDate' in newExtension && 'valueDate' in existingExt) {
      if (existingExt.valueDate !== newExtension.valueDate) {
        extension[existingExtIndex] = newExtension;
        requiresUpdate = true;
      }
    } else if ('valueBoolean' in newExtension && 'valueBoolean' in existingExt) {
      if (existingExt.valueBoolean !== newExtension.valueBoolean) {
        extension[existingExtIndex] = newExtension;
        requiresUpdate = true;
      }
    }
  } else {
    // if form user does not exist within the extension
    // push to patientExtension array
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
  extensionToRemove: { url: Extension['url'] }
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

export interface ContactTelecomConfig {
  system: string;
  use?: string;
  rank?: number;
  period?: Period;
}

interface ContactPoint extends ContactTelecomConfig {
  value: string;
}

const get = (obj: any, path: string): any => {
  return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
};

export function createPatchOperationForTelecom(
  newValue: string | boolean,
  contactTelecomConfig: ContactTelecomConfig,
  resource: Resource,
  path: string
): Operation | undefined {
  const arrayPath = path.split('/').slice(0, -2).join('/');
  const existingArray = get(resource, arrayPath.slice(1)) as Array<ContactPoint> | undefined;
  const existingIndex = existingArray?.findIndex((item) => item.system === contactTelecomConfig.system) ?? -1;
  const existingValue = existingIndex > -1 ? existingArray?.[existingIndex].value : undefined;

  if (newValue !== existingValue) {
    if (!newValue || newValue === '') {
      // Remove value if it exists
      if (existingIndex > -1) {
        if (existingArray?.length === 1) {
          // If it's the last item, remove the whole array
          return { op: 'remove', path: arrayPath };
        }
        // Remove specific item
        return { op: 'remove', path: `${arrayPath}/${existingIndex}` };
      }
    } else if (existingIndex > -1) {
      // Update existing value
      return {
        op: 'replace',
        path: `${arrayPath}/${existingIndex}/value`,
        value: newValue,
      };
    } else {
      // Add new item with system
      const newItem = {
        system: contactTelecomConfig.system,
        value: newValue,
        ...(contactTelecomConfig.use ? { use: contactTelecomConfig.use } : {}),
        ...(contactTelecomConfig.rank ? { rank: contactTelecomConfig.rank } : {}),
      };

      if (!existingArray && !path.startsWith('/telecom/')) {
        // Create new array with item
        return {
          op: 'add',
          path: arrayPath,
          value: [newItem],
        };
      }
      // Add to existing array
      return {
        op: 'add',
        path: `${arrayPath}/-`,
        value: newItem,
      };
    }
  } else if (existingIndex > -1 && contactTelecomConfig.rank) {
    // Update rank even if value hasn't changed
    const existingRank = existingArray?.[existingIndex].rank;
    if (existingRank !== contactTelecomConfig.rank) {
      return {
        op: 'replace',
        path: `${arrayPath}/${existingIndex}/rank`,
        value: contactTelecomConfig.rank,
      };
    }
  }

  return undefined;
}

interface GroupedOperation {
  rootPath: string;
  index: number | null;
  operations: Operation[];
}

export function consolidateOperations(operations: Operation[], resource: FhirResource): Operation[] {
  // Merge 'replace' operations with corresponding 'add' operations
  const mergedOperations = mergeOperations(operations);
  // Group operations by their root paths
  const groupedOps = mergedOperations.reduce<GroupedOperation[]>((groups, op) => {
    if (op.op !== 'add') return groups;

    const pathParts = op.path.replace(/\/-$/, '').split('/').filter(Boolean);
    const rootPath = `/${pathParts[0]}`;
    const index = pathParts[1] && !isNaN(Number(pathParts[1])) ? Number(pathParts[1]) : null;

    // Check if parent exists in resource
    const parentExists = lodashGet(resource, pathParts[0]) !== undefined;
    if (parentExists) return groups;

    // Find or create group
    const existingGroup = groups.find((g) => g.rootPath === rootPath && g.index === index);

    if (existingGroup) {
      existingGroup.operations.push(op);
    } else {
      groups.push({ rootPath, index, operations: [op] });
    }

    return groups;
  }, []);

  // Convert groups to consolidated operations
  const consolidatedOps = groupedOps.map((group) => {
    const { rootPath, operations } = group;

    const consolidatedValue = operations.reduce((result: any, op: Operation) => {
      if (op.op !== 'add') return result;
      const relativePath = op.path.slice(rootPath.length).replace(/^\//, '');
      const pathParts = relativePath.split('/'); // Break into parts

      // Build nested structure
      let current = result;
      pathParts.forEach((part, index) => {
        if (index === pathParts.length - 1) {
          // Last part, assign the value
          if (Array.isArray(current)) {
            current.push(op.value);
          } else {
            current[part] = op.value;
          }
        } else {
          // Intermediate parts, create nested structure
          if (!current[part]) {
            current[part] = /^\d+$/.test(pathParts[index + 1]) ? [] : {}; // Check if the next part is a number (array index)
          }
          current = current[part];
        }
      });

      return result;
    }, []);

    return {
      op: 'add',
      path: rootPath,
      value: consolidatedValue,
    };
  });

  // Return consolidated operations plus any operations that didn't need consolidation
  return [
    ...consolidatedOps,
    ...operations.filter((op) => {
      const pathParts = op.path.replace(/\/-$/, '').split('/').filter(Boolean);
      const rootPath = `/${pathParts[0]}`;
      const index = pathParts[1] && !isNaN(Number(pathParts[1])) ? Number(pathParts[1]) : null;

      return (
        op.op !== 'add' ||
        lodashGet(resource, pathParts[0]) !== undefined ||
        !groupedOps.some((g) => g.rootPath === rootPath && g.index === index)
      );
    }),
  ] as (AddOperation<any> | RemoveOperation | ReplaceOperation<any>)[];
}

function mergeOperations(operations: Operation[]): Operation[] {
  const merged = new Map<string, Operation>();

  operations.forEach((operation) => {
    if ((operation.op === 'add' || operation.op === 'replace') && !operation.path.endsWith('/-')) {
      const existingOp = merged.get(operation.path);
      merged.set(operation.path, {
        ...operation,
        op: existingOp?.op === 'add' ? 'add' : operation.op,
      });
    } else {
      // For array append operations, add them directly to the result
      merged.set(`${operation.path}_${merged.size}`, operation);
    }
  });

  return Array.from(merged.values());
}
