import { expect, test } from '@playwright/test';
import {
  Account,
  Appointment,
  ClinicalImpression,
  Consent,
  DocumentReference,
  Encounter,
  FhirResource,
  List,
  Observation,
  Patient,
  Person,
  QuestionnaireResponse,
  RelatedPerson,
  Resource,
  ServiceRequest,
  Slot,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import { ResourceHandler } from '../../e2e-utils/resource-handler';

const PROCESS_ID = `contractTests-${DateTime.now().toMillis()}`;
const e2eHandler = new ResourceHandler(PROCESS_ID);
const integrationHandler = new ResourceHandler(PROCESS_ID);

test.beforeAll(async () => {
  await Promise.all([await integrationHandler.setResourcesFast(), await e2eHandler.setResources()]);
  await Promise.all([
    e2eHandler.waitTillAppointmentPreprocessed(e2eHandler.appointment.id!),
    e2eHandler.waitTillHarvestingDone(e2eHandler.appointment.id!),
  ]);
});

test.afterAll(async () => {
  await integrationHandler.cleanupResources();
  await e2eHandler.cleanupResources();
});

const SKIP_ME = 'SKIP_ME_FOR_VALUE_CHECKING';

test('Ensure Resources created by generate test data -> harvest -> prefill is the same as what we create for integration testing', async () => {
  // Gab fresh versions of all the EHR resources that are created by generate -> harvest -> prefill pipeline
  const e2eResources = await getAllResourcesFromFHIR(e2eHandler.appointment.id!);
  const integrationResources = await getAllResourcesFromFHIR(integrationHandler.appointment.id!);

  appointmentTests(e2eResources, integrationResources);
  patientTests(e2eResources, integrationResources);
  relatedPersonTests(e2eResources, integrationResources);
  personTests(e2eResources, integrationResources);
  observationTests(e2eResources, integrationResources);
  encounterTests(e2eResources, integrationResources);
  slotTests(e2eResources, integrationResources);
  listTests(e2eResources, integrationResources);
  serviceRequestTests(e2eResources, integrationResources);
  clinicalImpressionTests(e2eResources, integrationResources);
  documentReferenceTests(e2eResources, integrationResources);
  questionnaireResponseTests(e2eResources, integrationResources);
  consentTests(e2eResources, integrationResources);
  accountTests(e2eResources, integrationResources);
});

const appointmentTests = (e2eResources: Resource[], integrationResources: Resource[]): void => {
  const e2eAppointments = e2eResources.filter((resource) => resource.resourceType === 'Appointment') as Appointment[];
  const integrationAppointments = integrationResources.filter(
    (resource) => resource.resourceType === 'Appointment'
  ) as Appointment[];

  expect(e2eAppointments.length).toEqual(integrationAppointments.length);

  const e2eAppointment = cleanAppointment(e2eAppointments[0]);
  const integrationAppointment = cleanAppointment(integrationAppointments[0]);
  checkKeysAndValuesBothWays(e2eAppointment, integrationAppointment, 'Appointment');
};

const patientTests = (e2eResources: Resource[], integrationResources: Resource[]): void => {
  const e2ePatients = e2eResources.filter((resource) => resource.resourceType === 'Patient') as Patient[];
  const integrationPatients = integrationResources.filter(
    (resource) => resource.resourceType === 'Patient'
  ) as Patient[];

  expect(e2ePatients.length).toEqual(integrationPatients.length);

  const e2eAppointment = cleanPatient(e2ePatients[0]);
  const integrationAppointment = cleanPatient(integrationPatients[0]);
  checkKeysAndValuesBothWays(e2eAppointment, integrationAppointment, 'Patient');
};

const relatedPersonTests = (e2eResources: Resource[], integrationResources: Resource[]): void => {
  const e2eRPs = e2eResources.filter((resource) => resource.resourceType === 'RelatedPerson') as RelatedPerson[];
  const integrationRPs = integrationResources.filter(
    (resource) => resource.resourceType === 'RelatedPerson'
  ) as RelatedPerson[];

  expect(e2eRPs.length).toEqual(integrationRPs.length);

  const e2eRP = cleanRelatedPerson(e2eRPs[0]);
  const integrationRP = cleanRelatedPerson(integrationRPs[0]);
  checkKeysAndValuesBothWays(e2eRP, integrationRP, 'RelatedPerson');
};

const personTests = (e2eResources: Resource[], integrationResources: Resource[]): void => {
  const e2ePersons = e2eResources.filter((resource) => resource.resourceType === 'Person') as Person[];
  const integrationPersons = integrationResources.filter((resource) => resource.resourceType === 'Person') as Person[];

  expect(e2ePersons.length).toEqual(integrationPersons.length);

  const e2eP = cleanPerson(e2ePersons[0]);
  const integrationP = cleanPerson(integrationPersons[0]);
  checkKeysAndValuesBothWays(e2eP, integrationP, 'Person');
};

const observationTests = (e2eResources: Resource[], integrationResources: Resource[]): void => {
  const e2eObservations = e2eResources.filter((resource) => resource.resourceType === 'Observation') as Observation[];
  const integrationObservations = integrationResources.filter(
    (resource) => resource.resourceType === 'Observation'
  ) as Observation[];

  expect(e2eObservations.length).toEqual(integrationObservations.length);

  const e2eCleaned = e2eObservations.map((observation) => cleanObservation(observation));
  const integrationCleaned = integrationObservations.map((observation) => cleanObservation(observation));

  e2eCleaned.forEach((e2eObservation) => {
    const e2eObservationTypeTag = e2eObservation.meta?.tag?.find(
      (tag) => tag.system === 'https://fhir.zapehr.com/r4/StructureDefinitions/exam-observation-field'
    );
    const integrationObservation = integrationCleaned.find(
      (integrationObservation) =>
        integrationObservation.meta?.tag?.find(
          (tag) =>
            tag.system === 'https://fhir.zapehr.com/r4/StructureDefinitions/exam-observation-field' &&
            tag.code === e2eObservationTypeTag!.code
        )
    );

    checkKeysAndValuesBothWays(e2eObservation, integrationObservation, `${e2eObservationTypeTag!.code} Observation`);
  });
};

const encounterTests = (e2eResources: Resource[], integrationResources: Resource[]): void => {
  const e2eEncounters = e2eResources.filter((resource) => resource.resourceType === 'Encounter') as Encounter[];
  const integrationEncounters = integrationResources.filter(
    (resource) => resource.resourceType === 'Encounter'
  ) as Encounter[];

  expect(e2eEncounters.length).toEqual(integrationEncounters.length);

  const e2eEncounter = cleanEncounter(e2eEncounters[0]);
  const integrationEncounter = cleanEncounter(integrationEncounters[0]);
  checkKeysAndValuesBothWays(e2eEncounter, integrationEncounter, 'Encounter');
};

const slotTests = (e2eResources: Resource[], integrationResources: Resource[]): void => {
  const e2eSlots = e2eResources.filter((resource) => resource.resourceType === 'Slot') as Slot[];
  const integrationSlots = integrationResources.filter((resource) => resource.resourceType === 'Slot') as Slot[];

  expect(e2eSlots.length).toEqual(integrationSlots.length);

  const e2eSlot = cleanSlot(e2eSlots[0]);
  const integrationSlot = cleanSlot(integrationSlots[0]);
  checkKeysAndValuesBothWays(e2eSlot, integrationSlot, 'Slot');
};

const listTests = (e2eResources: Resource[], integrationResources: Resource[]): void => {
  const e2eLists = e2eResources.filter((resource) => resource.resourceType === 'List') as List[];
  const integrationLists = integrationResources.filter((resource) => resource.resourceType === 'List') as List[];

  expect(e2eLists.length).toEqual(integrationLists.length);

  const e2eCleaned = e2eLists.map((list) => cleanList(list));
  const integrationCleaned = integrationLists.map((list) => cleanList(list));

  e2eCleaned.forEach((e2eList) => {
    const integrationList = integrationCleaned.find((iList) => iList.title === e2eList.title);

    checkKeysAndValuesBothWays(e2eList, integrationList, `${e2eList!.title} List`);
  });
};

const serviceRequestTests = (e2eResources: Resource[], integrationResources: Resource[]): void => {
  const e2eServiceRequests = e2eResources.filter(
    (resource) => resource.resourceType === 'ServiceRequest'
  ) as ServiceRequest[];
  const integrationServiceRequests = integrationResources.filter(
    (resource) => resource.resourceType === 'ServiceRequest'
  ) as ServiceRequest[];

  expect(e2eServiceRequests.length).toEqual(integrationServiceRequests.length);

  const e2eServiceRequest = cleanServiceRequest(e2eServiceRequests[0]);
  const integrationServiceRequest = cleanServiceRequest(integrationServiceRequests[0]);
  checkKeysAndValuesBothWays(e2eServiceRequest, integrationServiceRequest, 'ServiceRequest');
};

const clinicalImpressionTests = (e2eResources: Resource[], integrationResources: Resource[]): void => {
  const e2eClinicalImpressions = e2eResources.filter(
    (resource) => resource.resourceType === 'ClinicalImpression'
  ) as ClinicalImpression[];
  const integrationClinicalImpressions = integrationResources.filter(
    (resource) => resource.resourceType === 'ClinicalImpression'
  ) as ClinicalImpression[];

  expect(e2eClinicalImpressions.length).toEqual(integrationClinicalImpressions.length);

  const e2eClinicalImpression = cleanClinicalImpression(e2eClinicalImpressions[0]);
  const integrationClinicalImpression = cleanClinicalImpression(integrationClinicalImpressions[0]);
  checkKeysAndValuesBothWays(e2eClinicalImpression, integrationClinicalImpression, 'ClinicalImpression');
};

const documentReferenceTests = (e2eResources: Resource[], integrationResources: Resource[]): void => {
  const e2eDocumentReferences = e2eResources.filter(
    (resource) => resource.resourceType === 'DocumentReference'
  ) as DocumentReference[];
  const integrationDocumentReferences = integrationResources.filter(
    (resource) => resource.resourceType === 'DocumentReference'
  ) as DocumentReference[];

  expect(e2eDocumentReferences.length).toEqual(integrationDocumentReferences.length);

  const e2eCleaned = e2eDocumentReferences.map((docRef) => cleanDocumentReference(docRef));
  const integrationCleaned = integrationDocumentReferences.map((docRef) => cleanDocumentReference(docRef));

  e2eCleaned.forEach((e2eDocRef) => {
    const e2eDocTypeLoincCoding = e2eDocRef.type?.coding?.find((coding) => coding.system === 'http://loinc.org');

    const integrationDocRef = integrationCleaned.find(
      (integrationDocRef) =>
        integrationDocRef.type?.coding?.find(
          (coding) => coding.system === 'http://loinc.org' && coding.code === e2eDocTypeLoincCoding!.code
        )
    );

    checkKeysAndValuesBothWays(e2eDocRef, integrationDocRef, `${e2eDocTypeLoincCoding!.code} DocumentReference`);
  });
};

const questionnaireResponseTests = (e2eResources: Resource[], integrationResources: Resource[]): void => {
  const e2eQuestionnaireResponses = e2eResources.filter(
    (resource) => resource.resourceType === 'QuestionnaireResponse'
  ) as QuestionnaireResponse[];
  const integrationQuestionnaireResponses = integrationResources.filter(
    (resource) => resource.resourceType === 'QuestionnaireResponse'
  ) as QuestionnaireResponse[];

  expect(e2eQuestionnaireResponses.length).toEqual(integrationQuestionnaireResponses.length);

  const e2eQuestionnaireResponse = cleanQuestionnaireResponse(e2eQuestionnaireResponses[0]);
  const integrationQuestionnaireResponse = cleanQuestionnaireResponse(integrationQuestionnaireResponses[0]);
  checkKeysAndValuesBothWays(e2eQuestionnaireResponse, integrationQuestionnaireResponse, 'QuestionnaireResponse');
};

const consentTests = (e2eResources: Resource[], integrationResources: Resource[]): void => {
  const e2eConsents = e2eResources.filter((resource) => resource.resourceType === 'Consent') as Consent[];
  const integrationConsents = integrationResources.filter(
    (resource) => resource.resourceType === 'Consent'
  ) as Consent[];

  expect(e2eConsents.length).toEqual(integrationConsents.length);

  const e2eConsent = cleanConsent(e2eConsents[0]);
  const integrationConsent = cleanConsent(integrationConsents[0]);
  checkKeysAndValuesBothWays(e2eConsent, integrationConsent, 'Consent');
};

const accountTests = (e2eResources: Resource[], integrationResources: Resource[]): void => {
  const e2eAccounts = e2eResources.filter((resource) => resource.resourceType === 'Account') as Account[];
  const integrationAccounts = integrationResources.filter(
    (resource) => resource.resourceType === 'Account'
  ) as Account[];

  expect(e2eAccounts.length).toEqual(integrationAccounts.length);

  const e2eAccount = cleanAccount(e2eAccounts[0]);
  const integrationAccount = cleanAccount(integrationAccounts[0]);
  checkKeysAndValuesBothWays(e2eAccount, integrationAccount, 'Account');
};

const checkKeysAndValuesBothWays = (e2eResource: any, integrationResource: any, label: string): void => {
  Object.entries(e2eResource).forEach(([key, value]) => {
    expect(integrationResource[key], `expect integration ${label}.${key} value to be defined`).toBeDefined();
    // same meta tag sorting logic
    if (key === 'meta') {
      const valueMetaTags = (value as FhirResource['meta'])?.tag;
      const integrationMetaTags = (integrationResource[key] as FhirResource['meta'])?.tag;
      if (valueMetaTags && integrationMetaTags) {
        const valueTagsSorted = valueMetaTags.sort((a, b) => {
          if (a.system === undefined && b.system === undefined) {
            return 0;
          } else if (a.system === undefined) {
            return 1; // undefined comes after defined
          } else if (b.system === undefined) {
            return -1; // defined comes before undefined
          }
          return a.system.localeCompare(b.system);
        });
        const integrationTagsSorted = integrationMetaTags.sort((a, b) => {
          if (a.system === undefined && b.system === undefined) {
            return 0;
          } else if (a.system === undefined) {
            return 1; // undefined comes after defined
          } else if (b.system === undefined) {
            return -1; // defined comes before undefined
          }
          return a.system.localeCompare(b.system);
        });

        const newVal = {
          ...(value as any),
          meta: {
            ...((value as any).meta || {}),
            tag: valueTagsSorted,
          },
        };
        const compValue = {
          ...(integrationResource[key] as any),
          meta: {
            ...((integrationResource[key] as any).meta || {}),
            tag: integrationTagsSorted,
          },
        };
        expect(compValue, `expect integration ${label}.${key} value to be equal`).toEqual(newVal);
      } else {
        expect(integrationResource[key], `expect integration ${label}.${key} value to be equal`).toEqual(value);
      }
    } else {
      expect(integrationResource[key], `expect integration ${label}.${key} value to be equal`).toEqual(value);
    }
  });
  Object.entries(integrationResource).forEach(([key, value]) => {
    expect(e2eResource[key], `expect e2e ${label}.${key} value to be defined`).toBeDefined();
    expect(e2eResource[key], `expect e2e ${label}.${key} value to be equal`).toEqual(value);
  });
};

const cleanOutMetaStuff = (resource: any): Resource => {
  resource.id = SKIP_ME;
  resource.meta.versionId = SKIP_ME;
  resource.meta.lastUpdated = SKIP_ME;
  return resource;
};

const cleanAppointment = (appointment: Appointment): Appointment => {
  let cleanedAppointment = { ...appointment };
  cleanedAppointment = cleanOutMetaStuff(cleanedAppointment) as Appointment;
  cleanedAppointment.participant[0].actor!.reference =
    cleanedAppointment.participant[0].actor!.reference?.split('/')[0]; // cut off the UUID for comparison
  cleanedAppointment.start = SKIP_ME;
  cleanedAppointment.end = SKIP_ME;
  cleanedAppointment.slot![0].reference = cleanedAppointment.slot![0].reference?.split('/')[0]; // Cut off the UUID for comparison
  cleanedAppointment.created = SKIP_ME;
  return cleanedAppointment;
};

const cleanPatient = (patient: Patient): Patient => {
  let cleanedPatient = { ...patient };
  cleanedPatient = cleanOutMetaStuff(cleanedPatient) as Patient;
  return cleanedPatient;
};

const cleanRelatedPerson = (relatedPerson: RelatedPerson): RelatedPerson => {
  let cleanedRelatedPerson = { ...relatedPerson };
  cleanedRelatedPerson = cleanOutMetaStuff(cleanedRelatedPerson) as RelatedPerson;
  cleanedRelatedPerson.patient.reference = cleanedRelatedPerson.patient.reference?.split('/')[0]; // cut off the UUID for comparison
  return cleanedRelatedPerson;
};

const cleanPerson = (person: Person): Person => {
  let cleanedPerson = { ...person };
  cleanedPerson = cleanOutMetaStuff(cleanedPerson) as Person;
  cleanedPerson.link = []; // Can't check these because Person resource gets used for many different tests and it gets littered. It is effectively a shared resource.
  return cleanedPerson;
};

const cleanObservation = (observation: Observation): Observation => {
  let cleanedObservation = { ...observation };
  cleanedObservation = cleanOutMetaStuff(cleanedObservation) as Observation;
  cleanedObservation.subject!.reference = cleanedObservation.subject!.reference?.split('/')[0]; // cut off the UUID for comparison
  cleanedObservation.encounter!.reference = cleanedObservation.encounter!.reference?.split('/')[0]; // cut off the UUID for comparison
  return cleanedObservation;
};

const cleanEncounter = (encounter: Encounter): Encounter => {
  let cleanedEncounter = { ...encounter };
  cleanedEncounter = cleanOutMetaStuff(cleanedEncounter) as Encounter;
  cleanedEncounter.appointment!.forEach((appointment) => {
    appointment.reference = appointment.reference?.split('/')[0]; // cut off the UUID for comparison
  });
  cleanedEncounter.subject!.reference = cleanedEncounter.subject!.reference?.split('/')[0]; // cut off the UUID for comparison
  cleanedEncounter.statusHistory?.forEach((statusHistory) => {
    statusHistory.period!.start = SKIP_ME;
  });
  return cleanedEncounter;
};

const cleanSlot = (slot: Slot): Slot => {
  let cleanedSlot = { ...slot };
  cleanedSlot = cleanOutMetaStuff(cleanedSlot) as Slot;
  cleanedSlot.schedule!.reference = cleanedSlot.schedule!.reference?.split('/')[0]; // cut off the UUID for comparison
  cleanedSlot.start = SKIP_ME;
  cleanedSlot.end = SKIP_ME;
  return cleanedSlot;
};

const cleanList = (list: List): List => {
  let cleanedList = { ...list };
  cleanedList = cleanOutMetaStuff(cleanedList) as List;
  cleanedList.subject!.reference = cleanedList.subject!.reference?.split('/')[0]; // cut off the UUID for comparison
  cleanedList.entry?.forEach((entry) => {
    entry.item!.reference = entry.item!.reference?.split('/')[0]; // cut off the UUID for comparison
    entry.date = SKIP_ME;
  });
  return cleanedList;
};

const cleanServiceRequest = (serviceRequest: ServiceRequest): ServiceRequest => {
  let cleanedServiceRequest = { ...serviceRequest };
  cleanedServiceRequest = cleanOutMetaStuff(cleanedServiceRequest) as ServiceRequest;
  cleanedServiceRequest.subject!.reference = cleanedServiceRequest.subject!.reference?.split('/')[0]; // cut off the UUID for comparison
  cleanedServiceRequest.encounter!.reference = cleanedServiceRequest.encounter!.reference?.split('/')[0]; // cut off the UUID for comparison
  return cleanedServiceRequest;
};

const cleanClinicalImpression = (clinicalImpression: ClinicalImpression): ClinicalImpression => {
  let cleanedClinicalImpression = { ...clinicalImpression };
  cleanedClinicalImpression = cleanOutMetaStuff(cleanedClinicalImpression) as ClinicalImpression;
  cleanedClinicalImpression.subject!.reference = cleanedClinicalImpression.subject!.reference?.split('/')[0]; // cut off the UUID for comparison
  cleanedClinicalImpression.encounter!.reference = cleanedClinicalImpression.encounter!.reference?.split('/')[0]; // cut off the UUID for comparison
  return cleanedClinicalImpression;
};

const cleanDocumentReference = (documentReference: DocumentReference): DocumentReference => {
  let cleanedDocumentReference = { ...documentReference };
  cleanedDocumentReference = cleanOutMetaStuff(cleanedDocumentReference) as DocumentReference;
  cleanedDocumentReference.subject!.reference = cleanedDocumentReference.subject!.reference?.split('/')[0]; // cut off the UUID for comparison
  cleanedDocumentReference.date = SKIP_ME;
  cleanedDocumentReference.content.forEach((content) => {
    content.attachment!.url = SKIP_ME;
  });
  cleanedDocumentReference.context?.related?.forEach((related) => {
    related.reference = related.reference?.split('/')[0]; // cut off the UUID for comparison
  });
  return cleanedDocumentReference;
};

const cleanQuestionnaireResponse = (questionnaireResponse: QuestionnaireResponse): QuestionnaireResponse => {
  let cleanedQuestionnaireResponse = { ...questionnaireResponse };
  cleanedQuestionnaireResponse = cleanOutMetaStuff(cleanedQuestionnaireResponse) as QuestionnaireResponse;
  cleanedQuestionnaireResponse.subject!.reference = cleanedQuestionnaireResponse.subject!.reference?.split('/')[0]; // cut off the UUID for comparison
  cleanedQuestionnaireResponse.encounter!.reference = cleanedQuestionnaireResponse.encounter!.reference?.split('/')[0]; // cut off the UUID for comparison
  cleanedQuestionnaireResponse.authored = SKIP_ME;
  return cleanedQuestionnaireResponse;
};

const cleanConsent = (consent: Consent): Consent => {
  let cleanedConsent = { ...consent };
  cleanedConsent = cleanOutMetaStuff(cleanedConsent) as Consent;
  cleanedConsent.patient!.reference = cleanedConsent.patient!.reference?.split('/')[0]; // cut off the UUID for comparison
  cleanedConsent.sourceReference!.reference = cleanedConsent.sourceReference!.reference?.split('/')[0]; // cut off the UUID for comparison
  cleanedConsent.dateTime = SKIP_ME;
  return cleanedConsent;
};

const cleanAccount = (account: Account): Account => {
  let cleanedAccount = { ...account };
  cleanedAccount = cleanOutMetaStuff(cleanedAccount) as Account;
  cleanedAccount.subject?.forEach((subject) => {
    subject.reference = subject.reference?.split('/')[0]; // cut off the UUID for comparison
  });
  const containedRelatedPerson = cleanedAccount.contained?.find(
    (contained) => contained.resourceType === 'RelatedPerson'
  ) as RelatedPerson;
  containedRelatedPerson.patient.reference = containedRelatedPerson.patient.reference?.split('/')[0]; // cut off the UUID for comparison
  return cleanedAccount;
};

const getAllResourcesFromFHIR = async (appointmentId: string): Promise<Resource[]> => {
  return (
    await (
      await e2eHandler.apiClient
    ).fhir.search<Appointment>({
      resourceType: 'Appointment',
      params: [
        {
          name: '_id',
          value: appointmentId,
        },
        {
          name: '_include',
          value: 'Appointment:patient',
        },
        {
          name: '_include',
          value: 'Appointment:slot',
        },
        {
          name: '_include',
          value: 'Appointment:location',
        },
        {
          name: '_revinclude:iterate',
          value: 'RelatedPerson:patient',
        },
        {
          name: '_revinclude:iterate',
          value: 'Encounter:appointment',
        },
        {
          name: '_revinclude:iterate',
          value: 'DocumentReference:patient',
        },
        {
          name: '_revinclude:iterate',
          value: 'QuestionnaireResponse:encounter',
        },
        {
          name: '_revinclude:iterate',
          value: 'Person:relatedperson',
        },
        {
          name: '_revinclude:iterate',
          value: 'List:subject',
        },
        {
          name: '_revinclude:iterate',
          value: 'Consent:patient',
        },
        {
          name: '_revinclude:iterate',
          value: 'Account:patient',
        },
        {
          name: '_revinclude:iterate',
          value: 'Observation:encounter',
        },
        {
          name: '_revinclude:iterate',
          value: 'ServiceRequest:encounter',
        },
        {
          name: '_revinclude:iterate',
          value: 'ClinicalImpression:encounter',
        },
      ],
    })
  ).unbundle();

  // Note it does not include AuditEvent yet but could?
};
