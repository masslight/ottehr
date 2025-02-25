import Oystehr, { BatchInputPostRequest, SearchParam } from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import {
  Appointment,
  Bundle,
  CodeableConcept,
  Coding,
  Consent,
  Coverage,
  DocumentReference,
  Encounter,
  Extension,
  FhirResource,
  HealthcareService,
  HumanName,
  InsurancePlan,
  List,
  Location,
  Meta,
  Money,
  OperationOutcome,
  Organization,
  Practitioner,
  QuestionnaireResponse,
  Reference,
  Resource,
  Task,
  TaskInput,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  addOperation,
  findExistingListByDocumentTypeCode,
  PatientMasterRecordResourceType,
  replaceOperation,
  TaskCoding,
  TELEMED_VIDEO_ROOM_CODE,
} from 'utils';
import {
  EncounterVirtualServiceExtension,
  HealthcareServiceWithLocationContext,
  PractitionerLicense,
  PractitionerQualificationCode,
  ServiceMode,
  VisitType,
} from '../types';
import {
  FHIR_EXTENSION,
  FHIR_IDENTIFIER_CODE_TAX_EMPLOYER,
  FHIR_IDENTIFIER_CODE_TAX_SS,
  FHIR_IDENTIFIER_NPI,
  FHIR_IDENTIFIER_SYSTEM_TAX,
  PRACTITIONER_QUALIFICATION_CODE_SYSTEM,
  PRACTITIONER_QUALIFICATION_EXTENSION_URL,
  PRACTITIONER_QUALIFICATION_STATE_SYSTEM,
  PUBLIC_EXTENSION_BASE_URL,
  SCHEDULE_STRATEGY_SYSTEM,
  ScheduleStrategy,
  SERVICE_MODE_SYSTEM,
  ServiceModeCoding,
} from './constants';

export function isFHIRError(error: any): boolean {
  return !(error instanceof Error) && typeof error === 'object' && error.resourceType === 'OperationOutcome';
}

export function handleUnknownError(error: any): any {
  let errorToThrow = error;

  // check for FHIR error
  if (isFHIRError(error)) {
    const fhirError = error as OperationOutcome;
    const firstIssue = fhirError.issue[0];
    const fhirMessage = 'FHIR Error: ' + firstIssue.details?.text;

    // use fhir error details for error message
    errorToThrow = new Error(fhirMessage);
  }

  return errorToThrow;
}

export function getNPI(resource: Practitioner | Organization | Location | HealthcareService): string | undefined {
  return resource.identifier?.find((ident) => {
    return ident.system === FHIR_IDENTIFIER_NPI;
  })?.value;
}
export function getTaxID(resource: Practitioner | Organization | Location | HealthcareService): string | undefined {
  // https://docs.oystehr.com/services/rcm/eligibility/#provider-practitioner--practitionerrole--organization
  return resource.identifier?.find((ident) => {
    if (resource.resourceType === 'Practitioner') {
      return ident.type?.coding?.some(
        (tc) =>
          tc.system === FHIR_IDENTIFIER_SYSTEM_TAX &&
          (tc.code === FHIR_IDENTIFIER_CODE_TAX_EMPLOYER || tc.code === FHIR_IDENTIFIER_CODE_TAX_SS)
      );
    }
    // don't check for SS on anything that isn't a Practitioner
    return ident.type?.coding?.some(
      (tc) => tc.system === FHIR_IDENTIFIER_SYSTEM_TAX && tc.code === FHIR_IDENTIFIER_CODE_TAX_EMPLOYER
    );
  })?.value;
}

export const codingsEqual = (coding1: Coding, coding2: Coding): boolean => {
  const systemsAreEqual = coding1.system === coding2.system;
  const codesAreEqual = coding1.code === coding2.code;

  return systemsAreEqual && codesAreEqual;
};

