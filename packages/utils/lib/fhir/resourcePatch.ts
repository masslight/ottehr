import { BatchInputPatchRequest } from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import { Coding, Extension, FhirResource, Period, Resource } from 'fhir/r4b';
import { get as lodashGet } from 'lodash-es';
import { slashPathToLodashPath } from './helpers';

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
    | { valueDateTime: Extension['valueDateTime'] }
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
    } else if ('valueDateTime' in newExtension && 'valueDateTime' in existingExt) {
      if (existingExt.valueDateTime !== newExtension.valueDateTime) {
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

export const normalizePhoneNumber = (phone: string | undefined): string => {
  if (!phone) return '';
  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');
  // Ensure it has the '+1' prefix for US numbers
  if (digitsOnly.length === 10) {
    return `+1${digitsOnly}`;
  } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    return `+${digitsOnly}`;
  } else if (digitsOnly.length > 0) {
    // Handle other cases
    return digitsOnly.startsWith('+') ? digitsOnly : `+${digitsOnly}`;
  }

  return '';
};

export function createPatchOperationForTelecom(
  contactTelecomConfig: ContactTelecomConfig,
  resource: Resource,
  path: string,
  newValue?: string
): Operation | undefined {
  const arrayPath = path.split('/').slice(0, -2).join('/');
  const existingArray = get(resource, arrayPath.slice(1)) as Array<ContactPoint> | undefined;
  const existingIndex = existingArray?.findIndex((item) => item.system === contactTelecomConfig.system) ?? -1;
  const existingValue = existingIndex > -1 ? existingArray?.[existingIndex].value : undefined;

  let normalizedNewValue = newValue;
  if (contactTelecomConfig.system === 'phone') {
    normalizedNewValue = normalizePhoneNumber(newValue) || '';
  }

  if (normalizedNewValue !== existingValue) {
    if (!newValue || normalizedNewValue === '') {
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
        value: normalizedNewValue,
      };
    } else {
      // Add new item with system
      const newItem = {
        system: contactTelecomConfig.system,
        value: normalizedNewValue,
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
  // Merge 'replace' and 'add' operations with the same path
  let mergedOperations: Operation[] = mergeOperations(operations, resource);

  if (resource.resourceType === 'Patient' && resource.contact) {
    // Special handling for contact name operations
    mergedOperations = consolidateContactNameOperations(mergedOperations);
  }

  if (resource.resourceType === 'Patient' && resource.extension) {
    mergedOperations = consolidateExtensionOperations(mergedOperations, resource.extension);
  }

  // Group operations by their root paths
  const groupedOperationsWithNewPath = mergedOperations.reduce<GroupedOperation[]>(
    (groups, op) => groupAddOperationsForNewPaths(groups, op, resource),
    []
  );

  const groupedOperationsAppendingExistingArray = mergedOperations.reduce<GroupedOperation[]>(
    (groups, op) => groupAddOperationsForExistingPath(groups, op, resource),
    []
  );

  // Convert groups to consolidated operations
  const consolidatedOps = groupedOperationsWithNewPath.map(consolidateGroupedOperationsForNewPaths);
  const consolidatedAppendOps = groupedOperationsAppendingExistingArray.map(createArrayAppendOperation);
  // Filter standalone operations
  const standaloneOperations = filterStandaloneOperations(
    mergedOperations,
    groupedOperationsWithNewPath,
    groupedOperationsAppendingExistingArray,
    resource
  );
  // Combine consolidated and standalone operations
  const combinedOperations = [...consolidatedOps, ...consolidatedAppendOps, ...standaloneOperations];
  // Normalize all array operations
  const normalizedOperations = combinedOperations.map((op) => convertInvalidArrayOperation(op, resource));

  // Return consolidated operations plus any operations that didn't need consolidation
  return normalizedOperations;
}

function mergeOperations(operations: Operation[], resource: FhirResource): Operation[] {
  const merged = new Map<string, Operation>();

  operations.forEach((operation, index) => {
    // Handle array append operations separately
    if (operation.path.endsWith('/-')) {
      merged.set(`${operation.path}_${merged.size}`, operation);
      return;
    }

    const currentValue = lodashGet(resource, slashPathToLodashPath(operation.path));

    // For remove operations, check if there's a subsequent add with same value
    if (operation.op === 'remove') {
      const nextOp = operations[index + 1];
      if (
        nextOp &&
        nextOp.path === operation.path &&
        (nextOp.op === 'add' || nextOp.op === 'replace') &&
        nextOp.value === currentValue
      ) {
        return; // Skip this remove operation
      }
    }

    // Skip add/replace if value wouldn't change
    if ((operation.op === 'add' || operation.op === 'replace') && operation.value === currentValue) {
      return;
    }

    // For remaining operations, preserve existing logic
    if (operation.op === 'add' || operation.op === 'replace') {
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

function getOperationArrayInfo(path: string): { isArray: boolean; parentPath: string; index: number } {
  const parts = path.split('/').filter(Boolean);

  // For operation paths like '/name/1/given', we need to check the middle part
  for (let i = 0; i < parts.length - 1; i++) {
    if (!isNaN(Number(parts[i]))) {
      return {
        isArray: true,
        parentPath: '/' + parts.slice(0, i).join('/'),
        index: Number(parts[i]),
      };
    }
  }

  return { isArray: false, parentPath: path, index: -1 };
}

function convertInvalidArrayOperation(op: Operation, resource: FhirResource): Operation {
  if (op.op === 'add') {
    const { isArray, parentPath, index } = getOperationArrayInfo(op.path);
    // Check if we're trying to add to a specific array index that doesn't exist
    if (isArray && index >= 0) {
      const parentValue = lodashGet(resource, parentPath.slice(1));

      const pathParts = op.path.split('/').filter(Boolean);

      // Special case for adding to name/given
      if (pathParts.includes('name') && pathParts.includes('given')) {
        const nameIndex = pathParts.indexOf('name');
        const basePath = '/' + pathParts.slice(0, nameIndex + 1).join('/');

        // Check if we're modifying an existing contact's name
        if (pathParts.includes('contact')) {
          const nameObject = lodashGet(resource, slashPathToLodashPath(basePath)) || {};

          return {
            op: 'replace',
            path: basePath,
            value: {
              ...nameObject,
              given: Array.isArray(op.value) ? op.value : [op.value],
            },
          };
        }

        // For new name entries
        return {
          op: 'add',
          path: `${basePath}/-`,
          value: { given: Array.isArray(op.value) ? op.value : [op.value] },
        };
      }

      if (!Array.isArray(parentValue) || parentValue.length <= index) {
        // Convert to array append operation
        const fieldName = pathParts[pathParts.length - 1];

        return {
          op: 'add',
          path: `${parentPath}/-`,
          value: { [fieldName]: op.value },
        };
      }
    }
  } else if (op.op === 'remove') {
    const pathParts = op.path.split('/').filter(Boolean);
    const parentPath = '/' + pathParts.slice(0, -1).join('/');
    const parentValue = lodashGet(resource, pathParts.slice(0, -1));
    if (typeof parentValue === 'object' && parentValue !== null) {
      const remainingKeys = Object.keys(parentValue).filter((key) => key !== pathParts[pathParts.length - 1]);
      if (remainingKeys.length === 0) {
        return {
          op: 'remove',
          path: parentPath,
        };
      }
    }
  }

  return op;
}

function groupAddOperationsForNewPaths(
  groups: GroupedOperation[],
  op: Operation,
  resource: FhirResource
): GroupedOperation[] {
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
}

function groupAddOperationsForExistingPath(
  groups: GroupedOperation[],
  op: Operation,
  resource: FhirResource
): GroupedOperation[] {
  if (op.op !== 'add') return groups;

  const pathParts = op.path.replace(/\/-$/, '').split('/').filter(Boolean);
  const rootPath = `/${pathParts[0]}`;
  const index = pathParts[1] && !isNaN(Number(pathParts[1])) ? Number(pathParts[1]) : null;
  // Check if parent exists in resource
  const parentValue = lodashGet(resource, pathParts[0]);
  // const parentExists = parentValue !== undefined;

  // Check if we're adding to an existing array at a new index
  if (Array.isArray(parentValue) && index !== null) {
    // Check if we're trying to add at an index that doesn't exist
    if (index >= parentValue.length) {
      // This is an append operation to an existing array
      const appendRootPath = `${rootPath}/-`;

      // Find or create append group
      const existingAppendGroup = groups.find((g) => g.rootPath === appendRootPath);
      if (existingAppendGroup) {
        existingAppendGroup.operations.push(op);
      } else {
        groups.push({ rootPath: appendRootPath, index: null, operations: [op] });
      }
    }
  }

  return groups;
}

function consolidateGroupedOperationsForNewPaths(group: GroupedOperation): Operation {
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
}

function createArrayAppendOperation(group: GroupedOperation): Operation {
  const { rootPath, operations } = group;
  // Build a structured object from the operations
  const valueObj: any = {};

  operations.forEach((op) => {
    if (op.op !== 'add') return;
    const path = op.path;
    const basePath = rootPath.replace('/-', '');

    // Extract path relative to the array item
    // For example, from "/contact/1/name/family" get "name/family"
    const pathPattern = new RegExp(`^${basePath}\\/\\d+\\/(.+)$`);
    const match = path.match(pathPattern);

    if (match && match[1]) {
      const relativePath = match[1];
      const pathParts = relativePath.split('/');

      // Build the nested object structure
      let current = valueObj;
      pathParts.forEach((part, idx) => {
        if (idx === pathParts.length - 1) {
          // Last part - assign the actual value
          current[part] = op.value;
        } else {
          // Create nested objects/arrays as needed
          if (!current[part]) {
            current[part] = /^\d+$/.test(pathParts[idx + 1]) ? [] : {};
          }
          current = current[part];
        }
      });
    }
  });

  return {
    op: 'add',
    path: rootPath,
    value: valueObj,
  };
}

function filterStandaloneOperations(
  operations: Operation[],
  groupedOperations: GroupedOperation[],
  arrayAppendGroups: GroupedOperation[],
  resource: FhirResource
): Operation[] {
  return operations.filter((op) => {
    // Check if this operation was included in any array append group
    const isInArrayAppendGroup = arrayAppendGroups.some((group) => group.operations.some((groupOp) => groupOp === op));

    // If it's part of an array append group, filter it out
    if (isInArrayAppendGroup) {
      return false;
    }

    const pathParts = op.path.replace(/\/-$/, '').split('/').filter(Boolean);
    const rootPath = `/${pathParts[0]}`;
    const index = pathParts[1] && !isNaN(Number(pathParts[1])) ? Number(pathParts[1]) : null;

    return (
      op.op !== 'add' ||
      lodashGet(resource, pathParts[0]) !== undefined ||
      !groupedOperations.some((g) => g.rootPath === rootPath && g.index === index)
    );
  });
}

function consolidateContactNameOperations(operations: Operation[]): Operation[] {
  const nameOperations = operations.filter((op) => op.op === 'add' && op.path.match(/\/contact\/\d+\/name\//));

  if (nameOperations.length === 0) {
    return operations;
  }

  const nameGroups = new Map();

  nameOperations.forEach((op) => {
    const pathParts = op.path.split('/').filter(Boolean);
    const nameIndex = pathParts.indexOf('name');
    const basePath = '/' + pathParts.slice(0, nameIndex + 1).join('/');

    if (!nameGroups.has(basePath)) {
      nameGroups.set(basePath, {
        given: [],
        family: undefined,
      });
    }

    const group = nameGroups.get(basePath);
    const field = pathParts[nameIndex + 1];
    if (op.op === 'add' || op.op === 'replace') {
      if (field === 'family') {
        group.family = op.value;
      } else if (field === 'given') {
        const givenIndex = parseInt(pathParts[nameIndex + 2]);
        if (!isNaN(givenIndex)) {
          group.given[givenIndex] = op.value;
        }
      }
    }
  });

  const consolidatedNameOps: Operation[] = Array.from(nameGroups.entries()).map(([path, value]) => ({
    op: 'add',
    path,
    value: {
      given: value.given.filter(Boolean),
      family: value.family,
    },
  }));

  // Filter out the original name operations and add the consolidated ones
  const nonNameOps = operations.filter((op) => !(op.op === 'add' && op.path.includes(consolidatedNameOps[0].path)));

  return [...consolidatedNameOps, ...nonNameOps];
}

function consolidateExtensionOperations(operations: Operation[], extension: Extension[]): Operation[] {
  const extensionOps = operations.filter((op) => op.path.startsWith('/extension'));
  if (!extensionOps.length) return operations;

  const newExtensions = [...extension.map((e) => structuredClone(e))];

  for (const op of extensionOps) {
    const match = op.path.match(/^\/extension\/(\d+|-)$/);
    if (!match) continue;

    const idx = match[1];
    if (idx === '-') {
      if (op.op === 'add' && op.value) {
        newExtensions.push(structuredClone(op.value));
      }
      continue;
    }

    const index = parseInt(idx, 10);
    if (index < 0 || index >= extension.length) continue;

    switch (op.op) {
      case 'remove':
        delete newExtensions[index];
        break;
      case 'replace':
      case 'add':
        if (op.value) newExtensions[index] = structuredClone(op.value);
        break;
    }
  }

  const mergedExtensions = newExtensions.filter(Boolean);

  const otherOps = operations.filter((op) => !op.path.startsWith('/extension'));
  const consolidatedOp: Operation = {
    op: 'replace',
    path: '/extension',
    value: mergedExtensions,
  };

  return [...otherOps, consolidatedOp];
}
