import { FhirClient, SearchParam } from '@zapehr/sdk';
import { Operation } from 'fast-json-patch';
import {
  Appointment,
  CodeableConcept,
  Coding,
  Consent,
  DocumentReference,
  DocumentReferenceContent,
  Location,
  Patient,
  Person,
  QuestionnaireResponse,
  RelatedPerson,
  Resource,
} from 'fhir/r4';
import { getPatchOperationForNewMetaTag, removeTimeFromDate } from 'utils';
import { CancellationReasonCodes, CancellationReasonOptions, PatientInfo } from '../types';
import { getPatchOperationsToUpdateVisitStatus } from './other-ehr';

export async function createPatientResource(parameters: PatientInfo, fhirClient: FhirClient): Promise<any> {
  try {
    if (!parameters.firstName) {
      throw new Error('First name is undefined');
    }
    const patientResource: Patient = {
      resourceType: 'Patient',
      name: [
        {
          given: [parameters.firstName],
          family: parameters.lastName,
        },
      ],
      birthDate: removeTimeFromDate(parameters.dateOfBirth ?? ''),
      gender: parameters.sex,
      active: true,
    };
    const response: Patient = await fhirClient.createResource(patientResource);
    return response;
  } catch (error: unknown) {
    throw new Error(`Failed to create Patient: ${JSON.stringify(error)}`);
  }
}

export async function getPatientResource(patientID: string, fhirClient: FhirClient): Promise<Patient> {
  const response: Patient = await fhirClient.readResource({
    resourceType: 'Patient',
    resourceId: patientID ?? '',
  });

  return response;
}

export async function getPatientResourceWithVerifiedPhoneNumber(
  patientID: string,
  fhirClient: FhirClient,
): Promise<{ patient: Patient | undefined; verifiedPhoneNumber: string | undefined }> {
  const response: (Patient | RelatedPerson | Person)[] = await fhirClient.searchResources({
    resourceType: 'Patient',
    searchParams: [
      {
        name: '_id',
        value: patientID,
      },
      {
        name: '_revinclude',
        value: 'RelatedPerson:patient',
      },
      {
        name: '_revinclude:iterate',
        value: 'Person:link:RelatedPerson',
      },
    ],
  });

  const patient = response.find((res) => {
    return res.resourceType === 'Patient';
  }) as Patient;

  const person = response.find((res) => {
    return res.resourceType === 'Person';
  }) as Person;

  const contacts = person?.telecom ?? [];

  const verifiedPhoneNumber = contacts.find((contact) => {
    if (contact.system === 'phone' && contact.value) {
      return contact.period?.end == undefined;
    }
    return false;
  })?.value;

  return { patient, verifiedPhoneNumber };
}

export async function getAppointmentResource(
  appointmentID: string,
  fhirClient: FhirClient,
): Promise<Appointment | undefined> {
  let response: Appointment | null = null;
  try {
    response = await fhirClient.readResource<Appointment>({
      resourceType: 'Appointment',
      resourceId: appointmentID,
    });
  } catch (error: any) {
    if (error?.issue?.[0]?.code === 'not-found') {
      return undefined;
    } else {
      throw error;
    }
  }

  return response;
}

export async function getLocationResource(locationID: string, fhirClient: FhirClient): Promise<Location | undefined> {
  let response: Location | null = null;
  try {
    response = await fhirClient.readResource<Location>({
      resourceType: 'Location',
      resourceId: locationID,
    });
  } catch (error: any) {
    if (error?.issue?.[0]?.code === 'not-found') {
      return undefined;
    } else {
      throw error;
    }
  }

  return response;
}

export async function getRelatedPersonResource(id: string, fhirClient: FhirClient): Promise<RelatedPerson> {
  const response: RelatedPerson = await fhirClient.readResource({
    resourceType: 'RelatedPerson',
    resourceId: id,
  });

  return response;
}