export const codingContainedInList = (coding: Coding, codingList: Coding[]): boolean => {
  return codingList.reduce((haveMatch, currentCoding) => {
    return haveMatch || codingsEqual(coding, currentCoding);
  }, false);
};

export const findLocationForAppointment = (appointment: Appointment, locations: Location[]): Location | undefined => {
  const { participant } = appointment;
  if (!participant) {
    return undefined;
  }
  return locations.find((loc) => {
    return participant.some((part) => {
      const { actor } = part;
      if (actor && actor.reference) {
        const [type, appLocationId] = actor.reference.split('/');
        if (type !== 'Location') {
          return false;
        }
        // console.log('appLocationId', appLocationId);
        return appLocationId === loc.id;
      } else {
        console.log('no actor?', JSON.stringify(actor));
      }
      return false;
    });
  });
};

export const findEncounterForAppointment = (
  appointment: Appointment,
  encounters: Encounter[]
): Encounter | undefined => {
  // Go through encounters and find the one with appointment
  return encounters.find(
    (encounter) =>
      encounter.appointment?.find((appRef) => {
        const { reference } = appRef;
        if (!reference) {
          return false;
        }
        const [_, refId] = reference.split('/');
        return refId && refId === appointment.id;
      })
  );
};

export const resourceHasTag = (resource: Resource, tag: Coding): boolean => {
  const tags = resource.meta?.tag ?? [];
  return tags.some((t) => {
    return t.system === tag.system && t.code === tag.code;
  });
};

export const isPrebookAppointment = (appointment: Appointment): boolean => {
  const typeCoding = appointment.appointmentType?.text;
  return typeCoding === VisitType.PostTelemed || typeCoding === VisitType.PreBook;
};

export const isPostTelemedAppointment = (appointment: Appointment): boolean => {
  const typeCoding = appointment.appointmentType?.text;
  return typeCoding === VisitType.PostTelemed;
};

