import { expect, test } from '@playwright/test';
import { Appointment, Observation, Patient, Resource } from 'fhir/r4b';
import { ResourceHandler } from '../../e2e-utils/resource-handler';

const e2eHandler = new ResourceHandler();
const integrationHandler = new ResourceHandler();

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
  observationTests(e2eResources, integrationResources);
});

const appointmentTests = (e2eResources: Resource[], integrationResources: Resource[]): void => {
  const e2eAppointments = e2eResources.filter((resource) => resource.resourceType === 'Appointment') as Appointment[];
  const integrationAppointments = integrationResources.filter(
    (resource) => resource.resourceType === 'Appointment'
  ) as Appointment[];

  expect(e2eAppointments.length).toEqual(integrationAppointments.length);

  const e2eAppointment = cleanAppointment(e2eAppointments[0]);
  const integrationAppointment = cleanAppointment(integrationAppointments[0]);
  checkKeysAndValuesBothWays(e2eAppointment, integrationAppointment, 'appointment');
};

const patientTests = (e2eResources: Resource[], integrationResources: Resource[]): void => {
  const e2ePatients = e2eResources.filter((resource) => resource.resourceType === 'Patient') as Patient[];
  const integrationPatients = integrationResources.filter(
    (resource) => resource.resourceType === 'Patient'
  ) as Patient[];

  expect(e2ePatients.length).toEqual(integrationPatients.length);

  const e2eAppointment = cleanPatient(e2ePatients[0]);
  const integrationAppointment = cleanPatient(integrationPatients[0]);
  checkKeysAndValuesBothWays(e2eAppointment, integrationAppointment, 'patient');
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

    checkKeysAndValuesBothWays(e2eObservation, integrationObservation, `${e2eObservationTypeTag!.code} observation`);
  });
  // TODO we can't check that these are valid yet because the actual data is junk placeholder snomed codes.
};

const checkKeysAndValuesBothWays = (e2eResource: any, integrationResource: any, label: string): void => {
  Object.entries(e2eResource).forEach(([key, value]) => {
    expect(integrationResource[key], `expect integration ${label}.${key} value to be defined`).toBeDefined();
    expect(integrationResource[key], `expect integration ${label}.${key} value to be equal`).toEqual(value);
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

const cleanObservation = (observation: Observation): Observation => {
  let cleanedObservation = { ...observation };
  cleanedObservation = cleanOutMetaStuff(cleanedObservation) as Observation;
  cleanedObservation.subject!.reference = cleanedObservation.subject!.reference?.split('/')[0]; // cut off the UUID for comparison
  cleanedObservation.encounter!.reference = cleanedObservation.encounter!.reference?.split('/')[0]; // cut off the UUID for comparison
  return cleanedObservation;
};

const getAllResourcesFromFHIR = async (appointmentId: string): Promise<Resource[]> => {
  return (
    await e2eHandler.apiClient.fhir.search<Patient>({
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
          value: 'Encounter:participant',
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
          value: 'Schedule:actor',
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