export async function updatePatientResource(
  patientId: string,
  patchOperations: Operation[],
  fhirClient: FhirClient,
): Promise<Patient> {
  try {
    const response: Patient = await fhirClient.patchResource({
      resourceType: 'Patient',
      resourceId: patientId,
      operations: patchOperations,
    });
    return response;
  } catch (error: unknown) {
    throw new Error(`Failed to update Patient: ${JSON.stringify(error)}`);
  }
}

export async function cancelAppointmentResource(
  appointment: Appointment,
  cancellationReason: CancellationReasonOptions,
  fhirClient: FhirClient,
): Promise<Appointment> {
  if (!appointment.id) {
    throw Error('Appointment resource missing id');
  }

  try {
    const response: Appointment = await fhirClient.patchResource({
      resourceType: 'Appointment',
      resourceId: appointment.id,
      operations: [
        {
          op: 'replace',
          path: '/status',
          value: 'cancelled',
        },
        {
          op: 'add',
          path: '/cancelationReason',
          value: {
            coding: [
              {
                // todo reassess codes and reasons, just using custom codes atm
                system: 'http://terminology.hl7.org/CodeSystem/appointment-cancellation-reason',
                code: CancellationReasonCodes[cancellationReason],
                display: cancellationReason,
              },
            ],
          },
        },
      ],
    });
    return response;
  } catch (error: unknown) {
    throw new Error(`Failed to cancel Appointment: ${JSON.stringify(error)}`);
  }
}

// todo maybe refactor use case to use patchAppt instead and get rid of this and rename above
export async function updateAppointmentTime(
  appointment: Appointment,
  startTime: string,
  endTime: string,
  fhirClient: FhirClient,
): Promise<Appointment> {
  const statusOps = getPatchOperationsToUpdateVisitStatus(appointment, 'PENDING');
  try {
    const json: Appointment = await fhirClient.patchResource({
      resourceType: 'Appointment',
      resourceId: appointment.id ?? '',
      operations: [
        {
          op: 'replace',
          path: '/start',
          value: startTime,
        },
        {
          op: 'replace',
          path: '/end',
          value: endTime,
        },
        ...statusOps,
      ],
    });
    return json;
  } catch (error: unknown) {
    throw new Error(`Failed to update Appointment: ${JSON.stringify(error)}`);
  }
}

export async function createCardsDocumentReference(
  cardFrontUrl: string | undefined,
  cardBackUrl: string | undefined,
  cardFrontTitle: string,
  cardBackTitle: string,
  type: CodeableConcept,
  dateCreated: string,
  referenceParam: object,
  searchParams: SearchParam[],
  fhirClient: FhirClient,
): Promise<DocumentReference | null> {
  try {
    console.log('searching for current document reference');
    const docsResponse = fhirClient.searchResources<DocumentReference>({
      resourceType: 'DocumentReference',
      searchParams: [
        {
          name: 'status',
          value: 'current',
        },
        ...searchParams,
      ],
    });

    const docsJson = await docsResponse;

    // Check if cards have changed
    if (docsJson.length > 0) {
      let currentCardsIndex = null;
      const docsUpdated = docsJson.map((oldDoc, index) => {
        const frontIndex = oldDoc.content.findIndex((card) => card.attachment.title === cardFrontTitle);
        const backIndex = oldDoc.content.findIndex((card) => card.attachment.title === cardBackTitle);
        const frontUpdated = oldDoc.content?.[frontIndex]?.attachment?.url !== (cardFrontUrl || undefined);
        const backUpdated = oldDoc.content?.[backIndex]?.attachment?.url !== (cardBackUrl || undefined);

        if (frontUpdated || backUpdated) {
          console.log('card document reference is changing');
          fhirClient
            .patchResource({
              resourceType: 'DocumentReference',
              resourceId: oldDoc.id || '',
              operations: [{ op: 'replace', path: '/status', value: 'superseded' }],
            })
            .catch((error) => {
              throw new Error(`Failed to update card DocumentReference status: ${JSON.stringify(error)}`);
            });
          console.log(`Card DocumentReference ${oldDoc.id} status changed to superseded`);
          return true;
        } else {
          console.log('No change in cards');
          currentCardsIndex = index;
          return false;
        }
      });

      if (docsUpdated.includes(false) && currentCardsIndex !== null) {
        return docsJson[currentCardsIndex];
      }
    }

    const content: DocumentReferenceContent[] = [];

    if (cardFrontUrl) {
      const urlExt = cardFrontUrl.split('.').slice(-1).toString();
      content.push({
        attachment: {
          url: cardFrontUrl,
          contentType: `image/${urlExt === 'jpg' ? 'jpeg' : urlExt}`,
          title: cardFrontTitle,
        },
      });
    }

    if (cardBackUrl) {
      const urlExt = cardBackUrl.split('.').slice(-1).toString();
      content.push({
        attachment: {
          url: cardBackUrl,
          contentType: `image/${urlExt === 'jpg' ? 'jpeg' : urlExt}`,
          title: cardBackTitle,
        },
      });
    }

    if (content.length > 0) {
      console.log('creating current card document reference resource');
      const response = fhirClient.createResource<DocumentReference>({
        resourceType: 'DocumentReference',
        status: 'current',
        type: type,
        date: dateCreated,
        content: content,
        ...referenceParam,
      });
      const json = await response;
      return json;
    } else {
      console.log('no new document reference created');
      return null;
    }
  } catch (error: unknown) {
    throw new Error(`Failed to create cards DocumentReference resource: ${JSON.stringify(error)}`);
  }
}