export function getOtherOfficesForLocation(location: Location): { display: string; url: string }[] {
  const rawExtensionValue = location?.extension?.find(
    (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/other-offices'
  )?.valueString;
  if (!rawExtensionValue) {
    console.log("Location doesn't have other-offices extension");
    return [];
  }

  let parsedExtValue: { display: string; url: string }[] = [];
  try {
    parsedExtValue = JSON.parse(rawExtensionValue);
  } catch (_) {
    console.log('Location other-offices extension is formatted incorrectly');
    return [];
  }

  return parsedExtValue;
}

export interface FileDocDataForDocReference {
  url: string;
  title: string;
}

export interface CreateDocumentReferenceInput {
  files: FileDocDataForDocReference[];
  type: CodeableConcept;
  dateCreated: string;
  references: object;
  oystehr: Oystehr;
  generateUUID?: () => string;
  docStatus?: 'preliminary' | 'final' | 'amended' | 'entered-in-error' | undefined;
  meta?: Meta;
  searchParams: SearchParam[];
  listResources?: List[];
}

export async function createFilesDocumentReferences(input: CreateDocumentReferenceInput): Promise<DocumentReference[]> {
  const { files, type, meta, dateCreated, docStatus, references, oystehr, searchParams, generateUUID, listResources } =
    input;
  console.log('files for doc refs', JSON.stringify(files, null, 2));
  try {
    console.log('searching for current document references', JSON.stringify(searchParams, null, 2));
    const docsJson = (
      await oystehr.fhir.search<DocumentReference>({
        resourceType: 'DocumentReference',
        params: [
          {
            name: 'status',
            value: 'current',
          },
          ...searchParams,
        ],
      })
    ).unbundle();

    const results: DocumentReference[] = [];
    // Track new entries by list type code
    const newEntriesByType: Record<string, Array<{ date: string; item: { type: string; reference: string } }>> = {};

    for (const file of files) {
      // Check if there's an existing DocumentReference for this file
      const existingDoc = docsJson.find(
        (doc) => doc.content[0]?.attachment.title === file.title && doc.content[0]?.attachment.url === file.url
      );

      if (existingDoc) {
        // If exact same file exists, reuse it
        results.push(existingDoc);
        continue;
      }
      // If different version exists, mark it as superseded
      const oldDoc = docsJson.find((doc) => doc.content[0]?.attachment.title === file.title);
      if (oldDoc) {
        await oystehr.fhir.patch({
          resourceType: 'DocumentReference',
          id: oldDoc.id || '',
          operations: [{ op: 'replace', path: '/status', value: 'superseded' }],
        });
      }

      // Create all DocumentReferences
      const urlExt = file.url.split('.').slice(-1).toString();
      const contentType = urlExt === 'pdf' ? 'application/pdf' : urlExt === 'jpg' ? 'image/jpeg' : `image/${urlExt}`;

      const writeDRFullUrl = generateUUID ? generateUUID() : undefined;

      const writeDocRefReq: BatchInputPostRequest<DocumentReference> = {
        method: 'POST',
        fullUrl: writeDRFullUrl,
        url: '/DocumentReference',
        resource: {
          resourceType: 'DocumentReference',
          meta,
          status: 'current',
          docStatus,
          type: type,
          date: dateCreated,
          content: [
            {
              attachment: {
                url: file.url,
                contentType,
                title: file.title,
              },
            },
          ],
          ...references,
        },
      };

      console.log('making DocumentReference ...');
      const docRefBundle = await oystehr.fhir.transaction<DocumentReference>({
        requests: [writeDocRefReq],
      });
      console.log('making DocumentReference results =>', JSON.stringify(docRefBundle, null, 2));

      const docRef = docRefBundle.entry?.[0]?.resource;
      // Collect document reference to list by type
      if (listResources && type.coding?.[0]?.code && docRef) {
        const typeCode = type.coding[0].code;
        if (!newEntriesByType[typeCode]) {
          newEntriesByType[typeCode] = [];
        }
        newEntriesByType[typeCode].push({
          date: DateTime.now().setZone('UTC').toISO() ?? '',
          item: {
            type: 'DocumentReference',
            reference: `DocumentReference/${docRef.id}`,
          },
        });
        results.push(docRef);
      }
    }

    // Update lists
    if (listResources) {
      for (const [typeCode, newEntries] of Object.entries(newEntriesByType)) {
        const list = findExistingListByDocumentTypeCode(listResources, typeCode);
        if (!list?.id) {
          console.log(`default list for files with typeCode: ${typeCode} not found. Add typeCode to FOLDERS_CONFIG`);
          // TODO: Create List with default config
        } else {
          const updatedFolderEntries = [...(list?.entry ?? []), ...newEntries];
          const patchListWithDocRefOperation: Operation =
            list?.entry && list.entry?.length > 0
              ? replaceOperation('/entry', updatedFolderEntries)
              : addOperation('/entry', updatedFolderEntries);
          console.log('operation:', JSON.stringify(patchListWithDocRefOperation));

          console.log(`patching documents folder List ...`);

          const listPatchResult = await oystehr.fhir.patch<List>({
            resourceType: 'List',
            id: list?.id ?? '',
            operations: [patchListWithDocRefOperation],
          });

          console.log(`patch results => `);
          console.log(JSON.stringify(listPatchResult));
        }
      }
    }

    return results;
  } catch (error: unknown) {
    throw new Error(`Failed to create DocumentReference resource: ${JSON.stringify(error)}`);
  }
}

export interface DocRefSyncTaskInput {
  context: { patientId: string; encounterId?: string };
  documentRef?: string;
  focus?: string;
}

export interface TaskDetails {
  coding: TaskCoding;
  input?: TaskInput[];
}

interface AppointmentTaskInput {
  taskDetails: TaskDetails;
  appointmentID: string;
}

export const makeAppointmentTask = (input: AppointmentTaskInput): Task => {
  const { taskDetails, appointmentID } = input;
  return {
    resourceType: 'Task',
    status: 'requested',
    intent: 'plan',
    focus: {
      type: 'Appointment',
      reference: `Appointment/${appointmentID}`,
    },
    code: {
      coding: [taskDetails.coding],
    },
    input: taskDetails.input,
  };
};

export async function createConsentResource(
  patientID: string,
  documentReferenceID: string,
  dateTime: string,
  oystehr: Oystehr
): Promise<Consent> {
  try {
    console.log('creating new consent resource');
    const createdConsent = await oystehr.fhir.create<Consent>({
      resourceType: 'Consent',
      dateTime: dateTime,
      status: 'active',
      patient: {
        reference: `Patient/${patientID}`,
      },
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/consentcategorycodes',
              code: 'hipaa-ack',
            },
          ],
        },
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/consentcategorycodes',
              code: 'treat-guarantee',
            },
          ],
        },
      ],
      policy: [
        {
          uri: 'https://ottehr.com',
        },
        {
          uri: 'https://ottehr.com',
        },
      ],
      sourceReference: {
        reference: `DocumentReference/${documentReferenceID}`,
      },
      scope: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/consentscope',
            code: 'patient-privacy',
            display: 'Privacy Consent',
          },
          {
            system: 'http://terminology.hl7.org/CodeSystem/consentscope',
            code: 'treatment',
            display: 'Treatment',
          },
        ],
      },
    });

    return createdConsent;
  } catch (error: unknown) {
    throw new Error(`Failed to create Consent resource: ${error}`);
  }
}

