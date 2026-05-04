import { BatchInputPatchRequest } from '@oystehr/sdk';
import {
  Communication,
  DiagnosticReport,
  DocumentReference,
  List,
  ListEntry,
  Observation,
  Patient,
  QuestionnaireResponse,
  Reference,
  ServiceRequest,
  Specimen,
  Task,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  DR_UNSOLICITED_PATIENT_REF,
  getLabListType,
  LAB_LIST_IDENTIFIER_SYSTEM,
  LAB_LIST_ITEM_SEARCH_FIELD_EXTENSION_URL,
  LAB_LIST_SEARCH_FIELD_NESTED_EXTENSION_URL,
  LabListSearchFieldKey,
  LabSetDTO,
  LabSetNoIdDTO,
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

export const formatLabListDTOs = (labLists: List[]): LabSetDTO[] | undefined => {
  if (labLists.length === 0) return;
  const formattedListDTOs: LabSetDTO[] = [];
  labLists.forEach((list, idx) => {
    const listType = getLabListType(list);
    if (!listType) return;
    const formattedBase = {
      listId: list.id ?? `missing-${idx}`,
      listName: list.title ?? 'Lab List (title missing)',
    };
    if (listType === LabType.external) {
      const formatted: LabSetDTO = {
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
      const formatted: LabSetDTO = {
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

export const getContainedPatientFromDiagnosticReport = (diagnosticReport: DiagnosticReport): Patient | undefined => {
  const containedPatient = diagnosticReport.contained?.find(
    (resource) => resource.resourceType === 'Patient' && resource.id === DR_UNSOLICITED_PATIENT_REF
  );

  if (!containedPatient) return;

  return containedPatient as Patient;
};

/**
 * the function will return the subset of the array of observations passed that are contained in the diagnostic reports' results
 * @param observations - array of observations
 * @param diagnosticReports - array of diagnosticReports
 */
export const getObservationsForDiagnosticReportResults = (
  allObservations: Observation[],
  diagnosticReports: DiagnosticReport[]
): Observation[] => {
  const obsRefs = new Set(diagnosticReports.flatMap((dr) => dr.result?.map((r) => r.reference) ?? []));
  const observations = allObservations.filter((obs) => obsRefs.has(`Observation/${obs.id}`));
  return observations;
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

export const formatListEntry = (labSet: LabSetDTO | LabSetNoIdDTO): ListEntry[] => {
  const now = DateTime.now().toISO();
  let entry: ListEntry[] | undefined;

  if (labSet.listType === LabType.inHouse) {
    entry = labSet.labs.map((lab) => {
      const labEntry: ListEntry = {
        date: now,
        item: {
          type: 'ActivityDefinition',
          reference: `ActivityDefinition/${lab.activityDefinitionId}`,
          display: lab.display,
        },
      };
      return labEntry;
    });
  } else if (labSet.listType === LabType.external) {
    entry = labSet.labs.map((lab) => {
      const labEntry: ListEntry = {
        date: now,
        item: {
          identifier: {
            system: LAB_LIST_IDENTIFIER_SYSTEM,
            value: `${lab.labGuid}|${lab.itemCode}`,
          },
          display: lab.display,
          extension: [
            {
              url: LAB_LIST_ITEM_SEARCH_FIELD_EXTENSION_URL,
              extension: [
                {
                  url: LAB_LIST_SEARCH_FIELD_NESTED_EXTENSION_URL.labGuid,
                  valueString: lab.labGuid,
                },
                {
                  url: LAB_LIST_SEARCH_FIELD_NESTED_EXTENSION_URL.itemCode,
                  valueString: lab.itemCode,
                },
              ],
            },
          ],
        },
      };
      return labEntry;
    });
  }

  if (!entry) {
    throw Error(
      `Issue configuring the entry for this lab set, most likely due to an issue with the type: ${labSet.listType}`
    );
  }

  return entry;
};
