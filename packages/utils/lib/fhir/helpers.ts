import Oystehr, { BatchInputPostRequest, SearchParam } from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import {
  Account,
  Address,
  Appointment,
  Bundle,
  CodeableConcept,
  Coding,
  Consent,
  ContactPoint,
  Coverage,
  DocumentReference,
  DomainResource,
  Element,
  Encounter,
  Extension,
  FhirResource,
  HealthcareService,
  HumanName,
  Identifier,
  List,
  Location,
  Meta,
  Money,
  OperationOutcome,
  Organization,
  Patient,
  Practitioner,
  QuestionnaireResponse,
  Reference,
  RelatedPerson,
  Resource,
  Schedule,
  ServiceRequest,
  Signature,
  Slot,
  Task,
  TaskInput,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  addOperation,
  CODE_SYSTEM_COVERAGE_CLASS,
  createPatientDocumentList,
  docRefIsLabGeneratedResult,
  docRefIsOgHl7Transmission,
  findExistingListByDocumentTypeCode,
  getMimeType,
  getPatchOperationsForNewMetaTags,
  getPatchOperationToRemoveMetaTags,
  LAB_RESULT_DOC_REF_CODING_CODE,
  PatientMasterRecordResourceType,
  replaceOperation,
  TaskCoding,
  TELEMED_VIDEO_ROOM_CODE,
  User,
  VisitStatusWithoutUnknown,
} from 'utils';
import {
  APPOINTMENT_NOT_FOUND_ERROR,
  BookableResource,
  EncounterVirtualServiceExtension,
  HealthcareServiceWithLocationContext,
  PractitionerLicense,
  PractitionerQualificationCode,
  PROJECT_WEBSITE,
  SCHEDULE_NOT_FOUND_ERROR,
  ScheduleOwnerFhirResource,
  ServiceMode,
  VisitType,
} from '../types';
import {
  ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE,
  ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE_ACCOUNT,
  APPOINTMENT_LOCKED_META_TAG,
  APPOINTMENT_LOCKED_META_TAG_SYSTEM,
  COVERAGE_MEMBER_IDENTIFIER_BASE,
  FHIR_EXTENSION,
  FHIR_IDENTIFIER_CODE_TAX_EMPLOYER,
  FHIR_IDENTIFIER_CODE_TAX_SS,
  FHIR_IDENTIFIER_NPI,
  FHIR_IDENTIFIER_SYSTEM,
  FOLDERS_CONFIG,
  PRACTITIONER_QUALIFICATION_CODE_SYSTEM,
  PRACTITIONER_QUALIFICATION_EXTENSION_URL,
  PRACTITIONER_QUALIFICATION_STATE_SYSTEM,
  PUBLIC_EXTENSION_BASE_URL,
  SCHEDULE_STRATEGY_SYSTEM,
  ScheduleStrategy,
  SERVICE_MODE_SYSTEM,
  ServiceModeCoding,
  SLUG_SYSTEM,
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
          tc.system === FHIR_IDENTIFIER_SYSTEM &&
          (tc.code === FHIR_IDENTIFIER_CODE_TAX_EMPLOYER || tc.code === FHIR_IDENTIFIER_CODE_TAX_SS)
      );
    }
    // don't check for SS on anything that isn't a Practitioner
    return ident.type?.coding?.some(
      (tc) => tc.system === FHIR_IDENTIFIER_SYSTEM && tc.code === FHIR_IDENTIFIER_CODE_TAX_EMPLOYER
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
  } catch {
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

export async function createFilesDocumentReferences(
  input: CreateDocumentReferenceInput
): Promise<{ listResources: List[] | undefined; docRefs: DocumentReference[] }> {
  const { files, type, meta, dateCreated, docStatus, references, oystehr, searchParams, generateUUID, listResources } =
    input;
  console.log('files for doc refs', JSON.stringify(files, null, 2));
  const isLabsResultDoc = type.coding?.[0].code === LAB_RESULT_DOC_REF_CODING_CODE.code;
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

    const docRefs: DocumentReference[] = [];
    // Track new entries by list type code
    const newEntriesByType: Record<string, Array<{ date: string; item: { type: string; reference: string } }>> = {};

    for (const file of files) {
      // Check if there's an existing DocumentReference for this file
      const existingDoc = docsJson.find(
        (doc) => doc.content[0]?.attachment.title === file.title && doc.content[0]?.attachment.url === file.url
      );

      if (existingDoc) {
        // If exact same file exists, reuse it
        docRefs.push(existingDoc);
        continue;
      }
      // If different version exists, mark it as superseded
      const oldDoc = docsJson.find((doc) => {
        if (!isLabsResultDoc) {
          return doc.content[0]?.attachment.title === file.title;
        } else {
          console.log('isLabsResultDoc');
          const isLabGeneratedDocRef = docRefIsLabGeneratedResult(doc);
          console.log('isLabGeneratedDocRef:', isLabGeneratedDocRef);
          const isOgTransmissionDocRef = docRefIsOgHl7Transmission(doc);
          console.log('isOgTransmissionDocRef:', isOgTransmissionDocRef);
          const docShouldBeSuperseded = !isLabGeneratedDocRef && !isOgTransmissionDocRef;
          return docShouldBeSuperseded;
        }
      });
      if (oldDoc) {
        await oystehr.fhir.patch({
          resourceType: 'DocumentReference',
          id: oldDoc.id || '',
          operations: [{ op: 'replace', path: '/status', value: 'superseded' }],
        });
      }

      // Create all DocumentReferences
      const contentType = getMimeType(file.url);

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
        let typeCode = type.coding[0].code;
        if (type.coding.length > 1) {
          // If there is more than 1 it is the consents special case. take the one that has the https://fhir.ottehr.com/CodeSystem/consent-source system
          const maybeConsentCoding = type.coding.find(
            (coding) => coding.system === 'https://fhir.ottehr.com/CodeSystem/consent-source'
          );
          if (maybeConsentCoding && maybeConsentCoding.code) {
            typeCode = maybeConsentCoding.code;
          }
        }
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
        docRefs.push(docRef);
      }
    }

    // Update lists
    let updatedListResources = listResources;
    if (listResources) {
      const newListResources: List[] = [];
      for (const [typeCode, newEntries] of Object.entries(newEntriesByType)) {
        let list = findExistingListByDocumentTypeCode(listResources, typeCode);
        if (!list) {
          const config = FOLDERS_CONFIG.find((config) => config.documentTypeCode === typeCode);
          const patientReference = (references as any).subject?.reference;
          if (config && typeof patientReference === 'string' && patientReference.startsWith('Patient/')) {
            list = await oystehr.fhir.create<List>(createPatientDocumentList(patientReference, config));
          } else {
            console.log(`Can't create a list for config "${typeCode}" and patient "${patientReference}"`);
          }
        }
        if (list?.id) {
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
          newListResources.push(listPatchResult);
        }
      }

      updatedListResources = listResources.map((list) => {
        const updatedList = newListResources.find((newList) => newList.id === list.id);
        if (updatedList) console.log(`updating ${list.title}`);
        return updatedList ?? list;
      });
    }

    return {
      listResources: updatedListResources ?? [],
      docRefs,
    };
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
          uri: PROJECT_WEBSITE,
        },
        {
          uri: PROJECT_WEBSITE,
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

export const CRITICAL_CHANGE_SYSTEM = 'critical-update-by'; // exists in ehr as well
export const STATUS_UPDATE_TAG_SYSTEM = 'status-update';

export const createCriticalUpdateTag = (updateBy: string): Coding => {
  return {
    system: CRITICAL_CHANGE_SYSTEM,
    display: updateBy,
    version: DateTime.now().toISO() || '',
  };
};

export const getCriticalUpdateTagOp = (resource: Resource, updateBy: string): Operation => {
  const recordUpdateByTag = createCriticalUpdateTag(updateBy);

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

// adds critical update tag to track status changes & tag with corresponding status change code
// todo we should come up with a better way to render activity logs, probably with provenance resources
export const getAppointmentMetaTagOpForStatusUpdate = (
  appointment: Appointment,
  updatedStatus: VisitStatusWithoutUnknown,
  updatedBy: {
    user?: User;
    updatedByOverride?: string;
  }
): Operation[] => {
  const { user, updatedByOverride } = updatedBy;
  const statusTag = { system: STATUS_UPDATE_TAG_SYSTEM, code: updatedStatus, display: updatedStatus };
  const staffUpdateBy = user ? `Staff ${user?.email ? user.email : `(${user?.id})`}` : 'n/a';
  const updatedByText = updatedByOverride ? updatedByOverride : staffUpdateBy;
  const updateTag = {
    system: CRITICAL_CHANGE_SYSTEM,
    display: updatedByText,
    version: DateTime.now().toISO() || '',
  };
  const ops = getPatchOperationsForNewMetaTags(appointment, [statusTag, updateTag]);
  return ops;
};

export const getLocationIdFromAppointment = (appointment: Appointment): string | undefined => {
  return appointment.participant
    .find((appointment) => appointment.actor?.reference?.startsWith('Location/'))
    ?.actor?.reference?.replace('Location/', '');
};

// Helper functions for appointment locking meta tags
export const isAppointmentLocked = (appointment: Appointment): boolean => {
  return (
    appointment.meta?.tag?.some(
      (tag) => tag.system === APPOINTMENT_LOCKED_META_TAG_SYSTEM && tag.code === APPOINTMENT_LOCKED_META_TAG.code
    ) ?? false
  );
};

export const getAppointmentLockMetaTagOperations = (appointment: Appointment, isLocked: boolean): Operation[] => {
  const lockedTag = APPOINTMENT_LOCKED_META_TAG;

  if (isLocked) {
    // Add the locked tag if it doesn't exist
    return getPatchOperationsForNewMetaTags(appointment, [lockedTag]);
  } else {
    // Remove the locked tag if it exists
    return [getPatchOperationToRemoveMetaTags(appointment, [lockedTag])];
  }
};

export const getAbbreviationFromLocation = (location: Location): string | undefined => {
  return location.address?.state;
};

export function getTaskResource(coding: TaskCoding, appointmentID: string, encounterId?: string): Task {
  return {
    resourceType: 'Task',
    status: 'requested',
    intent: 'plan',
    focus: {
      type: 'Appointment',
      reference: appointmentID.startsWith('urn:uuid:') ? appointmentID : `Appointment/${appointmentID}`,
    },
    encounter: encounterId ? { type: 'Encounter', reference: `Encounter/${encounterId}` } : undefined,
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
        const licenseNumber = qualificationExt.extension?.find((ext) => ext.url === 'number')?.valueString;
        const licenseExpDate = qualificationExt.extension?.find((ext) => ext.url === 'expDate')?.valueDate;

        const statusExtension = qualificationExt.extension?.find((ext) => ext.url === 'status')?.valueCode;

        if (qualificationCode && qualificationState)
          allLicenses.push({
            state: qualificationState,
            code: qualificationCode,
            number: licenseNumber,
            date: licenseExpDate,
            active: statusExtension === 'active',
          });
      }
    });
  }

  return allLicenses;
}