export const getLastUpdateTimestampForResource = (resource: Resource): number | undefined => {
  if (!resource) {
    return undefined;
  }
  const metaTimeStamp = resource.meta?.lastUpdated;

  if (metaTimeStamp) {
    const updateTime = DateTime.fromISO(metaTimeStamp);

    if (updateTime.isValid) {
      return updateTime.toSeconds();
    }
  }
  return undefined;
};

export async function getQuestionnaireResponse(
  questionnaireID: string,
  encounterID: string,
  oystehr: Oystehr
): Promise<QuestionnaireResponse | undefined> {
  const questionnaireResponse = (
    await oystehr.fhir.search<QuestionnaireResponse>({
      resourceType: 'QuestionnaireResponse',
      params: [
        {
          name: 'questionnaire',
          value: `Questionnaire/${questionnaireID}`,
        },
        {
          name: 'encounter',
          value: `Encounter/${encounterID}`,
        },
      ],
    })
  ).unbundle();

  if (questionnaireResponse.length === 1) {
    return questionnaireResponse[0];
  }
  return undefined;
}

export async function getRecentQuestionnaireResponse(
  questionnaireID: string,
  patientID: string,
  oystehr: Oystehr
): Promise<QuestionnaireResponse | undefined> {
  console.log('questionnaireID', questionnaireID);
  const questionnaireResponse = (
    await oystehr.fhir.search<QuestionnaireResponse>({
      resourceType: 'QuestionnaireResponse',
      params: [
        {
          name: 'questionnaire',
          value: `Questionnaire/${questionnaireID}`,
        },
        {
          name: 'subject',
          value: `Patient/${patientID}`,
        },
        {
          name: 'source:missing',
          value: 'false',
        },
        {
          name: '_sort',
          value: '-_lastUpdated',
        },
        {
          name: '_count',
          value: '1',
        },
      ],
    })
  ).unbundle();

  console.log('questionnaireResponse found', questionnaireResponse);

  if (questionnaireResponse.length === 1) {
    return questionnaireResponse[0];
  }
  return undefined;
}