export async function createDocumentReference(
  fileURL: string,
  type: CodeableConcept,
  mimeType: string,
  title: string,
  dateCreated: string,
  references: object,
  fhirClient: FhirClient,
): Promise<DocumentReference> {
  try {
    console.log('creating new document reference resource');
    const documentReference = await fhirClient.createResource<DocumentReference>({
      resourceType: 'DocumentReference',
      date: dateCreated,
      status: 'current',
      type: type,
      content: [
        {
          attachment: {
            url: fileURL,
            contentType: mimeType,
            title: title,
          },
        },
      ],
      ...references,
    });

    return documentReference;
  } catch (error: unknown) {
    throw new Error(`Failed to create DocumentReference resource: ${JSON.stringify(error)}`);
  }
}

export async function createConsentResource(
  patientID: string,
  consentPdfID: string,
  dateTime: string,
  fhirClient: FhirClient,
): Promise<Consent> {
  try {
    console.log('creating new consent resource');
    const createdConsent = await fhirClient.createResource<Consent>({
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
          uri: 'https://welcome.ottehr.com/HIPAA.Acknowledgement-S.pdf',
        },
        {
          uri: 'https://welcome.ottehr.com/CTT.and.Guarantee.of.Payment-S.pdf',
        },
      ],
      sourceReference: {
        reference: `DocumentReference/${consentPdfID}`,
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
    throw new Error(`Failed to create Consent resource: ${JSON.stringify(error)}`);
  }
}

export async function getQuestionnaireResponse(
  questionnaireID: string,
  encounterID: string,
  fhirClient: FhirClient,
): Promise<QuestionnaireResponse | undefined> {
  const questionnaireResponse: QuestionnaireResponse[] = await fhirClient.searchResources({
    resourceType: 'QuestionnaireResponse',
    searchParams: [
      {
        name: 'questionnaire',
        value: `Questionnaire/${questionnaireID}`,
      },
      {
        name: 'encounter',
        value: `Encounter/${encounterID}`,
      },
    ],
  });

  if (questionnaireResponse.length === 1) {
    return questionnaireResponse[0];
  }
  return undefined;
}

export async function getRecentQuestionnaireResponse(
  questionnaireID: string,
  patientID: string,
  fhirClient: FhirClient,
): Promise<QuestionnaireResponse | undefined> {
  const questionnaireResponse: QuestionnaireResponse[] = await fhirClient.searchResources({
    resourceType: 'QuestionnaireResponse',
    searchParams: [
      {
        name: 'questionnaire',
        value: `Questionnaire/${questionnaireID}`,
      },
      {
        name: 'subject',
        value: `Patient/${patientID}`,
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
  });

  if (questionnaireResponse.length === 1) {
    return questionnaireResponse[0];
  }
  return undefined;
}
