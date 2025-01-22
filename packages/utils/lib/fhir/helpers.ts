import Oystehr, { BatchInputPostRequest, BatchInputRequest } from '@oystehr/sdk';
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
  InsurancePlan,
  List,
  Location,
  Meta,
  Money,
  OperationOutcome,
  Practitioner,
  QuestionnaireResponse,
  Reference,
  Resource,
  Task,
  TaskInput,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  findExistingListByDocumentTypeCode,
  getPatchBinary,
  PatientMasterRecordResourceType,
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

export function getPractitionerNPI(practitioner: Practitioner): string | undefined {
  return practitioner.identifier?.find((ident) => {
    // correct uri http://hl7.org/fhir/sid/us-npi
    // will need to clean up in prod before removing search for the incorrect one
    return ident.system === 'http://hl7.org/fhir/sid/us-npi' || ident.system === 'http://hl7.org.fhir/sid/us-npi';
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

export interface CreateDocumentReferenceInput {
  docInfo: { contentURL: string; title: string; mimeType: string }[];
  type: CodeableConcept;
  dateCreated: string;
  references: object;
  oystehr: Oystehr;
  generateUUID?: () => string;
  docStatus?: 'preliminary' | 'final' | 'amended' | 'entered-in-error' | undefined;
  meta?: Meta;
  listResources?: List[];
}

export async function createDocumentReference(input: CreateDocumentReferenceInput): Promise<DocumentReference> {
  const { docInfo, type, dateCreated, references, oystehr, generateUUID, docStatus, listResources, meta } = input;
  try {
    console.log('creating new document reference resource');
    const writeDRFullUrl = generateUUID ? generateUUID() : undefined;
    const writeDocRefReq: BatchInputPostRequest<DocumentReference> = {
      method: 'POST',
      fullUrl: writeDRFullUrl,
      url: '/DocumentReference',
      resource: {
        resourceType: 'DocumentReference',
        meta: meta,
        docStatus,
        date: dateCreated,
        status: 'current',
        type: type,
        content: docInfo.map((tempInfo) => {
          return { attachment: { url: tempInfo.contentURL, contentType: tempInfo.mimeType, title: tempInfo.title } };
        }),
        ...references,
      },
    };

    // Add document reference to list
    const listRequests: BatchInputRequest<List>[] = [];
    if (listResources && type.coding?.[0]?.code) {
      const list = findExistingListByDocumentTypeCode(listResources, type.coding?.[0]?.code);
      if (list?.id) {
        const patchListWithDocRefOperation: Operation = {
          op: 'add',
          path: '/entry',
          value: {
            item: {
              reference: writeDocRefReq.fullUrl!,
            },
          },
        };

        const patchRequest = getPatchBinary({
          resourceId: list.id,
          resourceType: 'List',
          patchOperations: [patchListWithDocRefOperation],
        });

        listRequests.push(patchRequest);
      }
    }

    const results = await oystehr.fhir.transaction<DocumentReference | List>({
      requests: [writeDocRefReq, ...listRequests],
    });
    const docRef = results.entry?.[0]?.resource;
    if (docRef?.resourceType !== 'DocumentReference') {
      throw 'failed';
    }
    return docRef;
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