export async function getRecentQrsQuestionnaireResponse(
  patientId: string,
  oystehr: Oystehr
): Promise<QuestionnaireResponse | undefined> {
  // TODO: since there is an Oystehr bug where 'contains' doesn't work, I will filter this in code and not limit to
  // _count=1. All commented out code in this function are because of this.
  const questionnaireResponse = (
    await oystehr.fhir.search<QuestionnaireResponse>({
      resourceType: 'QuestionnaireResponse',
      params: [
        // {
        //   name: 'questionnaire:contains',
        //   value: 'qrs-paperwork-ip',
        // },
        {
          name: 'subject',
          value: `Patient/${patientId}`,
        },
        {
          name: 'status',
          value: 'completed',
        },
        {
          name: '_sort',
          value: '-_lastUpdated',
        },
        // {
        //   name: '_count',
        //   value: '1',
        // },
      ],
    })
  ).unbundle();

  const qrsQuestionnaireResponse = questionnaireResponse.filter(
    (response) => response.questionnaire?.includes('qrs-paperwork-ip')
  );

  console.log('qrsQuestionnaireResponse found', qrsQuestionnaireResponse);

  return qrsQuestionnaireResponse[0];
  // if (questionnaireResponse.length === 1) {
  //   return questionnaireResponse[0];
  // }
  // return undefined;
}

export const CRITICAL_CHANGE_SYSTEM = 'critical-update-by'; // exists in ehr as well

export const getCriticalUpdateTagOp = (resource: Resource, updateBy: string): Operation => {
  const recordUpdateByTag = {
    system: CRITICAL_CHANGE_SYSTEM,
    display: updateBy,
    version: DateTime.now().toISO() || '',
  };

  if (!resource.meta?.tag) {
    return {
      op: 'add',
      path: '/meta/tag',
      value: [recordUpdateByTag],
    };
  } else {
    const currentTags = resource.meta?.tag ?? [];
    const existingTagIdx = currentTags.findIndex((coding) => {
      return coding.system === CRITICAL_CHANGE_SYSTEM;
    });
    if (existingTagIdx >= 0) {
      return {
        op: 'replace',
        path: `/meta/tag/${existingTagIdx}`,
        value: recordUpdateByTag,
      };
    } else {
      return {
        op: 'add',
        path: `/meta/tag/-`,
        value: recordUpdateByTag,
      };
    }
  }
};

export const getLocationIdFromAppointment = (appointment: Appointment): string | undefined => {
  return appointment.participant
    .find((appointment) => appointment.actor?.reference?.startsWith('Location/'))
    ?.actor?.reference?.replace('Location/', '');
};

export const getAbbreviationFromLocation = (location: Location): string | undefined => {
  return location.address?.state;
};

export function getTaskResource(coding: TaskCoding, appointmentID: string): Task {
  return {
    resourceType: 'Task',
    status: 'requested',
    intent: 'plan',
    focus: {
      type: 'Appointment',
      reference: `Appointment/${appointmentID}`,
    },
    code: {
      coding: [coding],
    },
  };
}
export const getStartTimeFromEncounterStatusHistory = (encounter: Encounter): string | undefined => {
  const statusHistory = encounter.statusHistory ?? [];

  return statusHistory.find((sh) => {
    return sh.status === 'arrived';
  })?.period?.start;
};

export function allLicensesForPractitioner(practitioner: Practitioner): PractitionerLicense[] {
  const allLicenses: PractitionerLicense[] = [];
  if (practitioner?.qualification) {
    practitioner.qualification.forEach((qualification) => {
      const qualificationExt = qualification.extension?.find(
        (ext) => ext.url === PRACTITIONER_QUALIFICATION_EXTENSION_URL
      );

      if (qualificationExt) {
        const qualificationCode = qualification.code.coding?.find(
          (code) => code.system === PRACTITIONER_QUALIFICATION_CODE_SYSTEM
        )?.code as PractitionerQualificationCode;

        const stateExtension = qualificationExt.extension?.find((ext) => ext.url === 'whereValid');
        const qualificationState = stateExtension?.valueCodeableConcept?.coding?.find(
          (coding) => coding.system === PRACTITIONER_QUALIFICATION_STATE_SYSTEM
        )?.code;

        const statusExtension = qualificationExt.extension?.find((ext) => ext.url === 'status')?.valueCode;

        if (qualificationCode && qualificationState)
          allLicenses.push({
            state: qualificationState,
            code: qualificationCode,
            active: statusExtension === 'active',
          });
      }
    });
  }

  return allLicenses;
}