export const getPractitionerStateCredentials = (practitioner: Practitioner): string[] => {
  return allLicensesForPractitioner(practitioner).map(({ state }) => state);
};

export const getAllPractitionerCredentials = (practitioner: Practitioner): string[] => {
  return practitioner.name?.[0]?.suffix ?? [];
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

export async function getInsuranceOrgById(id: string, oystehr: Oystehr): Promise<Organization> {
  const insuranceOrg = await oystehr.fhir.get<Organization>({
    resourceType: 'Organization',
    id,
  });
  return insuranceOrg;
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
  const fullName = [secondName, firstName].filter(Boolean).join(', ');

  return [fullName, professionAbbreviation].filter(Boolean).join(' | ');
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
        return loc.reference === `${resource.resourceType}/${resource.id}`;
      }) !== undefined
    );
  }) as Location[] | undefined;

  let coverageArea = bundle.filter((resource) => {
    return (
      hs.coverageArea?.find((loc) => {
        return loc.reference === `${resource.resourceType}/${resource.id}`;
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

export const mapBirthSexToGender = (
  birthSex: 'Male' | 'Female' | 'Intersex' | undefined
): (RelatedPerson | Patient)['gender'] => {
  if (birthSex === 'Male') {
    return 'male';
  }
  if (birthSex === 'Female') {
    return 'female';
  }
  if (birthSex === 'Intersex') {
    return 'other';
  }
  return 'unknown';
};

export const genderMap = {
  male: 'Male',
  female: 'Female',
  other: 'Intersex',
} as const;

export type Gender = (typeof genderMap)[keyof typeof genderMap];

export const getMemberIdFromCoverage = (coverage: Coverage): string | undefined => {
  return coverage.identifier?.find((ident) => {
    return ident.type?.coding?.some(
      (tc) =>
        tc.code === COVERAGE_MEMBER_IDENTIFIER_BASE.type?.coding?.[0].code &&
        tc.system === COVERAGE_MEMBER_IDENTIFIER_BASE.type?.coding?.[0]?.system
    );
  })?.value;
};

export const createCoverageMemberIdentifier = (memberId: string, insuranceOrg: Organization): Identifier => {
  return {
    ...COVERAGE_MEMBER_IDENTIFIER_BASE, // this holds the 'type'
    value: memberId,
    assigner: {
      reference: `Organization/${insuranceOrg.id}`,
      display: insuranceOrg.name,
    },
  };
};

export const identifiersMatch = (ident1: Identifier, ident2: Identifier): boolean => {
  const systemAndValueMatch = ident1.value === ident2.value && ident1.system === ident2.system;
  const assignerMatch = ident1.assigner?.reference === ident2.assigner?.reference;
  if (ident1.type?.coding !== undefined && ident2.type?.coding !== undefined) {
    const codingOverlap = ident1.type?.coding?.some((coding) => {
      return codingContainedInList(coding, ident2.type?.coding ?? []);
    });
    if (!codingOverlap) {
      return false;
    }
  } else if (ident1.type?.coding !== undefined) {
    return false;
  } else if (ident2?.type?.coding !== undefined) {
    return false;
  }
  return systemAndValueMatch && assignerMatch;
};

export const deduplicateContactPoints = (contactPoints: ContactPoint[]): ContactPoint[] => {
  const uniqueContactPoints: ContactPoint[] = [];
  contactPoints.forEach((contactPoint) => {
    if (
      !uniqueContactPoints.some(
        (uniqueContactPoint) =>
          uniqueContactPoint.system === contactPoint.system &&
          uniqueContactPoint.value === contactPoint.value &&
          uniqueContactPoint.use === contactPoint.use
      )
    ) {
      uniqueContactPoints.push(contactPoint);
    }
  });
  return uniqueContactPoints;
};

export const deduplicateIdentifiers = (identifiers: Identifier[]): Identifier[] => {
  const uniqueIdentifiers: Identifier[] = [];
  identifiers.forEach((identifier) => {
    if (
      !uniqueIdentifiers.some((uniqueIdentifier) => {
        return identifiersMatch(uniqueIdentifier, identifier);
      })
    ) {
      uniqueIdentifiers.push(identifier);
    }
  });
  return uniqueIdentifiers;
};

const normalizeObject = <T extends object>(input: T): T => {
  const normalizedObject: any = {};
  const sortedKeys = Object.keys(input).sort();

  sortedKeys.forEach((key) => {
    const value = (input as any)[key];
    if (Array.isArray(value)) {
      normalizedObject[key] = value.map((item) => normalizeObject(item));
    } else if (typeof value === 'object' && value !== null) {
      normalizedObject[key] = normalizeObject(value);
    } else {
      normalizedObject[key] = value;
    }
  });

  return normalizedObject as T;
};

export const deduplicateObjectsByStrictKeyValEquality = <T extends object>(objects: T[]): T[] => {
  const uniqueObjects: Record<string, T> = {};
  objects.forEach((object) => {
    uniqueObjects[JSON.stringify(normalizeObject(object))] = object;
  });
  return Object.values(uniqueObjects);
};

export const checkForPatientDemographicMatch = (
  patient: Patient,
  comp: Partial<Patient>,
  optionalAdditionalProps?: (keyof Patient)[]
): boolean => {
  const additionalProps = optionalAdditionalProps ?? [];

  const { name: patientName, birthDate: patientDOB } = patient;
  const { name: compName, birthDate: compDOB } = comp;

  if (!compName || !compDOB || !patientName || !patientDOB || !patientName.length || !compName.length) {
    return false;
  }

  if (patientDOB !== compDOB) {
    return false;
  }

  const { given: patientGiven, family: patientFamily } = patientName[0];
  const { given: compGiven, family: compFamily } = compName[0];

  if (patientFamily !== compFamily) {
    return false;
  }

  if (!patientGiven || !patientGiven.length || !compGiven || !compGiven.length) {
    return false;
  }
  if (patientGiven[0] !== compGiven[0]) {
    return false;
  }
  for (let i = 0; i < patientGiven.length; i++) {
    if (patientGiven[i] && compGiven[i] && patientGiven[i] !== compGiven[i]) {
      return false;
    }
  }

  for (const prop of additionalProps) {
    if (patient[prop] !== comp[prop]) {
      return false;
    }
  }

  return true;
};
export function flattenBundleResources<T extends FhirResource = ServiceRequest | Task>(
  searchResults: Bundle<FhirResource>
): T[] {
  const flattenedResources: FhirResource[] = [];

  searchResults.entry?.forEach((resultEntry) => {
    const bundle = resultEntry.resource;

    if (bundle?.resourceType === 'Bundle' && Array.isArray(bundle.entry)) {
      bundle.entry.forEach((entry) => {
        if (entry.resource) {
          flattenedResources.push(entry.resource);
        }
      });
    } else if (bundle?.resourceType && bundle.resourceType !== 'Bundle') {
      flattenedResources.push(bundle);
    }
  });

  return flattenedResources as T[];
}

export function slashPathToLodashPath(slashPath: string): string {
  return slashPath
    .split('/')
    .filter(Boolean)
    .map((key) => (isNaN(Number(key)) ? key : `[${key}]`))
    .join('.')
    .replace(/\.\[/g, '[');
}

export const takeContainedOrFind = <T extends Resource>(
  referenceString: string,
  resourceList: Resource[],
  parent: DomainResource
): T | undefined => {
  if (referenceString.startsWith('#')) {
    return parent.contained?.find((resource) => `#${resource.id}` === referenceString) as T | undefined;
  }

  return resourceList.find((res) => `${res.resourceType}/${res.id}` === referenceString) as T | undefined;
};

export const unpackFhirResponse = async <T>(response: { json: () => Promise<any> }): Promise<T> => {
  const data = await response.json();
  return (data.output ? data.output : data) as T;
};

export const unbundleBatchPostOutput = <T extends Resource>(bundle: Bundle<T>): T[] => {
  return (bundle.entry?.map((entry) => entry.resource) ?? []) as T[];
};

export const getVersionedReferencesFromBundleResources = (bundle: Bundle): Reference[] => {
  return (bundle.entry ?? []).flatMap((entry) => {
    const { resource } = entry;
    if (!resource) {
      return [];
    }
    const { meta, resourceType, id } = resource;
    const versionId = meta?.versionId;
    let reference = `${resourceType}/${id}`;
    if (versionId) {
      reference += `/_history/${versionId}`;
    }

    return { reference };
  });
};

export const checkBundleOutcomeOk = (bundle: Bundle): boolean => {
  const outcomeEntry = bundle.entry?.[0]?.response?.outcome?.id === 'ok';
  return outcomeEntry;
};

export const getStripeCustomerIdFromAccount = (
  account: Account,
  stripeAccount: string | undefined
): string | undefined => {
  if (!stripeAccount) {
    return account.identifier?.find((ident) => {
      return ident.system === ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE && !ident.extension;
    })?.value;
  } else {
    return account.identifier?.find((ident) => {
      return (
        ident.system === ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE &&
        ident.extension?.some((ext) => {
          return ext.url === ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE_ACCOUNT && ext.valueString === stripeAccount;
        })
      );
    })?.value;
  }
};

export const getAllStripeCustomerAccountPairs = (
  account: Account
): { stripeAccount: string | undefined; customerId: string }[] => {
  const stripeIdentifiers = account.identifier?.filter((ident) => {
    return ident.system === ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE;
  });
  if (!stripeIdentifiers) {
    return [];
  }
  return stripeIdentifiers.map((ident) => {
    const stripeAccount = ident.extension?.find((ext) => {
      return ext.url === ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE_ACCOUNT;
    })?.valueString;
    return { stripeAccount, customerId: ident.value ?? '' };
  });
};

export const getActiveAccountGuarantorReference = (account: Account): string | undefined => {
  const guarantor = account?.guarantor?.find((g) => g.period?.end === undefined)?.party;
  return guarantor?.reference;
};

export const getSlugForBookableResource = (resource: BookableResource): string | undefined => {
  return resource.identifier?.find((id) => {
    return id.system === SLUG_SYSTEM;
  })?.value;
};

export function getCoding(
  codeableConcept: CodeableConcept | CodeableConcept[] | undefined,
  system: string
): Coding | undefined {
  const array = Array.isArray(codeableConcept) ? codeableConcept : [codeableConcept];
  for (const codeableConcept of array) {
    const coding = codeableConcept?.coding?.find((coding) => coding.system === system);
    if (coding) {
      return coding;
    }
  }
  return undefined;
}

export const getAddressString = (addressResource: Address | undefined): string => {
  if (!addressResource) {
    return '';
  }
  const { line, city, state, postalCode } = addressResource;

  let address = '';
  if (line?.[0]) {
    address += line?.[0];
    if (line?.[1]) {
      address += `, ${line?.[1]}`;
    }
  }
  if (city) {
    if (address.length > 0) {
      address += ', ';
    }
    address += city;
  }
  if (state) {
    if (address.length > 0) {
      address += ', ';
    }
    address += state;
  }
  if (postalCode) {
    if (address.length > 0) {
      address += ' ';
    }
    address += postalCode;
  }
  return address;
};

export const getAddressStringForScheduleResource = (
  scheduleResource: ScheduleOwnerFhirResource | undefined
): string | undefined => {
  if (!scheduleResource) {
    return undefined;
  }
  let address: string | undefined;
  if (scheduleResource.resourceType === 'Location') {
    address = getAddressString(scheduleResource.address);
  } else if (scheduleResource.resourceType === 'Practitioner') {
    address = getAddressString(scheduleResource.address?.[0]);
  }
  console.log('getAddressStringForScheduleResource', scheduleResource.resourceType, address);
  return address;
};

export function getExtension(resource: DomainResource | Element, url: string): Extension | undefined {
  return resource.extension?.find((extension) => extension.url === url);
}

export const cleanUpStaffHistoryTag = (resource: Resource, field: string): Operation | undefined => {
  // going forward we will be using the history of the patient resource so this isn't needed
  // check if there is a tag to clean up
  const staffHistoryTagIdx = resource.meta?.tag?.findIndex((tag) => tag.system === `staff-update-history-${field}`);
  if (staffHistoryTagIdx !== undefined && staffHistoryTagIdx >= 0) {
    return {
      op: 'remove',
      path: `/meta/tag/${staffHistoryTagIdx}`,
    };
  } else {
    return;
  }
};

export const getAttestedConsentFromEncounter = (encounter: Encounter): Signature | undefined => {
  console.log('getAttestedConsentFromEncounter', JSON.stringify(encounter));
  return encounter.extension?.find((ext) => ext.url === FHIR_EXTENSION.Encounter.attestedConsent.url)?.valueSignature;
};

export const getInsuranceNameFromCoverage = (coverage: Coverage): string | undefined => {
  return coverage?.class?.find(
    (cls) => cls.type.coding?.find((coding) => coding.system === CODE_SYSTEM_COVERAGE_CLASS && coding.code === 'plan')
  )?.name;
};

export function getPatientReferenceFromAccount(account: Account): string | undefined {
  return account.subject?.find((subj) => subj.reference?.includes('Patient/'))?.reference;
}

export function getResponsiblePartyFromAccount(
  account: Account,
  resources: Resource[]
): Patient | RelatedPerson | undefined {
  const responsiblePartyRef = getActiveAccountGuarantorReference(account);
  if (!responsiblePartyRef) return undefined;
  return takeContainedOrFind<RelatedPerson | Patient>(responsiblePartyRef, resources, account);
}

export const getScheduleOwnerFromAppointmentOrEncounter = async (
  input: { appointmentId?: string; encounterId?: string },
  oystehr: Oystehr
): Promise<Location | HealthcareService | Practitioner> => {
  const { appointmentId, encounterId } = input;
  const appointmentSearchParams: SearchParam[] = [
    {
      name: '_include',
      value: 'Appointment:actor',
    },
    {
      name: '_include',
      value: 'Appointment:slot',
    },
    {
      name: '_include:iterate',
      value: 'Slot:schedule',
    },
    {
      name: '_revinclude:iterate',
      value: 'Schedule:actor:Location',
    },
    {
      name: '_revinclude:iterate',
      value: 'Schedule:actor:Practitioner',
    },
  ];

  if (appointmentId) {
    appointmentSearchParams.push({
      name: '_id',
      value: appointmentId,
    });
  } else if (encounterId) {
    appointmentSearchParams.push({ name: '_has:Encounter:appointment:_id', value: encounterId });
  } else {
    throw new Error('Either appointmentId or encounterId must be provided');
  }

  const allResources = (
    await oystehr.fhir.search<Appointment | Slot | Schedule | Location | HealthcareService | Practitioner>({
      resourceType: 'Appointment',
      params: appointmentSearchParams,
    })
  ).unbundle();
  console.log(`successfully retrieved ${allResources.length} appointment resources`);
  const fhirAppointment = allResources.find((resource) => resource.resourceType === 'Appointment') as Appointment;
  const fhirLocation = allResources.find((resource) => resource.resourceType === 'Location');
  const fhirHS = allResources.find((resource) => resource.resourceType === 'HealthcareService');
  const fhirPractitioner = allResources.find((resource) => resource.resourceType === 'Practitioner');

  let scheduleOwner: Location | HealthcareService | Practitioner | undefined;
  if (fhirLocation) {
    scheduleOwner = fhirLocation as Location;
  } else if (fhirHS) {
    scheduleOwner = fhirHS as HealthcareService;
  } else if (fhirPractitioner) {
    scheduleOwner = fhirPractitioner as Practitioner;
  }

  if (!fhirAppointment) {
    throw APPOINTMENT_NOT_FOUND_ERROR;
  }

  if (!scheduleOwner) {
    throw SCHEDULE_NOT_FOUND_ERROR;
  }

  return scheduleOwner;
};
