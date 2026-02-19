import { BatchInputPatchRequest } from '@oystehr/sdk';
import {
  Communication,
  DiagnosticReport,
  DocumentReference,
  List,
  QuestionnaireResponse,
  Reference,
  ServiceRequest,
  Specimen,
  Task,
} from 'fhir/r4b';
import {
  LAB_LIST_CODE_CODING,
  LAB_LIST_CODING_SYSTEM,
  LAB_LIST_ITEM_SEARCH_FIELD_EXTENSION_URL,
  LAB_LIST_SEARCH_FIELD_NESTED_EXTENSION_URL,
  LabListsDTO,
  LabListSearchFieldKey,
  LabType,
} from 'utils';

type SoftDeleteLabResourceTypes =
  | 'ServiceRequest'
  | 'QuestionnaireResponse'
  | 'Task'
  | 'Communication'
  | 'DocumentReference'
  | 'DiagnosticReport'
  | 'Specimen';

export const makeSoftDeleteStatusPatchRequest = (
  resourceType: SoftDeleteLabResourceTypes,
  id: string
): BatchInputPatchRequest<
  ServiceRequest | QuestionnaireResponse | Task | Communication | DocumentReference | DiagnosticReport | Specimen
> => {
  const getStatus = (resourceType: SoftDeleteLabResourceTypes): string => {
    switch (resourceType) {
      case 'Communication':
      case 'DiagnosticReport':
      case 'DocumentReference':
      case 'QuestionnaireResponse':
      case 'Specimen':
        return 'entered-in-error';
      case 'ServiceRequest':
        return 'revoked';
      case 'Task':
        return 'cancelled';
      default:
        throw new Error(`cannot determine soft delete status for unrecognized resourceType: ${resourceType}`);
    }
  };

  return {
    method: 'PATCH',
    url: `${resourceType}/${id}`,
    operations: [
      {
        op: 'replace',
        path: '/status',
        value: getStatus(resourceType),
      },
    ],
  };
};

export const formatLabListDTOs = (labLists: List[]): LabListsDTO[] | undefined => {
  if (labLists.length === 0) return;
  const formattedListDTOs: LabListsDTO[] = [];
  labLists.forEach((list, idx) => {
    const listType = getLabListType(list);
    if (!listType) return;
    const formattedBase = {
      listId: list.id ?? `missing-${idx}`,
      listName: list.title ?? 'Lab List (title missing)',
    };
    if (listType === LabType.external) {
      const formatted: LabListsDTO = {
        ...formattedBase,
        listType,
        labs:
          list.entry?.map((lab) => {
            const labForList = {
              display: lab.item.display ?? 'lab item display missing',
              itemCode: getLabListEntryFieldFromExtension(lab.item, 'itemCode', list.id),
              labGuid: getLabListEntryFieldFromExtension(lab.item, 'labGuid', list.id),
            };
            return labForList;
          }) ?? [],
      };
      formattedListDTOs.push(formatted);
    } else if (listType === LabType.inHouse) {
      const formatted: LabListsDTO = {
        ...formattedBase,
        listType,
        labs:
          list.entry?.map((lab, idx) => {
            const labForList = {
              display: lab.item.display ?? 'lab item display missing',
              activityDefinitionId:
                lab.item.reference?.replace('ActivityDefinition/', '') ?? `inhouse-lab-list-item-${idx}-${list.id}`,
            };
            return labForList;
          }) ?? [],
      };
      formattedListDTOs.push(formatted);
    }
  });
  return formattedListDTOs;
};

/**
 * parses data from external lab list entry items
 * @param lab the entry item from the list that represents the lab
 * @param field which field you are looking for
 * @param listId only used in error logging
 * @returns string
 */
const getLabListEntryFieldFromExtension = (
  lab: Reference,
  field: LabListSearchFieldKey,
  listId: string | undefined
): string => {
  const searchFieldsExt = lab.extension?.find((ext) => ext.url === LAB_LIST_ITEM_SEARCH_FIELD_EXTENSION_URL);

  const nestedExtensionUrl = LAB_LIST_SEARCH_FIELD_NESTED_EXTENSION_URL[field];

  const fieldValue = searchFieldsExt?.extension?.find((ext) => ext.url === nestedExtensionUrl)?.valueString;

  if (!fieldValue) {
    throw Error(
      `Lab list misconfiguration: unable to find nested extension with url ${nestedExtensionUrl} from the extension on ${JSON.stringify(
        lab
      )} within List/${listId}`
    );
  }

  return fieldValue;
};

const getLabListType = (list: List): LabType.external | LabType.inHouse | undefined => {
  const code = list.code?.coding?.find((c) => c.system === LAB_LIST_CODING_SYSTEM)?.code;
  if (!code) return;

  switch (code) {
    case LAB_LIST_CODE_CODING.external.code:
      return LabType.external;
    case LAB_LIST_CODE_CODING.inHouse.code:
      return LabType.inHouse;
    default:
      return;
  }
};