export const getPractitionerStateCredentials = (practioner: Practitioner): string[] => {
  return allLicensesForPractitioner(practioner).map(({ state }) => state);
};

export const getPlanIdAndNameFromCoverage = (coverage: Coverage): { planId?: string; planName?: string } => {
  const coverageClass = coverage.class?.find((cc) => {
    const typeCoding = cc.type;
    const isPlan = typeCoding.coding?.some((coded) => {
      return coded.code === 'plan';
    });
    return cc.value && isPlan;
  });

  if (!coverageClass) {
    return {};
  }
  const { value: planId, name: planName } = coverageClass;
  return { planId, planName };
};

export const getGroupNumberAndNameFromCoverage = (coverage: Coverage): { groupNumber?: string; groupName?: string } => {
  const coverageClass = coverage.class?.find((cc) => {
    const typeCoding = cc.type;
    const isGroup = typeCoding.coding?.some((coded) => {
      return coded.code === 'group';
    });
    return cc.value && isGroup;
  });

  if (!coverageClass) {
    return {};
  }
  const { value: groupNumber, name: groupName } = coverageClass;
  return { groupNumber, groupName };
};

export const getStartAndEndDatesForCoverage = (coverage: Coverage): { start?: string; end?: string } => {
  const start = coverage.period?.start;
  const end = coverage.period?.end;

  return { start, end };
};

export const getVideoRoomResourceExtension = (resource: Resource): EncounterVirtualServiceExtension | null => {
  let resourcePrefix: string;
  let castedResource;
  if (resource.resourceType === 'Appointment') {
    castedResource = resource as Appointment;
    resourcePrefix = 'appointment';
  } else if (resource.resourceType === 'Encounter') {
    castedResource = resource as Encounter;
    resourcePrefix = 'encounter';
  } else {
    return null;
  }

  for (let index = 0; index < (castedResource.extension?.length ?? 0); index++) {
    const extension = castedResource.extension?.[index];
    if (extension?.url !== `${PUBLIC_EXTENSION_BASE_URL}/${resourcePrefix}-virtual-service-pre-release`) {
      continue;
    }
    for (let j = 0; j < (extension?.extension?.length ?? 0); j++) {
      const internalExtension = extension.extension?.[j];
      if (internalExtension?.url === 'channelType' && internalExtension.valueCoding?.code === TELEMED_VIDEO_ROOM_CODE) {
        return extension as EncounterVirtualServiceExtension;
      }
    }
  }
  return null;
};
export function createReference(resource: Resource): Reference {
  return {
    reference: resource.resourceType + '/' + resource.id,
  };
}

function parseBundleIntoResources(bundle: Bundle): Resource[] {
  if (bundle.resourceType !== 'Bundle' || bundle.entry === undefined) {
    console.log('search bundle malformed: ', JSON.stringify(bundle));
    throw new Error('could not parse search bundle');
  }

  const result: Resource[] = [];
  bundle.entry.forEach((entry) => {
    if (
      entry.response?.outcome?.id === 'ok' &&
      entry.resource &&
      entry.resource.resourceType === 'Bundle' &&
      entry.resource.type === 'searchset'
    ) {
      const innerBundle = entry.resource as Bundle;
      const innerEntry = innerBundle.entry;
      if (!innerEntry) {
        throw new Error('could not parse search bundle');
      }
      innerEntry.forEach((e) => {
        if (e.resource?.resourceType && e.resource?.id) result.push(e.resource);
      });
    }
  });
  return result;
}

export async function getResourcesFromBatchInlineRequests(oystehr: Oystehr, requests: string[]): Promise<Resource[]> {
  const batchResult = await oystehr.fhir.batch<FhirResource>({
    requests: requests.map((url) => {
      return {
        method: 'GET',
        url,
      };
    }),
  });
  return parseBundleIntoResources(batchResult);
}

export async function getInsurancePlanById(id: string, oystehr: Oystehr): Promise<InsurancePlan> {
  const insurancePlan = await oystehr.fhir.get<InsurancePlan>({
    resourceType: 'InsurancePlan',
    id,
  });
  return insurancePlan;
}

export const getUnconfirmedDOBForAppointment = (appointment?: Appointment): string | undefined => {
  if (!appointment) return;
  const unconfirmedDobExt = appointment.extension?.find((ext) => {
    return ext.url.replace('http:', 'https:') === FHIR_EXTENSION.Appointment.unconfirmedDateOfBirth.url;
  });
  return unconfirmedDobExt?.valueString || unconfirmedDobExt?.valueDate;
};

export const getUnconfirmedDOBIdx = (appointment?: Appointment): number | undefined => {
  if (!appointment) return;
  return appointment.extension?.findIndex((ext) => {
    return ext.url.replace('http:', 'https:') === FHIR_EXTENSION.Appointment.unconfirmedDateOfBirth.url;
  });
};

export const getIpAddress = (questionnaireResponse?: QuestionnaireResponse): string | undefined => {
  if (!questionnaireResponse) return;
  return questionnaireResponse.extension?.find((ext) => {
    return ext.url.replace('http:', 'https:') === FHIR_EXTENSION.QuestionnaireResponse.ipAddress.url;
  })?.valueString;
};

export function filterResources(allResources: Resource[], resourceType: string): Resource[] {
  return allResources.filter((res) => res.resourceType === resourceType && res.id);
}

export function getProviderNameWithProfession(practitioner: Practitioner): string {
  const firstName = practitioner.name?.[0].given?.[0];
  const secondName = practitioner.name?.[0].family;
  const professionAbbreviation = practitioner.name?.[0].suffix?.join(' ');
  return [`${secondName}, ${firstName}`, professionAbbreviation].join(' | ');
}

export const findExtensionIndex = (extensions: Extension[], url: string): number => {
  return extensions.findIndex((e) => e.url === url);
};

export const createExtensionValue = (
  url: string,
  value: any,
  valueType: 'valueString' | 'valueBoolean' | 'valueCodeableConcept' | 'valueDateTime',
  coding?: { system: string; code: string; display?: string }
): Extension => {
  const extension: Extension = { url };

  if (valueType === 'valueCodeableConcept' && coding) {
    extension.valueCodeableConcept = {
      coding: [
        {
          system: coding.system,
          code: coding.code,
          display: coding.display,
        },
      ],
    };
  } else {
    extension[valueType] = value;
  }

  return extension;
};

export function codeableConcept(code: string, system: string, text: string | undefined = undefined): CodeableConcept {
  return {
    coding: [{ code: code, system: system }],
    text: text,
  };
}

export function filterUndefined<T>(...values: (T | undefined)[]): T[] {
  return values.filter((value) => value !== undefined) as T[];
}

export function undefinedIfEmptyArray<T>(values: T[]): T[] | undefined {
  return values.length > 0 ? values : undefined;
}

export function money(amount: number | undefined): Money | undefined {
  if (amount == null) {
    return undefined;
  }
  return {
    value: amount,
  };
}

export const extractExtensionValue = (extension: any): any => {
  if ('valueString' in extension) return extension.valueString;
  if ('valueBoolean' in extension) return extension.valueBoolean;
  if ('valueDateTime' in extension) return extension.valueDateTime;
  if ('valueCodeableConcept' in extension) {
    return extension.valueCodeableConcept.coding?.[0]?.display;
  }
  return undefined;
};

export function getArrayInfo(path: string): { isArray: boolean; parentPath: string; index: number } {
  const parts = path.split('/').filter(Boolean);
  const lastPart = parts[parts.length - 1];
  const isArray = !isNaN(Number(lastPart));
  const parentPath = isArray ? '/' + parts.slice(0, -1).join('/') : path;
  const index = isArray ? Number(lastPart) : -1;

  return { isArray, parentPath, index };
}

export const extractResourceTypeAndPath = (
  fieldName: string
): { resourceType: PatientMasterRecordResourceType; path: string } => {
  const parts = fieldName.split('/');

  const resourceType = parts[0] as PatientMasterRecordResourceType;
  const path = '/' + parts.slice(1).join('/');
  return { resourceType, path };
};

export const serviceModeForHealthcareService = (service: HealthcareService): ServiceMode | undefined => {
  const firstModeCharacteristic = service.characteristic?.find((cc) => {
    return cc.coding?.some((code) => code.system === SERVICE_MODE_SYSTEM);
  })?.coding;
  if (firstModeCharacteristic == undefined) {
    return undefined;
  }
  if (
    firstModeCharacteristic.find((code) => code.system === SERVICE_MODE_SYSTEM)?.code ===
    ServiceModeCoding.inPerson.code
  ) {
    return ServiceMode['in-person'];
  } else {
    return ServiceMode['virtual'];
  }
};

export const scheduleStrategyForHealthcareService = (service: HealthcareService): ScheduleStrategy | undefined => {
  const firstStrategyCharacteristic = service.characteristic?.find((cc) => {
    return cc.coding?.some((code) => code.system === SCHEDULE_STRATEGY_SYSTEM);
  })?.coding;
  if (firstStrategyCharacteristic == undefined) {
    return undefined;
  }
  const code = firstStrategyCharacteristic.find((code) => code.system === SCHEDULE_STRATEGY_SYSTEM)?.code;
  if (Object.values(ScheduleStrategy).includes((code ?? '') as ScheduleStrategy)) {
    return code as ScheduleStrategy;
  }
  return undefined;
};

export const extractHealthcareServiceAndSupportingLocations = (
  bundle: Resource[]
): HealthcareServiceWithLocationContext | undefined => {
  const hsList = bundle.filter((resource) => {
    return resource.resourceType == 'HealthcareService';
  }) as HealthcareService[];
  if (!hsList || hsList.length !== 1) {
    return undefined;
  }
  const hs = hsList[0];

  let locations = bundle.filter((resource) => {
    return (
      hs.location?.find((loc) => {
        loc.reference === `${resource.resourceType}/${resource.id}`;
      }) !== undefined
    );
  }) as Location[] | undefined;

  let coverageArea = bundle.filter((resource) => {
    return (
      hs.coverageArea?.find((loc) => {
        loc.reference === `${resource.resourceType}/${resource.id}`;
      }) !== undefined
    );
  }) as Location[] | undefined;

  if (locations?.length === 0) {
    locations = undefined;
  }
  if (coverageArea?.length === 0) {
    coverageArea = undefined;
  }

  return { hs, locations, coverageArea };
};

export const createFhirHumanName = (
  firstName: string | undefined,
  middleName: string | undefined,
  lastName: string | undefined
): HumanName[] | undefined => {
  let givenNames: string[] | undefined;
  let familyName: string | undefined;
  let fhirName: HumanName[] | undefined;
  if (firstName) {
    givenNames = [firstName];
    if (middleName) {
      givenNames.push(middleName);
    }
  }
  if (lastName) {
    familyName = lastName;
  }
  if (givenNames || familyName) {
    fhirName = [
      {
        given: givenNames,
        family: familyName,
      },
    ];
  }
  return fhirName;
};
